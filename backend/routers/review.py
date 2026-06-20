import os
import re
import json
import uuid
import asyncio
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from db import get_db, Task, SessionLocal
import jarvis_agent as agent

router = APIRouter()


# ── LLM provider factory ──────────────────────────────────────────────────

def _chat(prompt: str, max_tokens: int = 2000) -> str:
    """Call the configured LLM provider and return the text response."""
    provider = os.environ.get("LLM_PROVIDER", "ollama").lower()

    if provider == "ollama":
        from openai import OpenAI
        import httpx
        base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        model = os.environ.get("OLLAMA_MODEL", "llama3")
        try:
            client = OpenAI(base_url=base_url, api_key="ollama")
            resp = client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            if "Connection" in str(e) or "connect" in str(e).lower():
                raise RuntimeError(
                    f"Ollama is not running. Start it with: ollama serve\n"
                    f"Then pull a model: ollama pull {model}\n"
                    f"(Original error: {e})"
                )
            raise

    elif provider == "azure":
        from openai import AzureOpenAI
        client = AzureOpenAI(
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-02-01"),
        )
        model = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
        resp = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.choices[0].message.content.strip()

    elif provider == "anthropic":
        from anthropic import Anthropic
        client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()

    else:
        raise ValueError(f"Unknown LLM_PROVIDER: '{provider}'. Use ollama, azure, or anthropic.")


def _clean_json(raw: str):
    """Robustly extract and parse JSON from LLM output, handling code fences and surrounding text."""
    import re
    raw = raw.strip()

    # 1. Try code-fence extraction first (handles ```json...``` or ```...```)
    if "```" in raw:
        parts = raw.split("```")
        for part in parts[1::2]:          # every odd segment is inside a fence
            part = part.strip()
            if part.lower().startswith("json"):
                part = part[4:].strip()
            if part.startswith(("{", "[")):
                try:
                    return json.loads(part)
                except json.JSONDecodeError:
                    pass

    # 2. Try direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 3. Regex: grab the outermost { } or [ ] block
    match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', raw)
    if match:
        return json.loads(match.group(1))

    raise json.JSONDecodeError("No valid JSON found in LLM response", raw, 0)


# ── Formatters ────────────────────────────────────────────────────────────

def _fmt_emails(emails: list) -> str:
    if not emails:
        return "No emails provided."
    lines = []
    for e in emails[:15]:
        sender = e.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
        lines.append(
            f"- [{e.get('importance','normal').upper()}] From: {sender} | "
            f"Subject: {e.get('subject','(no subject)')} | "
            f"Read: {e.get('isRead', True)} | "
            f"Preview: {e.get('bodyPreview','')[:100]}"
        )
    return "\n".join(lines)


def _fmt_teams(messages: list) -> str:
    if not messages:
        return "No Teams messages provided."
    lines = []
    for m in messages[:10]:
        sender = m.get("from", {}).get("user", {}).get("displayName", "Unknown")
        body = m.get("body", {}).get("content", "")[:100]
        lines.append(f"- From: {sender} | {body}")
    return "\n".join(lines)


def _fmt_tasks(tasks: list) -> str:
    if not tasks:
        return "No open tasks."
    lines = []
    for t in tasks[:20]:
        lines.append(
            f"- [{t.get('priority','normal').upper()}] {t.get('title')} "
            f"(status: {t.get('status')}, due: {t.get('due_date','—')})"
        )
    return "\n".join(lines)


def _fmt_goals(goals: list) -> str:
    if not goals:
        return ""
    return "\n".join(
        f"- {g.get('name')} ({g.get('progress', 0):.0f}% — {g.get('status','on_track')})"
        for g in goals
    )


# ── Request models ────────────────────────────────────────────────────────

class BriefingRequest(BaseModel):
    emails: list = []
    teams_messages: list = []
    tasks: list = []
    goals: list = []


class DraftRequest(BaseModel):
    context_type: str   # "email_reply" | "new_email" | "teams_message"
    thread: list = []
    instruction: str = ""
    goals_context: list = []
    recipient: Optional[str] = None
    subject: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/provider")
