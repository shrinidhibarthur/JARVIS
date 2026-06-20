import Link from "next/link";

interface TeamsHighlight {
  from: string;
  preview: string;
  recommended_action: string;
}

interface Props {
  chatCount: number;
  highlights: TeamsHighlight[];
}

export default function TeamsWidget({ chatCount, highlights }: Props) {
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

      {highlights.length > 0 ? (
        <div className="chat-list">
          {highlights.slice(0, 4).map((h, i) => (
            <div key={i} className="chat-row">
              <span className="chat-avatar">{h.from?.slice(0, 1)?.toUpperCase() || "T"}</span>
              <div className="chat-copy">
                <p className="chat-title">{h.from}</p>
                <p className="chat-preview">{h.preview}</p>
              </div>
              <div className="chat-side">
                <span className="mail-time">now</span>
                {i === 0 && highlights.length > 1 ? <span className="chat-unread-badge">{Math.min(highlights.length, 9)}</span> : null}
              </div>
            </div>
          ))}
          <div className="chat-chip-row">
            <span className="action-chip">Acknowledge</span>
            <span className="action-chip">Send update</span>
            <span className="action-chip">Schedule</span>
          </div>
        </div>
      ) : (
        <div className="empty-state py-4">
          <span className="empty-state-icon">💬</span>
          <p className="empty-state-text">Run Morning Briefing to see highlights</p>
        </div>
      )}

      <Link href="/teams" className="widget-link text-center mt-auto">
        View all chats →
      </Link>
    </div>
  );
}
