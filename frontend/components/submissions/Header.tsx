import { useState, CSSProperties, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/router';
import { useAuth } from "@/hooks/useAuth";
import { logout } from '@/services/auth';
import { clearTokens } from '@/lib/tokens';
import { getProfile } from '@/services/profile/api';

interface HeaderProps {
  activePage?: string;
}

const NAV_LINKS = [
  { label: "Submissions", href: "/submissions",  roles: ["student", "professor"] },
  { label: "Assignments", href: "/assignments",  roles: ["student", "professor"] },
  { label: "Q&A Forums",  href: "/forum",       roles: ["student"] },
  { label: "Insights",    href: "/insights",     roles: ["student", "professor"] },
];

const PROFILE_AVATAR_KEY = 'profile_avatar_url';
const AVATAR_UPDATED_EVENT = 'profile-avatar-updated';

const normalizeAvatarUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function Header({ activePage = "" }: HeaderProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  const userName = user ? `${user.first_name} ${user.last_name}` : "—";
  const userRole = user?.role ?? "student";

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fromStorage = normalizeAvatarUrl(window.localStorage.getItem(PROFILE_AVATAR_KEY));
    setAvatarUrl(fromStorage);

    const onAvatarUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ avatarUrl?: string | null }>;
      setAvatarUrl(normalizeAvatarUrl(customEvent.detail?.avatarUrl ?? null));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PROFILE_AVATAR_KEY) return;
      setAvatarUrl(normalizeAvatarUrl(event.newValue));
    };

    window.addEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, onAvatarUpdated as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const profile = await getProfile();
        const latestAvatar = normalizeAvatarUrl(profile.profile?.avatar ?? null);
        if (cancelled) return;

        setAvatarUrl(latestAvatar);
        if (typeof window !== 'undefined') {
          if (latestAvatar) {
            window.localStorage.setItem(PROFILE_AVATAR_KEY, latestAvatar);
          } else {
            window.localStorage.removeItem(PROFILE_AVATAR_KEY);
          }
        }
      } catch {
        // Non-fatal: keep avatar from storage if request fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const renderProfileIcon = () => (
    <div style={styles.profileIcon}>
      {avatarUrl ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundImage: `url(${avatarUrl})`,
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
          }}
        />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="#c8d6f0" strokeWidth="2" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#c8d6f0" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [router.pathname]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
    } finally {
      clearTokens();
      router.replace('/login');
    }
  };

  return (
    <>
      {/* ── Responsive style overrides ── */}
      <style>{`
        .header-desktop-nav { display: flex; }
        .header-logout-btn  { display: flex; }
        .header-profile-info { display: flex; }
        .header-hamburger   { display: none; }

        @media (max-width: 1024px) {
          .header-desktop-nav .nav-link {
            padding: 8px 10px !important;
            font-size: 13px !important;
          }
        }

        @media (max-width: 768px) {
          .header-desktop-nav { display: none !important; }
          .header-logout-btn  { display: none !important; }
          .header-profile-info { display: none !important; }
          .header-hamburger   { display: flex !important; }
        }

        .mobile-drawer {
          position: fixed;
          top: 0; right: 0;
          height: 100%;
          width: 260px;
          background: #0d1b2a;
          border-left: 1px solid rgba(148,163,184,0.12);
          box-shadow: -8px 0 32px rgba(0,0,0,0.5);
          z-index: 200;
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mobile-drawer.open {
          transform: translateX(0);
        }

        .mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 199;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.28s ease;
        }
        .mobile-overlay.open {
          opacity: 1;
          pointer-events: all;
        }

        .drawer-nav-link {
          display: flex;
          align-items: center;
          color: #94a3b8;
          text-decoration: none;
          font-size: 15px;
          font-weight: 500;
          padding: 14px 24px;
          border-left: 3px solid transparent;
          transition: color .15s, background .15s, border-color .15s;
        }
        .drawer-nav-link:hover,
        .drawer-nav-link.active {
          color: #ffffff;
          background: rgba(148,163,184,0.08);
        }
        .drawer-nav-link.active {
          border-left-color: #1d6ef5;
          font-weight: 700;
        }

        .drawer-divider {
          height: 1px;
          background: rgba(148,163,184,0.12);
          margin: 12px 24px;
        }

        .drawer-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 24px;
          text-decoration: none;
        }
        .drawer-logout-btn {
          width: calc(100% - 48px);
          margin: 4px 24px 0;
          border: 1px solid rgba(148,163,184,0.4);
          background: transparent;
          color: #e2e8f0;
          border-radius: 8px;
          padding: 10px 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-align: center;
        }
        .drawer-logout-btn:hover {
          background: rgba(148,163,184,0.08);
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          {/* ── Left: logo + desktop nav ── */}
          <div style={styles.headerLeft}>
            <Link href="/" style={styles.logoLink}>
              <span aria-label="Go to homepage" style={{ display: "flex", alignItems: "center" }}>
                <Image
                  src="/esicodehub-logo.png"
                  alt="Logo"
                  width={52}
                  height={28}
                  className="object-contain"
                  priority
                />
              </span>
            </Link>

            <nav style={styles.desktopNav} className="header-desktop-nav">
              {NAV_LINKS.filter(({ roles }) => roles.includes(userRole)).map(({ label, href }) => {
                const isActive = activePage === label;
                const isHovered = hoveredNav === label;
                return (
                  <Link
                    key={label}
                    href={href}
                    className="nav-link"
                    style={{
                      ...styles.navLink,
                      ...(isActive ? styles.navLinkActive : {}),
                      ...(isHovered && !isActive ? styles.navLinkHover : {}),
                    }}
                    onMouseEnter={() => setHoveredNav(label)}
                    onMouseLeave={() => setHoveredNav(null)}
                  >
                    {label}
                    {isActive && <span style={styles.navActiveBar} />}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* ── Right: logout + profile (desktop) + hamburger (mobile) ── */}
          <div style={styles.headerRight}>
            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutBtn}
              className="header-logout-btn"
            >
              Logout
            </button>

            <Link href="/profile" style={styles.profileBtn} aria-label="Go to profile">
              {renderProfileIcon()}
              <div style={styles.profileInfo} className="header-profile-info">
                <span style={styles.profileName}>{userName}</span>
                <span style={styles.profileRole}>{userRole}</span>
              </div>
            </Link>
            <button
              type="button"
              className="header-hamburger"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              style={styles.hamburger}
            >
              <svg
                width="22" height="22" viewBox="0 0 22 22" fill="none"
                style={{ transition: "transform .2s" }}
              >
                {menuOpen ? (
                  /* X icon */
                  <>
                    <line x1="4" y1="4" x2="18" y2="18" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                    <line x1="18" y1="4" x2="4" y2="18" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                  </>
                ) : (
                  /* Burger icon */
                  <>
                    <line x1="3" y1="6"  x2="19" y2="6"  stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="11" x2="19" y2="11" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                    <line x1="3" y1="16" x2="19" y2="16" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile overlay ── */}
      <div
        className={`mobile-overlay${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile drawer ── */}
      <nav
        className={`mobile-drawer${menuOpen ? " open" : ""}`}
        aria-label="Mobile navigation"
      >
        {/* Drawer header */}
        <div style={{ padding: "4px 24px 16px", borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
          <Link href="/" aria-label="Go to homepage">
            <Image src="/esicodehub-logo.png" alt="Logo" width={52} height={28} className="object-contain" />
          </Link>
        </div>

        {/* Nav links */}
        <div style={{ flex: 1, paddingTop: 8 }}>
          {NAV_LINKS.filter(({ roles }) => roles.includes(userRole)).map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={`drawer-nav-link${activePage === label ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Divider + profile + logout */}
        <div className="drawer-divider" />

        <Link href="/profile" className="drawer-profile" aria-label="Go to profile">
          {renderProfileIcon()}
          <div style={styles.profileInfo}>
            <span style={styles.profileName}>{userName}</span>
            <span style={styles.profileRole}>{userRole}</span>
          </div>
        </Link>

        <button type="button" className="drawer-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </nav>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    background: "#0d1b2a",
    padding: "0 28px",
    position: "sticky",
    top: 0,
    zIndex: 100,
    boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
    borderRadius: "0 0 16px 16px",
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 4 },
  logoutBtn: {
    border: '1px solid rgba(148,163,184,0.4)',
    background: 'transparent',
    color: '#e2e8f0',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  logoLink: {
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
  },
  logo: { display: "flex", alignItems: "center", gap: 8 },
  desktopNav: { display: "flex", alignItems: "center", gap: 4, marginLeft: 16 },
  navLink: {
    position: "relative",
    color: "#94a3b8",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 14px",
    borderRadius: 8,
    transition: "color .15s, background .15s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  navLinkHover: { color: "#e2e8f0", background: "rgba(148,163,184,0.08)" },
  navLinkActive: { color: "#ffffff", fontWeight: 700 },
  navBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    background: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: '18px',
    textAlign: 'center',
    padding: '0 5px',
    boxShadow: '0 0 0 2px #0d1b2a',
  },
  navActiveBar: {
    position: "absolute",
    bottom: -1,
    left: "50%",
    transform: "translateX(-50%)",
    width: 24,
    height: 3,
    borderRadius: 2,
    background: "linear-gradient(90deg, #1d6ef5, #00c6ff)",
  },
  profileBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "none",
    border: "none",
    padding: "8px 12px",
    cursor: "pointer",
    borderRadius: 10,
    textDecoration: "none",
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1.5px solid rgba(148,163,184,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  profileInfo: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 },
  profileName: { color: "#e2e8f0", fontSize: 13, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap" },
  profileRole: { color: "#94a3b8", fontSize: 12, fontWeight: 400, lineHeight: 1.2, whiteSpace: "nowrap" },
  hamburger: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};
