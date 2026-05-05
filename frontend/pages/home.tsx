import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/submissions/Header";
import GreetingBar from "@/components/home/GreetingBar";
import RecentSubmissions from "@/components/home/RecentSubmissions";
import UpcomingDeadlines from "@/components/home/UpcomingDeadlines";
import QuickStats from "@/components/home/QuickStats";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { Assignment } from "@/services/assignments/assignments.types";
import { useAuth } from "@/context/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

interface Submission {
  id: string | number;
  title: string;
  language: string;
  owner_name?: string;
  created_at: string;
}

interface HomeAssignment {
  id: number;
  title: string;
  subject: string;
  deadline: string;
  is_open: boolean;
  has_submitted?: boolean;
  submission_count: number;
  professor_name: string;
}

// ── CSS ──────────────────────────────────────────────────────────────────────

const HOME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:   #000000;
    --paper: #ffffff;
    --navy:  #051650;
    --rule:  1.5px solid #000;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
  }

  .hp-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal accent stripe */
  .hp-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 340px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(60px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  .hp-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* Breadcrumb */
  .hp-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .hp-breadcrumb-link {
    color: var(--navy);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
  }
  .hp-breadcrumb-sep { color: #999; }
  .hp-breadcrumb-current { color: #555; }

  /* Page header */
  .hp-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: var(--rule);
  }
  .hp-page-title {
    font-family: var(--font-display);
    font-size: 42px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 4px;
    line-height: 1.06;
    letter-spacing: -0.02em;
  }
  .hp-page-title span { color: var(--navy); }
  .hp-page-subtitle {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #666;
    margin: 0;
  }

  /* Grid layout */
  .hp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }

  /* Cards */
  .hp-card {
    background: var(--paper);
    border: var(--rule);
    padding: 28px 28px 24px;
    position: relative;
  }
  .hp-card::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 16px; height: 16px;
    border-bottom: 3px solid var(--navy);
    border-right: 3px solid var(--navy);
    pointer-events: none;
  }

  .hp-card-label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 700;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hp-card-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--navy);
    opacity: 0.2;
  }

  /* Stats card — full width */
  .hp-stats-card {
    background: var(--paper);
    border: var(--rule);
    border-top: 4px solid var(--navy);
    padding: 28px 28px 24px;
    position: relative;
  }

  @media (max-width: 900px) {
    .hp-page::before { display: none; }
    .hp-page-title { font-size: 30px; }
    .hp-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .hp-container { padding: 20px 14px 60px; }
    .hp-page-title { font-size: 26px; }
    .hp-page-header { flex-direction: column; }
    .hp-card, .hp-stats-card { padding: 20px 16px; }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function toHomeAssignment(a: Assignment): HomeAssignment {
  return {
    id: a.id,
    title: a.title,
    subject: typeof a.subject === "object" && a.subject !== null
      ? a.subject.code
      : String(a.subject ?? ""),
    deadline: a.deadline,
    is_open: a.is_open,
    submission_count: a.submission_count,
    professor_name: a.professor_name,
  };
}

function buildStats(
  user: ReturnType<typeof useAuth>["user"],
  submissionCount: number,
  assignments: Assignment[]
) {
  if (!user) return [];
  const isProfessor = user.role === "professor";
  if (isProfessor) {
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    const myAssignments = assignments.filter((a) => a.professor_name === fullName);
    const totalCreated  = myAssignments.length;
    const totalReceived = myAssignments.reduce((sum, a) => sum + (a.submission_count ?? 0), 0);
    return [
      { value: totalCreated,  label: "Assignments Created",  color: "#6c47ff" },
      { value: totalReceived, label: "Submissions Received", color: "#00b894" },
    ];
  }
  const toComplete = assignments.filter(
    (a) => a.is_open === true && (a as Assignment & { has_submitted?: boolean }).has_submitted === false
  ).length;
  return [
    { value: submissionCount, label: "My Submissions", color: "#1d6ef5" },
    { value: toComplete,      label: "To Complete",    color: "#fd9644" },
  ];
}

// ── Page Component ───────────────────────────────────────────────────────────

function HomePageContent() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [submissionsError,   setSubmissionsError]   = useState(false);
  const [assignmentsError,   setAssignmentsError]   = useState(false);
  const [allSubmissions,     setAllSubmissions]     = useState<Submission[]>([]);
  const [rawAssignments,     setRawAssignments]     = useState<Assignment[]>([]);
  const [submissionCount,    setSubmissionCount]    = useState(0);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const id = "hp-ink-styles";
      if (!document.getElementById(id)) {
        const tag = document.createElement("style");
        tag.id = id;
        tag.textContent = HOME_CSS;
        document.head.appendChild(tag);
      }
    }
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    async function fetchData() {
      const [subsResult, assignResult] = await Promise.allSettled([
        import("../services/submissions").then((m) => m.listSubmissions({ page: 1 })),
        import("../services/assignments").then((m) => m.listAssignments()),
      ]);

      if (subsResult.status === "fulfilled") {
        const data = subsResult.value;
        setAllSubmissions(Array.isArray(data?.results) ? data.results.slice(0, 3) : []);
        setSubmissionCount(data?.count ?? 0);
        setSubmissionsError(false);
      } else {
        setSubmissionsError(true);
      }
      setSubmissionsLoading(false);

      if (assignResult.status === "fulfilled") {
        const data = assignResult.value;
        const list: Assignment[] = Array.isArray(data?.results) ? data.results : [];
        const sorted = [...list].sort(
          (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
        );
        setRawAssignments(sorted);
        setAssignmentsError(false);
      } else {
        setAssignmentsError(true);
      }
      setAssignmentsLoading(false);
    }
    fetchData();
  }, [isAuthenticated, isLoading]);

  const role      = user?.role === "professor" ? "professor" : "student";
  const firstName = user?.first_name ?? "User";

  const homeAssignments: HomeAssignment[] = rawAssignments.slice(0, 3).map(toHomeAssignment);
  const stats        = buildStats(user ?? null, submissionCount, rawAssignments);
  const statsLoading = submissionsLoading || assignmentsLoading;

  return (
    <div className="hp-page">
      <Header activePage="Home" />

      <div className="hp-container">
        {/* Breadcrumb */}
        <nav className="hp-breadcrumb">
          <Link href="/" className="hp-breadcrumb-link">Home</Link>
          <span className="hp-breadcrumb-sep">/</span>
          <span className="hp-breadcrumb-current">Dashboard</span>
        </nav>

        {/* Page header */}
        <div className="hp-page-header">
          <div>
            <h1 className="hp-page-title">
              Welcome, <span>{firstName}</span>
            </h1>
            <p className="hp-page-subtitle">
              {role === "professor" ? "Professor Dashboard" : "Student Dashboard"}
            </p>
          </div>
          <GreetingBar firstName={firstName} role={role} />
        </div>

        {/* Two-column grid */}
        <div className="hp-grid">
          <div className="hp-card">
            <p className="hp-card-label">Recent Submissions</p>
            <RecentSubmissions
              submissions={allSubmissions}
              loading={submissionsLoading}
              error={submissionsError}
            />
          </div>

          <div className="hp-card">
            <p className="hp-card-label">Upcoming Deadlines</p>
            <UpcomingDeadlines
              assignments={homeAssignments}
              loading={assignmentsLoading}
              error={assignmentsError}
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="hp-stats-card">
          <p className="hp-card-label">Quick Stats</p>
          <QuickStats tiles={stats} loading={statsLoading} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomePageContent />
    </ProtectedRoute>
  );
}