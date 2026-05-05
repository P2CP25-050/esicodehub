import type { ForumOrdering } from "@/services/forum";
import { tagColor } from "@/utils/forum";

interface ForumToolbarProps {
  ordering: ForumOrdering;
  onOrderingChange: (o: ForumOrdering) => void;
  search: string;
  onSearchChange: (v: string) => void;
  author: string;
  onAuthorChange: (v: string) => void;
  activeTag: string | undefined;
  onClearTag: () => void;
  onOpenMobileTags: () => void;
  error: string | null;
  onRetry: () => void;
}

const ORDERINGS: { value: ForumOrdering; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "top", label: "Top Voted" },
  { value: "unanswered", label: "Unanswered" },
];

export function ForumToolbar({
  ordering,
  onOrderingChange,
  search,
  onSearchChange,
  author,
  onAuthorChange,
  activeTag,
  onClearTag,
  onOpenMobileTags,
  error,
  onRetry,
}: ForumToolbarProps) {
  return (
    <>
      {/* ── Sort tabs ── */}
      <div className="flex items-center gap-1 mb-3 bg-white rounded-xl border border-slate-200 p-1 w-full sm:w-fit overflow-x-auto">
        {ORDERINGS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onOrderingChange(value)}
            className={`
              flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm
              font-semibold whitespace-nowrap transition-all
              ${ordering === value
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Search + author + mobile tag trigger ── */}
      <div className="flex flex-wrap gap-2 mb-4">

        {/* Mobile: Tags button */}
        <button
          onClick={onOpenMobileTags}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
            onChange={(e) => onAuthorChange(e.target.value)}
            className="
              w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200
              bg-white text-sm text-[#1a2340] placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
              transition-all
            "
          />
        </div>
      </div>

      {/* ── Active tag pill ── */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-slate-500">Filtered by:</span>
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${tagColor(activeTag)}`}>
            {activeTag}
            <button onClick={onClearTag} className="hover:opacity-60 transition-opacity">
              ✕
            </button>
          </span>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center justify-between gap-4 mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
          <span>⚠ {error}</span>
          <button
            onClick={onRetry}
            className="shrink-0 px-3 py-1 rounded-lg border border-red-400 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </>
  );
}