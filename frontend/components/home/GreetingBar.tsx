import Link from "next/link";

interface GreetingBarProps {
  firstName: string;
  role: "student" | "professor";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function GreetingBar({ firstName, role }: GreetingBarProps) {
  const greeting = getGreeting();
  const isProfessor = role === "professor";

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
      {/* Left: greeting */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: "15px",
          color: "var(--text-secondary)",
          margin: 0,
          fontWeight: 400,
        }}>
          {greeting} —&nbsp;
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {firstName}
          </span>
        </p>

        <span style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "3px 10px",
          borderRadius: "20px",
          fontSize: "10px",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: isProfessor ? "rgba(230,201,122,0.12)" : "rgba(88,166,255,0.12)",
          color: isProfessor ? "var(--accent)" : "var(--blue)",
          border: isProfessor ? "1px solid rgba(230,201,122,0.25)" : "1px solid rgba(88,166,255,0.25)",
        }}>
          {isProfessor ? "Professor" : "Student"}
        </span>
      </div>

      {/* Right: action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <Link
          href="/submissions/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: "var(--radius)",
            background: "var(--blue)",
            color: "#0d1117",
            fontSize: "13px",
            fontWeight: 700,
            fontFamily: "var(--font-body)",
            textDecoration: "none",
            transition: "opacity 0.15s, transform 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
        >
          <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> New Submission
        </Link>

        {isProfessor && (
          <Link
            href="/assignments/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "var(--radius)",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "var(--font-body)",
              textDecoration: "none",
              border: "1px solid var(--border)",
              transition: "border-color 0.15s, background 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.background = "var(--accent-dim)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Create Assignment
          </Link>
        )}
      </div>
    </div>
  );
}