import Link from "next/link";

interface EmailHighlight {
  subject: string;
  from: string;
  priority: string;
  recommended_action: string;
}

interface Props {
  emails: any[];
  total: number;
  unread: number;
  highlights: EmailHighlight[];
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

export default function InboxWidget({ emails, total, unread, highlights, loading }: Props) {
  // Build a lookup from subject→highlight for action hints from briefing
  const highlightMap = new Map(highlights.map((h) => [h.subject?.toLowerCase(), h]));

  // Sort purely by recency so latest emails always appear at the top
  const sorted = [...emails].sort(
    (a, b) => new Date(b.receivedDateTime ?? 0).getTime() - new Date(a.receivedDateTime ?? 0).getTime()
  );
  const display = sorted.slice(0, 5);

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

      {loading ? (
        <div className="empty-state py-4">
          <span className="empty-state-icon" style={{ fontSize: "1.2rem" }}>⟳</span>
          <p className="empty-state-text">Loading inbox…</p>
        </div>
      ) : display.length > 0 ? (
        <div className="mail-list">
          {display.map((e: any, i: number) => {
            const sender = e.from?.emailAddress?.name ?? e.from?.emailAddress?.address ?? "Unknown";
            const subject = e.subject ?? "(no subject)";
            const preview = e.bodyPreview ?? "";
            const time = relativeTime(e.receivedDateTime);
            const hint = highlightMap.get(subject.toLowerCase());
            const priority = hint?.priority ?? (e.importance === "high" ? "high" : e.isRead ? "normal" : "normal");
            const dotClass = priority === "urgent" ? "danger" : priority === "high" ? "warning" : "info";

            return (
              <div key={e.id ?? i} className="mail-row">
                <span className={`mail-dot ${dotClass}`} />
                <div className="mail-copy">
                  <p className="mail-sender">{sender}</p>
                  <p className="mail-subject" style={{ fontWeight: e.isRead ? 400 : 600 }}>{subject}</p>
                  <p className="mail-preview">{hint?.recommended_action ?? preview.slice(0, 80)}</p>
                </div>
                <div className="mail-side">
                  <span className="mail-time">{time}</span>
                  {!e.isRead && <span className={`mail-pill ${dotClass}`}>unread</span>}
                  <div className="mail-chip-row">
                    <span className="action-chip">✓ Add Task</span>
                    <span className="action-chip">↩ Draft</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state py-4">
          <span className="empty-state-icon">✉</span>
          <p className="empty-state-text">No emails found. Check your Graph token.</p>
        </div>
      )}

      <Link href="/email" className="widget-link text-center mt-auto">
        View all messages →
      </Link>
    </div>
  );
}
