'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Target } from 'lucide-react'
import { haptic, formatNumber } from '@/lib/utils'
import type { Category, Budget } from '@/lib/types'
import { Group, Row } from './Primitives'
import type { SettingsSection } from '../_types'

export function BudgetsSection({
  categories,
  budgets,
  budgetInputs,
  setBudgetInputs,
  saveBudget,
  activeSection,
  onToggle,
}: {
  categories: Category[]
  budgets: Budget[]
  budgetInputs: Record<string, string>
  setBudgetInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saveBudget: (categoryId: string, amount: number) => void
  activeSection: SettingsSection | null
  onToggle: (section: SettingsSection) => void
}) {
  const [editingBudget, setEditingBudget] = useState<string | null>(null)

  const handleSave = (categoryId: string) => {
    const raw = (budgetInputs[categoryId] || '').replace(/,/g, '')
    const amount = parseFloat(raw)
    if (isNaN(amount) || amount < 0) { toast.error('Invalid amount'); return }
    saveBudget(categoryId, amount)
    setEditingBudget(null)
  }

  return (
    <Group title="Limits & Budgets">
      <Row
        icon={Target}
        color="var(--color-warning-base)"
        title="Monthly Budgets"
        subtitle="Set spending limits"
        onClick={() => { haptic('light'); onToggle('budgets') }}
        active={activeSection === 'budgets'}
      />
      <AnimatePresence>
        {activeSection === 'budgets' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[var(--color-card-elevated-base)]/30 divide-y divide-[var(--color-border-base)]">
              {categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => {
                const isEditing = editingBudget === cat.id
                const budgetAmt = budgets.find(b => b.category_id === cat.id)?.amount_krw || 0
                return (
                  <div key={cat.id} className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{cat.name}</p>
                        {isEditing ? (
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={budgetInputs[cat.id] || ''}
                            onChange={e => {
                              const raw = e.target.value.replace(/,/g, '')
                              const num = parseFloat(raw)
                              setBudgetInputs(prev => ({ ...prev, [cat.id]: isNaN(num) ? raw : formatNumber(num) }))
                            }}
                            className="mt-2 w-full bg-[var(--color-card-base)] border-2 border-[var(--color-accent-base)] rounded-xl px-3 py-2 text-sm font-black text-right"
                            placeholder="₩ 0"
                          />
                        ) : (
                          <p className="text-[13px] font-black tracking-tight" style={{ color: budgetAmt > 0 ? 'var(--color-warning-base)' : 'var(--color-text-secondary)' }}>
                            {budgetAmt > 0 ? `₩${formatNumber(budgetAmt)} limit` : 'No limit set'}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (isEditing) handleSave(cat.id)
                          else {
                            setEditingBudget(cat.id)
                            if (budgetAmt > 0) setBudgetInputs(prev => ({ ...prev, [cat.id]: formatNumber(budgetAmt) }))
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-[var(--color-income-base)] text-white' : 'bg-[var(--color-card-base)] text-[var(--color-accent-base)] border border-[var(--color-border-base)] shadow-sm'}`}
                      >
                        {isEditing ? 'Save' : 'Edit'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Group>
  )
}
