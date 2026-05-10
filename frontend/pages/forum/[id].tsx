import { useCallback, useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  getQuestion,
  deleteQuestion,
  voteQuestion,
  updateQuestion,
  closeQuestion,
} from "@/services/forum";
import type { QuestionDetail } from "@/services/forum";
import Header from "@/components/submissions/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { QuestionDetailCard } from "@/components/forum/QuestionDetailCard";
import { AnswerSection } from "@/components/forum/AnswerSection";
import { QuestionStatsSidebar } from "@/components/forum/QuestionStatsSidebar";

function QuestionDetailContent() {
  const { user } = useAuth();
  const currentUserEmail = user?.email ?? "";
  const router = useRouter();

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const rawId = router.isReady ? router.query.id : undefined;
  const questionId =
    typeof rawId === "string" && /^\d+$/.test(rawId)
      ? Number(rawId)
      : null;

  const idError =
    router.isReady && questionId === null ? "Invalid question ID." : "";

  const isLoading = !router.isReady || loading;
  const displayError = idError || error;

  useEffect(() => {
    if (!router.isReady || questionId === null) return;

    let cancelled = false;

    const loadQuestion = async () => {
      setLoading(true);
      setError("");
      try {
        const q = await getQuestion(questionId);
        if (!cancelled) setQuestion(q);
      } catch {
        if (!cancelled) setError("Failed to load question.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadQuestion();
    return () => { cancelled = true; };
  }, [router.isReady, questionId]);

  const hasAccepted = (question?.answers ?? []).some((a) => a.is_accepted);

  // ── Question vote ─────────────────────────────────────────────────────────
  const handleQuestionVote = async (v: 1 | -1) => {
    if (questionId === null) return;
    if (question?.author_email === currentUserEmail) return;
    setError("");

    setQuestion((prev) => {
      if (!prev) return prev;
      const prevVote = prev.user_vote ?? null;
      if (prevVote !== null && prevVote !== v) return prev;
      const nextVote: 1 | -1 | null = prevVote === v ? null : v;
      const delta = (nextVote ?? 0) - (prevVote ?? 0);
      return { ...prev, vote_score: prev.vote_score + delta, user_vote: nextVote };
    });

    try {
      const q = await voteQuestion(questionId, v);
      if (q && typeof q === "object" && "vote_score" in q) {
        setQuestion((prev) => prev ? {
          ...prev,
          vote_score: q.vote_score,
          ...("user_vote" in q ? { user_vote: (q as { user_vote?: 1 | -1 | null }).user_vote ?? v } : {}),
        } : null);
      }
    } catch {
      try {
        const refreshed = await getQuestion(questionId);
        setQuestion(refreshed);
      } catch { /* keep existing state */ }
      setError("Failed to submit vote.");
    }
  };

  // ── Question delete ───────────────────────────────────────────────────────
  const handleDeleteQuestion = async () => {
    if (questionId === null) return;
    if (!confirm("Delete this question?")) return;
    await deleteQuestion(questionId);
    router.push("/forum");
  };

  // ── Question edit ─────────────────────────────────────────────────────────
  const handleEditQuestion = useCallback(
    async (data: {
      title: string;
      body: string;
      code_snippet?: string;
      code_language?: string;
    }) => {
      if (questionId === null) return;
      const updated = await updateQuestion(questionId, data);
      setQuestion((prev) => prev ? { ...prev, ...updated } : prev);
    },
    [questionId]
  );

  // ── Question close ────────────────────────────────────────────────────────
  const handleCloseQuestion = useCallback(async () => {
    if (questionId === null) return;
    const updated = await closeQuestion(questionId);
    setQuestion((prev) => prev ? { ...prev, ...updated } : prev);
  }, [questionId]);

  // ── Answer tree updates ───────────────────────────────────────────────────
  const handleQuestionUpdate = useCallback(
    (updater: (q: QuestionDetail) => QuestionDetail) => {
      setQuestion((prev) => (prev ? updater(prev) : prev));
    },
    []
  );

  if (!user) {
    return <LoadingSpinner message="Loading user session" />;
  }

  return (
    <>
      <Head>
        <title>{question ? `${question.title} — ESICodeHub` : 'Q&A Forum — ESICodeHub'}</title>
      </Head>
      <Header activePage="Q&A Forums" />

      <div className="min-h-screen bg-[#eef0f8]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8">

          {/* Loading */}
          {isLoading && !displayError && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center space-y-3">
                <svg
                  className="animate-spin w-10 h-10 text-[#0d1b4b] mx-auto"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="text-sm text-slate-500 font-medium">Loading question…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {displayError && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600">
              <p className="font-bold">{displayError}</p>
              <Link href="/forum" className="text-sm text-red-400 hover:underline mt-2 block">
                ← Back to Forum
              </Link>
            </div>
          )}

          {question && !isLoading && questionId !== null && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                <QuestionDetailCard
                  question={question}
                  currentUserEmail={currentUserEmail}
                  onVote={handleQuestionVote}
                  onDelete={handleDeleteQuestion}
                  onEdit={handleEditQuestion}
                  onClose={handleCloseQuestion}
                />

                <AnswerSection
                  question={question}
                  currentUserEmail={currentUserEmail}
                  onQuestionUpdate={handleQuestionUpdate}
                />
              </div>

              {/* Sidebar */}
              <QuestionStatsSidebar question={question} hasAccepted={hasAccepted} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function QuestionDetailPage() {
  return (
    <ProtectedRoute>
      <QuestionDetailContent />
    </ProtectedRoute>
  );
}