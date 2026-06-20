# JARVIS AI Executive Assistant — Claude Code Prompt File

## Overview

This file defines the complete Claude Code agent configuration for JARVIS, a private AI executive assistant integrated with Microsoft 365 via direct Microsoft Graph API calls (bearer token auth) and Power Automate webhooks for automated data logging.

---

## System Prompt

```
You are JARVIS, my private AI executive assistant for Microsoft 365.
You help me triage email, review Microsoft Teams messages, draft professional responses, and maintain a task list. You are concise, reliable, discreet, and action-oriented.

Core behavior:
- Read emails and Teams messages using available tools.
- Summarize urgent items, pending decisions, blockers, and follow-ups.
- Draft replies in my style: clear, warm, direct, and concise.
- Create and update tasks from messages and emails.
- Track task status as todo, in_progress, waiting, blocked, or done.
- Link tasks to the original source whenever possible.
- Never invent facts or claim an action was completed unless a tool confirms it.
- Never send, post, delete, or update externally without my explicit approval unless I have authorized that action type.

For every review:
- Summarize what matters.
- Recommend next actions.
- Draft replies where useful.
- Create or update tasks where appropriate.
- Flag overdue, blocked, and stale tasks.

Output sections:
SUMMARY
EMAILS
TEAMS
TASKS

If context is missing, ask a clarifying question or produce a clearly labeled draft for review.
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        JARVIS Agent                         │
│                   (Claude Code Runtime)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
  ┌───────────────┐ ┌─────────┐ ┌──────────────────┐
  │ Microsoft     │ │  Tasks  │ │  Power Automate  │
  │ Graph API     │ │  Store  │ │  Webhook (Log)   │
  │ (Bearer Token)│ │ (Local) │ │  (Option 2)      │
  └───────┬───────┘ └─────────┘ └──────────────────┘
          │
   ┌──────┴──────┐
   │             │
   ▼             ▼
 Email        Teams
 (Mail API)   (Chat API)
```

---

## Environment Configuration

Create a `.env` file in your project root with the following variables:

```env
# Microsoft Graph API — Bearer Token Auth (Option 4)
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
GRAPH_BEARER_TOKEN=your_bearer_token_here

# Power Automate Webhook — Automated Data Logging (Option 2)
POWER_AUTOMATE_WEBHOOK_URL=https://prod-XX.westus.logic.azure.com:443/workflows/YOUR_FLOW_ID/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YOUR_SIG

# Task Store
TASK_STORE_PATH=./jarvis_tasks.json

# Agent Identity
JARVIS_USER_EMAIL=your.email@yourdomain.com
JARVIS_USER_DISPLAY_NAME=Your Name
```

---

## Tool Definitions

The following tools are available to the JARVIS agent. Each tool maps to a direct Microsoft Graph API call using a bearer token.

---

### Tool 1: `get_emails`

**Purpose:** Fetch recent emails from the user's inbox.

**Graph API Endpoint:**
```
GET https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `top` | integer | 20 | Number of emails to retrieve |
| `filter` | string | null | OData filter string (e.g., `isRead eq false`) |
| `select` | string | see below | Comma-separated fields to return |
| `orderby` | string | `receivedDateTime desc` | Sort order |

**Default `select` fields:**
```
id,subject,from,toRecipients,receivedDateTime,isRead,importance,bodyPreview,hasAttachments,conversationId,webLink
```

**Implementation:**
```python
def get_emails(top=20, filter=None, select=None, orderby="receivedDateTime desc"):
    """
    Fetch emails from the Microsoft 365 inbox via Graph API.
    
    Args:
        top: Number of messages to return (max 999)
        filter: OData filter expression
        select: Comma-separated list of fields to return
        orderby: Sort field and direction
    
    Returns:
        List of email message objects
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    default_select = (
        "id,subject,from,toRecipients,receivedDateTime,"
        "isRead,importance,bodyPreview,hasAttachments,"
        "conversationId,webLink"
    )

    params = {
        "$top": top,
        "$orderby": orderby,
        "$select": select or default_select,
    }
    if filter:
        params["$filter"] = filter

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{base_url}/me/mailFolders/inbox/messages",
        headers=headers,
        params=params,
    )
    response.raise_for_status()
    return response.json().get("value", [])
```

**Example call:**
```python
# Get top 10 unread emails
emails = get_emails(top=10, filter="isRead eq false")
```

---

### Tool 2: `get_email_body`

**Purpose:** Fetch the full body of a specific email by ID.

**Graph API Endpoint:**
```
GET https://graph.microsoft.com/v1.0/me/messages/{message_id}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message_id` | string | Yes | The Graph message ID |

**Implementation:**
```python
def get_email_body(message_id: str):
    """
    Fetch the full body of a specific email message.
    
    Args:
        message_id: The Graph API message ID
    
    Returns:
        Full message object including body content
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{base_url}/me/messages/{message_id}",
        headers=headers,
        params={"$select": "id,subject,from,body,receivedDateTime,webLink"},
    )
    response.raise_for_status()
    return response.json()
