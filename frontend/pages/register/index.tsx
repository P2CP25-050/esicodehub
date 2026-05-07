"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { AxiosError } from 'axios';
import Head from 'next/head';

// ─── Reusable auth components (no redefinition) ───────────
import Logo             from "@/components/auth/Logo";
import Particles        from "@/components/auth/Particles";
import InputRow         from "@/components/auth/InputRow";
import PillButton       from "@/components/auth/PillButton";
import PasswordStrength from "@/components/auth/PasswordStrength";

// ─── Auth API calls ───────────────────────────────────────
import {
  register,
  verifyEmail,
  resendVerification,
} from "@/services/auth";

// ─── Token storage utility ────────────────────────────────
import { saveTokens } from "@/lib/tokens";
import { PublicRoute } from "@/components/PublicRoute";

// ─── Types ────────────────────────────────────────────────
type Page = "register" | "verify" | "success";
type Role = "student" | "professor";

// ─── Responsive width hook ────────────────────────────────
function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 768
  );
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return width;
}

// ─── Back Button ──────────────────────────────────────────
// Kept local because it uses router directly
function BackButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: `1.5px solid ${hovered ? "#2563eb" : "#222"}`,
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        color: hovered ? "#3b82f6" : "#666",
        transform: hovered ? "translateX(-2px)" : "translateX(0)",
        transition: "border-color 0.2s, color 0.2s, transform 0.2s",
        touchAction: "manipulation",
        zIndex: 10,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        width={14}
        height={14}
      >
        <path d="M19 12H5M5 12l7-7M5 12l7 7" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────
