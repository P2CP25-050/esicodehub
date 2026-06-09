import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";

import Header from "@/components/submissions/Header";
import Head from 'next/head';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getAssignment } from "@/services/assignments";
import type { Assignment } from "@/services/assignments";
import {
  getPlagiarismReport,
  triggerPlagiarismCheck,
  type PlagiarismReport,
  type PlagiarismStatus,
  type SimilarityMatch,
} from "@/services/plagiarism";

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value)}%`;
};

const getSimilarityTone = (value: number) => {
  if (value >= 70) {
    return {
      row: "bg-rose-50/80",
      border: "border-rose-400",
      badge: "bg-rose-100 text-rose-700 border-rose-200",
    };
  }

  if (value >= 50) {
    return {
      row: "bg-amber-50/80",
      border: "border-amber-400",
      badge: "bg-amber-100 text-amber-700 border-amber-200",
    };
  }

  return {
    row: "bg-emerald-50/60",
    border: "border-emerald-400",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
};

const languageBadgePalette = [
  "bg-sky-100 text-sky-700 border-sky-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
];

const getLanguageBadgeStyle = (language: string): string => {
  if (!language) return "bg-slate-100 text-slate-700 border-slate-200";
  const index =
    language
      .split("")
      .reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    languageBadgePalette.length;
  return languageBadgePalette[index];
};

export default function PlagiarismReportPage() {
  return (
    <ProtectedRoute allowedRole="professor">
      <PlagiarismReportContent />
    </ProtectedRoute>
  );
}

function PlagiarismReportContent() {
  const router = useRouter();

  const assignmentId = useMemo(() => {
    if (!router.isReady) return null;
    const raw = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [router.isReady, router.query.id]);

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [reportState, setReportState] = useState<"loading" | "none" | "ready" | "error">(
    "loading"
  );
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const loadAssignment = useCallback(async () => {
    if (assignmentId == null) return;

    setLoadingAssignment(true);
    setPageError(null);

    try {
      const data = await getAssignment(assignmentId);
      setAssignment(data);
    } catch (error) {
      setPageError(getErrorMessage(error, "Failed to load assignment."));
    } finally {
      setLoadingAssignment(false);
    }
  }, [assignmentId]);

  const fetchReport = useCallback(
    async (options?: { silent?: boolean }) => {
      if (assignmentId == null) return;

      if (!options?.silent) {
        setLoadingReport(true);
      }

      setReportError(null);

      try {
        const data = await getPlagiarismReport(assignmentId);
        setReport(data);
        setReportState("ready");
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setReport(null);
          setReportState("none");
        } else {
          setReport(null);
          setReportState("error");
          setReportError(getErrorMessage(error, "Failed to load plagiarism report."));
        }
      } finally {
        if (!options?.silent) {
          setLoadingReport(false);
        }
      }
    },
    [assignmentId]
  );

  useEffect(() => {
    if (!router.isReady) return;

    if (assignmentId == null) {
      setPageError("Invalid assignment id.");
      setLoadingAssignment(false);
      setLoadingReport(false);
      setReportState("error");
      return;
    }

    void loadAssignment();
    void fetchReport();
  }, [assignmentId, router.isReady, loadAssignment, fetchReport]);

  useEffect(() => {
    if (!report) return;
    if (report.status !== "pending" && report.status !== "running") return;

    const interval = window.setInterval(() => {
      void fetchReport({ silent: true });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [report, fetchReport]);

  const handleRunCheck = async () => {
    if (assignmentId == null || triggering) return;

    setTriggering(true);
    setReportError(null);

    try {
      const result = await triggerPlagiarismCheck(assignmentId);
      const optimisticStatus =
        (result.status as PlagiarismStatus) ?? ("pending" as PlagiarismStatus);

      setReport({
        id: result.report_id,
        status: optimisticStatus,
        triggered_by: "You",
        triggered_at: new Date().toISOString(),
        completed_at: null,
        moss_urls: {},
        error_message: "",
        match_count: 0,
        matches: [],
      });
      setReportState("ready");
      void fetchReport({ silent: true });
    } catch (error) {
      setReportError(getErrorMessage(error, "Failed to run plagiarism check."));
    } finally {
      setTriggering(false);
    }
  };



  const languages = useMemo(() => {
    if (!report) return [] as string[];
    const mossLanguages = Object.keys(report.moss_urls ?? {});
    if (mossLanguages.length > 0) return mossLanguages;

    const fromMatches = new Set(
      (report.matches ?? []).map((match) => match.language).filter(Boolean)
    );
    return Array.from(fromMatches);
  }, [report]);

  useEffect(() => {
    if (languages.length === 0) {
      setActiveLanguage(null);
      return;
    }

    if (!activeLanguage || !languages.includes(activeLanguage)) {
      setActiveLanguage(languages[0]);
    }
  }, [languages, activeLanguage]);

  const languageGroupCount = useMemo(() => {
    if (!report) return 0;
    if (languages.length > 0) return languages.length;
    const matchLanguages = new Set(report.matches.map((match) => match.language));
    return matchLanguages.size;
  }, [report, languages]);

  const filteredMatches = useMemo(() => {
    if (!report) return [] as SimilarityMatch[];
    if (!activeLanguage) return report.matches;
    return report.matches.filter((match) => match.language === activeLanguage);
  }, [report, activeLanguage]);

  const displayRows = useMemo(() => {
    if (!filteredMatches.length) return [] as Array<{
      key: string;
      studentAName: string;
      studentAEmail: string;
      studentBName: string;
      studentBEmail: string;
      language: string;
      similarityA: number;
      similarityB: number;
      maxSimilarity: number;
      linesMatched: number | null;
      mossLink: string | null;
      isAiAggregate: boolean;
      aiMatchCount: number;
    }>;

    const aiAggregates = new Map<string, {
      studentName: string;
      studentEmail: string;
      language: string;
      total: number;
      count: number;
    }>();

    const rows = [] as Array<{
      key: string;
      studentAName: string;
      studentAEmail: string;
      studentBName: string;
      studentBEmail: string;
      language: string;
      similarityA: number;
      similarityB: number;
      maxSimilarity: number;
      linesMatched: number | null;
      mossLink: string | null;
      isAiAggregate: boolean;
      aiMatchCount: number;
    }>;

    const isAiSide = (name: string, email: string) =>
      name === "AI Reference" || !email;

    filteredMatches.forEach((match) => {
      if (!match.ai_moss_flag) {
        rows.push({
          key: `match-${match.id}`,
          studentAName: match.student_a_name,
          studentAEmail: match.student_a_email,
          studentBName: match.student_b_name,
          studentBEmail: match.student_b_email,
          language: match.language,
          similarityA: match.similarity_a,
          similarityB: match.similarity_b,
          maxSimilarity: match.max_similarity,
          linesMatched: match.lines_matched,
          mossLink: match.moss_link,
          isAiAggregate: false,
          aiMatchCount: 0,
        });
        return;
      }

      const aIsAi = isAiSide(match.student_a_name, match.student_a_email);
      const studentName = aIsAi ? match.student_b_name : match.student_a_name;
      const studentEmail = aIsAi ? match.student_b_email : match.student_a_email;
      const studentSimilarity = aIsAi ? match.similarity_b : match.similarity_a;

      const key = `${match.language}::${studentEmail || studentName}`;
      const existing = aiAggregates.get(key);
      if (existing) {
        existing.total += studentSimilarity;
        existing.count += 1;
      } else {
        aiAggregates.set(key, {
          studentName,
          studentEmail,
          language: match.language,
          total: studentSimilarity,
          count: 1,
        });
      }
    });

    aiAggregates.forEach((item, key) => {
      const mean = item.count ? item.total / item.count : 0;
      rows.push({
        key: `ai-${key}`,
        studentAName: item.studentName,
        studentAEmail: item.studentEmail,
        studentBName: "AI Reference (mean)",
        studentBEmail: "",
        language: item.language,
        similarityA: mean,
        similarityB: mean,
        maxSimilarity: mean,
        linesMatched: null,
        mossLink: null,
        isAiAggregate: true,
        aiMatchCount: item.count,
      });
    });

    const sorted = rows.slice().sort((a, b) => b.maxSimilarity - a.maxSimilarity);
    if (sortDirection === "asc") return sorted.reverse();
    return sorted;
  }, [filteredMatches, sortDirection]);

  const flaggedCount = useMemo(() => {
    if (!displayRows.length) return 0;
    return displayRows.filter((row) => row.maxSimilarity >= 70).length;
  }, [displayRows]);

  const deadlinePassed = useMemo(() => {
    if (!assignment) return false;
    const deadline = new Date(assignment.deadline);
    if (Number.isNaN(deadline.getTime())) return false;
    return Date.now() > deadline.getTime();
  }, [assignment]);

  const statusLabel = report?.status
    ? report.status.charAt(0).toUpperCase() + report.status.slice(1)
    : "No report";

  const canRunCheck = Boolean(deadlinePassed && !triggering);
  const showLoading = loadingAssignment || (loadingReport && reportState === "loading");

  return (
    <>
      <Head>
        <title>{assignment ? `${assignment.title} — Plagiarism Report — ESICodeHub` : 'Plagiarism Report — ESICodeHub'}</title>
      </Head>
      <div
        className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#eef2f7] to-[#e1f2ff]"
        style={{ fontFamily: "'Outfit', sans-serif" }}
      >
      <Header activePage="Assignments" />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="font-medium text-slate-600 hover:text-slate-900">
            Home
          </Link>
          <span>/</span>
          <Link
            href="/assignments"
            className="font-medium text-slate-600 hover:text-slate-900"
          >
            Assignments
          </Link>
          <span>/</span>
          {assignmentId ? (
            <Link
              href={`/assignments/${assignmentId}`}
              className="font-medium text-slate-600 hover:text-slate-900"
            >
              Assignment
            </Link>
          ) : (
            <span className="text-slate-400">Assignment</span>
          )}
          <span>/</span>
          <span className="text-slate-400">Plagiarism Report</span>
        </nav>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
                Professor Console
              </p>
              <h1
                className="text-3xl font-semibold text-slate-900 sm:text-4xl"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Plagiarism Report
              </h1>
              <p className="text-sm text-slate-500">
                {assignment ? `Assignment: ${assignment.title}` : "Assignment loading..."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Deadline
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {assignment ? formatDateTime(assignment.deadline) : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{statusLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {pageError && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>⚠ {pageError}</span>
              <button
                onClick={() => {
                  void loadAssignment();
                  void fetchReport();
                }}
                className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {showLoading && (
          <div className="mt-6 grid gap-4">
            <div className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white/70" />
            <div className="h-60 animate-pulse rounded-3xl border border-slate-200 bg-white/70" />
          </div>
        )}

        {!showLoading && reportState === "error" && reportError && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-white p-6">
            <p className="text-sm font-semibold text-red-600">⚠ {reportError}</p>
            <button
              onClick={() => void fetchReport()}
              className="mt-4 rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {!showLoading && reportState === "none" && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-900">No report yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Plagiarism check can only be run after the deadline has passed.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2">
                <button
                  onClick={handleRunCheck}
                  disabled={!canRunCheck}
                  title={
                    deadlinePassed
                      ? "Run plagiarism check"
                      : "Available after the deadline passes."
                  }
                  className={`rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
                    canRunCheck
                      ? "bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.2)] hover:-translate-y-0.5"
                      : "cursor-not-allowed bg-slate-200 text-slate-500"
                  }`}
                >
                  {triggering ? "Starting..." : "Run Plagiarism Check"}
                </button>
                {!deadlinePassed && (
                  <span className="text-xs text-slate-400">
                    Deadline not reached yet.
                  </span>
                )}
              </div>
            </div>
            {reportError && (
              <p className="mt-4 text-xs font-semibold text-red-500">⚠ {reportError}</p>
            )}
          </div>
        )}

        {!showLoading && report && (report.status === "pending" || report.status === "running") && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_10px_36px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">
                Analysing submissions… This may take a few minutes.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Refreshes automatically every 5 seconds while the analysis runs.
              </p>
            </div>
          </div>
        )}

        {!showLoading && report && report.status === "failed" && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 shadow-[0_10px_36px_rgba(185,28,28,0.08)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-red-700">Plagiarism check failed</p>
                <p className="mt-1 text-sm text-red-600">
                  {report.error_message || "Unable to complete plagiarism analysis."}
                </p>
              </div>
              <button
                onClick={handleRunCheck}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!showLoading && report && report.status === "complete" && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
            <div className="border-b border-slate-200 px-6 py-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Summary
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {flaggedCount} pairs flagged across {languageGroupCount} language groups
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleRunCheck}
                    disabled={!canRunCheck}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                      canRunCheck
                        ? "bg-slate-900 text-white shadow-[0_12px_30px_rgba(15,23,42,0.2)] hover:-translate-y-0.5"
                        : "cursor-not-allowed bg-slate-200 text-slate-500"
                    }`}
                  >
                    {triggering ? "Starting..." : "Run Again"}
                  </button>
                  <button
                    onClick={() =>
                      setSortDirection((prev: string) => (prev === "desc" ? "asc" : "desc"))
                    }
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Sort: {sortDirection === "desc" ? "Highest similarity" : "Lowest similarity"}
                  </button>
                </div>
              </div>

              {languages.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {languages.map((language: string) => (
                    <button
                      key={language}
                      onClick={() => setActiveLanguage(language)}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                        activeLanguage === language
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Student A</th>
                    <th className="px-6 py-4 font-semibold">Student B</th>
                    <th className="px-6 py-4 font-semibold">Language</th>
                    <th className="px-6 py-4 font-semibold">A&apos;s match %</th>
                    <th className="px-6 py-4 font-semibold">B&apos;s match %</th>
                    <th className="px-6 py-4 font-semibold">Lines matched</th>
                    <th className="px-6 py-4 font-semibold">AI Flag</th>
                    <th className="px-6 py-4 font-semibold">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                        No matches available for this language.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row: any) => {
                      const tone = getSimilarityTone(row.maxSimilarity);
                      const aiFlag = row.isAiAggregate;
                      return (
                        <tr key={row.key} className={`border-b border-slate-100 ${tone.row}`}>
                          <td
                            className={`px-6 py-4 border-l-4 ${
                              aiFlag
                                ? "border-purple-400 bg-purple-50/60"
                                : tone.border
                            }`}
                          >
                            <p className="font-semibold text-slate-900">
                              {row.studentAName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.studentAEmail || "—"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">
                              {row.studentBName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.studentBEmail || "—"}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                                getLanguageBadgeStyle(row.language)
                              }`}
                            >
                              {row.language || "Unknown"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                            {formatPercent(row.similarityA)}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-slate-700">
                            {formatPercent(row.similarityB)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {row.linesMatched ?? "—"}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {aiFlag ? (
                              <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                                🤖 AI mean • {row.aiMatchCount} refs
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {row.mossLink ? (
                              <a
                                href={row.mossLink}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-slate-900 hover:text-slate-700"
                              >
                                View diff →
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-6 py-5 text-sm text-slate-500">
              <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                <span>■ Red — similarity ≥ 70% (high risk)</span>
                <span>■ Orange — similarity 50–70% (moderate risk)</span>
                <span>■ Green — similarity &lt; 50% (low risk)</span>
                <span>■ Purple — matched AI reference (structural similarity to AI-generated code)</span>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                AI reference matching indicates structural similarity to AI-generated code.
                This is a signal for manual review — not a determination of academic misconduct.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                MOSS only reports matches with at least 10 lines in common, so some
                low-overlap comparisons are not shown.
              </p>
              <p className="mt-3">
                These results indicate code similarity, not confirmed plagiarism. Manual
                review is required before any academic action.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
    </>
  );
}