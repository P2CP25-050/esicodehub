import { useState, useEffect, useRef, CSSProperties } from "react";
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
  question: number;         // PublicProfileAnswerSerializer: question = question_id (int)
  question_title: string;  // PublicProfileAnswerSerializer: question_title = question.title
}

interface RecentActivity {
  submissions: RecentSubmission[];
  questions: RecentQuestion[];
  answers: RecentAnswer[];
}

interface PublicProfile {
  id: number;
  first_name: string;
  last_name: string;
  email: string;       // needed for reported_user_email in UserReportSerializer
  role: "student" | "professor";
  school_id: string;
  joined_at: string;   // PublicProfileSerializer uses joined_at (source='created_at')
  bio: string;
  avatar: string | null;
  study_year?: string | null;
  section?: string | null;
  group?: number | null;
  stats: PublicStats;
  recent_activity: RecentActivity | Record<string, never>;
}

// UserReport.Reason choices from the model
type ReportReason =
  | "spam"
  | "harassment"
  | "impersonation"
  | "academic_dishonesty"
  | "other";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam",               label: "Spam or irrelevant content" },
  { value: "harassment",         label: "Harassment or bullying" },
  { value: "impersonation",      label: "Impersonation" },
  { value: "academic_dishonesty",label: "Academic dishonesty" },
  { value: "other",              label: "Other" },
];

type TabId = "submissions" | "questions" | "answers";

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

function fullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}

function isFullActivity(
  ra: RecentActivity | Record<string, never>
): ra is RecentActivity {
  return "submissions" in ra;
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const isProfessor = role === "professor";
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      fontFamily: "'Space Mono', monospace",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase" as const,
      border: "1.5px solid #000",
      background: isProfessor ? "#051650" : "#000",
      color: "#fff",
      flexShrink: 0,
    }}>
      {isProfessor ? "Professor" : "Student"}
    </span>
  );
}

function Chip({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      padding: "3px 10px",
      fontFamily: "'Space Mono', monospace",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.1em",
      background: "#f7f7f5",
      border: "1.5px solid #000",
      color: "#000",
    }}>
      {label}
    </span>
  );
}

function StatPill({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 4, padding: "22px 12px", minWidth: 80,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontSize: 30, fontWeight: 900, color: "#000", lineHeight: 1,
        fontFamily: "'Playfair Display', Georgia, serif",
      }}>{value}</span>
      <span style={{
        fontSize: 9, color: "#666",
        fontFamily: "'Space Mono', monospace",
        fontWeight: 700, textAlign: "center",
        letterSpacing: "0.12em", textTransform: "uppercase" as const,
      }}>{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ fontSize: 14, marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{
          margin: 0, fontSize: 9, fontWeight: 700,
          fontFamily: "'Space Mono', monospace",
          color: "#666", textTransform: "uppercase" as const, letterSpacing: "0.14em",
        }}>{label}</p>
        <p style={{
          margin: "3px 0 0", fontSize: 14, color: "#000",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
        }}>{value}</p>
      </div>
    </div>
  );
}

function InitialsAvatar({ firstName, lastName, size = 120 }: {
  firstName: string; lastName: string; size?: number;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const idx = ((firstName?.charCodeAt(0) ?? 0) + (lastName?.charCodeAt(0) ?? 0)) % 2;
  const bg = idx === 0 ? "#051650" : "#000000";
  return (
    <div style={{
      width: size, height: size,
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 900,
      fontFamily: "'Playfair Display', Georgia, serif",
      color: "#fff",
      letterSpacing: 2, flexShrink: 0, userSelect: "none",
      border: "2px solid #000",
      borderRadius: "50%",
    }}>
      {initials || "?"}
    </div>
  );
}

function SkeletonBlock({ height, width = "100%", radius = 0 }: {
  height: number; width?: string | number; radius?: number;
}) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: "linear-gradient(90deg,#e0e0e0 25%,#f0efec 50%,#e0e0e0 75%)",
      backgroundSize: "200% 100%",
      animation: "pub-shimmer 1.4s ease infinite",
    }} />
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

interface ReportModalProps {
  reportedUserEmail: string; // UserReportSerializer.reported_user_email
  displayName: string;
  onClose: () => void;
}

