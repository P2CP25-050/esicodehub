import Link from "next/link";
import { VoteButtons } from "@/components/forum/VoteButtons";
import { CodeBlock } from "@/components/forum/CodeBlock";
import type { QuestionDetail } from "@/services/forum";
import { timeAgo } from "@/utils/time";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface QuestionDetailCardProps {
  question: QuestionDetail;
  currentUserEmail: string;
  onVote: (v: 1 | -1) => void;
  onDelete: () => void;
}

export function QuestionDetailCard({
  question,
  currentUserEmail,
  onVote,
  onDelete,
}: QuestionDetailCardProps) {
  const isOwn = question.author_email === currentUserEmail;

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Closed banner */}
      {question.is_closed && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-2 text-red-700 text-sm font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          This question is closed and no longer accepting answers.
        </div>
      )}

      {/* Header strip */}
      <div className="bg-[#0d1b4b] px-6 py-5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-400 opacity-10 rounded-full" />
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 text-blue-400 text-xs mb-2">
              <Link href="/forum" className="hover:text-white transition-colors">
                Forum
              </Link>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-blue-300">Question</span>
            </div>
            <h1 className="text-xl font-black text-white leading-snug max-w-2xl">
              {question.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-4 items-start">
          {/* Votes */}
          <div className="shrink-0 pt-1">
            <VoteButtons
              score={question.vote_score}
              userVote={question.user_vote ?? null}
              onVote={onVote}
              hidden={isOwn}
            />
          </div>

          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {question.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-0.5 bg-[#0d1b4b] text-white text-[10px] font-bold rounded-full tracking-wide"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 ml-auto">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {question.view_count}
                </span>
                <span>{timeAgo(question.created_at)}</span>
              </div>
            </div>

            {/* Author */}
            <Link
	      href={`/profile/${question.author_public_id}`}
	      onClick={(e) => e.stopPropagation()}
	      className="flex items-center gap-2 mb-4 w-fit group"
	    >
	   <div className="w-7 h-7 rounded-full bg-[#0d1b4b] flex items-center justify-center text-white text-[10px] font-black border-2 border-transparent group-hover:border-blue-300 transition-all">
	     {initials(question.author_name)}
	   </div>
	   <span className="text-sm font-bold text-[#0d1b4b] group-hover:underline">
	     {question.author_name}
	     </span>
	   </Link> 

            {/* Body */}
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
              {question.body}
            </p>

            {/* Code snippet */}
            {question.code_snippet && (
              <CodeBlock code={question.code_snippet} lang={question.code_language || "plaintext"} />
            )}

            {/* Owner actions */}
            {isOwn && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                <button className="text-xs font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
                {!question.is_closed && (
                  <button className="text-xs font-semibold text-amber-600 hover:text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
