"use client";
import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "@/lib/api";
import type { Task } from "@/lib/types";
import AutoExtractModal from "@/components/AutoExtractModal";

const STATUSES = ["todo", "in_progress", "waiting", "blocked", "done"] as const;
const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

const STATUS_LABEL: Record<string, string> = {
  todo: "Todo", in_progress: "In Progress", waiting: "Waiting",
  blocked: "Blocked", done: "Done",
};
const PRIORITY_BADGE: Record<string, string> = {
  urgent: "badge-urgent", high: "badge-high", normal: "badge-normal", low: "badge-low",
};

/* Column accent colors — left bar + header glow */
const COL_META: Record<string, { bar: string; label: string; dot: string }> = {
  todo:        { bar: "rgba(255,255,255,0.18)", label: "rgba(255,255,255,0.55)", dot: "rgba(255,255,255,0.3)" },
  in_progress: { bar: "#22d3ee",               label: "#22d3ee",                dot: "#22d3ee" },
  waiting:     { bar: "#f59e0b",               label: "#fbbf24",                dot: "#f59e0b" },
  blocked:     { bar: "#ef4444",               label: "#fca5a5",                dot: "#ef4444" },
  done:        { bar: "#22c55e",               label: "#4ade80",                dot: "#22c55e" },
};

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.due_date && task.status !== "done" && new Date(task.due_date) < new Date();

  return (
    <div
      className={`card p-3.5 space-y-2.5 card-hover animate-fade-up ${task.status === "done" ? "opacity-50" : ""}`}
      style={{ borderLeft: `3px solid ${COL_META[task.status]?.bar ?? "var(--j-border-2)"}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`text-sm font-medium flex-1 leading-snug ${
            task.status === "done" ? "line-through" : ""
          }`}
          style={{ color: task.status === "done" ? "var(--j-text-3)" : "var(--j-text-1)" }}
        >
          {task.title}
        </p>
        <span className={PRIORITY_BADGE[task.priority]} style={{ flexShrink: 0 }}>
          {task.priority}
        </span>
      </div>

      {task.notes && (
        <p className="text-xs line-clamp-2" style={{ color: "var(--j-text-3)" }}>
          {task.notes}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="j-select"
          style={{ width: "auto", padding: "0.22rem 0.5rem", fontSize: "0.72rem" }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          {task.due_date && (
            <span
              className="text-xs tabular-nums"
              style={{ color: isOverdue ? "var(--j-urgent-dot)" : "var(--j-text-3)" }}
            >
              {isOverdue ? "⚠ " : ""}Due {task.due_date}
            </span>
          )}
          {task.source_link && (
            <a
              href={task.source_link}
              target="_blank"
              rel="noreferrer"
              className="text-xs"
              style={{ color: "var(--j-accent-text)" }}
            >
              ↗
            </a>
          )}
          <button
            onClick={() => onDelete(task.id)}
            style={{ color: "var(--j-text-4)", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", padding: 0, lineHeight: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--j-urgent-dot)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--j-text-4)")}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", priority: "normal", status: "todo", due_date: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [showAutoExtract, setShowAutoExtract] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getTasks(filterStatus || undefined, filterPriority || undefined);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus, filterPriority]); // eslint-disable-line

  async function handleCreate() {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const created = await createTask({
        title: newTask.title,
        priority: newTask.priority,
        status: newTask.status,
        due_date: newTask.due_date || undefined,
        notes: newTask.notes || undefined,
      });
      setTasks((prev) => [created, ...prev]);
      setNewTask({ title: "", priority: "normal", status: "todo", due_date: "", notes: "" });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    const updated = await updateTask(id, { status });
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const grouped = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {} as Record<string, Task[]>);

  const active = tasks.filter((t) => t.status !== "done");
  const urgentCount = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;
  const overdueCount = tasks.filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date()).length;

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {showAutoExtract && (
        <AutoExtractModal
          onClose={() => setShowAutoExtract(false)}
          onDone={() => load()}
        />
      )}

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--j-text-1)" }}>
            Tasks
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--j-text-3)" }}>
            {active.length} active
            {urgentCount > 0 && <span style={{ color: "var(--j-urgent-dot)" }}> · {urgentCount} urgent</span>}
            {overdueCount > 0 && <span style={{ color: "var(--j-urgent-dot)" }}> · {overdueCount} overdue</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setShowAutoExtract(true)} className="btn-ghost">
            ✦ Auto Scan
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            + Add Task
          </button>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div className="flex gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="j-select"
          style={{ width: "auto" }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="j-select"
          style={{ width: "auto" }}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
      </div>

      {/* ── New task form ────────────────────────────────── */}
      {showForm && (
        <div className="card p-5 space-y-3 animate-fade-up" style={{ borderColor: "var(--j-ai-border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--j-text-1)" }}>New Task</h3>
          <input
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Task title…"
            className="j-input"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="grid grid-cols-3 gap-3">
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              className="j-select"
            >
              {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <select
              value={newTask.status}
              onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
              className="j-select"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              className="j-input"
            />
          </div>
          <textarea
            value={newTask.notes}
            onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
            placeholder="Notes (optional)"
            rows={2}
            className="j-input"
            style={{ resize: "none" }}
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Create Task"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Kanban board ─────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "var(--j-text-3)" }}>
          <div className="animate-spin inline-block mr-2 text-base" style={{ color: "var(--j-accent)" }}>⟳</div>
          Loading tasks…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(["todo", "in_progress", "waiting", "blocked"] as const).map((status) => {
              const meta = COL_META[status];
              return (
                <div key={status}>
                  {/* Column header */}
                  <div
                    className="flex items-center gap-2 mb-3 pb-2"
                    style={{ borderBottom: `2px solid ${meta.bar}22` }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: meta.dot, boxShadow: `0 0 6px ${meta.dot}88` }}
                    />
                    <h3
                      className="text-xs font-semibold uppercase tracking-wider flex-1"
                      style={{ color: meta.label }}
                    >
                      {STATUS_LABEL[status]}
                    </h3>
                    <span
                      className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${meta.bar}22`,
                        color: meta.label,
                        border: `1px solid ${meta.bar}44`,
                        minWidth: "1.5rem",
                        textAlign: "center",
                      }}
                    >
                      {grouped[status]?.length ?? 0}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {grouped[status]?.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))}
                    {grouped[status]?.length === 0 && (
                      <div className="empty-state py-6">
                        <div className="empty-state-icon">○</div>
                        <div className="empty-state-text">No tasks</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Done section */}
          {grouped.done?.length > 0 && (
            <div>
              <div
                className="flex items-center gap-2 mb-3 pb-2"
                style={{ borderBottom: `2px solid ${COL_META.done.bar}22` }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: COL_META.done.dot, boxShadow: `0 0 6px ${COL_META.done.dot}88` }}
                />
                <h3
                  className="text-xs font-semibold uppercase tracking-wider flex-1"
                  style={{ color: COL_META.done.label }}
                >
                  Done
                </h3>
                <span
                  className="text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${COL_META.done.bar}22`,
                    color: COL_META.done.label,
                    border: `1px solid ${COL_META.done.bar}44`,
                  }}
                >
                  {grouped.done.length}
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {grouped.done.map((task) => (
                  <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
