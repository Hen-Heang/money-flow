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
      className={`grid ${cols} gap-3 p-5 bg-[var(--color-card-base)] rounded-t-[var(--radius-xl)] border-t border-[var(--color-border-base)] shadow-[0_-12px_40px_rgba(0,0,0,0.4)]`}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 8px)' }}
    >
      {keys.map((key) => {
        const isOperator = ['+', '-', '=', 'delete'].includes(key)
        const isDelete = key === 'delete'
        const isEqual = key === '='
        const spanClass = isDelete && showMath ? 'col-span-2' : ''

        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => {
              haptic('light')
              if (isDelete) onDelete()
              else if (isEqual && onCalculate) onCalculate()
              else onInput(key)
            }}
            className={`${spanClass} h-15 sm:h-16 flex items-center justify-center rounded-[var(--radius-md)] text-xl font-bold transition-all active:brightness-125 ${
              isOperator
                ? isDelete ? 'text-red-400 bg-red-400/10' : 'text-[var(--color-accent-base)] bg-[var(--color-accent-base)]/10'
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
        whileTap={{ scale: 0.96 }}
        onClick={() => { haptic('medium'); onDone() }}
        className={`${span} h-15 sm:h-16 mt-1 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-base)] text-white font-black uppercase tracking-widest shadow-lg shadow-blue-500/25`}
      >
        <Check className="w-6 h-6 mr-2" strokeWidth={3} /> Done
      </motion.button>
    </div>
  )
}
