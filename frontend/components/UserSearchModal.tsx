import {
  useState,
  useEffect,
  useRef,
  useCallback,
  CSSProperties,
} from "react";
import { useRouter } from "next/router";
import apiClient from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by GET /api/profiles/search/?q=
 * Matches ProfileSearchResultSerializer exactly:
 *   school_id, name (full name via get_name), role, study_year
 * Note: avatar IS returned by the serializer but we intentionally don't render
 * it here (data-URLs are large; search should be fast and lightweight).
 */
export interface SearchUser {
  school_id: string;
  name: string;         // get_name() → "{first_name} {last_name}"
  role: "student" | "professor";
  study_year: string | null;
}

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Initials avatar ──────────────────────────────────────────────────────────

function LetterBubble({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const first = parts[0] ?? "";
  const last  = parts[parts.length - 1] ?? "";
  const initials = `${first[0] ?? ""}${parts.length > 1 ? last[0] ?? "" : ""}`.toUpperCase();
  const idx = ((first.charCodeAt(0) ?? 0) + (last.charCodeAt(0) ?? 0)) % 2;
  const bg = idx === 0 ? "#051650" : "#000000";
  return (
    <div style={{
      width: 36, height: 36,
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 900,
      fontFamily: "'Playfair Display', Georgia, serif",
      color: "#fff",
      flexShrink: 0, userSelect: "none",
      letterSpacing: 1,
      border: "1.5px solid #000",
    }}>
      {initials || "?"}
    </div>
  );
}

// ─── Search spinner ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 14, height: 14,
      border: "2px solid #e0e0e0",
      borderTopColor: "#051650",
      borderRadius: "50%",
      animation: "usm-spin 0.65s linear infinite",
      flexShrink: 0,
    }} />
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({
  user,
  highlighted,
  onSelect,
}: {
  user: SearchUser;
  highlighted: boolean;
  onSelect: () => void;
}) {
  const isProfessor = user.role === "professor";

  const meta = [
    isProfessor ? "Professor" : "Student",
    user.study_year,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className="usm-row"
      style={{
        ...ms.row,
        background: highlighted ? "#f7f7f5" : "transparent",
        borderLeft: highlighted ? "3px solid #051650" : "3px solid transparent",
      }}
      onClick={onSelect}
      role="option"
      aria-selected={highlighted}
      tabIndex={-1}
    >
      <LetterBubble name={user.name} />

      <div style={ms.rowInfo}>
        <span style={ms.rowName}>{user.name}</span>
        <span style={ms.rowMeta}>{meta}</span>
      </div>

      {!isProfessor && (
        <span style={{
          ...ms.schoolIdPill,
          background: "#000",
          color: "#fff",
          border: "1.5px solid #000",
        }}>
          {user.school_id}
        </span>
      )}

      {isProfessor && (
        <span style={{
          ...ms.schoolIdPill,
          background: "#051650",
          color: "#fff",
          border: "1.5px solid #051650",
        }}>
          Prof
        </span>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function UserSearchModal({ isOpen, onClose }: UserSearchModalProps) {
  const router = useRouter();
  const [query,        setQuery]      = useState("");
  const [results,      setResults]    = useState<SearchUser[]>([]);
  const [searching,    setSearching]  = useState(false);
  const [highlightIdx, setHighlight]  = useState(0);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debouncedQ  = useDebounce(query, 300);

  // Reset + focus
  useEffect(() => {
    if (!isOpen) return;
    setQuery(""); setResults([]); setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Search
  useEffect(() => {
    const q = debouncedQ.trim();
    if (!q) { setResults([]); setSearching(false); return; }

    setSearching(true);
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get<SearchUser[] | { results: SearchUser[] }>(
          "/profiles/search/",
          { params: { q } }
        );
        if (!cancelled) {
          const list = Array.isArray(data) ? data : (data as { results: SearchUser[] }).results ?? [];
          setResults(list);
          setHighlight(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQ]);

  const navigate = useCallback((user: SearchUser) => {
    router.push({
      pathname: '/profile/[...school_id]',
      query: { school_id: user.school_id.split('/') },
    });
    onClose();
  }, [router, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if      (e.key === "ArrowDown") { e.preventDefault(); setHighlight((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setHighlight((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (results[highlightIdx]) navigate(results[highlightIdx]); }
    else if (e.key === "Escape")    { onClose(); }
  };

  if (!isOpen) return null;

  const hasQuery  = query.trim().length > 0;
  const showEmpty = hasQuery && !searching && results.length === 0;

  return (
    <>
      <style>{MODAL_CSS}</style>

      {/* Backdrop */}
      <div className="usm-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="usm-panel" role="dialog" aria-modal="true" aria-label="Search users">

        {/* Header rule */}
        <div style={ms.panelHeader}>
          <span style={ms.panelLabel}></span>
          {searching && <Spinner />}
        </div>

        {/* Input row */}
        <div style={ms.inputRow}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name or student ID…"
            style={ms.input}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search users"
            aria-autocomplete="list"
          />
          {hasQuery && !searching && (
            <button
              style={ms.clearBtn}
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              aria-label="Clear"
            >✕</button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div style={ms.resultsList} role="listbox">
            {results.map((user, idx) => (
              <ResultRow
                key={user.id}
                user={user}
                highlighted={idx === highlightIdx}
                onSelect={() => navigate(user)}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {showEmpty && (
          <div style={ms.centreBlock}>
            <span style={{ fontSize: 28 }}>—</span>
            <p style={ms.centreText}>No users found for &ldquo;{debouncedQ}&rdquo;</p>
          </div>
        )}

        {/* Idle hint */}
        {!hasQuery && !searching && (
          <div style={ms.hintBlock}>
            <p style={ms.hintText}>Search by name or student ID — e.g. &ldquo;Amine&rdquo; or &ldquo;23/0145&rdquo;</p>
            <div style={ms.kbdRow}>
              {[["↑↓","Navigate"],["↵","Open"],["Esc","Close"]].map(([keys, lbl]) => (
                <span key={lbl} style={ms.kbdGroup}>
                  <kbd style={ms.kbd}>{keys}</kbd>
                  <span style={{ color: "#666", fontSize: 11, fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em" }}>{lbl}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Nav search button (exported for Header.tsx) ──────────────────────────────

export function NavSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search users"
      className="usm-nav-btn"
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: "8px", display: "flex", alignItems: "center", justifyContent: "center",
        color: "#666", borderRadius: 0, transition: "background .15s, color .15s",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    </button>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const MODAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  @keyframes usm-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes usm-bd {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes usm-panel {
    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .usm-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    z-index: 400;
    animation: usm-bd 0.18s ease;
  }
  .usm-panel {
    position: fixed;
    top: 72px; left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100vw - 24px));
    background: #ffffff;
    border: 1.5px solid #000;
    border-top: 4px solid #051650;
    z-index: 401;
    overflow: hidden;
    animation: usm-panel 0.2s cubic-bezier(0.2,0,0,1);
    /* Corner tick mark */
    position: fixed;
  }
  .usm-panel::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 16px; height: 16px;
    border-bottom: 3px solid #051650;
    border-right: 3px solid #051650;
    pointer-events: none;
  }
  .usm-row {
    cursor: pointer;
    transition: background .1s, border-left-color .1s;
  }
  .usm-row:hover {
    background: #f7f7f5 !important;
    border-left: 3px solid #051650 !important;
  }
  .usm-nav-btn:hover {
    background: rgba(255,255,255,0.08) !important;
    color: #fff !important;
  }
  @media (max-width: 600px) {
    .usm-panel { top: 60px; }
  }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const ms: Record<string, CSSProperties> = {
  panelHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 18px 8px",
    borderBottom: "1px solid #e0e0e0",
    background: "#f7f7f5",
  },
  panelLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    color: "#444",
  },

  inputRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 18px",
    borderBottom: "1.5px solid #000",
  },
  input: {
    flex: 1, border: "none", outline: "none",
    fontSize: 15, color: "#000", background: "transparent",
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
  },
  clearBtn: {
    background: "none", border: "none", color: "#666",
    cursor: "pointer", fontSize: 12, padding: "2px 4px",
    lineHeight: 1, flexShrink: 0,
    fontFamily: "'Space Mono', monospace",
  },

  resultsList: { maxHeight: 360, overflowY: "auto", padding: "4px 0" },

  row: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "11px 18px",
    borderBottom: "1px solid #f0efec",
    transition: "background .1s",
  },
  rowInfo: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 },
  rowName: {
    fontSize: 14, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  rowMeta: {
    fontSize: 11, color: "#666",
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.06em",
  },
  schoolIdPill: {
    padding: "3px 9px",
    fontSize: 10, fontWeight: 700, flexShrink: 0,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.1em",
  },

  centreBlock: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 10, padding: "40px 20px",
    borderTop: "1px solid #e0e0e0",
  },
  centreText: {
    margin: 0, fontSize: 13,
    fontFamily: "'Space Mono', monospace",
    color: "#666", letterSpacing: "0.06em",
  },

  hintBlock: {
    padding: "18px 18px 22px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
    borderTop: "1px solid #e0e0e0",
    background: "#f7f7f5",
  },
  hintText: {
    margin: 0, fontSize: 11,
    fontFamily: "'Space Mono', monospace",
    color: "#666", letterSpacing: "0.06em",
    textAlign: "center" as const,
  },
  kbdRow: { display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" },
  kbdGroup: { display: "flex", alignItems: "center", gap: 6 },
  kbd: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "3px 7px",
    background: "#fff",
    border: "1.5px solid #000",
    fontSize: 11,
    fontFamily: "'Space Mono', monospace",
    color: "#000",
    fontStyle: "normal" as const,
    letterSpacing: "0.04em",
  },
};
