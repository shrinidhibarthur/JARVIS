from fastapi import APIRouter, HTTPException, Query
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import jarvis_agent as agent

router = APIRouter()


@router.get("/chats")
def list_chats(top: int = Query(20)):
    try:
        return agent.get_teams_chats(top=top)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/chats/{chat_id}/messages")
def get_chat_messages(chat_id: str, top: int = Query(20)):
    try:
        return agent.get_teams_messages(chat_id=chat_id, top=top)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/{team_id}/channels/{channel_id}/messages")
def get_channel_messages(team_id: str, channel_id: str, top: int = Query(20)):
    try:
        return agent.get_teams_channel_messages(
            team_id=team_id, channel_id=channel_id, top=top
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
