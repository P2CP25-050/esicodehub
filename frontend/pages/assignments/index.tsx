import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";

import StudentAssignmentCard from "@/components/assignments/StudentAssignmentCard";
import ProfessorAssignmentCard from "@/components/assignments/ProfessorAssignmentCard";
import AssignmentsSkeleton from "@/components/assignments/AssignmentsSkeleton";
import EmptyState from "@/components/assignments/EmptyState";
import { extractGroups } from "@/components/assignments/utils";

import { useAssignments } from "@/hooks/useAssignments";

// ── Design system CSS (mirrors home.tsx tokens) ───────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --bg:             #0d1117;
    --surface:        #161b22;
    --surface-2:      #21262d;
    --border:         #30363d;
    --border-light:   #21262d;
    --accent:         #e6c97a;
    --accent-dim:     rgba(230,201,122,0.12);
    --blue:           #58a6ff;
    --blue-dim:       rgba(88,166,255,0.12);
    --orange:         #f0883e;
    --green:          #3fb950;
    --red:            #f85149;
    --text-primary:   #e6edf3;
    --text-secondary: #8b949e;
    --text-muted:     #484f58;
    --font-display:   'Lora', Georgia, serif;
    --font-mono:      'IBM Plex Mono', monospace;
    --font-body:      'DM Sans', sans-serif;
    --radius:         10px;
    --radius-lg:      16px;
    --shadow:         0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3);
    --shadow-hover:   0 4px 8px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.4);
  }

  .ap-page {
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--font-body);
    color: var(--text-primary);
    position: relative;
  }
  .ap-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }
  .ap-page::after {
    content: '';
    position: fixed;
    top: -160px; left: 50%;
    transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(ellipse, rgba(230,201,122,0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .ap-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* Breadcrumb */
  .ap-breadcrumb {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 32px;
    font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.1em; color: var(--text-muted);
  }
  .ap-breadcrumb-link { color: var(--accent); text-decoration: none; transition: opacity 0.15s; }
  .ap-breadcrumb-link:hover { opacity: 0.75; }

  /* Page header */
  .ap-page-header {
    display: flex; flex-wrap: wrap;
    align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 28px;
    border-bottom: 1px solid var(--border); margin-bottom: 28px;
  }
  .ap-page-title {
    font-family: var(--font-display); font-size: 36px;
    font-weight: 700; color: var(--text-primary);
    margin: 0 0 6px; line-height: 1.1; letter-spacing: -0.01em;
  }
  .ap-page-title span { color: var(--accent); }
  .ap-page-subtitle {
    font-family: var(--font-mono); font-size: 11px;
    letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--text-secondary); margin: 0;
  }

  /* Controls */
  .ap-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
  .ap-search-wrap { position: relative; flex: 1; min-width: 200px; }
  .ap-search-icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: var(--text-muted); pointer-events: none;
  }
  .ap-search-input {
    width: 100%; padding: 10px 14px 10px 38px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); color: var(--text-primary);
    font-family: var(--font-body); font-size: 13px;
    outline: none; box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .ap-search-input::placeholder { color: var(--text-muted); }
  .ap-search-input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(88,166,255,0.1); }

  .ap-select {
    padding: 10px 36px 10px 14px; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius);
    color: var(--text-primary); font-family: var(--font-body); font-size: 13px;
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b949e' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    transition: border-color 0.15s;
  }
  .ap-select:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(88,166,255,0.1); }

  .ap-cta-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 20px; background: var(--accent); color: #0d1117;
    border: none; border-radius: var(--radius);
    font-family: var(--font-mono); font-size: 12px; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.15s;
    box-shadow: 0 4px 14px rgba(230,201,122,0.3); white-space: nowrap;
  }
  .ap-cta-btn:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(230,201,122,0.4); }
  .ap-cta-btn:active { transform: scale(0.97); }

  /* Error banner */
  .ap-error-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    margin-bottom: 20px; padding: 12px 16px;
    background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3);
    border-radius: var(--radius); color: var(--red);
    font-size: 13px; font-family: var(--font-body);
  }
  .ap-error-retry {
    flex-shrink: 0; padding: 4px 12px; border-radius: 6px;
    border: 1px solid rgba(248,81,73,0.4); background: transparent;
    color: var(--red); font-family: var(--font-mono);
    font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.15s;
  }
  .ap-error-retry:hover { background: rgba(248,81,73,0.15); }

  /* Grid */
  .ap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

  /* Animations */
  @keyframes ap-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ap-animate { opacity: 0; animation: ap-fade-up 0.4s ease forwards; }
  .ap-animate-1 { animation-delay: 0.05s; }
  .ap-animate-2 { animation-delay: 0.12s; }
  .ap-animate-3 { animation-delay: 0.19s; }

  @media (max-width: 960px)  { .ap-grid { grid-template-columns: repeat(2, 1fr); } .ap-page-title { font-size: 28px; } }
  @media (max-width: 620px)  { .ap-container { padding: 20px 16px 60px; } .ap-grid { grid-template-columns: 1fr; } .ap-page-title { font-size: 24px; } }
