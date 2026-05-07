import { useState, CSSProperties, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/router';
import { useAuth } from "@/context/AuthContext";
import { logout } from '@/services/auth';
import { clearTokens } from '@/lib/tokens';
import { getProfile } from '@/services/profile/api';
import { useNotifications } from '@/hooks/useNotifications';
import type { Notification } from '@/services/notifications/notifications';

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

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function NotificationTypeIcon({ type }: { type: string }) {
  const icons: Record<string, { path: string; color: string }> = {
    success: { color: '#22c55e', path: 'M5 13l4 4L19 7' },
    warning: { color: '#f59e0b', path: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
    error:   { color: '#ef4444', path: 'M6 18L18 6M6 6l12 12' },
    info:    { color: '#60a5fa', path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  };
  const icon = icons[type] ?? icons.info;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={icon.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={icon.path} />
    </svg>
  );
}

export default function Header({ activePage = "" }: HeaderProps) {
  const [hoveredNav, setHoveredNav]   = useState<string | null>(null);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [avatarUrl, setAvatarUrl]     = useState<string | null>(null);
  const [bellOpen, setBellOpen]       = useState(false);
  const bellRef                       = useRef<HTMLDivElement>(null);
  const router                        = useRouter();
  const { user }                      = useAuth();
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

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
          if (latestAvatar) window.localStorage.setItem(PROFILE_AVATAR_KEY, latestAvatar);
          else window.localStorage.removeItem(PROFILE_AVATAR_KEY);
        }
      } catch { /* Non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!bellOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  useEffect(() => { setMenuOpen(false); }, [router.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleLogout = async () => {
    try { await logout(); } catch { }
    finally { clearTokens(); router.replace('/login'); }
  };

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) {
      try { await markOneRead(n.id); } catch { /* non-fatal */ }
    }
    setBellOpen(false);
    router.push(n.link);
  };

  const renderProfileIcon = () => (
    <div style={styles.profileIcon}>
      {avatarUrl ? (
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundImage: `url(${avatarUrl})`, backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundSize: 'cover' }} />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="#64748b" strokeWidth="2" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );

  const visibleNotifications = notifications.slice(0, 10);

  return (
    <>
      <style>{`
        .header-desktop-nav { display: flex; }
        .header-logout-btn  { display: flex; }
        .header-profile-info { display: flex; }
        .header-hamburger   { display: none; }

        @media (max-width: 1024px) {
          .header-desktop-nav .nav-link {
            padding: 6px 10px !important;
            font-size: 13px !important;
          }
        }

        @media (max-width: 768px) {
          .header-desktop-nav { display: none !important; }
          .header-logout-btn  { display: none !important; }
          .header-profile-info { display: none !important; }
          .header-hamburger   { display: flex !important; }
          .header-bell        { display: none !important; }
        }

        .mobile-drawer {
          position: fixed;
          top: 0; right: 0;
          height: 100%;
          width: 260px;
          background: #0d1b2a;
          border-left: 1px solid rgba(148,163,184,0.2);
          box-shadow: -8px 0 32px rgba(0,0,0,0.4);
          z-index: 200;
          display: flex;
          flex-direction: column;
          padding: 20px 0;
          transform: translateX(100%);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mobile-drawer.open { transform: translateX(0); }

        .mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.75);
          z-index: 199;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.28s ease;
        }
        .mobile-overlay.open { opacity: 1; pointer-events: all; }

        .drawer-nav-link {
          display: flex;
          align-items: center;
          color: #94a3b8;
          text-decoration: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          padding: 12px 24px;
          border-left: 3px solid transparent;
          transition: color .15s, background .15s, border-color .15s;
        }
        .drawer-nav-link:hover,
        .drawer-nav-link.active { color: #ffffff; background: rgba(148,163,184,0.1); }
        .drawer-nav-link.active { border-left-color: #1d6ef5; font-weight: 700; }

        .drawer-divider { height: 1px; background: rgba(148,163,184,0.15); margin: 12px 24px; }

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
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 10px;
          cursor: pointer;
          text-align: center;
          transition: background .15s, color .15s, border-color .15s;
        }
        .drawer-logout-btn:hover { background: rgba(148,163,184,0.1); border-color: #1d6ef5; color: #fff; }

        .header-logout-btn:hover { background: rgba(148,163,184,0.1) !important; border-color: #1d6ef5 !important; color: #fff !important; }

        .header-profile-btn:hover { background: rgba(148,163,184,0.08) !important; }
        .header-profile-btn:hover .profile-icon-ring { border-color: #1d6ef5 !important; }

        .header-hamburger-btn:hover { background: rgba(148,163,184,0.1) !important; border-radius: 6px; }

        .drawer-profile:hover { background: rgba(148,163,184,0.1); color: #fff; }

        .notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: background .12s;
          border-bottom: 1px solid rgba(148,163,184,0.1);
        }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: rgba(148,163,184,0.08); }
        .notif-item.unread { background: rgba(29,110,245,0.08); }
        .notif-item.unread:hover { background: rgba(29,110,245,0.15); }

        .notif-mark-all {
          background: none;
          border: none;
          color: #60a5fa;
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          padding: 0;
        }
        .notif-mark-all:hover { text-decoration: underline; }

        .bell-btn {
          position: relative;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          transition: background .15s, color .15s;
        }
        .bell-btn:hover { background: rgba(148,163,184,0.1); color: #fff; }

        .drawer-notif-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px 8px;
        }
        .drawer-notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 24px;
          cursor: pointer;
          transition: background .12s;
          border-bottom: 1px solid rgba(148,163,184,0.1);
        }
        .drawer-notif-item:last-child { border-bottom: none; }
        .drawer-notif-item:hover { background: rgba(148,163,184,0.08); }
        .drawer-notif-item.unread { background: rgba(29,110,245,0.08); }
        .drawer-notif-item.unread:hover { background: rgba(29,110,245,0.15); }
        .drawer-notif-empty {
          padding: 16px 24px;
          color: #94a3b8;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <Link href="/" style={styles.logoLink}>
              <span style={styles.logo}>
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
                const isActive  = activePage === label;
                const isHovered = hoveredNav === label;
                return (
                  <Link
                    key={label}
                    href={href}
                    className="nav-link"
                    style={{
                      ...styles.navLink,
                      ...(isActive ? styles.navLinkActive : {}),
                      ...(isHovered && !isActive ? styles.navLinkHover : {})
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

          <div style={styles.headerRight}>
            <div ref={bellRef} className="header-bell" style={{ position: 'relative' }}>
              <button
                type="button"
                className="bell-btn"
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                onClick={() => setBellOpen(v => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span style={styles.bellBadge}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={styles.bellDropdown}>
                  <div style={styles.bellDropdownHeader}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#60a5fa' }}>
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="notif-mark-all"
                        onClick={async () => { await markAllRead(); }}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                    {visibleNotifications.length === 0 ? (
                      <div style={styles.bellEmpty}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                        <span style={{ color: '#64748b', fontSize: 12, marginTop: 8, fontFamily: "'DM Sans', sans-serif" }}>No notifications yet</span>
                      </div>
                    ) : (
                      visibleNotifications.map(n => (
                        <div
                          key={n.id}
                          className={`notif-item${!n.is_read ? ' unread' : ''}`}
                          onClick={() => handleNotificationClick(n)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(n); }}
                          aria-label={n.title}
                        >
                          <div style={{ marginTop: 2 }}>
                            <NotificationTypeIcon type={n.type} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, color: n.is_read ? '#94a3b8' : '#f1f5f9', fontSize: 13, fontWeight: n.is_read ? 400 : 600, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.title}
                            </p>
                            <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                          {!n.is_read && <span style={styles.unreadDot} aria-hidden="true" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutBtn}
              className="header-logout-btn header-logout-btn"
            >
              Logout
            </button>

            <Link href="/profile" style={styles.profileBtn} className="header-profile-btn" aria-label="Go to profile">
              {renderProfileIcon()}
              <div style={styles.profileInfo} className="header-profile-info">
                <span style={styles.profileName}>{userName}</span>
                <span style={styles.profileRole}>{userRole}</span>
              </div>
            </Link>

            <button
              type="button"
              className="header-hamburger header-hamburger-btn"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              style={styles.hamburger}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                {menuOpen ? (
                  <>
                    <line x1="4" y1="4" x2="18" y2="18" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                    <line x1="18" y1="4" x2="4" y2="18" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" />
                  </>
                ) : (
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

      <div
        className={`mobile-overlay${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <nav className={`mobile-drawer${menuOpen ? " open" : ""}`} aria-label="Mobile navigation">
        <div style={{ padding: "4px 24px 16px", borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
          <Link href="/" aria-label="Go to homepage">
            <Image src="/esicodehub-logo.png" alt="Logo" width={52} height={28} className="object-contain" />
          </Link>
        </div>

        <div style={{ flex: 1, paddingTop: 8 }}>
          {NAV_LINKS.filter(({ roles }) => roles.includes(userRole)).map(({ label, href }) => (
            <Link key={label} href={href} className={`drawer-nav-link${activePage === label ? " active" : ""}`}>
              {label}
            </Link>
          ))}
        </div>

        <div className="drawer-divider" />

        <div className="drawer-notif-header">
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#60a5fa' }}>Notifications</span>
          {unreadCount > 0 && (
            <button type="button" className="notif-mark-all" onClick={async () => { await markAllRead(); }}>
              Mark all read
            </button>
          )}
        </div>

        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {visibleNotifications.length === 0 ? (
            <div className="drawer-notif-empty">No notifications yet</div>
          ) : (
            visibleNotifications.map(n => (
              <div
                key={n.id}
                className={`drawer-notif-item${!n.is_read ? ' unread' : ''}`}
                onClick={() => { handleNotificationClick(n); setMenuOpen(false); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { handleNotificationClick(n); setMenuOpen(false); } }}
                aria-label={n.title}
              >
                <div style={{ marginTop: 2 }}><NotificationTypeIcon type={n.type} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: n.is_read ? '#94a3b8' : '#f1f5f9', fontSize: 13, fontWeight: n.is_read ? 400 : 600, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.title}
                  </p>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span style={styles.unreadDot} aria-hidden="true" />}
              </div>
            ))
          )}
        </div>

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
    borderBottom: "1px solid rgba(148,163,184,0.2)",
    padding: "0 28px",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    maxWidth: 1200,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 64,
  },
  headerLeft:  { display: "flex", alignItems: "center", gap: 16 },
  headerRight: { display: "flex", alignItems: "center", gap: 4 },
  logoutBtn: {
    border: "1px solid rgba(148,163,184,0.4)",
    background: "transparent",
    color: "#e2e8f0",
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "8px 10px",
    cursor: "pointer",
    transition: "background .15s, color .15s, border-color .15s",
  },
  logoLink:   { display: "flex", alignItems: "center", textDecoration: "none" },
  logo:       { display: "flex", alignItems: "center", gap: 8 },
  desktopNav: { display: "flex", alignItems: "center", gap: 4, marginLeft: 16 },
  navLink: {
    position: "relative",
    color: "#94a3b8",
    textDecoration: "none",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 14px",
    transition: "color .15s, background .15s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  navLinkHover:  { color: "#ffffff", background: "rgba(148,163,184,0.08)" },
  navLinkActive: { color: "#ffffff", fontWeight: 700 },
  navActiveBar: {
    position: "absolute",
    bottom: -1,
    left: "50%",
    transform: "translateX(-50%)",
    width: 24,
    height: 3,
    background: "#1d6ef5",
  },
  profileBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "none",
    border: "none",
    padding: "8px 12px",
    cursor: "pointer",
    textDecoration: "none",
    transition: "background .15s",
    borderRadius: 8,
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
  profileName: { color: "#e2e8f0", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.3, whiteSpace: "nowrap" },
  profileRole: { color: "#94a3b8", fontSize: 12, fontWeight: 400, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.2, whiteSpace: "nowrap" },
  hamburger: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .15s",
    borderRadius: 6,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    background: '#ef4444',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    lineHeight: '16px',
    textAlign: 'center',
    padding: '0 4px',
    boxShadow: '0 0 0 2px #0d1b2a',
    pointerEvents: 'none',
  },
  bellDropdown: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: 'min(320px, calc(100vw - 16px))',
    background: '#0f2136',
    border: '1px solid rgba(148,163,184,0.2)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    zIndex: 150,
    overflow: 'hidden',
  },
  bellDropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px 10px',
    borderBottom: '1px solid rgba(148,163,184,0.1)',
  },
  bellEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#1d6ef5',
    flexShrink: 0,
    marginTop: 4,
  },
};
