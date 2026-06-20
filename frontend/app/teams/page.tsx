"use client";
import { useEffect, useState } from "react";
import { getTeamsChats, getTeamsChatMessages, getGoals } from "@/lib/api";
import type { TeamsChat, TeamsMessage } from "@/lib/types";
import DraftPanel from "@/components/DraftPanel";

function formatDate(dt: string) {
  const d = new Date(dt);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function chatName(chat: TeamsChat) {
  return chat.topic || `${chat.chatType} chat`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, "").trim();
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function SkeletonRow() {
  return (
    <div className="list-row" style={{ cursor: "default" }}>
      <div className="skeleton" style={{ height: "0.75rem", width: "60%", marginBottom: "0.4rem" }} />
      <div className="skeleton" style={{ height: "0.65rem", width: "30%" }} />
    </div>
  );
}

export default function TeamsPage() {
  const [chats, setChats]             = useState<TeamsChat[]>([]);
  const [messages, setMessages]       = useState<TeamsMessage[]>([]);
  const [selectedChat, setSelectedChat] = useState<TeamsChat | null>(null);
  const [loading, setLoading]         = useState(true);
  const [msgLoading, setMsgLoading]   = useState(false);
  const [draft, setDraft]             = useState<{ thread: any[] } | null>(null);
  const [goals, setGoals]             = useState<any[]>([]);

  useEffect(() => {
    getGoals().then(setGoals).catch(() => {});
    setLoading(true);
    getTeamsChats(30).then(setChats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function openChat(chat: TeamsChat) {
    setSelectedChat(chat);
    setMsgLoading(true);
    try {
      const msgs = await getTeamsChatMessages(chat.id, 20);
      setMessages(msgs);
    } finally { setMsgLoading(false); }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teams</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : `${chats.length} conversations`}
          </p>
        </div>
        <div className="page-actions">
          <button
            onClick={() => setDraft({ thread: messages })}
            disabled={messages.length === 0 && !selectedChat}
            className="btn-primary"
          >
            ✦ Draft Message
          </button>
        </div>
      </div>

      {/* Split panel */}
      <div className={`split-panel${selectedChat ? " has-selected" : ""}`}>

        {/* ── Chat list ──────────────────────────────────── */}
        <div className="split-list">
          <div className="split-list-header">
            <p className="section-label" style={{ margin: 0 }}>
              Chats — {loading ? "…" : chats.length}
            </p>
          </div>

          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : chats.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon">💬</div>
              <div className="empty-state-text">No chats found</div>
            </div>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => openChat(chat)}
                className={`list-row${selectedChat?.id === chat.id ? " active" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="list-row-title font-medium">{chatName(chat)}</p>
                    <div className="list-row-meta">
                      <span style={{ textTransform: "capitalize" }}>{chat.chatType}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "var(--j-text-4)", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {formatDate(chat.lastUpdatedDateTime)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* ── Messages ───────────────────────────────────── */}
        <div className="split-detail">
          {selectedChat ? (
            <>
              {/* Detail header */}
              <div className="split-detail-header">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--j-text-1)" }}>
                      {chatName(selectedChat)}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--j-text-4)", textTransform: "capitalize" }}>
                      {selectedChat.chatType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDraft({ thread: messages })} className="btn-primary">
                      ✦ AI Draft
                    </button>
                    {selectedChat.webUrl && (
                      <a href={selectedChat.webUrl} target="_blank" rel="noreferrer" className="btn-ghost">
                        Open in Teams ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages body */}
              <div className="split-detail-body space-y-3">
                {msgLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="msg-bubble">
                        <div className="skeleton" style={{ height: "0.65rem", width: "30%", marginBottom: "0.4rem" }} />
                        <div className="skeleton" style={{ height: "0.75rem", width: "80%" }} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty-state py-10">
                    <div className="empty-state-icon">💬</div>
                    <div className="empty-state-text">No messages in this chat</div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const name = msg.from?.user?.displayName ?? "Unknown";
                    const body = stripHtml(msg.body.content);
                    if (!body) return null;
                    return (
                      <div key={msg.id} className="msg-bubble animate-fade-up">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: "var(--j-accent-subtle)", color: "var(--j-accent-text)", fontSize: "0.58rem" }}
                          >
                            {initials(name)}
                          </span>
                          <span className="msg-sender">{name}</span>
                          <span className="msg-time">{formatDate(msg.createdDateTime)}</span>
                        </div>
                        <p className="msg-body">{body}</p>
                        {msg.webUrl && (
                          <a
                            href={msg.webUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: "0.68rem", color: "var(--j-text-4)", marginTop: "0.25rem", display: "inline-block" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--j-accent-text)")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--j-text-4)")}
                          >
                            Open ↗
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clipboard note */}
              <div className="px-5 pb-4 pt-2">
                <p style={{ fontSize: "0.72rem", color: "var(--j-text-4)" }}>
                  ⓘ Drafts are copied to clipboard — bot registration required to send directly.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <span style={{ fontSize: "2.5rem", opacity: 0.15 }}>💬</span>
              <p style={{ fontSize: "0.8125rem", color: "var(--j-text-4)" }}>Select a chat to view messages</p>
            </div>
          )}
        </div>
      </div>

      {draft && (
        <DraftPanel
          contextType="teams_message"
          thread={draft.thread}
          goalsContext={goals}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}
