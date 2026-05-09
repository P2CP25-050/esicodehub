/**
 * pages/profile/[school_id].tsx
 *
 * Public profile — visible to all authenticated users.
 * Backend: GET /api/profiles/<school_id>/
 *
 * Exact backend response shape (verified against tests + views.py):
 * {
 *   first_name, last_name, role, school_id, created_at,
 *   bio, avatar,                            ← top-level (avatar is data-URL or null)
 *   study_year?, section?, group?,          ← student-only (absent for professors)
 *   stats: { submissions_count, questions_count, answers_count, accepted_answers_count },
 *   recent_activity: {                      ← empty object {} for professors
 *     submissions: [{ id, title, created_at, submission_type? }],
 *     questions:   [{ id, title, created_at, tags? }],
 *     answers:     [{ id, body, created_at, is_accepted?, question: { id, title } }],
 *   }
 * }
 */

import { useState, useEffect, CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import apiClient from "@/lib/axios";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicStats {
  submissions_count: number;
  questions_count: number;
  answers_count: number;
  accepted_answers_count: number;
}

interface RecentSubmission {
  id: number;
  title: string;
  created_at: string;
  submission_type?: string;
}

interface RecentQuestion {
  id: number;
  title: string;
  created_at: string;
  tags?: string[];
}

interface RecentAnswer {
  id: number;
  body: string;
  created_at: string;
  is_accepted?: boolean;
  question: { id: number; title: string };
}

interface RecentActivity {
  submissions: RecentSubmission[];
  questions: RecentQuestion[];
  answers: RecentAnswer[];
}

interface PublicProfile {
  first_name: string;
  last_name: string;
  role: "student" | "professor";
  school_id: string;
  created_at: string;
  bio: string;
  avatar: string | null;    // data:image/png;base64,… or null
  study_year?: string | null;
  section?: string | null;
  group?: number | null;
  stats: PublicStats;
  recent_activity: RecentActivity | Record<string, never>;
}

type TabId = "submissions" | "questions" | "answers";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "submissions", label: "Submissions", icon: "📤" },
  { id: "questions",   label: "Questions",   icon: "❓" },
  { id: "answers",     label: "Answers",     icon: "💬" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function isStudentActivity(
  ra: RecentActivity | Record<string, never>
): ra is RecentActivity {
  return "submissions" in ra;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const isProfessor = role === "professor";
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 14px",
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.5,
      background: isProfessor
        ? "linear-gradient(135deg,#fda085,#f6d365)"
        : "linear-gradient(135deg,#1d6ef5,#1558d4)",
      color: "#fff",
      boxShadow: isProfessor
        ? "0 2px 8px rgba(253,160,133,0.35)"
        : "0 2px 8px rgba(29,110,245,0.25)",
      flexShrink: 0,
    }}>
      {isProfessor ? "Professor" : "Student"}
    </span>
  );
}

function InitialsAvatar({ firstName, lastName, size = 108 }: {
  firstName: string; lastName: string; size?: number;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const gradients = [
    "linear-gradient(135deg,#667eea,#764ba2)",
    "linear-gradient(135deg,#f093fb,#f5576c)",
    "linear-gradient(135deg,#4facfe,#00f2fe)",
    "linear-gradient(135deg,#43e97b,#38f9d7)",
    "linear-gradient(135deg,#fa709a,#fee140)",
    "linear-gradient(135deg,#a18cd1,#fbc2eb)",
    "linear-gradient(135deg,#fda085,#f6d365)",
    "linear-gradient(135deg,#1d6ef5,#1558d4)",
  ];
  const idx = ((firstName?.charCodeAt(0) ?? 0) + (lastName?.charCodeAt(0) ?? 0)) % gradients.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: gradients[idx],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color: "#fff", letterSpacing: 1,
      flexShrink: 0, userSelect: "none", border: "3px solid #e2e8f6",
    }}>
      {initials || "?"}
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span style={s.chip}>{label}</span>;
}

function StatPill({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div style={s.statPill}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function SkeletonBlock({ height, width = "100%", radius = 8 }: {
  height: number; width?: string | number; radius?: number;
}) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: "linear-gradient(90deg,#e2e8f6 25%,#f0f4ff 50%,#e2e8f6 75%)",
      backgroundSize: "200% 100%",
      animation: "pub-shimmer 1.4s ease infinite",
    }} />
  );
}

