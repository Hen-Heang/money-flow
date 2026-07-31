export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8 space-y-4">
      <div className="skeleton h-8 w-44 rounded mb-6" />
      <div className="skeleton h-24 rounded-[24px] mb-4" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton h-16 rounded-2xl" />
      ))}
    </div>
  )
}
