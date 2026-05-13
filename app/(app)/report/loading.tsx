export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-8 space-y-4">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1.5">
          <div className="skeleton h-8 w-24 rounded" />
          <div className="skeleton h-3 w-32 rounded" />
        </div>
        <div className="skeleton h-10 w-36 rounded-2xl" />
      </div>
      <div className="skeleton h-32 rounded-[32px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
      </div>
      <div className="skeleton h-48 rounded-[24px]" />
    </div>
  )
}
