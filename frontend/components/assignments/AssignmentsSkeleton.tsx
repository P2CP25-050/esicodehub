export default function AssignmentsSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-3 animate-pulse"
        >
          <div className="h-5 w-20 bg-slate-200 rounded-md" />
          <div className="h-4 w-3/4 bg-slate-200 rounded-md" />
          <div className="h-3 w-1/2 bg-slate-100 rounded-md" />
          <div className="h-3 w-2/5 bg-slate-100 rounded-md" />
        </div>
      ))}
    </>
  );
}