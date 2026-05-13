export default function Loading() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-9 w-36 rounded-xl" />
      </div>
      <div className="skeleton h-40 rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20 rounded-[16px]" />
        <div className="skeleton h-20 rounded-[16px]" />
        <div className="skeleton h-20 rounded-[16px]" />
        <div className="skeleton h-20 rounded-[16px]" />
      </div>
      <div className="skeleton h-56 rounded-[20px]" />
      <div className="skeleton h-44 rounded-[20px]" />
    </div>
  )
}
