'use client'

import { motion } from 'framer-motion'
import { Delete, Check, Plus, Minus, Equal } from 'lucide-react'
import { haptic } from '@/lib/utils'

interface NumericKeypadProps {
  onInput: (val: string) => void
  onDelete: () => void
  onDone: () => void
  onCalculate?: () => void
  showMath?: boolean
}

export default function NumericKeypad({ 
  onInput, 
  onDelete, 
  onDone, 
  onCalculate,
  showMath = true
}: NumericKeypadProps) {
  
  // 4-column layout for math, 3-column layout for standard
  const keys = showMath ? [
    '7', '8', '9', '+',
    '4', '5', '6', '-',
    '1', '2', '3', '=',
    '.', '0', 'delete'
  ] : [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'delete'
  ]
  
  const cols = showMath ? 'grid-cols-4' : 'grid-cols-3'
  const span = showMath ? 'col-span-4' : 'col-span-3'

  return (
    <div 
      className={`grid ${cols} gap-2 p-4 bg-[var(--color-card-base)] rounded-t-[32px] border-t border-[var(--color-border-base)] shadow-[0_-8px_30px_rgba(0,0,0,0.3)]`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)' }}
    >
      {keys.map((key) => {
        const isOperator = ['+', '-', '=', 'delete'].includes(key)
        const isDelete = key === 'delete'
        const isEqual = key === '='
        // In 4-col math mode the last row has only 3 keys (. 0 delete),
        // so delete spans 2 cols to fill the row cleanly.
        const spanClass = isDelete && showMath ? 'col-span-2' : ''

        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              haptic('light')
              if (isDelete) onDelete()
              else if (isEqual && onCalculate) onCalculate()
              else onInput(key)
            }}
            className={`${spanClass} h-14 sm:h-16 flex items-center justify-center rounded-2xl text-xl font-bold transition-colors ${
              isOperator
                ? isDelete ? 'text-red-400 bg-red-400/10' : 'text-(--color-accent-base) bg-(--color-accent-base)/5'
                : 'text-[var(--color-text-primary)] bg-[var(--color-card-elevated-base)]'
            }`}
          >
            {key === 'delete' ? <Delete className="w-6 h-6" /> :
             key === '+' ? <Plus className="w-5 h-5" /> :
             key === '-' ? <Minus className="w-5 h-5" /> :
             key === '=' ? <Equal className="w-5 h-5" /> :
             key}
          </motion.button>
        )
      })}
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => { haptic('medium'); onDone() }}
        className={`${span} h-14 sm:h-16 mt-1 flex items-center justify-center rounded-2xl bg-[var(--color-accent-base)] text-white font-black uppercase tracking-widest shadow-lg shadow-blue-500/20`}
      >
        <Check className="w-6 h-6 mr-2" strokeWidth={3} /> Done
      </motion.button>
    </div>
  )
}
