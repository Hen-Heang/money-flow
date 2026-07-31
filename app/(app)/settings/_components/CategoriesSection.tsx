'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Tag, Trash2, Plus, X, Check } from 'lucide-react'
import { haptic } from '@/lib/utils'
import type { Category } from '@/lib/types'
import { Row } from './Primitives'
import type { SettingsSection } from '../_types'

export function CategoriesSection({
  categories,
  deleteCategory,
  addCategory,
  activeSection,
  onToggle,
}: {
  categories: Category[]
  deleteCategory: (id: string) => void
  addCategory: (name: string, icon: string, type: 'income' | 'expense') => void
  activeSection: SettingsSection | null
  onToggle: (section: SettingsSection) => void
}) {
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦')
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense')

  const handleAdd = () => {
    const name = newCategoryName.trim()
    const icon = newCategoryIcon.trim() || '📦'
    if (!name) { toast.error('Name required'); return }
    addCategory(name, icon, newCategoryType)
    setNewCategoryName('')
    setNewCategoryIcon('📦')
    setNewCategoryType('expense')
    setIsAddingCategory(false)
  }

  return (
    <>
      <Row
        icon={Tag}
        color="var(--color-income-base)"
        title="Categories"
        subtitle={`${categories.length} custom labels`}
        onClick={() => { haptic('light'); onToggle('categories') }}
        active={activeSection === 'categories'}
      />
      <AnimatePresence>
        {activeSection === 'categories' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[var(--color-card-elevated-base)]/30 divide-y divide-[var(--color-border-base)]">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-xl w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 shadow-sm">{cat.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{cat.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">{cat.type}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteCategory(cat.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="w-full flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest text-[var(--color-accent-base)]"
              >
                {isAddingCategory ? <X size={14}/> : <Plus size={14} strokeWidth={3}/>}
                {isAddingCategory ? 'Cancel' : 'Add New Category'}
              </button>
              {isAddingCategory && (
                <div className="px-5 pb-5 pt-2 space-y-3">
                  {/* Type toggle */}
                  <div className="flex rounded-xl overflow-hidden border border-[var(--color-border-base)]">
                    {(['expense', 'income'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewCategoryType(t)}
                        className="flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all"
                        style={{
                          backgroundColor: newCategoryType === t ? (t === 'income' ? 'var(--color-income-base)' : 'var(--color-expense-base)') : 'transparent',
                          color: newCategoryType === t ? 'white' : 'var(--color-text-secondary)',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Icon + Name + Save */}
                  <div className="flex gap-2">
                    <input
                      value={newCategoryIcon}
                      onChange={e => setNewCategoryIcon(e.target.value)}
                      className="w-14 h-11 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl text-center text-xl"
                      maxLength={2}
                    />
                    <input
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                      placeholder="Category name"
                      className="flex-1 h-11 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl px-4 text-sm font-bold outline-none focus:border-[var(--color-accent-base)]"
                    />
                    <button onClick={handleAdd} className="w-11 h-11 rounded-xl bg-[var(--color-income-base)] flex items-center justify-center text-white shrink-0">
                      <Check size={18} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
