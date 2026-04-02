"use client";

import { useRouter } from "next/navigation";
import type { Assignment } from "@/services/assignments";
import { formatDeadline, isPastDeadline } from "./utils";

interface Props {
  assignment: Assignment;
}

export default function StudentAssignmentCard({ assignment: a }: Props) {
  const router = useRouter();
  const past = isPastDeadline(a.deadline);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/assignments/${a.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/assignments/${a.id}`)}
      className="
        group relative bg-white rounded-2xl border border-slate-200
        p-6 flex flex-col gap-2 cursor-pointer
        transition-all duration-200
        hover:shadow-[0_8px_32px_rgba(30,60,120,0.13)] hover:-translate-y-0.5
        focus:outline-none focus:ring-2 focus:ring-blue-500/40
      "
    >
      {/* Subject badge + submitted badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="
          bg-gradient-to-r from-blue-600 to-blue-700
          text-white text-xs font-bold px-2.5 py-0.5 rounded-md tracking-wide
        ">
          {a.subject.code}
        </span>

        {/* `submitted` field doesn't exist in the real type — shown via has_reviews placeholder */}
        {a.is_open === false && (
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-0.5 rounded-md">
            Closed
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-extrabold text-[#0d1b2a] leading-snug mt-1 pr-8">
        {a.title}
      </h3>

      {/* Subject name */}
      <p className="text-xs text-slate-500 font-medium">{a.subject.name}</p>

      {/* Professor */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        {a.professor_name}
      </div>

      {/* Deadline */}
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${past ? "text-red-500" : "text-green-600"}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {past ? "Overdue · " : "Due · "}{formatDeadline(a.deadline)}
      </div>

      {/* Arrow */}
      <span className="
        absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 text-lg
        transition-colors duration-150 group-hover:text-blue-500
      ">→</span>
    </div>
  );
}