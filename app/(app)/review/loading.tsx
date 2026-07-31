export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-mobile pt-4 pb-8 space-y-4">
      <div className="skeleton h-8 w-40 rounded mb-6" />
      <div className="skeleton h-32 rounded-[24px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-[20px]" />
        <div className="skeleton h-24 rounded-[20px]" />
      </div>
      <div className="skeleton h-48 rounded-[24px]" />
      <div className="skeleton h-40 rounded-[24px]" />
    </div>
  )
}
