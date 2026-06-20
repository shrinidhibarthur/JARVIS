"""
JARVIS AI Executive Assistant
Microsoft 365 Integration via Graph API (Bearer Token)
Power Automate Webhook Logging
"""

import os
import json
import requests
from datetime import datetime, timezone
from typing import Optional

GRAPH_API_BASE_URL = os.environ.get("GRAPH_API_BASE_URL", "https://graph.microsoft.com/v1.0")
POWER_AUTOMATE_WEBHOOK_URL = os.environ.get("POWER_AUTOMATE_WEBHOOK_URL", "")


def _graph_headers() -> dict:
    # Try MSAL auto-refresh first; fall back to manual GRAPH_BEARER_TOKEN in .env
    try:
        import auth_manager
        token = auth_manager.get_token()
    except Exception:
        token = None

    if not token:
        # Legacy fallback: reload .env so pasting a new token takes effect immediately
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
        token = os.environ.get("GRAPH_BEARER_TOKEN", "")

    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _log_to_power_automate(event_type: str, payload: dict) -> None:
    if not POWER_AUTOMATE_WEBHOOK_URL:
        return
    try:
        body = {
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent": "JARVIS",
            "data": payload,
        }
        requests.post(POWER_AUTOMATE_WEBHOOK_URL, json=body, timeout=10)
    except Exception:
        pass


# ── Email ──────────────────────────────────────────────────────────────────

def get_emails(top: int = 20, filter: Optional[str] = None,
               select: Optional[str] = None,
               orderby: str = "receivedDateTime desc") -> list:
    default_select = (
        "id,subject,from,toRecipients,receivedDateTime,"
        "isRead,importance,bodyPreview,hasAttachments,conversationId,webLink"
    )
    params = {"$top": top, "$orderby": orderby, "$select": select or default_select}
    if filter:
        params["$filter"] = filter

    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/mailFolders/inbox/messages",
        headers=_graph_headers(), params=params,
    )
    response.raise_for_status()
    return response.json().get("value", [])


def get_email_body(message_id: str) -> dict:
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/messages/{message_id}",
        headers=_graph_headers(),
        params={"$select": "id,subject,from,body,receivedDateTime,webLink"},
    )
    response.raise_for_status()
    return response.json()


def draft_email_reply(message_id: str, body_content: str, body_type: str = "Text") -> dict:
    reply_response = requests.post(
        f"{GRAPH_API_BASE_URL}/me/messages/{message_id}/createReply",
        headers=_graph_headers(), json={},
    )
    reply_response.raise_for_status()
    draft_id = reply_response.json()["id"]

    update_response = requests.patch(
        f"{GRAPH_API_BASE_URL}/me/messages/{draft_id}",
        headers=_graph_headers(),
        json={"body": {"contentType": body_type, "content": body_content}},
    )
    update_response.raise_for_status()
    return {
        "draft_id": draft_id,
        "status": "draft_created",
        "draft": update_response.json(),
    }


def send_draft_email(draft_id: str) -> dict:
    response = requests.post(
        f"{GRAPH_API_BASE_URL}/me/messages/{draft_id}/send",
        headers=_graph_headers(),
    )
    response.raise_for_status()
    _log_to_power_automate("email_sent", {"draft_id": draft_id})
    return {"status": "sent", "draft_id": draft_id}


def create_new_email(to: list, subject: str, body_content: str, body_type: str = "Text") -> dict:
    """Create a new draft email (does not send)."""
    payload = {
        "subject": subject,
        "body": {"contentType": body_type, "content": body_content},
        "toRecipients": [{"emailAddress": {"address": addr}} for addr in to],
    }
    response = requests.post(
        f"{GRAPH_API_BASE_URL}/me/messages",
        headers=_graph_headers(), json=payload,
    )
    response.raise_for_status()
    return {"draft_id": response.json()["id"], "status": "draft_created"}


# ── Teams ──────────────────────────────────────────────────────────────────

def _get_me() -> dict:
    """Fetch the current user's id, displayName, and mail from /me (cached per process)."""
    if not hasattr(_get_me, "_cache"):
        try:
            r = requests.get(
                f"{GRAPH_API_BASE_URL}/me",
                headers=_graph_headers(),
                params={"$select": "id,displayName,mail,userPrincipalName"},
                timeout=6,
            )
            if r.ok:
                d = r.json()
                _get_me._cache = {
                    "id": d.get("id", ""),
                    "displayName": d.get("displayName", ""),
                    "email": (d.get("mail") or d.get("userPrincipalName", "")).lower(),
                }
            else:
                _get_me._cache = {}
        except Exception:
            _get_me._cache = {}
    return _get_me._cache


def get_teams_chats(top: int = 20) -> list:
    """Fetch chats and resolve real participant names for untitled 1:1 / group chats."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    headers = _graph_headers()
    me = _get_me()
    my_id    = me.get("id", "")
    my_email = me.get("email", "")
    my_name  = me.get("displayName", "").lower()

    # Fetch chat list (expand lastMessagePreview for last message snippet)
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/chats",
        headers=headers,
        params={
            "$top": top,
            "$select": "id,topic,chatType,lastUpdatedDateTime,webUrl",
            "$expand": "lastMessagePreview",
        },
    )
    response.raise_for_status()
    chats = response.json().get("value", [])

    # Identify chats that need name resolution
    untitled = [c for c in chats if not (c.get("topic") or "").strip()]
    if not untitled:
        return chats

    def _fetch_topic(chat: dict) -> tuple[str, str]:
        """Return (chat_id, resolved_topic)."""
        try:
            r = requests.get(
                f"{GRAPH_API_BASE_URL}/me/chats/{chat['id']}/members",
                headers=headers,
                timeout=5,
            )
            if r.ok:
                other_names = []
                for m in r.json().get("value", []):
                    uid   = m.get("userId", "")
                    email = (m.get("email") or "").lower()
                    dn    = m.get("displayName", "").strip()
                    if (my_id and uid == my_id) or \
                       (my_email and email == my_email) or \
                       (my_name and dn.lower() == my_name):
                        continue
                    if dn:
                        other_names.append(dn)
                if other_names:
                    return chat["id"], ", ".join(other_names[:3])
        except Exception:
            pass
        raw = chat.get("chatType", "")
        fallback = "Direct Chat" if raw == "oneOnOne" else "Group Chat" if raw == "group" else raw.capitalize() or "Chat"
        return chat["id"], fallback

    # Resolve in parallel (cap workers to avoid flooding Graph API)
    with ThreadPoolExecutor(max_workers=min(len(untitled), 5)) as pool:
        futures = {pool.submit(_fetch_topic, c): c["id"] for c in untitled}
        resolved = {f.result()[0]: f.result()[1] for f in as_completed(futures)}

    # Apply resolved topics back
    for chat in chats:
        if chat["id"] in resolved:
            chat["topic"] = resolved[chat["id"]]

    return chats


def get_teams_messages(chat_id: str, top: int = 20) -> list:
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/chats/{chat_id}/messages",
        headers=_graph_headers(), params={"$top": top},
    )
    response.raise_for_status()
    return response.json().get("value", [])


def get_teams_channel_messages(team_id: str, channel_id: str, top: int = 20) -> list:
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/teams/{team_id}/channels/{channel_id}/messages",
        headers=_graph_headers(), params={"$top": top},
    )
    response.raise_for_status()
    return response.json().get("value", [])
