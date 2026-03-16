"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────
type Page = "register" | "verify" | "success";

// ─── useWindowWidth ───────────────────────────────────────
function useWindowWidth() {
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

// ─── Logo ─────────────────────────────────────────────────
function Logo({ size = 80 }: { size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: "clamp(12px, 2.5vw, 20px)", animation: "fadeUp 0.5s 0.1s both" }}>
      <img
        src="/ESIcodehub3 2.png"
        alt="ESIcodeHub Logo"
        style={{ width: size, height: "auto", objectFit: "contain", maxWidth: "100%" }}
      />
    </div>
  );
}

// ─── Particles ────────────────────────────────────────────
function Particles() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <span key={i} style={{
          position: "absolute",
          width: 2 + (i % 3), height: 2 + (i % 3),
          borderRadius: "50%",
          background: i % 4 === 0 ? "#2563eb" : "rgba(59,130,246,0.45)",
          left: `${(i * 347) % 100}%`,
          animation: `particleRise ${7 + (i % 6)}s ${(i * 0.7) % 5}s linear infinite`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ─── Eye icons ────────────────────────────────────────────
function EyeOff({ color = "#555" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" width={16} height={16}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function EyeOn({ color = "#3b82f6" }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" width={16} height={16}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── Input Row ────────────────────────────────────────────
interface InputRowProps {
  id: string;
  placeholder: string;
  type?: string;
  icon: React.ReactNode;
  toggleable?: boolean;
  delay?: number;
  value: string;
  onChange: (v: string) => void;
  shake?: boolean;
  error?: string;
  fontSize?: number;
}

function InputRow({ id, placeholder, type = "text", icon, toggleable = false, delay = 0, value, onChange, shake = false, error, fontSize = 15 }: InputRowProps) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const inputType = toggleable ? (visible ? "text" : "password") : type;
  const hasError = !!error || shake;

  return (
    <div style={{ marginBottom: error ? 6 : 10, animation: `slideInLeft 0.45s ${delay}s both` }}>
      <div style={{
        background: "#1a1a1a",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        border: `1.5px solid ${hasError ? "#ef4444" : focused ? "#2563eb" : "transparent"}`,
        boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.14)" : hasError ? "0 0 0 3px rgba(239,68,68,0.14)" : "none",
        transition: "border-color 0.25s, box-shadow 0.25s",
      }}>
        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#ddd", fontFamily: "'Rajdhani', sans-serif",
            fontSize, fontWeight: 500, padding: "13px 0", minWidth: 0,
          }}
        />
        <button
          type="button"
          onClick={() => toggleable && setVisible((v) => !v)}
          style={{
            background: "none", border: "none",
            cursor: toggleable ? "pointer" : "default",
            display: "flex", alignItems: "center", padding: 0, flexShrink: 0,
            color: focused ? "#3b82f6" : "#555", transition: "color 0.2s",
          }}
        >
          {toggleable ? (visible ? <EyeOn /> : <EyeOff color={focused ? "#3b82f6" : "#555"} />) : icon}
        </button>
      </div>
      {/* Inline error message */}
      {error && (
        <p style={{
          color: "#ef4444", fontSize: 11, fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600, marginTop: 4, paddingLeft: 4,
          animation: "fadeUp 0.3s both",
        }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Radio Item ───────────────────────────────────────────
// ─── Pill Button ──────────────────────────────────────────
function PillButton({ children, onClick, delay = 0, fontSize = 16, padding = "13px" }: {
  children: React.ReactNode; onClick: () => void;
  delay?: number; fontSize?: number; padding?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding, borderRadius: 28, border: "none",
        background: "#fff", color: "#000",
        fontFamily: "'Rajdhani', sans-serif", fontSize, fontWeight: 700,
        letterSpacing: "0.5px", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        position: "relative", overflow: "hidden",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered ? "0 8px 28px rgba(255,255,255,0.2)" : "none",
        transition: "transform 0.2s, box-shadow 0.2s",
        animation: `fadeUp 0.5s ${delay}s both`,
        touchAction: "manipulation",
      }}
    >
      <span style={{
        position: "absolute", top: 0,
        left: hovered ? "150%" : "-80%",
        width: "60%", height: "100%",
        background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.07), transparent)",
        transition: "left 0.5s", pointerEvents: "none",
      }} />
      {children}
    </button>
  );
}

// ─── Back Button ──────────────────────────────────────────
function BackButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute", top: 16, left: 16,
        width: 36, height: 36, borderRadius: "50%",
        border: `1.5px solid ${hovered ? "#2563eb" : "#222"}`,
        background: "#0a0a0a", display: "flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer",
        color: hovered ? "#3b82f6" : "#666",
        transform: hovered ? "translateX(-2px)" : "translateX(0)",
        transition: "border-color 0.2s, color 0.2s, transform 0.2s",
        touchAction: "manipulation", zIndex: 10,
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={14} height={14}>
        <path d="M19 12H5M5 12l7-7M5 12l7 7" />
      </svg>
    </button>
  );
}

