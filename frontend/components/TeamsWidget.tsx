import Link from "next/link";

interface TeamsHighlight {
  from: string;
  preview: string;
  recommended_action: string;
}

interface Props {
  chats: any[];
  chatCount: number;
  highlights: TeamsHighlight[];
  loading?: boolean;
}

function relativeTime(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function TeamsWidget({ chats, chatCount, highlights, loading }: Props) {
  // Build lookup from chat name→highlight for action hints
  const highlightMap = new Map(highlights.map((h) => [h.from?.toLowerCase(), h]));

  // Sort by last updated descending
  const sorted = [...chats].sort(
    (a, b) => new Date(b.lastUpdatedDateTime ?? 0).getTime() - new Date(a.lastUpdatedDateTime ?? 0).getTime()
  );
  const display = sorted.slice(0, 5);

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "0.9rem" }}>💬</span>
          <h2 className="widget-title">Teams Conversations</h2>
          <span className="header-inline-count">{chatCount} chats</span>
        </div>
        <Link href="/teams" className="widget-link">Open teams →</Link>
      </div>

      {loading ? (
        <div className="empty-state py-4">
          <span className="empty-state-icon" style={{ fontSize: "1.2rem" }}>⟳</span>
          <p className="empty-state-text">Loading chats…</p>
        </div>
      ) : display.length > 0 ? (
        <div className="chat-list">
          {display.map((chat: any, i: number) => {
            const name = chat.topic ?? `Chat ${i + 1}`;
            const time = relativeTime(chat.lastUpdatedDateTime);
            const hint = highlightMap.get(name.toLowerCase());
            const initial = name.slice(0, 1).toUpperCase();

            return (
              <div key={chat.id ?? i} className="chat-row">
                <span className="chat-avatar">{initial}</span>
                <div className="chat-copy">
                  <p className="chat-title">{name}</p>
                  <p className="chat-preview">
                    {hint?.recommended_action ?? hint?.preview ?? (chat.chatType === "oneOnOne" ? "Direct message" : "Group chat")}
                  </p>
                </div>
                <div className="chat-side">
                  <span className="mail-time">{time}</span>
                  {i === 0 && chatCount > 1 && <span className="chat-unread-badge">{Math.min(chatCount, 9)}</span>}
                </div>
              </div>
            );
          })}
          <div className="chat-chip-row">
            <span className="action-chip">Acknowledge</span>
            <span className="action-chip">Send update</span>
            <span className="action-chip">Schedule</span>
          </div>
        </div>
      ) : (
        <div className="empty-state py-4">
          <span className="empty-state-icon">💬</span>
          <p className="empty-state-text">No chats found. Check your Graph token.</p>
        </div>
      )}

      <Link href="/teams" className="widget-link text-center mt-auto">
        View all chats →
      </Link>
    </div>
  );
}
