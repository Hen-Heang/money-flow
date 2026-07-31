export default function Loading() {
  return (
    <div className="px-mobile pt-6 pb-12 max-w-2xl mx-auto space-y-4">
      <div className="flex flex-col items-center gap-3 mb-10 pt-4">
        <div className="skeleton w-[100px] h-[100px] rounded-full" />
        <div className="skeleton h-6 w-40 rounded" />
        <div className="skeleton h-3 w-28 rounded" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton h-14 rounded-[24px]" />
      ))}
    </div>
  )
}
