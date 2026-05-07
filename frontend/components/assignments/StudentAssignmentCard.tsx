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
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        borderTop: "2px solid var(--blue)",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        cursor: "pointer",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
        boxShadow: "var(--shadow)",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--blue)";
        el.style.boxShadow = "var(--shadow-hover)";
        el.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--border)";
        el.style.boxShadow = "var(--shadow)";
        el.style.transform = "translateY(0)";
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(88,166,255,0.25), var(--shadow)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow)";
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
          background: "var(--blue-dim)",
          color: "var(--blue)",
          border: "1px solid rgba(88,166,255,0.25)",
        }}>
          {a.subject.code}
        </span>

        {a.has_submitted && (
          <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "6px",
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            background: "rgba(63,185,80,0.12)",
            color: "var(--green)",
            border: "1px solid rgba(63,185,80,0.25)",
          }}>
            Submitted ✓
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

      {/* Professor */}
      <div style={{
        display: "flex", alignItems: "center", gap: "5px",
        fontSize: "11px", fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {a.professor_name}
      </div>

      {/* Deadline */}
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