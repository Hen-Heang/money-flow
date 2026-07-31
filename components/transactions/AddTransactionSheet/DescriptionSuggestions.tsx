import type { DescriptionSuggestion } from '@/hooks/useDescriptionSuggestions'

export function DescriptionSuggestions({
  type,
  suggestions,
  onApply,
}: {
  type: 'income' | 'expense'
  suggestions: DescriptionSuggestion[]
  onApply: (suggestion: DescriptionSuggestion) => void
}) {
  if (suggestions.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="Description suggestions from transaction history">
      {suggestions.map(suggestion => (
        <button
          key={`${type}:${suggestion.description}`}
          type="button"
          onClick={() => onApply(suggestion)}
          className="shrink-0 rounded-full border border-[var(--color-border-base)] bg-[var(--color-card-elevated-base)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] active:scale-95"
        >
          {suggestion.description}
          {suggestion.count > 1 ? <span className="ml-1 opacity-50">×{suggestion.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
