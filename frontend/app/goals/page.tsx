"use client";
import { useEffect, useState } from "react";
import { getGoals, updateGoal } from "@/lib/api";
import type { Goal } from "@/lib/types";

const STATUS_OPTIONS = ["on_track", "at_risk", "blocked", "complete"] as const;

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  on_track: { label: "On Track", color: "#4ade80", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)",  dot: "#22c55e" },
  at_risk:  { label: "At Risk",  color: "#fbbf24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", dot: "#f59e0b" },
  blocked:  { label: "Blocked",  color: "#fca5a5", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  dot: "#ef4444" },
  complete: { label: "Complete", color: "#22d3ee", bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.25)", dot: "#22d3ee" },
};

function progressGradient(value: number) {
  if (value >= 100) return "linear-gradient(90deg, #0891b2, #22d3ee)";
  if (value >= 70)  return "linear-gradient(90deg, #065f46, #4ade80)";
  if (value >= 40)  return "linear-gradient(90deg, #78350f, #fbbf24)";
  return "linear-gradient(90deg, #7f1d1d, #f87171)";
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track flex-1">
      <div
        className="progress-fill"
        style={{ width: `${Math.min(value, 100)}%`, background: progressGradient(value) }}
      />
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState({ progress: 0, status: "on_track", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGoals()
      .then(setGoals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit(g: Goal) {
    setEditId(g.id);
    setEditVal({ progress: g.progress, status: g.status, notes: g.notes ?? "" });
  }

  async function save(id: number) {
    setSaving(true);
    try {
      const updated = await updateGoal(id, editVal);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  const overallProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0;

  const onTrack  = goals.filter((g) => g.status === "on_track").length;
  const atRisk   = goals.filter((g) => g.status === "at_risk").length;
  const blocked  = goals.filter((g) => g.status === "blocked").length;
  const complete = goals.filter((g) => g.status === "complete").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--j-text-1)" }}>
            Goals
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--j-text-3)" }}>FY26 — Q2 to Q4</p>
        </div>

        {/* Overall progress ring / stat */}
        <div
          className="card px-5 py-3 text-center"
          style={{ minWidth: "5.5rem", borderColor: "rgba(34,211,238,0.25)" }}
        >
          <p
            className="text-3xl font-bold tabular-nums leading-none"
            style={{ color: "var(--j-accent)", letterSpacing: "-0.03em" }}
          >
            {overallProgress}%
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--j-text-3)" }}>Overall</p>
        </div>
      </div>

      {/* ── Status summary chips ─────────────────────────── */}
      {!loading && goals.length > 0 && (
        <div className="flex gap-3 flex-wrap animate-fade-up">
          {[
            { label: "On Track", count: onTrack,  meta: STATUS_META.on_track },
            { label: "At Risk",  count: atRisk,   meta: STATUS_META.at_risk },
            { label: "Blocked",  count: blocked,  meta: STATUS_META.blocked },
            { label: "Complete", count: complete, meta: STATUS_META.complete },
          ].map(({ label, count, meta }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
              {count} {label}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "var(--j-text-3)" }}>
          <div className="animate-spin inline-block mr-2 text-base" style={{ color: "var(--j-accent)" }}>⟳</div>
          Loading goals…
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((g, i) => {
            const meta = STATUS_META[g.status] ?? STATUS_META.at_risk;
            return (
              <div
                key={g.id}
                className="card p-6 space-y-4 card-hover animate-fade-up"
                style={{ borderLeft: `3px solid ${meta.dot}` }}
              >
                {/* Goal header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--j-surface-3)", color: "var(--j-text-3)" }}
                      >
                        G{i + 1}
                      </span>
                      <h2 className="font-semibold text-base" style={{ color: "var(--j-text-1)" }}>
                        {g.name}
                      </h2>
                    </div>
                    {g.description && (
                      <p className="text-sm leading-relaxed" style={{ color: "var(--j-text-2)" }}>
                        {g.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
                      {meta.label}
                    </span>
                    <button
                      onClick={() => editId === g.id ? setEditId(null) : startEdit(g)}
                      className="btn-ghost text-xs"
                    >
                      {editId === g.id ? "Cancel" : "Update"}
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--j-text-3)" }}>Progress</span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{
                        color: g.progress >= 70 ? "#4ade80" : g.progress >= 40 ? "#fbbf24" : "#f87171",
                      }}
                    >
                      {g.progress.toFixed(0)}%
                    </span>
                  </div>
                  <ProgressBar value={g.progress} />
                </div>

                {/* Success criteria */}
                {g.success_criteria?.length > 0 && (
                  <div>
                    <p className="section-label">Success Criteria</p>
                    <ul className="space-y-1.5">
                      {g.success_criteria.map((c, j) => (
                        <li key={j} className="flex gap-2 text-sm" style={{ color: "var(--j-text-2)" }}>
                          <span
                            className="mt-0.5 shrink-0 text-xs"
                            style={{ color: g.progress >= 100 ? "var(--j-accent)" : "var(--j-text-4)" }}
                          >
                            {g.progress >= 100 ? "✓" : "○"}
                          </span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {g.notes && (
                  <div
                    className="rounded-lg p-3"
                    style={{ background: "var(--j-surface-2)", border: "1px solid var(--j-border)" }}
                  >
                    <p className="text-xs mb-1" style={{ color: "var(--j-text-4)" }}>Notes</p>
                    <p className="text-sm" style={{ color: "var(--j-text-2)" }}>{g.notes}</p>
                  </div>
                )}

                {/* Edit form */}
                {editId === g.id && (
                  <div
                    className="pt-4 space-y-4 animate-fade-up"
                    style={{ borderTop: "1px solid var(--j-border-2)" }}
                  >
                    {/* Progress slider */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs" style={{ color: "var(--j-text-2)" }}>Progress</label>
                        <span className="text-sm font-semibold" style={{ color: "var(--j-accent)" }}>
                          {editVal.progress}%
                        </span>
                      </div>
                      <input
                        type="range" min={0} max={100} step={5}
                        value={editVal.progress}
                        onChange={(e) => setEditVal({ ...editVal, progress: Number(e.target.value) })}
                        className="w-full accent-cyan-400"
                      />
                      <div className="flex justify-between text-xs mt-0.5" style={{ color: "var(--j-text-4)" }}>
                        <span>0%</span><span>50%</span><span>100%</span>
                      </div>
                    </div>

                    {/* Status buttons */}
                    <div>
                      <label className="text-xs block mb-2" style={{ color: "var(--j-text-2)" }}>Status</label>
                      <div className="flex gap-2 flex-wrap">
                        {STATUS_OPTIONS.map((s) => {
                          const m = STATUS_META[s];
                          const active = editVal.status === s;
                          return (
                            <button
                              key={s}
                              onClick={() => setEditVal({ ...editVal, status: s })}
                              className="text-xs px-3 py-1.5 rounded-lg transition-all"
                              style={{
                                background: active ? m.bg : "transparent",
                                border: `1px solid ${active ? m.border : "var(--j-border-2)"}`,
                                color: active ? m.color : "var(--j-text-3)",
                              }}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs block mb-1" style={{ color: "var(--j-text-2)" }}>Notes</label>
                      <textarea
                        value={editVal.notes}
                        onChange={(e) => setEditVal({ ...editVal, notes: e.target.value })}
                        placeholder="Add context, blockers, decisions…"
                        rows={3}
                        className="j-input"
                        style={{ resize: "none" }}
                      />
                    </div>

                    <button onClick={() => save(g.id)} disabled={saving} className="btn-primary">
                      {saving ? "Saving…" : "Save Progress"}
                    </button>
                  </div>
                )}

                {/* Footer: dates */}
                <div className="flex items-center gap-4 text-xs pt-1" style={{ color: "var(--j-text-4)" }}>
                  <span>Start: {g.start_date}</span>
                  <span>Target: {g.target_date}</span>
                </div>
              </div>
            );
          })}

          {goals.length === 0 && (
            <div className="empty-state py-16">
              <div className="empty-state-icon">◎</div>
              <div className="empty-state-text">No goals found. Add some via the backend API.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
