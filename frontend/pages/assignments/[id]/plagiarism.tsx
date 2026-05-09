import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import axios from "axios";

import Header from "@/components/submissions/Header";
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

const PAGE_CSS = `...`; // same as before, omitted for brevity

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value)}%`;
};

const getSimilarityTone = (value: number) => {
  if (value >= 70) return { row: "bg-rose-50/80", badge: "bg-rose-100 text-rose-700" };
  if (value >= 50) return { row: "bg-amber-50/80", badge: "bg-amber-100 text-amber-700" };
  return { row: "bg-emerald-50/60", badge: "bg-emerald-100 text-emerald-700" };
};

const languageBadgePalette = [
  "bg-sky-100 text-sky-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];
const getLanguageBadgeStyle = (language: string): string => {
  if (!language) return "bg-slate-100 text-slate-700";
  const index =
    language.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    languageBadgePalette.length;
  return languageBadgePalette[index];
};

// Define type for display rows
type DisplayRow = {
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
  const [reportState, setReportState] = useState<"loading" | "none" | "ready" | "error">("loading");
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "ap-plagiarism-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = PAGE_CSS;
      document.head.appendChild(tag);
    }
  }, []);

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
      if (!options?.silent) setLoadingReport(true);
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
        if (!options?.silent) setLoadingReport(false);
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

  const displayRows = useMemo((): DisplayRow[] => {
    if (!filteredMatches.length) return [];
    const rows: DisplayRow[] = [];
    const isAiSide = (name: string, email: string) => name === "AI Reference" || !email;
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
      rows.push({
        key: `ai-${match.language}-${studentEmail}`,
        studentAName: studentName,
        studentAEmail: studentEmail,
        studentBName: "AI Reference",
        studentBEmail: "",
        language: match.language,
        similarityA: studentSimilarity,
        similarityB: studentSimilarity,
        maxSimilarity: studentSimilarity,
        linesMatched: null,
        mossLink: null,
        isAiAggregate: true,
        aiMatchCount: 1,
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

  const canRunCheck = Boolean(deadlinePassed && !triggering);
  const showLoading = loadingAssignment || (loadingReport && reportState === "loading");

  return (
    <div className="ap-page">
      <Header activePage="Assignments" />
      <div className="ap-container">
        <nav className="ap-breadcrumb">
          <Link href="/" className="ap-breadcrumb-link">~/home</Link>
          <span className="ap-breadcrumb-sep">/</span>
          <Link href="/assignments" className="ap-breadcrumb-link">assignments</Link>
          <span className="ap-breadcrumb-sep">/</span>
          {assignmentId ? (
            <Link href={`/assignments/${assignmentId}`} className="ap-breadcrumb-link">
              assignment
            </Link>
          ) : (
            <span>assignment</span>
          )}
          <span className="ap-breadcrumb-sep">/</span>
          <span>plagiarism</span>
        </nav>

        <div className="ap-page-header">
          <div>
            <h1 className="ap-page-title">Plagiarism <span>Report</span></h1>
            <p className="ap-page-subtitle">
              {assignment ? assignment.title : "Loading..."}
            </p>
          </div>
        </div>

        {pageError && (
          <div className="error-banner">
            <span>⚠ {pageError}</span>
            <button className="btn-outline" onClick={() => { void loadAssignment(); void fetchReport(); }}>
              Retry
            </button>
          </div>
        )}

        {showLoading && (
          <div className="ap-card" style={{ textAlign: "center", padding: "60px" }}>
            <div className="loading-spinner" style={{ marginBottom: "12px" }} />
            <p>Loading report data…</p>
          </div>
        )}

        {!showLoading && reportState === "error" && reportError && (
          <div className="error-banner">
            <span>⚠ {reportError}</span>
            <button className="btn-outline" onClick={() => void fetchReport()}>
              Retry
            </button>
          </div>
        )}

        {!showLoading && reportState === "none" && (
          <div className="ap-card">
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 700 }}>No report yet</h3>
                <p style={{ color: "var(--text-muted)", marginTop: "8px" }}>
                  Plagiarism check can only be run after the deadline has passed.
                </p>
              </div>
              <button
                className="btn-primary"
                onClick={handleRunCheck}
                disabled={!canRunCheck}
                title={deadlinePassed ? "Run plagiarism check" : "Available after deadline"}
              >
                {triggering ? "Starting..." : "Run Plagiarism Check"}
              </button>
            </div>
            {reportError && <p style={{ color: "var(--red)", marginTop: "16px" }}>⚠ {reportError}</p>}
            {!deadlinePassed && (
              <p style={{ fontSize: "11px", marginTop: "12px", color: "var(--text-muted)" }}>
                Deadline not reached yet.
              </p>
            )}
          </div>
        )}

        {!showLoading && report && (report.status === "pending" || report.status === "running") && (
          <div className="ap-card" style={{ textAlign: "center" }}>
            <div className="loading-spinner" style={{ marginBottom: "12px" }} />
            <p style={{ fontWeight: 700 }}>Analysing submissions… This may take a few minutes.</p>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
              Refreshes automatically every 5 seconds.
            </p>
          </div>
        )}

        {!showLoading && report && report.status === "failed" && (
          <div className="ap-card" style={{ borderColor: "var(--red)", background: "#fff0f0" }}>
            <p style={{ fontWeight: 700, color: "var(--red)" }}>Plagiarism check failed</p>
            <p>{report.error_message || "Unable to complete plagiarism analysis."}</p>
            <button className="btn-outline" onClick={handleRunCheck} style={{ marginTop: "12px" }}>
              Retry
            </button>
          </div>
        )}

        {!showLoading && report && report.status === "complete" && (
          <div className="ap-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
              <div>
                <p className="ap-page-subtitle" style={{ marginBottom: "6px" }}>summary</p>
                <p className="ap-page-title" style={{ fontSize: "1.6rem" }}>
                  {flaggedCount} flagged pairs across {languageGroupCount} language groups
                </p>
              </div>
              <div style={{ display: "flex", gap: "12px" }}>
                <button className="btn-primary" onClick={handleRunCheck} disabled={!canRunCheck}>
                  {triggering ? "Starting..." : "Run Again"}
                </button>
                <button
                  className="btn-outline"
                  onClick={() => setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))}
                >
                  Sort: {sortDirection === "desc" ? "Highest similarity" : "Lowest similarity"}
                </button>
              </div>
            </div>

            {languages.length > 1 && (
              <div className="ap-chip-group">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    className={`ap-chip ${activeLanguage === lang ? "active" : ""}`}
                    onClick={() => setActiveLanguage(lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}

            <div className="ap-table-container">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Student A</th><th>Student B</th><th>Language</th>
                    <th>A&apos;s match %</th><th>B&apos;s match %</th><th>Lines</th><th>AI Flag</th><th>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px" }}>No matches for this language.</td></tr>
                  ) : (
                    displayRows.map((row) => (
                      <tr key={row.key}>
                        <td style={{ borderLeft: `4px solid ${row.maxSimilarity >= 70 ? "var(--red)" : row.maxSimilarity >= 50 ? "var(--orange)" : "var(--green)"}` }}>
                          <strong>{row.studentAName}</strong><br />
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.studentAEmail || "—"}</span>
                        </td>
                        <td>
                          <strong>{row.studentBName}</strong><br />
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{row.studentBEmail || "—"}</span>
                        </td>
                        <td><span className={`ap-chip ${getLanguageBadgeStyle(row.language)}`} style={{ padding: "3px 10px" }}>{row.language || "unknown"}</span></td>
                        <td>{formatPercent(row.similarityA)}</td>
                        <td>{formatPercent(row.similarityB)}</td>
                        <td>{row.linesMatched ?? "—"}</td>
                        <td>{row.isAiAggregate ? <span className="ap-chip" style={{ background: "#f3e8ff", borderColor: "#c084fc" }}>🤖 AI</span> : "—"}</td>
                        <td>{row.mossLink ? <a href={row.mossLink} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>View diff →</a> : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "24px", borderTop: "var(--rule)", paddingTop: "20px", fontSize: "12px", color: "var(--text-muted)" }}>
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <span>■ Red — similarity ≥ 70% (high risk)</span>
                <span>■ Orange — similarity 50–70% (moderate risk)</span>
                <span>■ Green — similarity &lt; 50% (low risk)</span>
                <span>■ Purple — matched AI reference</span>
              </div>
              <p style={{ marginTop: "12px" }}>
                AI reference matching indicates structural similarity to AI-generated code – a signal for manual review.
              </p>
              <p style={{ marginTop: "8px" }}>
                MOSS only reports matches with at least 10 lines in common. These results indicate code similarity, not confirmed plagiarism.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}