// ─── Activity rows ────────────────────────────────────────────────────────────

function SubmissionRow({ item }: { item: RecentSubmission }) {
  return (
    <Link href={`/submissions/${item.id}`} style={s.actCard} className="pub-act-card">
      <span style={s.actIcon}>📤</span>
      <div style={s.actBody}>
        <p style={s.actTitle}>{item.title}</p>
        {item.submission_type && (
          <p style={s.actSub}>{capitalize(item.submission_type)}</p>
        )}
      </div>
      <span style={s.actTime}>{timeAgo(item.created_at)}</span>
    </Link>
  );
}

function QuestionRow({ item }: { item: RecentQuestion }) {
  return (
    <Link href={`/forum/questions/${item.id}`} style={s.actCard} className="pub-act-card">
      <span style={s.actIcon}>❓</span>
      <div style={s.actBody}>
        <p style={s.actTitle}>{item.title}</p>
        {item.tags && item.tags.length > 0 && (
          <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} style={s.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
      <span style={s.actTime}>{timeAgo(item.created_at)}</span>
    </Link>
  );
}

function AnswerRow({ item }: { item: RecentAnswer }) {
  return (
    <Link href={`/forum/questions/${item.question.id}`} style={s.actCard} className="pub-act-card">
      <span style={s.actIcon}>{item.is_accepted ? "✅" : "💬"}</span>
      <div style={s.actBody}>
        <p style={s.actTitle}>Re: {item.question.title}</p>
        <p style={s.actSub}>
          {item.body.slice(0, 80)}{item.body.length > 80 ? "…" : ""}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
        {item.is_accepted && <span style={s.acceptedBadge}>Accepted</span>}
        <span style={s.actTime}>{timeAgo(item.created_at)}</span>
      </div>
    </Link>
  );
}

function EmptyTab({ tab }: { tab: TabId }) {
  const meta = TABS.find((t) => t.id === tab)!;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "48px 20px" }}>
      <span style={{ fontSize: 36 }}>{meta.icon}</span>
      <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
        No {meta.label.toLowerCase()} yet.
      </p>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div style={s.page}>
      <style>{PAGE_CSS}</style>
      <Header />
      <div className="pub-container">
        <div className="pub-card" style={{ padding: 40 }}>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <SkeletonBlock height={108} width={108} radius={999} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 180 }}>
              <SkeletonBlock height={26} width="52%" />
              <SkeletonBlock height={16} width="28%" />
              <SkeletonBlock height={13} width="75%" />
              <SkeletonBlock height={13} width="60%" />
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 28, paddingTop: 24, borderTop: "1px solid #e2e8f6" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ flex: 1, padding: "16px 12px" }}>
                <SkeletonBlock height={58} radius={12} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Not found ────────────────────────────────────────────────────────────────