```

---

### Tool 3: `draft_email_reply`

**Purpose:** Create a draft reply to an email. Does NOT send — returns draft for user approval.

**Graph API Endpoint:**
```
POST https://graph.microsoft.com/v1.0/me/messages/{message_id}/createReply
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message_id` | string | Yes | Original message ID to reply to |
| `body_content` | string | Yes | The reply body text |
| `body_type` | string | No | `"Text"` or `"HTML"` (default: `"Text"`) |

**Implementation:**
```python
def draft_email_reply(message_id: str, body_content: str, body_type: str = "Text"):
    """
    Create a draft reply to an email. Does NOT send automatically.
    User must explicitly approve sending via send_draft_email().
    
    Args:
        message_id: The original message ID
        body_content: The reply body text
        body_type: "Text" or "HTML"
    
    Returns:
        Draft message object with draft ID
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Step 1: Create the reply draft
    reply_response = requests.post(
        f"{base_url}/me/messages/{message_id}/createReply",
        headers=headers,
        json={},
    )
    reply_response.raise_for_status()
    draft = reply_response.json()
    draft_id = draft["id"]

    # Step 2: Update the draft body
    update_response = requests.patch(
        f"{base_url}/me/messages/{draft_id}",
        headers=headers,
        json={
            "body": {
                "contentType": body_type,
                "content": body_content,
            }
        },
    )
    update_response.raise_for_status()

    return {
        "draft_id": draft_id,
        "status": "draft_created",
        "message": "Draft created. Call send_draft_email(draft_id) to send after user approval.",
        "draft": update_response.json(),
    }
```

---

### Tool 4: `send_draft_email`

**Purpose:** Send a previously created draft email. Requires explicit user approval before calling.

**Graph API Endpoint:**
```
POST https://graph.microsoft.com/v1.0/me/messages/{draft_id}/send
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `draft_id` | string | Yes | The draft message ID to send |

**Implementation:**
```python
def send_draft_email(draft_id: str):
    """
    Send a previously created draft email.
    REQUIRES explicit user approval before calling.
    
    Args:
        draft_id: The draft message ID
    
    Returns:
        Confirmation object
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        f"{base_url}/me/messages/{draft_id}/send",
        headers=headers,
    )
    response.raise_for_status()

    return {
        "status": "sent",
        "draft_id": draft_id,
        "message": "Email sent successfully.",
    }
```

---

### Tool 5: `get_teams_messages`

**Purpose:** Fetch recent Microsoft Teams chat messages.

**Graph API Endpoint:**
```
GET https://graph.microsoft.com/v1.0/me/chats/{chat_id}/messages
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chat_id` | string | Yes | Teams chat ID |
| `top` | integer | No | Number of messages (default: 20) |

**Implementation:**
```python
def get_teams_messages(chat_id: str, top: int = 20):
    """
    Fetch recent messages from a Microsoft Teams chat.
    
    Args:
        chat_id: The Teams chat ID
        top: Number of messages to retrieve
    
    Returns:
        List of Teams message objects
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{base_url}/me/chats/{chat_id}/messages",
        headers=headers,
        params={"$top": top},
    )
    response.raise_for_status()
    return response.json().get("value", [])
```

---

### Tool 6: `get_teams_chats`

**Purpose:** List all Teams chats the user is a member of.

**Graph API Endpoint:**
```
GET https://graph.microsoft.com/v1.0/me/chats
```

**Implementation:**
```python
def get_teams_chats(top: int = 20):
    """
    List all Teams chats for the current user.
    
    Args:
        top: Number of chats to retrieve
    
    Returns:
        List of Teams chat objects
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{base_url}/me/chats",
        headers=headers,
        params={
            "$top": top,
            "$select": "id,topic,chatType,lastUpdatedDateTime,webUrl",
        },
    )
    response.raise_for_status()
    return response.json().get("value", [])
```

---

### Tool 7: `get_teams_channel_messages`

**Purpose:** Fetch messages from a Teams channel (not a chat).

**Graph API Endpoint:**
```
GET https://graph.microsoft.com/v1.0/teams/{team_id}/channels/{channel_id}/messages
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `team_id` | string | Yes | The Teams team ID |
| `channel_id` | string | Yes | The Teams channel ID |
| `top` | integer | No | Number of messages (default: 20) |

