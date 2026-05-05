import type { QuestionDetail } from "@/services/forum";

interface QuestionStatsSidebarProps {
  question: QuestionDetail;
  hasAccepted: boolean;
}

export function QuestionStatsSidebar({ question, hasAccepted }: QuestionStatsSidebarProps) {
  const topLevelCount = (question.answers ?? []).filter((a) => a.parent === null).length;

  return (
    <div className="space-y-4">
      {/* Stats card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#0d1b4b] px-5 py-3">
          <h3 className="text-xs font-black text-white tracking-widest uppercase font-mono">
            Question Stats
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {[
            { label: "Score", value: question.vote_score },
            { label: "Answers", value: topLevelCount },
            { label: "Views", value: question.view_count },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{s.label}</span>
              <span className="text-sm font-black text-[#0d1b4b] font-mono tabular-nums">
                {s.value}
              </span>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Status</span>
              {question.is_closed ? (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  Closed
                </span>
              ) : hasAccepted ? (
                <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  Answered
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  Open
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tags card */}
      {question.tags.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <h3 className="text-xs font-black text-[#0d1b4b] tracking-widest uppercase font-mono mb-3">
            Tags
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {question.tags.map((t) => (
              <span
                key={t}
                className="px-3 py-1 bg-[#0d1b4b] text-white text-xs font-bold rounded-full"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}