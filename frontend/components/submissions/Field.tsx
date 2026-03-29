
import { CSSProperties, ReactNode} from "react";


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
        {label}
        {required && <span style={styles.required}> *</span>}
        {hint && <span style={styles.hint}> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  field: { marginBottom: 22 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 },
  required: { color: "#ef4444" },
  hint: { fontWeight: 400, color: "#94a3b8" },
};