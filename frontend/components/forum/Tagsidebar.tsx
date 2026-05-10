function tagChip(tag: string): string {
  const palette = ["ts-tag-navy", "ts-tag-ink", "ts-tag-mid"];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

interface TagSidebarProps {
  popularTags: string[];
  activeTag: string | undefined;
  loading: boolean;
  onTagClick: (tag: string) => void;
  onClear: () => void;
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
      <style>{`
        /* ── Shared tag styles ── */
        .ts-tag {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 10px;
          border: 1px solid;
          background: none;
          cursor: pointer;
          transition: opacity 0.12s, background 0.12s, color 0.12s;
        }
        .ts-tag:hover { opacity: 0.65; }
        .ts-tag-active {
          background: var(--navy) !important;
          color: var(--paper) !important;
          border-color: var(--navy) !important;
          opacity: 1 !important;
        }
        .ts-tag-navy { color: var(--navy); border-color: var(--navy); }
        .ts-tag-ink  { color: var(--ink);  border-color: var(--ink);  }
        .ts-tag-mid  { color: #444;        border-color: #aaa;        }

        .ts-clear-btn {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 10px;
          border: 1px solid #cc2200;
          background: none;
          color: #cc2200;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .ts-clear-btn:hover { background: #cc2200; color: var(--paper); }

        /* ── Desktop sidebar ── */
        .ts-desktop {
          display: none;
          flex-direction: column;
          gap: 0;
          width: 200px;
          flex-shrink: 0;
          position: sticky;
          top: 24px;
        }
        @media (min-width: 1024px) { .ts-desktop { display: flex; } }

        .ts-desktop-card {
          background: var(--paper);
          border: var(--rule);
          border-top: 4px solid var(--navy);
          padding: 20px 18px;
          position: relative;
        }
        .ts-desktop-card::after {
          content: '';
          position: absolute;
          bottom: -1px; right: -1px;
          width: 16px; height: 16px;
          border-bottom: 3px solid var(--navy);
          border-right: 3px solid var(--navy);
        }

        .ts-section-label {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--navy);
          font-weight: 700;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ts-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--navy);
          opacity: 0.25;
        }

        .ts-tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .ts-empty {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #aaa;
          text-transform: uppercase;
        }

        /* ── Mobile backdrop ── */
        .ts-backdrop {
          position: fixed;
          inset: 0;
          z-index: 30;
          background: rgba(0,0,0,0.45);
        }
        @media (min-width: 1024px) { .ts-backdrop { display: none !important; } }

        /* ── Mobile drawer ── */
        .ts-drawer {
          position: fixed;
          top: 0; left: 0;
          z-index: 40;
          height: 100%;
          width: 280px;
          background: var(--paper);
          border-right: var(--rule);
          transform: translateX(-100%);
          transition: transform 0.28s ease-in-out;
          display: flex;
          flex-direction: column;
        }
        .ts-drawer.ts-drawer-open { transform: translateX(0); }
        @media (min-width: 1024px) { .ts-drawer { display: none !important; } }

        .ts-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 20px;
          border-bottom: var(--rule);
        }
        .ts-drawer-title {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--navy);
        }
        .ts-drawer-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #888;
          padding: 4px;
          transition: color 0.12s;
          display: flex;
        }
        .ts-drawer-close:hover { color: var(--ink); }

        .ts-drawer-body {
          padding: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          overflow-y: auto;
        }
      `}</style>

      {/* Mobile backdrop */}
      {isOpen && (
        <div className="ts-backdrop" onClick={onClose} />
      )}

      {/* Mobile drawer */}
      <aside className={`ts-drawer ${isOpen ? "ts-drawer-open" : ""}`}>
        <div className="ts-drawer-header">
          <span className="ts-drawer-title">Filter by Tag</span>
          <button onClick={onClose} className="ts-drawer-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="ts-drawer-body">
          {activeTag && (
            <button className="ts-clear-btn" onClick={() => { onClear(); onClose(); }}>
              ✕ Clear filter
            </button>
          )}
          {popularTags.length === 0 && (
            <span className="ts-empty">No tags yet.</span>
          )}
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => { onTagClick(tag); onClose(); }}
              className={`ts-tag ${activeTag === tag ? "ts-tag-active" : tagChip(tag)}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="ts-desktop">
        <div className="ts-desktop-card">
          <p className="ts-section-label">Tags</p>
          {popularTags.length === 0 && !loading && (
            <span className="ts-empty">No tags yet.</span>
          )}
          <div className="ts-tag-list">
            {activeTag && (
              <button className="ts-clear-btn" onClick={onClear}>
                ✕ Clear
              </button>
            )}
            {popularTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className={`ts-tag ${activeTag === tag ? "ts-tag-active" : tagChip(tag)}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}