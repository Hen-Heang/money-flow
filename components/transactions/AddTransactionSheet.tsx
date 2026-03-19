'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Controller } from 'react-hook-form'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { formatNumber, haptic } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'
import NumericKeypad from '@/components/ui/NumericKeypad'
import { useTransactionForm, TransactionFormData } from '@/hooks/useTransactionForm'
import CategoryGrid from './CategoryGrid'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setVisible(window.innerHeight - vv.height > 100)
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
  return visible
}

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: string
}

interface PaymentMethod {
  id: string
  name: string
  icon: string
}

export interface EditTransaction {
  id: string
  type: 'income' | 'expense'
  currency?: string
  amount_krw: number
  amount_usd: number
  date: string
  description: string
  category_id: string | null
  payment_method_id: string | null
  note: string | null
  exchange_rate?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (transaction: unknown) => void
  editTransaction?: EditTransaction
}

export default function AddTransactionSheet({
  isOpen,
  onClose,
  onSuccess,
  editTransaction,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [canDrag, setCanDrag] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const isEditing = !!editTransaction
  const isMobile = useIsMobile()
  const keyboardVisible = useKeyboardVisible()

  const {
    form,
    exchangeRate: liveRate,
    amountNum,
    hasExpression,
    handleKeypadInput,
    handleKeypadDelete,
    handleCalculate
  } = useTransactionForm()

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form

  const type = watch('type')
  const currency = watch('currency')
  const amountRaw = watch('amount')
  const activeExchangeRate = editTransaction?.exchange_rate || liveRate

  const handleCategorySelect = () => {}

  const amountFormatted = (() => {
    if (!amountRaw) return '0'
    if (hasExpression) return amountRaw
    const num = parseFloat(amountRaw.replace(/,/g, ''))
    if (isNaN(num)) return amountRaw
    return currency === 'KRW' ? formatNumber(Math.round(num)) : amountRaw
  })()

  const convertedHint =
    currency === 'USD'
      ? amountNum > 0 ? `≈ ₩${formatNumber(Math.round(amountNum * activeExchangeRate))}` : ''
      : amountNum > 0 ? `≈ $${(amountNum / activeExchangeRate).toFixed(2)}` : ''

  useEffect(() => {
    if (!isOpen) return
    const loadData = async () => {
      const [cats, methods] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('payment_methods').select('*'),
      ])
      if (cats.data) setCategories(cats.data)
      if (methods.data) setPaymentMethods(methods.data)
    }
    loadData()

    if (editTransaction) {
      const editCurrency = (editTransaction.currency as 'KRW' | 'USD') || 'KRW'
      reset({
        type: editTransaction.type,
        currency: editCurrency,
        amount: editCurrency === 'USD' ? editTransaction.amount_usd.toFixed(2) : String(Math.round(editTransaction.amount_krw)),
        date: editTransaction.date,
        description: editTransaction.description,
        category_id: editTransaction.category_id || '',
        payment_method_id: editTransaction.payment_method_id || '',
        note: editTransaction.note || '',
      })
      if (isMobile) setTimeout(() => setShowKeypad(true), 400)
    } else {
      reset({
        type: 'expense',
        currency: 'KRW',
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        description: '',
      })
      if (isMobile) setTimeout(() => setShowKeypad(true), 400)
    }
  }, [isOpen, editTransaction, reset, supabase, isMobile])

  const handleClose = () => {
    setShowKeypad(false)
    setShowDetails(false)
    onClose()
  }

  const onSubmit = async (data: TransactionFormData) => {
    const finalAmount = amountNum
    if (finalAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    let amountKrw: number
    let amountUsd: number

    if (data.currency === 'USD') {
      amountUsd = finalAmount
      amountKrw = Math.round(finalAmount * activeExchangeRate)
    } else {
      amountKrw = finalAmount
      amountUsd = finalAmount / activeExchangeRate
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      date: data.date,
      type: data.type,
      currency: data.currency,
      category_id: data.category_id || null,
      description: data.description,
      amount_krw: amountKrw,
      amount_usd: amountUsd,
      exchange_rate: activeExchangeRate,
      payment_method_id: data.payment_method_id || null,
      note: data.note || null,
    }

    const { data: saved, error } = isEditing 
      ? await supabase.from('transactions').update(payload).eq('id', editTransaction.id).select().single()
      : await supabase.from('transactions').insert({ ...payload, user_id: user.id }).select().single()

    if (error) {
      toast.error('Failed to save transaction')
      return
    }

    haptic('medium')
    toast.success(isEditing ? 'Updated' : 'Saved')
    onSuccess(saved)
    handleClose()
  }

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  // UI Styles
  const sectionLabelStyle = "text-tiny text-[var(--color-text-secondary)] mb-3"
  const inputBaseStyle = "w-full bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] rounded-[var(--radius-md)] px-4 py-3.5 focus:border-[var(--color-accent-base)] transition-all outline-none"

  const desktopForm = (
    <form id="tx-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 pb-8">
      {/* Type & Amount */}
      <div className="space-y-4">
        <div className="flex bg-[var(--color-card-elevated-base)] p-1 rounded-[var(--radius-md)]">
          {(['expense', 'income'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { setValue('type', opt); haptic('light') }}
              className={`flex-1 py-2.5 rounded-[var(--radius-sm)] text-sm font-bold transition-all ${
                type === opt ? (opt === 'expense' ? 'bg-[var(--color-expense-base)] text-white' : 'bg-[var(--color-income-base)] text-white') : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>
        
        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[var(--color-text-secondary)]">
            {currency === 'USD' ? '$' : '₩'}
          </span>
          <input
            {...register('amount')}
            className={`${inputBaseStyle} pl-12 pr-28 text-3xl font-black tracking-tight`}
            placeholder="0"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex bg-[var(--color-card-base)] p-1 rounded-[var(--radius-sm)]">
            {(['KRW', 'USD'] as const).map(cur => (
              <button
                key={cur}
                type="button"
                onClick={() => { setValue('currency', cur); haptic('light') }}
                className={`px-3 py-1 rounded-[var(--radius-xs)] text-xs font-bold ${currency === cur ? 'bg-[var(--color-accent-base)] text-white' : 'text-[var(--color-text-secondary)]'}`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
        {convertedHint && <p className="text-xs text-[var(--color-text-secondary)] font-medium pl-1">{convertedHint}</p>}
      </div>

      {/* Category */}
      <div>
        <p className={sectionLabelStyle}>Category</p>
        <CategoryGrid categories={filteredCategories} control={control} onSelect={handleCategorySelect} />
      </div>

      {/* Details */}
      <div className="space-y-4">
        <p className={sectionLabelStyle}>Details</p>
        <input {...register('description')} className={inputBaseStyle} placeholder="Description" />
        <div className="grid grid-cols-2 gap-3">
          <input {...register('date')} type="date" className={inputBaseStyle} />
          <select {...register('payment_method_id')} className={inputBaseStyle}>
            <option value="">Payment Method</option>
            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
          </select>
        </div>
        <textarea {...register('note')} className={inputBaseStyle} placeholder="Optional note" rows={2} />
      </div>
    </form>
  )

  if (!isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title={isEditing ? 'Edit' : 'New'} footer={
        <button form="tx-form" disabled={isSubmitting} className="w-full py-4 bg-[var(--color-accent-base)] text-white rounded-[var(--radius-md)] font-bold active:scale-[0.98] transition-all disabled:opacity-50">
          {isSubmitting ? 'Saving...' : 'SAVE'}
        </button>
      }>
        {desktopForm}
      </BottomSheet>
    )
  }

  // Mobile Version
  const mobilePanel = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            drag={canDrag ? 'y' : false} dragConstraints={{ top: 0 }} onDragEnd={(_, info) => { if (info.offset.y > 80) handleClose() }}
            className="fixed inset-0 z-100 flex flex-col bg-[var(--color-card-base)]"
          >
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <div className="h-1.5 w-10 rounded-full bg-[var(--color-border-base)] opacity-50" />
            </div>
            <div className="flex items-center justify-between px-6 pb-4 pt-2 border-b border-[var(--color-border-base)]">
              <h2 className="text-xl font-bold">{isEditing ? 'Edit' : 'New Transaction'}</h2>
              <button onClick={handleClose} className="p-2 rounded-full bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)]"><X size={20} /></button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-8" onScroll={() => setCanDrag(scrollRef.current?.scrollTop === 0)}>
              <form id="tx-form-mobile" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-6">
                  {/* Type Toggle */}
                  <div className="flex bg-[var(--color-card-elevated-base)] p-1 rounded-[var(--radius-lg)]">
                    {(['expense', 'income'] as const).map(opt => (
                      <button key={opt} type="button" onClick={() => { setValue('type', opt); haptic('light') }} className={`flex-1 py-3.5 rounded-[var(--radius-md)] text-sm font-black transition-all ${type === opt ? (opt === 'expense' ? 'bg-[var(--color-expense-base)] text-white shadow-lg' : 'bg-[var(--color-income-base)] text-white shadow-lg') : 'text-[var(--color-text-secondary)]'}`}>
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Amount Display */}
                  <div onClick={() => setShowKeypad(true)} className={`p-6 rounded-[var(--radius-lg)] border-2 transition-all ${showKeypad ? 'border-[var(--color-accent-base)] bg-[var(--color-accent-base)]/[0.03]' : 'border-[var(--color-border-base)] bg-[var(--color-card-elevated-base)]'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex bg-[var(--color-card-base)] p-1 rounded-[var(--radius-sm)]">
                        {(['KRW', 'USD'] as const).map(cur => (
                          <button key={cur} type="button" onPointerDown={(e) => { e.preventDefault(); setValue('currency', cur); haptic('light') }} className={`px-4 py-1.5 rounded-[var(--radius-xs)] text-xs font-black ${currency === cur ? 'bg-[var(--color-accent-base)] text-white' : 'text-[var(--color-text-secondary)]'}`}>
                            {cur}
                          </button>
                        ))}
                      </div>
                      <span className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Amount</span>
                    </div>
                    <div className="flex items-baseline justify-end gap-2 overflow-hidden">
                      <span className="text-xl font-black text-[var(--color-text-secondary)]">{currency === 'USD' ? '$' : '₩'}</span>
                      <span className="text-4xl font-black tracking-tighter truncate">{amountFormatted}</span>
                    </div>
                    {convertedHint && <p className="text-right mt-2 text-sm font-bold text-[var(--color-accent-base)]">{convertedHint}</p>}
                  </div>

                  {/* Categories */}
                  <div>
                    <p className={sectionLabelStyle}>Category</p>
                    <CategoryGrid categories={filteredCategories} control={control} onSelect={handleCategorySelect} />
                  </div>

                  {/* Basic Details */}
                  <div className="space-y-4">
                    <input {...register('description')} className={`${inputBaseStyle} font-bold`} placeholder="Description" />
                    <button type="button" onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm font-black text-[var(--color-accent-base)]">
                      {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {showDetails ? 'FEWER DETAILS' : 'MORE DETAILS'}
                    </button>
                    {showDetails && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 overflow-hidden">
                        <input {...register('date')} type="date" className={inputBaseStyle} />
                        <select {...register('payment_method_id')} className={inputBaseStyle}>
                          <option value="">Payment Method</option>
                          {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                        </select>
                        <textarea {...register('note')} className={inputBaseStyle} placeholder="Add a note..." rows={2} />
                      </motion.div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {!keyboardVisible && (
              <div className="shrink-0 bg-[var(--color-card-base)]">
                <AnimatePresence mode="wait">
                  {showKeypad ? (
                    <motion.div key="keypad" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
                      <NumericKeypad onInput={handleKeypadInput} onDelete={handleKeypadDelete} onDone={() => { handleCalculate(); setShowKeypad(false) }} onCalculate={handleCalculate} />
                    </motion.div>
                  ) : (
                    <motion.div key="done" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="px-6 py-8 border-t border-[var(--color-border-base)] pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
                      <button form="tx-form-mobile" disabled={isSubmitting} className="w-full py-4 bg-[var(--color-accent-base)] text-white rounded-[var(--radius-lg)] font-black text-base shadow-xl shadow-blue-500/20 active:scale-[0.97] transition-all">
                        {isSubmitting ? 'SAVING...' : '✓ DONE'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(mobilePanel, document.body) : null
}
