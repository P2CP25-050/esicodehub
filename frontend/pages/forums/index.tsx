import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listQuestions, voteQuestion } from "@/services/forum";
import type { QuestionListItem, ForumOrdering } from "@/services/forum";


// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const TAG_PALETTE = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-cyan-100 text-cyan-700 border-cyan-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
] as const;

function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xff;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Page entry
// ─────────────────────────────────────────────────────────────────────────────

export default function ForumPage() {
  return (
    <ProtectedRoute>
      <ForumContent />
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ForumContent — root of all state and layout
// ─────────────────────────────────────────────────────────────────────────────

function ForumContent() {
  const router = useRouter();

  // ── Filter state ────────────────────────────────────────────────────────
  const [ordering, setOrdering]   = useState<ForumOrdering>("newest");
  const [search,   setSearch]     = useState("");
  const [author,   setAuthor]     = useState("");
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Debounced values (300 ms)
  const [dSearch, setDSearch] = useState("");
  const [dAuthor, setDAuthor] = useState("");
  const st = useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearch = (v: string) => {
    setSearch(v);
    if (st.current) clearTimeout(st.current);
    st.current = setTimeout(() => setDSearch(v), 300);
  };
  const onAuthor = (v: string) => {
    setAuthor(v);
    if (at.current) clearTimeout(at.current);
    at.current = setTimeout(() => setDAuthor(v), 300);
  };

  const toggleTag = (tag: string) =>
    setActiveTag((p) => (p === tag ? undefined : tag));

  // ── Data ────────────────────────────────────────────────────────────────
  const [questions,   setQuestions]   = useState<QuestionListItem[]>([]);
  const [nextPage,    setNextPage]    = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [voteMap,     setVoteMap]     = useState<Record<number, number>>({});
  const seed = useRef(Date.now());

  const fetchPage1 = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listQuestions({
        ordering,
        search: dSearch || undefined,
        author: dAuthor || undefined,
        tag: activeTag,
        page: 1,
      });
      let items = res.results;
      if (ordering === "newest") items = seededShuffle(items, seed.current);
      setQuestions(items);
      setNextPage(res.next ? 2 : null);
      setVoteMap({});
    } catch {
      setError("Failed to load questions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [ordering, dSearch, dAuthor, activeTag]);

  useEffect(() => { fetchPage1(); }, [fetchPage1]);

  const loadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listQuestions({
        ordering,
        search: dSearch || undefined,
        author: dAuthor || undefined,
        tag: activeTag,
        page: nextPage,
      });
      setQuestions((p) => [...p, ...res.results]);
      setNextPage(res.next ? nextPage + 1 : null);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  const handleVote = async (q: QuestionListItem, value: 1 | -1) => {
    const base = voteMap[q.id] ?? q.vote_score;
    setVoteMap((p) => ({ ...p, [q.id]: base + value }));
    try {
      const updated = await voteQuestion(q.id, value);
      setVoteMap((p) => ({ ...p, [q.id]: updated.vote_score }));
    } catch {
      setVoteMap((p) => ({ ...p, [q.id]: base }));
    }
  };

  // ── Popular tags (client-side) ───────────────────────────────────────────
  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) =>
      q.tags.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([t]) => t);
  }, [questions]);

  const hasFilters = !!(dSearch || dAuthor || activeTag);
  const count      = questions.length;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f4ff] font-sans text-[#1a2340]">
      <Header activePage="Forum" />

      {/* ── Mobile sidebar drawer backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar drawer ── */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-72 bg-white shadow-2xl
          transform transition-transform duration-300 ease-in-out lg:hidden
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">
            Filter by Tag
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5 flex flex-wrap gap-2 overflow-y-auto">
          {activeTag && (
            <button
              onClick={() => { setActiveTag(undefined); setSidebarOpen(false); }}
              className="text-xs px-3 py-1.5 rounded-full border font-medium bg-red-50 text-red-500 border-red-200"
            >
              ✕ Clear filter
            </button>
          )}
          {popularTags.length === 0 && (
            <p className="text-sm text-slate-400">No tags yet.</p>
          )}
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { toggleTag(tag); setSidebarOpen(false); }}
              className={`
                text-xs px-3 py-1.5 rounded-full border font-medium transition-all
                ${activeTag === tag
                  ? "bg-blue-600 text-white border-blue-600"
                  : `${tagColor(tag)} hover:opacity-80`}
              `}
            >
              {tag}
            </button>
          ))}
        </div>
      </aside>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-blue-600 font-medium hover:underline">Home</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Forum</span>
        </nav>

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0d1b2a] leading-tight">
              Community Forum
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {loading
                ? "Loading…"
                : `${count} question${count !== 1 ? "s" : ""}${activeTag ? ` tagged "${activeTag}"` : ""}`}
            </p>
          </div>

          <button
            onClick={() => router.push("/forum/new")}
            className="
              px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-bold text-white
              bg-linear-to-r from-blue-600 to-blue-700
              shadow-[0_4px_14px_rgba(29,110,245,0.35)]
              hover:opacity-90 active:scale-95 transition-all whitespace-nowrap
            "
          >
            + Ask a Question
          </button>
        </div>

        {/* ── Body: sidebar + feed ── */}
        <div className="flex gap-6 items-start">

          {/* ── Desktop sidebar ── */}
          <aside className="hidden lg:flex flex-col gap-4 w-52 xl:w-56 shrink-0 sticky top-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Filter by Tag
              </p>
              {popularTags.length === 0 && !loading && (
                <p className="text-xs text-slate-400">No tags yet.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {activeTag && (
                  <button
                    onClick={() => setActiveTag(undefined)}
                    className="text-xs px-2.5 py-1 rounded-full border font-medium bg-red-50 text-red-500 border-red-200 hover:bg-red-100 transition-colors"
                  >
                    ✕ Clear
                  </button>
                )}
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`
                      text-xs px-2.5 py-1 rounded-full border font-medium transition-all
                      ${activeTag === tag
                        ? "bg-blue-600 text-white border-blue-600"
                        : `${tagColor(tag)} hover:opacity-80`}
                    `}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Main feed ── */}
          <div className="flex-1 min-w-0">

            {/* Sorting tabs */}
            <div className="flex items-center gap-1 mb-3 bg-white rounded-xl border border-slate-200 p-1 w-full sm:w-fit overflow-x-auto">
              {(["newest", "top", "unanswered"] as ForumOrdering[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrdering(o)}
                  className={`
                    flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm
                    font-semibold whitespace-nowrap transition-all
                    ${ordering === o
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}
                  `}
                >
                  {o === "top" ? "Top Voted" : o === "unanswered" ? "Unanswered" : "Newest"}
                </button>
              ))}
            </div>

            {/* Search + author + mobile tag trigger */}
            <div className="flex flex-wrap gap-2 mb-4">

              {/* Mobile: Tags button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="
                  lg:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-xl
                  border border-slate-200 bg-white text-sm text-slate-600
                  hover:border-blue-300 transition-all shrink-0
                "
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                  <line x1="7" y1="7" x2="7.01" y2="7"/>
                </svg>
                Tags
                {activeTag && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </button>

              {/* Search */}
              <div className="relative flex-1 min-w-35">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  width="15" height="15" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search questions…"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  className="
                    w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200
                    bg-white text-sm text-[#1a2340] placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                    transition-all
                  "
                />
              </div>

              {/* Author */}
              <div className="relative min-w-35 flex-1 sm:flex-none sm:w-44">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  width="13" height="13" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  placeholder="Author email…"
                  value={author}
                  onChange={(e) => onAuthor(e.target.value)}
                  className="
                    w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200
                    bg-white text-sm text-[#1a2340] placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                    transition-all
                  "
                />
              </div>
            </div>

            {/* Active tag pill (all screens) */}
            {activeTag && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-500">Filtered by:</span>
                <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${tagColor(activeTag)}`}>
                  {activeTag}
                  <button
                    onClick={() => setActiveTag(undefined)}
                    className="hover:opacity-60 transition-opacity"
                  >
                    ✕
                  </button>
                </span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                <span>⚠ {error}</span>
                <button
                  onClick={fetchPage1}
                  className="shrink-0 px-3 py-1 rounded-lg border border-red-400 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Feed */}
            <div className="flex flex-col gap-2.5 sm:gap-3">
              {loading ? (
                // Skeleton
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-200 flex overflow-hidden animate-pulse">
                      <div className="w-11 sm:w-13 bg-slate-100 border-r border-slate-100 min-h-22" />
                      <div className="flex-1 px-3 sm:px-4 py-3 space-y-2.5">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="flex gap-1.5">
                          <div className="h-5 w-14 bg-slate-100 rounded-full" />
                          <div className="h-5 w-16 bg-slate-100 rounded-full" />
                        </div>
                        <div className="h-3 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </>
              ) : questions.length === 0 ? (
                // Empty state
                <div className="bg-white rounded-2xl border border-slate-200 py-14 sm:py-16 flex flex-col items-center gap-3 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-400">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="text-base font-bold text-[#0d1b2a]">
                    {hasFilters ? "No questions match your filters." : "No questions yet."}
                  </p>
                  {!hasFilters && (
                    <p className="text-sm text-slate-400">Be the first to ask the community!</p>
                  )}
                </div>
              ) : (
                // Question cards
                questions.map((q) => {
                  const score = voteMap[q.id] ?? q.vote_score;
                  return (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      voteScore={score}
                      onVote={handleVote}
                      activeTag={activeTag}
                      onTagClick={toggleTag}
                    />
                  );
                })
              )}
            </div>

            {/* Load more */}
            {nextPage !== null && !loading && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="
                    px-6 py-2.5 rounded-xl text-sm font-semibold text-blue-600
                    border border-blue-200 bg-white
                    hover:bg-blue-50 active:scale-95 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionCard
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: QuestionListItem;
  voteScore: number;
  onVote: (q: QuestionListItem, v: 1 | -1) => void;
  activeTag: string | undefined;
  onTagClick: (tag: string) => void;
}

function QuestionCard({ question, voteScore, onVote, activeTag, onTagClick }: QuestionCardProps) {
  const router = useRouter();

  return (
    <div className="
      bg-white rounded-2xl border border-slate-200
      hover:border-blue-300 hover:shadow-md
      transition-all duration-150 flex overflow-hidden
    ">
      {/* Vote column */}
      <div className="
        flex flex-col items-center justify-start gap-1
        px-2 sm:px-3 pt-3 sm:pt-4 pb-3
        bg-slate-50 border-r border-slate-100
        w-10 sm:w-13 shrink-0
      ">
        <button
          onClick={(e) => { e.stopPropagation(); onVote(question, 1); }}
          className="text-slate-400 hover:text-blue-500 transition-colors p-0.5 rounded"
          title="Upvote"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        <span className={`
          text-sm sm:text-base font-black leading-none
          ${voteScore > 0 ? "text-blue-600" : voteScore < 0 ? "text-red-500" : "text-slate-500"}
        `}>
          {voteScore}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); onVote(question, -1); }}
          className="text-slate-400 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Downvote"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 px-3 sm:px-4 py-3 cursor-pointer min-w-0"
        onClick={() => router.push(`/forum/${question.id}`)}
      >
        {/* Title + accepted checkmark */}
        <div className="flex items-start gap-2 mb-1.5 sm:mb-2">
          <h3 className="text-sm sm:text-base font-bold text-[#0d1b2a] leading-snug flex-1 hover:text-blue-700 transition-colors line-clamp-2">
            {question.title}
          </h3>
          {question.has_accepted_answer && (
            <span
              title="Has accepted answer"
              className="shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-100 text-emerald-600"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>

        {/* Tags */}
        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {question.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                className={`
                  text-xs px-2 py-0.5 rounded-full border font-medium transition-all
                  ${activeTag === tag
                    ? "bg-blue-600 text-white border-blue-600"
                    : `${tagColor(tag)} hover:opacity-80`}
                `}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="font-medium text-slate-500 truncate max-w-25 sm:max-w-none">
            {question.author_name}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{timeAgo(question.created_at)}</span>

          {/* Answers badge */}
          <span className={`
            flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full font-semibold
            sm:ml-auto
            ${question.has_accepted_answer
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : question.answer_count > 0
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "bg-slate-100 text-slate-400 border border-slate-200"}
          `}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="hidden sm:inline">{question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}</span>
            <span className="sm:hidden">{question.answer_count}</span>
          </span>

          {/* Views */}
          <span className="flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {question.view_count}
          </span>

          {/* Time — mobile only, after badges */}
          <span className="sm:hidden ml-auto">{timeAgo(question.created_at)}</span>
        </div>
      </div>
    </div>
  );
}