def get_provider():
    """Return the active LLM provider so the UI can display it."""
    return {"provider": os.environ.get("LLM_PROVIDER", "ollama")}


@router.post("/briefing")
def generate_briefing(req: BriefingRequest):
    user_name = os.environ.get("JARVIS_USER_DISPLAY_NAME", "")
    prompt = f"""You are JARVIS, a private AI executive assistant for {user_name}.

Generate a structured morning briefing based on the data below. Be concise and action-oriented.

EMAILS ({len(req.emails)}):
{_fmt_emails(req.emails)}

TEAMS MESSAGES ({len(req.teams_messages)}):
{_fmt_teams(req.teams_messages)}

OPEN TASKS ({len(req.tasks)}):
{_fmt_tasks(req.tasks)}

GOALS:
{_fmt_goals(req.goals)}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{{
  "summary": "2-3 sentence executive summary of what matters most today",
  "urgent_count": <number>,
  "action_items": ["action 1", "action 2", "action 3"],
  "email_highlights": [
    {{"subject": "...", "from": "...", "priority": "urgent|high|normal", "recommended_action": "..."}}
  ],
  "teams_highlights": [
    {{"from": "...", "preview": "...", "recommended_action": "..."}}
  ],
  "blocked_tasks": [{{"title": "...", "notes": "..."}}],
  "overdue_tasks": [{{"title": "...", "due_date": "..."}}]
}}"""

    try:
        return _clean_json(_chat(prompt, max_tokens=2000))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse briefing JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/draft")
def generate_draft(req: DraftRequest):
    user_name = os.environ.get("JARVIS_USER_DISPLAY_NAME", "")
    user_email = os.environ.get("JARVIS_USER_EMAIL", "")

    goals_section = f"\nRELEVANT GOALS:\n{_fmt_goals(req.goals_context)}" if req.goals_context else ""

    thread_section = ""
    if req.thread:
        lines = []
        for m in req.thread:
            sender = (
                m.get("from", {}).get("emailAddress", {}).get("name")
                or m.get("from", {}).get("user", {}).get("displayName", "Unknown")
            )
            body = m.get("bodyPreview") or m.get("body", {}).get("content", "")
            lines.append(f"{sender}: {body[:300]}")
        thread_section = "\n".join(lines)

    if req.context_type == "email_reply":
        instruction_text = req.instruction or "Write a professional, warm, and concise reply."
        prompt = f"""You are JARVIS, drafting an email reply on behalf of {user_name} ({user_email}).

EMAIL THREAD:
{thread_section}
{goals_section}

INSTRUCTION: {instruction_text}

Write a professional, clear, warm reply. Sign off as {user_name}.
Return ONLY valid JSON (no markdown):
{{
  "subject": "Re: ...",
  "body": "...",
  "tone": "professional|friendly|urgent",
  "suggested_follow_up": "optional or null"
}}"""

    elif req.context_type == "new_email":
        instruction_text = req.instruction or "Write a professional email."
        prompt = f"""You are JARVIS, drafting a new email on behalf of {user_name} ({user_email}).

TO: {req.recipient or "(recipient)"}
SUBJECT HINT: {req.subject or ""}
CONTEXT: {thread_section}
{goals_section}

INSTRUCTION: {instruction_text}

Return ONLY valid JSON (no markdown):
{{
  "subject": "...",
  "body": "...",
  "tone": "professional|friendly|urgent",
  "suggested_follow_up": null
}}"""

    else:  # teams_message
        instruction_text = req.instruction or "Write a concise Teams message."
        prompt = f"""You are JARVIS, drafting a Teams message on behalf of {user_name}.

CONVERSATION CONTEXT:
{thread_section}
{goals_section}

INSTRUCTION: {instruction_text}

Return ONLY valid JSON (no markdown):
{{
  "body": "...",
  "tone": "professional|friendly|urgent",
  "suggested_follow_up": null
}}"""

    try:
        return _clean_json(_chat(prompt, max_tokens=1000))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse draft JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Extract Tasks ─────────────────────────────────────────────────────────

