"use client";
import { useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage = "idle" | "running" | "done" | "error";

interface Stats {
  emails_scanned: number;
  chats_scanned: number;
  tasks_created: number;
  tasks_skipped: number;
  status_counts: { todo: number; in_progress: number; done: number };
}

interface LogEntry {
  type: "stage" | "progress" | "batch" | "error" | "info";
  text: string;
  ts: string;
}

const EMPTY_STATS: Stats = {
  emails_scanned: 0, chats_scanned: 0,
  tasks_created: 0, tasks_skipped: 0,
  status_counts: { todo: 0, in_progress: 0, done: 0 },
};

function now() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AutoExtractModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [sources, setSources]       = useState<"both" | "email" | "teams">("both");
  const [daysBack, setDaysBack]     = useState(90);
  const [emailPages, setEmailPages] = useState(3);
  const [stage, setStage]           = useState<Stage>("idle");
  const [stageLabel, setStageLabel] = useState("");
  const [stats, setStats]           = useState<Stats>(EMPTY_STATS);
  const [log, setLog]               = useState<LogEntry[]>([]);
  const [elapsed, setElapsed]       = useState(0);
  const readerRef                   = useRef<ReadableStreamDefaultReader | null>(null);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef                   = useRef<HTMLDivElement>(null);

  function addLog(entry: LogEntry) {
    setLog((prev) => [...prev.slice(-49), entry]); // keep last 50
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function startAnalysis() {
    setStage("running");
    setStats(EMPTY_STATS);
    setLog([]);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

    const params = new URLSearchParams({
      sources,
      days_back: String(daysBack),
      max_email_pages: String(emailPages),
      max_chats: "25",
    });

    try {
      const res = await fetch(`http://localhost:8001/api/review/auto-extract?${params}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // last may be incomplete

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          switch (evt.event) {
            case "start":
              addLog({ type: "info", text: evt.message, ts: now() });
              break;

            case "stage":
              setStageLabel(evt.message);
              addLog({ type: "stage", text: `▶ ${evt.message}`, ts: now() });
              break;

            case "progress":
              if (evt.stage === "emails") {
                addLog({
                  type: "progress",
                  text: `Page ${evt.page}: ${evt.scanned} emails scanned, ${evt.new} new`,
                  ts: now(),
                });
              } else {
                addLog({
                  type: "progress",
                  text: `Teams (${evt.chat_num}/${evt.total_chats}): ${evt.chat}`,
                  ts: now(),
                });
              }
              setStats((prev) => ({ ...prev, emails_scanned: evt.scanned ?? prev.emails_scanned }));
              break;

            case "batch_done":
              if (evt.tasks_in_batch > 0) {
                addLog({
                  type: "batch",
                  text: `+${evt.tasks_in_batch} task${evt.tasks_in_batch !== 1 ? "s" : ""} — ${(evt.titles as string[]).join(" · ")}`,
                  ts: now(),
                });
              }
              setStats((prev) => ({ ...prev, tasks_created: evt.tasks_created ?? prev.tasks_created }));
              break;

            case "complete":
              if (timerRef.current) clearInterval(timerRef.current);
              setStats(evt.stats ?? EMPTY_STATS);
              setStageLabel("Analysis complete");
              setStage("done");
              addLog({ type: "info", text: `✓ ${evt.message}`, ts: now() });
              break;

            case "error":
              addLog({ type: "error", text: `✗ ${evt.message}`, ts: now() });
              if (evt.message?.includes("Fatal")) {
                if (timerRef.current) clearInterval(timerRef.current);
                setStage("error");
              }
              break;
          }
        }
      }
    } catch (e: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      addLog({ type: "error", text: `Connection error: ${e.message}`, ts: now() });
      setStage("error");
    }
  }

  function stopAnalysis() {
    readerRef.current?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("idle");
    setStageLabel("");
    addLog({ type: "info", text: "Analysis stopped by user.", ts: now() });
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  const isRunning = stage === "running";

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-backdrop"
        style={{ background: "rgba(0,0,0,0.7)" }}
        onClick={() => !isRunning && onClose()}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "var(--j-surface)",
            border: "1px solid var(--j-border-2)",
            borderRadius: "16px",
            boxShadow: "var(--j-shadow-lg)",
            width: "100%",
            maxWidth: "680px",
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            pointerEvents: "auto",
            animation: "slideUpFade 0.2s ease both",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1.1rem 1.3rem", borderBottom: "1px solid var(--j-border)",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span className="badge-ai">✦ AI</span>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--j-text-1)" }}>
                Deep Task Extraction
              </span>
            </div>
            <button className="drawer-close" onClick={() => !isRunning && onClose()}>×</button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* Config — only when idle */}
            {stage === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <p style={{ fontSize: "0.82rem", color: "var(--j-text-2)", lineHeight: 1.6 }}>
                  Scans all historical emails and Teams chats in batches, extracts genuine action items,
                  and automatically classifies each task as <strong style={{ color: "var(--j-text-1)" }}>Yet to start</strong>,{" "}
                  <strong style={{ color: "#22d3ee" }}>In progress</strong>, or{" "}
                  <strong style={{ color: "#22c55e" }}>Completed</strong> — skipping anything already imported.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="field-label">Data sources</label>
                    <select className="j-select" value={sources} onChange={(e) => setSources(e.target.value as any)}>
                      <option value="both">Email + Teams</option>
                      <option value="email">Email only</option>
                      <option value="teams">Teams only</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">History depth</label>
                    <select className="j-select" value={daysBack} onChange={(e) => setDaysBack(Number(e.target.value))}>
                      <option value={30}>Last 30 days</option>
                      <option value={60}>Last 60 days</option>
                      <option value={90}>Last 90 days</option>
                      <option value={180}>Last 6 months</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Email pages</label>
                    <select className="j-select" value={emailPages} onChange={(e) => setEmailPages(Number(e.target.value))}>
                      <option value={1}>1 page (50 emails)</option>
                      <option value={2}>2 pages (100 emails)</option>
                      <option value={3}>3 pages (150 emails)</option>
                      <option value={5}>5 pages (250 emails)</option>
                    </select>
                  </div>
                </div>

                <div style={{
                  padding: "0.7rem 0.9rem",
                  background: "var(--j-accent-subtle)",
                  borderRadius: "8px",
                  border: "1px solid color-mix(in srgb, var(--j-accent) 20%, transparent)",
                  fontSize: "0.77rem",
                  color: "var(--j-text-3)",
                  lineHeight: 1.5,
                }}>
                  ⓘ Each batch of 10 messages = 1 LLM call. With Gemma 3:12b (~15s/call), expect{" "}
                  <strong style={{ color: "var(--j-text-2)" }}>{Math.ceil(emailPages * 50 / 10) * 15}–{Math.ceil(emailPages * 50 / 10) * 40}s</strong> for emails.
                  Re-running skips already-imported messages automatically.
                </div>
              </div>
            )}

            {/* Stats bar — shown during/after run */}
            {stage !== "idle" && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "0.5rem",
              }}>
                {[
                  { label: "Scanned", value: stats.emails_scanned, color: "var(--j-text-1)" },
                  { label: "Created", value: stats.tasks_created, color: "var(--j-accent-text)" },
                  { label: "Yet to start", value: stats.status_counts.todo, color: "var(--j-text-2)" },
                  { label: "In progress", value: stats.status_counts.in_progress, color: "#22d3ee" },
                  { label: "Completed", value: stats.status_counts.done, color: "#22c55e" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: "var(--j-surface-2)",
                    border: "1px solid var(--j-border)",
                    borderRadius: "10px",
                    padding: "0.55rem 0.6rem",
                    textAlign: "center",
                  }}>
                    <p style={{ fontSize: "1.3rem", fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: "0.65rem", color: "var(--j-text-4)", marginTop: "0.2rem" }}>{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Stage label + elapsed */}
            {stage !== "idle" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {isRunning && <span style={{ fontSize: "1rem", display: "inline-block", animation: "spin 1.1s linear infinite" }}>⟳</span>}
                {stage === "done" && <span style={{ color: "#22c55e" }}>✓</span>}
                {stage === "error" && <span style={{ color: "var(--j-urgent-dot)" }}>✗</span>}
                <span style={{ fontSize: "0.82rem", color: "var(--j-text-2)", flex: 1 }}>{stageLabel || "Running…"}</span>
                <span style={{ fontSize: "0.75rem", color: "var(--j-text-4)", fontVariantNumeric: "tabular-nums" }}>
                  {formatElapsed(elapsed)}
                </span>
              </div>
            )}

            {/* Activity log */}
            {log.length > 0 && (
              <div style={{
                flex: 1,
                minHeight: "160px",
                maxHeight: "280px",
                overflowY: "auto",
                background: "var(--j-surface-2)",
                border: "1px solid var(--j-border)",
                borderRadius: "10px",
                padding: "0.6rem 0.75rem",
                fontFamily: "var(--font-mono, ui-monospace, monospace)",
                fontSize: "0.72rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.22rem",
              }}>
                {log.map((entry, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.6rem", lineHeight: 1.5 }}>
                    <span style={{ color: "var(--j-text-4)", flexShrink: 0 }}>{entry.ts}</span>
                    <span style={{
                      color: entry.type === "error" ? "var(--j-urgent-dot)"
                           : entry.type === "batch" ? "var(--j-accent-text)"
                           : entry.type === "stage" ? "var(--j-text-1)"
                           : "var(--j-text-3)",
                      wordBreak: "break-word",
                    }}>
                      {entry.text}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: "0.9rem 1.3rem",
            borderTop: "1px solid var(--j-border)",
            display: "flex",
            gap: "0.6rem",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}>
            {stage === "idle" && (
              <>
                <button className="btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={startAnalysis}>
                  ✦ Start Analysis
                </button>
              </>
            )}
            {isRunning && (
              <button className="btn-ghost" onClick={stopAnalysis} style={{ color: "var(--j-urgent-dot)" }}>
                Stop
              </button>
            )}
            {(stage === "done" || stage === "error") && (
              <>
                <button className="btn-ghost" onClick={onClose}>Close</button>
                {stage === "done" && stats.tasks_created > 0 && (
                  <button className="btn-primary" onClick={() => { onDone(); onClose(); }}>
                    View {stats.tasks_created} Tasks →
                  </button>
                )}
                <button className="btn-ghost" onClick={() => { setStage("idle"); setLog([]); setStats(EMPTY_STATS); setElapsed(0); }}>
                  Run Again
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
