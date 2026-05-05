import { CSSProperties } from "react";

type SubmissionType = "Review Request" | "Help Request" | "Educational Sharing";
type Language = "Python"| "C" | "C++"| "Java"| "JavaScript"| "TypeScript"|
  "C#"| "Visual Basic"| "Fortran"| "ML"| "Haskell"|
  "Lisp"| "Scheme"| "Pascal"| "Modula2"| "Ada"|
  "Perl"| "TCL"| "MATLAB"| "VHDL"| "Verilog"|
  "Spice"| "MIPS Assembly"| "x86 Assembly"| "HCL2";

interface SubmissionPreviewProps {
  title: string;
  language: Language | "";
  type: SubmissionType | "";
  courseTag: string;
  fileCount: number;
}

const TYPE_COLORS: Record<SubmissionType, { bg: string; color: string }> = {
  "Review Request":      { bg: "#051650", color: "#fff" },
  "Help Request":        { bg: "#000",    color: "#fff" },
  "Educational Sharing": { bg: "#fff",    color: "#000" },
};

const LANG_COLORS: Record<Language, string> = {
  Python: "#3572A5", C: "#555555", "C++": "#f34b7d", Java: "#b07219",
  JavaScript: "#f1e05a", TypeScript: "#2b7489", "C#": "#178600",
  "Visual Basic": "#945db7", Fortran: "#4d41b1", ML: "#dc566d",
  Haskell: "#5e5086", Lisp: "#3fb68b", Scheme: "#1e4aec", Pascal: "#dea584",
  Modula2: "#10253e", Ada: "#02f88c", Perl: "#0298c3", TCL: "#e4cc98",
  MATLAB: "#e16737", VHDL: "#adb2cb", Verilog: "#b2b7f8", Spice: "#b58900",
  "MIPS Assembly": "#6e4c13", "x86 Assembly": "#e38c00", HCL2: "#8e8e8e",
};

export default function SubmissionPreview({
  title, language, type, courseTag, fileCount,
}: SubmissionPreviewProps) {
  return (
    <aside style={styles.sidebar}>
      {/* Card */}
      <div style={styles.card}>
        {/* Card top accent */}
        <div style={styles.cardAccent} />

        <div style={styles.cardInner}>
          {/* Header label */}
          <p style={styles.sectionLabel}>Live Preview</p>

          {/* Title */}
          <p style={styles.previewTitle}>
            {title || <span style={styles.placeholder}>Your submission title</span>}
          </p>

          {/* Author */}
          <p style={styles.author}>by You</p>

          {/* Divider */}
          <div style={styles.divider} />

          {/* Tags */}
          <div style={styles.tagRow}>
            {language ? (
              <span
                style={{
                  ...styles.tag,
                  background: LANG_COLORS[language],
                  color: language === "JavaScript" || language === "TCL" ? "#111" : "#fff",
                }}
              >
                {language}
              </span>
            ) : (
              <span style={{ ...styles.tag, ...styles.tagEmpty }}>Language</span>
            )}

            {type ? (
              <span style={{
                ...styles.tag,
                background: TYPE_COLORS[type].bg,
                color: TYPE_COLORS[type].color,
                border: type === "Educational Sharing" ? "1.5px solid #000" : "none",
              }}>
                {type}
              </span>
            ) : (
              <span style={{ ...styles.tag, ...styles.tagEmpty }}>Type</span>
            )}
          </div>

          {/* Meta row */}
          <div style={styles.metaRow}>
            {courseTag && (
              <span style={styles.metaItem}>
                <span style={styles.metaIcon}>@</span>
                {courseTag}
              </span>
            )}
            <span style={styles.metaItem}>
              <span style={styles.metaIcon}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              {fileCount} {fileCount === 1 ? "file" : "files"}
            </span>
            <span style={styles.metaItem}>
              <span style={styles.metaIcon}>⏱</span>
              just now
            </span>
          </div>
        </div>
      </div>

    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontFamily: "'DM Sans', sans-serif",
    position: "sticky",
    top: 24,
  },
  card: {
    background: "#fff",
    border: "1.5px solid #000",
    overflow: "hidden",
  },
  cardAccent: {
    height: 4,
    background: "#051650",
  },
  cardInner: {
    padding: "20px 22px 22px",
  },
  sectionLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#051650",
    margin: "0 0 14px",
  },
  previewTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: 18,
    fontWeight: 700,
    color: "#000",
    margin: "0 0 4px",
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
    minHeight: 22,
  },
  placeholder: {
    color: "#d1d5db",
    fontWeight: 400,
    fontStyle: "italic",
  },
  author: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    color: "#9ca3af",
    margin: "0 0 14px",
    fontWeight: 400,
  },
  divider: {
    height: "1px",
    background: "#e5e7eb",
    marginBottom: 14,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  tag: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "4px 10px",
    borderRadius: 0,
  },
  tagEmpty: {
    background: "#f3f4f6",
    color: "#d1d5db",
    border: "1.5px dashed #d1d5db",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 11,
    color: "#6b7280",
  },
  metaIcon: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 10,
    color: "#051650",
    display: "flex",
    alignItems: "center",
  },
  tipsBox: {
    border: "1.5px solid #000",
    borderLeft: "4px solid #051650",
    padding: "14px 16px",
    background: "#fafafa",
  },
  tipsLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#051650",
    margin: "0 0 10px",
  },
  tipsList: {
    margin: 0,
    padding: "0 0 0 14px",
  },
  tipItem: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    color: "#374151",
    marginBottom: 5,
    lineHeight: 1.5,
  },
};