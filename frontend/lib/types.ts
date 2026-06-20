export interface Email {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
  bodyPreview: string;
  hasAttachments: boolean;
  webLink: string;
}

export interface EmailBody extends Email {
  body: { contentType: string; content: string };
}

export interface TeamsChat {
  id: string;
  topic: string | null;
  chatType: string;
  lastUpdatedDateTime: string;
  webUrl: string;
}

export interface TeamsMessage {
  id: string;
  from: { user?: { displayName: string; id: string } };
  body: { contentType: string; content: string };
  createdDateTime: string;
  webUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "waiting" | "blocked" | "done";
  priority: "low" | "normal" | "high" | "urgent";
  source_type: string | null;
  source_id: string | null;
  source_link: string | null;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: number;
  name: string;
  description: string;
  success_criteria: string[];
  start_date: string;
  target_date: string;
  progress: number;
  status: "on_track" | "at_risk" | "blocked" | "complete";
  notes: string | null;
  updated_at: string;
}

export interface Briefing {
  summary: string;
  urgent_count: number;
  action_items: string[];
  email_highlights: Array<{
    subject: string;
    from: string;
    priority: string;
    recommended_action: string;
  }>;
  teams_highlights: Array<{
    from: string;
    preview: string;
    recommended_action: string;
  }>;
  blocked_tasks: Array<{ title: string; notes: string }>;
  overdue_tasks: Array<{ title: string; due_date: string }>;
}

export interface Draft {
  subject?: string;
  body: string;
  tone: string;
  suggested_follow_up: string | null;
}
