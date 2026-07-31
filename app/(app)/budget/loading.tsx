export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton h-8 w-28 rounded" />
        <div className="skeleton h-9 w-32 rounded-xl" />
      </div>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton h-20 rounded-[20px]" />
      ))}
    </div>
  )
}
