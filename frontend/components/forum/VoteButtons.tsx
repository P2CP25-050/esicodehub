import { useState } from "react";

interface VoteButtonsProps {
  score: number;
  userVote: 1 | -1 | null;
  onVote: (v: 1 | -1) => void;
}

export function VoteButtons({ score, userVote, onVote }: VoteButtonsProps) {
  const [localScore, setLocalScore] = useState(score);
  const [localVote, setLocalVote] = useState<1 | -1 | null>(userVote);

  const vote = (v: 1 | -1) => {
    const prev = localVote;
    const newVote = prev === v ? null : v;
    const delta = (newVote ?? 0) - (prev ?? 0);
    setLocalScore((s) => s + delta);
    setLocalVote(newVote);
    onVote(v);
  };

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[36px]">
      <button
        onClick={() => vote(1)}
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-150 active:scale-90
          ${localVote === 1
            ? "bg-[#0d1b4b] border-[#0d1b4b] text-white"
            : "border-slate-200 text-slate-400 hover:border-[#0d1b4b] hover:text-[#0d1b4b]"}`}
        title="Upvote"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <span
        className={`text-sm font-black tabular-nums ${
          localScore > 0 ? "text-[#0d1b4b]" : localScore < 0 ? "text-red-500" : "text-slate-500"
        }`}
      >
        {localScore}
      </span>

      <button
        onClick={() => vote(-1)}
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-150 active:scale-90
          ${localVote === -1
            ? "bg-red-500 border-red-500 text-white"
            : "border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-400"}`}
        title="Downvote"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}