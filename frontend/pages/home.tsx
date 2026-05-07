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

// ── Global Design Tokens (shared with all child components via CSS vars) ──────

const HOME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  /* ── Design tokens ── */
  :root {
    --bg:           #0d1117;
    --surface:      #161b22;
    --surface-2:    #21262d;
    --border:       #30363d;
    --border-light: #21262d;
    --accent:       #e6c97a;
    --accent-dim:   rgba(230,201,122,0.12);
    --accent-glow:  rgba(230,201,122,0.25);
    --blue:         #58a6ff;
    --blue-dim:     rgba(88,166,255,0.12);
    --orange:       #f0883e;
    --green:        #3fb950;
    --red:          #f85149;
    --text-primary: #e6edf3;
    --text-secondary: #8b949e;
    --text-muted:   #484f58;
    --font-display: 'Lora', Georgia, serif;
    --font-mono:    'IBM Plex Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
    --radius:       10px;
    --radius-lg:    16px;
    --shadow:       0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3);
    --shadow-hover: 0 4px 8px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.4);
  }

  /* ── Page shell ── */
  .hp-page {
    min-height: 100vh;
    background: var(--bg);
    font-family: var(--font-body);
    color: var(--text-primary);
    position: relative;
  }

  /* Subtle grid texture */
  .hp-page::before {
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

  /* Ambient glow at top */
  .hp-page::after {
    content: '';
    position: fixed;
    top: -160px; left: 50%;
    transform: translateX(-50%);
    width: 600px; height: 400px;
    background: radial-gradient(ellipse at center, rgba(230,201,122,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .hp-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* ── Breadcrumb ── */
  .hp-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--text-muted);
  }
  .hp-breadcrumb-link {
    color: var(--accent);
    text-decoration: none;
    transition: opacity 0.15s;
  }
  .hp-breadcrumb-link:hover { opacity: 0.75; }
  .hp-breadcrumb-sep { color: var(--text-muted); }

  /* ── Page header ── */
  .hp-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 0;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--border);
  }
  .hp-page-title {
    font-family: var(--font-display);
    font-size: 40px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 6px;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .hp-page-title span {
    color: var(--accent);
  }
  .hp-page-subtitle {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin: 0;
  }

  /* ── Greeting bar wrapper ── */
  .hp-greeting-wrap {
    padding: 20px 0 28px;
    border-bottom: 1px solid var(--border-light);
    margin-bottom: 24px;
  }

  /* ── Two-column grid ── */
  .hp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }

  /* ── Cards ── */
  .hp-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow);
    position: relative;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .hp-card:hover {
    border-color: var(--border-light);
    box-shadow: var(--shadow-hover);
  }

  /* Accent top border */
  .hp-card-submissions { border-top: 2px solid var(--blue); }
  .hp-card-deadlines   { border-top: 2px solid var(--orange); }

  /* Section label */
  .hp-card-label {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .hp-card-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Stats card ── */
  .hp-stats-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-top: 2px solid var(--accent);
    border-radius: var(--radius-lg);
    padding: 24px;
    box-shadow: var(--shadow);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .hp-grid { grid-template-columns: 1fr; }
    .hp-page-title { font-size: 30px; }
  }
  @media (max-width: 600px) {
    .hp-container { padding: 20px 16px 60px; }
    .hp-page-title { font-size: 26px; }
    .hp-card { padding: 18px; }
    .hp-stats-card { padding: 18px; }
  }

  /* ── Fade-in animation ── */
  @keyframes hp-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hp-animate {
    opacity: 0;
    animation: hp-fade-up 0.45s ease forwards;
  }
  .hp-animate-1 { animation-delay: 0.05s; }
  .hp-animate-2 { animation-delay: 0.12s; }
  .hp-animate-3 { animation-delay: 0.19s; }
  .hp-animate-4 { animation-delay: 0.26s; }
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
      { value: totalCreated,  label: "Assignments Created",  color: "var(--accent)" },
      { value: totalReceived, label: "Submissions Received", color: "var(--green)" },
    ];
  }
  const toComplete = assignments.filter(
    (a) => a.is_open === true && (a as Assignment & { has_submitted?: boolean }).has_submitted === false
  ).length;
  return [
    { value: submissionCount, label: "My Submissions", color: "var(--blue)" },
    { value: toComplete,      label: "To Complete",    color: "var(--orange)" },
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
        <nav className="hp-breadcrumb hp-animate hp-animate-1">
          <Link href="/" className="hp-breadcrumb-link">~/home</Link>
          <span className="hp-breadcrumb-sep">/</span>
          <span>dashboard</span>
        </nav>

        {/* Page header */}
        <div className="hp-page-header hp-animate hp-animate-1">
          <div>
            <h1 className="hp-page-title">
              Welcome, <span>{firstName}</span>
            </h1>
            <p className="hp-page-subtitle">
              {role === "professor" ? "Professor Dashboard" : "Student Dashboard"}
            </p>
          </div>
        </div>

        {/* Greeting / action bar */}
        <div className="hp-greeting-wrap hp-animate hp-animate-2">
          <GreetingBar firstName={firstName} role={role} />
        </div>

        {/* Two-column grid */}
        <div className="hp-grid hp-animate hp-animate-3">
          <div className="hp-card hp-card-submissions">
            <RecentSubmissions
              submissions={allSubmissions}
              loading={submissionsLoading}
              error={submissionsError}
            />
          </div>

          <div className="hp-card hp-card-deadlines">
            <UpcomingDeadlines
              assignments={homeAssignments}
              loading={assignmentsLoading}
              error={assignmentsError}
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="hp-stats-card hp-animate hp-animate-4">
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