import { useState } from "react";
import Link from "next/link";
import { VoteButtons } from "@/components/forum/VoteButtons";
import { CodeBlock } from "@/components/forum/CodeBlock";
import { MonacoEditor, LANGUAGES } from "@/components/forum/MonacoEditor";
import type { QuestionDetail } from "@/services/forum";
import { timeAgo } from "@/utils/time";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface QuestionDetailCardProps {
  question: QuestionDetail;
  currentUserEmail: string;
  onVote: (v: 1 | -1) => void;
  onDelete: () => void;
  onEdit: (data: { title: string; body: string; code_snippet?: string; code_language?: string }) => Promise<void>;
  onClose: () => Promise<void>;
}

export function QuestionDetailCard({
  question,
  currentUserEmail,
  onVote,
  onDelete,
  onEdit,
  onClose,
}: QuestionDetailCardProps) {
  const isOwn = question.author_email === currentUserEmail;

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(question.title);
  const [editBody, setEditBody] = useState(question.body);
  const [editShowCode, setEditShowCode] = useState(!!question.code_snippet);
  const [editCode, setEditCode] = useState(question.code_snippet ?? "");
  const [editLang, setEditLang] = useState(question.code_language || "python");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Close confirmation state ───────────────────────────────────────────────
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  const openEdit = () => {
    setEditTitle(question.title);
    setEditBody(question.body);
    setEditShowCode(!!question.code_snippet);
    setEditCode(question.code_snippet ?? "");
    setEditLang(question.code_language || "python");
    setEditError("");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) { setEditError("Title is required."); return; }
    if (!editBody.trim()) { setEditError("Body is required."); return; }
    setEditSaving(true);
    setEditError("");
    try {
      await onEdit({
        title: editTitle.trim(),
        body: editBody.trim(),
        ...(editShowCode && editCode.trim()
          ? { code_snippet: editCode, code_language: editLang }
          : { code_snippet: "", code_language: "" }),
      });
      setEditOpen(false);
    } catch {
      setEditError("Failed to save changes. Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmClose = async () => {
    setClosing(true);
    try {
      await onClose();
      setCloseConfirm(false);
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Closed banner */}
        {question.is_closed && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-2 text-red-700 text-sm font-medium">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            This question is closed and no longer accepting answers.
          </div>
        )}

        {/* Header strip */}
        <div className="bg-[#0d1b4b] px-6 py-5 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-400 opacity-10 rounded-full" />
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-1.5 text-blue-400 text-xs mb-2">
                <Link href="/forum" className="hover:text-white transition-colors">
                  Forum
                </Link>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-300">Question</span>
              </div>
              <h1 className="text-xl font-black text-white leading-snug max-w-2xl">
                {question.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex gap-4 items-start">
            {/* Votes */}
            <div className="shrink-0 pt-1">
              <VoteButtons
                score={question.vote_score}
                userVote={question.user_vote ?? null}
                onVote={onVote}
                hidden={isOwn}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                <div className="flex flex-wrap gap-1.5">
                  {question.tags.map((t) => (
                    <span
                      key={t}
                      className="px-2.5 py-0.5 bg-[#0d1b4b] text-white text-[10px] font-bold rounded-full tracking-wide"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 ml-auto">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {question.view_count}
                  </span>
                  <span>{timeAgo(question.created_at)}</span>
                </div>
              </div>

              {/* Author */}
              <Link
                href={`/profile/${question.author_public_id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 mb-4 w-fit group"
              >
                <div className="w-7 h-7 rounded-full bg-[#0d1b4b] flex items-center justify-center text-white text-[10px] font-black border-2 border-transparent group-hover:border-blue-300 transition-all">
                  {initials(question.author_name)}
                </div>
                <span className="text-sm font-bold text-[#0d1b4b] group-hover:underline">
                  {question.author_name}
                </span>
              </Link>

              {/* Body */}
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                {question.body}
              </p>

              {/* Code snippet */}
              {question.code_snippet && (
                <CodeBlock code={question.code_snippet} lang={question.code_language || "plaintext"} />
              )}

              {/* Owner actions */}
              {isOwn && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 flex-wrap">
                  {/* Edit */}
                  <button
                    onClick={openEdit}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>

                  {/* Delete */}
                  <button
                    onClick={onDelete}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>

                  {/* Close */}
                  {!question.is_closed && (
                    <button
                      onClick={() => setCloseConfirm(true)}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* ── Edit Modal ────────────────────────────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="bg-[#0d1b4b] px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-black text-white tracking-wide uppercase font-mono">
                Edit Question
              </h2>
              <button
                onClick={() => setEditOpen(false)}
                className="text-blue-300 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-baseline gap-1.5">
                  Title <span className="text-red-500 text-xs">*</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => { setEditTitle(e.target.value); setEditError(""); }}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all"
                  placeholder="What's your question?"
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-baseline gap-1.5">
                  Body <span className="text-red-500 text-xs">*</span>
                </label>
                <textarea
                  value={editBody}
                  rows={6}
                  onChange={(e) => { setEditBody(e.target.value); setEditError(""); }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none resize-y leading-relaxed focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all"
                  placeholder="Describe your question in detail…"
                />
              </div>

              {/* Code toggle */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setEditShowCode((v) => !v)}
                  className={`text-xs font-bold border-2 px-4 py-1.5 rounded-full transition-all
                    ${editShowCode
                      ? "bg-slate-100 border-slate-300 text-slate-600"
                      : "border-[#0d1b4b] text-[#0d1b4b] hover:bg-[#0d1b4b] hover:text-white"}`}
                >
                  {editShowCode ? "− Remove code" : "+ Add code snippet"}
                </button>
                {editShowCode && (
                  <select
                    value={editLang}
                    onChange={(e) => setEditLang(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-slate-600"
                  >
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                )}
              </div>

              {/* Monaco editor */}
              {editShowCode && (
                <div className="rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a1f2e] border-b border-slate-700">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-70" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-70" />
                    </div>
                    <span className="text-xs text-slate-400 font-mono">question.{editLang}</span>
                  </div>
                  <div style={{ height: "180px" }}>
                    <MonacoEditor
                      language={editLang}
                      theme="vs-dark"
                      value={editCode}
                      onChange={(v: string | undefined) => setEditCode(v ?? "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        padding: { top: 14, bottom: 14 },
                        fontFamily: "'Fira Code', Consolas, monospace",
                        fontLigatures: true,
                        lineNumbers: "on",
                      }}
                    />
                  </div>
                </div>
              )}

              {editError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {editError}
                </p>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setEditOpen(false)}
                className="text-sm font-semibold text-slate-500 px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex items-center gap-2 bg-[#0d1b4b] hover:bg-[#162269] text-white font-bold text-sm px-6 py-2 rounded-xl transition-all shadow-md disabled:opacity-60"
              >
                {editSaving && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Confirmation Modal ──────────────────────────────────────────── */}
      {closeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
            <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
              <svg className="w-5 h-5 text-white shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h2 className="text-sm font-black text-white tracking-wide uppercase font-mono">
                Close Question
              </h2>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 leading-relaxed">
                Are you sure you want to close this question? Once closed, <span className="font-semibold text-slate-900">no new answers can be posted</span>.
              </p>
              <p className="text-xs text-slate-400">This action cannot be undone from the UI.</p>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => setCloseConfirm(false)}
                className="text-sm font-semibold text-slate-500 px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmClose}
                disabled={closing}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-6 py-2 rounded-xl transition-all shadow-md disabled:opacity-60"
              >
                {closing && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {closing ? "Closing…" : "Yes, Close It"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}