class ExtractTasksRequest(BaseModel):
    messages: list = []          # emails or teams messages
    source_type: str = "email"   # "email" | "teams_chat" | "teams_channel"
    goals: list = []             # for linking tasks to goals


@router.post("/extract-tasks")
def extract_tasks(req: ExtractTasksRequest):
    """
    Use LLM to read messages and extract structured tasks based on
    intent, urgency, deadlines, and context. Returns suggested tasks
    for user review before saving.
    """
    from datetime import date
    user_name = os.environ.get("JARVIS_USER_DISPLAY_NAME", "")
    today = date.today().isoformat()

    # Format messages for the prompt
    msg_lines = []
    for i, m in enumerate(req.messages[:20]):
        if req.source_type == "email":
            sender = m.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
            subject = m.get("subject", "(no subject)")
            body = m.get("bodyPreview") or m.get("body", {}).get("content", "")
            link = m.get("webLink", "")
            msg_id = m.get("id", "")
            msg_lines.append(
                f"[{i}] EMAIL id={msg_id}\n"
                f"  From: {sender}\n"
                f"  Subject: {subject}\n"
                f"  Preview: {str(body)[:400]}\n"
                f"  Link: {link}"
            )
        else:
            sender = (
                m.get("from", {}).get("user", {}).get("displayName")
                or m.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
            )
            body = m.get("body", {}).get("content", m.get("bodyPreview", ""))
            msg_id = m.get("id", "")
            msg_lines.append(
                f"[{i}] TEAMS MESSAGE id={msg_id}\n"
                f"  From: {sender}\n"
                f"  Content: {str(body)[:400]}"
            )

    goals_list = "\n".join(
        f"- Goal {g.get('id')}: {g.get('name')}" for g in req.goals
    ) if req.goals else "No goals provided."

    prompt = f"""You are JARVIS, an AI executive assistant for {user_name}.
Today's date: {today}

Analyze the messages below and extract ONLY genuine action items that require follow-up.
Skip FYI messages, newsletters, automated notifications, and items that need no action.

MESSAGES:
{chr(10).join(msg_lines)}

MY GOALS (for linking tasks):
{goals_list}

For each real action item, create a task. Use your judgment on:
- PRIORITY: "urgent" (same-day / blocking), "high" (this week / important stakeholder), "normal" (standard follow-up), "low" (nice to have)
- DUE DATE: Extract from message if mentioned. Examples: "by EOD" = {today}, "by Friday" = nearest Friday from {today}, "next week" = 7 days out. Leave null if not mentioned.
- LINKED GOAL ID: Match to a goal above if clearly relevant, else null.
- NOTES: 1-2 sentences of key context from the message (who asked, what decision is needed, what's at stake).

Return ONLY valid JSON array (no markdown):
[
  {{
    "title": "Clear, actionable task title starting with a verb (Review, Reply to, Follow up on, Approve, Schedule, etc.)",
    "priority": "urgent|high|normal|low",
    "due_date": "YYYY-MM-DD or null",
    "notes": "Key context from the message",
    "source_index": <index of the message from the list above>,
    "linked_goal_id": <goal id number or null>
  }}
]

If there are no action items, return an empty array: []"""

    try:
        raw = _chat(prompt, max_tokens=2000)
        tasks = _clean_json(raw)
        if not isinstance(tasks, list):
            tasks = []

        # Enrich each task with source metadata from the original messages
        enriched = []
        for t in tasks:
            idx = t.pop("source_index", None)
            source_msg = req.messages[idx] if idx is not None and idx < len(req.messages) else {}

            if req.source_type == "email":
                t["source_id"]   = source_msg.get("id")
                t["source_link"] = source_msg.get("webLink")
                t["source_type"] = "email"
            else:
                t["source_id"]   = source_msg.get("id")
                t["source_link"] = None
                t["source_type"] = req.source_type

            enriched.append(t)

        return enriched

        for t in tasks:
            idx = t.pop("source_index", None)
            source_msg = req.messages[idx] if idx is not None and idx < len(req.messages) else {}

            if req.source_type == "email":
                t["source_id"]   = source_msg.get("id")
                t["source_link"] = source_msg.get("webLink")
                t["source_type"] = "email"
            else:
                t["source_id"]   = source_msg.get("id")
                t["source_link"] = None
                t["source_type"] = req.source_type

            enriched.append(t)

        return enriched

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse tasks JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Auto-Extract: Batch Task Extraction with Status Inference ─────────────

