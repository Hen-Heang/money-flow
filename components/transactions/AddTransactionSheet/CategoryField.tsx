import { Loader2 } from 'lucide-react'
import { Controller, type Control } from 'react-hook-form'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select'
import type { TransactionFormData } from '@/hooks/useTransactionForm'
import type { Category } from '@/lib/types'

export function CategoryField({
  control,
  filteredCategories,
  isAiSuggesting,
  inputBaseStyle,
  sectionLabelStyle,
}: {
  control: Control<TransactionFormData>
  filteredCategories: Category[]
  isAiSuggesting: boolean
  inputBaseStyle: string
  sectionLabelStyle: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className={sectionLabelStyle}>Category</p>
        {isAiSuggesting && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-accent-base)]">
            <Loader2 size={12} className="animate-spin" />
            AI suggesting
          </span>
        )}
      </div>
      <Controller
        control={control}
        name="category_id"
        render={({ field }) => (
          <Select value={field.value || '__none__'} onValueChange={v => field.onChange(v === '__none__' ? '' : v)}>
            <SelectTrigger className={inputBaseStyle} aria-label="Category">
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No category</SelectItem>
              {filteredCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  )
}