function ReportModal({ reportedUserEmail, displayName, onClose }: ReportModalProps) {
  const [reason, setReason]     = useState<ReportReason>("spam");
  const [description, setDesc]  = useState("");
  const [submitting, setSub]    = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const overlayRef              = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSubmit = async () => {
    setSub(true);
    setError(null);
    try {
      // POST /api/reports/users/
      // UserReportSerializer expects exactly: reported_user_email, reason, description
      await apiClient.post("/reports/users/", {
        reported_user_email: reportedUserEmail,
        reason,
        description: description.trim(),
      });
      setDone(true);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      let msg = "Failed to submit report. Please try again.";
      if (data) {
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (Array.isArray(data.non_field_errors) && typeof data.non_field_errors[0] === "string") {
          msg = data.non_field_errors[0];
        } else {
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const val = data[firstKey];
            const valStr = Array.isArray(val) ? (val[0] as string) : String(val);
            msg = `${firstKey}: ${valStr}`;
          }
        }
      }
      setError(msg);
    } finally {
      setSub(false);
    }
  };

  return (
    <>
      <style>{MODAL_CSS}</style>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="rp-backdrop"
        onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        aria-modal="true"
        role="dialog"
        aria-label={`Report ${displayName}`}
      >
        <div className="rp-panel">
          {/* Header */}
          <div style={rm.header}>
            <div>
              <p style={rm.headerLabel}>Report User</p>
              <p style={rm.headerName}>{displayName}</p>
            </div>
            <button style={rm.closeBtn} onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {done ? (
            /* Success state */
            <div style={rm.successBlock}>
              <div style={rm.successIcon}>✓</div>
              <p style={rm.successTitle}>Report submitted</p>
              <p style={rm.successSub}>
                Our team will review this report shortly. Thank you for keeping the platform safe.
              </p>
              <button style={rm.primaryBtn} onClick={onClose}>Done</button>
            </div>
          ) : (
            /* Form */
            <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Reason selector */}
              <div>
                <label style={rm.fieldLabel}>Reason *</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} style={{
                      ...rm.radioLabel,
                      background: reason === r.value ? "#f7f7f5" : "#fff",
                      borderColor: reason === r.value ? "#051650" : "#e0e0e0",
                      borderLeft: reason === r.value ? "3px solid #051650" : "3px solid transparent",
                    }}>
                      <input
                        type="radio"
                        name="report_reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        style={{ accentColor: "#051650", marginTop: 1 }}
                      />
                      <span style={{
                        fontSize: 13, color: "#000",
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: reason === r.value ? 600 : 400,
                      }}>
                        {r.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={rm.fieldLabel}>
                  Additional details{" "}
                  <span style={{ color: "#666", fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      if (e.target.value.length <= 1000) setDesc(e.target.value);
                    }}
                    placeholder="Describe the issue in more detail…"
                    rows={4}
                    style={rm.textarea}
                  />
                  <span style={rm.charCounter}>{description.length}/1000</span>
                </div>
              </div>

              {error && (
                <div style={rm.errorBox}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cc0000" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button style={rm.cancelBtn} onClick={onClose}>Cancel</button>
                <button
                  style={{ ...rm.primaryBtn, ...(submitting ? { opacity: 0.5, cursor: "not-allowed" } : {}) }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting…" : "Submit report"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
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
    <Link href={`/forum/${item.id}`} style={s.actCard} className="pub-act-card">
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
    <Link href={`/forum/${item.question}`} style={s.actCard} className="pub-act-card">
      <span style={s.actIcon}>{item.is_accepted ? "✓" : "💬"}</span>
      <div style={s.actBody}>
        <p style={s.actTitle}>Re: {item.question_title}</p>
        <p style={s.actSub}>
          {item.body.slice(0, 90)}{item.body.length > 90 ? "…" : ""}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
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
      <span style={{ fontSize: 28 }}>{meta.icon}</span>
      <p style={{
        margin: 0, fontSize: 12, color: "#666",
        fontFamily: "'Space Mono', monospace",
        letterSpacing: "0.08em",
      }}>No {meta.label.toLowerCase()} yet.</p>
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
          <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
            <SkeletonBlock height={120} width={120} radius={999} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 180 }}>
              <SkeletonBlock height={26} width="52%" />
              <SkeletonBlock height={16} width="30%" />
              <SkeletonBlock height={13} width="78%" />
              <SkeletonBlock height={13} width="60%" />
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 32, paddingTop: 24, borderTop: "1.5px solid #000" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ flex: 1, padding: "16px 12px" }}>
                <SkeletonBlock height={60} radius={0} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 404 ─────────────────────────────────────────────────────────────────────

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
          <span style={{ fontSize: 48, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, color: "#051650" }}>404</span>
          <h2 style={{
            fontSize: 22, fontWeight: 900, color: "#000", margin: 0,
            fontFamily: "'Playfair Display', Georgia, serif",
          }}>Profile not found</h2>
          <p style={{
            color: "#666", fontSize: 13, margin: 0, maxWidth: 320,
            fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em",
          }}>
            This user doesn&apos;t exist or their profile is not available.
          </p>
          <button onClick={() => router.back()} style={s.goBackBtn}>← Go back</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function PublicProfilePage() {
  const router = useRouter();

  /**
   * router.isReady is false on the very first render in Next.js — router.query
   * is an empty object until the router has hydrated. Without this guard,
   * school_id is undefined on first render, the useEffect bails out immediately,
   * and the page stays on the loading skeleton forever (or worse, shows 404).
   *
   * [...school_id] catch-all: query.school_id arrives as string[].
   * Student IDs like "23/0145" are split by Next.js into ["23","0145"] —
   * we join them back with "/" to reconstruct the real ID.
   * Professor IDs have no slash so the array has one element; join is a no-op.
   */
  const rawSegments = router.isReady ? router.query.school_id : undefined;
  const school_id   = rawSegments
    ? (Array.isArray(rawSegments) ? rawSegments.join("/") : rawSegments)
    : undefined;

  const { user } = useAuth();

  const [profile,    setProfile]   = useState<PublicProfile | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [notFound,   setNotFound]  = useState(false);
  const [activeTab,  setActiveTab] = useState<TabId>("submissions");
  const [showReport, setShowReport] = useState(false);

  const isOwner = !!user && !!school_id && user.school_id === school_id;

  useEffect(() => {
    if (!router.isReady) return;
    if (!school_id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setProfile(null);

    (async () => {
      try {
        const { data } = await apiClient.get<PublicProfile>(`/profiles/${school_id}/`);
        if (!cancelled) setProfile(data);
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [router.isReady, school_id]);

  if (loading)            return <ProfileSkeleton />;
  if (notFound || !profile) return <NotFoundPage />;

  const {
    first_name, last_name, email, role, joined_at,
    bio, avatar, study_year, section, group,
    stats, recent_activity,
  } = profile;

  const displayName  = `${first_name} ${last_name}`;
  const isStudent    = role === "student";
  const activity     = isFullActivity(recent_activity) ? recent_activity : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <style>{PAGE_CSS}</style>
      <Header />

      {/* Report modal */}
      {showReport && profile && (
        <ReportModal
          reportedUserEmail={profile.email}
          displayName={displayName}
          onClose={() => setShowReport(false)}
        />
      )}

      <div className="pub-container">
        {/* Breadcrumb */}
        <nav className="pub-breadcrumb" aria-label="Breadcrumb">
          <Link href="/" className="pub-breadcrumb-link">~/home</Link>
          <span className="pub-breadcrumb-sep">/</span>
          <span aria-current="page">{displayName}</span>
        </nav>

        {/* Page header */}
        <div className="pub-page-header">
          <div>
            <h1 className="pub-page-title">
              <span>{first_name}</span>&rsquo;s Profile
            </h1>
            <p className="pub-page-subtitle">
              {isStudent ? "Student Account" : "Professor Account"}
            </p>
          </div>
          {/* Action button in header */}
          <div>
            {isOwner ? (
              <Link href="/profile" style={s.editBtn} className="pub-btn-hover">
                ✏️ Edit profile
              </Link>
            ) : (
              <button
                style={s.reportBtn}
                className="pub-report-btn-hover"
                onClick={() => setShowReport(true)}
                aria-label={`Report ${displayName}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                Report
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            HERO CARD
           ════════════════════════════════════════════════════════════════ */}
        <div className="pub-layout">

          {/* ── LEFT COLUMN ── */}
          <div>
            <div className="pub-card pub-card-identity pub-animate pub-animate-2">

              {/* Avatar */}
              <div className="pub-avatar-wrap">
                <div className="pub-avatar-ring">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={displayName}
                      width={96}
                      height={96}
                      unoptimized
                      style={{ borderRadius: "50%", objectFit: "cover", display: "block", width: 96, height: 96 }}
                    />
                  ) : (
                    <InitialsAvatar firstName={first_name} lastName={last_name} size={96} />
                  )}
                </div>
              </div>

              <div className="pub-divider" />

              {/* Identity fields */}
              <div className="pub-field">
                <label className="pub-field-label">Full Name</label>
                <p className="pub-field-value">{displayName}</p>
              </div>

              <div className="pub-field">
                <label className="pub-field-label">Role</label>
                <RoleBadge role={role} />
              </div>

              {/* Student ID — students only, professors never */}
              {isStudent && school_id && (
                <div className="pub-field">
                  <label className="pub-field-label">Student ID</label>
                  <p className="pub-field-value" style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, letterSpacing: 1 }}>
                    {school_id}
                  </p>
                </div>
              )}

              {isStudent && study_year && (
                <div className="pub-field">
                  <label className="pub-field-label">Study Year</label>
                  <p className="pub-field-value">{study_year}</p>
                </div>
              )}

              {isStudent && section && (
                <div className="pub-field">
                  <label className="pub-field-label">Section</label>
                  <p className="pub-field-value">{section}</p>
                </div>
              )}

              {isStudent && group != null && (
                <div className="pub-field">
                  <label className="pub-field-label">Group</label>
                  <p className="pub-field-value">{group}</p>
                </div>
              )}

              <p className="pub-member-since">🗓 Member since {fullDate(joined_at)}</p>

              {/* Chips for quick scanning */}
              {isStudent && (study_year || section || group != null) && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {study_year && <Chip label={study_year} />}
                  {section    && <Chip label={`Section ${section}`} />}
                  {group != null && <Chip label={`Group ${group}`} />}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div>
            {/* Bio card */}
            <div className="pub-card pub-card-bio pub-animate pub-animate-3">
              <p className="pub-section-title">Bio</p>
              {bio ? (
                <p style={{
                  margin: 0, fontSize: 14, color: "#444",
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.7,
                }}>{bio}</p>
              ) : (
                <p style={{
                  margin: 0, fontSize: 13, color: "#666",
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: "0.06em", fontStyle: "italic",
                }}>No bio.</p>
              )}
            </div>

            {/* Stats card */}
            <div className="pub-card pub-card-stats pub-animate pub-animate-3" style={{ marginTop: 24 }}>
              <p className="pub-section-title">Stats</p>
              <div style={s.statsRow}>
                <StatPill icon="📤" value={stats.submissions_count} label="Submissions" />
                {isStudent && (
                  <>
                    <div style={s.statsDivider} />
                    <StatPill icon="❓" value={stats.questions_count} label="Questions" />
                    <div style={s.statsDivider} />
                    <StatPill icon="💬" value={stats.answers_count} label="Answers" />
                    <div style={s.statsDivider} />
                    <StatPill icon="✓" value={stats.accepted_answers_count} label="Accepted" />
                  </>
                )}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                ACTIVITY TABS — students only
               ════════════════════════════════════════════════════════════════ */}
            {isStudent && activity && (
              <div className="pub-card pub-card-activity pub-animate pub-animate-4" style={{ marginTop: 24 }}>
                <p className="pub-section-title">Recent Activity</p>

                {/* Tab bar */}
                <div style={s.tabBar} role="tablist">
                  {TABS.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        role="tab"
                        aria-selected={active}
                        className={`pub-tab-btn${active ? " pub-tab-btn-active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <span aria-hidden="true">{tab.icon}</span>
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ padding: "20px 0 4px" }} role="tabpanel">
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
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:         #000000;
    --paper:       #ffffff;
    --navy:        #051650;
    --rule:        1.5px solid #000;
    --border-soft: 1px solid #e0e0e0;
    --surface:     #f7f7f5;
    --surface-2:   #f0efec;
    --text-muted:  #666666;
    --font-display:'Playfair Display', Georgia, serif;
    --font-mono:   'Space Mono', monospace;
    --font-body:   'DM Sans', sans-serif;
  }

  @keyframes pub-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes pub-fadein {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes rp-in {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: none; }
  }

  /* ── Page shell ── */
  .pub-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }
  .pub-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 280px; height: 100vh;
    background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }
  .pub-page::after {
    content: '';
    position: fixed;
    top: 64px; left: 0; right: 0;
    height: 1.5px;
    background: var(--ink);
    z-index: 0;
    pointer-events: none;
  }

  /* ── Container ── */
  .pub-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* ── Breadcrumb ── */
  .pub-breadcrumb {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 36px;
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .pub-breadcrumb-link {
    color: var(--navy);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
    transition: opacity 0.15s;
  }
  .pub-breadcrumb-link:hover { opacity: 0.65; }
  .pub-breadcrumb-sep { color: #aaa; }

  /* ── Page header ── */
  .pub-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 28px;
    border-bottom: var(--rule);
    margin-bottom: 32px;
  }
  .pub-page-title {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 6px;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .pub-page-title span { color: var(--navy); }
  .pub-page-subtitle {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    margin: 0;
  }

  /* ── Two-column layout ── */
  .pub-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
    align-items: start;
  }

  /* ── Cards ── */
  .pub-card {
    background: var(--paper);
    border: var(--rule);
    padding: 28px;
    position: relative;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .pub-card:last-child { margin-bottom: 0; }
  .pub-card::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 16px; height: 16px;
    border-bottom: 3px solid var(--navy);
    border-right: 3px solid var(--navy);
  }
  .pub-card-identity { border-top: 4px solid var(--navy); }
  .pub-card-bio      { border-top: 4px solid var(--ink); }
  .pub-card-stats    { border-top: 4px solid var(--ink); }
  .pub-card-activity { border-top: 4px solid var(--ink); }

  /* ── Section title ── */
  .pub-section-title {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 20px;
    border-bottom: var(--border-soft);
    padding-bottom: 10px;
  }

  /* ── Field rows ── */
  .pub-field { margin-bottom: 16px; }
  .pub-field:last-child { margin-bottom: 0; }
  .pub-field-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 3px;
    display: block;
  }
  .pub-field-value {
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }

  /* ── Avatar area ── */
  .pub-avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .pub-avatar-ring {
    width: 96px; height: 96px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }
  .pub-divider {
    height: 1px;
    background: #e0e0e0;
    margin: 0 -28px 20px;
  }

  /* ── Member since ── */
  .pub-member-since {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    margin: 12px 0 0;
  }

  /* ── Tab bar ── */
  .pub-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
  }
  .pub-tab-btn:hover { color: var(--ink); }
  .pub-tab-btn-active {
    color: var(--navy) !important;
    border-bottom-color: var(--navy) !important;
  }

  /* ── Activity cards ── */
  .pub-act-card:hover {
    border-left: 3px solid var(--navy) !important;
    background: var(--surface) !important;
  }

  /* ── Action buttons ── */
  .pub-btn-hover:hover {
    background: var(--ink) !important;
    color: var(--paper) !important;
  }
  .pub-report-btn-hover:hover {
    background: #cc0000 !important;
    border-color: #cc0000 !important;
    color: #fff !important;
  }

  /* ── Animations ── */
  .pub-animate   { opacity: 0; animation: pub-fadein 0.4s ease forwards; }
  .pub-animate-2 { animation-delay: 0.10s; }
  .pub-animate-3 { animation-delay: 0.17s; }
  .pub-animate-4 { animation-delay: 0.24s; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .pub-layout { grid-template-columns: 1fr; }
    .pub-page-title { font-size: 32px; }
    .pub-page::before { display: none; }
  }
  @media (max-width: 600px) {
    .pub-container { padding: 20px 16px 60px; }
    .pub-page-title { font-size: 26px; }
    .pub-card { padding: 20px; }
    .pub-divider { margin: 0 -20px 20px; }
  }
`;

const MODAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes rp-backdrop {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rp-panel {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: none; }
  }
  .rp-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    z-index: 500;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: rp-backdrop 0.18s ease;
  }
  .rp-panel {
    background: #fff;
    border: 1.5px solid #000;
    border-top: 4px solid #051650;
    width: min(480px, 100%);
    box-shadow: 4px 4px 0 #000;
    animation: rp-panel 0.2s cubic-bezier(0.2,0,0,1);
    overflow: hidden;
    position: relative;
  }
  .rp-panel::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 16px; height: 16px;
    border-bottom: 3px solid #051650;
    border-right: 3px solid #051650;
    pointer-events: none;
  }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#fff", fontFamily: "'DM Sans', sans-serif", color: "#000" },

  editBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px",
    background: "#fff",
    border: "1.5px solid #000",
    color: "#000", fontSize: 12,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    textDecoration: "none", whiteSpace: "nowrap",
    transition: "background .15s, color .15s",
    cursor: "pointer",
  },
  reportBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px",
    background: "#fff",
    border: "1.5px solid #000",
    color: "#000", fontSize: 12,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    cursor: "pointer", transition: "all .15s",
  },

  // Stats
  statsRow: { display: "flex", alignItems: "stretch", flexWrap: "wrap" },
  statsDivider: { width: 1, background: "#e0e0e0", alignSelf: "stretch", margin: "12px 0" },

  // Tabs
  tabBar: {
    display: "flex", borderBottom: "1.5px solid #000",
    overflowX: "auto",
    marginBottom: 4,
  },

  // Activity
  actList: { display: "flex", flexDirection: "column", gap: 10 },
  actCard: {
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: "13px 14px",
    background: "#f7f7f5",
    border: "1.5px solid #000",
    borderLeft: "3px solid transparent",
    textDecoration: "none", color: "inherit",
    transition: "border-color .15s, background .15s",
  },
  actIcon: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  actBody: { flex: 1, minWidth: 0 },
  actTitle: {
    margin: 0, fontSize: 14, fontWeight: 600, color: "#000",
    fontFamily: "'DM Sans', sans-serif",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  actSub: {
    margin: "3px 0 0", fontSize: 11, color: "#666",
    fontFamily: "'Space Mono', monospace",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    letterSpacing: "0.06em",
  },
  actTime: {
    fontSize: 10, color: "#666", flexShrink: 0, marginTop: 3,
    fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em",
  },
  tag: {
    padding: "2px 8px",
    background: "#051650",
    color: "#fff",
    fontSize: 10, fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.08em",
  },
  acceptedBadge: {
    padding: "2px 8px",
    background: "#000",
    color: "#fff",
    fontSize: 10, fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.08em",
  },

  goBackBtn: {
    marginTop: 8, padding: "10px 24px",
    background: "#051650",
    color: "#fff", border: "none",
    fontWeight: 700, fontSize: 12,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  },
};

// Report modal styles
const rm: Record<string, CSSProperties> = {
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "18px 24px 14px",
    borderBottom: "1.5px solid #000",
    background: "#f7f7f5",
  },
  headerLabel: {
    margin: 0, fontSize: 9, fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    color: "#666", textTransform: "uppercase" as const, letterSpacing: "0.18em",
  },
  headerName: {
    margin: "5px 0 0", fontSize: 18, fontWeight: 900, color: "#000",
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  closeBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "#666", padding: 4,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "color .12s",
  },
  fieldLabel: {
    margin: 0, fontSize: 9, fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    color: "#444", letterSpacing: "0.14em", textTransform: "uppercase" as const,
    display: "block",
  },
  radioLabel: {
    display: "flex", alignItems: "flex-start", gap: 10,
    padding: "10px 12px",
    border: "1.5px solid #e0e0e0",
    cursor: "pointer",
    transition: "background .12s, border-color .12s",
  },
  textarea: {
    width: "100%", padding: "11px 14px 28px",
    border: "1.5px solid #000",
    fontSize: 14, color: "#000", background: "#f7f7f5",
    outline: "none", boxSizing: "border-box" as const,
    resize: "vertical" as const,
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.6,
    transition: "border-color .15s",
    borderRadius: 0,
  },
  charCounter: {
    position: "absolute" as const, bottom: 8, right: 10,
    fontSize: 10, color: "#666", pointerEvents: "none" as const,
    fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em",
  },
  errorBox: {
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "10px 12px",
    background: "#fff0f0",
    border: "1.5px solid #cc0000",
    fontSize: 13, color: "#cc0000",
    fontFamily: "'DM Sans', sans-serif",
  },
  cancelBtn: {
    padding: "9px 18px",
    background: "#fff",
    border: "1.5px solid #000",
    color: "#000", fontSize: 11, fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  },
  primaryBtn: {
    padding: "9px 20px",
    background: "#051650",
    border: "none",
    color: "#fff", fontSize: 11, fontWeight: 700,
    fontFamily: "'Space Mono', monospace",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  },
  successBlock: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 12, padding: "48px 32px",
  },
  successIcon: {
    fontSize: 36,
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 900, color: "#051650",
  },
  successTitle: {
    margin: 0, fontSize: 22, fontWeight: 900, color: "#000",
    fontFamily: "'Playfair Display', Georgia, serif",
  },
  successSub: {
    margin: 0, fontSize: 13, color: "#666",
    fontFamily: "'Space Mono', monospace",
    textAlign: "center" as const, maxWidth: 320, lineHeight: 1.7,
    letterSpacing: "0.04em",
  },
};
