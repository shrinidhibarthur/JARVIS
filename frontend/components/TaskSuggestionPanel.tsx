"use client";
import { useState } from "react";
import { createTask } from "@/lib/api";

interface SuggestedTask {
  title: string;
  priority: "urgent" | "high" | "normal" | "low";
  due_date: string | null;
  notes: string;
  source_id?: string;
  source_link?: string;
  source_type?: string;
  linked_goal_id?: number | null;
}

interface Props {
  tasks: SuggestedTask[];
  onClose: () => void;
  onSaved?: () => void;
}

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "badge-urgent", high: "badge-high", normal: "badge-normal", low: "badge-low",
};

export default function TaskSuggestionPanel({ tasks: initial, onClose, onSaved }: Props) {
  const [tasks, setTasks]         = useState<(SuggestedTask & { dismissed?: boolean; saved?: boolean })[]>(initial);
  const [savingAll, setSavingAll] = useState(false);
  const [editIdx, setEditIdx]     = useState<number | null>(null);

  function updateTask(i: number, patch: Partial<SuggestedTask>) {
    setTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  }

  async function saveOne(i: number) {
    const t = tasks[i];
    await createTask({
      title: t.title, priority: t.priority, status: "todo",
      due_date: t.due_date ?? undefined, notes: t.notes || undefined,
      source_type: t.source_type, source_id: t.source_id, source_link: t.source_link,
    });
    setTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, saved: true } : t));
    setEditIdx(null);
    onSaved?.();
  }

  async function saveAll() {
    setSavingAll(true);
    try {
      const unsaved = tasks.map((t, i) => ({ t, i })).filter(({ t }) => !t.saved && !t.dismissed);
      await Promise.all(unsaved.map(({ i }) => saveOne(i)));
    } finally { setSavingAll(false); }
  }

  const active = tasks.filter((t) => !t.dismissed);
  const unsavedCount = active.filter((t) => !t.saved).length;
  const allSaved = unsavedCount === 0;

  return (
    <div className="card animate-fade-up" style={{ borderColor: "var(--j-ai-border)", overflow: "hidden" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--j-border)", background: "var(--j-surface-2)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="badge-ai">✦ AI</span>
          <span className="text-sm font-semibold" style={{ color: "var(--j-text-1)" }}>Task Suggestions</span>
          <span className="text-xs" style={{ color: "var(--j-text-3)" }}>
            {active.length} extracted{allSaved ? " — all saved ✓" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!allSaved && (
            <button
              onClick={saveAll}
              disabled={savingAll}
              style={{ fontSize: "0.72rem", color: "var(--j-accent-text)", background: "none", border: "none", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              {savingAll ? "Saving…" : `→ Save all ${unsavedCount}`}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ fontSize: "0.72rem", color: "var(--j-text-4)", background: "none", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--j-text-2)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--j-text-4)")}
          >
            dismiss
          </button>
        </div>
      </div>

      {/* Task list */}
      <div>
        {tasks.map((task, i) => {
          if (task.dismissed) return null;
          const isEditing = editIdx === i;

          return (
            <div
              key={i}
              className={`px-5 py-3.5 ${task.saved ? "opacity-50" : ""}`}
              style={{ borderBottom: "1px solid var(--j-border)", transition: "opacity 0.2s" }}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    value={task.title}
                    onChange={(e) => updateTask(i, { title: e.target.value })}
                    className="j-input"
                    onKeyDown={(e) => e.key === "Enter" && saveOne(i)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">Priority</label>
                      <select value={task.priority} onChange={(e) => updateTask(i, { priority: e.target.value as any })} className="j-select">
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Due date</label>
                      <input type="date" value={task.due_date ?? ""} onChange={(e) => updateTask(i, { due_date: e.target.value || null })} className="j-input" />
                    </div>
                  </div>
                  <textarea
                    value={task.notes}
                    onChange={(e) => updateTask(i, { notes: e.target.value })}
                    rows={2} placeholder="Notes…"
                    className="j-input" style={{ resize: "none" }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => saveOne(i)} className="btn-primary text-xs">Save Task</button>
                    <button onClick={() => setEditIdx(null)} className="btn-ghost text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={PRIORITY_BADGE[task.priority]}>{task.priority}</span>
                      {task.due_date && (
                        <span style={{ fontSize: "0.72rem", color: "var(--j-text-3)" }}>
                          Due {new Date(task.due_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      {task.source_type && (
                        <span style={{ fontSize: "0.68rem", color: "var(--j-text-4)" }}>{task.source_type}</span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug" style={{ color: "var(--j-text-1)" }}>{task.title}</p>
                    {task.notes && (
                      <p className="text-xs leading-relaxed" style={{ color: "var(--j-text-3)" }}>{task.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {task.saved ? (
                      <span className="badge-success">✓ saved</span>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditIdx(i)}
                          style={{ fontSize: "0.72rem", color: "var(--j-text-3)", background: "none", border: "none", cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--j-text-1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--j-text-3)")}
                        >
                          edit
                        </button>
                        <button
                          onClick={() => saveOne(i)}
                          style={{ fontSize: "0.72rem", color: "var(--j-accent-text)", background: "none", border: "none", cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          + save
                        </button>
                        <button
                          onClick={() => updateTask(i, { dismissed: true } as any)}
                          style={{ fontSize: "0.72rem", color: "var(--j-text-4)", background: "none", border: "none", cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--j-urgent-dot)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--j-text-4)")}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {active.length === 0 && (
        <div className="empty-state py-8">
          <div className="empty-state-icon">○</div>
          <div className="empty-state-text">No action items found in this context</div>
        </div>
      )}
    </div>
  );
}
