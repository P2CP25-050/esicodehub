import type { ForumOrdering } from "@/services/forum";

function tagChip(tag: string): string {
  const palette = ["ft-tag-navy", "ft-tag-ink", "ft-tag-mid"];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

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
  { value: "newest",     label: "Newest" },
  { value: "top",        label: "Top Voted" },
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
      <style>{`
        /* Sort tabs */
        .ft-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 12px;
          border: var(--rule);
          width: fit-content;
          overflow-x: auto;
        }
        .ft-tab {
          padding: 10px 20px;
          background: var(--paper);
          color: #888;
          border: none;
          border-right: var(--rule);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          white-space: nowrap;
        }
        .ft-tab:last-child { border-right: none; }
        .ft-tab:hover:not(.ft-tab-active) { background: #f5f5f5; color: var(--ink); }
        .ft-tab-active {
          background: var(--navy);
          color: var(--paper);
        }

        /* Search row */
        .ft-search-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }

        /* Mobile tags button */
        .ft-tags-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: var(--paper);
          border: var(--rule);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s, box-shadow 0.12s;
          flex-shrink: 0;
        }
        .ft-tags-btn:hover { background: #f0f0f0; }
        @media (min-width: 1024px) { .ft-tags-btn { display: none; } }

        .ft-tags-dot {
          width: 6px; height: 6px;
          background: var(--navy);
        }

        /* Input wrapper */
        .ft-input-wrap {
          position: relative;
          flex: 1;
          min-width: 160px;
        }
        .ft-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #aaa;
          pointer-events: none;
          display: flex;
        }
        .ft-input {
          width: 100%;
          padding: 10px 14px 10px 36px;
          border: var(--rule);
          border-radius: 0;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--ink);
          background: #fafafa;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          -webkit-appearance: none;
          appearance: none;
        }
        .ft-input:focus {
          background: var(--paper);
          border-color: var(--navy);
          box-shadow: 3px 3px 0 var(--navy);
        }
        .ft-input::placeholder { color: #ccc; }

        .ft-author-wrap {
          position: relative;
          min-width: 160px;
          flex: 1;
        }
        @media (min-width: 640px) { .ft-author-wrap { flex: none; width: 190px; } }

        /* Active tag pill */
        .ft-active-tag-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .ft-filter-label {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #888;
        }
        .ft-tag-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 10px;
          border: 1px solid;
          cursor: default;
        }
        .ft-tag-navy { color: var(--navy); border-color: var(--navy); }
        .ft-tag-ink  { color: var(--ink);  border-color: var(--ink);  }
        .ft-tag-mid  { color: #444;        border-color: #aaa;        }

        .ft-tag-clear {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 11px;
          line-height: 1;
          padding: 0;
          color: inherit;
          opacity: 0.6;
          transition: opacity 0.1s;
        }
        .ft-tag-clear:hover { opacity: 1; }

        /* Error banner */
        .ft-error {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
          padding: 14px 16px;
          border: 1.5px solid var(--ink);
          border-left: 5px solid #cc0000;
          background: #fff8f8;
          font-family: var(--font-body);
          font-size: 13px;
          color: #cc0000;
          font-weight: 500;
        }
        .ft-retry-btn {
          flex-shrink: 0;
          padding: 6px 14px;
          background: none;
          border: 1.5px solid #cc0000;
          color: #cc0000;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .ft-retry-btn:hover { background: #cc0000; color: var(--paper); }
      `}</style>

      {/* Sort tabs */}
      <div className="ft-tabs">
        {ORDERINGS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onOrderingChange(value)}
            className={`ft-tab ${ordering === value ? "ft-tab-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + author + mobile tag trigger */}
      <div className="ft-search-row">
        {/* Mobile: Tags button */}
        <button onClick={onOpenMobileTags} className="ft-tags-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Tags
          {activeTag && <span className="ft-tags-dot" />}
        </button>

        {/* Search */}
        <div className="ft-input-wrap">
          <span className="ft-input-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ft-input"
          />
        </div>

        {/* Author */}
        <div className="ft-author-wrap ft-input-wrap">
          <span className="ft-input-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Author email…"
            value={author}
            onChange={(e) => onAuthorChange(e.target.value)}
            className="ft-input"
          />
        </div>
      </div>

      {/* Active tag pill */}
      {activeTag && (
        <div className="ft-active-tag-row">
          <span className="ft-filter-label">Filtered by:</span>
          <span className={`ft-tag-pill ${tagChip(activeTag)}`}>
            {activeTag}
            <button onClick={onClearTag} className="ft-tag-clear">✕</button>
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="ft-error">
          <span>⚠ {error}</span>
          <button onClick={onRetry} className="ft-retry-btn">Retry</button>
        </div>
      )}
    </>
  );
}