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
    <div className="bg-white rounded-2xl border border-[#e2e8f6] px-6 py-5 flex-1 min-w-[140px] shadow-sm hover:shadow-md transition-shadow">
      <div
        className="text-3xl font-extrabold tracking-tight mb-1"
        style={{ color: tile.color ?? "#1d6ef5" }}
      >
        {tile.value}
      </div>
      <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide leading-tight">
        {tile.label}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f6] px-6 py-5 flex-1 min-w-[140px] animate-pulse">
      <div className="h-8 bg-[#e2e8f6] rounded-lg w-12 mb-2" />
      <div className="h-3 bg-[#e2e8f6] rounded-full w-24" />
    </div>
  );
}

export default function QuickStats({ tiles, loading }: QuickStatsProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#0d1b2a] to-[#1d6ef5]" />
        <h2 className="text-base font-bold text-[#0d1b2a] tracking-tight">Quick Stats</h2>
      </div>
      <div className="flex flex-wrap gap-4">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => <StatSkeleton key={i} />)
          : tiles.map((t, i) => <StatCard key={i} tile={t} />)}
      </div>
    </div>
  );
}