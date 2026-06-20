const BASE = "/api";
// AI/LLM calls go directly to the backend to bypass the Next.js proxy's 30s timeout.
// Gemma3:12b can take 30–90s; CORS is already enabled on the backend for localhost:3002.
const AI_BASE = "http://localhost:8001/api";

async function req<T>(path: string, options?: RequestInit, base = BASE): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

async function aiReq<T>(path: string, options?: RequestInit): Promise<T> {
  return req<T>(path, options, AI_BASE);
}

// ── Health ───────────────────────────────────────────────────────────────
export const health = () => req<{ status: string }>("/health");

// ── Emails ───────────────────────────────────────────────────────────────
export const getEmails = (top = 20, unread_only = false) =>
  req<any[]>(`/emails?top=${top}&unread_only=${unread_only}`);

export const getEmailBody = (id: string) =>
  req<any>(`/emails/${id}/body`);

export const draftReply = (message_id: string, body_content: string, body_type = "Text") =>
  req<any>(`/emails/${message_id}/draft-reply`, {
    method: "POST",
    body: JSON.stringify({ body_content, body_type }),
  });

export const sendDraft = (draft_id: string) =>
  req<any>(`/emails/send-draft`, {
    method: "POST",
    body: JSON.stringify({ draft_id }),
  });

export const composeEmail = (to: string[], subject: string, body_content: string) =>
  req<any>(`/emails/compose`, {
    method: "POST",
    body: JSON.stringify({ to, subject, body_content }),
  });

// ── Teams ────────────────────────────────────────────────────────────────
export const getTeamsChats = (top = 20) =>
  req<any[]>(`/teams/chats?top=${top}`);

export const getTeamsChatMessages = (chat_id: string, top = 20) =>
  req<any[]>(`/teams/chats/${chat_id}/messages?top=${top}`);

export const getTeamsChannelMessages = (team_id: string, channel_id: string, top = 20) =>
  req<any[]>(`/teams/${team_id}/channels/${channel_id}/messages?top=${top}`);

// ── Tasks ─────────────────────────────────────────────────────────────────
export const getTasks = (status?: string, priority?: string) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  return req<any[]>(`/tasks?${params}`);
};

export const createTask = (data: {
  title: string;
  status?: string;
  priority?: string;
  source_type?: string;
  source_id?: string;
  source_link?: string;
  due_date?: string;
  notes?: string;
}) => req<any>(`/tasks`, { method: "POST", body: JSON.stringify(data) });

export const updateTask = (id: string, data: Partial<{
  title: string; status: string; priority: string; due_date: string; notes: string;
}>) => req<any>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) });

export const deleteTask = (id: string) =>
  req<any>(`/tasks/${id}`, { method: "DELETE" });

// ── Goals ─────────────────────────────────────────────────────────────────
export const getGoals = () => req<any[]>(`/goals`);

export const updateGoal = (id: number, data: {
  progress?: number; status?: string; notes?: string;
}) => req<any>(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// ── Review / AI (direct to backend — bypasses proxy timeout) ─────────────
export const generateBriefing = (payload: {
  emails: any[]; teams_messages: any[]; tasks: any[]; goals: any[];
}) => aiReq<any>(`/review/briefing`, { method: "POST", body: JSON.stringify(payload) });

export const generateDraft = (payload: {
  context_type: string;
  thread: any[];
  instruction?: string;
  goals_context?: any[];
  recipient?: string;
  subject?: string;
}) => aiReq<any>(`/review/draft`, { method: "POST", body: JSON.stringify(payload) });

export const extractTasks = (payload: {
  messages: any[];
  source_type: "email" | "teams_chat" | "teams_channel";
  goals?: any[];
}) => aiReq<any[]>(`/review/extract-tasks`, { method: "POST", body: JSON.stringify(payload) });
