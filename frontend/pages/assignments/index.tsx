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

// ── Design system — Ink & Paper ───────────────────────────────────────────────

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:          #000000;
    --paper:        #ffffff;
    --navy:         #051650;
    --rule:         1.5px solid #000;
    --surface:      #f7f7f5;
    --surface-2:    #f0efec;
    --border-soft:  #e0e0e0;
    --text-sub:     #444444;
    --text-muted:   #666666;
    --red:          #cc0000;
    --green:        #1a7a3c;
    --orange:       #b85c00;
    --blue:         #1a4fa8;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
    --radius:       0px;
    --radius-lg:    0px;
    --shadow:       none;
    --shadow-hover: none;
  }

  .ap-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal navy stripe */
  .ap-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 280px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  .ap-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* Breadcrumb */
  .ap-breadcrumb {
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono); font-size: 10px;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-muted);
  }
  .ap-breadcrumb-link {
    color: var(--navy); font-weight: 700; text-decoration: none;
    border-bottom: 1.5px solid var(--navy); padding-bottom: 1px;
    transition: opacity 0.15s;
  }
  .ap-breadcrumb-link:hover { opacity: 0.65; }
  .ap-breadcrumb-sep { color: #aaa; }

  /* Page header */
  .ap-page-header {
    display: flex; flex-wrap: wrap;
    align-items: flex-end; justify-content: space-between;
    gap: 16px; padding-bottom: 28px;
    border-bottom: var(--rule); margin-bottom: 28px;
  }
  .ap-page-title {
    font-family: var(--font-display); font-size: 40px;
    font-weight: 900; color: var(--ink);
    margin: 0 0 6px; line-height: 1.05; letter-spacing: -0.02em;
  }
  .ap-page-title span { color: var(--navy); }
  .ap-page-subtitle {
    font-family: var(--font-mono); font-size: 9.5px;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--text-muted); font-weight: 700; margin: 0;
  }

  /* Controls */
  .ap-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 28px; }
  .ap-search-wrap { position: relative; flex: 1; min-width: 200px; }
  .ap-search-icon {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: var(--text-muted); pointer-events: none;
  }
  .ap-search-input {
    width: 100%; padding: 11px 14px 11px 38px;
    background: var(--paper); border: var(--rule);
    color: var(--ink);
    font-family: var(--font-body); font-size: 13px;
    outline: none; box-sizing: border-box;
    transition: box-shadow 0.15s;
  }
  .ap-search-input::placeholder { color: #aaa; }
  .ap-search-input:focus { box-shadow: 3px 3px 0 var(--navy); border-color: var(--navy); }

  .ap-select {
    padding: 11px 36px 11px 14px; background: var(--paper);
    border: var(--rule);
    color: var(--ink); font-family: var(--font-body); font-size: 13px;
    outline: none; cursor: pointer; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23000' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .ap-select:focus { box-shadow: 3px 3px 0 var(--navy); border-color: var(--navy); }

  .ap-cta-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 22px; background: var(--navy); color: var(--paper);
    border: 1.5px solid var(--navy);
    font-family: var(--font-mono); font-size: 11px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
    transition: background 0.15s, box-shadow 0.12s, transform 0.1s;
    white-space: nowrap;
  }
  .ap-cta-btn:hover { background: var(--ink); border-color: var(--ink); box-shadow: 4px 4px 0 var(--navy); transform: translate(-2px, -2px); }
  .ap-cta-btn:active { transform: translate(0,0); box-shadow: none; }

  /* Error banner */
  .ap-error-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    margin-bottom: 20px; padding: 14px 18px;
    background: #fff0f0; border: 1.5px solid var(--red); border-left: 5px solid var(--red);
    color: var(--red);
    font-size: 13px; font-family: var(--font-body);
  }
  .ap-error-retry {
    flex-shrink: 0; padding: 6px 14px;
    border: 1.5px solid var(--red); background: transparent;
    color: var(--red); font-family: var(--font-mono);
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    text-transform: uppercase; cursor: pointer; transition: background 0.15s;
  }
  .ap-error-retry:hover { background: rgba(204,0,0,0.08); }

  /* Grid */
  .ap-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

  /* Animations */
  @keyframes ap-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ap-animate { opacity: 0; animation: ap-fade-up 0.4s ease forwards; }
  .ap-animate-1 { animation-delay: 0.04s; }
  .ap-animate-2 { animation-delay: 0.10s; }
  .ap-animate-3 { animation-delay: 0.17s; }

  @media (max-width: 960px)  { .ap-grid { grid-template-columns: repeat(2, 1fr); } .ap-page-title { font-size: 30px; } .ap-page::before { display: none; } }
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
    const id = "ap-ink-styles";
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
          <span className="ap-breadcrumb-sep">/</span>
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