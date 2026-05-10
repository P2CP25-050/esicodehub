import { useState, useEffect, useRef, ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  getProfile,
  updateBio,
  uploadAvatar,
  getRecentActivity,
} from "@/services/profile/api";
import type {
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
    new CustomEvent(AVATAR_UPDATED_EVENT, { detail: { avatarUrl: avatar } }),
  );
};

// ─── Ink & Paper CSS (mirrors home.tsx design system) ────────────────────────
const PROFILE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  :root {
    --ink:          #000000;
    --paper:        #ffffff;
    --navy:         #051650;
    --rule:         1.5px solid #000;
    --border-soft:  1px solid #e0e0e0;
    --surface:      #f7f7f5;
    --surface-2:    #f0efec;
    --text-muted:   #666666;
    --text-sub:     #444444;
    --red:          #cc0000;
    --green:        #1a7a3c;
    --orange:       #b85c00;
    --blue:         #1a4fa8;
    --font-display: 'Playfair Display', Georgia, serif;
    --font-mono:    'Space Mono', monospace;
    --font-body:    'DM Sans', sans-serif;
    --radius:       0px;
  }

  /* ── Page shell ── */
  .pf-page {
    min-height: 100vh;
    background: var(--paper);
    font-family: var(--font-body);
    color: var(--ink);
    position: relative;
  }

  /* Diagonal navy stripe on the right */
  .pf-page::before {
    content: '';
    position: fixed;
    top: 0; right: 0;
    width: 280px;
    height: 100vh;
    background: var(--navy);
    clip-path: polygon(80px 0, 100% 0, 100% 100%, 0 100%);
    z-index: 0;
    pointer-events: none;
  }

  /* Horizontal rule near top */
  .pf-page::after {
    content: '';
    position: fixed;
    top: 64px; left: 0; right: 0;
    height: 1.5px;
    background: var(--ink);
    z-index: 0;
    pointer-events: none;
  }

  /* ── Container ── */
  .pf-container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 40px 28px 80px;
    position: relative;
    z-index: 1;
  }

  /* ── Breadcrumb ── */
  .pf-breadcrumb {
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
  .pf-breadcrumb-link {
    color: var(--navy);
    font-weight: 700;
    text-decoration: none;
    border-bottom: 1.5px solid var(--navy);
    padding-bottom: 1px;
    transition: opacity 0.15s;
  }
  .pf-breadcrumb-link:hover { opacity: 0.65; }
  .pf-breadcrumb-sep { color: #aaa; }

  /* ── Page header ── */
  .pf-page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 28px;
    border-bottom: var(--rule);
    margin-bottom: 32px;
  }
  .pf-page-title {
    font-family: var(--font-display);
    font-size: 44px;
    font-weight: 900;
    color: var(--ink);
    margin: 0 0 6px;
    line-height: 1.05;
    letter-spacing: -0.02em;
  }
  .pf-page-title span { color: var(--navy); }
  .pf-page-subtitle {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 700;
    margin: 0;
  }

  /* ── Two-column layout ── */
  .pf-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
    align-items: start;
  }

  /* ── Cards ── */
  .pf-card {
    background: var(--paper);
    border: var(--rule);
    padding: 28px;
    position: relative;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .pf-card:last-child { margin-bottom: 0; }

  /* Corner tick mark */
  .pf-card::after {
    content: '';
    position: absolute;
    bottom: -1px; right: -1px;
    width: 20px; height: 20px;
    border-bottom: 3px solid var(--navy);
    border-right: 3px solid var(--navy);
  }

  /* Accent tops */
  .pf-card-identity  { border-top: 4px solid var(--navy); }
  .pf-card-bio       { border-top: 4px solid var(--ink); }
  .pf-card-activity  { border-top: 4px solid var(--ink); }

  /* ── Section title ── */
  .pf-section-title {
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
  .pf-field { margin-bottom: 16px; }
  .pf-field:last-child { margin-bottom: 0; }
  .pf-field-label {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 3px;
    display: block;
  }
  .pf-field-value {
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    color: var(--ink);
    margin: 0;
  }
  .pf-field-hint {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--text-muted);
    margin: 3px 0 0;
    font-style: italic;
  }
  .pf-divider {
    height: 1px;
    background: #e0e0e0;
    margin: 0 -28px 20px;
  }

  /* ── Avatar area ── */
  .pf-avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .pf-avatar-ring {
  width: 96px;
  height: 96px;
  border: 2px solid var(--ink);
  border-radius: 50%;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}
  .pf-upload-btn {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 7px 14px;
    background: var(--paper);
    color: var(--ink);
    border: 1.5px solid var(--ink);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .pf-upload-btn:hover:not(:disabled) {
    background: var(--ink);
    color: var(--paper);
  }
  .pf-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Role badge ── */
  .pf-role-badge {
    display: inline-block;
    padding: 3px 10px;
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    border: 1.5px solid var(--ink);
    margin-top: 4px;
  }
  .pf-role-badge.professor { background: var(--navy); color: var(--paper); border-color: var(--navy); }
  .pf-role-badge.student   { background: var(--ink);  color: var(--paper); }

  /* ── Bio textarea ── */
  .pf-bio-textarea {
    width: 100%;
    padding: 12px 14px 28px;
    border: 1.5px solid var(--ink);
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink);
    background: var(--surface);
    outline: none;
    box-sizing: border-box;
    resize: vertical;
    line-height: 1.6;
    transition: border-color 0.15s;
    border-radius: 0;
  }
  .pf-bio-textarea:focus { border-color: var(--navy); }
  .pf-char-counter {
    position: absolute;
    bottom: 8px; right: 10px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    pointer-events: none;
    letter-spacing: 0.08em;
  }

  /* ── Primary button ── */
  .pf-btn-primary {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 10px 20px;
    background: var(--navy);
    color: var(--paper);
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .pf-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .pf-btn-primary:hover:not(:disabled) { opacity: 0.8; }

  /* ── Activity list ── */
  .pf-activity-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 0;
    border-bottom: var(--border-soft);
  }
  .pf-activity-item:last-child { border-bottom: none; }
  .pf-activity-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .pf-activity-label {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    color: var(--ink);
    margin: 0;
    line-height: 1.4;
  }
  .pf-activity-sub {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    margin: 2px 0 0;
    letter-spacing: 0.06em;
  }
  .pf-activity-time {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    flex-shrink: 0;
    margin-top: 2px;
    letter-spacing: 0.06em;
  }

  /* ── Inline messages ── */
  .pf-error   { font-size: 12px; color: var(--red);   font-weight: 600; margin: 6px 0 0; }
  .pf-success { font-size: 12px; color: var(--green); font-weight: 600; margin: 6px 0 0; }
  .pf-muted   { font-size: 13px; color: var(--text-muted); margin: 0; }

  /* ── Member since ── */
  .pf-member-since {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    margin: 12px 0 0;
  }

  /* ── Animations ── */
  @keyframes pf-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pf-spin { to { transform: rotate(360deg); } }

  .pf-animate   { opacity: 0; animation: pf-fade-up 0.4s ease forwards; }
  .pf-animate-1 { animation-delay: 0.04s; }
  .pf-animate-2 { animation-delay: 0.10s; }
  .pf-animate-3 { animation-delay: 0.17s; }
  .pf-animate-4 { animation-delay: 0.24s; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .pf-layout { grid-template-columns: 1fr; }
    .pf-page-title { font-size: 32px; }
    .pf-page::before { display: none; }
  }
  @media (max-width: 600px) {
    .pf-container { padding: 20px 16px 60px; }
    .pf-page-title { font-size: 26px; }
    .pf-card { padding: 20px; }
    .pf-divider { margin: 0 -20px 20px; }
  }
`;

// ─── Initials Avatar ─────────────────────────────────────────────────────────
function InitialsAvatar({
  firstName,
  lastName,
  size = 96,
}: {
  firstName: string;
  lastName: string;
  size?: number;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const idx =
    ((firstName?.charCodeAt(0) ?? 0) + (lastName?.charCodeAt(0) ?? 0)) % 2;
  const bg = idx === 0 ? "var(--navy)" : "var(--ink)";
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontFamily: "var(--font-display)",
        fontWeight: 900,
        color: "#fff",
        letterSpacing: 2,
        flexShrink: 0,
        userSelect: "none",
        borderRadius: "50%",   // added
      }}
    >
      {initials || "?"}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 28 }: { size?: number }) {
  return (
     <div style={{
       width: 96, height: 96,
       background: "var(--navy)",
       display: "flex",
       alignItems: "center",
       justifyContent: "center",
       borderRadius: "50%",   // added
    }}>
  
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
  return `${Math.floor(days / 30)}mo ago`;
}

// ─── Member Since ─────────────────────────────────────────────────────────────
function memberSince(dateStr: string): string {
  const d = new Date(dateStr);
  return `Member since ${d.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

// ─── Profile Page ─────────────────────────────────────────────────────────────
function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  const [bio, setBio] = useState<string>("");
  const [savedBio, setSavedBio] = useState<string>("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioSuccess, setBioSuccess] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Inject styles
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "pf-ink-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = PROFILE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

  // Load profile data
  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return;
    (async () => {
      try {
        const [profile, activityData] = await Promise.all([
          getProfile(),
          getRecentActivity(),
        ]);
        setBio(profile.profile?.bio ?? "");
        setSavedBio(profile.profile?.bio ?? "");
        const loadedAvatar = profile.profile?.avatar ?? null;
        setAvatarUrl(loadedAvatar);
        setAvatarLoadError(false);
        syncAvatarForHeader(loadedAvatar);
        setProfileData(profile);
        setActivity(activityData);
      } catch (err) {
        console.error("Failed to load profile data", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, isLoading, user]);

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
    setAvatarLoadError(false);
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
      const newAvatar = result.avatar || null;
      setAvatarUrl(newAvatar);
      setAvatarLoadError(false);
      syncAvatarForHeader(newAvatar);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setAvatarUploading(false);
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
  const isProfessor = role === "professor";

  return (
    <div className="pf-page">
      <Header />
      <div className="pf-container">

        {/* Breadcrumb */}
        <nav className="pf-breadcrumb pf-animate pf-animate-1">
          <Link href="/submissions" className="pf-breadcrumb-link">~/home</Link>
          <span className="pf-breadcrumb-sep">/</span>
          <span>profile</span>
        </nav>

        {/* Page header */}
        <div className="pf-page-header pf-animate pf-animate-1">
          <div>
            <h1 className="pf-page-title">
              {firstName ? (
                <><span>{firstName}</span>&rsquo;s Profile</>
              ) : (
                <>My <span>Profile</span></>
              )}
            </h1>
            <p className="pf-page-subtitle">
              {isProfessor ? "Professor Account" : "Student Account"}
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="pf-layout">

          {/* ── LEFT COLUMN ── */}
          <div>

            {/* Identity card */}
            <div className="pf-card pf-card-identity pf-animate pf-animate-2">

              {/* Avatar */}
              <div className="pf-avatar-wrap">
                <div className="pf-avatar-ring">
  {avatarUploading ? (
    <div style={{
      width: 96, height: 96,
      background: "var(--navy)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "50%",
    }}>
      <Spinner size={28} />
    </div>
  ) : avatarUrl && !avatarLoadError ? (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Image
        src={avatarUrl}
        alt="Avatar"
        fill
        sizes="96px"
        style={{ objectFit: "cover" }}
        unoptimized
        onError={() => setAvatarLoadError(true)}
      />
    </div>
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
                  className="pf-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? "Uploading…" : "Upload photo"}
                </button>
                {avatarError && <p className="pf-error">{avatarError}</p>}
              </div>

              <div className="pf-divider" />

              {/* Identity fields */}
              <div className="pf-field">
                <label className="pf-field-label">Full Name</label>
                <p className="pf-field-value">{firstName} {lastName}</p>
                <p className="pf-field-hint">Pulled from the ESI database — cannot be changed here.</p>
              </div>

              <div className="pf-field">
                <label className="pf-field-label">Email</label>
                <p className="pf-field-value">{email}</p>
              </div>

              <div className="pf-field">
                <label className="pf-field-label">Role</label>
                <span className={`pf-role-badge ${isProfessor ? "professor" : "student"}`}>
                  {isProfessor ? "Professor" : "Student"}
                </span>
              </div>

              {schoolId && (
                <div className="pf-field">
                  <label className="pf-field-label">School ID</label>
                  <p className="pf-field-value" style={{ fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: 1 }}>
                    {schoolId}
                  </p>
                </div>
              )}

              {createdAt && (
                <p className="pf-member-since">🗓 {memberSince(createdAt)}</p>
              )}
            </div>

            {/* Bio card */}
            <div className="pf-card pf-card-bio pf-animate pf-animate-3">
              <p className="pf-section-title">Bio</p>
              <div style={{ position: "relative" }}>
                <textarea
                  className="pf-bio-textarea"
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= 300) setBio(e.target.value);
                  }}
                  placeholder="Tell people a little about yourself…"
                  rows={4}
                />
                <span className="pf-char-counter">{bio.length}/300</span>
              </div>

              {bioError && <p className="pf-error">{bioError}</p>}
              {bioSuccess && <p className="pf-success">✓ Bio saved!</p>}

              {bioChanged && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    className="pf-btn-primary"
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
          <div>
            {/* Recent Activity card */}
            <div className="pf-card pf-card-activity pf-animate pf-animate-4">
              <p className="pf-section-title">Recent Activity</p>

              {loading ? (
                <p className="pf-muted">Loading activity…</p>
              ) : activity.length === 0 ? (
                <p className="pf-muted">No activity yet.</p>
              ) : (
                <div>
                  {activity.map((item, i) => (
                    <div key={i} className="pf-activity-item">
                      <span className="pf-activity-icon">{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="pf-activity-label">{item.label}</p>
                        {item.sub && <p className="pf-activity-sub">{item.sub}</p>}
                      </div>
                      <span className="pf-activity-time">{timeAgo(item.created_at)}</span>
                    </div>
                  ))}
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