`;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  return (
    <ProtectedRoute>
      <AssignmentsContent />
    </ProtectedRoute>
  );
}

function AssignmentsContent() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "ap-dark-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = PAGE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

  const isProfessor = user?.role === "professor";
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  const { assignments, loading, error, refetch } = useAssignments(
    isProfessor ? selectedGroup : undefined
  );

  const availableGroups = useMemo(() => extractGroups(assignments), [assignments]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subject.code.toLowerCase().includes(q) ||
        a.subject.name.toLowerCase().includes(q) ||
        a.professor_name.toLowerCase().includes(q)
    );
  }, [assignments, searchQuery]);

  const count = filtered.length;

  return (
    <div className="ap-page">
      <Header activePage="Assignments" />

      <div className="ap-container">
        {/* Breadcrumb */}
        <nav className="ap-breadcrumb ap-animate ap-animate-1">
          <Link href="/" className="ap-breadcrumb-link">~/home</Link>
          <span>/</span>
          <span>assignments</span>
        </nav>

        {/* Page header */}
        <div className="ap-page-header ap-animate ap-animate-1">
          <div>
            <h1 className="ap-page-title">
              {isProfessor ? <>My <span>Assignments</span></> : <><span>Assignments</span></>}
            </h1>
            <p className="ap-page-subtitle">
              {isProfessor
                ? `${count} assignment${count !== 1 ? "s" : ""} posted`
                : `${count} assignment${count !== 1 ? "s" : ""} for you`}
            </p>
          </div>

          {isProfessor && (
            <button className="ap-cta-btn" onClick={() => router.push("/assignments/new")}>
              <span style={{ fontSize: 16 }}>+</span> Create Assignment
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="ap-controls ap-animate ap-animate-2">
          <div className="ap-search-wrap">
            <svg className="ap-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="ap-search-input"
              placeholder="Search by title, subject or professor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {isProfessor && availableGroups.length > 0 && (
            <select
              className="ap-select"
              value={selectedGroup ?? ""}
              onChange={(e) => setSelectedGroup(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="">All groups</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>Group {g}</option>
              ))}
            </select>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="ap-error-banner">
            <span>⚠ {error}</span>
            <button className="ap-error-retry" onClick={refetch}>Retry</button>
          </div>
        )}

        {/* Cards grid */}
        <div className="ap-grid ap-animate ap-animate-3">
          {loading ? (
            <AssignmentsSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState role={isProfessor ? "professor" : "student"} />
          ) : isProfessor ? (
            filtered.map((a) => <ProfessorAssignmentCard key={a.id} assignment={a} />)
          ) : (
            filtered.map((a) => <StudentAssignmentCard key={a.id} assignment={a} />)
          )}
        </div>
      </div>
    </div>
  );
}