VALID_STATUSES = {"todo", "in_progress", "done"}


def _extract_batch_with_status(messages: list, source_type: str, user_name: str, today: str) -> list:
    """
    Send one LLM call for a batch of messages. Returns tasks enriched with
    source metadata and a status: todo | in_progress | done.
    Strips HTML from Teams message bodies before sending to reduce token usage.
    """
    msg_lines = []
    for i, m in enumerate(messages):
        if source_type == "email":
            sender = m.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
            subject = m.get("subject", "(no subject)")
            body = (m.get("bodyPreview") or "")[:280]
            msg_id = m.get("id", "")
            date_str = (m.get("receivedDateTime") or "")[:10]
            msg_lines.append(
                f"[{i}] EMAIL id={msg_id} date={date_str}\n"
                f"  From: {sender} | Subject: {subject}\n"
                f"  Preview: {body}"
            )
        else:
            sender = (m.get("from") or {}).get("user", {}).get("displayName") or "Unknown"
            body_obj = m.get("body") or {}
            raw_body = body_obj.get("content") or m.get("bodyPreview") or ""
            body = re.sub(r"<[^>]+>", " ", str(raw_body)).strip()[:280]
            msg_id = m.get("id", "")
            date_str = (m.get("createdDateTime") or "")[:10]
            msg_lines.append(
                f"[{i}] TEAMS id={msg_id} date={date_str}\n"
                f"  From: {sender}\n"
                f"  Content: {body}"
            )

    prompt = f"""You are JARVIS, AI assistant for {user_name}. Today: {today}.

Analyze these messages. Extract ONLY real action items (things that need follow-up or a decision).
Skip: newsletters, auto-notifications, FYI messages, congratulations, calendar invites.

MESSAGES:
{chr(10).join(msg_lines)}

For each action item, assign STATUS based on evidence in the message content:
- "todo"        — action is requested/needed, no sign it has started
- "in_progress" — signals work has started: "working on", "started", "in progress", "drafting"
- "done"        — action is complete: "sent", "completed", "attached", "done", "approved", "resolved", "finished"

Return ONLY a raw JSON array (no markdown, no code fences, no extra text):
[
  {{
    "title": "Verb-first task title (Review/Reply to/Follow up/Approve/Schedule...)",
    "status": "todo|in_progress|done",
    "priority": "urgent|high|normal|low",
    "due_date": "YYYY-MM-DD or null",
    "notes": "1-2 sentence context from the message",
    "source_index": <integer — index of the message from the list above>
  }}
]

If there are no action items, return exactly: []"""

    try:
        raw = _chat(prompt, max_tokens=1500)
        tasks = _clean_json(raw)
        if not isinstance(tasks, list):
            return []
    except Exception:
        return []

    enriched = []
    for t in tasks:
        idx = t.pop("source_index", None)
        try:
            idx_int = int(idx) if idx is not None else -1
        except (TypeError, ValueError):
            idx_int = -1
        src = messages[idx_int] if 0 <= idx_int < len(messages) else {}
        t["source_type"] = source_type
        t["source_id"] = src.get("id") if src else None
        t["source_link"] = (src.get("webLink") if source_type == "email" else src.get("webUrl")) if src else None
        # Clamp status to valid values
        if t.get("status") not in VALID_STATUSES:
            t["status"] = "todo"
        enriched.append(t)

    return enriched


