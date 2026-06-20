"use client";
import { useEffect, useRef, useState } from "react";
import {
  getEmails, getTeamsChats, getTasks, getGoals,
  generateBriefing, createTask,
} from "@/lib/api";
import type { Briefing, Goal, Task } from "@/lib/types";
import { useTheme } from "@/lib/theme-context";
import GoalsWidget    from "@/components/GoalsWidget";
import TaskWidget     from "@/components/TaskWidget";
import InboxWidget    from "@/components/InboxWidget";
import TeamsWidget    from "@/components/TeamsWidget";
import AutoExtractModal from "@/components/AutoExtractModal";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function dateString() {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

type ToastMsg = { id: number; text: string; type: "success" | "error" };
function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  function add(text: string, type: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3800);
  }
  return { toasts, add };
}

export default function DashboardPage() {
  const [briefing, setBriefing]             = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [goals, setGoals]                   = useState<Goal[]>([]);
  const [tasks, setTasks]                   = useState<Task[]>([]);
  const [emailCount, setEmailCount]         = useState({ total: 0, unread: 0 });
  const [chatCount, setChatCount]           = useState(0);
  const [lastSync, setLastSync]             = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [savedItems, setSavedItems]         = useState<Set<number>>(new Set());
  const [savingAll, setSavingAll]           = useState(false);
  const [showAutoExtract, setShowAutoExtract] = useState(false);
  const [briefingError, setBriefingError]   = useState<string | null>(null);
  const [briefingTime, setBriefingTime]     = useState<string | null>(null);
  const heroRef                             = useRef<HTMLDivElement>(null);
  const { toasts, add: toast }             = useToast();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [emails, chats, taskList, goalList] = await Promise.all([
          getEmails(30).catch(() => []),
          getTeamsChats(20).catch(() => []),
          getTasks().catch(() => []),
          getGoals().catch(() => []),
        ]);
        setEmailCount({ total: emails.length, unread: emails.filter((e: any) => !e.isRead).length });
        setChatCount(chats.length);
        setTasks(taskList);
        setGoals(goalList);
        setLastSync(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } finally { setLoading(false); }
    }
    load();
  }, []);

  async function runBriefing() {
    setBriefingLoading(true); setSavedItems(new Set()); setBriefingError(null);
    // Scroll hero card into view so the user sees it updating
    setTimeout(() => heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    try {
      const [emails, chats, taskList] = await Promise.all([
        getEmails(20).catch(() => []), getTeamsChats(10).catch(() => []), getTasks().catch(() => []),
      ]);
      const result = await generateBriefing({ emails, teams_messages: chats, tasks: taskList, goals });
      setBriefing(result);
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setBriefingTime(now);
      setLastSync(now);
      toast("Morning briefing ready", "success");
    } catch (e: any) {
      console.error("[JARVIS] Briefing failed:", e);
      const msg = e?.message ?? "Unknown error";
      setBriefingError(msg);
      toast("Briefing generation failed", "error");
    }
    finally { setBriefingLoading(false); }
  }

  async function saveItemAsTask(item: string, index: number) {
    await createTask({ title: item, status: "todo", priority: "normal", source_type: "manual" });
    setSavedItems((prev) => new Set(prev).add(index));
    getTasks().then(setTasks).catch(() => {});
    toast(`Saved: "${item.slice(0, 45)}${item.length > 45 ? "…" : ""}"`);
  }

  async function saveAllAsTask() {
    if (!briefing) return;
    setSavingAll(true);
    try {
      const unsaved = briefing.action_items.map((item, i) => ({ item, i })).filter(({ i }) => !savedItems.has(i));
      await Promise.all(
        unsaved.map(({ item, i }) =>
          createTask({ title: item, status: "todo", priority: "normal", source_type: "manual" })
            .then(() => setSavedItems((prev) => new Set(prev).add(i)))
        )
      );
      getTasks().then(setTasks).catch(() => {});
      toast(`${unsaved.length} action items saved to Tasks`);
    } finally { setSavingAll(false); }
  }

  const urgentTasks  = tasks.filter((t) => t.priority === "urgent" && t.status !== "done");
  const overdueTasks = tasks.filter((t) => t.due_date && t.status !== "done" && new Date(t.due_date) < new Date());
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const highTasks    = tasks.filter((t) => t.priority === "high" && t.status !== "done");
  const activeTasks  = tasks.filter((t) => t.status !== "done");
  const avgGoal = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;
  const briefingSummary = briefing?.summary ?? "Generate a morning briefing for the latest actions, urgent mail, and follow-up decisions.";
  const actionItems = briefing?.action_items ?? [];
  const emailHighlights = briefing?.email_highlights ?? [];

  return (
    <div className="dashboard-root space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="dashboard-head">
        <div className="dashboard-head-copy">
          <h1 className="dashboard-title" style={{ color: "var(--j-text-1)" }}>
            JARVIS Executive Workspace
          </h1>
          <p className="dashboard-subtitle" style={{ color: "var(--j-text-3)" }}>
            {dateString()} · {greeting()}
            {lastSync && <span className="ml-3 tabular-nums">· synced {lastSync}</span>}
          </p>
        </div>
        <div className="header-utilities">
          <div className="sync-indicator">
            <span className="sync-dot" />
            <span>Synced</span>
          </div>
          <button onClick={runBriefing} disabled={briefingLoading} className="btn-primary">
            {briefingLoading ? <><span className="animate-spin inline-block mr-1.5">⟳</span>Generating…</> : <><span>✦</span> Morning Briefing</>}
          </button>
          <button onClick={() => setShowAutoExtract(true)} className="btn-ghost">
            <span>✦</span> Extract Tasks
          </button>
          <button className="theme-pill" onClick={toggle} title="Toggle theme">
            <span>{theme === "dark" ? "🌙" : "☀"}</span>
            <span>{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button className="avatar-pill" title="User profile">
            <span>JS</span>
            <span className="presence-dot" />
          </button>
        </div>
      </div>

      {/* Stat band */}
      <div className="stat-band animate-fade-up" style={{ animationDelay: "50ms" }}>
        <div className="stat-band-item">
          <span className="stat-band-value" style={{ color: emailCount.unread > 0 ? "var(--j-accent)" : "var(--j-text-1)" }}>
            {loading ? "—" : emailCount.unread}
          </span>
          <span className="stat-band-label">Unread emails</span>
        </div>
        <div className="stat-band-item">
          <span className="stat-band-value" style={{ color: urgentTasks.length > 0 ? "var(--j-urgent-dot)" : "var(--j-text-1)" }}>
            {loading ? "—" : urgentTasks.length}
          </span>
          <span className="stat-band-label">Urgent tasks</span>
        </div>
        <div className="stat-band-item">
          <span className="stat-band-value" style={{ color: overdueTasks.length > 0 ? "var(--j-urgent-dot)" : "var(--j-text-1)" }}>
            {loading ? "—" : overdueTasks.length}
          </span>
          <span className="stat-band-label">Overdue</span>
        </div>
        <div className="stat-band-item">
          <span className="stat-band-value" style={{ color: "var(--j-accent)" }}>
            {loading ? "—" : `${avgGoal}%`}
          </span>
          <span className="stat-band-label">Goal progress</span>
        </div>
      </div>

      <div className="hero-card animate-fade-up" ref={heroRef}>
        {briefingLoading && <div className="hero-loading-overlay"><span className="hero-loading-spinner">⟳</span><span>Generating briefing…</span></div>}
        <div className="hero-spotlight" />
        <div className="hero-top">
          <span className="badge-ai">✦ AI BRIEFING</span>
          {briefing?.urgent_count ? <span className="badge-urgent">{briefing.urgent_count} urgent</span> : null}
          {briefingTime && !briefingLoading && <span className="hero-updated-tag">✓ Updated {briefingTime}</span>}
        </div>
        <h2 className="hero-title">Daily Executive Summary</h2>
        <p className="hero-summary">{briefingSummary}</p>
        {briefingError && (
          <div className="hero-error-banner">
            <span>✗ Briefing failed: {briefingError.slice(0, 120)}</span>
            <button onClick={() => setBriefingError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}>×</button>
          </div>
        )}

        <div className="hero-columns">
          <div className="hero-col">
            <div className="hero-col-head">
              <p className="section-label">Action Items</p>
              {actionItems.length > 0 && (
                <button
                  onClick={saveAllAsTask}
                  disabled={savingAll || savedItems.size === actionItems.length}
                  className="hero-inline-link"
                >
                  {savingAll ? "Saving…" : `Save all ${Math.max(actionItems.length - savedItems.size, 0)}`}
                </button>
              )}
            </div>
            <div className="hero-list">
              {actionItems.length === 0 && (
                <div className="hero-empty">No extracted action items yet. Run Morning Briefing.</div>
              )}
              {actionItems.slice(0, 4).map((item, i) => (
                <div key={i} className="hero-task-row">
                  <span className="hero-check">○</span>
                  <span className="hero-task-text">{item}</span>
                  {!savedItems.has(i) ? (
                    <button className="hero-inline-link" onClick={() => saveItemAsTask(item, i)}>+ task</button>
                  ) : (
                    <span className="hero-success-pill">✓ saved</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="hero-col">
            <p className="section-label">Email Highlights</p>
            <div className="hero-list">
              {emailHighlights.length === 0 && (
                <div className="hero-empty">No email highlights available yet.</div>
              )}
              {emailHighlights.slice(0, 4).map((h, i) => {
                const toneClass = h.priority === "urgent" ? "danger" : h.priority === "high" ? "warning" : "info";
                return (
                  <div key={i} className="hero-mail-row">
                    <span className={`hero-dot ${toneClass}`} />
                    <div className="hero-mail-copy">
                      <p>{h.subject}</p>
                      <span>{h.from}</span>
                    </div>
                    <span className={`hero-state-pill ${toneClass}`}>{h.recommended_action}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showAutoExtract && (
        <AutoExtractModal
          onClose={() => setShowAutoExtract(false)}
          onDone={() => getTasks().then(setTasks).catch(() => {})}
        />
      )}

      {/* Goals + Tasks */}
      <div className="dashboard-grid-main grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GoalsWidget goals={goals} onUpdate={(updated) =>
            setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
          } />
        </div>
        <TaskWidget
          urgent={urgentTasks.length} high={highTasks.length}
          normal={tasks.filter((t) => t.priority === "normal" && t.status !== "done").length}
          overdue={overdueTasks.length} blocked={blockedTasks.length} total={activeTasks.length}
        />
      </div>

      {/* Inbox + Teams */}
      <div className="dashboard-grid-secondary grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InboxWidget total={emailCount.total} unread={emailCount.unread} highlights={emailHighlights} />
        <TeamsWidget chatCount={chatCount} highlights={briefing?.teams_highlights ?? []} />
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span style={{ color: t.type === "success" ? "var(--j-success-dot)" : "var(--j-urgent-dot)" }}>
              {t.type === "success" ? "✓" : "✗"}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
