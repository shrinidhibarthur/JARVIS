"""
JARVIS Auth Manager — Microsoft Graph API via MSAL device code flow.

First-time use:
  1. Call start_device_flow() → get user_code + verification_uri
  2. User visits verification_uri and enters user_code
  3. Poll poll_device_flow() until {"status": "success"}

Subsequent starts:
  Access tokens are auto-refreshed from the cached refresh token (valid 90 days).
  No user action needed until the refresh token expires.

Falls back gracefully to GRAPH_BEARER_TOKEN env var if MSAL has no cached token.
"""

import os
import threading
from pathlib import Path
from dotenv import load_dotenv

# Reload .env so AZURE_* vars are available
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

try:
    import msal
    _MSAL_AVAILABLE = True
except ImportError:
    _MSAL_AVAILABLE = False

# ── Config ────────────────────────────────────────────────────────────────
# Graph Explorer's client ID — a well-known public client registered by Microsoft.
# Works with delegated permissions (user context) via device code flow.
CLIENT_ID  = os.environ.get("AZURE_CLIENT_ID",  "14d82eec-204b-4c2f-b7e8-296a70dab67e")
TENANT_ID  = os.environ.get("AZURE_TENANT_ID",  "b7f604a0-00a9-4188-9248-42f3a5aac2e9")
CACHE_PATH = Path(os.environ.get("MSAL_CACHE_PATH",
                                  str(Path(__file__).parent / ".msal_cache.json")))

# Delegated scopes — extend this list if new Graph endpoints are added.
# Do NOT include 'offline_access', 'openid', or 'profile' — MSAL adds these automatically.
SCOPES = [
    "User.Read",
    "Mail.Read",
    "Mail.ReadWrite",
    "Mail.Send",
    "Chat.Read",
    "Chat.ReadWrite",
    "Chat.ReadBasic",
]

# ── Internal state ────────────────────────────────────────────────────────
_app: "msal.PublicClientApplication | None" = None
_flow: "dict | None" = None          # active device code flow object
_lock = threading.Lock()             # protects _app + _flow during init


def _load_cache() -> "msal.SerializableTokenCache":
    cache = msal.SerializableTokenCache()
    if CACHE_PATH.exists():
        cache.deserialize(CACHE_PATH.read_text())
    return cache


def _save_cache(cache: "msal.SerializableTokenCache") -> None:
    if cache.has_state_changed:
        CACHE_PATH.write_text(cache.serialize())


def _get_app() -> "msal.PublicClientApplication":
    global _app
    if _app is None:
        with _lock:
            if _app is None:
                cache = _load_cache()
                _app = msal.PublicClientApplication(
                    CLIENT_ID,
                    authority=f"https://login.microsoftonline.com/{TENANT_ID}",
                    token_cache=cache,
                )
    return _app


# ── Public API ────────────────────────────────────────────────────────────

def get_token() -> "str | None":
    """
    Return a valid Bearer token.
    Priority: MSAL silent refresh → GRAPH_BEARER_TOKEN env var → None.
    """
    if _MSAL_AVAILABLE:
        try:
            app = _get_app()
            accounts = app.get_accounts()
            if accounts:
                result = app.acquire_token_silent(SCOPES, account=accounts[0])
                if result and "access_token" in result:
                    _save_cache(app.token_cache)
                    return result["access_token"]
        except Exception:
            pass  # fall through to env var

    # Fallback: manual token from .env
    load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)
    return os.environ.get("GRAPH_BEARER_TOKEN") or None


def has_cached_token() -> bool:
    """True if MSAL has a cached account (token can be silently refreshed)."""
    if not _MSAL_AVAILABLE:
        return False
    try:
        return bool(_get_app().get_accounts())
    except Exception:
        return False


def start_device_flow() -> dict:
    """
    Initiate device code flow.
    Returns: {user_code, verification_uri, expires_in, message}
    """
    if not _MSAL_AVAILABLE:
        raise RuntimeError("msal package is not installed. Run: pip install msal")
    global _flow
    app = _get_app()
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "error" in flow:
        raise RuntimeError(f"Device flow init failed: {flow.get('error_description', flow['error'])}")
    with _lock:
        _flow = flow
    return {
        "user_code":         flow["user_code"],
        "verification_uri":  flow["verification_uri"],
        "expires_in":        flow.get("expires_in", 900),
        "message":           flow.get("message", ""),
    }


def poll_device_flow() -> dict:
    """
    Poll for device code completion (call every 5s after start_device_flow).
    Returns: {status: "pending" | "success" | "error", detail?: str}
    """
    global _flow
    if not _MSAL_AVAILABLE:
        return {"status": "error", "detail": "msal not installed"}
    with _lock:
        flow = _flow
    if not flow:
        return {"status": "error", "detail": "No active device flow. Call start first."}

    app = _get_app()
    # MSAL's acquire_token_by_device_flow polls internally; timeout=0 → one immediate check
    result = app.acquire_token_by_device_flow(flow, timeout=0)  # type: ignore[arg-type]

    if result and "access_token" in result:
        _save_cache(app.token_cache)
        with _lock:
            _flow = None
        return {"status": "success"}

    err = (result or {}).get("error", "")
    if err in ("authorization_pending", "slow_down"):
        return {"status": "pending"}

    return {"status": "error", "detail": (result or {}).get("error_description", err)}


def auth_status() -> dict:
    """Return a summary of current auth state for the UI."""
    cached = has_cached_token()
    env_token = bool(os.environ.get("GRAPH_BEARER_TOKEN"))
    token = get_token()
    return {
        "msal_available":   _MSAL_AVAILABLE,
        "msal_cached":      cached,
        "env_token_set":    env_token,
        "authenticated":    token is not None,
        "auth_method":      "msal" if cached else ("env" if env_token else "none"),
    }
