import { useState } from "react";
import type { Answer } from "@/services/forum";
import { VoteButtons } from "@/components/forum/VoteButtons";
import { CodeBlock } from "@/components/forum/CodeBlock";
import { InlineAnswerForm } from "@/components/forum/InlineAnswerForm";
import { timeAgo } from "@/utils/time";
import Link from "next/link";

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface AnswerNodeProps {
  answer: Answer;
  depth: number;
  questionId: number;
  questionAuthorEmail: string;
  currentUserEmail: string;
  canAccept: boolean;
  hasAccepted: boolean;
  onVote: (id: number, v: 1 | -1) => void;
  onAccept: (id: number) => void;
  onDelete: (id: number) => void;
  onReplied: (parentId: number, a: Answer) => void;
}

export function AnswerNode({
  answer,
  depth,
  questionId,
  questionAuthorEmail,
  currentUserEmail,
  canAccept,
  hasAccepted,
  onVote,
  onAccept,
  onDelete,
  onReplied,
}: AnswerNodeProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isOwn = answer.author_email === currentUserEmail;
  const isQAuthor = currentUserEmail === questionAuthorEmail;
  const isTopLevel = answer.parent === null;
  const hasReplies = (answer.replies ?? []).length > 0;

  const borderColors = ["border-[#0d1b4b]", "border-blue-300", "border-slate-300", "border-slate-200"];
  const borderColor = borderColors[Math.min(depth, borderColors.length - 1)];

  return (
    <div
      className={`relative ${depth > 0 ? `ml-8 pl-4 border-l-2 ${borderColor}` : ""}`}
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 28, 84)}px` : undefined }}
    >
      <div
        className={`rounded-xl p-4 mb-2 transition-all
          ${answer.is_accepted
            ? "bg-green-50 border-2 border-green-300 shadow-sm"
            : depth === 0
              ? "bg-white border border-slate-200 shadow-sm"
              : "bg-slate-50 border border-slate-200"}`}
      >
        {/* Accepted badge */}
        {answer.is_accepted && (
          <div className="flex items-center gap-1.5 mb-3 text-green-700 bg-green-100 border border-green-200 w-fit px-3 py-1 rounded-full text-xs font-bold">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Best Answer
          </div>
        )}

        <div className="flex gap-3 items-start">
          {/* Votes */}
          <div className="shrink-0 pt-0.5">
            <VoteButtons
              score={answer.vote_score}
              userVote={answer.user_vote}
              onVote={(v) => onVote(answer.id, v)}
              hidden={isOwn}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Author + time */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
	    <Link
	      href={`/profile/${answer.author_school_id}`}
	      onClick={(e) => e.stopPropagation()}
	      className="flex items-center gap-2 group"
	    >
	      <div className="w-7 h-7 rounded-full bg-[#0d1b4b] flex items-center justify-center text-white text-[10px] font-black shrink-0 border-2 border-transparent group-hover:border-blue-300 transition-all">
	        {initials(answer.author_name)}
	      </div>
	      <span className="text-sm font-bold text-[#0d1b4b] group-hover:underline">
	        {answer.author_name}
	      </span>
	    </Link>
	    <span className="text-slate-300 text-xs">·</span>
	    <span className="text-xs text-slate-400">{timeAgo(answer.created_at)}</span>
	  </div>

            {/* Body */}
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-2">
              {answer.body}
            </p>

            {/* Code snippet */}
            {answer.code_snippet && (
              <CodeBlock code={answer.code_snippet} lang={answer.code_language || "plaintext"} />
            )}

            {/* Actions row */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button
                onClick={() => setReplyOpen((v) => !v)}
                className="text-xs font-semibold text-slate-500 hover:text-[#0d1b4b] transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {replyOpen ? "Cancel" : "Reply"}
              </button>

              {/* Accept button */}
              {isTopLevel && isQAuthor && canAccept && !hasAccepted && !answer.is_accepted && (
                <button
                  onClick={() => onAccept(answer.id)}
                  className="text-xs font-bold text-green-700 border border-green-300 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-full flex items-center gap-1 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Accept
                </button>
              )}

              {isOwn && (
                <>
                  <button className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(answer.id)}
                    className="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </>
              )}

              {hasReplies && (
                <button
                  onClick={() => setCollapsed((v) => !v)}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${collapsed ? "-rotate-90" : ""}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {collapsed
                    ? `Show ${(answer.replies ?? []).length} repl${(answer.replies ?? []).length === 1 ? "y" : "ies"}`
                    : "Collapse"}
                </button>
              )}
            </div>

            {/* Reply form */}
            {replyOpen && (
              <InlineAnswerForm
                questionId={questionId}
                parentId={answer.id}
                onCancel={() => setReplyOpen(false)}
                onPosted={(a) => { onReplied(answer.id, a); setReplyOpen(false); }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Recursive replies */}
      {!collapsed &&
        (answer.replies ?? []).map((r) => (
          <AnswerNode
            key={r.id}
            answer={r}
            depth={depth + 1}
            questionId={questionId}
            questionAuthorEmail={questionAuthorEmail}
            currentUserEmail={currentUserEmail}
            canAccept={canAccept}
            hasAccepted={hasAccepted}
            onVote={onVote}
            onAccept={onAccept}
            onDelete={onDelete}
            onReplied={onReplied}
          />
        ))}
    </div>
  );
}
