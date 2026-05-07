import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { TagSidebar } from "@/components/forum/Tagsidebar";
import { ForumToolbar } from "@/components/forum/Forumtoolbar";
import { QuestionFeed } from "@/components/forum/Questionfeed";
import { listQuestions, voteQuestion } from "@/services/forum";
import type { QuestionListItem, ForumOrdering } from "@/services/forum";
import { seededShuffle } from "@/utils/forum";

// Helper to extract page number from DRF pagination URL
function getPageFromUrl(url: string | null): number | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const page = urlObj.searchParams.get("page");
    return page ? parseInt(page, 10) : null;
  } catch {
    return null;
  }
}

export default function ForumPage() {
  return (
    <ProtectedRoute allowedRole="student">
      <ForumContent />
    </ProtectedRoute>
  );
}

function ForumContent() {
  const router = useRouter();

  // Filter state
  const [ordering, setOrdering] = useState<ForumOrdering>("newest");
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Debounced values
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

  // Data state
  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voteMap, setVoteMap] = useState<Record<number, number>>({});
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
      setNextPage(getPageFromUrl(res.next));
      setVoteMap({});
    } catch {
      setError("Failed to load questions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [ordering, dSearch, dAuthor, activeTag]);

  useEffect(() => {
    fetchPage1();
  }, [fetchPage1]);

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
      setNextPage(getPageFromUrl(res.next));
    } catch {
      // silent fail
    } finally {
      setLoadingMore(false);
    }
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

  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) =>
      q.tags.forEach((t) => {
        counts[t] = (counts[t] ?? 0) + 1;
      })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([t]) => t);
  }, [questions]);

  const hasFilters = !!(dSearch || dAuthor || activeTag);
  const count = questions.length;

  return (
    <div className="min-h-screen bg-[#f0f4ff] font-sans text-[#1a2340]">
      <Header activePage="Forum" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-6">
          <Link href="/" className="text-blue-600 font-medium hover:underline">
            Home
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Forum</span>
        </nav>

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0d1b2a] leading-tight">
              Community Forum
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {loading
                ? "Loading…"
                : `${count} question${count !== 1 ? "s" : ""}${
                    activeTag ? ` tagged "${activeTag}"` : ""
                  }`}
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

        {/* Main content: sidebar + feed */}
        <div className="flex gap-6 items-start">
          {/* Single TagSidebar – handles both mobile drawer & desktop sidebar */}
          <TagSidebar
            popularTags={popularTags}
            activeTag={activeTag}
            loading={loading}
            onTagClick={toggleTag}
            onClear={() => setActiveTag(undefined)}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

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
