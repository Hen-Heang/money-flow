import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('skeleton rounded-[12px]', className)} />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-[20px] p-5" style={{ backgroundColor: 'var(--color-card-base)' }}>
      <Skeleton className="h-4 w-20 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Skeleton className="w-12 h-12 rounded-[14px]" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="text-right">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}
