import { CSSProperties } from "react";

interface VisibilityToggleProps {
  value: "public" | "private";
  onChange: (value: "public" | "private") => void;
}

export default function VisibilityToggle({ value, onChange }: VisibilityToggleProps) {
  return (
    <div style={styles.container}>
      {(["public", "private"] as const).map((opt) => {
        const isActive = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              ...styles.option,
              ...(isActive ? styles.active : styles.inactive),
            }}
          >
            <span style={{ ...styles.dot, background: isActive ? "#051650" : "#d1d5db" }} />
            <span style={styles.content}>
              <span style={{ ...styles.optLabel, color: isActive ? "#051650" : "#374151" }}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </span>
              <span style={styles.description}>
                {opt === "public" ? "Anyone can see it" : "Only you can see it"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    gap: 10,
  },
  option: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 16px",
    borderRadius: 0,
    cursor: "pointer",
    textAlign: "left",
    transition: "all .15s",
    fontFamily: "'DM Sans', sans-serif",
  },
  active: {
    border: "1.5px solid #051650",
    background: "#f0f4ff",
    boxShadow: "3px 3px 0 #051650",
  },
  inactive: {
    border: "1.5px solid #d1d5db",
    background: "#fafafa",
    boxShadow: "none",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    transition: "background .15s",
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  optLabel: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1,
    transition: "color .15s",
  },
  description: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: 400,
    lineHeight: 1,
  },
};