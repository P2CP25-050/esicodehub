import { tagColor } from "@/utils/forum";

interface TagSidebarProps {
  popularTags: string[];
  activeTag: string | undefined;
  loading: boolean;
  onTagClick: (tag: string) => void;
  onClear: () => void;
  // Mobile drawer
  isOpen: boolean;
  onClose: () => void;
}

export function TagSidebar({
  popularTags,
  activeTag,
  loading,
  onTagClick,
  onClear,
  isOpen,
  onClose,
}: TagSidebarProps) {
  return (
    <>
      {/* ── Mobile drawer backdrop ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* ── Mobile drawer ── */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-full w-72 bg-white shadow-2xl
          transform transition-transform duration-300 ease-in-out lg:hidden
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">
            Filter by Tag
          </span>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <TagList
          popularTags={popularTags}
          activeTag={activeTag}
          onTagClick={(tag) => { onTagClick(tag); onClose(); }}
          onClear={() => { onClear(); onClose(); }}
          className="p-5 flex flex-wrap gap-2 overflow-y-auto"
          clearLabel="✕ Clear filter"
          clearClassName="text-xs px-3 py-1.5 rounded-full border font-medium bg-red-50 text-red-500 border-red-200"
          tagClassName="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
        />
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col gap-4 w-52 xl:w-56 shrink-0 sticky top-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Filter by Tag
          </p>
          {popularTags.length === 0 && !loading && (
            <p className="text-xs text-slate-400">No tags yet.</p>
          )}
          <TagList
            popularTags={popularTags}
            activeTag={activeTag}
            onTagClick={onTagClick}
            onClear={onClear}
            className="flex flex-wrap gap-1.5"
            clearLabel="✕ Clear"
            clearClassName="text-xs px-2.5 py-1 rounded-full border font-medium bg-red-50 text-red-500 border-red-200 hover:bg-red-100 transition-colors"
            tagClassName="text-xs px-2.5 py-1 rounded-full border font-medium transition-all"
          />
        </div>
      </aside>
    </>
  );
}

// ── Internal shared tag list ─────────────────────────────────────────────────

interface TagListProps {
  popularTags: string[];
  activeTag: string | undefined;
  onTagClick: (tag: string) => void;
  onClear: () => void;
  className: string;
  clearLabel: string;
  clearClassName: string;
  tagClassName: string;
}

function TagList({
  popularTags,
  activeTag,
  onTagClick,
  onClear,
  className,
  clearLabel,
  clearClassName,
  tagClassName,
}: TagListProps) {
  return (
    <div className={className}>
      {activeTag && (
        <button onClick={onClear} className={clearClassName}>
          {clearLabel}
        </button>
      )}
      {popularTags.length === 0 && (
        <p className="text-sm text-slate-400">No tags yet.</p>
      )}
      {popularTags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagClick(tag)}
          className={`
            ${tagClassName}
            ${activeTag === tag
              ? "bg-blue-600 text-white border-blue-600"
              : `${tagColor(tag)} hover:opacity-80`}
          `}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}