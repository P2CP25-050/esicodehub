import { useEffect, useState, CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/router';
import { useAuth } from "@/hooks/useAuth";
import { logout } from '@/services/auth';
import { clearTokens } from '@/lib/tokens';
import { listAssignments, getMySubmission } from '@/services/assignments';
import type { AssignmentSubmission } from '@/services/assignments';

interface HeaderProps {
  activePage?: string;
}

const NAV_LINKS = [
  { label: "Submissions", href: "/submissions" },
  { label: "Assignments", href: "/assignments" },
  { label: "Q&A Forums",   href: "/forums" },
  { label: "Insights",    href: "/insights" },
];

const REVIEW_SIGNATURE_UPDATED_EVENT = 'assignment-review-signature-updated';

const getReviewNotificationStorageKey = (submissionId: number): string =>
  `assignment-review:last-seen:${submissionId}`;

const buildReviewSignature = (submission?: AssignmentSubmission | null): string => {
  if (!submission || !submission.has_reviews) return 'none';

  const reviews = (submission.reviews ?? []).slice().sort((a, b) => a.id - b.id);
  if (reviews.length === 0) {
    return `count:${submission.reviews_count}`;
  }

  return reviews
    .map((review) => {
      const commentCount = review.comments?.length ?? 0;
      const gradeLabel = review.grade == null ? 'null' : String(review.grade);
      return `${review.id}:${review.updated_at}:${gradeLabel}:${commentCount}`;
    })
    .join('|');
};

export default function Header({ activePage = "New Submission" }: HeaderProps) {
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [assignmentReviewAlerts, setAssignmentReviewAlerts] = useState(0);
  const router = useRouter();
  const { user } = useAuth();

  const userName = user ? `${user.first_name} ${user.last_name}` : "—";
  const userRole = user?.role ?? "student";

  useEffect(() => {
    if (user?.role !== 'student') {
      setAssignmentReviewAlerts(0);
      return;
    }

    let cancelled = false;
    let syncing = false;

    const refreshAssignmentsBadge = async () => {
      if (syncing) return;
      syncing = true;

      try {
        const response = await listAssignments();
        const submittedAssignments = response.results.filter((assignment) =>
          Boolean(assignment.has_submitted)
        );

        if (submittedAssignments.length === 0) {
          if (!cancelled) setAssignmentReviewAlerts(0);
          return;
        }

        let unseenCount = 0;

        for (const assignment of submittedAssignments) {
          try {
            const submission = await getMySubmission(assignment.id);
            const signature = buildReviewSignature(submission);
            if (signature === 'none') continue;

            let previousSignature: string | null = null;
            try {
              previousSignature = window.localStorage.getItem(
                getReviewNotificationStorageKey(submission.id)
              );
            } catch {
              previousSignature = null;
            }

            if (previousSignature !== signature) {
              unseenCount += 1;
            }
          } catch {
          }
        }

        if (!cancelled) {
          setAssignmentReviewAlerts(unseenCount);
        }
      } catch {
        if (!cancelled) {
          setAssignmentReviewAlerts(0);
        }
      } finally {
        syncing = false;
      }
    };

    void refreshAssignmentsBadge();

    const interval = window.setInterval(() => {
      void refreshAssignmentsBadge();
    }, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshAssignmentsBadge();
      }
    };

    const onFocus = () => {
      void refreshAssignmentsBadge();
    };

    const onReviewSignatureUpdated = () => {
      void refreshAssignmentsBadge();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener(REVIEW_SIGNATURE_UPDATED_EVENT, onReviewSignatureUpdated);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(REVIEW_SIGNATURE_UPDATED_EVENT, onReviewSignatureUpdated);
    };
  }, [user?.role]);

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
    <header style={styles.header}>
      <div style={styles.headerInner}>
        <div style={styles.headerLeft}>
          <Link href="/" style={styles.logoLink}>
            <div style={styles.logo}>
              <Image
                src="/esicodehub-logo.png"
                alt="Logo"
                width={52}
                height={28}
                className="object-contain"
                priority
              />
            </div>
          </Link>

          <nav style={styles.desktopNav}>
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = activePage === label;
              const isHovered = hoveredNav === label;
              const showReviewBadge =
                userRole === 'student' &&
                label === 'Assignments' &&
                assignmentReviewAlerts > 0;

              return (
                <a
                  key={label}
                  href={href}
                  style={{
                    ...styles.navLink,
                    ...(isActive ? styles.navLinkActive : {}),
                    ...(isHovered && !isActive ? styles.navLinkHover : {}),
                  }}
                  onMouseEnter={() => setHoveredNav(label)}
                  onMouseLeave={() => setHoveredNav(null)}
                >
                  <span>{label}</span>
                  {showReviewBadge && (
                    <span
                      style={styles.navBadge}
                      aria-label={`${assignmentReviewAlerts} unseen review notification${assignmentReviewAlerts > 1 ? 's' : ''}`}
                    >
                      {assignmentReviewAlerts > 9 ? '9+' : assignmentReviewAlerts}
                    </span>
                  )}
                  {isActive && <span style={styles.navActiveBar} />}
                </a>
              );
            })}
          </nav>
        </div>

        
        <div style={styles.headerRight}>
          <button type="button" onClick={handleLogout} style={styles.logoutBtn}>
            Logout
          </button>
          <a href="/profile" style={styles.profileBtn} aria-label="Go to profile">
            <div style={styles.profileIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="#c8d6f0" strokeWidth="2" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#c8d6f0" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={styles.profileInfo}>
              <span style={styles.profileName}>{userName}</span>
              <span style={styles.profileRole}>{userRole}</span>
            </div>
          </a>
        </div>
      </div>
    </header>
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
};
