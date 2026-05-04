import { useState } from "react";

export default function BackButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute", top: 16, left: 16, width: 36, height: 36,
        borderRadius: "50%", border: `1.5px solid ${hovered ? "#2563eb" : "#222"}`,
        background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: hovered ? "#3b82f6" : "#666",
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