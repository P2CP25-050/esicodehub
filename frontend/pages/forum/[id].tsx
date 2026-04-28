import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import {
  getQuestion,
  createAnswer,
  updateAnswer,
  deleteAnswer,
  deleteQuestion,
  acceptAnswer,
  voteQuestion,
  voteAnswer,
} from '@/services/forum';
import type { Answer, QuestionDetail, AnswerCreatePayload } from '@/services/forum';
import Header from '@/components/submissions/Header';

// ─── Monaco (no SSR) ─────────────────────────────────────────────────────────
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(mod => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-40 bg-[#1e1e1e]">
      <span className="text-xs text-slate-500 font-mono animate-pulse tracking-widest">LOADING EDITOR…</span>
    </div>
  ),
});

// ─── Constants ────────────────────────────────────────────────────────────────
const LANGUAGES = [
  'python','javascript','typescript','java','c','cpp','rust','go',
  'sql','bash','html','css','json','yaml','markdown','plaintext',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function injectReply(answers: Answer[], parentId: number, newAnswer: Answer): Answer[] {
  return answers.map(a => {
    if (a.id === parentId) return { ...a, replies: [...(a.replies ?? []), newAnswer] };
    return { ...a, replies: injectReply(a.replies ?? [], parentId, newAnswer) };
  });
}

function removeFromTree(answers: Answer[], id: number): Answer[] {
  return answers
    .filter(a => a.id !== id)
    .map(a => ({ ...a, replies: removeFromTree(a.replies ?? [], id) }));
}

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// ─── VoteButtons ──────────────────────────────────────────────────────────────
function VoteButtons({
  score,
  userVote,
  onVote,
}: {
  score: number;
  userVote: 1 | -1 | null;
  onVote: (v: 1 | -1) => void;
}) {
  const [localScore, setLocalScore] = useState(score);
  const [localVote, setLocalVote] = useState<1 | -1 | null>(userVote);

  const vote = (v: 1 | -1) => {
    const prev = localVote;
    const newVote = prev === v ? null : v;
    const delta = (newVote ?? 0) - (prev ?? 0);
    setLocalScore(s => s + delta);
    setLocalVote(newVote);
    onVote(v);
  };

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[36px]">
      <button
        onClick={() => vote(1)}
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-150 active:scale-90
          ${localVote === 1
            ? 'bg-[#0d1b4b] border-[#0d1b4b] text-white'
            : 'border-slate-200 text-slate-400 hover:border-[#0d1b4b] hover:text-[#0d1b4b]'}`}
        title="Upvote"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <span className={`text-sm font-black tabular-nums ${localScore > 0 ? 'text-[#0d1b4b]' : localScore < 0 ? 'text-red-500' : 'text-slate-500'}`}>
        {localScore}
      </span>
      <button
        onClick={() => vote(-1)}
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-150 active:scale-90
          ${localVote === -1
            ? 'bg-red-500 border-red-500 text-white'
            : 'border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-400'}`}
        title="Downvote"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

// ─── CodeBlock (read-only Monaco) ─────────────────────────────────────────────
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-700 shadow-md my-3">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1f2e] border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 opacity-70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-70" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-70" />
        </div>
        <span className="text-xs text-slate-400 font-mono ml-1 tracking-wider">{lang || 'code'}</span>
      </div>
      <div style={{ height: '180px' }}>
        <MonacoEditor
          language={lang === 'plaintext' ? 'plaintext' : lang}
          theme="vs-dark"
          value={code}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12.5,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            fontFamily: "'Fira Code', Consolas, monospace",
            fontLigatures: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'none',
            scrollbar: { verticalScrollbarSize: 4 },
          }}
        />
      </div>
    </div>
  );
}

