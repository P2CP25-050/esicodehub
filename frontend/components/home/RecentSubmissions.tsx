import Link from "next/link";
import SkeletonCard from "./SkeletonCard";

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  Python:     { bg: "#3572A5", text: "#fff" },
  JavaScript: { bg: "#f1e05a", text: "#111" },
  Java:       { bg: "#b07219", text: "#fff" },
  "C++":      { bg: "#f34b7d", text: "#fff" },
  SQL:        { bg: "#e38c00", text: "#fff" },
  TypeScript: { bg: "#2b7489", text: "#fff" },
  C:          { bg: "#00ADD8", text: "#fff" },
  Pascal:     { bg: "#dea584", text: "#111" },
  Other:      { bg: "#8e8e8e", text: "#fff" },
};

interface Submission {
  id: string | number;
  title: string;
  language: string;
  owner_name?: string;
  created_at: string;
}

interface RecentSubmissionsProps {
  submissions: Submission[];
  loading: boolean;
  error: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SubmissionCard({ sub }: { sub: Submission }) {
  const lang = LANG_COLORS[sub.language] ?? LANG_COLORS.Other;
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f6] p-5 hover:shadow-[0_4px_20px_rgba(30,60,120,0.1)] hover:-translate-y-0.5 transition-all duration-200 group">
      <h3 className="text-[#0d1b2a] font-bold text-sm mb-1.5 line-clamp-2 group-hover:text-[#1d6ef5] transition-colors">
        {sub.title}
      </h3>
      <p className="text-xs text-[#64748b] mb-3 flex items-center gap-1.5">
        <span className="inline-block w-4 h-4 rounded-full bg-gradient-to-br from-[#1d6ef5] to-[#00c6ff] text-white text-[8px] font-bold flex items-center justify-center leading-none">
          {(sub.owner_name ?? "?")[0].toUpperCase()}
        </span>
        {sub.owner_name ?? "Unknown"} · {timeAgo(sub.created_at)}
      </p>
      <span
        className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold"
        style={{ background: lang.bg, color: lang.text }}
      >
        {sub.language}
      </span>
    </div>
  );
}

export default function RecentSubmissions({ submissions, loading, error }: RecentSubmissionsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#1d6ef5] to-[#00c6ff]" />
        <h2 className="text-base font-bold text-[#0d1b2a] tracking-tight">Recent Submissions</h2>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-red-400 text-center px-4">
              Failed to load submissions. Please try again later.
            </p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6 py-8">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-[#64748b]">No submissions yet. Be the first to share code.</p>
            </div>
          </div>
        ) : (
          submissions.map((sub) => <SubmissionCard key={sub.id} sub={sub} />)
        )}
      </div>

      {/* Footer link */}
      <div className="mt-4 pt-3 border-t border-[#e2e8f6]">
        <Link
          href="/submissions"
          className="text-xs font-semibold text-[#1d6ef5] hover:text-[#1558d4] transition-colors inline-flex items-center gap-1"
        >
          View all submissions →
        </Link>
      </div>
    </div>
  );
}