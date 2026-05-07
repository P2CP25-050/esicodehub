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
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
        boxShadow: "var(--shadow)",
        outline: "none",
        borderTop: "2px solid var(--accent)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--accent)";
        el.style.boxShadow = "var(--shadow-hover)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border)";
        el.style.boxShadow = "var(--shadow)";
        el.style.transform = "translateY(0)";
        el.style.borderTop = "2px solid var(--accent)";
      }}
      onFocus={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 0 0 3px rgba(230,201,122,0.25), var(--shadow)";
      }}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "var(--shadow)";
      }}
    >
      {/* Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: "6px",
          fontSize: "10px",
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: "var(--accent-dim)",
          color: "var(--accent)",
          border: "1px solid rgba(230,201,122,0.25)",
        }}>
          {a.subject.code}
        </span>

        <span style={{
          display: "inline-block",
          padding: "2px 10px",
          borderRadius: "6px",
          fontSize: "10px",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          background: "var(--surface-2)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
        }}>
          {getTargetSummary(a)}
        </span>

        {!a.is_open && (
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "6px",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            background: "rgba(248,81,73,0.1)",
            color: "var(--red)",
            border: "1px solid rgba(248,81,73,0.25)",
          }}>
            Closed
          </span>
        )}
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "var(--font-display)",
        fontSize: "15px",
        fontWeight: 600,
        color: "var(--text-primary)",
        margin: "4px 0 0",
        lineHeight: 1.4,
        paddingRight: "24px",
      }}>
        {a.title}
      </h3>

      {/* Subject name */}
      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: "12px",
        color: "var(--text-secondary)",
        margin: 0,
      }}>
        {a.subject.name}
      </p>

      {/* Bottom row */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginTop: "4px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontSize: "11px", fontFamily: "var(--font-mono)", fontWeight: 600,
          color: past ? "var(--red)" : "var(--green)",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          {past ? "Overdue · " : "Due · "}{formatDeadline(a.deadline)}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: "5px",
          fontSize: "11px", fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {a.submission_count} submission{a.submission_count !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Arrow */}
      <span style={{
        position: "absolute",
        right: "16px",
        top: "50%",
        transform: "translateY(-50%)",
        color: "var(--text-muted)",
        fontSize: "16px",
        transition: "color 0.15s",
        pointerEvents: "none",
      }}>→</span>
    </div>
  );
}