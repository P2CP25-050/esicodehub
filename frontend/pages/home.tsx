import { useEffect, useState } from "react";
import Header from "@/components/submissions/Header";
import GreetingBar from "@/components/home/GreetingBar";
import RecentSubmissions from "@/components/home/RecentSubmissions";
import UpcomingDeadlines from "@/components/home/UpcomingDeadlines";
import ForumPlaceholder from "@/components/home/ForumPlaceholder";
import QuickStats from "@/components/home/QuickStats";
// Fix error 1: ProtectedRoute uses a named export, not default
import  ProtectedRoute  from "@/components/ProtectedRoute";
import type { Assignment } from "@/services/assignments/assignments.types";

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

interface User {
  id: string | number;
  first_name: string;
  last_name: string;
  role: "student" | "professor";
  initials: string;
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
  user: User,
  submissionCount: number,
  assignments: Assignment[]
) {
  if (user.role === "professor") {
  
    // Match the same pattern used in assignments/[id].tsx.
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


  // assignments are not wrongly counted as "to complete".
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
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [submissionsError, setSubmissionsError] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState(false);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [user, setUser] = useState<User>({
    id: "1",
    first_name: "User",
    last_name: "",
    role: "student",
    initials: "U",
  });

  useEffect(() => {
    // Import services dynamically to match the project structure
    async function fetchData() {
      const [subsResult, assignResult] = await Promise.allSettled([
        import("../services/submissions").then((m) => m.listSubmissions({ page: 1 })),
        import("../services/assignments").then((m) => m.listAssignments()),
      ]);

      // Submissions
      if (subsResult.status === "fulfilled") {
        const data = subsResult.value;
        setAllSubmissions(Array.isArray(data?.results) ? data.results.slice(0, 3) : []);
        setSubmissionCount(data?.count ?? 0);
        setSubmissionsError(false);
      } else {
        setSubmissionsError(true);
      }
      setSubmissionsLoading(false);

      // Assignments
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

    async function loadUser() {
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);

        
          // the ?? fallback won't fire. Trim and fall back to "U" explicitly.
          const firstName: string = (parsed.first_name ?? parsed.name ?? "").trim() || "U";
          const lastName: string  = (parsed.last_name  ?? "").trim();

          // Only index [0] after we know the string is non-empty
          const initials =
            firstName[0].toUpperCase() +
            (lastName.length > 0 ? lastName[0].toUpperCase() : "");

          setUser({
            id:         parsed.id ?? "1",
            first_name: firstName,
            last_name:  lastName,
            role:       parsed.role === "professor" ? "professor" : "student",
            initials,
          });
        }
      } catch {
        // keep default user
      }
    }

    loadUser();
    fetchData();
  }, []);

  // Map raw API assignments → slim HomeAssignment, take first 3 for display
  const homeAssignments: HomeAssignment[] = rawAssignments
    .slice(0, 3)
    .map(toHomeAssignment);

  const stats = buildStats(user, submissionCount, rawAssignments);
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
      {/* 
          the avatar through another mechanism. */}
      <Header activePage="Home" userInitials={user.initials} />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Greeting bar */}
        <GreetingBar firstName={user.first_name} role={user.role} />

        {/* Three-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              role={user.role}
            />
          </div>

          {/* Col 3 — Forum Placeholder */}
          <div
            className="bg-white rounded-2xl border border-[#e2e8f6] p-6"
            style={{ boxShadow: "0 4px 24px rgba(30,60,120,0.08)" }}
          >
            <ForumPlaceholder />
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