**Implementation:**
```python
def get_teams_channel_messages(team_id: str, channel_id: str, top: int = 20):
    """
    Fetch messages from a Teams channel.
    
    Args:
        team_id: The Teams team ID
        channel_id: The Teams channel ID
        top: Number of messages to retrieve
    
    Returns:
        List of Teams channel message objects
    """
    import os
    import requests

    token = os.environ["GRAPH_BEARER_TOKEN"]
    base_url = os.environ["GRAPH_API_BASE_URL"]

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    response = requests.get(
        f"{base_url}/teams/{team_id}/channels/{channel_id}/messages",
        headers=headers,
        params={"$top": top},
    )
    response.raise_for_status()
    return response.json().get("value", [])
```

---

### Tool 8: `create_task`

**Purpose:** Create a new task in the local JARVIS task store.

**Implementation:**
```python
def create_task(
    title: str,
    status: str = "todo",
    priority: str = "normal",
    source_type: str = None,
    source_id: str = None,
    source_link: str = None,
    due_date: str = None,
    notes: str = None,
):
    """
    Create a new task in the JARVIS task store.
    
    Args:
        title: Task title/description
        status: todo | in_progress | waiting | blocked | done
        priority: low | normal | high | urgent
        source_type: email | teams_chat | teams_channel | manual
        source_id: ID of the source message/email
        source_link: Web link to the source item
        due_date: ISO 8601 date string (e.g., "2025-01-15")
        notes: Additional context or notes
    
    Returns:
        Created task object with generated ID
    """
    import os
    import json
    import uuid
    from datetime import datetime, timezone

    task_store_path = os.environ.get("TASK_STORE_PATH", "./jarvis_tasks.json")

    # Load existing tasks
    try:
        with open(task_store_path, "r") as f:
            store = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        store = {"tasks": []}

    # Create new task
    task = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": status,
        "priority": priority,
        "source_type": source_type,
        "source_id": source_id,
        "source_link": source_link,
        "due_date": due_date,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    store["tasks"].append(task)

    # Save updated store
    with open(task_store_path, "w") as f:
        json.dump(store, f, indent=2)

    # Log to Power Automate webhook
    _log_to_power_automate("task_created", task)

    return task
```

---

### Tool 9: `update_task`

**Purpose:** Update an existing task's status, priority, or notes.

**Implementation:**
```python
def update_task(
    task_id: str,
    status: str = None,
    priority: str = None,
    due_date: str = None,
    notes: str = None,
    title: str = None,
):
    """
    Update an existing task in the JARVIS task store.
    
    Args:
        task_id: The task UUID to update
        status: New status (todo | in_progress | waiting | blocked | done)
        priority: New priority (low | normal | high | urgent)
        due_date: New due date (ISO 8601)
        notes: Updated notes
        title: Updated title
    
    Returns:
        Updated task object
    """
    import os
    import json
    from datetime import datetime, timezone

    task_store_path = os.environ.get("TASK_STORE_PATH", "./jarvis_tasks.json")

    with open(task_store_path, "r") as f:
        store = json.load(f)

    task = next((t for t in store["tasks"] if t["id"] == task_id), None)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    # Apply updates
    if status is not None:
        task["status"] = status
    if priority is not None:
        task["priority"] = priority
    if due_date is not None:
        task["due_date"] = due_date
    if notes is not None:
        task["notes"] = notes
    if title is not None:
        task["title"] = title

    task["updated_at"] = datetime.now(timezone.utc).isoformat()

    with open(task_store_path, "w") as f:
        json.dump(store, f, indent=2)

    # Log to Power Automate webhook
    _log_to_power_automate("task_updated", task)

    return task
```

---

### Tool 10: `get_tasks`

**Purpose:** Retrieve tasks from the local task store with optional filtering.

**Implementation:**
```python
def get_tasks(
    status: str = None,
    priority: str = None,
    source_type: str = None,
):
    """
    Retrieve tasks from the JARVIS task store.
    
    Args:
        status: Filter by status (todo | in_progress | waiting | blocked | done)
        priority: Filter by priority (low | normal | high | urgent)
        source_type: Filter by source type
    
    Returns:
        List of matching task objects
    """
    import os
    import json

    task_store_path = os.environ.get("TASK_STORE_PATH", "./jarvis_tasks.json")

    try:
        with open(task_store_path, "r") as f:
            store = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

    tasks = store.get("tasks", [])

    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    if priority:
        tasks = [t for t in tasks if t.get("priority") == priority]
    if source_type:
        tasks = [t for t in tasks if t.get("source_type") == source_type]

    return tasks
```

---

### Tool 11: `log_to_power_automate` (Internal Helper)

**Purpose:** Send structured event data to Power Automate webhook for automated logging. Used internally by task tools.

