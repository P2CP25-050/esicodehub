interface StatTile {
  value: number | string;
  label: string;
  color?: string;
}

interface QuickStatsProps {
  tiles: StatTile[];
  loading: boolean;
}

function StatCard({ tile }: { tile: StatTile }) {
  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "20px 24px",
      flex: 1,
      minWidth: "140px",
      transition: "border-color 0.15s, box-shadow 0.15s",
      position: "relative",
      overflow: "hidden",
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = tile.color ?? "var(--accent)";
      el.style.boxShadow = `0 4px 24px ${tile.color ?? "var(--accent)"}22`;
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--border)";
      el.style.boxShadow = "none";
    }}>
      {/* Ambient color glow behind the number */}
      <div style={{
        position: "absolute",
        top: "-20px", right: "-20px",
        width: "80px", height: "80px",
        borderRadius: "50%",
        background: `${tile.color ?? "var(--accent)"}18`,
        pointerEvents: "none",
      }} />
      <div style={{
        fontSize: "36px",
        fontWeight: 700,
        fontFamily: "var(--font-display)",
        color: tile.color ?? "var(--accent)",
        lineHeight: 1,
        marginBottom: "8px",
        letterSpacing: "-0.02em",
      }}>
        {tile.value}
      </div>
      <div style={{
        fontSize: "10px",
        fontWeight: 600,
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        lineHeight: 1.3,
      }}>
        {tile.label}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "20px 24px",
      flex: 1,
      minWidth: "140px",
    }}>
      <div style={{ height: "36px", background: "var(--border)", borderRadius: "6px", width: "60px", marginBottom: "10px", opacity: 0.6 }} />
      <div style={{ height: "10px", background: "var(--border)", borderRadius: "4px", width: "100px", opacity: 0.4 }} />
    </div>
  );
}

export default function QuickStats({ tiles, loading }: QuickStatsProps) {
  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <div style={{
          width: "3px", height: "18px",
          borderRadius: "2px",
          background: "var(--accent)",
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
        }}>
          Quick Stats
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <StatSkeleton key={i} />)
          : tiles.map((t, i) => <StatCard key={i} tile={t} />)}
      </div>
    </div>
  );
}