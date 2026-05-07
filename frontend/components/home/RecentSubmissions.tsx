import Link from "next/link";
import SkeletonCard from "./SkeletonCard";
import { timeAgo } from "../../utils/time";

const LANG_COLORS: Record<string, { bg: string; text: string }> = {
  Python:     { bg: "#3572A5", text: "#fff" },
  JavaScript: { bg: "#c9a227", text: "#0d1117" },
  Java:       { bg: "#b07219", text: "#fff" },
  "C++":      { bg: "#f34b7d", text: "#fff" },
  SQL:        { bg: "#e38c00", text: "#0d1117" },
  TypeScript: { bg: "#2b7489", text: "#fff" },
  C:          { bg: "#00ADD8", text: "#0d1117" },
  Pascal:     { bg: "#9b7960", text: "#fff" },
  Other:      { bg: "#484f58", text: "#e6edf3" },
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

function SubmissionCard({ sub }: { sub: Submission }) {
  const lang = LANG_COLORS[sub.language] ?? LANG_COLORS.Other;
  const initial = (sub.owner_name ?? "?")[0].toUpperCase();

  return (
    <div style={{
      background: "var(--surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      padding: "14px 16px",
      transition: "border-color 0.15s, transform 0.15s, box-shadow 0.15s",
      cursor: "default",
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--blue)";
      el.style.transform = "translateY(-1px)";
      el.style.boxShadow = "0 4px 16px rgba(88,166,255,0.12)";
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.borderColor = "var(--border)";
      el.style.transform = "translateY(0)";
      el.style.boxShadow = "none";
    }}>
      <h3 style={{
        color: "var(--text-primary)",
        fontWeight: 600,
        fontSize: "13px",
        margin: "0 0 8px",
        lineHeight: 1.4,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
      }}>
        {sub.title}
      </h3>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Avatar */}
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "18px", height: "18px",
            borderRadius: "50%",
            background: "var(--blue-dim)",
            color: "var(--blue)",
            fontSize: "9px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            border: "1px solid rgba(88,166,255,0.2)",
            flexShrink: 0,
          }}>
            {initial}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
            {sub.owner_name ?? "Unknown"}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>·</span>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {timeAgo(sub.created_at)}
          </span>
        </div>

        <span style={{
          display: "inline-block",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "10px",
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          background: lang.bg,
          color: lang.text,
          flexShrink: 0,
        }}>
          {sub.language}
        </span>
      </div>
    </div>
  );
}

export default function RecentSubmissions({ submissions, loading, error }: RecentSubmissionsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <div style={{
          width: "3px", height: "18px",
          borderRadius: "2px",
          background: "var(--blue)",
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--blue)",
        }}>
          Recent Submissions
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ fontSize: "13px", color: "var(--red)", textAlign: "center", padding: "0 16px" }}>
              Failed to load submissions. Please try again.
            </p>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "32px 24px" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                No submissions yet. Be the first to share code.
              </p>
            </div>
          </div>
        ) : (
          submissions.map((sub) => <SubmissionCard key={sub.id} sub={sub} />)
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
        <Link
          href="/submissions"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--blue)",
            textDecoration: "none",
            fontFamily: "var(--font-body)",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
        >
          View all submissions →
        </Link>
      </div>
    </div>
  );
}