**Implementation:**
```python
def _log_to_power_automate(event_type: str, payload: dict):
    """
    Send event data to Power Automate webhook for automated logging.
    This is an internal helper called by task creation/update tools.
    
    Args:
        event_type: Type of event (task_created, task_updated, session_summary, etc.)
        payload: Event data to log
    
    Returns:
        None (logs silently, does not raise on failure)
    """
    import os
    import requests
    from datetime import datetime, timezone

    webhook_url = os.environ.get("POWER_AUTOMATE_WEBHOOK_URL")
    if not webhook_url:
        return  # Webhook not configured, skip silently

    try:
        body = {
            "event_type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "agent": "JARVIS",
            "data": payload,
        }
        requests.post(webhook_url, json=body, timeout=10)
    except Exception:
        pass  # Never let webhook logging break the main flow
```

---

### Tool 12: `log_session_summary`

**Purpose:** Send a session summary to Power Automate for logging and record-keeping.

**Implementation:**
```python
def log_session_summary(
    emails_reviewed: int,
    teams_messages_reviewed: int,
    tasks_created: int,
    tasks_updated: int,
    drafts_created: int,
    key_items: list,
):
    """
    Log a session summary to Power Automate webhook.
    
    Args:
        emails_reviewed: Count of emails reviewed
        teams_messages_reviewed: Count of Teams messages reviewed
        tasks_created: Count of new tasks created
        tasks_updated: Count of tasks updated
        drafts_created: Count of email drafts created
        key_items: List of key action items or decisions
    
    Returns:
        Confirmation dict
    """
    payload = {
        "emails_reviewed": emails_reviewed,
        "teams_messages_reviewed": teams_messages_reviewed,
        "tasks_created": tasks_created,
        "tasks_updated": tasks_updated,
        "drafts_created": drafts_created,
        "key_items": key_items,
    }
    _log_to_power_automate("session_summary", payload)
    return {"status": "logged", "payload": payload}
```

---

## Complete Agent Implementation

