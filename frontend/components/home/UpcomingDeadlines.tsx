import Link from "next/link";
import { useState, useEffect } from "react";
import SkeletonCard from "./SkeletonCard";

const SUBJECT_COLORS: string[] = [
  "#e6c97a", "#58a6ff", "#3fb950", "#f0883e", "#a5d6ff", "#ffa657",
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
  const now = useNow(60000);
  const diff = new Date(deadline).getTime() - now;

  if (diff <= 0) {
    return (
      <span style={{
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color: "var(--red)",
        background: "rgba(248,81,73,0.12)",
        border: "1px solid rgba(248,81,73,0.25)",
        padding: "2px 8px",
        borderRadius: "4px",
      }}>
        Expired
      </span>
    );
  }

  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);

  let color = "var(--green)";
  let bg = "rgba(63,185,80,0.1)";
  let borderC = "rgba(63,185,80,0.25)";
  if (diff < 24 * 60 * 60 * 1000) {
    color = "var(--red)"; bg = "rgba(248,81,73,0.1)"; borderC = "rgba(248,81,73,0.25)";
  } else if (diff < 3 * 24 * 60 * 60 * 1000) {
    color = "var(--orange)"; bg = "rgba(240,136,62,0.1)"; borderC = "rgba(240,136,62,0.25)";
  }

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontSize: "10px",
      fontWeight: 600,
      fontFamily: "var(--font-mono)",
      color,
      background: bg,
      border: `1px solid ${borderC}`,
      padding: "2px 8px",
      borderRadius: "4px",
      flexShrink: 0,
    }}>
      ⏱ {days}d {hours}h
    </span>
  );
}

function AssignmentCard({ assignment, idx }: { assignment: Assignment; idx: number }) {
  const subjectColor = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "14px 16px",
      transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--orange)";
      el.style.transform = "translateY(-1px)";
      el.style.boxShadow = "0 4px 16px rgba(240,136,62,0.1)";
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--border)";
      el.style.transform = "translateY(0)";
      el.style.boxShadow = "none";
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
        {assignment.subject && (
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            background: `${subjectColor}22`,
            color: subjectColor,
            border: `1px solid ${subjectColor}44`,
            flexShrink: 0,
          }}>
            {assignment.subject}
          </span>
        )}
        <Countdown deadline={assignment.deadline} />
      </div>

      <h3 style={{
        color: "var(--text-primary)",
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

      <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>
        Due {new Date(assignment.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

export default function UpcomingDeadlines({ assignments, loading, error }: UpcomingDeadlinesProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <div style={{
          width: "3px", height: "18px",
          borderRadius: "2px",
          background: "var(--orange)",
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--orange)",
        }}>
          Upcoming Deadlines
        </span>
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
            <p style={{ fontSize: "13px", color: "var(--red)", textAlign: "center", padding: "0 16px" }}>
              Failed to load assignments. Please try again.
            </p>
          </div>
        ) : assignments.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "32px 24px" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>✅</div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                No upcoming deadlines.
              </p>
            </div>
          </div>
        ) : (
          assignments.map((a, i) => <AssignmentCard key={a.id} assignment={a} idx={i} />)
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
        <Link
          href="/assignments"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--orange)",
            textDecoration: "none",
            fontFamily: "var(--font-body)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
        >
          View all assignments →
        </Link>
      </div>
    </div>
  );
}