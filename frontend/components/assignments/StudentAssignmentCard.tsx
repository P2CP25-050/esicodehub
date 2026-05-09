import { useRouter } from "next/router";
import type { Assignment } from "@/services/assignments";
import { formatDeadline, isPastDeadline } from "./utils";

interface Props {
  assignment: Assignment;
}

export default function StudentAssignmentCard({ assignment: a }: Props) {
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
        borderTop: "4px solid var(--ink)",
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
        el.style.boxShadow = "5px 5px 0 var(--ink)";
        el.style.transform = "translate(-2px, -2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "translate(0, 0)";
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,0,0,0.15)";
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

        {a.has_submitted && (
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            fontSize: "9px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: "#f0fff4",
            color: "var(--green)",
            border: "1.5px solid var(--green)",
          }}>
            Submitted ✓
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

      {/* Professor */}
      <div style={{
        display: "flex", alignItems: "center", gap: "5px",
        fontSize: "10px", fontFamily: "var(--font-mono)",
        color: "var(--text-muted)", letterSpacing: "0.06em",
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {a.professor_name}
      </div>

      {/* Deadline */}
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

      {/* Arrow */}
      <span style={{
        position: "absolute",
        right: "14px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--ink)",
        fontSize: "16px",
        pointerEvents: "none",
        fontFamily: "var(--font-mono)",
      }}>→</span>
    </div>
  );
}