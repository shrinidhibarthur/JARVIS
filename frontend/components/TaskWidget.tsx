import Link from "next/link";

interface Props {
  urgent: number;
  high: number;
  normal: number;
  overdue: number;
  blocked: number;
  total: number;
}

export default function TaskWidget({ urgent, high, normal, overdue, blocked, total }: Props) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="widget-header">
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--j-accent)", fontSize: "0.88rem" }}>✓</span>
          <h2 className="widget-title">Task Summary</h2>
        </div>
        <Link href="/tasks" className="widget-link">Open tasks →</Link>
      </div>

      <div className="task-metric-grid">
        <div className="task-metric-tile danger">
          <p>Urgent</p>
          <span>{urgent}</span>
        </div>
        <div className="task-metric-tile warning">
          <p>High</p>
          <span>{high}</span>
        </div>
        <div className="task-metric-tile neutral">
          <p>Normal</p>
          <span>{normal}</span>
        </div>
      </div>

      <div className="task-secondary-metrics">
        <p>Total open <strong>{total}</strong></p>
        <p style={{ color: "var(--j-urgent-dot)" }}>Overdue <strong>{overdue}</strong></p>
        <p style={{ color: "var(--j-high-dot)" }}>Blocked <strong>{blocked}</strong></p>
      </div>

      <Link href="/tasks" className="mt-4 btn-ghost text-center block text-xs">
        Manage Tasks
      </Link>
    </div>
  );
}
