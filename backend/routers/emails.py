from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import jarvis_agent as agent

router = APIRouter()


class DraftReplyRequest(BaseModel):
    body_content: str
    body_type: str = "Text"


class SendDraftRequest(BaseModel):
    draft_id: str


class NewEmailRequest(BaseModel):
    to: list[str]
    subject: str
    body_content: str
    body_type: str = "Text"


@router.get("")
def list_emails(
    top: int = Query(20),
    unread_only: bool = Query(False),
):
    try:
        filter_str = "isRead eq false" if unread_only else None
        return agent.get_emails(top=top, filter=filter_str)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/{message_id}/body")
def get_email_body(message_id: str):
    try:
        return agent.get_email_body(message_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/{message_id}/draft-reply")
def draft_reply(message_id: str, req: DraftReplyRequest):
    try:
        return agent.draft_email_reply(message_id, req.body_content, req.body_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/send-draft")
def send_draft(req: SendDraftRequest):
    try:
        return agent.send_draft_email(req.draft_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/compose")
def compose_email(req: NewEmailRequest):
    try:
        return agent.create_new_email(req.to, req.subject, req.body_content, req.body_type)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
