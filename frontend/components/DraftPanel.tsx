"use client";
import { useEffect, useRef, useState } from "react";
import { generateDraft, draftReply, sendDraft, composeEmail } from "@/lib/api";
import type { Draft } from "@/lib/types";

interface Props {
  contextType: "email_reply" | "new_email" | "teams_message";
  messageId?: string;
  thread?: any[];
  goalsContext?: any[];
  recipient?: string;
  subject?: string;
  onClose: () => void;
  onSent?: () => void;
}

const TITLE: Record<string, string> = {
  email_reply:   "Draft Reply",
  new_email:     "Compose Email",
  teams_message: "Draft Teams Message",
};

export default function DraftPanel({
  contextType, messageId, thread = [], goalsContext = [],
  recipient, subject, onClose, onSent,
}: Props) {
  const [instruction, setInstruction]   = useState("");
  const [draft, setDraft]               = useState<Draft | null>(null);
  const [editedBody, setEditedBody]     = useState("");
  const [editedSubject, setEditedSubject] = useState(subject ?? "");
  const [toField, setToField]           = useState(recipient ?? "");
  const [generating, setGenerating]     = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [elapsed, setElapsed]           = useState(0);
  const elapsedRef                      = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef                     = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending]           = useState(false);
  const [sentStatus, setSentStatus]     = useState<string | null>(null);
  const [step, setStep]                 = useState<"compose" | "review">("compose");

  useEffect(() => {
    if (generating) {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [generating]);

  const isTeams = contextType === "teams_message";

  async function generate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const result = await generateDraft({
        context_type: contextType, thread, instruction,
        goals_context: goalsContext, recipient: toField, subject: editedSubject,
      });
      setDraft(result);
      setEditedBody(result.body);
      if (result.subject) setEditedSubject(result.subject);
      setStep("review");
      // Scroll textarea into view after a short paint delay
      setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    } catch (e: any) {
      console.error("[JARVIS] Draft generation failed:", e);
      setGenerateError(e.message ?? "Draft generation failed. Check that Ollama is running and the model is available.");
    } finally { setGenerating(false); }
  }

  async function handleSend() {
    if (!editedBody.trim()) return;
    setSending(true);
    setSentStatus(null);
    try {
      if (contextType === "email_reply" && messageId) {
        const res = await draftReply(messageId, editedBody);
        await sendDraft(res.draft_id);
        setSentStatus("✓ Email sent successfully.");
        onSent?.();
      } else if (contextType === "new_email") {
        const toList = toField.split(",").map((s) => s.trim()).filter(Boolean);
        const res = await composeEmail(toList, editedSubject, editedBody);
        await sendDraft(res.draft_id);
        setSentStatus("✓ Email sent successfully.");
        onSent?.();
      } else {
        await navigator.clipboard.writeText(editedBody);
        setSentStatus("✓ Copied to clipboard. Paste it in Teams.");
      }
    } catch (e: any) {
      setSentStatus(`✗ Error: ${e.message}`);
    } finally { setSending(false); }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="drawer">
        <div className="drawer-header">
          <span className="drawer-title">
            <span className="badge-ai">✦ AI</span>
            {TITLE[contextType]}
          </span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          {/* Recipient / Subject (new email) */}
          {contextType === "new_email" && (
            <>
              <div>
                <label className="field-label">To (comma-separated)</label>
                <input
                  value={toField}
                  onChange={(e) => setToField(e.target.value)}
                  placeholder="name@company.com"
                  className="j-input"
                />
              </div>
              <div>
                <label className="field-label">Subject</label>
                <input
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  placeholder="Subject line"
                  className="j-input"
                />
              </div>
            </>
          )}

          {/* Instruction */}
          <div>
            <label className="field-label">
              Instruction for JARVIS
              <span style={{ color: "var(--j-text-4)", fontWeight: 400, marginLeft: "0.3rem" }}>(optional)</span>
            </label>
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
              placeholder={isTeams
                ? "e.g. Keep it brief, ask for status update"
                : "e.g. Keep it concise, mention EOW deadline"}
              className="j-input"
            />
          </div>

          <button onClick={generate} disabled={generating} className="btn-primary w-full">
            {generating
              ? <><span className="animate-spin inline-block mr-1.5">⟳</span>Generating draft… {elapsed}s</>
              : <><span>✦</span> Generate Draft</>}
          </button>
          {generating && (
            <p style={{ fontSize: "0.75rem", color: "var(--j-text-4)", textAlign: "center" }}>
              Ollama is thinking — this typically takes 15–60 seconds…
            </p>
          )}

          {generateError && (
            <p style={{ fontSize: "0.8rem", color: "var(--j-urgent-dot)", background: "var(--j-urgent-bg)", border: "1px solid var(--j-urgent-border)", borderRadius: "8px", padding: "0.5rem 0.75rem", lineHeight: 1.5 }}>
              ✗ {generateError}
            </p>
          )}

          {/* Draft editor */}
          {step === "review" && draft && (
            <>
              <div className="j-divider" />

              <div className="flex items-center justify-between">
                <label className="field-label" style={{ margin: 0 }}>Draft</label>
                <span style={{ fontSize: "0.72rem", color: "var(--j-text-4)" }}>Tone: {draft.tone}</span>
              </div>

              {!isTeams && contextType === "new_email" && (
                <div>
                  <label className="field-label">Subject</label>
                  <input value={editedSubject} onChange={(e) => setEditedSubject(e.target.value)} className="j-input" />
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={12}
                className="j-input"
                style={{ resize: "vertical", fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.8rem", lineHeight: 1.6 }}
              />

              {draft.suggested_follow_up && (
                <div className="card-ai p-3">
                  <p className="field-label">Suggested follow-up</p>
                  <p style={{ fontSize: "0.8125rem", color: "var(--j-accent-text)", lineHeight: 1.5 }}>
                    {draft.suggested_follow_up}
                  </p>
                </div>
              )}

              {sentStatus && (
                <p style={{ fontSize: "0.8125rem", color: sentStatus.startsWith("✓") ? "var(--j-success-text)" : "var(--j-urgent-dot)" }}>
                  {sentStatus}
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={sending || !!sentStatus?.startsWith("✓")}
                className="btn-primary w-full"
              >
                {sending ? "Sending…" : isTeams ? "📋 Copy to Clipboard" : "Send — Approve & Send"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
