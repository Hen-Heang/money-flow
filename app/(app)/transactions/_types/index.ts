export type FilterType = 'all' | 'income' | 'expense'
export type SortOption = 'date' | 'amount_desc' | 'amount_asc'

export const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' },
]

export const SORTS: { label: string; value: SortOption }[] = [
  { label: 'Date', value: 'date' },
  { label: '↓ Amount', value: 'amount_desc' },
  { label: '↑ Amount', value: 'amount_asc' },
]
