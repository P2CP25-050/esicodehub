"use client";

import { useEffect, useState, CSSProperties } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // exp is in seconds
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

type AuthState = "checking" | "authorized" | "denied";

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [countdown, setCountdown] = useState(5);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setAuthState(isTokenValid(token) ? "authorized" : "denied");
  }, []);

  // Countdown redirect when denied
  useEffect(() => {
    if (authState !== "denied") return;
    if (countdown === 0) {
      router.push("/login");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [authState, countdown, router]);

  if (authState === "checking") {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          {/* Lock icon */}
          <div style={styles.iconWrap}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h1 style={styles.title}>Access Denied</h1>
          <p style={styles.subtitle}>
            You need to be logged in to view this page.
          </p>

          <div style={styles.countdownWrap}>
            <div
              style={{
                ...styles.countdownRing,
                background: `conic-gradient(#2563eb ${(countdown / 5) * 360}deg, #dbeafe 0deg)`,
              }}
            >
              <div style={styles.countdownInner}>
                <span style={styles.countdownNum}>{countdown}</span>
              </div>
            </div>
            <p style={styles.countdownText}>Redirecting to login…</p>
          </div>

          <div style={styles.actions}>
            <button style={styles.btnPrimary} onClick={() => router.push("/login")}>
              Go to Login
            </button>
            <button style={styles.btnOutline} onClick={() => router.back()}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, CSSProperties> = {
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f4ff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  // Spinner (checking state)
  spinner: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "3px solid #dbeafe",
    borderTopColor: "#2563eb",
    animation: "spin 0.7s linear infinite",
  },
  // Access denied card
  card: {
    background: "#fff",
    borderRadius: 20,
    padding: "48px 40px 40px",
    boxShadow: "0 8px 40px rgba(30,60,120,0.10)",
    border: "1px solid #e2e8f6",
    textAlign: "center",
    maxWidth: 400,
    width: "100%",
  },
  iconWrap: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "#eff6ff",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0d1b2a",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    margin: "0 0 28px",
    lineHeight: 1.6,
  },
  // Countdown ring
  countdownWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
  },
  countdownRing: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.5s linear",
  },
  countdownInner: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownNum: {
    fontSize: 20,
    fontWeight: 800,
    color: "#2563eb",
  },
  countdownText: {
    fontSize: 13,
    color: "#94a3b8",
    margin: 0,
  },
  // Buttons
  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
  },
  btnPrimary: {
    padding: "11px 24px",
    background: "linear-gradient(135deg, #1d6ef5, #1558d4)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(29,110,245,0.30)",
  },
  btnOutline: {
    padding: "11px 20px",
    background: "#fff",
    color: "#374151",
    border: "1.5px solid #d1d9e6",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};