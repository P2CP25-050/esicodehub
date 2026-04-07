const PLACEHOLDER_QUESTIONS = [
  { title: "How do I implement a binary search tree in Python?", tag: "Python", votes: 12, answers: 4 },
  { title: "What's the difference between async/await and Promises?", tag: "JavaScript", votes: 8, answers: 3 },
  { title: "Best practices for SQL query optimization?", tag: "SQL", votes: 15, answers: 6 },
];

function PlaceholderQuestionCard({ q }: { q: typeof PLACEHOLDER_QUESTIONS[0] }) {
  return (
    <div className="relative bg-[#f8faff] rounded-2xl border border-[#e2e8f6] p-5 select-none overflow-hidden">
      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[1.5px] bg-white/40 rounded-2xl z-10" />

      <div className="relative z-0">
        <h3 className="text-[#0d1b2a] font-bold text-sm mb-2 line-clamp-2 opacity-50">
          {q.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e2e8f6] text-[#64748b] opacity-50">
            {q.tag}
          </span>
          <div className="flex items-center gap-3 opacity-50">
            <span className="text-xs text-[#94a3b8]">▲ {q.votes}</span>
            <span className="text-xs text-[#94a3b8]">💬 {q.answers}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForumPlaceholder() {
  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#6c47ff] to-[#a29bfe]" />
        <h2 className="text-base font-bold text-[#0d1b2a] tracking-tight">Trending Questions</h2>
        <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#6c47ff]/10 text-[#6c47ff] border border-[#6c47ff]/20 uppercase tracking-wide">
          Coming Soon
        </span>
      </div>

      <div className="flex flex-col gap-3 flex-1 relative">
        {PLACEHOLDER_QUESTIONS.map((q, i) => (
          <PlaceholderQuestionCard key={i} q={q} />
        ))}

        {/* Center overlay badge */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-white border border-[#6c47ff]/20 rounded-2xl shadow-[0_8px_32px_rgba(108,71,255,0.15)] px-6 py-4 text-center">
            <div className="text-2xl mb-1">🚀</div>
            <p className="text-sm font-bold text-[#6c47ff]">Forum Coming Soon</p>
            <p className="text-xs text-[#94a3b8] mt-0.5">Sprint 6</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#e2e8f6]">
        <p className="text-xs text-[#94a3b8] font-medium">Forum launches in a future sprint</p>
      </div>
    </div>
  );
}