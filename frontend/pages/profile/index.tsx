import { useState, useEffect, useRef, ChangeEvent, CSSProperties } from "react";

import Link from "next/link";
import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import {
  getProfile,
  updateBio,
  uploadAvatar,
  getStudentStats,
  getProfessorStats,
  getRecentActivity,
} from "@/services/profile/api";
import type {
  ProfileStats,
  ActivityItem,
  UserProfile,
} from "@/services/profile/api";

const PROFILE_AVATAR_KEY = "profile_avatar_url";
const AVATAR_UPDATED_EVENT = "profile-avatar-updated";

const syncAvatarForHeader = (avatar: string | null) => {
  if (typeof window === "undefined") return;

  if (avatar) {
    window.localStorage.setItem(PROFILE_AVATAR_KEY, avatar);
  } else {
    window.localStorage.removeItem(PROFILE_AVATAR_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(AVATAR_UPDATED_EVENT, {
      detail: { avatarUrl: avatar },
    }),
  );
};

// ─── Responsive CSS ──────────────────────────────────────────────────────────
const RESPONSIVE_CSS = `
  .pf-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px 64px;
  }
  .pf-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 28px;
    align-items: start;
  }
  .pf-card {
    background: #fff;
    border-radius: 16px;
    padding: 32px 28px;
    box-shadow: 0 4px 24px rgba(30,60,120,0.08);
    border: 1px solid #e2e8f6;
  }
  .pf-stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .pf-activity-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .pf-activity-item:last-child {
    border-bottom: none;
  }
  @media (max-width: 900px) {
    .pf-layout {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 600px) {
    .pf-container {
      padding: 16px 12px 48px;
    }
    .pf-card {
      padding: 22px 18px;
      border-radius: 12px;
    }
    .pf-stats-grid {
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
  }
`;

// ─── Initials Avatar ─────────────────────────────────────────────────────────
function InitialsAvatar({ firstName, lastName, size = 96 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  // Same gradient palette used in submissions list Avatar components
  const gradients = [
    "linear-gradient(135deg, #667eea, #764ba2)",
    "linear-gradient(135deg, #f093fb, #f5576c)",
    "linear-gradient(135deg, #4facfe, #00f2fe)",
    "linear-gradient(135deg, #43e97b, #38f9d7)",
    "linear-gradient(135deg, #fa709a, #fee140)",
    "linear-gradient(135deg, #a18cd1, #fbc2eb)",
    "linear-gradient(135deg, #fda085, #f6d365)",
    "linear-gradient(135deg, #1d6ef5, #1558d4)",
  ];
  const idx = ((firstName?.charCodeAt(0) ?? 0) + (lastName?.charCodeAt(0) ?? 0)) % gradients.length;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: gradients[idx],
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.35,
      fontWeight: 800,
      color: "#fff",
      letterSpacing: 1,
      flexShrink: 0,
      userSelect: "none",
    }}>
      {initials || "?"}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      border: `${size * 0.15}px solid rgba(255,255,255,0.4)`,
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "pf-spin 0.7s linear infinite",
      display: "inline-block",
    }} />
  );
}

// ─── Role Badge ──────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isProfessor = role?.toLowerCase() === "professor";
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 12px",
      borderRadius: 99,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.4,
      background: isProfessor ? "linear-gradient(135deg,#fda085,#f6d365)" : "linear-gradient(135deg,#1d6ef5,#1558d4)",
      color: "#fff",
      boxShadow: isProfessor
        ? "0 2px 8px rgba(253,160,133,0.35)"
        : "0 2px 8px rgba(29,110,245,0.25)",
    }}>
      {isProfessor ? "Professor" : "Student"}
    </span>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div style={{
      background: "#f8faff",
      border: "1.5px solid #e2e8f6",
      borderRadius: 14,
      padding: "18px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: "#0d1b2a", lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
    </div>
  );
}

