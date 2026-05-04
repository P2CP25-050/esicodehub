"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import { AxiosError } from "axios";
import apiClient from "@/lib/axios";

import Particles from "@/components/auth/Particles";
import PillButton from "@/components/auth/PillButton";
import InputRow from "@/components/auth/InputRow";
import BackButton from "@/components/auth/BackButton";
import Logo from "@/components/auth/Logo";

// ─── Shared message banner (mirrors login page) ───────────
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

// ─── Main Component ───────────────────────────────────────
export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail]         = useState("");
  const [emailShake, setEmailShake] = useState(false);
  const [message, setMessage]     = useState<{ text: string; type: "error" | "success" } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [sent, setSent]           = useState(false);

  const shake = () => {
    setEmailShake(true);
    setTimeout(() => setEmailShake(false), 600);
  };

  const handleSubmit = async () => {
    setMessage(null);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      shake();
      setMessage({ text: "Please enter a valid email address.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/auth/forgot-password/", { email });
      // Always show the same message regardless of whether email exists
      // — prevents user enumeration attacks.
      setMessage({
        text: "If this email is registered, a reset link has been sent.",
        type: "success",
      });
      setSent(true);
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status !== 404) {
        // 404 is intentionally ambiguous on the backend; treat all others as real errors
        setMessage({ text: "Something went wrong. Please try again.", type: "error" });
      } else {
        // Treat 404 (or unknown) the same as success — don't leak email existence
        setMessage({
          text: "If this email is registered, a reset link has been sent.",
          type: "success",
        });
        setSent(true);
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

        .fp-card {
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
          .fp-card { padding: 28px 18px 24px; border-radius: 14px; }
        }
        @media (max-height: 620px) and (orientation: landscape) {
          .fp-outer { align-items: flex-start; padding: 16px 24px; }
          .fp-card  { padding: 20px 28px 20px; }
        }
      `}</style>

      <Particles />

      <div
        className="fp-outer"
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
        <div className="fp-card">
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

          <BackButton onClick={() => router.push("/login")} />

          {/* Logo */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", marginBottom: 10,
            animation: "fadeUp 0.5s 0.1s both",
          }}>
            <Logo />
          </div>

          {/* Title */}
          <div style={{
            color: "#fff",
            fontSize: "clamp(17px, 4vw, 22px)",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 6,
            letterSpacing: 0.3,
            animation: "fadeUp 0.5s 0.15s both",
            fontFamily: "'Rajdhani', sans-serif",
          }}>
            Forgot Password
          </div>

          {/* Subtitle */}
          <p style={{
            color: "#666",
            fontSize: 13,
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 500,
            textAlign: "center",
            marginBottom: 22,
            lineHeight: 1.5,
            animation: "fadeUp 0.5s 0.2s both",
          }}>
            Enter your @esi.dz email and we&apos;ll send you a reset link.
          </p>

          {message && <Message text={message.text} type={message.type} />}

          {!sent && (
            <>
              <InputRow
                id="email"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                shake={emailShake}
                delay={0.22}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" width={16} height={16}>
                    <rect x="2" y="4" width="20" height="16" rx="2.5" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                }
              />

              <div style={{ marginTop: 8, animation: "fadeUp 0.5s 0.32s both" }}>
                <PillButton onClick={handleSubmit} delay={0} loading={loading}>
                  Send Reset Link
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={17} height={17}>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </PillButton>
              </div>
            </>
          )}

          {/* Back to login link */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 20,
            animation: "fadeUp 0.5s 0.4s both",
          }}>
            <button
              type="button"
              onClick={() => router.push("/login")}
              style={{
                background: "none", border: "none",
                color: "#555", fontSize: 13,
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 600, cursor: "pointer", padding: 0,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#3b82f6")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </>
  );
}