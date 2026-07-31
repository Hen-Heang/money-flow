export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8 space-y-5">
      <div className="mb-8 flex items-start justify-between gap-3">
        <div className="skeleton h-8 w-28 rounded" />
        <div className="skeleton h-12 w-12 rounded-2xl" />
      </div>
      <div className="skeleton h-40 rounded-[32px] mb-8" />
      {[1, 2].map(i => (
        <div key={i} className="skeleton h-44 rounded-[28px]" />
      ))}
    </div>
  )
}
