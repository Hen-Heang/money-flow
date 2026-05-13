export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="skeleton w-12 h-12 rounded-full shrink-0" />
        <div className="space-y-2">
          <div className="skeleton h-2.5 w-16 rounded" />
          <div className="skeleton h-5 w-32 rounded" />
        </div>
      </div>
      <div className="skeleton h-36 rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
      </div>
      <div className="skeleton h-48 rounded-[24px]" />
      <div className="skeleton h-40 rounded-[24px]" />
    </div>
  )
}
