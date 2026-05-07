export default function SkeletonCard() {
  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "14px 16px",
      animation: "hp-skeleton-pulse 1.6s ease-in-out infinite",
    }}>
      <style>{`
        @keyframes hp-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      <div style={{ height: "13px", background: "var(--border)", borderRadius: "4px", width: "72%", marginBottom: "10px" }} />
      <div style={{ height: "11px", background: "var(--border)", borderRadius: "4px", width: "48%", marginBottom: "12px", opacity: 0.7 }} />
      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ height: "18px", background: "var(--border)", borderRadius: "4px", width: "48px", opacity: 0.6 }} />
        <div style={{ height: "18px", background: "var(--border)", borderRadius: "4px", width: "64px", opacity: 0.4 }} />
      </div>
    </div>
  );
}