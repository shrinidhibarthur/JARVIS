"use client";
import { useEffect, useState } from "react";
import { getEmails, getEmailBody, getGoals, createTask, extractTasks } from "@/lib/api";
import type { Email } from "@/lib/types";
import DraftPanel from "@/components/DraftPanel";
import TaskSuggestionPanel from "@/components/TaskSuggestionPanel";

const PRIORITY_BADGE: Record<string, string> = {
  high: "badge-high", urgent: "badge-urgent", normal: "badge-normal", low: "badge-low",
};

function formatDate(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SkeletonRow() {
  return (
    <div className="list-row" style={{ cursor: "default" }}>
      <div className="skeleton" style={{ height: "0.75rem", width: "70%", marginBottom: "0.4rem" }} />
      <div className="skeleton" style={{ height: "0.65rem", width: "40%" }} />
    </div>
  );
}

export default function EmailPage() {
  const [emails, setEmails]                 = useState<Email[]>([]);
  const [loading, setLoading]               = useState(true);
  const [unreadOnly, setUnreadOnly]         = useState(false);
  const [selected, setSelected]             = useState<any | null>(null);
  const [bodyLoading, setBodyLoading]       = useState(false);
  const [draft, setDraft]                   = useState<{ type: "reply" | "new"; messageId?: string; thread?: any[] } | null>(null);
  const [goals, setGoals]                   = useState<any[]>([]);
  const [taskCreated, setTaskCreated]       = useState<string | null>(null);
  const [suggestedTasks, setSuggestedTasks] = useState<any[] | null>(null);
  const [extracting, setExtracting]         = useState(false);

  useEffect(() => { getGoals().then(setGoals).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    getEmails(30, unreadOnly).then(setEmails).catch(() => {}).finally(() => setLoading(false));
  }, [unreadOnly]);

  async function openEmail(email: Email) {
    setBodyLoading(true);
    setSelected(email);
    setTaskCreated(null);
    setSuggestedTasks(null);
    try {
      const body = await getEmailBody(email.id);
      setSelected(body);
    } finally { setBodyLoading(false); }
  }

  async function handleExtractTasks() {
    if (!selected) return;
    setExtracting(true);
    setSuggestedTasks(null);
    try {
      const results = await extractTasks({ messages: [selected], source_type: "email", goals });
      setSuggestedTasks(results);
    } catch (e: any) { alert("Task extraction failed: " + e.message); }
    finally { setExtracting(false); }
  }

  async function saveAsTask() {
    if (!selected) return;
    const priority = selected.importance === "high" ? "high" : selected.importance === "urgent" ? "urgent" : "normal";
    await createTask({
      title: `Follow up: ${selected.subject || "(no subject)"}`,
      status: "todo", priority, source_type: "email",
      source_id: selected.id, source_link: selected.webLink ?? undefined,
      notes: selected.from?.emailAddress?.name
        ? `From: ${selected.from.emailAddress.name} <${selected.from.emailAddress.address}>`
        : undefined,
    });
    setTaskCreated(selected.id);
  }

  const unreadCount = emails.filter((e) => !e.isRead).length;

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Email</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : `${emails.length} messages${unreadCount > 0 ? ` · ${unreadCount} unread` : ""}`}
          </p>
        </div>
        <div className="page-actions">
          <label className="toggle-label">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Unread only
          </label>
          <button onClick={() => setDraft({ type: "new" })} className="btn-primary">+ Compose</button>
        </div>
      </div>

      {/* Split panel */}
      <div className={`split-panel${selected ? " has-selected" : ""}`}>

        {/* ── Email list ─────────────────────────────────── */}
        <div className="split-list">
          <div className="split-list-header">
            <p className="section-label" style={{ margin: 0 }}>
              {unreadOnly ? "Unread" : "Recent"} — {loading ? "…" : emails.length}
            </p>
          </div>

          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : emails.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">✉</div>
              <div className="empty-state-text">No emails found</div>
            </div>
          ) : (
            emails.map((email) => (
              <button
                key={email.id}
                onClick={() => openEmail(email)}
                className={`list-row${!email.isRead ? " unread" : ""}${selected?.id === email.id ? " active" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="list-row-title">{email.subject || "(no subject)"}</p>
                    <div className="list-row-meta">
                      {!email.isRead && <span className="unread-dot" />}
                      <span>{email.from?.emailAddress?.name ?? email.from?.emailAddress?.address}</span>
                    </div>
                    <p className="list-row-preview">{email.bodyPreview}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span style={{ fontSize: "0.68rem", color: "var(--j-text-4)", whiteSpace: "nowrap" }}>
                      {formatDate(email.receivedDateTime)}
                    </span>
                    {email.importance !== "normal" && (
                      <span className={PRIORITY_BADGE[email.importance] ?? "badge-normal"}>
                        {email.importance}
                      </span>
                    )}
                    {email.hasAttachments && (
                      <span style={{ fontSize: "0.65rem", color: "var(--j-text-4)" }}>📎</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* ── Email detail ───────────────────────────────── */}
        <div className="split-detail">
          {selected ? (
            <>
              {/* Detail header */}
              <div className="split-detail-header">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--j-text-1)" }}>
                      {selected.subject}
                    </h2>
                    <p className="text-xs mt-1" style={{ color: "var(--j-text-3)" }}>
                      From: <span style={{ color: "var(--j-text-2)" }}>{selected.from?.emailAddress?.name}</span>
                      {" "}&lt;{selected.from?.emailAddress?.address}&gt;
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--j-text-4)" }}>
                      {formatDate(selected.receivedDateTime)}
                    </p>
                  </div>
                  {selected.importance !== "normal" && (
                    <span className={PRIORITY_BADGE[selected.importance] ?? "badge-normal"}>
                      {selected.importance}
                    </span>
                  )}
                </div>
              </div>

              {/* Action strip */}
              <div className="action-strip">
                <button
                  onClick={() => setDraft({ type: "reply", messageId: selected.id, thread: [selected] })}
                  className="btn-primary"
                >
                  ✦ AI Reply
                </button>
                <button onClick={handleExtractTasks} disabled={extracting} className="btn-primary">
                  {extracting ? <><span className="animate-spin inline-block mr-1">⟳</span>Extracting…</> : "✦ Extract Tasks"}
                </button>
                <button
                  onClick={saveAsTask}
                  disabled={taskCreated === selected.id}
                  className="btn-ghost"
                  style={{ color: taskCreated === selected.id ? "var(--j-success-text)" : undefined }}
                >
                  {taskCreated === selected.id ? "✓ Task saved" : "+ Quick Task"}
                </button>
                {selected.webLink && (
                  <a href={selected.webLink} target="_blank" rel="noreferrer" className="btn-ghost">
                    Outlook ↗
                  </a>
                )}
              </div>

              {/* Task suggestions */}
              {suggestedTasks !== null && (
                <div className="split-detail-body" style={{ paddingBottom: 0, flex: "none" }}>
                  <TaskSuggestionPanel
                    tasks={suggestedTasks}
                    onClose={() => setSuggestedTasks(null)}
                  />
                </div>
              )}

              {/* Body */}
              <div className="split-detail-body">
                {bodyLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="skeleton" style={{ height: "0.8rem", width: `${90 - i * 10}%` }} />
                    ))}
                  </div>
                ) : selected.body ? (
                  <div
                    className="prose prose-invert max-w-none text-sm leading-relaxed"
                    style={{ color: "var(--j-text-2)" }}
                    dangerouslySetInnerHTML={{
                      __html: selected.body.contentType === "html"
                        ? selected.body.content
                        : `<pre style="white-space:pre-wrap;font-family:inherit">${selected.body.content}</pre>`,
                    }}
                  />
                ) : (
                  <p style={{ color: "var(--j-text-2)", fontSize: "0.875rem", lineHeight: 1.6 }}>
                    {selected.bodyPreview}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <span style={{ fontSize: "2.5rem", opacity: 0.15 }}>✉</span>
              <p style={{ fontSize: "0.8125rem", color: "var(--j-text-4)" }}>Select an email to read</p>
            </div>
          )}
        </div>
      </div>

      {draft && (
        <DraftPanel
          contextType={draft.type === "reply" ? "email_reply" : "new_email"}
          messageId={draft.messageId}
          thread={draft.thread}
          goalsContext={goals}
          onClose={() => setDraft(null)}
          onSent={() => setDraft(null)}
        />
      )}
    </div>
  );
}
