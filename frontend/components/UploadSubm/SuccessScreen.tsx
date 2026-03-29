
import React, { CSSProperties } from "react";

interface SuccessScreenProps {
  title: string;
  onNewSubmission: () => void;
  onBack: () => void;
}

export default function SuccessScreen({ title, onNewSubmission, onBack }: SuccessScreenProps) {
  return (
    <div style={styles.successWrap}>
      <div style={styles.successCard}>
        <div style={styles.successIcon}>✓</div>
        <h2 style={styles.successTitle}>Submission Uploaded!</h2>
        <p style={styles.successSub}>
        Your submission <strong>“{title}”</strong> has been posted successfully.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={styles.btnPrimary} onClick={onNewSubmission}>
            + New Submission
          </button>
          <button style={styles.btnOutline} onClick={onBack}>
            ← Back to Submissions
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  successWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "calc(100vh - 64px)",
    padding: 24,
  },
  successCard: {
    background: "#fff",
    borderRadius: 20,
    padding: "48px 40px",
    textAlign: "center",
    boxShadow: "0 8px 40px rgba(30,60,120,0.12)",
    maxWidth: 480,
    width: "100%",
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #1d6ef5, #00c6ff)",
    color: "#fff",
    fontSize: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 24px",
    boxShadow: "0 8px 24px rgba(29,110,245,0.3)",
  },
  successTitle: { fontSize: 26, fontWeight: 800, margin: "0 0 12px", color: "#0d1b2a" },
  successSub: { fontSize: 15, color: "#64748b", margin: "0 0 32px" },
  btnPrimary: {
    padding: "12px 28px",
    background: "linear-gradient(135deg, #1d6ef5, #1558d4)",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(29,110,245,0.35)",
  },
  btnOutline: {
    padding: "12px 24px",
    background: "#fff",
    color: "#374151",
    border: "1.5px solid #d1d9e6",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};