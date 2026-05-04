import { CSSProperties, ReactNode } from "react";

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export default function Field({ label, required = false, hint, children }: FieldProps) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>
        <span style={styles.labelText}>{label}</span>
        {required && <span style={styles.required}>*</span>}
        {hint && <span style={styles.hint}>{hint}</span>}
      </label>
      <div style={styles.control}>{children}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  field: {
    marginBottom: 20,
  },
  label: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 7,
  },
  labelText: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    fontWeight: 500,
    color: "#374151",
    letterSpacing: "0.01em",
  },
  required: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    color: "#051650",
    fontWeight: 700,
  },
  hint: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: 400,
  },
  control: {
    width: "100%",
  },
};