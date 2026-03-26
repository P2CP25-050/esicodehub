import { useRouter } from 'next/router';
import { PersonalSubmission } from '@/services/submissions/submissions.types';
import SubmissionCard from './SubmissionCard';

// ============================================================================
// Skeleton
// ============================================================================

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3.5">
      {/* Shimmer wrapper */}
      <div className="relative overflow-hidden">
        {/* Title */}
        <div className="h-5 bg-gray-100 rounded-lg w-3/4 mb-3.5" />
        {/* Description */}
        <div className="space-y-2 mb-3.5">
          <div className="h-3.5 bg-gray-100 rounded w-full" />
          <div className="h-3.5 bg-gray-100 rounded w-4/5" />
        </div>
        {/* Owner */}
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="h-3.5 bg-gray-100 rounded w-28" />
        </div>
        {/* Badges */}
        <div className="flex gap-2 mb-3.5">
          <div className="h-6 bg-gray-100 rounded-lg w-14" />
          <div className="h-6 bg-gray-100 rounded-lg w-24" />
        </div>
        {/* Footer */}
        <div className="flex gap-4 pt-3 border-t border-gray-100">
          <div className="h-3.5 bg-gray-100 rounded w-12" />
          <div className="h-3.5 bg-gray-100 rounded w-16 ml-auto" />
        </div>
        {/* Shimmer sweep */}
        <div className="
          absolute inset-0
          bg-gradient-to-r from-transparent via-white/60 to-transparent
          animate-[shimmer_1.5s_ease-in-out_infinite]
          -translate-x-full
        " />
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({ hasFilters, isAuthenticated, onNew }: {
  hasFilters:      boolean;
  isAuthenticated: boolean;
  onNew:           () => void;
}) {
  return (
    <div className="col-span-full py-24 flex flex-col items-center text-center px-6">
      <div className="
        w-24 h-24 rounded-3xl mb-6
        bg-gradient-to-br from-blue-50 to-indigo-100
        flex items-center justify-center
        shadow-inner
      ">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        {hasFilters ? 'No submissions found' : 'No submissions yet'}
      </h3>
      <p className="text-gray-400 text-sm max-w-sm mb-8 leading-relaxed">
        {hasFilters
          ? 'Try adjusting your filters or clearing your search to find what you\'re looking for.'
          : 'Be the first ESI student to share your code with the community!'}
      </p>
      {!hasFilters && isAuthenticated && (
        <button
          onClick={onNew}
          className="
            group inline-flex items-center gap-2.5 px-6 py-3
            bg-gradient-to-r from-blue-600 to-blue-500
            hover:from-blue-700 hover:to-blue-600
            text-white font-bold text-sm rounded-xl
            shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300
            hover:-translate-y-0.5 transition-all duration-200
          "
        >
          <svg
            className="group-hover:rotate-90 transition-transform duration-200"
            width="15" height="15" viewBox="0 0 16 16" fill="currentColor"
          >
            <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/>
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
  submissions:     PersonalSubmission[];
  loading:         boolean;
  loadingMore:     boolean;
  hasMore:         boolean;
  hasFilters:      boolean;
  isAuthenticated: boolean;
  onLoadMore:      () => void;
  onNew:           () => void;
}

export default function SubmissionsGrid({
  submissions, loading, loadingMore,
  hasMore, hasFilters, isAuthenticated,
  onLoadMore, onNew,
}: SubmissionsGridProps) {
  const router = useRouter();

  return (
    <div>
      {/* Grid */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">

        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}

        {!loading && submissions.length === 0 && (
          <EmptyState
            hasFilters={hasFilters}
            isAuthenticated={isAuthenticated}
            onNew={onNew}
          />
        )}

        {!loading && submissions.map((s, i) => (
          <SubmissionCard
            key={s.id}
            submission={s}
            index={i}
            onClick={() => router.push(`/submissions/${s.id}`)}
          />
        ))}
      </div>

      {/* Load More */}
      {!loading && hasMore && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="
              group relative px-10 py-3.5
              bg-white border-2 border-gray-200 rounded-2xl
              text-sm font-bold text-gray-600
              hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              shadow-sm hover:shadow-md
              min-w-[220px] text-center
            "
          >
            {loadingMore ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin text-blue-600" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Loading more...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Load More
                <svg
                  className="group-hover:translate-y-0.5 transition-transform duration-150"
                  width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
                >
                  <path d="M8 2a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.749.749 0 1 1 1.06 1.06l-4.5 4.5a.749.749 0 0 1-1.06 0l-4.5-4.5a.749.749 0 1 1 1.06-1.06l3.22 3.22V2.75A.75.75 0 0 1 8 2Z"/>
                </svg>
              </span>
            )}
          </button>
          <p className="text-xs text-gray-400">Scroll down to see more</p>
        </div>
      )}
    </div>
  );
}