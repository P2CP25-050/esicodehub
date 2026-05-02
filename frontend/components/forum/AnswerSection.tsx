import { useCallback, useState } from "react";
import {
  createAnswer,
  voteAnswer,
  acceptAnswer,
  deleteAnswer,
} from "@/services/forum";
import type { Answer, AnswerCreatePayload, QuestionDetail } from "@/services/forum";
import { AnswerNode } from "@/components/forum/AnswerNode";
import { MonacoEditor, LANGUAGES } from "@/components/forum/MonacoEditor";

// ── Tree helpers ──────────────────────────────────────────────────────────────

function injectReply(answers: Answer[], parentId: number, newAnswer: Answer): Answer[] {
  return answers.map((a) => {
    if (a.id === parentId) return { ...a, replies: [...(a.replies ?? []), newAnswer] };
    return { ...a, replies: injectReply(a.replies ?? [], parentId, newAnswer) };
  });
}

function removeFromTree(answers: Answer[], id: number): Answer[] {
  return answers
    .filter((a) => a.id !== id)
    .map((a) => ({ ...a, replies: removeFromTree(a.replies ?? [], id) }));
}

/** Mark exactly one answer as accepted (and clear all others) in the tree. */
function updateAcceptedInTree(answers: Answer[], acceptedId: number): Answer[] {
  return answers.map((a) => ({
    ...a,
    is_accepted: a.id === acceptedId,
    replies: updateAcceptedInTree(a.replies ?? [], acceptedId),
  }));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AnswerSectionProps {
  question: QuestionDetail;
  currentUserEmail: string;
  onQuestionUpdate: (updater: (q: QuestionDetail) => QuestionDetail) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnswerSection({
  question,
  currentUserEmail,
  onQuestionUpdate,
}: AnswerSectionProps) {
  const questionId = question.id;

  // Post-answer form state
  const [answerBody, setAnswerBody] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [ansCode, setAnsCode] = useState("");
  const [ansLang, setAnsLang] = useState("python");
  const [posting, setPosting] = useState(false);
  const [ansError, setAnsError] = useState("");

  const hasAccepted = (question.answers ?? []).some((a) => a.is_accepted);

  // Handlers
  const handleAnswerVote = (id: number, v: 1 | -1) => {
    voteAnswer(questionId, id, v).catch(() => {});
  };

  const handleAccept = (answerId: number) => {
    acceptAnswer(questionId, answerId)
      .then(() =>
        onQuestionUpdate((q) => ({
          ...q,
          answers: updateAcceptedInTree(q.answers, answerId),
        }))
      )
      .catch(() => {});
  };

  const handleDeleteAnswer = useCallback(
    (id: number) => {
      deleteAnswer(questionId, id)
        .then(() =>
          onQuestionUpdate((q) => ({ ...q, answers: removeFromTree(q.answers, id) }))
        )
        .catch(() => {});
    },
    [questionId, onQuestionUpdate]
  );

  const handleReplied = useCallback(
    (parentId: number, newAnswer: Answer) => {
      onQuestionUpdate((q) => ({
        ...q,
        answers: injectReply(q.answers, parentId, newAnswer),
      }));
    },
    [onQuestionUpdate]
  );

  const postAnswer = async () => {
    if (!answerBody.trim()) { setAnsError("Body is required."); return; }
    setPosting(true);
    setAnsError("");
    try {
      const payload: AnswerCreatePayload = {
        body: answerBody.trim(),
        ...(showCode && ansCode.trim() ? { code_snippet: ansCode, code_language: ansLang } : {}),
        parent_id: null,
      };
      const ans = await createAnswer(questionId, payload);
      onQuestionUpdate((q) => ({ ...q, answers: [...q.answers, ans] }));
      setAnswerBody("");
      setAnsCode("");
      if (showCode) setShowCode(false);
    } catch {
      setAnsError("Failed to post answer. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  // Split accepted vs regular top-level answers
  const acceptedAnswers = (question.answers ?? []).filter(
    (a) => a.is_accepted && a.parent === null
  );
  const otherAnswers = (question.answers ?? []).filter(
    (a) => !a.is_accepted && a.parent === null
  );

  const sharedNodeProps = {
    questionId,
    questionAuthorEmail: question.author_email ?? "",
    currentUserEmail,
    canAccept: question.can_accept_answer ?? false,
    hasAccepted,
    onVote: handleAnswerVote,
    onAccept: handleAccept,
    onDelete: handleDeleteAnswer,
    onReplied: handleReplied,
  };

  const topLevelCount = (question.answers ?? []).filter((a) => a.parent === null).length;

  return (
    <>
      {/* ── Answer list header ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-black text-[#0d1b4b] flex items-center gap-2">
          <span className="bg-[#0d1b4b] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
            {topLevelCount}
          </span>
          Answer{topLevelCount !== 1 ? "s" : ""}
        </h2>
        {hasAccepted && (
          <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Accepted answer found
          </span>
        )}
      </div>

      {/* Pinned accepted answers */}
      {acceptedAnswers.map((a) => (
        <AnswerNode key={a.id} answer={a} depth={0} {...sharedNodeProps} />
      ))}

      {/* Other answers */}
      {otherAnswers.map((a) => (
        <AnswerNode key={a.id} answer={a} depth={0} {...sharedNodeProps} />
      ))}

      {topLevelCount === 0 && (
        <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
          <div className="text-3xl mb-2">💬</div>
          <p className="text-sm text-slate-500">No answers yet. Be the first to help!</p>
        </div>
      )}

      {/* ── Post Answer form ── */}
      {question.is_closed ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center mt-6">
          <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          <p className="text-red-700 font-semibold text-sm">
            This question is closed and no longer accepting answers.
          </p>
        </div>
      ) : (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
          <div className="bg-slate-800 px-6 py-4">
            <h3 className="text-sm font-black text-white tracking-wide uppercase font-mono">
              Your Answer
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <textarea
              value={answerBody}
              rows={6}
              onChange={(e) => { setAnswerBody(e.target.value); setAnsError(""); }}
              placeholder="Write your answer here. Be thorough — include context, code, and examples."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none resize-y leading-relaxed focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all"
            />
            {ansError && <p className="text-xs text-red-500">{ansError}</p>}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className={`text-xs font-bold border-2 px-4 py-1.5 rounded-full transition-all
                  ${showCode
                    ? "bg-slate-100 border-slate-300 text-slate-600"
                    : "border-[#0d1b4b] text-[#0d1b4b] hover:bg-[#0d1b4b] hover:text-white"}`}
              >
                {showCode ? "− Remove code" : "+ Add code snippet"}
              </button>
              {showCode && (
                <select
                  value={ansLang}
                  onChange={(e) => setAnsLang(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-slate-600"
                >
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>

            {showCode && (
              <div className="rounded-xl overflow-hidden border-2 border-slate-700 shadow-lg">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1a1f2e] border-b border-slate-700">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-70" />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">answer.{ansLang}</span>
                </div>
                <div style={{ height: "200px" }}>
                  <MonacoEditor
                    language={ansLang}
                    theme="vs-dark"
                    value={ansCode}
                    onChange={(v: string | undefined) => setAnsCode(v ?? "")}
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

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400">Be respectful and constructive.</p>
              <button
                onClick={postAnswer}
                disabled={posting}
                className="flex items-center gap-2 bg-[#0d1b4b] hover:bg-[#162269] text-white font-bold text-sm px-7 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-60"
              >
                {posting && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {posting ? "Posting…" : "Post Answer"}
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}