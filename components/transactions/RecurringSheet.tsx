'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Plus, Trash2, X, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatKRW } from '@/lib/utils'
import type { Category } from '@/lib/types'
import { useExchangeRate } from '@/hooks/useExchangeRate'

interface RecurringRule {
  id: string
  type: 'income' | 'expense'
  amount_krw: number
  amount_usd: number
  exchange_rate: number
  currency: string
  description: string
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  next_date: string
  last_applied: string | null
  is_active: boolean
  categories?: { name: string; icon: string } | null
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}

const FREQ_BADGE_COLOR: Record<string, string> = {
  daily: '#ef4444',
  weekly: '#f97316',
  monthly: '#3b82f6',
  yearly: '#8b5cf6',
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function RecurringSheet({ isOpen, onClose }: Props) {
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [fType, setFType] = useState<'income' | 'expense'>('expense')
  const [fCurrency, setFCurrency] = useState<'KRW' | 'USD'>('KRW')
  const [fAmount, setFAmount] = useState('')
  const [fDesc, setFDesc] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fFrequency, setFFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [fStartDate, setFStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [fNote, setFNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/recurring').then(r => r.json()).then(({ data }) => {
      setRules(data || [])
    }).finally(() => setLoading(false))

    // Load categories for the form
    fetch('/api/transactions?pageSize=0')
      .catch(() => {})

    import('@/lib/supabase').then(({ createClient }) => {
      const supabase = createClient()
      supabase.from('categories').select('id, name, icon').then(({ data }) => {
        if (data) setCategories(data)
      })
    })
  }, [isOpen])

  const exchangeRate = useExchangeRate()

  const resetForm = () => {
    setFType('expense')
    setFCurrency('KRW')
    setFAmount('')
    setFDesc('')
    setFCategory('')
    setFFrequency('monthly')
    setFStartDate(new Date().toISOString().split('T')[0])
    setFNote('')
    setShowForm(false)
  }

  const handleSave = async () => {
    const amount = parseFloat(fAmount.replace(/,/g, ''))
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!fDesc.trim()) { toast.error('Description is required'); return }

    const amount_krw = fCurrency === 'KRW' ? amount : Math.round(amount * exchangeRate)
    const amount_usd = fCurrency === 'USD' ? amount : amount / exchangeRate

    setSaving(true)
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: fType,
          currency: fCurrency,
          amount_krw,
          amount_usd,
          exchange_rate: exchangeRate,
          description: fDesc.trim(),
          category_id: fCategory || null,
          frequency: fFrequency,
          next_date: fStartDate,
          note: fNote.trim() || null,
        }),
      })
      const { data, error } = await res.json()
      if (!res.ok || error) throw new Error(error || 'Failed to save')
      setRules(prev => [data, ...prev])
      toast.success('Recurring transaction added')
      resetForm()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (rule: RecurringRule) => {
    const res = await fetch(`/api/recurring?id=${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    if (res.ok) {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/recurring?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRules(prev => prev.filter(r => r.id !== id))
      toast.success('Removed')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--color-card-base)',
    border: '1px solid var(--color-border-base)',
    borderRadius: '14px',
    padding: '12px 16px',
    fontSize: '15px',
    color: 'var(--color-text-primary)',
    outline: 'none',
  }

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            className="fixed inset-0 z-100 flex flex-col"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 rounded-full opacity-30" style={{ backgroundColor: 'var(--color-text-secondary)' }} />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-6 pb-4 pt-2 shrink-0"
              style={{ borderBottom: '1px solid var(--color-border-base)' }}
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" style={{ color: 'var(--color-accent-base)' }} />
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Recurring</h2>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
                >
                  {rules.filter(r => r.is_active).length} active
                </span>
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent-base)] border-t-transparent" />
                </div>
              ) : rules.length === 0 && !showForm ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 text-5xl">🔁</div>
                  <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>No recurring transactions</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Add bills, rent, or salary that repeat automatically</p>
                </div>
              ) : (
                rules.map(rule => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3"
                    style={{
                      backgroundColor: 'var(--color-card-base)',
                      border: '1px solid var(--color-border-base)',
                      opacity: rule.is_active ? 1 : 0.5,
                    }}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{ backgroundColor: rule.type === 'income' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }}
                    >
                      {rule.categories?.icon || (rule.type === 'income' ? '💰' : '💸')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {rule.description}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase"
                          style={{ backgroundColor: FREQ_BADGE_COLOR[rule.frequency] + '18', color: FREQ_BADGE_COLOR[rule.frequency] }}
                        >
                          {FREQ_LABELS[rule.frequency]}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                          Next: {rule.next_date}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <p
                        className="text-sm font-black"
                        style={{ color: rule.type === 'income' ? 'var(--color-income-base)' : 'var(--color-expense-base)' }}
                      >
                        {rule.type === 'income' ? '+' : '-'}{formatKRW(rule.amount_krw)}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleToggle(rule)} className="transition-transform active:scale-90">
                          {rule.is_active
                            ? <ToggleRight className="h-5 w-5" style={{ color: 'var(--color-income-base)' }} />
                            : <ToggleLeft className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full transition-transform active:scale-90"
                          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Add form */}
              <AnimatePresence>
                {showForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-2xl p-4 space-y-3"
                      style={{ backgroundColor: 'var(--color-card-base)', border: '1px solid var(--color-border-base)' }}
                    >
                      <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                        New Recurring Rule
                      </p>

                      {/* Type */}
                      <div className="flex rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                        {(['expense', 'income'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setFType(t)}
                            className="flex-1 py-2.5 text-sm font-black uppercase rounded-xl transition-all"
                            style={{
                              backgroundColor: fType === t ? (t === 'expense' ? 'var(--color-expense-base)' : 'var(--color-income-base)') : 'transparent',
                              color: fType === t ? 'white' : 'var(--color-text-secondary)',
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Currency + Amount */}
                      <div className="flex gap-2">
                        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                          {(['KRW', 'USD'] as const).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setFCurrency(c)}
                              className="px-3 py-2 text-xs font-black"
                              style={{
                                backgroundColor: fCurrency === c ? 'var(--color-accent-base)' : 'transparent',
                                color: fCurrency === c ? 'white' : 'var(--color-text-secondary)',
                                borderRadius: '10px',
                              }}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                        <input
                          style={inputStyle}
                          type="number"
                          placeholder={fCurrency === 'KRW' ? '₩ Amount' : '$ Amount'}
                          value={fAmount}
                          onChange={e => setFAmount(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>

                      {/* Description */}
                      <input style={inputStyle} placeholder="Description (e.g. Rent, Salary)" value={fDesc} onChange={e => setFDesc(e.target.value)} />

                      {/* Category */}
                      <select
                        style={inputStyle}
                        value={fCategory}
                        onChange={e => setFCategory(e.target.value)}
                      >
                        <option value="">No category</option>
                        {categories.filter(c => true).map(c => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>

                      {/* Frequency */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(f => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFFrequency(f)}
                            className="rounded-xl py-2 text-[11px] font-black uppercase transition-all"
                            style={{
                              backgroundColor: fFrequency === f ? FREQ_BADGE_COLOR[f] : 'var(--color-card-elevated-base)',
                              color: fFrequency === f ? 'white' : 'var(--color-text-secondary)',
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>

                      {/* Start date */}
                      <input style={inputStyle} type="date" value={fStartDate} onChange={e => setFStartDate(e.target.value)} />

                      {/* Note */}
                      <input style={inputStyle} placeholder="Note (optional)" value={fNote} onChange={e => setFNote(e.target.value)} />

                      {/* Buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="flex-1 rounded-xl py-3 text-sm font-black"
                          style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 rounded-xl py-3 text-sm font-black text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-accent-base)' }}
                        >
                          {saving ? 'Saving...' : 'Save Rule'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div
              className="shrink-0 px-4 py-4"
              style={{
                borderTop: '1px solid var(--color-border-base)',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
              }}
            >
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white"
                  style={{ backgroundColor: 'var(--color-accent-base)' }}
                >
                  <Plus size={18} strokeWidth={3} />
                  Add Recurring Transaction
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(panel, document.body) : null
}
