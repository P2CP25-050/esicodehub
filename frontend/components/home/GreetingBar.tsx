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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      {/* Left: greeting + badge */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d1b2a] tracking-tight">
          {greeting},{" "}
          <span className="bg-gradient-to-r from-[#1d6ef5] to-[#00c6ff] bg-clip-text text-transparent">
            {firstName}
          </span>
          !
        </h1>
        {isProfessor ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 tracking-wide uppercase">
            Professor
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 tracking-wide uppercase">
            Student
          </span>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/submissions/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1d6ef5] to-[#1558d4] text-white text-sm font-bold shadow-[0_4px_14px_rgba(29,110,245,0.35)] hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          <span className="text-base leading-none">+</span> New Submission
        </Link>

        {isProfessor && (
          <Link
            href="/assignments/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#d1d9e6] text-[#374151] text-sm font-bold hover:bg-[#f8faff] transition-colors whitespace-nowrap shadow-sm"
          >
            <span className="text-base leading-none">+</span> Create Assignment
          </Link>
        )}
      </div>
    </div>
  );
}
