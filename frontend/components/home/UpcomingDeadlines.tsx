import Link from "next/link";
import { useState, useEffect } from "react";
import SkeletonCard from "./SkeletonCard";

const SUBJECT_COLORS: string[] = [
  "#6c47ff", "#00b894", "#fd9644", "#e17055", "#0984e3", "#a29bfe",
];

interface Assignment {
  id: string | number;
  title: string;
  /** Flattened subject code string, e.g. "CS301" */
  subject?: string;
  deadline: string;
  is_open?: boolean;
  has_submitted?: boolean;
  submission_count?: number;
}

interface UpcomingDeadlinesProps {
  assignments: Assignment[];
  loading: boolean;
  error: boolean;
  role: "student" | "professor";
}

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Countdown({ deadline }: { deadline: string }) {
  const now = useNow(60000);
  const diff = new Date(deadline).getTime() - now;

  if (diff <= 0) {
    return <span className="text-xs font-bold text-red-500">Expired</span>;
  }

  const totalMins = Math.floor(diff / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);

  let colorClass = "text-green-600 bg-green-50 border-green-200";
  if (diff < 24 * 60 * 60 * 1000) {
    colorClass = "text-red-600 bg-red-50 border-red-200";
  } else if (diff < 3 * 24 * 60 * 60 * 1000) {
    colorClass = "text-orange-500 bg-orange-50 border-orange-200";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${colorClass}`}
    >
      ⏱ {days}d {hours}h
    </span>
  );
}

function AssignmentCard({ assignment, idx }: { assignment: Assignment; idx: number }) {
  const subjectColor = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f6] p-5 hover:shadow-[0_4px_20px_rgba(30,60,120,0.1)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        {assignment.subject && (
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white shrink-0"
            style={{ background: subjectColor }}
          >
            {assignment.subject}
          </span>
        )}
        <Countdown deadline={assignment.deadline} />
      </div>
      <h3 className="text-[#0d1b2a] font-bold text-sm line-clamp-2 mt-1">
        {assignment.title}
      </h3>
      <p className="text-xs text-[#94a3b8] mt-1.5">
        Due: {new Date(assignment.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
    </div>
  );
}

export default function UpcomingDeadlines({ assignments, loading, error, role }: UpcomingDeadlinesProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#fd9644] to-[#e17055]" />
        <h2 className="text-base font-bold text-[#0d1b2a] tracking-tight">Upcoming Deadlines</h2>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-red-400 text-center px-4">
              Failed to load assignments. Please try again later.
            </p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center px-6 py-8">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-sm text-[#64748b]">No upcoming deadlines.</p>
            </div>
          </div>
        ) : (
          assignments.map((a, i) => <AssignmentCard key={a.id} assignment={a} idx={i} />)
        )}
      </div>

      {/* Footer link */}
      <div className="mt-4 pt-3 border-t border-[#e2e8f6]">
        <Link
          href="/assignments"
          className="text-xs font-semibold text-[#fd9644] hover:text-[#e17055] transition-colors inline-flex items-center gap-1"
        >
          View all assignments →
        </Link>
      </div>
    </div>
  );
}