import type { QuestionListItem } from "@/services/forum";
import { QuestionCard } from "@/components/forum/Questioncard";

interface QuestionFeedProps {
  questions: QuestionListItem[];
  voteMap: Record<number, number>;
  userVoteMap: Record<number, 1 | -1 | null>;
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
  userVoteMap,
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
      <style>{`
        .qf-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Load more */
        .qf-load-more-wrap {
          margin-top: 24px;
          display: flex;
          justify-content: center;
        }
        .qf-load-more-btn {
          padding: 11px 28px;
          background: var(--paper);
          color: var(--navy);
          border: 1.5px solid var(--navy);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, box-shadow 0.12s, transform 0.1s;
        }
        .qf-load-more-btn:hover:not(:disabled) {
          background: var(--navy);
          color: var(--paper);
          box-shadow: 4px 4px 0 rgba(5,22,80,0.18);
          transform: translate(-2px, -2px);
        }
        .qf-load-more-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        /* Skeleton */
        .qf-skeleton {
          background: var(--paper);
          border: var(--rule);
          display: flex;
          overflow: hidden;
        }
        .qf-skeleton-vote {
          width: 44px;
          flex-shrink: 0;
          background: #f0f0f0;
          border-right: var(--rule);
          min-height: 88px;
        }
        .qf-skeleton-body {
          flex: 1;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .qf-skel-line {
          background: #e8e8e8;
          animation: qf-pulse 1.5s ease-in-out infinite;
        }
        @keyframes qf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }

        /* Empty state */
        .qf-empty {
          background: var(--paper);
          border: var(--rule);
          border-top: 4px solid var(--navy);
          padding: 64px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }
        .qf-empty-icon {
          width: 48px;
          height: 48px;
          border: var(--rule);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--navy);
          background: rgba(5,22,80,0.04);
        }
        .qf-empty-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .qf-empty-sub {
          font-family: var(--font-body);
          font-size: 13px;
          color: #888;
          margin: 0;
          font-weight: 300;
        }
      `}</style>

      <div className="qf-list">
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
              userVote={userVoteMap[q.id] ?? q.user_vote ?? null}
              onVote={onVote}
              activeTag={activeTag}
              onTagClick={onTagClick}
            />
          ))
        )}
      </div>

      {hasNextPage && !loading && (
        <div className="qf-load-more-wrap">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="qf-load-more-btn"
          >
            {loadingMore ? "Loading…" : "Load More +"}
          </button>
        </div>
      )}
    </>
  );
}

function SkeletonFeed() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="qf-skeleton">
          <div className="qf-skeleton-vote" />
          <div className="qf-skeleton-body">
            <div className="qf-skel-line" style={{ height: 14, width: "72%" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <div className="qf-skel-line" style={{ height: 18, width: 52 }} />
              <div className="qf-skel-line" style={{ height: 18, width: 64 }} />
            </div>
            <div className="qf-skel-line" style={{ height: 11, width: "38%" }} />
          </div>
        </div>
      ))}
    </>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="qf-empty">
      <div className="qf-empty-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="qf-empty-title">
        {hasFilters ? "No questions match your filters." : "No questions yet."}
      </p>
      {!hasFilters && (
        <p className="qf-empty-sub">Be the first to ask the community.</p>
      )}
    </div>
  );
}