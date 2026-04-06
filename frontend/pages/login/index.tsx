"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { login } from '@/services/auth';
import { saveTokens } from '@/lib/tokens';
import { AxiosError } from 'axios';

import Particles from "@/components/auth/Particles";
import PillButton from "@/components/auth/PillButton";
import InputRow from "@/components/auth/InputRow";
import BackButton from "@/components/auth/BackButton";
import Logo from "@/components/auth/Logo";
import { PublicRoute } from "@/components/PublicRoute";

// ─── Types ───────────────────────────────────────────────
type Page = "Login";

// ─── Ghost pill button ────────────────────────────────────
function GhostButton({
  children,
  onClick,
  delay = 0,
}: {
  children: React.ReactNode;
  onClick: () => void;
  delay?: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: 28,
        border: `1.5px solid ${hovered ? "#3b82f6" : "#2a2a2a"}`,
        background: "transparent",
        color: hovered ? "#3b82f6" : "#888",
        fontFamily: "'Rajdhani', sans-serif",
        fontSize: 15,
        fontWeight: 600,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "border-color 0.2s, color 0.2s",
        animation: `fadeUp 0.5s ${delay}s both`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Error / success message ──────────────────────────────
function Message({ text, type }: { text: string; type: "error" | "success" }) {
  return (
    <div
      style={{
        background:
          type === "error" ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
        border: `1px solid ${
          type === "error"
            ? "rgba(239,68,68,0.3)"
            : "rgba(34,197,94,0.3)"
        }`,
        borderRadius: 8,
        padding: "9px 13px",
        color: type === "error" ? "#f87171" : "#4ade80",
        fontSize: 13,
        fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 600,
        marginBottom: 12,
        animation: "fadeUp 0.3s both",
      }}
    >
      {text}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
function LoginPageContent() {
  const router = useRouter();
  const [page] = useState<Page>("Login");
  const [cardKey] = useState(0);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailShake, setEmailShake] = useState(false);
  const [passwordShake, setPasswordShake] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const isEsiEmail = (v: string) => v.toLowerCase().endsWith("@esi.dz");

  const shake = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 600);
  };

  const handleLogin = async () => {
    setLoginError("");
    let EmailError = false;
    let PasswordError = false;
    let DomainError = false;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      shake(setEmailShake);
      EmailError = true;
    } else if (!isEsiEmail(email)) {
      shake(setEmailShake);
      DomainError = true;
    }
    if (!password || password.length < 8) {
      shake(setPasswordShake);
      PasswordError = true;
    }

    if (EmailError && (PasswordError || DomainError)) {
      setLoginError("Invalid email and password. Please try again.");
      return;
    } else if (EmailError) {
      setLoginError("Invalid email. Please try again.");
      return;
    } else if (DomainError) {
      setLoginError("Only @esi.dz email addresses are allowed.");
      return;
    } else if (PasswordError) {
      setLoginError("Invalid password. At least 8 characters required.");
      return;
    }

    setLoginLoading(true);
    try {
      const { data } = await login({ email, password });
      saveTokens({ access: data.access, refresh: "" });
      router.push(
        data.user.role === "professor"
          ? "/dashboard/professor"
          : "/dashboard/student"
      );
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 401) setLoginError("Invalid email or password.");
        else if (status === 403)
          setLoginError("Please verify your email first.");
        else setLoginError("Something went wrong. Please try again.");
      }
      shake(setEmailShake);
      shake(setPasswordShake);
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111; font-family: 'Rajdhani', sans-serif; }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pageSlide {
          from { opacity: 0; transform: translateX(22px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes scanLine {
          0%   { left: -60%; }
          100% { left: 160%; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-7px); }
          40%     { transform: translateX(7px); }
          60%     { transform: translateX(-5px); }
          80%     { transform: translateX(5px); }
        }
        @keyframes borderTrace {
          0%   { clip-path: inset(0 100% 98% 0); }
          25%  { clip-path: inset(0 0 98% 0); }
          50%  { clip-path: inset(0 0 0 98%); }
          75%  { clip-path: inset(98% 0 0 0); }
          100% { clip-path: inset(0 100% 98% 0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ── Responsive card ── */
        .login-card {
          background: #000;
          border-radius: 18px;
          width: min(380px, 100%);
          padding: 36px 32px 32px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.16), 0 32px 64px rgba(0,0,0,0.85);
          animation: cardIn 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Tighten padding on very small screens */
        @media (max-width: 400px) {
          .login-card {
            padding: 28px 18px 24px;
            border-radius: 14px;
          }
        }

        /* Landscape phones: avoid card being taller than viewport */
        @media (max-height: 620px) and (orientation: landscape) {
          .login-outer {
            align-items: flex-start;
            padding: 16px 24px;
          }
          .login-card {
            padding: 20px 28px 20px;
          }
        }
      `}</style>

      <Particles />

      <div
        className="login-outer"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div key={cardKey} className="login-card">
          {/* Scan line */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "-60%",
              width: "60%",
              height: 1,
              background:
                "linear-gradient(90deg, transparent, #3b82f6, transparent)",
              animation: "scanLine 3s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />

          {/* Border trace */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 18,
              border: "1.5px solid #2563eb",
              opacity: 0.18,
              animation: "borderTrace 6s linear infinite",
              pointerEvents: "none",
            }}
          />

          {/* ══ LOGIN PAGE ══ */}
          {page === "Login" && (
            <div
              style={{
                animation: "pageSlide 0.4s cubic-bezier(0.22,1,0.36,1) both",
              }}
            >
              <BackButton onClick={() => router.back()} />

              {/* Logo */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginBottom: 10,
                  animation: "fadeUp 0.5s 0.1s both",
                }}
              >
                <Logo />
              </div>

              {/* Title */}
              <div
                style={{
                  color: "#fff",
                  fontSize: "clamp(17px, 4vw, 22px)",
                  fontWeight: 700,
                  textAlign: "center",
                  marginBottom: 22,
                  letterSpacing: 0.3,
                  animation: "fadeUp 0.5s 0.15s both",
                  fontFamily: "'Rajdhani', sans-serif",
                }}
              >
                Log In to ESICODEHUB
              </div>

              {loginError && <Message text={loginError} type="error" />}

              <InputRow
                id="email"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                shake={emailShake}
                delay={0.18}
                icon={
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#555"
                    strokeWidth="1.8"
                    width={16}
                    height={16}
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2.5" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                }
              />

              <InputRow
                id="password"
                placeholder="Password"
                value={password}
                onChange={setPassword}
                shake={passwordShake}
                delay={0.26}
                toggleable
              />

              {/* Forgot password */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 18,
                  animation: "fadeUp 0.5s 0.3s both",
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push("/ForgotPassword")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#555",
                    fontSize: 13,
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#3b82f6")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
                >
                  Forgot password?
                </button>
              </div>

              <PillButton
                onClick={handleLogin}
                delay={0.38}
                loading={loginLoading}
              >
                Log in
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  width={17}
                  height={17}
                >
                  <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </PillButton>

              {/* Divider */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "16px 0 14px",
                  animation: "fadeUp 0.5s 0.44s both",
                }}
              >
                <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
                <span
                  style={{
                    color: "#444",
                    fontSize: 12,
                    fontFamily: "'Rajdhani', sans-serif",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Don't have an account? Sign up
                </span>
                <div style={{ flex: 1, height: 1, background: "#1e1e1e" }} />
              </div>

              {/* Register button */}
              <GhostButton onClick={() => router.push("/register")} delay={0.48}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  width={16}
                  height={16}
                >
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                Register
              </GhostButton>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <PublicRoute>
      <LoginPageContent />
    </PublicRoute>
  );
}