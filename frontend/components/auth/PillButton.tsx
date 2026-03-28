import { useState } from "react";
import React from "react";


export default function PillButton({ children, onClick, delay = 0, fontSize = 16, padding = "13px", loading = false }: {
  children: React.ReactNode; onClick: () => void;
  delay?: number; fontSize?: number; padding?: string; loading?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={loading}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding, borderRadius: 28, border: "none",
        background: loading ? "#ccc" : "#fff", color: "#000",
        fontFamily: "'Rajdhani',sans-serif", fontSize, fontWeight: 700,
        letterSpacing: "0.5px", cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        position: "relative", overflow: "hidden",
        transform: hovered && !loading ? "translateY(-2px)" : "translateY(0)",
        boxShadow: hovered && !loading ? "0 8px 28px rgba(255,255,255,0.2)" : "none",
        transition: "transform 0.2s, box-shadow 0.2s, background 0.2s",
        animation: `fadeUp 0.5s ${delay}s both`,
        touchAction: "manipulation", opacity: loading ? 0.7 : 1,
      }}
    >
      {/* shimmer */}
      {!loading && <span style={{ position: "absolute", top: 0, left: hovered ? "150%" : "-80%", width: "60%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(0,0,0,0.07),transparent)", transition: "left 0.5s", pointerEvents: "none" }} />}
      {/* spinner */}
      {loading ? (
        <>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 0.8s linear infinite" }}>
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          Loading...
        </>
      ) : children}
    </button>
  );
}
