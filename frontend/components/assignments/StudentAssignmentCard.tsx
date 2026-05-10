import { useRouter } from "next/router";
import type { Assignment } from "@/services/assignments";
import { formatDeadline, isPastDeadline } from "./utils";

interface Props {
  assignment: Assignment;
}

function getDeadlineColor(deadline: string): string {
  const now = new Date();
  const due = new Date(deadline);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffMs < 0) return "var(--red)";
  if (diffDays <= 3) return "var(--orange)";
  return "var(--green)";
}

type StatusPill = { label: string; bg: string; color: string; border: string };

function getStatusPill(a: { has_submitted: boolean | undefined; deadline: string }): StatusPill {
  if (a.has_submitted) {
    return { label: "Submitted ✓", bg: "#f0fff4", color: "var(--green)", border: "1.5px solid var(--green)" };
  }
  if (isPastDeadline(a.deadline)) {
    return { label: "Overdue", bg: "#fff0f0", color: "var(--red)", border: "1.5px solid var(--red)" };
  }
  return { label: "Pending", bg: "#fffbf0", color: "var(--orange)", border: "1.5px solid var(--orange)" };
}

export default function StudentAssignmentCard({ assignment: a }: Props) {
  const router = useRouter();
  const deadlineColor = getDeadlineColor(a.deadline);
  const past = isPastDeadline(a.deadline);
  const pill = getStatusPill({ has_submitted: a.has_submitted, deadline: a.deadline });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/assignments/${a.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/assignments/${a.id}`)}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "16px",
        padding: "14px 20px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--border-soft)",
        cursor: "pointer",
        transition: "background 0.12s",
        outline: "none",
        borderLeft: "3px solid transparent",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "var(--surface)";
        el.style.borderLeftColor = "var(--ink)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = "var(--paper)";
        el.style.borderLeftColor = "transparent";
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "inset 0 0 0 2px rgba(0,0,0,0.15)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Left: badge + title + professor */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flexWrap: "wrap" }}>
        {/* Subject badge */}
        <span style={{
          flexShrink: 0,
          padding: "2px 9px",
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          background: "var(--navy)",
          color: "#fff",
        }}>
          {a.subject.code}
        </span>

        {/* Title */}
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: "14px",
          fontWeight: 700,
          color: "var(--ink)",
          letterSpacing: "-0.01em",
          lineHeight: 1.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {a.title}
        </span>

        {/* Professor */}
        <span style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: "4px",
          fontSize: "10px", fontFamily: "var(--font-mono)",
          color: "var(--text-muted)", letterSpacing: "0.06em", whiteSpace: "nowrap",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {a.professor_name}
        </span>
      </div>

      {/* Right: deadline + status pill + arrow */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
        {/* Deadline */}
        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 700,
          color: deadlineColor, letterSpacing: "0.06em", whiteSpace: "nowrap",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="0" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {past ? "Overdue · " : "Due · "}{formatDeadline(a.deadline)}
        </div>

        {/* Status pill */}
        <span style={{
          flexShrink: 0,
          padding: "2px 9px",
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: pill.bg,
          color: pill.color,
          border: pill.border,
          whiteSpace: "nowrap",
        }}>
          {pill.label}
        </span>

        {/* Arrow */}
        <span style={{
          color: "var(--ink)",
          fontSize: "14px",
          fontFamily: "var(--font-mono)",
          pointerEvents: "none",
        }}>→</span>
      </div>
    </div>
  );
}