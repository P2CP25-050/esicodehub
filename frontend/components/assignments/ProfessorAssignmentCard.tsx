import { useRouter } from "next/router";
import type { Assignment } from "@/services/assignments";
import { formatDeadline, isPastDeadline, getTargetSummary } from "./utils";

interface Props {
  assignment: Assignment;
}

export default function ProfessorAssignmentCard({ assignment: a }: Props) {
  const router = useRouter();
  const past = isPastDeadline(a.deadline);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/assignments/${a.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/assignments/${a.id}`)}
      style={{
        position: "relative",
        background: "var(--paper)",
        border: "1px solid #d0d0d0",
        borderTop: "4px solid var(--navy)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        transition: "box-shadow 0.15s, transform 0.1s",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "5px 5px 0 var(--navy)";
        el.style.transform = "translate(-2px, -2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "translate(0, 0)";
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(5,22,80,0.2)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{
          display: "inline-block",
          padding: "2px 10px",
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: "var(--navy)",
          color: "#ffffff",
        }}>
          {a.subject.code}
        </span>

        <span style={{
          display: "inline-block",
          padding: "2px 10px",
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "transparent",
          color: "var(--ink)",
          border: "1.5px solid var(--ink)",
        }}>
          {getTargetSummary(a)}
        </span>

        {!a.is_open && (
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            fontSize: "9px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "#fff0f0",
            color: "var(--red)",
            border: "1.5px solid var(--red)",
          }}>
            Closed
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "var(--font-display)",
        fontSize: "15px",
        fontWeight: 700,
        color: "var(--ink)",
        margin: "4px 0 0",
        lineHeight: 1.4,
        paddingRight: "24px",
        letterSpacing: "-0.01em",
      }}>
        {a.title}
      </h3>

      {/* Subject name */}
      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: "12px",
        color: "var(--text-muted)",
        margin: 0,
        fontWeight: 300,
      }}>
        {a.subject.name}
      </p>

      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginTop: "4px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontSize: "10px", fontFamily: "var(--font-mono)", fontWeight: 700,
          color: past ? "var(--red)" : "var(--green)",
          letterSpacing: "0.06em",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="0" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {past ? "Overdue · " : "Due · "}{formatDeadline(a.deadline)}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontSize: "10px", fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
          letterSpacing: "0.06em",
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {a.submission_count} submission{a.submission_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Arrow */}
      <span style={{
        position: "absolute",
        right: "14px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--navy)",
        fontSize: "16px",
        pointerEvents: "none",
        fontFamily: "var(--font-mono)",
      }}>→</span>
    </div>
  );
}