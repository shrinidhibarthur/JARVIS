import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import auth_manager

router = APIRouter()


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.get("/status")
def get_auth_status():
    """Return current authentication state."""
    return auth_manager.auth_status()


@router.post("/device-flow/start")
def start_device_flow():
    """
    Initiate MSAL device code flow.
    Returns user_code and verification_uri for the user to authenticate.
    """
    try:
        return auth_manager.start_device_flow()
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/device-flow/poll")
async def poll_device_flow_sse():
    """
    SSE stream that polls MSAL every 5 seconds until the device flow completes
    (success, error, or timeout after 10 minutes).
    """
    async def generate():
        for _ in range(120):  # max 10 minutes (120 × 5s)
            await asyncio.sleep(5)
            result = await asyncio.to_thread(auth_manager.poll_device_flow)
            yield _sse(result)
            if result["status"] in ("success", "error"):
                break

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
