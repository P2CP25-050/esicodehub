"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import apiClient from "@/lib/axios";

import Particles from "@/components/auth/Particles";
import PillButton from "@/components/auth/PillButton";
import InputRow from "@/components/auth/InputRow";
import Logo from "@/components/auth/Logo";
import PasswordStrength from "@/components/auth/PasswordStrength";

// ─── Shared message banner ────────────────────────────────
function Message({ text, type }: { text: string; type: "error" | "success" }) {
  return (
    <div
      style={{
        background:
          type === "error" ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
        border: `1px solid ${
          type === "error" ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"
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

// ─── Inline text link ─────────────────────────────────────
function TextLink({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "none", border: "none",
        color: hovered ? "#3b82f6" : "#555",
        fontSize: 13, fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 600, cursor: "pointer", padding: 0,
        transition: "color 0.2s", display: "inline",
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;

  const [password, setPassword]           = useState("");
  const [confirm, setConfirm]             = useState("");
  const [passwordShake, setPasswordShake] = useState(false);
  const [confirmShake, setConfirmShake]   = useState(false);
  const [message, setMessage]             = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading]             = useState(false);
  const [done, setDone]                   = useState(false);
  const [expired, setExpired]             = useState(false);

  // FIX: Do NOT gate the entire page render on router.isReady.
  // Previously `return null` caused a blank screen for the full hydration
  // window (appeared as a very long delay). Instead, redirect only once
  // isReady confirms there is no token — the card renders immediately and
  // the form submit button is disabled while the token is still unknown.
  useEffect(() => {
    if (!router.isReady) return;
    if (!token) {
      router.replace("/forgot-password");
    }
  }, [router.isReady, token]);

  // True once Next.js has parsed the query string and a token is present.
  const tokenReady = router.isReady && !!token;

  const shake = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 600);
  };

  const handleReset = async () => {
    setMessage(null);

    let hasError = false;
    if (!password || password.length < 8) {
      shake(setPasswordShake);
      hasError = true;
    }
    if (!confirm || confirm !== password) {
      shake(setConfirmShake);
      hasError = true;
    }
    if (hasError) {
      if (password.length > 0 && password.length < 8) {
        setMessage({ text: "Password must be at least 8 characters.", type: "error" });
      } else if (confirm && confirm !== password) {
        setMessage({ text: "Passwords do not match.", type: "error" });
      } else {
        setMessage({ text: "Please fill in all fields correctly.", type: "error" });
      }
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password/", {
        token,
        password,
        password_confirm: confirm,
      });
      setDone(true);
      setMessage({ text: "Password reset successfully!", type: "success" });
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 400 || status === 410) {
          setExpired(true);
        } else {
          setMessage({ text: "Something went wrong. Please try again.", type: "error" });
        }
      }
    } finally {
      setLoading(false);
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
        @keyframes particleRise {
          0%   { transform: translateY(100vh); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-10vh); opacity: 0; }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .rp-card {
          background: #000;
          border-radius: 18px;
          width: min(380px, 100%);
          padding: 36px 32px 32px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.16), 0 32px 64px rgba(0,0,0,0.85);
          animation: cardIn 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }

        @media (max-width: 400px) {
          .rp-card { padding: 28px 18px 24px; border-radius: 14px; }
        }
        @media (max-height: 620px) and (orientation: landscape) {
          .rp-outer { align-items: flex-start; padding: 16px 24px; }
          .rp-card  { padding: 20px 28px 20px; }
        }
      `}</style>

      <Particles />

      <div
        className="rp-outer"
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
        <div className="rp-card">
          {/* Scan line */}
          <div style={{
            position: "absolute", top: 0, left: "-60%",
            width: "60%", height: 1,
            background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
            animation: "scanLine 3s ease-in-out infinite",
            pointerEvents: "none",
          }} />

          {/* Border trace */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 18,
            border: "1.5px solid #2563eb", opacity: 0.18,
            animation: "borderTrace 6s linear infinite",
            pointerEvents: "none",
          }} />

          {/* Logo */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", marginBottom: 10,
            animation: "fadeUp 0.5s 0.1s both",
          }}>
            <Logo />
          </div>

          {/* ── EXPIRED STATE ── */}
          {expired ? (
            <div style={{ textAlign: "center", animation: "fadeUp 0.4s both" }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}></div>
              <div style={{
                color: "#f87171", fontSize: "clamp(16px, 4vw, 20px)",
                fontWeight: 700, fontFamily: "'Rajdhani', sans-serif",
                marginBottom: 10,
              }}>
                Link Expired
              </div>
              <p style={{
                color: "#666", fontSize: 13,
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 500,
                lineHeight: 1.6, marginBottom: 20,
              }}>
                This password reset link has expired or is no longer valid.
              </p>
              <TextLink label="← Request a new reset link" href="/forgot-password" />
            </div>
          ) : done ? (
            /* ── SUCCESS STATE ── */
            <div style={{ textAlign: "center", animation: "fadeUp 0.4s both" }}>
              <div style={{ fontSize: 38, marginBottom: 12 }}></div>
              <div style={{
                color: "#4ade80", fontSize: "clamp(16px, 4vw, 20px)",
                fontWeight: 700, fontFamily: "'Rajdhani', sans-serif",
                marginBottom: 10,
              }}>
                Password Reset!
              </div>
              <p style={{
                color: "#666", fontSize: 13,
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 500,
                lineHeight: 1.6, marginBottom: 20,
              }}>
                Your password has been updated successfully. You can now log in with your new credentials.
              </p>
              <TextLink label="Go to Login →" href="/login" />
            </div>
          ) : (
            /* ── FORM STATE ── */
            <>
              {/* Title */}
              <div style={{
                color: "#fff",
                fontSize: "clamp(17px, 4vw, 22px)",
                fontWeight: 700, textAlign: "center",
                marginBottom: 6, letterSpacing: 0.3,
                animation: "fadeUp 0.5s 0.15s both",
                fontFamily: "'Rajdhani', sans-serif",
              }}>
                Reset Password
              </div>

              <p style={{
                color: "#666", fontSize: 13,
                fontFamily: "'Rajdhani', sans-serif", fontWeight: 500,
                textAlign: "center", marginBottom: 22, lineHeight: 1.5,
                animation: "fadeUp 0.5s 0.2s both",
              }}>
                Choose a strong new password for your account.
              </p>

              {message && <Message text={message.text} type={message.type} />}

              <InputRow
                id="password"
                placeholder="New password"
                value={password}
                onChange={setPassword}
                shake={passwordShake}
                delay={0.22}
                toggleable
              />

              <PasswordStrength password={password} />

              <InputRow
                id="confirm"
                placeholder="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                shake={confirmShake}
                delay={0.3}
                toggleable
              />

              <div style={{ marginTop: 8, animation: "fadeUp 0.5s 0.38s both" }}>
                {/* FIX: Button is disabled until the token is confirmed present,
                    instead of hiding the whole page with `return null`. */}
                <PillButton onClick={handleReset} delay={0} loading={loading || !tokenReady}>
                  Reset Password
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={17} height={17}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </PillButton>
              </div>

              <div style={{
                display: "flex", justifyContent: "center",
                marginTop: 20, animation: "fadeUp 0.5s 0.44s both",
              }}>
                <TextLink label="← Back to Login" href="/login" />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}