// ─── Time Ago ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Member Since ─────────────────────────────────────────────────────────────
function memberSince(dateStr: string): string {
  const d = new Date(dateStr);
  return `Member since ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user } = useAuth();


  const [bio, setBio] = useState<string>("");
  const [savedBio, setSavedBio] = useState<string>("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Inject styles
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "pf-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = RESPONSIVE_CSS + `
        @keyframes pf-spin { to { transform: rotate(360deg); } }
        @keyframes pf-fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .pf-card { animation: pf-fadein 0.3s ease; }
      `;
      document.head.appendChild(tag);
    }
  }, []);

  // Load profile data
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [profile, statsData, activityData] = await Promise.all([
          getProfile(),
          user.role === "professor" ? getProfessorStats() : getStudentStats(),
          getRecentActivity(),
        ]);
        // bio and avatar are on the nested Profile model (user.profile)
        setBio(profile.profile?.bio ?? "");
        setSavedBio(profile.profile?.bio ?? "");
        // Django ImageField serializes to an absolute URL string
        const loadedAvatar = profile.profile?.avatar ?? null;
        setAvatarUrl(loadedAvatar);
        syncAvatarForHeader(loadedAvatar);
        setProfileData(profile);
        setStats(statsData);
        setActivity(activityData);
      } catch {
        // non-fatal: page still renders from useAuth user data
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const bioChanged = bio !== savedBio;

  const handleSaveBio = async () => {
    setBioSaving(true);
    setBioError(null);
    setBioSuccess(false);
    try {
      await updateBio(bio);
      setSavedBio(bio);
      setBioSuccess(true);
      setTimeout(() => setBioSuccess(false), 3000);
    } catch (err: unknown) {
      setBioError(err instanceof Error ? err.message : "Failed to save bio.");
    } finally {
      setBioSaving(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);

    // Client-side validation
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError("Only .jpg, .png, and .webp files are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("File must be under 2MB.");
      return;
    }

    setAvatarUploading(true);
    try {
      const result = await uploadAvatar(file);
      // avatar field is the ImageField name on the Profile model
      const newAvatar = result.avatar || null;
      setAvatarUrl(newAvatar);
      syncAvatarForHeader(newAvatar);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setAvatarUploading(false);
      // Reset so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  const role = profileData?.role ?? user.role ?? "student";
  const firstName = profileData?.first_name ?? user.first_name ?? "";
  const lastName = profileData?.last_name ?? user.last_name ?? "";
  const email = profileData?.email ?? user.email ?? "";
  const schoolId = profileData?.school_id ?? "";
  const createdAt = profileData?.created_at ?? "";

  return (
    <div style={s.page}>
      <Header />
      <div className="pf-container">
        {/* Breadcrumb */}
        <div style={s.breadcrumb}>
          <Link href="/submissions" style={s.breadcrumbLink}>Home</Link>
          <span style={s.breadcrumbSep}>›</span>
          <span style={s.breadcrumbCurrent}>Profile</span>
        </div>

        <div className="pf-layout">
          {/* ── LEFT COLUMN — Identity Card ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="pf-card">
              {/* Avatar */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div style={{ position: "relative" }}>
                  {avatarUploading ? (
                    <div style={{
                      width: 96, height: 96, borderRadius: "50%",
                      background: "linear-gradient(135deg,#1d6ef5,#1558d4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Spinner size={28} />
                    </div>
                  ) : avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "3px solid #e2e8f6" }}
                    />
                  ) : (
                    <InitialsAvatar firstName={firstName} lastName={lastName} size={96} />
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />
                <button
                  style={s.btnUploadPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="Upload a profile photo"
                >
                  {avatarUploading ? "Uploading…" : "Upload photo"}
                </button>
                {avatarError && (
                  <p style={s.inlineError}>{avatarError}</p>
                )}
              </div>

              <div style={s.divider} />

              {/* Identity fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
                {/* Name */}
                <div>
                  <label style={s.fieldLabel}>Full Name</label>
                  <p style={s.fieldValue}>{firstName} {lastName}</p>
                  <p style={s.fieldHint}>Name is pulled from the ESI database and cannot be changed here.</p>
                </div>

                {/* Email */}
                <div>
                  <label style={s.fieldLabel}>Email</label>
                  <p style={s.fieldValue}>{email}</p>
                </div>

                {/* Role */}
                <div>
                  <label style={s.fieldLabel}>Role</label>
                  <div style={{ marginTop: 4 }}>
                    <RoleBadge role={role} />
                  </div>
                </div>

                {/* School ID */}
                {schoolId && (
                  <div>
                    <label style={s.fieldLabel}>School ID</label>
                    <p style={{ ...s.fieldValue, fontFamily: "monospace", letterSpacing: 0.5 }}>{schoolId}</p>
                  </div>
                )}

                {/* Member since */}
                {createdAt && (
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, marginTop: 4 }}>
                    🗓 {memberSince(createdAt)}
                  </p>
                )}
              </div>
            </div>

            {/* Bio card */}
            <div className="pf-card">
              <label style={{ ...s.fieldLabel, fontSize: 13, marginBottom: 8, display: "block" }}>Bio</label>
              <div style={{ position: "relative" }}>
                <textarea
                  style={s.bioTextarea}
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= 300) setBio(e.target.value);
                  }}
                  placeholder="Tell people a little about yourself…"
                  rows={4}
                />
                <span style={s.charCounter}>{bio.length}/300</span>
              </div>

              {bioError && <p style={{ ...s.inlineError, marginTop: 8 }}>{bioError}</p>}
              {bioSuccess && (
                <p style={{ fontSize: 12, color: "#16a34a", marginTop: 8, fontWeight: 600 }}>✓ Bio saved!</p>
              )}

              {bioChanged && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                  <button
                    style={bioSaving ? { ...s.btnPrimary, opacity: 0.6, cursor: "not-allowed" } : s.btnPrimary}
                    onClick={handleSaveBio}
                    disabled={bioSaving}
                  >
                    {bioSaving ? "Saving…" : "Save bio"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Stats */}
            <div className="pf-card">
              <h2 style={s.sectionTitle}>
                {role === "professor" ? "Your Impact" : "Your Activity"}
              </h2>

              {loading ? (
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Loading stats…</div>
              ) : stats ? (
                <div className="pf-stats-grid">
                  {role === "professor" ? (() => {
                    const ps = stats as import("@/services/profile/api").ProfessorStats;
                    return (
                      <>
                        <StatTile icon="" value={ps.total_assignments ?? 0} label="Assignments Created" />
                        <StatTile icon="" value={ps.total_submissions_received ?? 0} label="Submissions Received" />
                        {ps.total_reviews_given !== undefined ? (
                          <StatTile icon="" value={ps.total_reviews_given} label="Reviews Given" />
                        ) : (
                          <div style={{ ...s.todoTile }}>
                            {/* TODO: total reviews given endpoint not yet available */}
                            <span style={{ fontSize: 20 }}></span>
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>Reviews given — coming soon</span>
                          </div>
                        )}
                      </>
                    );
                  })() : (() => {
                    const ss = stats as import("@/services/profile/api").StudentStats;
                    return (
                      <>
                        <StatTile icon="" value={ss.total_personal_submissions ?? 0} label="Personal Submissions" />
                        <StatTile icon="" value={ss.total_assignment_submissions ?? 0} label="Assignment Submissions" />
                        <StatTile icon="" value={ss.assignments_completed ?? 0} label="Assignments Completed" />
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>Stats unavailable.</p>
              )}
            </div>

            {/* Recent Activity */}
            <div className="pf-card">
              <h2 style={s.sectionTitle}>Recent Activity</h2>

              {loading ? (
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Loading activity…</div>
              ) : activity.length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>No activity yet.</p>
              ) : (
                <div>
                  {activity.map((item, i) => (
                    <div key={i} className="pf-activity-item">
                      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, color: "#1a2340", fontWeight: 500, lineHeight: 1.4 }}>
                          {item.label}
                        </p>
                        {item.sub && (
                          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{item.sub}</p>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0, marginTop: 2 }}>
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                  ))}
                  {/* TODO: add assignment submissions when endpoint is available */}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f0f4ff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    color: "#1a2340",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
    fontSize: 14,
  },
  breadcrumbLink: { color: "#2563eb", cursor: "pointer", fontWeight: 500, textDecoration: "none" },
  breadcrumbSep: { color: "#94a3b8" },
  breadcrumbCurrent: { color: "#64748b" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0d1b2a",
    margin: "0 0 18px",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    margin: 0,
  },
  fieldValue: {
    margin: "4px 0 0",
    fontSize: 15,
    color: "#1a2340",
    fontWeight: 500,
  },
  fieldHint: {
    margin: "4px 0 0",
    fontSize: 11,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    background: "#f1f5f9",
    margin: "4px -28px 0",
  },
  bioTextarea: {
    width: "100%",
    padding: "11px 14px",
    paddingBottom: 28,
    border: "1.5px solid #d1d9e6",
    borderRadius: 10,
    fontSize: 14,
    color: "#1a2340",
    background: "#f8faff",
    outline: "none",
    boxSizing: "border-box" as const,
    resize: "vertical" as const,
    fontFamily: "inherit",
    lineHeight: 1.6,
    transition: "border-color .2s",
  },
  charCounter: {
    position: "absolute" as const,
    bottom: 8,
    right: 10,
    fontSize: 11,
    color: "#94a3b8",
    pointerEvents: "none" as const,
  },
  btnPrimary: {
    padding: "10px 22px",
    background: "linear-gradient(135deg, #1d6ef5, #1558d4)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(29,110,245,0.35)",
  },
  btnUploadPhoto: {
    padding: "7px 16px",
    background: "#fff",
    color: "#374151",
    border: "1.5px solid #d1d9e6",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "border-color .2s",
  },
  inlineError: {
    margin: 0,
    fontSize: 12,
    color: "#dc2626",
    fontWeight: 500,
  },
  todoTile: {
    background: "#f8faff",
    border: "1.5px dashed #d1d9e6",
    borderRadius: 14,
    padding: "18px 16px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    alignItems: "flex-start",
  },
};