```python
# jarvis_agent.py
"""
JARVIS AI Executive Assistant
Microsoft 365 Integration via Graph API (Bearer Token)
Power Automate Webhook Logging
"""

import os
import json
import uuid
import requests
from datetime import datetime, timezone
from typing import Optional, List


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

GRAPH_API_BASE_URL = os.environ.get("GRAPH_API_BASE_URL", "https://graph.microsoft.com/v1.0")
GRAPH_BEARER_TOKEN = os.environ.get("GRAPH_BEARER_TOKEN", "")
POWER_AUTOMATE_WEBHOOK_URL = os.environ.get("POWER_AUTOMATE_WEBHOOK_URL", "")
TASK_STORE_PATH = os.environ.get("TASK_STORE_PATH", "./jarvis_tasks.json")


def _graph_headers() -> dict:
    """Return standard Graph API request headers."""
    return {
        "Authorization": f"Bearer {GRAPH_BEARER_TOKEN}",
        "Content-Type": "application/json",
    }


# ─────────────────────────────────────────────
# Power Automate Webhook (Option 2)
# ─────────────────────────────────────────────

def _log_to_power_automate(event_type: str, payload: dict) -> None:
    """Send event data to Power Automate webhook for automated logging."""
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


# ─────────────────────────────────────────────
# Email Tools — Graph API (Option 4)
# ─────────────────────────────────────────────

def get_emails(
    top: int = 20,
    filter: Optional[str] = None,
    select: Optional[str] = None,
    orderby: str = "receivedDateTime desc",
) -> List[dict]:
    """Fetch emails from the Microsoft 365 inbox."""
    default_select = (
        "id,subject,from,toRecipients,receivedDateTime,"
        "isRead,importance,bodyPreview,hasAttachments,"
        "conversationId,webLink"
    )
    params = {
        "$top": top,
        "$orderby": orderby,
        "$select": select or default_select,
    }
    if filter:
        params["$filter"] = filter

    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/mailFolders/inbox/messages",
        headers=_graph_headers(),
        params=params,
    )
    response.raise_for_status()
    return response.json().get("value", [])


def get_email_body(message_id: str) -> dict:
    """Fetch the full body of a specific email message."""
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/messages/{message_id}",
        headers=_graph_headers(),
        params={"$select": "id,subject,from,body,receivedDateTime,webLink"},
    )
    response.raise_for_status()
    return response.json()


def draft_email_reply(
    message_id: str,
    body_content: str,
    body_type: str = "Text",
) -> dict:
    """
    Create a draft reply to an email.
    Does NOT send — returns draft for user approval.
    """
    # Create reply draft
    reply_response = requests.post(
        f"{GRAPH_API_BASE_URL}/me/messages/{message_id}/createReply",
        headers=_graph_headers(),
        json={},
    )
    reply_response.raise_for_status()
    draft_id = reply_response.json()["id"]

    # Update draft body
    update_response = requests.patch(
        f"{GRAPH_API_BASE_URL}/me/messages/{draft_id}",
        headers=_graph_headers(),
        json={"body": {"contentType": body_type, "content": body_content}},
    )
    update_response.raise_for_status()

    return {
        "draft_id": draft_id,
        "status": "draft_created",
        "message": "Draft created. Call send_draft_email(draft_id) after user approval.",
        "draft": update_response.json(),
    }


def send_draft_email(draft_id: str) -> dict:
    """
    Send a previously created draft email.
    REQUIRES explicit user approval before calling.
    """
    response = requests.post(
        f"{GRAPH_API_BASE_URL}/me/messages/{draft_id}/send",
        headers=_graph_headers(),
    )
    response.raise_for_status()
    return {"status": "sent", "draft_id": draft_id}


# ─────────────────────────────────────────────
# Teams Tools — Graph API (Option 4)
# ─────────────────────────────────────────────

def get_teams_chats(top: int = 20) -> List[dict]:
    """List all Teams chats for the current user."""
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/chats",
        headers=_graph_headers(),
        params={
            "$top": top,
            "$select": "id,topic,chatType,lastUpdatedDateTime,webUrl",
        },
    )
    response.raise_for_status()
    return response.json().get("value", [])


def get_teams_messages(chat_id: str, top: int = 20) -> List[dict]:
    """Fetch recent messages from a Microsoft Teams chat."""
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/me/chats/{chat_id}/messages",
        headers=_graph_headers(),
        params={"$top": top},
    )
    response.raise_for_status()
    return response.json().get("value", [])


def get_teams_channel_messages(
    team_id: str,
    channel_id: str,
    top: int = 20,
) -> List[dict]:
    """Fetch messages from a Teams channel."""
    response = requests.get(
        f"{GRAPH_API_BASE_URL}/teams/{team_id}/channels/{channel_id}/messages",
        headers=_graph_headers(),
        params={"$top": top},
    )
    response.raise_for_status()
    return response.json().get("value", [])


# ─────────────────────────────────────────────
# Task Store Tools
# ─────────────────────────────────────────────

def _load_task_store() -> dict:
    """Load the task store from disk."""
    try:
        with open(TASK_STORE_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"tasks": []}


def _save_task_store(store: dict) -> None:
    """Save the task store to disk."""
    with open(TASK_STORE_PATH, "w") as f:
        json.dump(store, f, indent=2)


def create_task(
    title: str,
    status: str = "todo",
    priority: str = "normal",
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    source_link: Optional[str] = None,
    due_date: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """Create a new task in the JARVIS task store."""
    store = _load_task_store()

    task = {
        "id": str(uuid.uuid4()),
        "title": title,
        "status": status,
        "priority": priority,
        "source_type": source_type,
        "source_id": source_id,
        "source_link": source_link,
        "due_date": due_date,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    store["tasks"].append(task)
    _save_task_store(store)
    _log_to_power_automate("task_created", task)

    return task


def update_task(
    task_id: str,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    due_date: Optional[str] = None,
    notes: Optional[str] = None,
    title: Optional[str] = None,
) -> dict:
    """Update an existing task in the JARVIS task store."""
    store = _load_task_store()

    task = next((t for t in store["tasks"] if t["id"] == task_id), None)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    if status is not None:
        task["status"] = status
    if priority is not None:
        task["priority"] = priority
    if due_date is not None:
        task["due_date"] = due_date
    if notes is not None:
        task["notes"] = notes
    if title is not None:
        task["title"] = title

    task["updated_at"] = datetime.now(timezone.utc).isoformat()

    _save_task_store(store)
    _log_to_power_automate("task_updated", task)

    return task


def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    source_type: Optional[str] = None,
) -> List[dict]:
    """Retrieve tasks from the JARVIS task store with optional filtering."""
    store = _load_task_store()
    tasks = store.get("tasks", [])

    if status:
        tasks = [t for t in tasks if t.get("status") == status]
    if priority:
        tasks = [t for t in tasks if t.get("priority") == priority]
    if source_type:
        tasks = [t for t in tasks if t.get("source_type") == source_type]

    return tasks


def log_session_summary(
    emails_reviewed: int,
    teams_messages_reviewed: int,
    tasks_created: int,
    tasks_updated: int,
    drafts_created: int,
    key_items: List[str],
) -> dict:
    """Log a session summary to Power Automate webhook."""
    payload = {
        "emails_reviewed": emails_reviewed,
        "teams_messages_reviewed": teams_messages_reviewed,
        "tasks_created": tasks_created,
        "tasks_updated": tasks_updated,
        "drafts_created": drafts_created,
        "key_items": key_items,
    }
    _log_to_power_automate("session_summary", payload)
    return {"status": "logged", "payload": payload}
```

---

## Claude Code Tool Schema (JSON)

This is the tool schema to register with Claude Code:

