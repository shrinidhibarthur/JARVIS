import Link from "next/link";

interface EmailHighlight {
  subject: string;
  from: string;
  priority: string;
  recommended_action: string;
}

interface Props {
  total: number;
  unread: number;
  highlights: EmailHighlight[];
}

export default function InboxWidget({ total, unread, highlights }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--j-accent)", fontSize: "0.9rem" }}>✉</span>
          <h2 className="widget-title">Inbox Review</h2>
          <span className="header-inline-count accent">{unread} unread</span>
          <span className="header-inline-count">{total} recent</span>
        </div>
        <Link href="/email" className="widget-link">Open inbox →</Link>
      </div>

      <div className="mail-tabs">
        <button className="mail-tab active">Priority</button>
        <button className="mail-tab">Unread</button>
      </div>

      {highlights.length > 0 ? (
        <div className="mail-list">
          {highlights.slice(0, 4).map((h, i) => (
            <div key={i} className="mail-row">
              <span className={`mail-dot ${h.priority === "urgent" ? "danger" : h.priority === "high" ? "warning" : "info"}`} />
              <div className="mail-copy">
                <p className="mail-sender">{h.from}</p>
                <p className="mail-subject">{h.subject}</p>
                <p className="mail-preview">{h.recommended_action}</p>
              </div>
              <div className="mail-side">
                <span className="mail-time">now</span>
                <span className={`mail-pill ${h.priority === "urgent" ? "danger" : h.priority === "high" ? "warning" : "info"}`}>
                  {h.priority}
                </span>
                <div className="mail-chip-row">
                  <span className="action-chip">✓ Add Task</span>
                  <span className="action-chip">↩ Draft</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state py-4">
          <span className="empty-state-icon">✉</span>
          <p className="empty-state-text">Run Morning Briefing to see highlights</p>
        </div>
      )}

      <Link href="/email" className="widget-link text-center mt-auto">
        View all messages →
      </Link>
    </div>
  );
}