// ─── Password strength bar ────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };
  const strength = getStrength();
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];

  if (!password) return null;

  return (
    <div style={{ marginBottom: 10, animation: "fadeUp 0.3s both" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= strength ? colors[strength] : "#333",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <p style={{
        fontSize: 11, fontFamily: "'Rajdhani', sans-serif",
        fontWeight: 600, color: colors[strength], textAlign: "right",
      }}>
        {labels[strength]}
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function SignUpPage() {
  const width = useWindowWidth();
  const [page, setPage] = useState<Page>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  // Errors
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [shakeCode, setShakeCode] = useState(false);

  const [resendMsg, setResendMsg] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // ── Breakpoints ──
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

  const goTo = useCallback((p: Page) => {
    setCardKey((k) => k + 1);
    setPage(p);
  }, []);

  const triggerShake = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 600);
  };

  // ── Validation ──
  const validate = (): boolean => {
    let valid = true;

    // Email
    if (!email) {
      setEmailError("Email is required"); valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address"); valid = false;
    } else {
      setEmailError("");
    }

    // Password
    if (!password) {
      setPasswordError("Password is required"); valid = false;
    } else if (password.length < 8) {
      setPasswordError("At least 8 characters required"); valid = false;
    } else {
      setPasswordError("");
    }

    // Confirm
    if (!confirmPassword) {
      setConfirmError("Please confirm your password"); valid = false;
    } else if (password !== confirmPassword) {
      setConfirmError("Passwords do not match"); valid = false;
    } else {
      setConfirmError("");
    }

    return valid;
  };

  const handleRegister = useCallback(() => {
    if (!validate()) return;
    goTo("verify");
    setTimeout(() => codeRef.current?.focus(), 400);
  }, [email, password, confirmPassword, goTo]);

  const handleVerify = useCallback(() => {
    if (code.length < 4) { triggerShake(setShakeCode); return; }
    goTo("success");
  }, [code, goTo]);

  const handleResend = () => {
    setResendMsg(true);
    setTimeout(() => setResendMsg(false), 3000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (page === "register") handleRegister();
      else if (page === "verify") handleVerify();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, handleRegister, handleVerify]);

  const outerPad = isXs ? "0" : isSm ? "16px" : "24px";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Rajdhani:wght@500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #111; font-family: 'Rajdhani', sans-serif; overscroll-behavior: none; }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
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
        @keyframes particleRise {
          0%   { transform: translateY(100vh); opacity: 0; }
          10%  { opacity: 0.6; }
          90%  { opacity: 0.35; }
          100% { transform: translateY(-80px); opacity: 0; }
        }
        @keyframes checkPop {
          from { transform: scale(0) rotate(-90deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes borderTrace {
          0%   { clip-path: inset(0 100% 98% 0); }
          25%  { clip-path: inset(0 0 98% 0); }
          50%  { clip-path: inset(0 0 0 98%); }
          75%  { clip-path: inset(98% 0 0 0); }
          100% { clip-path: inset(0 100% 98% 0); }
        }

        .outer-wrapper {
          min-height: 100dvh;
          min-height: 100vh;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          position: relative;
          z-index: 1;
          padding: ${outerPad};
          padding-top: max(${outerPad}, env(safe-area-inset-top));
          padding-bottom: max(${outerPad}, env(safe-area-inset-bottom));
          padding-left: max(${outerPad}, env(safe-area-inset-left));
          padding-right: max(${outerPad}, env(safe-area-inset-right));
        }
        @media (min-height: 700px) {
          .outer-wrapper { align-items: center; }
        }

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

          {/* ══ REGISTER ══ */}
          {page === "register" && (
            <div style={{ animation: "pageSlide 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
              <BackButton onClick={() => {}} />

              <Logo size={logoSize} />

              <div style={{ color: "#fff", fontSize: titleSize, fontWeight: 700, textAlign: "center", marginBottom: isXs ? 16 : 22, letterSpacing: 0.3, animation: "fadeUp 0.5s 0.15s both", fontFamily: "'Rajdhani', sans-serif" }}>
                Create your account
              </div>

              {/* Email */}
              <InputRow
                id="email" placeholder="Email address" type="email"
                value={email} onChange={(v) => { setEmail(v); setEmailError(""); }}
                error={emailError} delay={0.18} fontSize={inputSize}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" width={16} height={16}>
                    <rect x="2" y="4" width="20" height="16" rx="2.5" />
                    <polyline points="2,4 12,13 22,4" />
                  </svg>
                }
              />

              {/* Password */}
              <InputRow
                id="password" placeholder="Password"
                value={password} onChange={(v) => { setPassword(v); setPasswordError(""); }}
                error={passwordError} delay={0.23} toggleable fontSize={inputSize}
                icon={<EyeOff />}
              />
              <PasswordStrength password={password} />

              {/* Confirm Password */}
              <InputRow
                id="confirm" placeholder="Confirm Password"
                value={confirmPassword} onChange={(v) => { setConfirmPassword(v); setConfirmError(""); }}
                error={confirmError} delay={0.28} toggleable fontSize={inputSize}
                icon={<EyeOff />}
              />

              <PillButton onClick={handleRegister} delay={0.38} fontSize={btnSize} padding={btnPad}>
                Register
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={17} height={17}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </PillButton>
            </div>
          )}

          {/* ══ VERIFY ══ */}
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
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "block", animation: "fadeUp 1s ease-in-out infinite alternate" }} />
                  <span style={{ color: "#3b82f6", fontSize: 12, fontFamily: "'Courier Prime', monospace", fontWeight: 700 }}>{email}</span>
                </div>
              </div>

              <p style={{ textAlign: "center", color: "#999", fontSize: subtitleSize, lineHeight: 1.65, marginBottom: isXs ? 18 : 24, fontWeight: 500, animation: "fadeUp 0.5s 0.15s both", fontFamily: "'Rajdhani', sans-serif" }}>
                Please enter the code that has been<br />sent to you through your E-mail
              </p>

              <div style={{
                background: "#1a1a1a", borderRadius: 10,
                display: "flex", alignItems: "center", padding: "0 14px",
                marginBottom: 14,
                border: `1.5px solid ${shakeCode ? "#ef4444" : "#333"}`,
                boxShadow: shakeCode ? "0 0 0 3px rgba(239,68,68,0.14)" : "none",
                transition: "border-color 0.25s, box-shadow 0.25s",
                animation: `fadeUp 0.5s 0.2s both${shakeCode ? ", shake 0.35s ease" : ""}`,
              }}>
                <input
                  ref={codeRef}
                  type="text"
                  placeholder="Enter The Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "#ddd", fontFamily: "'Courier Prime', monospace",
                    fontSize: isXs ? 16 : 18, fontWeight: 700,
                    padding: "13px 0", letterSpacing: code ? 6 : 1, minWidth: 0,
                  }}
                />
                <span style={{ color: "#555", display: "flex", alignItems: "center", flexShrink: 0 }}>
                  <EyeOff />
                </span>
              </div>

              <PillButton onClick={handleVerify} delay={0.28} fontSize={btnSize} padding={btnPad}>
                Enter
              </PillButton>

              <button type="button" onClick={handleResend} style={{
                display: "block", width: "100%", textAlign: "center", marginTop: 14,
                background: "none", border: "none",
                color: resendMsg ? "#22c55e" : "#555",
                fontSize: isXs ? 12 : 13, fontWeight: 600,
                textDecoration: "underline", cursor: "pointer",
                transition: "color 0.2s", fontFamily: "'Rajdhani', sans-serif",
                letterSpacing: 0.3, animation: "fadeUp 0.5s 0.32s both",
                padding: "4px 0", touchAction: "manipulation",
              }}>
                {resendMsg ? "✓ Code sent again!" : "Resend the code"}
              </button>
            </div>
          )}

          {/* ══ SUCCESS ══ */}
          {page === "success" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: `${isXs ? 6 : 10}px 0`, animation: "pageSlide 0.4s cubic-bezier(0.22,1,0.36,1) both" }}>
              <Logo size={logoSize} />

              <div style={{
                width: isXs ? 60 : 72, height: isXs ? 60 : 72, borderRadius: "50%",
                border: "2.5px solid #22c55e", display: "flex", alignItems: "center",
                justifyContent: "center", color: "#22c55e", fontSize: isXs ? 24 : 30,
                marginBottom: isXs ? 14 : 20, boxShadow: "0 0 28px rgba(34,197,94,0.28)",
                animation: "checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
              }}>
                ✓
              </div>

              <div style={{ color: "#fff", fontSize: titleSize, fontWeight: 700, marginBottom: 8, fontFamily: "'Rajdhani', sans-serif", animation: "fadeUp 0.5s 0.2s both" }}>
                You&apos;re in!
              </div>

              <p style={{ textAlign: "center", color: "#999", fontSize: subtitleSize, lineHeight: 1.6, marginBottom: isXs ? 18 : 24, animation: "fadeUp 0.5s 0.25s both", fontFamily: "'Rajdhani', sans-serif" }}>
                Account verified.<br />Welcome to <strong style={{ color: "#fff" }}>ESIcodeHub</strong>.
              </p>

              <div style={{ width: "100%", animation: "fadeUp 0.5s 0.3s both" }}>
                <PillButton onClick={() => alert("Redirecting to dashboard…")} delay={0} fontSize={btnSize} padding={btnPad}>
                  Go to Dashboard
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width={16} height={16}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </PillButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}