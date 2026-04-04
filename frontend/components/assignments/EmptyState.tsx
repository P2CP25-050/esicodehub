interface Props {
  role: "student" | "professor";
}

export default function EmptyState({ role }: Props) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-[#f0f4ff] border border-slate-200 flex items-center justify-center mb-6">
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="6" width="32" height="36" rx="4" stroke="#cbd5e1" strokeWidth="2.5" />
          <line x1="16" y1="16" x2="32" y2="16" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="22" x2="28" y2="22" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <line x1="16" y1="28" x2="24" y2="28" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-xl font-extrabold text-[#0d1b2a] mb-2">
        {role === "student" ? "No assignments yet" : "No assignments created"}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
        {role === "student"
          ? "Your professors haven't posted any assignments for you yet. Check back soon!"
          : "Click \"Create Assignment\" above to post your first assignment."}
      </p>
    </div>
  );
}