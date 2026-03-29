

import { CSSProperties } from "react";

interface VisibilityToggleProps {
  value: "public" | "private";
  onChange: (value: "public" | "private") => void;
}

export default function VisibilityToggle({ value, onChange }: VisibilityToggleProps) {
  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={() => onChange("public")}
        style={{
          ...styles.option,
          ...(value === "public" ? styles.active : {})
        }}
      >
        Public
        <span style={styles.description}>Anyone can see it</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("private")}
        style={{
          ...styles.option,
          ...(value === "private" ? styles.active : {})
        }}
      >
        Private
        <span style={styles.description}>Only you can see it</span>
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    gap: 12,
  },
  option: {
    flex: 1,
    padding: "14px 16px",
    borderRadius: 10,
    border: "2px solid #d1d9e6",
    background: "#f8faff",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 14,
    transition: "all .2s",
  },
  active: {
    borderColor: "#2563eb",
    background: "#eff6ff",
  },
  description: {
    display: "block",
    fontWeight: 400,
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
};