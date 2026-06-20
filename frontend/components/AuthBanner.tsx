"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type AuthState = {
  authenticated: boolean;
  auth_method: string;
  msal_available: boolean;
  msal_cached: boolean;
  env_token_set: boolean;
};

type FlowState = "idle" | "starting" | "waiting" | "success" | "error";

const BACKEND = "http://localhost:8001";

export default function AuthBanner() {
  const [auth, setAuth]           = useState<AuthState | null>(null);
  const [flow, setFlow]           = useState<FlowState>("idle");
  const [userCode, setUserCode]   = useState("");
  const [verifyUri, setVerifyUri] = useState("");
  const [error, setError]         = useState("");
  const [copied, setCopied]       = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const readerRef                 = useRef<ReadableStreamDefaultReader | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/auth/status`);
      if (res.ok) setAuth(await res.json());
    } catch { /* backend not up yet */ }
  }, []);

  useEffect(() => {
    checkStatus();
    // Re-check every 5 minutes in case token auto-refreshed
    const t = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [checkStatus]);

  async function startDeviceFlow() {
    setFlow("starting");
    setError("");
    try {
      const res = await fetch(`${BACKEND}/api/auth/device-flow/start`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUserCode(data.user_code);
      setVerifyUri(data.verification_uri);
      setFlow("waiting");
      beginPolling();
    } catch (e: any) {
      setError(e.message ?? "Failed to start sign-in");
      setFlow("error");
    }
  }

  function beginPolling() {
    fetch(`${BACKEND}/api/auth/device-flow/poll`)
      .then(async (res) => {
        if (!res.body) throw new Error("No SSE body");
        const reader = res.body.getReader();
        readerRef.current = reader;
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.status === "success") {
                setFlow("success");
                setDismissed(false);
                checkStatus();
                return;
              }
              if (evt.status === "error") {
                setError(evt.detail ?? "Authentication failed");
                setFlow("error");
                return;
              }
              // "pending" → keep polling
            } catch { /* ignore parse errors */ }
          }
        }
      })
      .catch((e) => { setError(e.message); setFlow("error"); });
  }

  async function copyCode() {
    try { await navigator.clipboard.writeText(userCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  }

  // Don't render until we know the status
  if (!auth) return null;

  if (auth.authenticated && auth.auth_method === "msal") return null;

  // Authenticated via env var = show a subtle info badge (not blocking)
  if (auth.authenticated && auth.auth_method === "env" && dismissed) return null;

  // ── Success flash ───────────────────────────────────────────────────────
  if (flow === "success") {
    return (
      <div style={bannerStyle("#0f3323", "#22c55e", "#166534")}>
        <span>✓ Signed in to Microsoft Graph. Tokens will auto-refresh — no more manual token copies!</span>
        <button style={closeBtn} onClick={() => setDismissed(true)}>×</button>
      </div>
    );
  }

  // ── Not authenticated ───────────────────────────────────────────────────
  if (!auth.authenticated) {
    return (
      <div style={bannerStyle("#1a0f05", "#f59e0b", "#92400e")}>
        {flow === "idle" && (
          <>
            <span style={{ fontSize: "0.8rem", color: "#fde68a" }}>
              ⚠ Microsoft Graph API not authenticated — emails, Teams and calendar data unavailable.
            </span>
            <button style={actionBtn("#f59e0b")} onClick={startDeviceFlow}>
              Sign in with Microsoft →
            </button>
          </>
        )}
        {flow === "starting" && <span style={{ fontSize: "0.8rem", color: "#fde68a" }}>Starting sign-in…</span>}
        {flow === "waiting" && (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8rem", color: "#fde68a" }}>
              Open{" "}
              <a href={verifyUri} target="_blank" rel="noreferrer" style={{ color: "#fbbf24", textDecoration: "underline" }}>
                {verifyUri}
              </a>{" "}
              and enter this code:
            </span>
            <button onClick={copyCode} style={codeBtn}>
              {userCode} {copied ? "✓" : "⎘"}
            </button>
            <span style={{ fontSize: "0.75rem", color: "#d97706" }}>Waiting for sign-in…</span>
          </div>
        )}
        {flow === "error" && (
          <>
            <span style={{ fontSize: "0.8rem", color: "#fca5a5" }}>✗ {error}</span>
            <button style={actionBtn("#f59e0b")} onClick={() => { setFlow("idle"); setError(""); }}>Retry</button>
          </>
        )}
      </div>
    );
  }

  // ── Authenticated via env var only (manual token) ───────────────────────
  return (
    <div style={bannerStyle("#0a0f1a", "#6b7280", "#374151")}>
      <span style={{ fontSize: "0.75rem", color: "var(--j-text-4)" }}>
        Using manual Graph API token (expires ~75 min).{" "}
        {auth.msal_available
          ? "Sign in once to auto-refresh forever:"
          : "Install msal (pip install msal) to enable auto-refresh."}
      </span>
      {auth.msal_available && flow === "idle" && (
        <button style={actionBtn("var(--j-accent-text)")} onClick={startDeviceFlow}>
          Sign in with Microsoft
        </button>
      )}
      {flow === "waiting" && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <a href={verifyUri} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", color: "var(--j-accent-text)" }}>
            {verifyUri} →
          </a>
          <button onClick={copyCode} style={codeBtn}>{userCode} {copied ? "✓" : "⎘"}</button>
          <span style={{ fontSize: "0.7rem", color: "var(--j-text-4)" }}>Waiting…</span>
        </div>
      )}
      {flow === "error" && (
        <span style={{ fontSize: "0.75rem", color: "var(--j-urgent-dot)" }}>✗ {error}</span>
      )}
      <button style={closeBtn} onClick={() => setDismissed(true)}>×</button>
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────
function bannerStyle(bg: string, border: string, borderFull: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.45rem 1rem",
    background: bg,
    borderBottom: `1px solid ${borderFull}`,
    flexShrink: 0,
    flexWrap: "wrap",
    minHeight: "38px",
  };
}

function actionBtn(color: string): React.CSSProperties {
  return {
    fontSize: "0.75rem",
    padding: "0.25rem 0.7rem",
    borderRadius: "6px",
    border: `1px solid ${color}`,
    background: "transparent",
    color,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

const codeBtn: React.CSSProperties = {
  fontSize: "0.8rem",
  fontFamily: "ui-monospace, monospace",
  fontWeight: 700,
  padding: "0.2rem 0.7rem",
  borderRadius: "6px",
  border: "1px solid #d97706",
  background: "#1c1005",
  color: "#fbbf24",
  cursor: "pointer",
  letterSpacing: "0.1em",
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "inherit",
  opacity: 0.6,
  fontSize: "1rem",
  flexShrink: 0,
  padding: "0 0.25rem",
};
