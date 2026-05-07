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
      {/* Icon ring */}
      <div style={{
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: "24px",
        boxShadow: "0 0 32px rgba(230,201,122,0.08)",
      }}>
        <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="var(--text-muted)" strokeWidth="2" />
          <line x1="16" y1="16" x2="32" y2="16" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="16" y1="22" x2="28" y2="22" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="16" y1="28" x2="24" y2="28" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      <h3 style={{
        fontFamily: "var(--font-display)",
        fontSize: "20px",
        fontWeight: 600,
        color: "var(--text-primary)",
        margin: "0 0 10px",
      }}>
        {role === "student" ? "No assignments yet" : "No assignments created"}
      </h3>

      <p style={{
        fontFamily: "var(--font-body)",
        fontSize: "13px",
        color: "var(--text-secondary)",
        maxWidth: "320px",
        lineHeight: 1.6,
        margin: 0,
      }}>
        {role === "student"
          ? "Your professors haven't posted any assignments for you yet. Check back soon!"
          : "Click \"Create Assignment\" above to post your first assignment."}
      </p>
    </div>
  );
}