function RegisterPageContent() {
  const router = useRouter();
  const width  = useWindowWidth();

  // ── Page flow ──
  const [page, setPage] = useState<Page>("register");

  // ── Form fields ──
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code,            setCode]            = useState("");

  // ── Field errors ──
  const [emailError,    setEmailError]    = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError,  setConfirmError]  = useState("");
  const [codeError,     setCodeError]     = useState("");
  const [shakeCode,     setShakeCode]     = useState(false);

  // ── Loading states — prevent double submissions ──
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [loadingVerify,   setLoadingVerify]   = useState(false);

  // ── Resend 60s cooldown ──
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  // ── Card re-animation key ──
  const [cardKey, setCardKey] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // ── Responsive breakpoints ──
  const isXs = width < 400;
  const isSm = width >= 400 && width < 640;

  const cardWidth    = isXs || isSm ? "100%" : 420;
  const cardPaddingV = isXs ? 24 : isSm ? 28 : 36;
  const cardPaddingH = isXs ? 18 : isSm ? 22 : 32;
  const cardRadius   = isXs || isSm ? 14 : 18;
  const titleSize    = isXs ? 18 : isSm ? 20 : 22;
  const inputSize    = isXs ? 14 : 15;
  const btnSize      = isXs ? 14 : isSm ? 15 : 16;
  const btnPad       = isXs ? "11px" : "13px";
  const logoSize     = isXs ? 60 : isSm ? 70 : 80;
  const subtitleSize = isXs ? 13 : 14;
  const outerPad     = isXs ? "0" : isSm ? "16px" : "24px";

  // ── Step navigation ──
  const goTo = useCallback((p: Page) => {
    setCardKey((k) => k + 1);
    setPage(p);
  }, []);

  // ── Role-based redirect ──
  const redirectToDashboard = useCallback(() => {
    router.push('/home');
  }, [router]);

  // ── 60s resend cooldown timer ──
  const startCooldown = useCallback(() => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Cleanup cooldown on unmount ──
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ── @esi.dz domain check ──
  const isEsiEmail = (v: string): boolean =>
    v.toLowerCase().endsWith("@esi.dz");

  // ── Client-side validation ──
  const validate = (): boolean => {
    let ok = true;

    if (!email) {
      setEmailError("Email is required");
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address");
      ok = false;
    } else if (!isEsiEmail(email)) {
      setEmailError("Only @esi.dz email addresses are allowed");
      ok = false;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Password is required");
      ok = false;
    } else if (password.length < 8) {
      setPasswordError("At least 8 characters required");
      ok = false;
    } else {
      setPasswordError("");
    }

    if (!confirmPassword) {
      setConfirmError("Please confirm your password");
      ok = false;
    } else if (password !== confirmPassword) {
      setConfirmError("Passwords do not match");
      ok = false;
    } else {
      setConfirmError("");
    }

    return ok;
  };

  // ── REGISTER — real API call ──
  const handleRegister = useCallback(async () => {
    if (loadingRegister) return;
    if (!validate()) return;

    setLoadingRegister(true);
    try {
      await register({ email, password, password_confirm: confirmPassword });
      // no need to use res, just navigate on success
      goTo("verify");
      startCooldown();
      setTimeout(() => codeRef.current?.focus(), 400);
    } catch (err: unknown) {
	if (err instanceof AxiosError) {
		const status = err.response?.status;
		const data = err.response?.data;
		if (status === 404) setEmailError("This email is not registered in the ESI system.");
		else if (status === 400 && data?.error?.includes('already exists')) setEmailError("An account with this email already exists.");
		else if (status === 400) setEmailError(data?.email?.[0] || data?.error || "Registration failed.");
		else setEmailError("Something went wrong. Please try again.");
	} else {
		setEmailError("Registration failed. Try again.");
	}
    } finally {
      setLoadingRegister(false);
    }
  }, [email, password, confirmPassword, loadingRegister, goTo, startCooldown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── VERIFY — real API call ──
  const handleVerify = useCallback(async () => {
    if (loadingVerify) return;

    if (code.length !== 6) {
      setCodeError("Code must be exactly 6 digits");
      setShakeCode(true);
      setTimeout(() => setShakeCode(false), 600);
      return;
    }

    setCodeError("");
    setLoadingVerify(true);
    try {
      const res = await verifyEmail({ email, code });
      saveTokens(res.data);
      // redirect based on role from backend response
      goTo("success");
      setTimeout(() => redirectToDashboard(), 1800);
    } catch (err: unknown) {
	if (err instanceof AxiosError) {
		const status = err.response?.status;
		if (status === 400) setCodeError("Invalid or expired code. Please try again.");
		else setCodeError("Something went wrong. Please try again.");
	} else {
		setCodeError("Invalid code. Try again.");
	}
	setShakeCode(true);
	setTimeout(() => setShakeCode(false), 600);
    } finally {
      setLoadingVerify(false);
    }
  }, [code, email, loadingVerify, goTo, redirectToDashboard]);

  // ── RESEND — real API call ──
  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    startCooldown();
    try {
      await resendVerification({ email });
    } catch {
      // cooldown already started — silently fail
    }
  }, [resendCooldown, email, startCooldown]);

  // ── Enter key support ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (page === "register") handleRegister();
      else if (page === "verify") handleVerify();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, handleRegister, handleVerify]);

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Register — ESICodeHub</title>
      </Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap');
        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111; font-family: 'Rajdhani', sans-serif; overscroll-behavior: none; }

        @keyframes cardIn     { from { opacity:0; transform:translateY(28px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInLeft{ from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes pageSlide  { from { opacity:0; transform:translateX(22px); } to { opacity:1; transform:translateX(0); } }
        @keyframes scanLine   { 0% { left:-60%; } 100% { left:160%; } }
        @keyframes shake      { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-7px); } 40% { transform:translateX(7px); } 60% { transform:translateX(-5px); } 80% { transform:translateX(5px); } }
        @keyframes particleRise { 0% { transform:translateY(100vh); opacity:0; } 10% { opacity:0.6; } 90% { opacity:0.35; } 100% { transform:translateY(-80px); opacity:0; } }
        @keyframes checkPop   { from { transform:scale(0) rotate(-90deg); opacity:0; } to { transform:scale(1) rotate(0); opacity:1; } }
        @keyframes borderTrace{ 0% { clip-path:inset(0 100% 98% 0); } 25% { clip-path:inset(0 0 98% 0); } 50% { clip-path:inset(0 0 0 98%); } 75% { clip-path:inset(98% 0 0 0); } 100% { clip-path:inset(0 100% 98% 0); } }
        @keyframes spin       { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

        .outer-wrapper {
          min-height: 100dvh; min-height: 100vh;
          display: flex; align-items: flex-start; justify-content: center;
          position: relative; z-index: 1;
          padding: ${outerPad};
          padding-top:    max(${outerPad}, env(safe-area-inset-top));
          padding-bottom: max(${outerPad}, env(safe-area-inset-bottom));
          padding-left:   max(${outerPad}, env(safe-area-inset-left));
          padding-right:  max(${outerPad}, env(safe-area-inset-right));
        }
        @media (min-height: 700px) { .outer-wrapper { align-items: center; } }
        button { -webkit-tap-highlight-color: transparent; }
        input  { font-size: max(16px, 1em); }
        @media (min-width: 400px) { input { font-size: inherit; } }
      `}</style>

      <Particles />

      <div className="outer-wrapper">
        <div
          key={cardKey}
          style={{
            background: "#000",
            borderRadius: cardRadius,
            width: cardWidth,
            maxWidth: 460,
            padding: `${cardPaddingV}px ${cardPaddingH}px`,
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(59,130,246,0.16), 0 32px 64px rgba(0,0,0,0.85)",
            animation: "cardIn 0.55s cubic-bezier(0.22,1,0.36,1) both",
            margin: isXs || isSm ? "auto" : undefined,
          }}
        >
          {/* Scan line */}
          <div style={{ position: "absolute", top: 0, left: "-60%", width: "60%", height: 1, background: "linear-gradient(90deg, transparent, #3b82f6, transparent)", animation: "scanLine 3s ease-in-out infinite", pointerEvents: "none" }} />
          {/* Border trace */}
          <div style={{ position: "absolute", inset: 0, borderRadius: cardRadius, border: "1.5px solid #2563eb", opacity: 0.18, animation: "borderTrace 6s linear infinite", pointerEvents: "none" }} />

          {/* ══════════════ REGISTER ══════════════ */}
          {page === "register" && (
            <div style={{ animation: "pageSlide 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
              {/* Back → landing page */}
              <BackButton onClick={() => router.push("/")} />

              <Logo size={logoSize} />

              <div style={{ color: "#fff", fontSize: titleSize, fontWeight: 700, textAlign: "center", marginBottom: isXs ? 16 : 22, letterSpacing: 0.3, animation: "fadeUp 0.5s 0.15s both", fontFamily: "'Rajdhani', sans-serif" }}>
                Create your account
              </div>

              {/* Email — @esi.dz only */}
              <InputRow
                id="email"
                placeholder="Email address (@esi.dz)"
                type="email"
                value={email}
                onChange={(v) => { setEmail(v); setEmailError(""); }}
                error={emailError}
                delay={0.18}
                fontSize={inputSize}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" width={16} height={16}>
                    <rect x="2" y="4" width="20" height="16" rx="2.5" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                }
              />

              {/* Password + strength */}
              <InputRow
                id="password"
                placeholder="Password"
                value={password}
                onChange={(v) => { setPassword(v); setPasswordError(""); }}
                error={passwordError}
                delay={0.23}
                toggleable
                fontSize={inputSize}
              />
              <PasswordStrength password={password} />

              {/* Confirm password */}
              <InputRow
                id="confirm"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(v) => { setConfirmPassword(v); setConfirmError(""); }}
                error={confirmError}
                delay={0.28}
                toggleable
                fontSize={inputSize}
              />

              <div style={{ marginBottom: isXs ? 16 : 20 }} />

              <PillButton
                onClick={handleRegister}
                delay={0.34}
                fontSize={btnSize}
                padding={btnPad}
                loading={loadingRegister}
              >
                Register
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={17} height={17}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </PillButton>
            </div>
          )}

          {/* ══════════════ VERIFY ══════════════ */}
          {page === "verify" && (
            <div style={{ animation: "pageSlide 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
              <BackButton onClick={() => goTo("register")} />

              <Logo size={logoSize} />

              <div style={{ color: "#fff", fontSize: isXs ? 17 : isSm ? 18 : 20, fontWeight: 700, textAlign: "center", marginBottom: isXs ? 10 : 14, fontFamily: "'Courier Prime', monospace", animation: "fadeUp 0.5s 0.12s both" }}>
                Check Your E-mail!
              </div>

              {/* Email badge */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: isXs ? 14 : 18, animation: "fadeUp 0.5s 0.14s both" }}>
                <div style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.3)", borderRadius: 100, padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "block" }} />
                  <span style={{ color: "#3b82f6", fontSize: 12, fontFamily: "'Courier Prime', monospace", fontWeight: 700 }}>
                    {email}
                  </span>
                </div>
              </div>

              <p style={{ textAlign: "center", color: "#999", fontSize: subtitleSize, lineHeight: 1.65, marginBottom: isXs ? 18 : 24, fontWeight: 500, animation: "fadeUp 0.5s 0.15s both", fontFamily: "'Rajdhani', sans-serif" }}>
                Please enter the 6-digit code sent<br />to your E-mail
              </p>

              {/* Code input */}
              <div style={{
                background: "#1a1a1a",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                marginBottom: codeError ? 6 : 14,
                border: `1.5px solid ${shakeCode ? "#ef4444" : "#333"}`,
                boxShadow: shakeCode ? "0 0 0 3px rgba(239,68,68,0.14)" : "none",
                transition: "border-color 0.25s, box-shadow 0.25s",
                animation: `fadeUp 0.5s 0.2s both${shakeCode ? ", shake 0.35s ease" : ""}`,
              }}>
                <input
                  ref={codeRef}
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setCodeError("");
                  }}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#ddd",
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: isXs ? 16 : 18,
                    fontWeight: 700,
                    padding: "13px 0",
                    letterSpacing: code ? 6 : 1,
                    minWidth: 0,
                  }}
                />
              </div>

              {codeError && (
                <p style={{ color: "#ef4444", fontSize: 11, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, marginBottom: 10, paddingLeft: 4, animation: "fadeUp 0.3s both" }}>
                  {codeError}
                </p>
              )}

              <PillButton
                onClick={handleVerify}
                delay={0.28}
                fontSize={btnSize}
                padding={btnPad}
                loading={loadingVerify}
              >
                Verify
              </PillButton>

              {/* Resend — 60s cooldown */}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                  marginTop: 14,
                  background: "none",
                  border: "none",
                  color: resendCooldown > 0 ? "#444" : "#555",
                  fontSize: isXs ? 12 : 13,
                  fontWeight: 600,
                  textDecoration: resendCooldown > 0 ? "none" : "underline",
                  cursor: resendCooldown > 0 ? "not-allowed" : "pointer",
                  transition: "color 0.2s",
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: 0.3,
                  animation: "fadeUp 0.5s 0.32s both",
                  padding: "4px 0",
                  touchAction: "manipulation",
                }}
              >
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend the code"}
              </button>
            </div>
          )}

          {/* ══════════════ SUCCESS ══════════════ */}
          {page === "success" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: `${isXs ? 6 : 10}px 0`, animation: "pageSlide 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
              <Logo size={logoSize} />

              <div style={{
                width: isXs ? 60 : 72,
                height: isXs ? 60 : 72,
                borderRadius: "50%",
                border: "2.5px solid #22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#22c55e",
                fontSize: isXs ? 24 : 30,
                marginBottom: isXs ? 14 : 20,
                boxShadow: "0 0 28px rgba(34,197,94,0.28)",
                animation: "checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
              }}>
                ✓
              </div>

              <div style={{ color: "#fff", fontSize: titleSize, fontWeight: 700, marginBottom: 8, fontFamily: "'Rajdhani', sans-serif", animation: "fadeUp 0.5s 0.2s both" }}>
                You&apos;re in!
              </div>

              <p style={{ textAlign: "center", color: "#999", fontSize: subtitleSize, lineHeight: 1.6, marginBottom: isXs ? 18 : 24, animation: "fadeUp 0.5s 0.25s both", fontFamily: "'Rajdhani', sans-serif" }}>
                Account verified.<br />Redirecting to your dashboard…
              </p>

              {/* Spinner while redirecting */}
              <svg
                width={28}
                height={28}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                style={{ animation: "spin 0.8s linear infinite" }}
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  return (
    <PublicRoute>
      <RegisterPageContent />
    </PublicRoute>
  );
}
