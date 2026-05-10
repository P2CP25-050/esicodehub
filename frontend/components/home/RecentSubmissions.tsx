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
  C:          { bg: "#005fa3", text: "#fff" },
  Pascal:     { bg: "#9b7960", text: "#fff" },
  Other:      { bg: "#444444", text: "#fff" },
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
  const lang    = LANG_COLORS[sub.language] ?? LANG_COLORS.Other;
  const initial = (sub.owner_name ?? "?")[0].toUpperCase();

  return (
    <Link href={`/submissions/${sub.id}`} style={{ textDecoration: "none", display: "block" }}>
    <div
      style={{
        background: "var(--paper)",
        border: "1px solid #d0d0d0",
        borderLeft: "3px solid var(--navy)",
        padding: "14px 16px",
        transition: "box-shadow 0.15s, transform 0.1s, border-color 0.15s",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "4px 4px 0 var(--navy)";
        el.style.transform = "translate(-2px, -2px)";
        el.style.borderColor = "var(--navy)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "translate(0, 0)";
        el.style.borderColor = "#d0d0d0";
        el.style.borderLeftColor = "var(--navy)";
      }}
    >
      <h3 style={{
        color: "var(--ink)",
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
            background: "var(--navy)",
            color: "#ffffff",
            fontSize: "9px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            flexShrink: 0,
          }}>
            {initial}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-sub)", fontFamily: "var(--font-body)" }}>
            {sub.owner_name ?? "Unknown"}
          </span>
          <span style={{ color: "#bbb", fontSize: "12px" }}>·</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {timeAgo(sub.created_at)}
          </span>
        </div>

        <span style={{
          display: "inline-block",
          padding: "2px 8px",
          fontSize: "9px",
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
          background: lang.bg,
          color: lang.text,
          flexShrink: 0,
          textTransform: "uppercase",
        }}>
          {sub.language}
        </span>
      </div>
    </div>
    </Link>
  );
}

export default function RecentSubmissions({ submissions, loading, error }: RecentSubmissionsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
        <div style={{ width: "3px", height: "18px", background: "var(--navy)", flexShrink: 0 }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "9.5px",
          fontWeight: 700,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--navy)",
        }}>
          Recent Submissions
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--navy)", opacity: 0.2 }} />
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
            <p style={{ fontSize: "13px", color: "var(--red)", textAlign: "center", fontFamily: "var(--font-mono)" }}>
              Failed to load submissions.
            </p>
          </div>
        ) : submissions.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "32px 24px", borderTop: "var(--rule)", borderBottom: "var(--rule)" }}>
              <div style={{ fontSize: "28px", marginBottom: "12px" }}></div>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
                No submissions yet.
              </p>
            </div>
          </div>
        ) : (
          submissions.map((sub) => <SubmissionCard key={sub.id} sub={sub} />)
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: "18px", paddingTop: "12px", borderTop: "1px solid #e0e0e0" }}>
        <Link
          href="/submissions"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--navy)",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            borderBottom: "1.5px solid var(--navy)",
            paddingBottom: "2px",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.6"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
        >
          View all submissions →
        </Link>
      </div>
    </div>
  );
}