// ─── InlineAnswerForm ─────────────────────────────────────────────────────────
function InlineAnswerForm({
  questionId,
  parentId,
  onCancel,
  onPosted,
}: {
  questionId: number;
  parentId: number | null;
  onCancel: () => void;
  onPosted: (a: Answer) => void;
}) {
  const [body, setBody] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('python');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!body.trim()) { setErr('Body is required.'); return; }
    setPosting(true); setErr('');
    try {
      const payload: AnswerCreatePayload = {
        body: body.trim(),
        ...(showCode && code.trim() ? { code_snippet: code, code_language: lang } : {}),
        ...(parentId !== null ? { parent_id: parentId } : {}),
      };
      const ans = await createAnswer(questionId, payload);
      onPosted(ans);
    } catch {
      setErr('Failed to post. Please try again.');
      setPosting(false);
    }
  };

  return (
    <div className="mt-3 bg-slate-50 border-2 border-slate-200 rounded-xl p-4 space-y-3">
      <textarea
        value={body}
        rows={3}
        onChange={e => { setBody(e.target.value); setErr(''); }}
        placeholder="Write your reply…"
        className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-700 outline-none resize-y focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all leading-relaxed"
      />
      {err && <p className="text-xs text-red-500">{err}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowCode(v => !v)}
          className="text-xs font-bold border-2 border-slate-300 text-slate-500 px-3 py-1 rounded-full hover:border-[#0d1b4b] hover:text-[#0d1b4b] transition-all"
        >
          {showCode ? '− Remove code' : '+ Code'}
        </button>
        {showCode && (
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      {showCode && (
        <div className="rounded-xl overflow-hidden border border-slate-700">
          <div style={{ height: '160px' }}>
            <MonacoEditor
              language={lang}
              theme="vs-dark"
              value={code}
              onChange={(v: string | undefined) => setCode(v ?? '')}
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

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-500 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={posting}
          className="text-xs font-bold bg-[#0d1b4b] text-white px-5 py-2 rounded-xl hover:bg-[#162269] transition-all disabled:opacity-60 flex items-center gap-1.5"
        >
          {posting && <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>}
          {posting ? 'Posting…' : 'Post Reply'}
        </button>
      </div>
    </div>
  );
}

// ─── AnswerNode (recursive) ───────────────────────────────────────────────────
function AnswerNode({
  answer,
  depth,
  questionId,
  questionAuthorEmail,
  currentUserEmail,
  canAccept,
  hasAccepted,
  onVote,
  onAccept,
  onDelete,
  onReplied,
}: {
  answer: Answer;
  depth: number;
  questionId: number;
  questionAuthorEmail: string;
  currentUserEmail: string;
  canAccept: boolean;
  hasAccepted: boolean;
  onVote: (id: number, v: 1 | -1) => void;
  onAccept: (id: number) => void;
  onDelete: (id: number) => void;
  onReplied: (parentId: number, a: Answer) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const isOwn = answer.author_email === currentUserEmail;
  const isQAuthor = currentUserEmail === questionAuthorEmail;
  const isTopLevel = answer.parent === null;
  const hasReplies = (answer.replies ?? []).length > 0;

  const borderColors = ['border-[#0d1b4b]', 'border-blue-300', 'border-slate-300', 'border-slate-200'];
  const borderColor = borderColors[Math.min(depth, borderColors.length - 1)];

  return (
    <div
      className={`relative ${depth > 0 ? `ml-8 pl-4 border-l-2 ${borderColor}` : ''}`}
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 28, 84)}px` : undefined }}
    >
      <div className={`rounded-xl p-4 mb-2 transition-all
        ${answer.is_accepted
          ? 'bg-green-50 border-2 border-green-300 shadow-sm'
          : depth === 0
            ? 'bg-white border border-slate-200 shadow-sm'
            : 'bg-slate-50 border border-slate-150'}`}
      >
        {/* Accepted badge */}
        {answer.is_accepted && (
          <div className="flex items-center gap-1.5 mb-3 text-green-700 bg-green-100 border border-green-200 w-fit px-3 py-1 rounded-full text-xs font-bold">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Best Answer
          </div>
        )}

        <div className="flex gap-3 items-start">
          {/* Votes */}
          <div className="shrink-0 pt-0.5">
            <VoteButtons
              score={answer.vote_score}
              userVote={answer.user_vote}
              onVote={v => onVote(answer.id, v)}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Author + time */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div className="w-7 h-7 rounded-full bg-[#0d1b4b] flex items-center justify-center text-white text-[10px] font-black shrink-0">
                {initials(answer.author_name)}
              </div>
              <span className="text-sm font-bold text-[#0d1b4b]">{answer.author_name}</span>
              <span className="text-slate-300 text-xs">·</span>
              <span className="text-xs text-slate-400">{timeAgo(answer.created_at)}</span>
            </div>

            {/* Body */}
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">
              {answer.body}
            </p>

            {/* Code snippet */}
            {answer.code_snippet && (
              <CodeBlock code={answer.code_snippet} lang={answer.code_language || 'plaintext'} />
            )}

            {/* Actions row */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                onClick={() => setReplyOpen(v => !v)}
                className="text-xs font-semibold text-slate-500 hover:text-[#0d1b4b] transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                {replyOpen ? 'Cancel' : 'Reply'}
              </button>

              {/* Accept button — question author, top-level, no accepted yet */}
              {isTopLevel && isQAuthor && canAccept && !hasAccepted && !answer.is_accepted && (
                <button
                  onClick={() => onAccept(answer.id)}
                  className="text-xs font-bold text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-full flex items-center gap-1 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  Accept
                </button>
              )}

              {isOwn && (
                <>
                  <button className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(answer.id)}
                    className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete
                  </button>
                </>
              )}

              {hasReplies && (
                <button
                  onClick={() => setCollapsed(v => !v)}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {collapsed ? `Show ${(answer.replies ?? []).length} repl${(answer.replies ?? []).length === 1 ? 'y' : 'ies'}` : 'Collapse'}
                </button>
              )}
            </div>

            {/* Reply form */}
            {replyOpen && (
              <InlineAnswerForm
                questionId={questionId}
                parentId={answer.id}
                onCancel={() => setReplyOpen(false)}
                onPosted={a => { onReplied(answer.id, a); setReplyOpen(false); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Recursive replies */}
      {!collapsed && (answer.replies ?? []).map(r => (
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
          onDelete={onDelete}
          onReplied={onReplied}
        />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuestionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const questionId = Number(id);

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Post-answer form state
  const [answerBody, setAnswerBody] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [ansCode, setAnsCode] = useState('');
  const [ansLang, setAnsLang] = useState('python');
  const [posting, setPosting] = useState(false);
  const [ansError, setAnsError] = useState('');

  // For demo: simulate a current user
  const CURRENT_USER_EMAIL = 'me@example.com';

  useEffect(() => {
    if (!questionId) return;
    setLoading(true);
    getQuestion(questionId)
      .then(q => { setQuestion(q); setLoading(false); })
      .catch(() => { setError('Failed to load question.'); setLoading(false); });
  }, [questionId]);

  const hasAccepted = (question?.answers ?? []).some(a => a.is_accepted);

  const handleQuestionVote = (v: 1 | -1) => {
    voteQuestion(questionId, v).then(q => {
      if (q && typeof q === 'object' && 'vote_score' in q) {
        setQuestion(prev => prev ? { ...prev, vote_score: q.vote_score } : null);
      }
    }).catch(() => {});
  };

  const handleAnswerVote = (id: number, v: 1 | -1) => {
    voteAnswer(questionId, id, v).catch(() => {});
  };

  const handleAccept = (answerId: number) => {
    acceptAnswer(questionId, answerId).then(q => setQuestion(q)).catch(() => {});
  };

  const handleDeleteAnswer = useCallback((id: number) => {
    deleteAnswer(questionId, id)
      .then(() => setQuestion(q => q ? { ...q, answers: removeFromTree(q.answers, id) } : q))
      .catch(() => {});
  }, [questionId]);

  const handleReplied = useCallback((parentId: number, newAnswer: Answer) => {
    setQuestion(q => q ? { ...q, answers: injectReply(q.answers, parentId, newAnswer) } : q);
  }, []);

  const handleDeleteQuestion = async () => {
    if (!confirm('Delete this question?')) return;
    await deleteQuestion(questionId);
    router.push('/forum');
  };

  const postAnswer = async () => {
    if (!answerBody.trim()) { setAnsError('Body is required.'); return; }
    setPosting(true); setAnsError('');
    try {
      const payload: AnswerCreatePayload = {
        body: answerBody.trim(),
        ...(showCode && ansCode.trim() ? { code_snippet: ansCode, code_language: ansLang } : {}),
        parent_id: null,
      };
      const ans = await createAnswer(questionId, payload);
      setQuestion(q => q ? { ...q, answers: [...q.answers, ans] } : q);
      setAnswerBody(''); setAnsCode(''); if (showCode) setShowCode(false);
    } catch {
      setAnsError('Failed to post answer. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  // Separate accepted answers to pin them
  const acceptedAnswers = (question?.answers ?? []).filter(a => a.is_accepted && a.parent === null);
  const otherAnswers = (question?.answers ?? []).filter(a => !a.is_accepted && a.parent === null);

  const sharedNodeProps = {
    questionId,
    questionAuthorEmail: question?.author_email ?? '',
    currentUserEmail: CURRENT_USER_EMAIL,
    canAccept: question?.can_accept_answer ?? false,
    hasAccepted,
    onVote: handleAnswerVote,
    onAccept: handleAccept,
    onDelete: handleDeleteAnswer,
    onReplied: handleReplied,
  };

  return (
    <ProtectedRoute>
      <Header activePage="Q&A Forums" />

      <div className="min-h-screen bg-[#eef0f8]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8">


          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center space-y-3">
                <svg className="animate-spin w-10 h-10 text-[#0d1b4b] mx-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm text-slate-500 font-medium">Loading question…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600">
              <p className="font-bold">{error}</p>
              <Link href="/forum" className="text-sm text-red-400 hover:underline mt-2 block">← Back to Forum</Link>
            </div>
          )}

          {question && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

              {/* ── Main column */}
              <div className="lg:col-span-2 space-y-6">

                {/* ─── QUESTION CARD */}
                <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

                  {/* Closed banner */}
                  {question.is_closed && (
                    <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-2 text-red-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                      This question is closed and no longer accepting answers.
                    </div>
                  )}

                  {/* Header strip */}
                  <div className="bg-[#0d1b4b] px-6 py-5 relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-400 opacity-10 rounded-full" />
                    <div className="flex items-start justify-between gap-4 relative z-10">
                      <div>
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-1.5 text-blue-400 text-xs mb-2">
                          <Link href="/forum" className="hover:text-white transition-colors">Forum</Link>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
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
                      {/* Question votes */}
                      <div className="shrink-0 pt-1">
                        <VoteButtons
                          score={question.vote_score}
                          userVote={null}
                          onVote={handleQuestionVote}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                          {/* Tags */}
                          <div className="flex flex-wrap gap-1.5">
                            {question.tags.map(t => (
                              <span key={t} className="px-2.5 py-0.5 bg-[#0d1b4b] text-white text-[10px] font-bold rounded-full tracking-wide">
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 ml-auto">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                              {question.view_count}
                            </span>
                            <span>{timeAgo(question.created_at)}</span>
                          </div>
                        </div>

                        {/* Author */}
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-full bg-[#0d1b4b] flex items-center justify-center text-white text-[10px] font-black">
                            {initials(question.author_name)}
                          </div>
                          <span className="text-sm font-bold text-[#0d1b4b]">{question.author_name}</span>
                        </div>

                        {/* Body */}
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                          {question.body}
                        </p>

                        {/* Code snippet */}
                        {question.code_snippet && (
                          <CodeBlock code={question.code_snippet} lang={question.code_language || 'plaintext'} />
                        )}

                        {/* Owner actions */}
                        {question.author_email === CURRENT_USER_EMAIL && (
                          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                            <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              Edit
                            </button>
                            <button
                              onClick={handleDeleteQuestion}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                            {!question.is_closed && (
                              <button className="text-xs font-semibold text-amber-600 hover:text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                Close
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>

                {/* ─── ANSWERS */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-black text-[#0d1b4b] flex items-center gap-2">
                      <span className="bg-[#0d1b4b] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                        {(question.answers ?? []).filter(a => a.parent === null).length}
                      </span>
                      Answer{(question.answers ?? []).filter(a => a.parent === null).length !== 1 ? 's' : ''}
                    </h2>
                    {hasAccepted && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full font-semibold flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Accepted answer found
                      </span>
                    )}
                  </div>

                  {/* Pinned accepted answers */}
                  {acceptedAnswers.map(a => (
                    <AnswerNode key={a.id} answer={a} depth={0} {...sharedNodeProps} />
                  ))}

                  {/* Other answers */}
                  {otherAnswers.map(a => (
                    <AnswerNode key={a.id} answer={a} depth={0} {...sharedNodeProps} />
                  ))}

                  {(question.answers ?? []).filter(a => a.parent === null).length === 0 && (
                    <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                      <div className="text-3xl mb-2">💬</div>
                      <p className="text-sm text-slate-500">No answers yet. Be the first to help!</p>
                    </div>
                  )}
                </div>

                {/* ─── POST ANSWER */}
                {question.is_closed ? (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                    <svg className="w-8 h-8 text-red-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                    <p className="text-red-700 font-semibold text-sm">This question is closed and no longer accepting answers.</p>
                  </div>
                ) : (
                  <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-800 px-6 py-4">
                      <h3 className="text-sm font-black text-white tracking-wide uppercase font-mono">Your Answer</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <textarea
                        value={answerBody}
                        rows={6}
                        onChange={e => { setAnswerBody(e.target.value); setAnsError(''); }}
                        placeholder="Write your answer here. Be thorough — include context, code, and examples."
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 text-sm outline-none resize-y leading-relaxed focus:border-[#0d1b4b] focus:shadow-[0_0_0_3px_rgba(13,27,75,0.08)] transition-all"
                      />
                      {ansError && <p className="text-xs text-red-500">{ansError}</p>}

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setShowCode(v => !v)}
                          className={`text-xs font-bold border-2 px-4 py-1.5 rounded-full transition-all
                            ${showCode ? 'bg-slate-100 border-slate-300 text-slate-600' : 'border-[#0d1b4b] text-[#0d1b4b] hover:bg-[#0d1b4b] hover:text-white'}`}
                        >
                          {showCode ? '− Remove code' : '+ Add code snippet'}
                        </button>
                        {showCode && (
                          <select
                            value={ansLang}
                            onChange={e => setAnsLang(e.target.value)}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 outline-none text-slate-600"
                          >
                            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
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
                          <div style={{ height: '200px' }}>
                            <MonacoEditor
                              language={ansLang}
                              theme="vs-dark"
                              value={ansCode}
                              onChange={(v: string | undefined) => setAnsCode(v ?? '')}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                scrollBeyondLastLine: false,
                                padding: { top: 14, bottom: 14 },
                                fontFamily: "'Fira Code', Consolas, monospace",
                                fontLigatures: true,
                                lineNumbers: 'on',
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
                          {posting && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>}
                          {posting ? 'Posting…' : 'Post Answer'}
                        </button>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* ── Sidebar */}
              <div className="space-y-4">
                {/* Question stats */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-[#0d1b4b] px-5 py-3">
                    <h3 className="text-xs font-black text-white tracking-widest uppercase font-mono">Question Stats</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      { label: 'Score', value: question.vote_score },
                      { label: 'Answers', value: (question.answers ?? []).filter(a => a.parent === null).length },
                      { label: 'Views', value: question.view_count },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">{s.label}</span>
                        <span className="text-sm font-black text-[#0d1b4b] font-mono tabular-nums">{s.value}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Status</span>
                        {question.is_closed ? (
                          <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Closed</span>
                        ) : hasAccepted ? (
                          <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Answered</span>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Open</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {question.tags.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <h3 className="text-xs font-black text-[#0d1b4b] tracking-widest uppercase font-mono mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {question.tags.map(t => (
                        <span key={t} className="px-3 py-1 bg-[#0d1b4b] text-white text-xs font-bold rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}