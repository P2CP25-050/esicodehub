export default function AssignmentsSkeleton() {
  return (
    <>
      <style>{`
        @keyframes ap-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: "16px",
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-soft)",
            animation: "ap-skeleton-pulse 1.6s ease-in-out infinite",
            animationDelay: `${i * 0.07}s`,
          }}
        >
          {/* Left side */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ height: "18px", width: "52px", background: "#d0d0d0", flexShrink: 0 }} />
            <div style={{ height: "14px", width: "220px", background: "#d0d0d0" }} />
            <div style={{ height: "12px", width: "80px", background: "#e0e0e0", opacity: 0.7 }} />
          </div>
          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ height: "12px", width: "90px", background: "#d0d0d0" }} />
            <div style={{ height: "18px", width: "64px", background: "#e0e0e0" }} />
          </div>
        </div>
      ))}
    </>
  );
}