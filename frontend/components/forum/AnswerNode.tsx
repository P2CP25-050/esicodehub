import { useState } from "react";
import type { Answer } from "@/services/forum";
import { VoteButtons } from "@/components/forum/VoteButtons";
import { CodeBlock } from "@/components/forum/CodeBlock";
import { InlineAnswerForm } from "@/components/forum/InlineAnswerForm";
import { MonacoEditor, LANGUAGES } from "@/components/forum/MonacoEditor";
import { timeAgo } from "@/utils/time";
import Link from "next/link";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface AnswerNodeProps {
  answer: Answer;
  depth: number;
  questionId: number;
  questionAuthorEmail: string;
  currentUserEmail: string;
  canAccept: boolean;
  hasAccepted: boolean;
  onVote: (id: number, v: 1 | -1) => void;
  onAccept: (id: number) => void;
  onUnaccept: (id: number) => void;
  onDelete: (id: number) => void;
  onReplied: (parentId: number, a: Answer) => void;
  onEdited: (updated: Answer) => void;
}

export function AnswerNode({
  answer,
  depth,
  questionId,
  questionAuthorEmail,
  currentUserEmail,
  canAccept,
  hasAccepted,
  onVote,
  onAccept,
  onUnaccept,
  onDelete,
  onReplied,
  onEdited,
}: AnswerNodeProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ── Inline edit state ─────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState(answer.body);
  const [editShowCode, setEditShowCode] = useState(!!answer.code_snippet);
  const [editCode, setEditCode] = useState(answer.code_snippet ?? "");
  const [editLang, setEditLang] = useState(answer.code_language || "python");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const isOwn = answer.author_email === currentUserEmail;
  const isQAuthor = currentUserEmail === questionAuthorEmail;
  const isTopLevel = answer.parent === null;
  const hasReplies = (answer.replies ?? []).length > 0;

  const borderColors = ["border-[#0d1b4b]", "border-blue-300", "border-slate-300", "border-slate-200"];
  const borderColor = borderColors[Math.min(depth, borderColors.length - 1)];

  const openEdit = () => {
    setEditBody(answer.body);
    setEditShowCode(!!answer.code_snippet);
    setEditCode(answer.code_snippet ?? "");
    setEditLang(answer.code_language || "python");
    setEditError("");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editBody.trim()) { setEditError("Body is required."); return; }
    setEditSaving(true);
    setEditError("");
    try {
      // Import updateAnswer lazily to avoid circular deps at module level
      const { updateAnswer } = await import("@/services/forum");
      const updated = await updateAnswer(questionId, answer.id, {
        body: editBody.trim(),
        ...(editShowCode && editCode.trim()
          ? { code_snippet: editCode, code_language: editLang }
          : { code_snippet: "", code_language: "" }),
      });
      onEdited(updated);
      setEditOpen(false);
    } catch {
      setEditError("Failed to save. Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div
      className={`relative ${depth > 0 ? `ml-8 pl-4 border-l-2 ${borderColor}` : ""}`}
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 28, 84)}px` : undefined }}
    >
      <div
        className={`rounded-xl p-4 mb-2 transition-all
          ${answer.is_accepted
            ? "bg-green-50 border-2 border-green-300 shadow-sm"
            : depth === 0
              ? "bg-white border border-slate-200 shadow-sm"
              : "bg-slate-50 border border-slate-200"}`}
      >
        {/* Accepted badge */}
        {answer.is_accepted && (
          <div className="flex items-center gap-1.5 mb-3 text-green-700 bg-green-100 border border-green-200 w-fit px-3 py-1 rounded-full text-xs font-bold">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Best Answer
          </div>
        )}

        <div className="flex gap-3 items-start">
          {/* Votes */}
          <div className="shrink-0 pt-0.5">
            <VoteButtons
              score={answer.vote_score}
              userVote={answer.user_vote}
              onVote={(v) => onVote(answer.id, v)}
              hidden={isOwn}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Author + time */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Link
                href={`/profile/${answer.author_public_id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 group"
              >
                <div className="w-7 h-7 rounded-full bg-[#0d1b4b] flex items-center justify-center text-white text-[10px] font-black shrink-0 border-2 border-transparent group-hover:border-blue-300 transition-all">
                  {initials(answer.author_name)}
                </div>
                <span className="text-sm font-bold text-[#0d1b4b] group-hover:underline">
                  {answer.author_name}
                </span>
              </Link>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-400">{timeAgo(answer.created_at)}</span>
            </div>

            {/* Body — show editor OR read-only content */}
            {editOpen ? (
              <div className="space-y-3 mb-2">
                <textarea
                  value={editBody}
                  rows={4}
                  onChange={(e) => { setEditBody(e.target.value); setEditError(""); }}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 outline-none resize-y focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all leading-relaxed"
                />

                {/* Code toggle */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setEditShowCode((v) => !v)}
                    className={`text-xs font-bold border-2 px-3 py-1 rounded-full transition-all
                      ${editShowCode
                        ? "bg-slate-100 border-slate-300 text-slate-600"
                        : "border-[#0d1b4b] text-[#0d1b4b] hover:bg-[#0d1b4b] hover:text-white"}`}
                  >
                    {editShowCode ? "− Remove code" : "+ Code"}
                  </button>
                  {editShowCode && (
                    <select
                      value={editLang}
                      onChange={(e) => setEditLang(e.target.value)}
                      className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600"
                    >
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  )}
                </div>

                {editShowCode && (
                  <div className="rounded-xl overflow-hidden border border-slate-700">
                    <div style={{ height: "160px" }}>
                      <MonacoEditor
                        language={editLang}
                        theme="vs-dark"
                        value={editCode}
                        onChange={(v: string | undefined) => setEditCode(v ?? "")}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 12,
                          scrollBeyondLastLine: false,
                          padding: { top: 10, bottom: 10 },
                          fontFamily: "'Fira Code', Consolas, monospace",
                        }}
                      />
                    </div>
                  </div>
                )}

                {editError && (
                  <p className="text-xs text-red-500">{editError}</p>
                )}

                {/* Edit action buttons */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="text-xs font-semibold text-slate-500 px-4 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="text-xs font-bold bg-[#0d1b4b] text-white px-5 py-1.5 rounded-lg hover:bg-[#162269] transition-all disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {editSaving && (
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    )}
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">
                  {answer.body}
                </p>
                {answer.code_snippet && (
                  <CodeBlock code={answer.code_snippet} lang={answer.code_language || "plaintext"} />
                )}
              </>
            )}

            {/* Actions row — hidden while editing */}
            {!editOpen && (
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {/* Reply */}
                <button
                  onClick={() => setReplyOpen((v) => !v)}
                  className="text-xs font-semibold text-slate-500 hover:text-[#0d1b4b] transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  {replyOpen ? "Cancel" : "Reply"}
                </button>

                {/* Accept — question author only, top-level only, not already accepted */}
                {isTopLevel && isQAuthor && !answer.is_accepted && (
                  <button
                    onClick={() => onAccept(answer.id)}
                    className="text-xs font-bold text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-full flex items-center gap-1 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Accept
                  </button>
                )}

                {/* Unaccept — only question author, only if THIS answer is accepted */}
                {isTopLevel && isQAuthor && answer.is_accepted && (
                  <button
                    onClick={() => onUnaccept(answer.id)}
                    className="text-xs font-bold text-slate-500 border border-slate-300 bg-slate-50 hover:bg-red-50 hover:border-red-300 hover:text-red-600 px-3 py-1 rounded-full flex items-center gap-1 transition-all"
                    title="Revoke accepted answer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Unaccept
                  </button>
                )}

                {/* Edit / Delete — own answers only */}
                {isOwn && (
                  <>
                    <button
                      onClick={openEdit}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(answer.id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </>
                )}

                {/* Collapse replies */}
                {hasReplies && (
                  <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    {collapsed
                      ? `Show ${(answer.replies ?? []).length} repl${(answer.replies ?? []).length === 1 ? "y" : "ies"}`
                      : "Collapse"}
                  </button>
                )}
              </div>
            )}

            {/* Reply form */}
            {replyOpen && !editOpen && (
              <InlineAnswerForm
                questionId={questionId}
                parentId={answer.id}
                onCancel={() => setReplyOpen(false)}
                onPosted={(a) => { onReplied(answer.id, a); setReplyOpen(false); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Recursive replies */}
      {!collapsed &&
        (answer.replies ?? []).map((r) => (
          <AnswerNode
            key={r.id}
            answer={r}
            depth={depth + 1}
            questionId={questionId}
            questionAuthorEmail={questionAuthorEmail}
            currentUserEmail={currentUserEmail}
            canAccept={canAccept}
            hasAccepted={hasAccepted}
            onVote={onVote}
            onAccept={onAccept}
            onUnaccept={onUnaccept}
            onDelete={onDelete}
            onReplied={onReplied}
            onEdited={onEdited}
          />
        ))}
    </div>
  );
}
