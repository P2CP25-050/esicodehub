import type { QuestionListItem } from "@/services/forum";
import { QuestionCard } from "@/components/forum/Questioncard";

interface QuestionFeedProps {
  questions: QuestionListItem[];
  voteMap: Record<number, number>;
  loading: boolean;
  loadingMore: boolean;
  hasNextPage: boolean;
  hasFilters: boolean;
  activeTag: string | undefined;
  onVote: (q: QuestionListItem, v: 1 | -1) => void;
  onTagClick: (tag: string) => void;
  onLoadMore: () => void;
}

export function QuestionFeed({
  questions,
  voteMap,
  loading,
  loadingMore,
  hasNextPage,
  hasFilters,
  activeTag,
  onVote,
  onTagClick,
  onLoadMore,
}: QuestionFeedProps) {
  return (
    <>
      <div className="flex flex-col gap-2.5 sm:gap-3">
        {loading ? (
          <SkeletonFeed />
        ) : questions.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              voteScore={voteMap[q.id] ?? q.vote_score}
              onVote={onVote}
              activeTag={activeTag}
              onTagClick={onTagClick}
            />
          ))
        )}
      </div>

      {hasNextPage && !loading && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onLoadMore}
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
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonFeed() {
  return (
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
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
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
  );
}
