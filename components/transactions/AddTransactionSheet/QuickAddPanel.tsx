import { ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import type { Category, PaymentMethod, TransactionPreview } from '@/lib/types'

export function QuickAddPanel({
  isEditing,
  quickAddText,
  setQuickAddText,
  setQuickAddError,
  setQuickAddPreview,
  setShowKeypad,
  isQuickAddLoading,
  parseQuickAdd,
  quickAddError,
  quickAddPreview,
  categories,
  paymentMethods,
  applyQuickAddPreview,
  inputBaseStyle,
}: {
  isEditing: boolean
  quickAddText: string
  setQuickAddText: (v: string) => void
  setQuickAddError: (v: string) => void
  setQuickAddPreview: (v: TransactionPreview | null) => void
  setShowKeypad: (v: boolean) => void
  isQuickAddLoading: boolean
  parseQuickAdd: () => void
  quickAddError: string
  quickAddPreview: TransactionPreview | null
  categories: Category[]
  paymentMethods: PaymentMethod[]
  applyQuickAddPreview: () => void
  inputBaseStyle: string
}) {
  if (isEditing) return null

  const previewCategory = quickAddPreview?.categoryId
    ? categories.find(category => category.id === quickAddPreview.categoryId)
    : null
  const previewPaymentMethod = quickAddPreview?.paymentMethodId
    ? paymentMethods.find(method => method.id === quickAddPreview.paymentMethodId)
    : null

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-accent-base)]/25 bg-[var(--color-accent-base)]/[0.06] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-base)] text-white">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-black">Smart Quick Add</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">Describe it naturally, then review before saving.</p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--color-card-base)] px-2 py-1 text-[10px] font-bold text-[var(--color-accent-base)]">AI</span>
      </div>

      <div className="flex gap-2">
        <input
          value={quickAddText}
          onChange={event => {
            setQuickAddText(event.target.value)
            setQuickAddError('')
            setQuickAddPreview(null)
          }}
          onFocus={() => setShowKeypad(false)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (!isQuickAddLoading) void parseQuickAdd()
            }
          }}
          className={`${inputBaseStyle} min-w-0 flex-1`}
          placeholder="e.g. Lunch 12,000 won today"
          maxLength={300}
          aria-label="Describe a transaction for AI quick add"
        />
        <button
          type="button"
          onClick={parseQuickAdd}
          disabled={isQuickAddLoading || quickAddText.trim().length < 3}
          className="flex w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-base)] text-white transition-all active:scale-95 disabled:opacity-40"
          aria-label="Create transaction preview"
        >
          {isQuickAddLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        </button>
      </div>

      {quickAddError && <p className="mt-2 text-xs font-semibold text-[var(--color-expense-base)]">{quickAddError}</p>}

      {quickAddPreview && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border-base)] bg-[var(--color-card-base)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black">{quickAddPreview.description}</p>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${quickAddPreview.type === 'expense' ? 'bg-red-500/10 text-[var(--color-expense-base)]' : 'bg-emerald-500/10 text-[var(--color-income-base)]'}`}>
                  {quickAddPreview.type}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {quickAddPreview.date} · {previewCategory ? `${previewCategory.icon} ${previewCategory.name}` : 'No category'}
                {previewPaymentMethod ? ` · ${previewPaymentMethod.icon} ${previewPaymentMethod.name}` : ''}
              </p>
              {quickAddPreview.note && <p className="mt-1 truncate text-xs text-[var(--color-text-secondary)]">{quickAddPreview.note}</p>}
            </div>
            <p className="shrink-0 text-base font-black">
              {quickAddPreview.currency === 'USD' ? '$' : '₩'}
              {quickAddPreview.currency === 'KRW'
                ? formatNumber(Math.round(quickAddPreview.amount))
                : quickAddPreview.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <button
            type="button"
            onClick={applyQuickAddPreview}
            className="mt-3 w-full rounded-[var(--radius-sm)] bg-[var(--color-accent-base)] px-3 py-2.5 text-xs font-black text-white active:scale-[0.98]"
          >
            APPLY TO FORM
          </button>
        </div>
      )}
    </section>
  )
}
