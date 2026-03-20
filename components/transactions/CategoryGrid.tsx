'use client'

import { useState } from 'react'
import { Control, Controller } from 'react-hook-form'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { TransactionFormData } from '@/hooks/useTransactionForm'
import type { Category } from '@/lib/types'

interface Props {
  categories: Category[]
  control: Control<TransactionFormData>
  onSelect?: (categoryId: string) => void
}

export default function CategoryGrid({ categories, control, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const visible = query.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : categories

  return (
    <div className="space-y-2">
      {categories.length > 6 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full rounded-xl pl-8 pr-3 py-2 text-xs outline-none"
            style={{
              backgroundColor: 'var(--color-card-elevated-base)',
              border: '1px solid var(--color-border-base)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      )}
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      <Controller
        name="category_id"
        control={control}
        render={({ field }) => (
          <>
            {visible.map((cat) => {
              const selected = field.value === cat.id
              return (
                <motion.button
                  key={cat.id}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => {
                    const nextVal = selected ? '' : cat.id
                    field.onChange(nextVal)
                    onSelect?.(nextVal)
                    haptic('light')
                  }}
                  className="flex flex-col items-center gap-1.5 rounded-button px-1 py-3 transition-all"
                  style={{
                    backgroundColor: selected ? 'var(--color-accent-base)' : 'var(--color-card-elevated-base)',
                  }}
                >
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <span
                    className="w-full truncate text-center text-[9px] font-bold leading-tight px-0.5"
                    style={{ 
                      color: selected ? 'white' : 'var(--color-text-secondary)', 
                      letterSpacing: '0.01em',
                      opacity: selected ? 1 : 0.8
                    }}
                  >
                    {cat.name}
                  </span>
                </motion.button>
              )
            })}
          </>
        )}
      />
    </div>
    {query && visible.length === 0 && (
      <p className="text-center text-xs py-3 opacity-40" style={{ color: 'var(--color-text-secondary)' }}>
        No categories match &quot;{query}&quot;
      </p>
    )}
    </div>
  )
}
