export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-[#e2e8f6] p-5 animate-pulse">
      <div className="h-4 bg-[#e2e8f6] rounded-full w-3/4 mb-3" />
      <div className="h-3 bg-[#e2e8f6] rounded-full w-1/2 mb-4" />
      <div className="flex gap-2">
        <div className="h-5 bg-[#e2e8f6] rounded-full w-16" />
        <div className="h-5 bg-[#e2e8f6] rounded-full w-20" />
      </div>
    </div>
  );
}