def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event line."""
    return f"data: {json.dumps({'event': event, **data})}\n\n"


@router.get("/auto-extract")
async def auto_extract_tasks(
    sources: str = Query("both"),          # "email" | "teams" | "both"
    max_email_pages: int = Query(3),       # pages × 50 emails each
    max_chats: int = Query(20),
    days_back: int = Query(90),
):
    """
    SSE endpoint — streams progress events while extracting and saving tasks
    from historical email and Teams data. Deduplicates by source_id so re-runs
    only process new messages. Each batch makes exactly one LLM call.
    """
    async def generate():
        db = SessionLocal()
        try:
            user_name = os.environ.get("JARVIS_USER_DISPLAY_NAME", "User")
            today = date.today().isoformat()
            since = (date.today() - timedelta(days=days_back)).isoformat()

            # Load all existing source_ids once — O(1) lookup for deduplication
            existing_ids: set = {
                row[0]
                for row in db.query(Task.source_id).filter(Task.source_id.isnot(None)).all()
            }

            stats = {
                "emails_scanned": 0,
                "chats_scanned": 0,
                "tasks_created": 0,
                "tasks_skipped": 0,
                "status_counts": {"todo": 0, "in_progress": 0, "done": 0},
            }

            yield _sse("start", {"message": f"Starting deep scan — last {days_back} days of data…", "stats": stats})

            BATCH = 10  # messages per LLM call — sweet spot for context vs. token cost

            # ────── EMAILS ──────────────────────────────────────────────────
            if sources in ("email", "both"):
                yield _sse("stage", {"stage": "emails", "message": "Scanning email history…"})

                graph_headers = agent._graph_headers()
                next_link = None
                page = 0

                while page < max_email_pages:
                    if next_link:
                        import requests as _req
                        r = await asyncio.to_thread(
                            lambda: _req.get(next_link, headers=agent._graph_headers(), timeout=20)
                        )
                    else:
                        import requests as _req
                        params = {
                            "$top": 50,
                            "$orderby": "receivedDateTime desc",
                            "$select": "id,subject,from,receivedDateTime,isRead,importance,bodyPreview,webLink",
                            "$filter": f"receivedDateTime ge {since}T00:00:00Z",
                        }
                        r = await asyncio.to_thread(
                            lambda: _req.get(
                                f"{agent.GRAPH_API_BASE_URL}/me/mailFolders/inbox/messages",
                                headers=agent._graph_headers(), params=params, timeout=20,
                            )
                        )

                    if not r.ok:
                        yield _sse("error", {"message": f"Email fetch failed (HTTP {r.status_code}). Token may have expired."})
                        break

                    page_data = r.json()
                    emails_page = page_data.get("value", [])
                    next_link = page_data.get("@odata.nextLink")
                    stats["emails_scanned"] += len(emails_page)

                    # Filter out already-seen messages
                    new_emails = [e for e in emails_page if e.get("id") not in existing_ids]

                    yield _sse("progress", {
                        "stage": "emails", "page": page + 1,
                        "scanned": stats["emails_scanned"], "new": len(new_emails),
                        "tasks_created": stats["tasks_created"],
                    })

                    # Process in batches of BATCH
                    for batch_start in range(0, len(new_emails), BATCH):
                        batch = new_emails[batch_start: batch_start + BATCH]
                        if not batch:
                            continue

                        extracted = await asyncio.to_thread(
                            _extract_batch_with_status, batch, "email", user_name, today
                        )

                        batch_titles = []
                        for t in extracted:
                            src_id = t.get("source_id")
                            if src_id and src_id in existing_ids:
                                stats["tasks_skipped"] += 1
                                continue
                            task = Task(
                                id=str(uuid.uuid4()),
                                title=t.get("title", "Untitled task"),
                                status=t.get("status", "todo"),
                                priority=t.get("priority", "normal"),
                                source_type="email",
                                source_id=src_id,
                                source_link=t.get("source_link"),
                                due_date=t.get("due_date"),
                                notes=t.get("notes"),
                                created_at=datetime.now(timezone.utc),
                                updated_at=datetime.now(timezone.utc),
                            )
                            db.add(task)
                            if src_id:
                                existing_ids.add(src_id)
                            stats["tasks_created"] += 1
                            stats["status_counts"][t.get("status", "todo")] = \
                                stats["status_counts"].get(t.get("status", "todo"), 0) + 1
                            batch_titles.append(t.get("title", ""))

                        db.commit()

                        if batch_titles:
                            yield _sse("batch_done", {
                                "stage": "emails",
                                "tasks_in_batch": len(batch_titles),
                                "tasks_created": stats["tasks_created"],
                                "titles": batch_titles[:5],
                            })

                    page += 1
                    if not next_link:
                        break

            # ────── TEAMS ───────────────────────────────────────────────────
            if sources in ("teams", "both"):
                yield _sse("stage", {"stage": "teams", "message": "Scanning Teams chats…"})

                try:
                    chats = await asyncio.to_thread(agent.get_teams_chats, max_chats)
                except Exception as e:
                    yield _sse("error", {"message": f"Could not fetch Teams chats: {e}"})
                    chats = []

                for i, chat in enumerate(chats):
                    chat_id = chat.get("id", "")
                    chat_name = chat.get("topic") or f"Chat {i + 1}"
                    stats["chats_scanned"] += 1

                    yield _sse("progress", {
                        "stage": "teams", "chat": chat_name,
                        "chat_num": i + 1, "total_chats": len(chats),
                        "tasks_created": stats["tasks_created"],
                    })

                    try:
                        messages = await asyncio.to_thread(agent.get_teams_messages, chat_id, 50)
                    except Exception:
                        continue

                    # Skip system/event messages (null body, call records, member joins, etc.)
                    messages = [
                        m for m in messages
                        if m.get("messageType", "message") == "message"
                        and (m.get("body") or {}).get("content", "").strip()
                        and m.get("from") is not None
                    ]

                    # Filter already-seen
                    new_msgs = [m for m in messages if m.get("id") not in existing_ids]
                    if not new_msgs:
                        continue

                    # Teams: one LLM call per chat (all messages as context)
                    for batch_start in range(0, len(new_msgs), BATCH):
                        batch = new_msgs[batch_start: batch_start + BATCH]
                        extracted = await asyncio.to_thread(
                            _extract_batch_with_status, batch, "teams_chat", user_name, today
                        )

                        batch_titles = []
                        for t in extracted:
                            src_id = t.get("source_id")
                            if src_id and src_id in existing_ids:
                                stats["tasks_skipped"] += 1
                                continue
                            task = Task(
                                id=str(uuid.uuid4()),
                                title=t.get("title", "Untitled task"),
                                status=t.get("status", "todo"),
                                priority=t.get("priority", "normal"),
                                source_type="teams_chat",
                                source_id=src_id,
                                source_link=t.get("source_link"),
                                due_date=t.get("due_date"),
                                notes=t.get("notes"),
                                created_at=datetime.now(timezone.utc),
                                updated_at=datetime.now(timezone.utc),
                            )
                            db.add(task)
                            if src_id:
                                existing_ids.add(src_id)
                            stats["tasks_created"] += 1
                            stats["status_counts"][t.get("status", "todo")] = \
                                stats["status_counts"].get(t.get("status", "todo"), 0) + 1
                            batch_titles.append(t.get("title", ""))

                        db.commit()

                        if batch_titles:
                            yield _sse("batch_done", {
                                "stage": "teams", "chat": chat_name,
                                "tasks_in_batch": len(batch_titles),
                                "tasks_created": stats["tasks_created"],
                                "titles": batch_titles[:5],
                            })

            yield _sse("complete", {
                "stats": stats,
                "message": f"Analysis complete. {stats['tasks_created']} tasks created from "
                           f"{stats['emails_scanned']} emails and {stats['chats_scanned']} chats.",
            })

        except Exception as e:
            yield _sse("error", {"message": f"Fatal error: {e}"})
        finally:
            db.close()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )

