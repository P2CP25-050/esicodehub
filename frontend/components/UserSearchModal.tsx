/**
 * components/UserSearchModal.tsx
 *
 * Global user search modal triggered from the Navbar.
 * Backend: GET /api/profiles/search/?q=<query>
 *
 * Exact backend response shape (from tests + serializer):
 * [
 *   {
 *     id, first_name, last_name, school_id, role,
 *     study_year,    ← from EsiStudent (null for professors)
 *     avatar,        ← data-URL or null
 *   },
 *   ...
 * ]  (max 20 results, verified users only)
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  CSSProperties,
} from "react";
import Image from "next/image";
import { useRouter } from "next/router";
import apiClient from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchUser {
  id: number;
  first_name: string;
  last_name: string;
  school_id: string;
  role: "student" | "professor";
  study_year: string | null;   // from EsiStudent; null for professors
  avatar: string | null;       // data-URL or null
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

// ─── Small avatar ─────────────────────────────────────────────────────────────

function SmallAvatar({
  firstName,
  lastName,
  avatarUrl,
  size = 42,
}: {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const gradients = [
    "linear-gradient(135deg,#667eea,#764ba2)",
    "linear-gradient(135deg,#f093fb,#f5576c)",
    "linear-gradient(135deg,#4facfe,#00f2fe)",
    "linear-gradient(135deg,#43e97b,#38f9d7)",
    "linear-gradient(135deg,#fa709a,#fee140)",
    "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    "linear-gradient(135deg,#fda085,#f6d365)",
    "linear-gradient(135deg,#1d6ef5,#1558d4)",
  ];
  const idx =
    ((firstName?.charCodeAt(0) ?? 0) + (lastName?.charCodeAt(0) ?? 0)) %
    gradients.length;

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={`${firstName} ${lastName}`}
        width={size}
        height={size}
        unoptimized
        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, display: "block" }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: gradients[idx],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 800, color: "#fff",
      flexShrink: 0, userSelect: "none",
    }}>
      {initials || "?"}
    </div>
  );
}

// ─── Search spinner ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: 16, height: 16,
      border: "2px solid rgba(29,110,245,0.2)",
      borderTopColor: "#1d6ef5",
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

  // Build compact meta line: role · study_year (if student)
  const meta = [
    isProfessor ? "Professor" : "Student",
    user.study_year ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="usm-result-row"
      style={{
        ...ms.resultRow,
        background: highlighted ? "rgba(29,110,245,0.07)" : "transparent",
      }}
      onClick={onSelect}
      role="option"
      aria-selected={highlighted}
      tabIndex={-1}
    >
      <SmallAvatar
        firstName={user.first_name}
        lastName={user.last_name}
        avatarUrl={user.avatar}
        size={42}
      />
      <div style={ms.resultInfo}>
        <span style={ms.resultName}>
          {user.first_name} {user.last_name}
        </span>
        <span style={ms.resultMeta}>{meta}</span>
      </div>
      {/* school_id shown as a badge — styled per role */}
      <span style={{
        ...ms.schoolIdBadge,
        background: isProfessor
          ? "linear-gradient(135deg,#fda085,#f6d365)"
          : "linear-gradient(135deg,#1d6ef5,#1558d4)",
      }}>
        {user.school_id}
      </span>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function UserSearchModal({ isOpen, onClose }: UserSearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  // Reset & focus on open
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setResults([]);
    setHighlightIdx(0);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Search
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) { setResults([]); setSearching(false); return; }

    setSearching(true);
    let cancelled = false;
    (async () => {
      try {
        // Backend: GET /api/profiles/search/?q=<query>
        const { data } = await apiClient.get<SearchUser[]>("/profiles/search/", {
          params: { q },
        });
        if (!cancelled) {
          // Handle both array and paginated { results: [] } shapes
          const list = Array.isArray(data)
            ? data
            : (data as { results?: SearchUser[] }).results ?? [];
          setResults(list);
          setHighlightIdx(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const navigate = useCallback(
    (user: SearchUser) => {
      router.push(`/profile/${user.school_id}`);
      onClose();
    },
    [router, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlightIdx]) navigate(results[highlightIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;
  const showEmpty = hasQuery && !searching && results.length === 0;

  return (
    <>
      <style>{MODAL_CSS}</style>

      {/* Backdrop */}
      <div
        className="usm-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className="usm-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search users"
      >
        {/* Input row */}
        <div style={ms.inputRow}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name or school ID…"
            style={ms.input}
            autoComplete="off"
            spellCheck={false}
            aria-label="Search users"
            aria-autocomplete="list"
          />
          {searching && <Spinner />}
          {hasQuery && !searching && (
            <button
              style={ms.clearBtn}
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results list */}
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
          <div style={ms.centerBlock}>
            <span style={{ fontSize: 32 }}>🔍</span>
            <p style={ms.centerText}>
              No users found for &ldquo;{debouncedQuery}&rdquo;
            </p>
          </div>
        )}

        {/* Idle hint */}
        {!hasQuery && !searching && (
          <div style={ms.hintBlock}>
            <p style={ms.hintText}>Type a name or school ID to find someone.</p>
            <div style={ms.kbdRow}>
              {[
                { keys: ["↑", "↓"], label: "Navigate" },
                { keys: ["↵"],      label: "Open" },
                { keys: ["Esc"],    label: "Close" },
              ].map(({ keys, label }) => (
                <span key={label} style={ms.kbdGroup}>
                  {keys.map((k) => <kbd key={k} style={ms.kbd}>{k}</kbd>)}
                  <span style={ms.kbdLabel}>{label}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Navbar search button ─────────────────────────────────────────────────────

/**
 * Small icon button to embed in the Header.
 * Usage in Header.tsx:
 *
 *   import { NavSearchButton } from "@/components/UserSearchModal";
 *   const [searchOpen, setSearchOpen] = useState(false);
 *   ...
 *   <NavSearchButton onClick={() => setSearchOpen(true)} />
 *   <UserSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
 */
export function NavSearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search users"
      className="usm-nav-btn"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#94a3b8",
        borderRadius: 6,
        transition: "background .15s, color .15s",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    </button>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const MODAL_CSS = `
  @keyframes usm-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes usm-backdrop-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes usm-panel-in {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.97); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  .usm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(13,27,42,0.68);
    backdrop-filter: blur(3px);
    z-index: 300;
    animation: usm-backdrop-in 0.18s ease;
  }

  .usm-panel {
    position: fixed;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    width: min(580px, calc(100vw - 24px));
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(13,27,42,0.24), 0 0 0 1px rgba(148,163,184,0.18);
    z-index: 301;
    overflow: hidden;
    animation: usm-panel-in 0.2s cubic-bezier(0.2,0,0,1);
  }

  .usm-result-row {
    cursor: pointer;
    transition: background .1s;
  }
  .usm-result-row:hover {
    background: rgba(29,110,245,0.07) !important;
  }

  .usm-nav-btn:hover {
    background: rgba(148,163,184,0.1) !important;
    color: #fff !important;
  }

  @media (max-width: 600px) {
    .usm-panel { top: 60px; }
  }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const ms: Record<string, CSSProperties> = {
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
  },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 15,
    color: "#1a2340",
    background: "transparent",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    fontWeight: 500,
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 13,
    padding: "2px 4px",
    lineHeight: 1,
    flexShrink: 0,
  },

  resultsList: {
    maxHeight: 368,
    overflowY: "auto",
    padding: "6px 0",
  },
  resultRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "11px 20px",
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  resultName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1a2340",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  resultMeta: { fontSize: 12, color: "#64748b" },
  schoolIdBadge: {
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
    letterSpacing: 0.3,
    flexShrink: 0,
    fontFamily: "monospace",
  },

  centerBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "40px 20px",
  },
  centerText: { margin: 0, fontSize: 14, color: "#94a3b8" },

  hintBlock: {
    padding: "20px 20px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
  },
  hintText: { margin: 0, fontSize: 13, color: "#94a3b8" },
  kbdRow: { display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" },
  kbdGroup: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "#94a3b8",
  },
  kbdLabel: { marginLeft: 2 },
  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 22,
    padding: "2px 5px",
    background: "#f1f5f9",
    border: "1px solid #d1d9e6",
    borderRadius: 5,
    fontSize: 11,
    fontFamily: "monospace",
    color: "#374151",
    fontStyle: "normal" as const,
  },
};