import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ForumToolbar } from "@/components/forum/Forumtoolbar";
import { QuestionFeed } from "@/components/forum/Questionfeed";
import { listQuestions, voteQuestion } from "@/services/forum";
import type { QuestionListItem, ForumOrdering } from "@/services/forum";
import { seededShuffle, tagColor } from "@/utils/forum";

// ─────────────────────────────────────────────────────────────────────────────
// Page entry
// ─────────────────────────────────────────────────────────────────────────────

export default function ForumPage() {
  return (
    <ProtectedRoute allowedRole="student">
      <ForumContent />
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ForumContent — state, data fetching, and layout
// ─────────────────────────────────────────────────────────────────────────────

function ForumContent() {
  const router = useRouter();

  // ── Filter state ────────────────────────────────────────────────────────
  const [ordering, setOrdering]     = useState<ForumOrdering>("newest");
  const [search, setSearch]         = useState("");
  const [author, setAuthor]         = useState("");
  const [activeTag, setActiveTag]   = useState<string | undefined>(undefined);
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
  const [questions, setQuestions]     = useState<QuestionListItem[]>([]);
  const [nextPage, setNextPage]       = useState<number | null>(null);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [voteMap, setVoteMap]         = useState<Record<number, number>>({});
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

      {/* Mobile drawer for tags and ask question — only shows when sidebarOpen is true */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-72 bg-white shadow-2xl
          transform transition-transform duration-300 ease-in-out lg:hidden
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">
            Forum Menu
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
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-64px)]">
          <button
            onClick={() => { router.push("/forum/new"); setSidebarOpen(false); }}
            className="
              w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white
              bg-blue-600 hover:bg-blue-700
              shadow-[0_2px_8px_rgba(29,110,245,0.3)]
              active:scale-95 transition-all
            "
          >
            + Ask a Question
          </button>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Filter by Tag
            </p>
            <div className="flex flex-wrap gap-2">
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
          </div>
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
        </div>

        {/* ── Body: sidebar + feed ── */}
        <div className="flex gap-6 items-start">

          {/* Desktop sidebar — displayed inside the layout on desktop only */}
          <aside className="hidden lg:flex flex-col gap-4 w-52 xl:w-56 shrink-0">
            <button
              onClick={() => router.push("/forum/new")}
              className="
                w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white
                bg-blue-600 hover:bg-blue-700
                shadow-[0_2px_8px_rgba(29,110,245,0.3)]
                active:scale-95 transition-all
              "
            >
              + Ask a Question
            </button>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sticky top-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                Filter by Tag
              </p>
              {popularTags.length === 0 && !loading && (
                <p className="text-xs text-slate-400">No tags yet.</p>
              )}
              <div className="flex flex-wrap gap-1.5">
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
            <ForumToolbar
              ordering={ordering}
              onOrderingChange={setOrdering}
              search={search}
              onSearchChange={onSearch}
              author={author}
              onAuthorChange={onAuthor}
              activeTag={activeTag}
              onClearTag={() => setActiveTag(undefined)}
              onOpenMobileTags={() => setSidebarOpen(true)}
              error={error}
              onRetry={fetchPage1}
            />

            <QuestionFeed
              questions={questions}
              voteMap={voteMap}
              loading={loading}
              loadingMore={loadingMore}
              hasNextPage={nextPage !== null}
              hasFilters={hasFilters}
              activeTag={activeTag}
              onVote={handleVote}
              onTagClick={toggleTag}
              onLoadMore={loadMore}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
