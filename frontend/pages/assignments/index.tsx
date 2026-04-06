import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

// ── Shared app components ──────────────────────────────────────────────────
import Header from "@/components/submissions/Header";
import {ProtectedRoute} from "@/components/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

// ── Assignment components ──────────────────────────────────────────────────
import StudentAssignmentCard from "@/components/assignments/StudentAssignmentCard";
import ProfessorAssignmentCard from "@/components/assignments/ProfessorAssignmentCard";
import AssignmentsSkeleton from "@/components/assignments/AssignmentsSkeleton";
import EmptyState from "@/components/assignments/EmptyState";
import { extractGroups } from "@/components/assignments/utils";

// ── Hook (uses listAssignments from services/assignments) ──────────────────
import { useAssignments } from "@/hooks/useAssignments";

// ── Page entry ─────────────────────────────────────────────────────────────

export default function AssignmentsPage() {
  return (
    <ProtectedRoute>
      <AssignmentsContent />
    </ProtectedRoute>
  );
}

// ── Inner content ──────────────────────────────────────────────────────────

function AssignmentsContent() {
  const { user } = useAuth();
  const router = useRouter();

  const isProfessor = user?.role === "professor";

  const [selectedGroup, setSelectedGroup] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  // Calls GET /assignments/ via listAssignments() — backend filters by role
  const { assignments, loading, error, refetch } = useAssignments(
    isProfessor ? selectedGroup : undefined
  );

  const availableGroups = useMemo(() => extractGroups(assignments), [assignments]);

  // Client-side text search across title, subject code/name, professor
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return assignments;
    return assignments.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subject.code.toLowerCase().includes(q) ||
        a.subject.name.toLowerCase().includes(q) ||
        a.professor_name.toLowerCase().includes(q)
    );
  }, [assignments, searchQuery]);

  const count = filtered.length;

  return (
    <div className="min-h-screen bg-[#f0f4ff] font-sans text-[#1a2340]">

      {/*
        Uses your existing Header from components/submissions/Header.tsx.
        activePage="Assignments" lights up the nav tab.
        Make sure NAV_LINKS in that file includes:
          { label: "Assignments", href: "/assignments" }
      */}
      <Header activePage="Assignments" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 text-sm mb-7">
          <Link href="/" className="text-blue-600 font-medium hover:underline">
            Home
          </Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Assignments</span>
        </nav>

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0d1b2a] leading-tight">
              {isProfessor ? "My Assignments" : "Assignments"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isProfessor
                ? `${count} assignment${count !== 1 ? "s" : ""} posted`
                : `${count} assignment${count !== 1 ? "s" : ""} for you`}
            </p>
          </div>

          {/* Professor CTA */}
          {isProfessor && (
            <button
              onClick={() => router.push("/assignments/new")}
              className="
                px-5 py-3 rounded-xl text-sm font-bold text-white
                bg-linear-to-r from-blue-600 to-blue-700
                shadow-[0_4px_14px_rgba(29,110,245,0.35)]
                hover:opacity-90 active:scale-95 transition-all
                whitespace-nowrap
              "
            >
              + Create Assignment
            </button>
          )}
        </div>

        {/* ── Controls: search + group filter ── */}
        <div className="flex flex-wrap gap-3 mb-7">
          {/* Search */}
          <div className="relative flex-1 min-w-50">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by title, subject or professor…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200
                bg-white text-sm text-[#1a2340] placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                transition-all
              "
            />
          </div>

          {/* Group filter — professor + groups exist */}
          {isProfessor && availableGroups.length > 0 && (
            <select
              value={selectedGroup ?? ""}
              onChange={(e) =>
                setSelectedGroup(e.target.value ? Number(e.target.value) : undefined)
              }
              className="
                min-w-35 px-3 py-2.5 rounded-xl border border-slate-200
                bg-white text-sm text-[#1a2340]
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                cursor-pointer transition-all
              "
            >
              <option value="">All groups</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>Group {g}</option>
              ))}
            </select>
          )}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center justify-between gap-4 mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
            <span>⚠ {error}</span>
            <button
              onClick={refetch}
              className="shrink-0 px-3 py-1 rounded-lg border border-red-400 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Cards grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <AssignmentsSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState role={isProfessor ? "professor" : "student"} />
          ) : isProfessor ? (
            filtered.map((a) => (
              <ProfessorAssignmentCard key={a.id} assignment={a} />
            ))
          ) : (
            filtered.map((a) => (
              <StudentAssignmentCard key={a.id} assignment={a} />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
