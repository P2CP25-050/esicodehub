import { useEffect, useState } from "react";

interface VoteButtonsProps {
  score: number;
  userVote: 1 | -1 | null;
  onVote: (v: 1 | -1) => void;
  /** Pass true to hide the buttons entirely (e.g. question/answer author) */
  hidden?: boolean;
}

export function VoteButtons({ score, userVote, onVote, hidden }: VoteButtonsProps) {
  const [localScore, setLocalScore] = useState(score);
  const [localVote, setLocalVote] = useState<1 | -1 | null>(userVote);

  useEffect(() => { setLocalScore(score); }, [score]);
  useEffect(() => { setLocalVote(userVote); }, [userVote]);

  const vote = (v: 1 | -1) => {
    // Block clicking the OPPOSITE direction — must remove current vote first.
    if (localVote !== null && localVote !== v) return;

    // Same direction → toggle off (null). Neutral → set vote.
    const next: 1 | -1 | null = localVote === v ? null : v;
    const delta = (next ?? 0) - (localVote ?? 0);
    setLocalScore((s) => s + delta);
    setLocalVote(next);
    onVote(v);
  };

  // Author of the question/answer: show score only, no buttons.
  if (hidden) {
    return (
      <div className="flex flex-col items-center gap-1.5 min-w-[36px]">
        <span className={`text-sm font-black tabular-nums ${
          localScore > 0 ? "text-[#0d1b4b]" : localScore < 0 ? "text-red-500" : "text-slate-500"
        }`}>
          {localScore}
        </span>
      </div>
    );
  }

  // A button is disabled only when the OPPOSITE vote is active.
  // Clicking the active button (same direction) toggles it off — always enabled.
  const upDisabled   = localVote === -1; // downvoted → ▲ blocked
  const downDisabled = localVote === 1;  // upvoted   → ▼ blocked

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[36px]">
      {/* Upvote */}
      <button
        onClick={() => vote(1)}
        disabled={upDisabled}
        title={
          upDisabled
            ? "Remove your downvote first"
            : localVote === 1
            ? "Remove upvote"
            : "Upvote"
        }
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-150
          ${localVote === 1
            ? "bg-[#0d1b4b] border-[#0d1b4b] text-white hover:opacity-80 active:scale-90"
            : upDisabled
            ? "border-slate-200 text-slate-300 cursor-not-allowed"
            : "border-slate-200 text-slate-400 hover:border-[#0d1b4b] hover:text-[#0d1b4b] active:scale-90"
          }`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Score */}
      <span className={`text-sm font-black tabular-nums ${
        localScore > 0 ? "text-[#0d1b4b]" : localScore < 0 ? "text-red-500" : "text-slate-500"
      }`}>
        {localScore}
      </span>

      {/* Downvote */}
      <button
        onClick={() => vote(-1)}
        disabled={downDisabled}
        title={
          downDisabled
            ? "Remove your upvote first"
            : localVote === -1
            ? "Remove downvote"
            : "Downvote"
        }
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-150
          ${localVote === -1
            ? "bg-red-500 border-red-500 text-white hover:opacity-80 active:scale-90"
            : downDisabled
            ? "border-slate-200 text-slate-300 cursor-not-allowed"
            : "border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-400 active:scale-90"
          }`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}