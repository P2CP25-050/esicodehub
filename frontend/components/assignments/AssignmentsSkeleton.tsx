export default function AssignmentsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: "var(--surface)",
            border: "var(--rule)",
            borderTop: "4px solid #e0e0e0",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            animation: "ap-skeleton-pulse 1.6s ease-in-out infinite",
            animationDelay: `${i * 0.08}s`,
          }}
        >
          <style>{`
            @keyframes ap-skeleton-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ height: "20px", width: "60px", background: "#d0d0d0" }} />
            <div style={{ height: "20px", width: "80px", background: "#d0d0d0", opacity: 0.6 }} />
          </div>
          <div style={{ height: "14px", width: "75%", background: "#d0d0d0" }} />
          <div style={{ height: "12px", width: "50%", background: "#d0d0d0", opacity: 0.7 }} />
          <div style={{ height: "11px", width: "40%", background: "#d0d0d0", opacity: 0.5 }} />
        </div>
      ))}
    </>
  );
}