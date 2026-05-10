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

// ── Global Design Tokens — Ink & Paper ───────────────────────────────────────

const HOME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:          #000000;
    --paper:        #ffffff;
    --navy:         #051650;
    --rule:         1.5px solid #000;
    --border-soft:  1px solid #e0e0e0;
    --surface:      #f7f7f5;
    --surface-2:    #f0efec;
    --text-muted:   #666666;
    --text-sub:     #444444;
    --red:          #cc0000;
    --green:        #1a7a3c;
    --orange:       #b85c00;
    --blue:         #1a4fa8;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
    --radius:       0px;
    --radius-lg:    0px;
  }

  /* ── Page shell ── */
  .hp-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal navy stripe on the right */
  .hp-page::before {
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

  /* Horizontal rule near top */
  .hp-page::after {
    content: '';
    position: fixed;
    top: 64px; left: 0; right: 0;
    height: 1.5px;
    background: var(--ink);
    z-index: 0;
    pointer-events: none;
  }

  /* ── Container ── */
  .hp-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* ── Breadcrumb ── */
  .hp-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .hp-breadcrumb-link {
    color: var(--navy);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
    transition: opacity 0.15s;
  }
  .hp-breadcrumb-link:hover { opacity: 0.65; }
  .hp-breadcrumb-sep { color: #aaa; }

  /* ── Page header ── */
  .hp-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 28px;
    border-bottom: var(--rule);
    margin-bottom: 0;
  }
  .hp-page-title {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 6px;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .hp-page-title span { color: var(--navy); }
  .hp-page-subtitle {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    margin: 0;
  }

  /* ── Greeting bar wrapper ── */
  .hp-greeting-wrap {
    padding: 22px 0 28px;
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 28px;
  }

  /* ── Two-column grid ── */
  .hp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }

  /* ── Cards ── */
  .hp-card {
    background: var(--paper);
    border: var(--rule);
    padding: 28px;
    position: relative;
    overflow: hidden;
  }

  /* Corner tick marks */
  .hp-card::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 20px; height: 20px;
    border-bottom: 3px solid var(--navy);
    border-right: 3px solid var(--navy);
  }

  /* Top accent border per card */
  .hp-card-submissions { border-top: 4px solid var(--navy); }
  .hp-card-deadlines   { border-top: 4px solid var(--ink); }

  /* ── Stats card ── */
  .hp-stats-card {
    background: var(--paper);
    border: var(--rule);
    border-top: 4px solid var(--navy);
    padding: 28px;
    position: relative;
  }
  .hp-stats-card::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 20px; height: 20px;
    border-bottom: 3px solid var(--navy);
    border-right: 3px solid var(--navy);
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .hp-grid { grid-template-columns: 1fr; }
    .hp-page-title { font-size: 32px; }
    .hp-page::before { display: none; }
  }
  @media (max-width: 600px) {
    .hp-container { padding: 20px 16px 60px; }
    .hp-page-title { font-size: 26px; }
    .hp-card { padding: 20px; }
    .hp-stats-card { padding: 20px; }
  }

  /* ── Fade-in animation ── */
  @keyframes hp-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .hp-animate {
    opacity: 0;
    animation: hp-fade-up 0.4s ease forwards;
  }
  .hp-animate-1 { animation-delay: 0.04s; }
  .hp-animate-2 { animation-delay: 0.10s; }
  .hp-animate-3 { animation-delay: 0.17s; }
  .hp-animate-4 { animation-delay: 0.24s; }
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
      { value: totalCreated,  label: "Assignments Created",  color: "var(--navy)" },
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
        import("../services/submissions").then((m) => m.listSubmissions({ page: 1, mine: true })),
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
  <div className="hp-header-actions">
    <GreetingBar role={role} />
  </div>
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
              role={role}
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