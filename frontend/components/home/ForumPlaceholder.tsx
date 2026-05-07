const PLACEHOLDER_QUESTIONS = [
  { title: "How do I implement a binary search tree in Python?", tag: "Python", votes: 12, answers: 4 },
  { title: "What's the difference between async/await and Promises?", tag: "JavaScript", votes: 8, answers: 3 },
  { title: "Best practices for SQL query optimization?", tag: "SQL", votes: 15, answers: 6 },
];

const TAG_COLORS: Record<string, string> = {
  Python: "#3572A5",
  JavaScript: "#c9a227",
  SQL: "#e38c00",
};

function PlaceholderQuestionCard({ q }: { q: typeof PLACEHOLDER_QUESTIONS[0] }) {
  const tagColor = TAG_COLORS[q.tag] ?? "#484f58";
  return (
    <div style={{
      position: "relative",
      background: "var(--surface-2)",
      borderRadius: "var(--radius)",
      border: "1px solid var(--border)",
      padding: "14px 16px",
      overflow: "hidden",
      userSelect: "none",
    }}>
      {/* Blur overlay */}
      <div style={{
        position: "absolute",
        inset: 0,
        backdropFilter: "blur(2px)",
        background: "rgba(13,17,23,0.55)",
        borderRadius: "var(--radius)",
        zIndex: 1,
      }} />

      <div style={{ position: "relative", zIndex: 0, opacity: 0.4 }}>
        <h3 style={{
          color: "var(--text-primary)",
          fontWeight: 600,
          fontSize: "13px",
          margin: "0 0 8px",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          fontFamily: "var(--font-body)",
        }}>
          {q.title}
        </h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            background: tagColor,
            color: "#fff",
          }}>
            {q.tag}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>▲ {q.votes}</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>💬 {q.answers}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForumPlaceholder() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <div style={{
          width: "3px", height: "18px",
          borderRadius: "2px",
          background: "rgba(165,148,255,0.8)",
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "rgba(165,148,255,0.8)",
          flex: 1,
        }}>
          Trending Questions
        </span>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 8px",
          borderRadius: "4px",
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          background: "rgba(165,148,255,0.1)",
          color: "rgba(165,148,255,0.7)",
          border: "1px solid rgba(165,148,255,0.2)",
        }}>
          Soon
        </span>
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        {PLACEHOLDER_QUESTIONS.map((q, i) => (
          <PlaceholderQuestionCard key={i} q={q} />
        ))}

        {/* Center badge */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 10,
        }}>
          <div style={{
            background: "var(--surface)",
            border: "1px solid rgba(165,148,255,0.25)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            padding: "20px 28px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>🧵</div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(165,148,255,0.9)", margin: "0 0 4px", fontFamily: "var(--font-body)" }}>
              Forum Coming Soon
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: 0, fontFamily: "var(--font-mono)" }}>
              Sprint 6
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", margin: 0 }}>
          Forum launches in a future sprint
        </p>
      </div>
    </div>
  );
}