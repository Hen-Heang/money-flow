'use client'

import { Control, Controller } from 'react-hook-form'
import { motion } from 'framer-motion'
import { haptic } from '@/lib/utils'
import { TransactionFormData } from '@/hooks/useTransactionForm'

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: string
}

interface Props {
  categories: Category[]
  control: Control<TransactionFormData>
  onSelect?: (categoryId: string) => void
}

export default function CategoryGrid({ categories, control, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      <Controller
        name="category_id"
        control={control}
        render={({ field }) => (
          <>
            {categories.map((cat) => {
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
  )
}
