interface Props {
  role: "student" | "professor";
}

export default function EmptyState({ role }: Props) {
  return (
    <div style={{
      gridColumn: "1 / -1",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "80px 24px",
      textAlign: "center",
    }}>
      {/* Icon box — editorial square style */}
      <div style={{
        width: "72px",
        height: "72px",
        background: "var(--paper)",
        border: "var(--rule)",
        borderTop: "4px solid var(--navy)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "24px",
      }}>
        <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="0" stroke="var(--navy)" strokeWidth="2" />
          <line x1="16" y1="16" x2="32" y2="16" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="square" />
          <line x1="16" y1="22" x2="28" y2="22" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="square" />
          <line x1="16" y1="28" x2="24" y2="28" stroke="var(--navy)" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
      </div>

      <h3 style={{
        fontFamily: "var(--font-display)",
        fontSize: "22px",
        fontWeight: 900,
        color: "var(--ink)",
        margin: "0 0 10px",
        letterSpacing: "-0.01em",
      }}>
        {role === "student" ? "No assignments yet" : "No assignments created"}
      </h3>

      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: "13px",
        color: "var(--text-muted)",
        maxWidth: "320px",
        lineHeight: 1.6,
        margin: "0 0 4px",
        fontWeight: 300,
      }}>
        {role === "student"
          ? "Your professors haven't posted any assignments for you yet. Check back soon!"
          : "Click \"Create Assignment\" above to post your first assignment."}
      </p>
    </div>
  );
}