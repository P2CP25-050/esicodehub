import { CSSProperties } from "react";

interface SuccessScreenProps {
  title: string;
  onNewSubmission: () => void;
  onBack: () => void;
}

export default function SuccessScreen({ title, onNewSubmission, onBack }: SuccessScreenProps) {
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {/* Top accent bar */}
        <div style={styles.accentBar} />

        <div style={styles.inner}>
          {/* Check mark */}
          <div style={styles.iconWrap}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Mono label */}
          <p style={styles.monoLabel}>Submission Uploaded</p>

          {/* Display title */}
          <h2 style={styles.displayTitle}>
            All <span style={styles.accent}>done!</span>
          </h2>

        <p style={styles.sub}>
            Your submission <strong style={styles.strong}>&quot;{title}&quot;</strong> has been posted successfully and is now live.
        </p>

          {/* Divider */}
          <div style={styles.divider} />

          {/* Actions */}
          <div style={styles.actions}>
            <button style={styles.btnPrimary} onClick={onNewSubmission}>
              + New Submission
            </button>
            <button style={styles.btnOutline} onClick={onBack}>
              ← Back to Submissions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100vh - 64px)",
    padding: 24,
    fontFamily: "'DM Sans', sans-serif",
    background: "#fff",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    border: "1.5px solid #000",
    overflow: "hidden",
  },
  accentBar: {
    height: 5,
    background: "#051650",
  },
  inner: {
    padding: "44px 40px 40px",
    textAlign: "center",
  },
  iconWrap: {
    width: 60,
    height: 60,
    background: "#051650",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    boxShadow: "4px 4px 0 #000",
  },
  monoLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "#051650",
    margin: "0 0 12px",
  },
  displayTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 38,
    fontWeight: 900,
    color: "#000",
    margin: "0 0 14px",
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
  },
  accent: {
    color: "#051650",
  },
  sub: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    color: "#6b7280",
    margin: "0 0 28px",
    lineHeight: 1.6,
    fontWeight: 300,
  },
  strong: {
    color: "#000",
    fontWeight: 600,
  },
  divider: {
    height: "1px",
    background: "#000",
    opacity: 0.1,
    marginBottom: 28,
  },
  actions: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  btnPrimary: {
    padding: "12px 28px",
    background: "#051650",
    color: "#fff",
    border: "1.5px solid #051650",
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background .15s, box-shadow .15s, transform .1s",
  },
  btnOutline: {
    padding: "12px 24px",
    background: "transparent",
    color: "#000",
    border: "1.5px solid #000",
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    transition: "background .15s, color .15s, transform .1s",
  },
};
