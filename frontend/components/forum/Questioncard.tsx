import { useRouter } from "next/router";
import type { QuestionListItem } from "@/services/forum";
import { timeAgo, tagColor } from "@/utils/forum";

interface QuestionCardProps {
  question: QuestionListItem;
  voteScore: number;
  onVote: (q: QuestionListItem, v: 1 | -1) => void;
  activeTag: string | undefined;
  onTagClick: (tag: string) => void;
}

export function QuestionCard({ question, voteScore, onVote, activeTag, onTagClick }: QuestionCardProps) {
  const router = useRouter();

  return (
    <div className="
      bg-white rounded-2xl border border-slate-200
      hover:border-blue-300 hover:shadow-md
      transition-all duration-150 flex overflow-hidden
    ">
      {/* ── Vote column ── */}
      <div className="
        flex flex-col items-center justify-start gap-1
        px-2 sm:px-3 pt-3 sm:pt-4 pb-3
        bg-slate-50 border-r border-slate-100
        w-10 sm:w-13 shrink-0
      ">
        <button
          onClick={(e) => { e.stopPropagation(); onVote(question, 1); }}
          className="text-slate-400 hover:text-blue-500 transition-colors p-0.5 rounded"
          title="Upvote"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        <span className={`
          text-sm sm:text-base font-black leading-none
          ${voteScore > 0 ? "text-blue-600" : voteScore < 0 ? "text-red-500" : "text-slate-500"}
        `}>
          {voteScore}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); onVote(question, -1); }}
          className="text-slate-400 hover:text-red-400 transition-colors p-0.5 rounded"
          title="Downvote"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* ── Content ── */}
      <div
        className="flex-1 px-3 sm:px-4 py-3 cursor-pointer min-w-0"
        onClick={() => router.push(`/forum/${question.id}`)}
      >
        {/* Title + accepted checkmark */}
        <div className="flex items-start gap-2 mb-1.5 sm:mb-2">
          <h3 className="text-sm sm:text-base font-bold text-[#0d1b2a] leading-snug flex-1 hover:text-blue-700 transition-colors line-clamp-2">
            {question.title}
          </h3>
          {question.has_accepted_answer && (
            <span
              title="Has accepted answer"
              className="shrink-0 mt-0.5 flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-100 text-emerald-600"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>

        {/* Tags */}
        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {question.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                className={`
                  text-xs px-2 py-0.5 rounded-full border font-medium transition-all
                  ${activeTag === tag
                    ? "bg-blue-600 text-white border-blue-600"
                    : `${tagColor(tag)} hover:opacity-80`}
                `}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="font-medium text-slate-500 truncate max-w-25 sm:max-w-none">
            {question.author_name}
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{timeAgo(question.created_at)}</span>

          {/* Answers badge */}
          <span className={`
            flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full font-semibold sm:ml-auto
            ${question.has_accepted_answer
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : question.answer_count > 0
                ? "bg-blue-50 text-blue-600 border border-blue-200"
                : "bg-slate-100 text-slate-400 border border-slate-200"}
          `}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="hidden sm:inline">
              {question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}
            </span>
            <span className="sm:hidden">{question.answer_count}</span>
          </span>

          {/* Views */}
          <span className="flex items-center gap-1">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {question.view_count}
          </span>

          {/* Time — mobile only */}
          <span className="sm:hidden ml-auto">{timeAgo(question.created_at)}</span>
        </div>
      </div>
    </div>
  );
}