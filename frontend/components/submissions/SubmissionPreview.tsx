import { CSSProperties } from "react";

type SubmissionType = "Review Request" | "Help Request" | "Educational Sharing";
type Language = "Python" | "JavaScript" | "Java" | "C++" | "SQL" | "TypeScript" | "C" | "Pascal" | "Other";
interface TypeColorEntry {
  bg: string;
  label: SubmissionType;
}

interface SubmissionPreviewProps {
  title: string;
  language: Language | "";
  type: SubmissionType | "";
  courseTag: string;
  fileCount: number;
}
 

const TYPE_COLORS: Record<SubmissionType, TypeColorEntry> = {
  "Review Request":      { bg: "#6c47ff", label: "Review Request" },
  "Help Request":        { bg: "#00b894", label: "Help Request" },
  "Educational Sharing": { bg: "#fd9644", label: "Educational Sharing" },
};
 
const LANG_COLORS: Record<Language, string> = {
  Python:     "#3572A5",
  JavaScript: "#f1e05a",
  Java:       "#b07219",
  "C++":      "#f34b7d",
  SQL:        "#e38c00",
  TypeScript: "#2b7489",
  C:          "#00ADD8",
  Pascal:     "#dea584",
  Other:      "#8e8e8e",
};
export default function SubmissionPreview({
  title,
  language,
  type,
  courseTag,
  fileCount,
}: SubmissionPreviewProps) {
  return (
    <aside style={styles.sidebar}>
      {/* Live Preview Card */}
      <div style={styles.previewCard}>
        <h3 style={styles.previewHeading}>Preview</h3>
        <p style={styles.previewTitle}>{title || "Your submission title"}</p>
        <p style={styles.previewAuthor}>by You</p>

        <div style={styles.tagRow}>
          {language && (
            <span
              style={{
                ...styles.tag,
                background: LANG_COLORS[language],
                color: language === "JavaScript" ? "#111" : "#fff",
              }}
            >
              {language}
            </span>
          )}
          {type && (
            <span style={{ ...styles.tag, background: TYPE_COLORS[type].bg, color: "#fff" }}>
              {type}
            </span>
          )}
        </div>

        {courseTag && <p style={styles.previewMeta}>@ {courseTag}</p>}

        <p style={styles.previewMeta}>
          <svg width="18" height="18" viewBox="0 0 32 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M7.99984 16.3334L9.99984 12.9501C10.2173 12.5723 10.548 12.2533 10.9567 12.0272C11.3653 11.8012 11.8365 11.6766 12.3198 11.6668H26.6665M26.6665 11.6668C27.0739 11.6662 27.476 11.7472 27.842 11.9037C28.208 12.0602 28.5282 12.288 28.7779 12.5696C29.0277 12.8512 29.2004 13.1792 29.2828 13.5283C29.3651 13.8773 29.355 14.2383 29.2532 14.5834L27.1998 21.5834C27.0513 22.0869 26.7148 22.5326 26.2437 22.8496C25.7727 23.1667 25.1941 23.337 24.5998 23.3334H5.33317C4.62593 23.3334 3.94765 23.0876 3.44755 22.65C2.94746 22.2124 2.6665 21.619 2.6665 21.0001V5.83345C2.6665 5.21461 2.94746 4.62111 3.44755 4.18353C3.94765 3.74594 4.62593 3.50011 5.33317 3.50011H10.5332C10.9792 3.49629 11.4191 3.5904 11.8128 3.77384C12.2064 3.95727 12.5412 4.22417 12.7865 4.55011L13.8665 5.95011C14.1093 6.27273 14.4399 6.53755 14.8285 6.72082C15.2171 6.90408 15.6517 7.00005 16.0932 7.00011H23.9998C24.7071 7.00011 25.3854 7.24594 25.8855 7.68353C26.3856 8.12111 26.6665 8.71461 26.6665 9.33345V11.6668Z"
              stroke="#FBBC04"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {fileCount} file{fileCount !== 1 ? "s" : ""} · just now
        </p>
      </div>
    </aside>
  );
}

const styles: Record<string, CSSProperties> = {
  sidebar: { display: "flex", flexDirection: "column", gap: 20 },
  previewCard: {
    background: "#fff",
    borderRadius: 16,
    padding: "24px",
    boxShadow: "0 4px 24px rgba(30,60,120,0.08)",
    border: "1px solid #e2e8f6",
  },
  previewHeading: {
    fontSize: 13,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    margin: "0 0 16px",
  },
  previewTitle: { fontSize: 16, fontWeight: 700, color: "#0d1b2a", margin: "0 0 8px", minHeight: 24 },
  previewAuthor: {
    fontSize: 13,
    color: "#64748b",
    margin: "0 0 12px",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tag: { padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  previewMeta: {
    fontSize: 12,
    color: "#64748b",
    margin: "4px 0",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
 
};