function NotFoundPage() {
  const router = useRouter();
  return (
    <div style={s.page}>
      <style>{PAGE_CSS}</style>
      <Header />
      <div className="pub-container">
        <div className="pub-card" style={{
          padding: "72px 40px", textAlign: "center",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        }}>
          <span style={{ fontSize: 56 }}>🔍</span>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0d1b2a", margin: 0 }}>
            Profile not found
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, margin: 0, maxWidth: 320 }}>
            This user doesn&apos;t exist or their profile is not available.
          </p>
          <button onClick={() => router.back()} style={s.goBackBtn}>
            ← Go back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PublicProfilePage() {
  const router = useRouter();
  const { school_id } = router.query as { school_id?: string };
  const { user } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("submissions");

  const isOwner = !!user && user.school_id === school_id;

  useEffect(() => {
    if (!school_id) return;
    setLoading(true);
    setNotFound(false);
    setProfile(null);
    (async () => {
      try {
        const { data } = await apiClient.get<PublicProfile>(`/profiles/${school_id}/`);
        setProfile(data);
      } catch (err: unknown) {
        if ((err as { response?: { status?: number } })?.response?.status === 404) {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [school_id]);

  if (loading) return <ProfileSkeleton />;
  if (notFound || !profile) return <NotFoundPage />;

  const {
    first_name, last_name, role, created_at,
    bio, avatar, study_year, section, group, stats, recent_activity,
  } = profile;

  const displayName = `${first_name} ${last_name}`;
  const isStudent = role === "student";
  const activity = isStudentActivity(recent_activity) ? recent_activity : null;

  return (
    <div style={s.page}>
      <style>{PAGE_CSS}</style>
      <Header />

      <div className="pub-container">
        {/* Breadcrumb */}
        <nav style={s.breadcrumb} aria-label="Breadcrumb">
          <Link href="/" style={s.breadcrumbLink}>Home</Link>
          <span style={s.breadcrumbSep}>›</span>
          <span style={s.breadcrumbCurrent} aria-current="page">{displayName}</span>
        </nav>

        {/* ── Hero card ── */}
        <div className="pub-card pub-hero-card">
          <div className="pub-hero-top">
            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              {avatar ? (
                <Image
                  src={avatar}
                  alt={displayName}
                  width={108}
                  height={108}
                  unoptimized
                  style={{ borderRadius: "50%", objectFit: "cover", border: "3px solid #e2e8f6", display: "block" }}
                />
              ) : (
                <InitialsAvatar firstName={first_name} lastName={last_name} size={108} />
              )}
            </div>

            {/* Identity */}
            <div style={s.heroInfo}>
              <div style={s.heroNameRow}>
                <h1 style={s.heroName}>{displayName}</h1>
                <RoleBadge role={role} />
                {isOwner && (
                  <Link href="/profile/edit" style={s.editBtn}>✏️ Edit</Link>
                )}
              </div>

              <p style={s.heroMeta}>
                <span>🎓 {school_id}</span>
                <span style={{ color: "#cbd5e1" }}>·</span>
                <span style={{ color: "#94a3b8" }}>Since {memberSince(created_at)}</span>
              </p>

              {bio ? (
                <p style={s.heroBio}>{bio}</p>
              ) : isOwner ? (
                <p style={{ ...s.heroBio, color: "#94a3b8", fontStyle: "italic" }}>
                  No bio yet.{" "}
                  <Link href="/profile/edit" style={{ color: "#2563eb" }}>Add one →</Link>
                </p>
              ) : null}

              {/* Student-only chips: study_year / section / group */}
              {isStudent && (study_year || section || group != null) && (
                <div style={s.chipsRow}>
                  {study_year && <Chip label={study_year} />}
                  {section && <Chip label={`Section ${section}`} />}
                  {group != null && <Chip label={`Group ${group}`} />}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={s.statsRow}>
            <StatPill icon="📤" value={stats.submissions_count} label="Submissions" />
            {isStudent && (
              <>
                <div style={s.statsDivider} />
                <StatPill icon="❓" value={stats.questions_count} label="Questions" />
                <div style={s.statsDivider} />
                <StatPill icon="💬" value={stats.answers_count} label="Answers" />
                <div style={s.statsDivider} />
                <StatPill icon="✅" value={stats.accepted_answers_count} label="Accepted" />
              </>
            )}
          </div>
        </div>

        {/* ── Activity tabs — students only ── */}
        {isStudent && activity && (
          <div className="pub-card" style={{ marginTop: 24 }}>
            <div style={s.tabBar} role="tablist">
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={active}
                    style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span aria-hidden="true">{tab.icon}</span>
                    {tab.label}
                    {active && <span style={s.tabUnderline} />}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "20px 28px 28px" }} role="tabpanel">
              {activeTab === "submissions" && (
                activity.submissions.length === 0
                  ? <EmptyTab tab="submissions" />
                  : <div style={s.actList}>
                      {activity.submissions.map((item) => <SubmissionRow key={item.id} item={item} />)}
                    </div>
              )}
              {activeTab === "questions" && (
                activity.questions.length === 0
                  ? <EmptyTab tab="questions" />
                  : <div style={s.actList}>
                      {activity.questions.map((item) => <QuestionRow key={item.id} item={item} />)}
                    </div>
              )}
              {activeTab === "answers" && (
                activity.answers.length === 0
                  ? <EmptyTab tab="answers" />
                  : <div style={s.actList}>
                      {activity.answers.map((item) => <AnswerRow key={item.id} item={item} />)}
                    </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicProfileWrapper() {
  return (
    <ProtectedRoute>
      <PublicProfilePage />
    </ProtectedRoute>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const PAGE_CSS = `
  @keyframes pub-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes pub-fadein {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: none; }
  }
  .pub-container {
    max-width: 820px;
    margin: 0 auto;
    padding: 32px 24px 80px;
  }
  .pub-card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(30,60,120,0.08);
    border: 1px solid #e2e8f6;
    animation: pub-fadein 0.3s ease;
    overflow: hidden;
  }
  .pub-hero-top {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    padding: 32px 28px 24px;
    flex-wrap: wrap;
  }
  .pub-act-card:hover {
    border-color: #1d6ef5 !important;
    background: #f5f8ff !important;
  }
  @media (max-width: 600px) {
    .pub-container { padding: 16px 12px 60px; }
    .pub-card { border-radius: 12px; }
    .pub-hero-top { padding: 22px 18px 18px; gap: 16px; }
  }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4ff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#1a2340",
  },
  breadcrumb: { display: "flex", alignItems: "center", gap: 8, marginBottom: 24, fontSize: 14 },
  breadcrumbLink: { color: "#2563eb", fontWeight: 500, textDecoration: "none" },
  breadcrumbSep: { color: "#94a3b8" },
  breadcrumbCurrent: { color: "#64748b" },

  heroInfo: { flex: 1, minWidth: 190, display: "flex", flexDirection: "column", gap: 10 },
  heroNameRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  heroName: { margin: 0, fontSize: 23, fontWeight: 800, color: "#0d1b2a", lineHeight: 1.2 },
  heroMeta: { margin: 0, fontSize: 13, color: "#64748b", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroBio: { margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.65, maxWidth: 500 },
  chipsRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 },
  chip: {
    padding: "4px 12px", borderRadius: 99,
    background: "#f0f4ff", border: "1.5px solid #d1d9e6",
    color: "#374151", fontSize: 12, fontWeight: 600,
  },
  editBtn: {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 14px", background: "#fff",
    border: "1.5px solid #d1d9e6", borderRadius: 8,
    color: "#374151", fontSize: 12, fontWeight: 700,
    cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap",
  },

  statsRow: {
    display: "flex", alignItems: "stretch",
    borderTop: "1px solid #f1f5f9", background: "#f8faff", flexWrap: "wrap",
  },
  statPill: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: 4, padding: "20px 10px", minWidth: 80,
  },
  statValue: { fontSize: 26, fontWeight: 800, color: "#0d1b2a", lineHeight: 1 },
  statLabel: { fontSize: 11, color: "#64748b", fontWeight: 500, textAlign: "center" as const },
  statsDivider: { width: 1, background: "#e2e8f6", alignSelf: "stretch", margin: "14px 0" },

  tabBar: {
    display: "flex", borderBottom: "1px solid #e2e8f6",
    padding: "0 20px", overflowX: "auto",
  },
  tabBtn: {
    position: "relative", display: "flex", alignItems: "center", gap: 7,
    padding: "14px 18px", background: "none", border: "none",
    color: "#64748b", fontSize: 14, fontWeight: 500,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    cursor: "pointer", whiteSpace: "nowrap", transition: "color .15s",
  },
  tabBtnActive: { color: "#1d6ef5", fontWeight: 700 },
  tabUnderline: {
    position: "absolute", bottom: -1, left: 0, right: 0,
    height: 3, background: "#1d6ef5", borderRadius: "3px 3px 0 0",
  },

  actList: { display: "flex", flexDirection: "column", gap: 10 },
  actCard: {
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: "14px 16px", background: "#f8faff",
    border: "1.5px solid #e2e8f6", borderRadius: 12,
    textDecoration: "none", color: "inherit",
    transition: "border-color .15s, background .15s",
  },
  actIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  actBody: { flex: 1, minWidth: 0 },
  actTitle: {
    margin: 0, fontSize: 14, fontWeight: 600, color: "#1a2340",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actSub: {
    margin: "3px 0 0", fontSize: 12, color: "#64748b",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actTime: { fontSize: 11, color: "#94a3b8", flexShrink: 0, marginTop: 3 },
  tag: {
    padding: "2px 8px", background: "#e8f0fe",
    color: "#1d6ef5", borderRadius: 99, fontSize: 11, fontWeight: 600,
  },
  acceptedBadge: {
    padding: "2px 8px", background: "#dcfce7",
    color: "#16a34a", borderRadius: 99, fontSize: 11, fontWeight: 700,
  },
  goBackBtn: {
    marginTop: 8, padding: "10px 24px",
    background: "linear-gradient(135deg,#1d6ef5,#1558d4)",
    color: "#fff", border: "none", borderRadius: 10,
    fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
};