```json
{
  "tools": [
    {
      "name": "get_emails",
      "description": "Fetch recent emails from the Microsoft 365 inbox via Graph API. Use this to read and triage incoming email.",
      "input_schema": {
        "type": "object",
        "properties": {
          "top": {
            "type": "integer",
            "description": "Number of emails to retrieve. Default 20, max 999.",
            "default": 20
          },
          "filter": {
            "type": "string",
            "description": "OData filter string. Example: 'isRead eq false' for unread only."
          },
          "select": {
            "type": "string",
            "description": "Comma-separated fields to return. Leave blank for defaults."
          },
          "orderby": {
            "type": "string",
            "description": "Sort field and direction.",
            "default": "receivedDateTime desc"
          }
        }
      }
    },
    {
      "name": "get_email_body",
      "description": "Fetch the full body of a specific email by its Graph message ID.",
      "input_schema": {
        "type": "object",
        "properties": {
          "message_id": {
            "type": "string",
            "description": "The Graph API message ID."
          }
        },
        "required": ["message_id"]
      }
    },
    {
      "name": "draft_email_reply",
      "description": "Create a draft reply to an email. Does NOT send. Returns draft for user approval. Always use this before send_draft_email.",
      "input_schema": {
        "type": "object",
        "properties": {
          "message_id": {
            "type": "string",
            "description": "The original message ID to reply to."
          },
          "body_content": {
            "type": "string",
            "description": "The reply body text."
          },
          "body_type": {
            "type": "string",
            "description": "Text or HTML.",
            "default": "Text"
          }
        },
        "required": ["message_id", "body_content"]
      }
    },
    {
      "name": "send_draft_email",
      "description": "Send a previously created draft email. ONLY call this after explicit user approval.",
      "input_schema": {
        "type": "object",
        "properties": {
          "draft_id": {
            "type": "string",
            "description": "The draft message ID to send."
          }
        },
        "required": ["draft_id"]
      }
    },
    {
      "name": "get_teams_chats",
      "description": "List all Microsoft Teams chats the user is a member of.",
      "input_schema": {
        "type": "object",
        "properties": {
          "top": {
            "type": "integer",
            "description": "Number of chats to retrieve.",
            "default": 20
          }
        }
      }
    },
    {
      "name": "get_teams_messages",
      "description": "Fetch recent messages from a specific Microsoft Teams chat.",
      "input_schema": {
        "type": "object",
        "properties": {
          "chat_id": {
            "type": "string",
            "description": "The Teams chat ID."
          },
          "top": {
            "type": "integer",
            "description": "Number of messages to retrieve.",
            "default": 20
          }
        },
        "required": ["chat_id"]
      }
    },
    {
      "name": "get_teams_channel_messages",
      "description": "Fetch messages from a Microsoft Teams channel.",
      "input_schema": {
        "type": "object",
        "properties": {
          "team_id": {
            "type": "string",
            "description": "The Teams team ID."
          },
          "channel_id": {
            "type": "string",
            "description": "The Teams channel ID."
          },
          "top": {
            "type": "integer",
            "description": "Number of messages to retrieve.",
            "default": 20
          }
        },
        "required": ["team_id", "channel_id"]
      }
    },
    {
      "name": "create_task",
      "description": "Create a new task in the JARVIS task store. Link to source email or Teams message when possible.",
      "input_schema": {
        "type": "object",
        "properties": {
          "title": {
            "type": "string",
            "description": "Task title or description."
          },
          "status": {
            "type": "string",
            "description": "todo | in_progress | waiting | blocked | done",
            "default": "todo"
          },
          "priority": {
            "type": "string",
            "description": "low | normal | high | urgent",
            "default": "normal"
          },
          "source_type": {
            "type": "string",
            "description": "email | teams_chat | teams_channel | manual"
          },
          "source_id": {
            "type": "string",
            "description": "ID of the source message or email."
          },
          "source_link": {
            "type": "string",
            "description": "Web link to the source item."
          },
          "due_date": {
            "type": "string",
            "description": "ISO 8601 date string, e.g. 2025-01-15."
          },
          "notes": {
            "type": "string",
            "description": "Additional context or notes."
          }
        },
        "required": ["title"]
      }
    },
    {
      "name": "update_task",
      "description": "Update an existing task's status, priority, due date, or notes.",
      "input_schema": {
        "type": "object",
        "properties": {
          "task_id": {
            "type": "string",
            "description": "The task UUID to update."
          },
          "status": {
            "type": "string",
            "description": "New status: todo | in_progress | waiting | blocked | done"
          },
          "priority": {
            "type": "string",
            "description": "New priority: low | normal | high | urgent"
          },
          "due_date": {
            "type": "string",
            "description": "New due date (ISO 8601)."
          },
          "notes": {
            "type": "string",
            "description": "Updated notes."
          },
          "title": {
            "type": "string",
            "description": "Updated title."
          }
        },
        "required": ["task_id"]
      }
    },
    {
      "name": "get_tasks",
      "description": "Retrieve tasks from the JARVIS task store with optional filtering by status, priority, or source.",
      "input_schema": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "description": "Filter by status: todo | in_progress | waiting | blocked | done"
          },
          "priority": {
            "type": "string",
            "description": "Filter by priority: low | normal | high | urgent"
          },
          "source_type": {
            "type": "string",
            "description": "Filter by source: email | teams_chat | teams_channel | manual"
          }
        }
      }
    },
    {
      "name": "log_session_summary",
      "description": "Log a session summary to Power Automate for record-keeping. Call at the end of each review session.",
      "input_schema": {
        "type": "object",
        "properties": {
          "emails_reviewed": {
            "type": "integer",
            "description": "Count of emails reviewed."
          },
          "teams_messages_reviewed": {
            "type": "integer",
            "description": "Count of Teams messages reviewed."
          },
          "tasks_created": {
            "type": "integer",
            "description": "Count of new tasks created."
          },
          "tasks_updated": {
            "type": "integer",
            "description": "Count of tasks updated."
          },
          "drafts_created": {
            "type": "integer",
            "description": "Count of email drafts created."
          },
          "key_items": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of key action items or decisions from the session."
          }
        },
        "required": [
          "emails_reviewed",
          "teams_messages_reviewed",
          "tasks_created",
          "tasks_updated",
          "drafts_created",
          "key_items"
        ]
      }
    }
  ]
}
```

