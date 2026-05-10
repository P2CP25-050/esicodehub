import Link from "next/link";

interface GreetingBarProps {
  role: "student" | "professor";
}

export default function GreetingBar({ role }: GreetingBarProps) {
  const isProfessor = role === "professor";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
      }}
    >
      <Link
        href="/submissions/new"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 20px",
          background: "var(--navy)",
          color: "#ffffff",
          fontSize: "11px",
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          textDecoration: "none",
          border: "1.5px solid var(--navy)",
          transition: "background 0.15s, box-shadow 0.12s, transform 0.1s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--ink)";
          el.style.borderColor = "var(--ink)";
          el.style.boxShadow = "4px 4px 0 var(--navy)";
          el.style.transform = "translate(-2px, -2px)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = "var(--navy)";
          el.style.borderColor = "var(--navy)";
          el.style.boxShadow = "none";
          el.style.transform = "translate(0, 0)";
        }}
      >
        + New Submission
      </Link>

      {isProfessor && (
        <Link
          href="/assignments/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            background: "transparent",
            color: "var(--ink)",
            fontSize: "11px",
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            textDecoration: "none",
            border: "1.5px solid var(--ink)",
            transition:
              "background 0.15s, color 0.15s, box-shadow 0.12s, transform 0.1s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "var(--ink)";
            el.style.color = "#ffffff";
            el.style.boxShadow = "4px 4px 0 #aaa";
            el.style.transform = "translate(-2px, -2px)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "transparent";
            el.style.color = "var(--ink)";
            el.style.boxShadow = "none";
            el.style.transform = "translate(0, 0)";
          }}
        >
          + Create Assignment
        </Link>
      )}
    </div>
  );
}