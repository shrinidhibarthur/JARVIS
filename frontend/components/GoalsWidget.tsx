"use client";
import { useState } from "react";
import Link from "next/link";
import type { Goal } from "@/lib/types";
import { updateGoal } from "@/lib/api";

interface Props {
  goals: Goal[];
  onUpdate: (g: Goal) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  on_track: { label: "On Track", color: "#4ade80", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",  dot: "#22c55e" },
  at_risk:  { label: "At Risk",  color: "#fbbf24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", dot: "#f59e0b" },
  blocked:  { label: "Blocked",  color: "#fca5a5", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  dot: "#ef4444" },
  complete: { label: "Complete", color: "#22d3ee", bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.2)", dot: "#22d3ee" },
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

export default function GoalsWidget({ goals, onUpdate }: Props) {
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState<{ progress: number; status: string }>({ progress: 0, status: "on_track" });
  const [saving, setSaving] = useState(false);

  async function save(id: number) {
    setSaving(true);
    try {
      const updated = await updateGoal(id, editVal);
      onUpdate(updated);
      setEditId(null);
    } finally { setSaving(false); }
  }

  return (
    <div className="card p-5 h-full">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--j-accent)", fontSize: "0.88rem" }}>◎</span>
          <h2 className="widget-title">Goals Progress</h2>
        </div>
        <Link href="/goals" className="widget-link">View all goals →</Link>
      </div>

      <div className="goal-grid">
        {goals.slice(0, 3).map((g) => {
          const meta = STATUS_META[g.status] ?? STATUS_META.at_risk;
          return (
            <div key={g.id} className="goal-panel">
              <div className="goal-panel-head">
                <span className="goal-icon-tile">◎</span>
                <div className="min-w-0">
                  <p className="goal-panel-title" title={g.name}>{g.name}</p>
                  <p className="goal-panel-subtitle">Target {new Date(g.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                </div>
              </div>

              <div className="goal-status-row">
                <span className="goal-status-pill" style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: meta.dot }} />
                  {meta.label}
                </span>
                <button
                  onClick={() => { setEditId(g.id); setEditVal({ progress: g.progress, status: g.status }); }}
                  className="hero-inline-link"
                  title="Edit progress"
                >
                  Edit
                </button>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <ProgressBar value={g.progress} />
                <span className="text-xs font-semibold tabular-nums w-9 text-right shrink-0" style={{ color: g.progress >= 70 ? "#4ade80" : g.progress >= 40 ? "#fbbf24" : "#f87171" }}>
                  {g.progress.toFixed(0)}%
                </span>
              </div>

              <p className="goal-blocker">
                <span>Blocker:</span> {g.notes?.trim() ? g.notes : "None logged"}
              </p>
              <p className="goal-related">
                <span>Related Tasks</span>
                <span className="goal-related-badge">{g.success_criteria?.length ?? 0}</span>
              </p>

              {/* Inline editor */}
              {editId === g.id && (
                <div
                  className="mt-3 p-3 rounded-lg space-y-3 animate-fade-up"
                  style={{ background: "var(--j-surface-2)", border: "1px solid var(--j-ai-border)" }}
                >
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="field-label" style={{ margin: 0 }}>Progress</label>
                      <span className="text-xs font-semibold" style={{ color: "var(--j-accent)" }}>{editVal.progress}%</span>
                    </div>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={editVal.progress}
                      onChange={(e) => setEditVal({ ...editVal, progress: Number(e.target.value) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="field-label">Status</label>
                    <select
                      value={editVal.status}
                      onChange={(e) => setEditVal({ ...editVal, status: e.target.value })}
                      className="j-select"
                    >
                      <option value="on_track">On Track</option>
                      <option value="at_risk">At Risk</option>
                      <option value="blocked">Blocked</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => save(g.id)} disabled={saving} className="btn-primary text-xs py-1 px-3">
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditId(null)} className="btn-ghost text-xs py-1 px-3">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="empty-state py-6 col-span-3">
            <div className="empty-state-icon">◎</div>
            <div className="empty-state-text">No goals loaded yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