---

## Power Automate Flow Setup (Option 2)

### Flow: JARVIS Event Logger

**Trigger:** HTTP Request (When an HTTP request is received)

**Steps:**

1. **Trigger:** HTTP POST webhook
   - Method: POST
   - Schema:
   ```json
   {
     "type": "object",
     "properties": {
       "event_type": {"type": "string"},
       "timestamp": {"type": "string"},
       "agent": {"type": "string"},
       "data": {"type": "object"}
     }
   }
   ```

2. **Condition:** Switch on `event_type`
   - `task_created` → Append row to SharePoint list "JARVIS Tasks"
   - `task_updated` → Update row in SharePoint list "JARVIS Tasks"
   - `session_summary` → Append row to SharePoint list "JARVIS Sessions"
   - Default → Log to SharePoint list "JARVIS Events"

3. **SharePoint List: JARVIS Tasks**
   | Column | Type | Maps To |
   |--------|------|---------|
   | Title | Single line | `data.title` |
   | TaskID | Single line | `data.id` |
   | Status | Choice | `data.status` |
   | Priority | Choice | `data.priority` |
   | SourceType | Choice | `data.source_type` |
   | SourceLink | Hyperlink | `data.source_link` |
   | DueDate | Date | `data.due_date` |
   | Notes | Multi-line | `data.notes` |
   | CreatedAt | Date/Time | `data.created_at` |
   | UpdatedAt | Date/Time | `data.updated_at` |

4. **SharePoint List: JARVIS Sessions**
   | Column | Type | Maps To |
   |--------|------|---------|
   | Title | Single line | `timestamp` |
   | EmailsReviewed | Number | `data.emails_reviewed` |
   | TeamsReviewed | Number | `data.teams_messages_reviewed` |
   | TasksCreated | Number | `data.tasks_created` |
   | TasksUpdated | Number | `data.tasks_updated` |
   | DraftsCreated | Number | `data.drafts_created` |
   | KeyItems | Multi-line | `data.key_items` (joined) |

---

## Microsoft Graph API Permissions Required

The bearer token must have the following delegated permissions:

| Permission | Scope | Purpose |
|------------|-------|---------|
| `Mail.Read` | Delegated | Read emails |
| `Mail.ReadWrite` | Delegated | Create draft replies |
| `Mail.Send` | Delegated | Send draft emails |
| `Chat.Read` | Delegated | Read Teams chats |
| `ChannelMessage.Read.All` | Delegated | Read Teams channel messages |
| `User.Read` | Delegated | Read user profile |

### Getting a Bearer Token (Development)

```bash
# Using Azure CLI
az login
az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv

# Store in environment
export GRAPH_BEARER_TOKEN=$(az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv)
```

### Getting a Bearer Token (Production — Device Code Flow)

```python
# token_helper.py
import msal
import os

CLIENT_ID = os.environ["AZURE_CLIENT_ID"]
TENANT_ID = os.environ["AZURE_TENANT_ID"]
SCOPES = [
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Chat.Read",
    "ChannelMessage.Read.All",
    "User.Read",
]

app = msal.PublicClientApplication(
    CLIENT_ID,
    authority=f"https://login.microsoftonline.com/{TENANT_ID}",
)

flow = app.initiate_device_flow(scopes=SCOPES)
print(flow["message"])  # Prints: Go to https://microsoft.com/devicelogin and enter code XXXXXXXX

result = app.acquire_token_by_device_flow(flow)
token = result["access_token"]
print(f"Token acquired. Set GRAPH_BEARER_TOKEN={token}")
```

---

