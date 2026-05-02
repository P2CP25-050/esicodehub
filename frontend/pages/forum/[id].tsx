import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  getQuestion,
  deleteQuestion,
  voteQuestion,
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
  const { id } = router.query;
  const questionId = Number(id);

  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!questionId) return;
    setLoading(true);
    getQuestion(questionId)
      .then((q) => { setQuestion(q); setLoading(false); })
      .catch(() => { setError("Failed to load question."); setLoading(false); });
  }, [questionId]);

  const hasAccepted = (question?.answers ?? []).some((a) => a.is_accepted);

  const handleQuestionVote = (v: 1 | -1) => {
    voteQuestion(questionId, v)
      .then((q) => {
        if (q && typeof q === "object" && "vote_score" in q) {
          setQuestion((prev) => prev ? { ...prev, vote_score: q.vote_score } : null);
        }
      })
      .catch(() => {});
  };

  const handleDeleteQuestion = async () => {
    if (!confirm("Delete this question?")) return;
    await deleteQuestion(questionId);
    router.push("/forum");
  };

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
      <Header activePage="Q&A Forums" />

      <div className="min-h-screen bg-[#eef0f8]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8">

          {/* Loading */}
          {loading && (
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
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600">
              <p className="font-bold">{error}</p>
              <Link href="/forum" className="text-sm text-red-400 hover:underline mt-2 block">
                ← Back to Forum
              </Link>
            </div>
          )}

          {question && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

              {/* Main column */}
              <div className="lg:col-span-2 space-y-6">
                <QuestionDetailCard
                  question={question}
                  currentUserEmail={currentUserEmail}
                  onVote={handleQuestionVote}
                  onDelete={handleDeleteQuestion}
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