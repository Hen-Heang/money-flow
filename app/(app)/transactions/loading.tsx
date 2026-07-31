export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-mobile pt-4 pb-8 space-y-1">
      <div className="skeleton h-8 w-40 rounded mb-4" />
      <div className="skeleton h-11 rounded-xl mb-3" />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton h-16 rounded-2xl mb-1" />
      ))}
    </div>
  )
}