## Agent Behavior Rules

### Safety Rules (Hard Constraints)

```
1. NEVER send an email without explicit user approval.
2. NEVER post a Teams message without explicit user approval.
3. NEVER delete any email, message, or task without explicit user approval.
4. NEVER claim an action was completed unless a tool call confirmed it.
5. NEVER invent email content, sender names, or message details.
6. ALWAYS present drafts for review before sending.
7. ALWAYS label speculative content as [DRAFT] or [PROPOSED].
```

### Approval Flow

```
User: "Reply to Sarah's email about the budget"
JARVIS:
  1. get_emails() → find Sarah's email
  2. get_email_body(message_id) → read full content
  3. draft_email_reply(message_id, body_content) → create draft
  4. Present draft to user: "Here is the proposed reply. Reply 'send it' to confirm."
  5. [Wait for user approval]
  6. User: "send it"
  7. send_draft_email(draft_id) → send
  8. Confirm: "Email sent to Sarah."
```

### Task Lifecycle

```
todo → in_progress → waiting → done
                  ↘ blocked → in_progress
```

### Output Format

Every session review must produce output in this exact structure:

```
─────────────────────────────────────────
JARVIS BRIEFING — [DATE TIME]
─────────────────────────────────────────

SUMMARY
[2-4 sentence overview of what matters most right now]

─────────────────────────────────────────
EMAILS ([N] reviewed, [N] unread)
─────────────────────────────────────────

[1] [URGENT/NORMAL/LOW] — [Subject] — from [Sender] — [Time]
    [2-3 sentence summary]
    → Recommended action: [action]
    → Draft reply: [yes/no — if yes, show draft below]

[DRAFT REPLY — Email 1]
---
[Draft text]
---
Approve? (yes / edit / skip)

─────────────────────────────────────────
TEAMS ([N] chats reviewed)
─────────────────────────────────────────

[Chat/Channel Name]
[Summary of key messages and any action items]
→ Recommended action: [action]

─────────────────────────────────────────
TASKS
─────────────────────────────────────────

URGENT / OVERDUE
  • [task title] — [status] — due [date] — [source link]

IN PROGRESS
  • [task title] — [status] — due [date]

WAITING / BLOCKED
  • [task title] — [status] — waiting on [person/thing]

NEW THIS SESSION
  • [task title] — created from [source]

─────────────────────────────────────────
END OF BRIEFING
─────────────────────────────────────────
```

---

## Project File Structure

```
jarvis/
├── .env                          # Environment variables (never commit)
├── .env.example                  # Template for .env
├── jarvis_agent.py               # Main agent implementation
├── jarvis_tasks.json             # Local task store (auto-created)
├── token_helper.py               # Bearer token acquisition helper
├── JARVIS_Claude_Code_Prompt.md  # This file
├── requirements.txt              # Python dependencies
└── README.md                     # Setup and usage guide
```

---

## requirements.txt

```
anthropic>=0.25.0
requests>=2.31.0
msal>=1.28.0
python-dotenv>=1.0.0
```

---

## .env.example

```env
# Microsoft Graph API
GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
GRAPH_BEARER_TOKEN=your_bearer_token_here

# Azure App Registration (for token_helper.py)
AZURE_CLIENT_ID=your_azure_app_client_id
AZURE_TENANT_ID=your_azure_tenant_id

# Power Automate Webhook
POWER_AUTOMATE_WEBHOOK_URL=https://prod-XX.westus.logic.azure.com:443/workflows/YOUR_FLOW_ID/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YOUR_SIG

# Task Store
TASK_STORE_PATH=./jarvis_tasks.json

# User Identity
JARVIS_USER_EMAIL=your.email@yourdomain.com
JARVIS_USER_DISPLAY_NAME=Your Name
```

---

## Quick Start

```bash
# 1. Clone or create project directory
mkdir jarvis && cd jarvis

# 2. Install dependencies
pip install anthropic requests msal python-dotenv

# 3. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your values

# 4. Acquire a bearer token
python token_helper.py
# Follow device code flow, copy token to .env

# 5. Run JARVIS
python jarvis_agent.py

# Or invoke via Claude Code with this prompt file loaded
```

---

## Example Prompts

```
"JARVIS, give me my morning briefing."

"JARVIS, show me all unread emails from the last 24 hours."

"JARVIS, draft a reply to the email from Marcus about the Q3 report."

"JARVIS, what tasks are blocked or overdue?"

"JARVIS, mark task [id] as done."

"JARVIS, create a task to follow up with the legal team about the contract, due Friday, high priority."

"JARVIS, review my Teams messages from the #engineering channel."

"JARVIS, send the draft reply to Sarah."
```

---

*JARVIS — Microsoft 365 AI Executive Assistant*
*Graph API (Option 4) + Power Automate Webhook (Option 2)*
*Claude Code Agent Configuration*