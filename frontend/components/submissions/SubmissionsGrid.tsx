import { useRouter } from 'next/router';
import { PersonalSubmission } from '@/services/submissions/submissions.types';
import SubmissionRow from '@/components/submissions/SubmissionRow';

// ============================================================================
// Skeleton row — matches new compact height
// ============================================================================

function SkeletonRow({ isLast }: { isLast: boolean }) {
  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 animate-pulse
        ${!isLast ? 'border-b border-black/[0.07]' : ''}
      `}
    >
      {/* file icon placeholder */}
      <div className="w-3.5 h-4 bg-black/8 rounded shrink-0" />

      {/* title */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3.5 bg-black/8 rounded w-2/5" />
        <div className="h-2.5 bg-black/5 rounded w-3/5 hidden sm:block" />
      </div>

      {/* right meta */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-black/10" />
          <div className="h-2.5 bg-black/8 rounded w-12" />
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-black/10" />
          <div className="h-2.5 bg-black/8 rounded w-16" />
        </div>
        <div className="h-2.5 bg-black/8 rounded w-17" />
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({
  hasFilters,
  isAuthenticated,
  onNew,
}: {
  hasFilters: boolean;
  isAuthenticated: boolean;
  onNew: () => void;
}) {
  return (
    <div className="py-20 flex flex-col items-center text-center px-6">
      <div
        className="
          w-20 h-20 rounded-2xl mb-5
          bg-black/5 border border-black/10
          flex items-center justify-center
        "
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#051650"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-black mb-2">
        {hasFilters ? 'No submissions found' : 'No submissions yet'}
      </h3>
      <p className="text-black/50 text-sm max-w-sm mb-7 leading-relaxed">
        {hasFilters
          ? "Try adjusting your filters or clearing your search."
          : 'Be the first ESI student to share your code with the community!'}
      </p>
      {!hasFilters && isAuthenticated && (
        <button
          onClick={onNew}
          className="
            group inline-flex items-center gap-2.5 px-6 py-2.5
            bg-[#051650] hover:bg-black
            text-white font-medium text-sm rounded-md
            transition-all duration-200 hover:-translate-y-0.5
          "
        >
          <svg
            className="group-hover:rotate-90 transition-transform duration-200"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z" />
          </svg>
          Share your first submission
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Props & Component
// ============================================================================

interface SubmissionsGridProps {
  submissions: PersonalSubmission[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  hasFilters: boolean;
  isAuthenticated: boolean;
  onLoadMore: () => void;
  onNew: () => void;
}

export default function SubmissionsGrid({
  submissions,
  loading,
  loadingMore,
  hasMore,
  hasFilters,
  isAuthenticated,
  onLoadMore,
  onNew,
}: SubmissionsGridProps) {
  const router = useRouter();

  return (
    <div>
      {/* Column header */}
      {!loading && submissions.length > 0 && (
        <div
          className="
            flex items-center gap-3 px-4 py-2
            border-b border-black/[0.07]
            bg-[#f6f8fa]/60
          "
        >
          <span className="flex-1 text-[0.6875rem] font-semibold text-black/40 uppercase tracking-wider">
            Submission
          </span>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-[0.6875rem] font-semibold text-black/40 uppercase tracking-wider w-24">
              Language
            </span>
            <span className="hidden sm:block text-[0.6875rem] font-semibold text-black/40 uppercase tracking-wider w-30">
              Author
            </span>
            <span className="text-[0.6875rem] font-semibold text-black/40 uppercase tracking-wider w-17 text-right">
              Updated
            </span>
          </div>
        </div>
      )}

      {/* Skeleton rows */}
      {loading &&
        Array.from({ length: 10 }).map((_, i) => (
          <SkeletonRow key={i} isLast={i === 9} />
        ))}

      {/* Empty state */}
      {!loading && submissions.length === 0 && (
        <EmptyState
          hasFilters={hasFilters}
          isAuthenticated={isAuthenticated}
          onNew={onNew}
        />
      )}

      {/* Submission rows */}
      {!loading &&
        submissions.map((s, i) => (
          <SubmissionRow
            key={s.id}
            submission={s}
            isLast={i === submissions.length - 1 && !hasMore}
            onClick={() => router.push(`/submissions/${s.id}`)}
          />
        ))}

      {/* Load More */}
      {!loading && hasMore && (
        <div className="border-t border-black/[0.07] px-4 py-3 flex items-center justify-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="
              flex items-center gap-2 px-5 py-2
              text-sm font-medium text-black/60
              border border-black/20 rounded-md bg-white
              hover:border-black/40 hover:text-black
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150
            "
          >
            {loadingMore ? (
              <>
                <svg
                  className="animate-spin text-[#051650]"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Loading…
              </>
            ) : (
              <>
                Load more submissions
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="text-black/40"
                >
                  <path d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.749.749 0 1 1 1.06 1.06l-4.5 4.5a.749.749 0 0 1-1.06 0l-4.5-4.5a.749.749 0 1 1 1.06-1.06l3.22 3.22V2.75A.75.75 0 0 1 8 2Z" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}