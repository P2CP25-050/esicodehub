import Link from "next/link";
import { useState, useEffect } from "react";
import SkeletonCard from "./SkeletonCard";

const SUBJECT_COLORS: string[] = [
  "#051650", "#1a4fa8", "#1a7a3c", "#b85c00", "#7a1a1a", "#2b7489",
];

interface Assignment {
  id: string | number;
  title: string;
  subject?: string;
  deadline: string;
  is_open?: boolean;
  has_submitted?: boolean;
  submission_count?: number;
}

interface UpcomingDeadlinesProps {
  assignments: Assignment[];
  loading: boolean;
  error: boolean;
  role?: "student" | "professor";
}

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Countdown({ deadline }: { deadline: string }) {
  const now  = useNow(60000);
  const diff = new Date(deadline).getTime() - now;

  if (diff <= 0) {
    return (
      <span style={{
        fontSize: "9px",
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--red)",
        background: "#fff0f0",
        border: "1.5px solid var(--red)",
        padding: "2px 8px",
      }}>
        Expired
      </span>
    );
  }

  const totalMins = Math.floor(diff / 60000);
  const days      = Math.floor(totalMins / 1440);
  const hours     = Math.floor((totalMins % 1440) / 60);

  let color  = "var(--green)";
  let bg     = "#f0fff4";
  let border = "var(--green)";
  if (diff < 24 * 60 * 60 * 1000) {
    color = "var(--red)";   bg = "#fff0f0"; border = "var(--red)";
  } else if (diff < 3 * 24 * 60 * 60 * 1000) {
    color = "var(--orange)"; bg = "#fff8f0"; border = "var(--orange)";
  }

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontSize: "9px",
      fontWeight: 700,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color,
      background: bg,
      border: `1.5px solid ${border}`,
      padding: "2px 8px",
      flexShrink: 0,
    }}>
       {days}d {hours}h
    </span>
  );
}

function AssignmentCard({ assignment, idx, role }: { assignment: Assignment; idx: number; role?: string }) {
  const subjectColor = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  const href = role === "professor"
    ? `/assignments/${assignment.id}`
    : `/assignments/${assignment.id}`;
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block" }}>
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid #d0d0d0",
        borderLeft: `3px solid ${subjectColor}`,
        padding: "14px 16px",
        transition: "box-shadow 0.15s, transform 0.1s",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = `4px 4px 0 ${subjectColor}`;
        el.style.transform = "translate(-2px, -2px)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "translate(0, 0)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
        {assignment.subject && (
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            fontSize: "9px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: subjectColor,
            color: "#ffffff",
            flexShrink: 0,
          }}>
            {assignment.subject}
          </span>
        )}
        <Countdown deadline={assignment.deadline} />
      </div>

      <h3 style={{
        color: "var(--ink)",
        fontWeight: 600,
        fontSize: "13px",
        margin: "0 0 6px",
        lineHeight: 1.4,
        fontFamily: "var(--font-body)",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}>
        {assignment.title}
      </h3>

      <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
        Due {new Date(assignment.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
    </Link>
  );
}

export default function UpcomingDeadlines({ assignments, loading, error, role }: UpcomingDeadlinesProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
        <div style={{ width: "3px", height: "18px", background: "var(--ink)", flexShrink: 0 }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--ink)",
        }}>
          Upcoming Deadlines
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--ink)", opacity: 0.15 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: "12px", color: "var(--red)", textAlign: "center", fontFamily: "var(--font-mono)" }}>
              Failed to load assignments.
            </p>
          </div>
        ) : assignments.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "32px 24px", borderTop: "var(--rule)", borderBottom: "var(--rule)" }}>
              <div style={{ fontSize: "28px", marginBottom: "12px" }}></div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                No upcoming deadlines.
              </p>
            </div>
          </div>
        ) : (
          assignments.map((a, i) => <AssignmentCard key={a.id} assignment={a} idx={i} role={role} />)
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: "18px", paddingTop: "12px", borderTop: "1px solid #e0e0e0" }}>
        <Link
          href="/assignments"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--ink)",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            borderBottom: "1.5px solid var(--ink)",
            paddingBottom: "2px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.5"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
        >
          View all assignments →
        </Link>
      </div>
    </div>
  );
}