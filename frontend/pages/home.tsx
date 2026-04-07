import { useEffect, useState } from "react";
// Import from the real Header location — it uses default export and only
// accepts activePage?: string (no userInitials prop)
import Header from "@/components/submissions/Header";
import GreetingBar from "@/components/home/GreetingBar";
import RecentSubmissions from "@/components/home/RecentSubmissions";
import UpcomingDeadlines from "@/components/home/UpcomingDeadlines";
import QuickStats from "@/components/home/QuickStats";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { Assignment } from "@/services/assignments/assignments.types";
import { useAuth } from "@/hooks/useAuth";

// ── Types ────────────────────────────────────────────────────────────────────

interface Submission {
  id: string | number;
  title: string;
  language: string;
  owner_name?: string;
  created_at: string;
}

// HomeAssignment is a slim adapter over the API Assignment type.
// It flattens subject (object) → subject (string code) so UI components
// don't need to know about the Subject shape.
interface HomeAssignment {
  id: number;
  title: string;
  /** Flattened from Assignment.subject.code */
  subject: string;
  deadline: string;
  is_open: boolean;
  /** Present when the API returns student-specific submission state */
  has_submitted?: boolean;
  submission_count: number;
  professor_name: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map the API Assignment shape → the leaner HomeAssignment used by UI components */
function toHomeAssignment(a: Assignment): HomeAssignment {
  return {
    id: a.id,
    title: a.title,
    // Flatten Subject object → its code string for display
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
    // professor_name on the API is a full name string, e.g. "Hassan Nasri"
    const fullName = `${user.first_name} ${user.last_name}`.trim();
    const myAssignments = assignments.filter(
      (a) => a.professor_name === fullName
    );
    const totalCreated  = myAssignments.length;
    const totalReceived = myAssignments.reduce(
      (sum, a) => sum + (a.submission_count ?? 0),
      0
    );
    return [
      { value: totalCreated,  label: "Assignments Created",  color: "#6c47ff" },
      { value: totalReceived, label: "Submissions Received", color: "#00b894" },
    ];
  }

  // student: use has_submitted to avoid counting already-submitted open assignments
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
  // useAuth is the single source of truth — it reads from the same context
  // that the Header and ProtectedRoute already use, so role is always correct.
  const { user } = useAuth();

  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [submissionsError,   setSubmissionsError]   = useState(false);
  const [assignmentsError,   setAssignmentsError]   = useState(false);
  const [allSubmissions,     setAllSubmissions]     = useState<Submission[]>([]);
  const [rawAssignments,     setRawAssignments]     = useState<Assignment[]>([]);
  const [submissionCount,    setSubmissionCount]    = useState(0);

  useEffect(() => {
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
  }, []);

  // Derive display values from the auth user
  const role      = user?.role === "professor" ? "professor" : "student";
  const firstName = user?.first_name ?? "User";

  const homeAssignments: HomeAssignment[] = rawAssignments
    .slice(0, 3)
    .map(toHomeAssignment);

  const stats       = buildStats(user ?? null, submissionCount, rawAssignments);
  const statsLoading = submissionsLoading || assignmentsLoading;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f4ff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: "#1a2340",
      }}
    >
      {/* activePage highlights the Home link in the existing Header nav */}
      <Header activePage="Home" />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>
        <GreetingBar firstName={firstName} role={role} />

        {/* Two-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Col 1 — Recent Submissions */}
          <div
            className="bg-white rounded-2xl border border-[#e2e8f6] p-6"
            style={{ boxShadow: "0 4px 24px rgba(30,60,120,0.08)" }}
          >
            <RecentSubmissions
              submissions={allSubmissions}
              loading={submissionsLoading}
              error={submissionsError}
            />
          </div>

          {/* Col 2 — Upcoming Deadlines */}
          <div
            className="bg-white rounded-2xl border border-[#e2e8f6] p-6"
            style={{ boxShadow: "0 4px 24px rgba(30,60,120,0.08)" }}
          >
            <UpcomingDeadlines
              assignments={homeAssignments}
              loading={assignmentsLoading}
              error={assignmentsError}
            />
          </div>

        </div>

        {/* Quick Stats Bar */}
        <div
          className="bg-white rounded-2xl border border-[#e2e8f6] p-6"
          style={{ boxShadow: "0 4px 24px rgba(30,60,120,0.08)" }}
        >
          <QuickStats tiles={stats} loading={statsLoading} />
        </div>
      </main>
    </div>
  );
}

// ── Export with ProtectedRoute wrapper ───────────────────────────────────────

export default function HomePage() {
  return (
    <ProtectedRoute>
      <HomePageContent />
    </ProtectedRoute>
  );
}