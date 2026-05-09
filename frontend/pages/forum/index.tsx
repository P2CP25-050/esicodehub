import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
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

const FORUM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:   #000000;
    --paper: #ffffff;
    --navy:  #051650;
    --rule:  1.5px solid #000;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
  }

  .fp-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal accent stripe */
  .fp-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 340px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(60px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  .fp-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* Breadcrumb */
  .fp-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .fp-breadcrumb-link {
    color: var(--navy);
    cursor: pointer;
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
  }
  .fp-breadcrumb-sep { color: #999; }
  .fp-breadcrumb-current { color: #555; }

  /* Page header */
  .fp-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: var(--rule);
  }

  .fp-page-title {
    font-family: var(--font-display);
    font-size: 42px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 4px;
    line-height: 1.06;
    letter-spacing: -0.02em;
  }
  .fp-page-title span { color: var(--navy); }

  .fp-page-subtitle {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #666;
    margin: 0;
  }

  /* Ask button */
  .fp-ask-btn {
    padding: 13px 28px;
    background: var(--paper);
    color: var(--ink);
    border: 1.5px solid var(--ink);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.1s;
    white-space: nowrap;
    text-decoration: none;
    display: inline-block;
  }
  .fp-ask-btn:hover {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
    box-shadow: 4px 4px 0 var(--navy);
    transform: translate(-2px, -2px);
  }

  /* Layout */
  .fp-layout {
    display: flex;
    gap: 32px;
    align-items: flex-start;
  }

  .fp-main {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 900px) {
    .fp-page::before { display: none; }
    .fp-page-title { font-size: 30px; }
  }
  @media (max-width: 600px) {
    .fp-container { padding: 20px 14px 60px; }
    .fp-page-title { font-size: 26px; }
    .fp-page-header { flex-direction: column; }
    .fp-ask-btn { width: 100%; text-align: center; }
  }
`;

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

  const [ordering, setOrdering] = useState<ForumOrdering>("newest");
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [activeTag, setActiveTag] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <>
      <Head>
        <title>Q&A Forum — ESICodeHub</title>
        <style id="forum-ink-styles">{FORUM_CSS}</style>
      </Head>
    <div className="fp-page">
      <Header activePage="Q&A Forums" />

      <div className="fp-container">
        {/* Breadcrumb */}
        <nav className="fp-breadcrumb">
          <Link href="/" className="fp-breadcrumb-link">Home</Link>
          <span className="fp-breadcrumb-sep">/</span>
          <span className="fp-breadcrumb-current">Forum</span>
        </nav>

        {/* Page header */}
        <div className="fp-page-header">
          <div>
            <h1 className="fp-page-title">
              Community <span>Forum</span>
            </h1>
            <p className="fp-page-subtitle">
              {loading
                ? "Loading…"
                : `${count} question${count !== 1 ? "s" : ""}${
                    activeTag ? ` tagged "${activeTag}"` : ""
                  }`}
            </p>
          </div>

          <button
            onClick={() => router.push("/forum/new")}
            className="fp-ask-btn"
          >
            + Ask a Question
          </button>
        </div>

        {/* Main layout */}
        <div className="fp-layout">
          <TagSidebar
            popularTags={popularTags}
            activeTag={activeTag}
            loading={loading}
            onTagClick={toggleTag}
            onClear={() => setActiveTag(undefined)}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <div className="fp-main">
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
    </>
  )
}
