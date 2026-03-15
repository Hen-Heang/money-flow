'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { X, Delete, Check, Equal, Plus, Minus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { formatNumber, haptic } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'
import NumericKeypad from '@/components/ui/NumericKeypad'

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

const schema = z.object({
  type: z.enum(['income', 'expense']),
  currency: z.enum(['KRW', 'USD']),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string(),
  description: z.string().min(1, 'Description is required'),
  category_id: z.string().optional(),
  payment_method_id: z.string().optional(),
  note: z.string().optional(),
})

type FormData = z.infer<typeof schema>

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

function evaluateExpression(expr: string): number {
  try {
    // Clean up input: remove commas and sanitize
    const clean = expr.replace(/,/g, '').replace(/[^0-9.+-]/g, '')
    if (!clean) return 0
    // Simple evaluation for basic + and -
    // We split by + and - while keeping the delimiters
    const tokens = clean.split(/([+-])/).filter(t => t.trim() !== '')
    let result = parseFloat(tokens[0] || '0')
    
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i]
      const val = parseFloat(tokens[i + 1] || '0')
      if (op === '+') result += val
      else if (op === '-') result -= val
    }
    
    return isNaN(result) ? 0 : result
  } catch {
    return 0
  }
}

export default function AddTransactionSheet({
  isOpen,
  onClose,
  onSuccess,
  editTransaction,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [exchangeRate, setExchangeRate] = useState(1300)
  const [showKeypad, setShowKeypad] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const isEditing = !!editTransaction
  const isMobile = useIsMobile()

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      currency: 'KRW',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      description: '',
    },
  })

  const type = useWatch({ control, name: 'type' })
  const currency = useWatch({ control, name: 'currency' })
  const amountRaw = useWatch({ control, name: 'amount' })
  const activeExchangeRate = editTransaction?.exchange_rate || exchangeRate

  const amountNum = evaluateExpression(amountRaw || '0')
  const convertedHint =
    currency === 'USD'
      ? `Approx. KRW ${formatNumber(Math.round(amountNum * activeExchangeRate))}`
      : amountNum > 0
        ? `Approx. USD ${(amountNum / activeExchangeRate).toFixed(2)}`
        : ''

  // Body scroll lock for mobile
  useEffect(() => {
    if (!isOpen || !isMobile || typeof document === 'undefined') return
    const scrollY = window.scrollY
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen, isMobile])

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowKeypad(false)
      return
    }

    const loadData = async () => {
      if (categories.length === 0 || paymentMethods.length === 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const [cats, methods] = await Promise.all([
          supabase.from('categories').select('*'),
          supabase.from('payment_methods').select('*'),
        ])

        if (cats.data) setCategories(cats.data)
        if (methods.data) setPaymentMethods(methods.data)
      }
    }

    loadData()

    fetch('/api/exchange-rate')
      .then((r) => r.json())
      .then((d) => {
        if (d.rate) setExchangeRate(d.rate)
      })
      .catch(() => {})

    if (editTransaction) {
      const editCurrency = (editTransaction.currency as 'KRW' | 'USD') || 'KRW'
      const displayAmount =
        editCurrency === 'USD'
          ? editTransaction.amount_usd.toFixed(2)
          : formatNumber(editTransaction.amount_krw)

      reset({
        type: editTransaction.type,
        currency: editCurrency,
        amount: displayAmount,
        date: editTransaction.date,
        description: editTransaction.description,
        category_id: editTransaction.category_id || '',
        payment_method_id: editTransaction.payment_method_id || '',
        note: editTransaction.note || '',
      })

      return
    }

    reset({
      type: 'expense',
      currency: 'KRW',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      description: '',
    })

    if (typeof window !== 'undefined') {
      const lastCategory = localStorage.getItem('lastCategory')
      const lastPaymentMethod = localStorage.getItem('lastPaymentMethod')
      if (lastCategory) setValue('category_id', lastCategory)
      if (lastPaymentMethod) setValue('payment_method_id', lastPaymentMethod)
    }

    if (isMobile) {
      setTimeout(() => setShowKeypad(true), 400)
    } else {
      setTimeout(() => amountInputRef.current?.focus(), 300)
    }
  }, [editTransaction, isOpen, reset, setValue, supabase, isMobile])

  const handleCalculate = useCallback(() => {
    const result = evaluateExpression(amountRaw || '0')
    if (result > 0) {
      setValue('amount', currency === 'KRW' ? formatNumber(result) : result.toString())
    }
  }, [amountRaw, currency, setValue])

  const handleKeypadInput = useCallback((val: string) => {
    const current = (amountRaw || '').replace(/,/g, '')
    
    // If operators, we allow them directly
    if (['+', '-'].includes(val)) {
      if (!current || ['+', '-'].includes(current.slice(-1))) return
      setValue('amount', amountRaw + ' ' + val + ' ')
      return
    }

    if (val === '.' && current.includes('.')) {
      // Check only the last part of expression
      const parts = current.split(/[+-]/)
      const lastPart = parts[parts.length - 1]
      if (lastPart?.includes('.')) return
    }

    const next = amountRaw + val
    // If it's a simple number (no spaces/operators), format it if KRW
    if (!next.includes(' ') && currency === 'KRW') {
      const num = parseFloat(next.replace(/,/g, ''))
      if (!isNaN(num)) setValue('amount', formatNumber(num))
      else setValue('amount', next)
    } else {
      setValue('amount', next)
    }
  }, [amountRaw, currency, setValue])

  const handleKeypadDelete = useCallback(() => {
    if (!amountRaw) return
    const trimmed = amountRaw.trim()
    let next: string
    if (amountRaw.endsWith(' ')) {
      // Delete " + " or " - " (3 chars)
      next = amountRaw.slice(0, -3)
    } else {
      next = amountRaw.slice(0, -1)
    }
    
    // Auto-reformat if KRW and it's a simple number
    if (!next.includes(' ') && currency === 'KRW' && next) {
      const num = parseFloat(next.replace(/,/g, ''))
      if (!isNaN(num)) setValue('amount', formatNumber(num))
      else setValue('amount', next)
    } else {
      setValue('amount', next)
    }
  }, [amountRaw, currency, setValue])

  const onSubmit = async (data: FormData) => {
    const finalAmount = evaluateExpression(data.amount)
    if (finalAmount <= 0) {
      toast.error('Invalid amount')
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

    const {
      data: { user },
    } = await supabase.auth.getUser()
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

    let saved
    let error

    if (isEditing && editTransaction) {
      const result = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', editTransaction.id)
        .select()
        .single()
      saved = result.data
      error = result.error
    } else {
      const result = await supabase
        .from('transactions')
        .insert({ ...payload, user_id: user.id })
        .select()
        .single()
      saved = result.data
      error = result.error
    }

    if (error) {
      toast.error('Failed to save transaction')
      return
    }

    if (!isEditing && typeof window !== 'undefined') {
      if (data.category_id) localStorage.setItem('lastCategory', data.category_id)
      if (data.payment_method_id) localStorage.setItem('lastPaymentMethod', data.payment_method_id)
    }

    haptic('medium')
    toast.success(isEditing ? 'Transaction updated!' : 'Transaction saved!')
    onSuccess(saved)
    onClose()
  }

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  const inputStyle = {
    backgroundColor: 'var(--color-card-elevated-base)',
    border: '1px solid var(--color-border-base)',
    color: 'var(--color-text-primary)',
    fontSize: '16px',
    borderRadius: '12px',
    padding: '16px',
    width: '100%',
    outline: 'none',
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    paddingRight: '40px',
  }

  const sectionLabelStyle = {
    color: 'var(--color-text-secondary)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
  }

  const fieldLabelStyle = {
    color: 'var(--color-text-secondary)',
  }

  const formContent = (
    <div className="space-y-5 px-mobile pb-6 sm:px-6">
      <div
        className="flex rounded-xl p-1 shadow-inner"
        style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
      >
        {(['expense', 'income'] as const).map((option) => (
          <Controller
            key={option}
            name="type"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => {
                  field.onChange(option)
                  haptic('light')
                }}
                className="flex-1 rounded-[10px] py-3 text-[13px] font-black uppercase tracking-widest transition-all"
                style={{
                  backgroundColor:
                    field.value === option
                      ? option === 'expense'
                        ? 'var(--color-expense-base)'
                        : 'var(--color-income-base)'
                      : 'transparent',
                  color: field.value === option ? 'white' : 'var(--color-text-secondary)',
                  boxShadow: field.value === option ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                }}
              >
                {option === 'expense' ? 'Expense' : 'Income'}
              </button>
            )}
          />
        ))}
      </div>

      <div className="space-y-3">
        <p style={sectionLabelStyle}>Core Details</p>

        <div>
          <Controller
            name="currency"
            control={control}
            render={({ field: currencyField }) => (
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {currency === 'USD' ? '$' : '₩'}
                </span>
                <input
                  {...register('amount')}
                  readOnly={isMobile}
                  onFocus={() => isMobile && setShowKeypad(true)}
                  inputMode={isMobile ? 'none' : 'decimal'}
                  placeholder="0"
                  className="transition-all"
                  style={{
                    ...inputStyle,
                    paddingLeft: currency === 'USD' ? '40px' : '58px',
                    paddingRight: '112px',
                    fontSize: 'clamp(24px, 7vw, 32px)',
                    fontWeight: '900',
                    textAlign: 'right',
                    caretColor: 'var(--color-accent-base)',
                    border: showKeypad ? '2.5px solid var(--color-accent-base)' : '1px solid var(--color-border-base)',
                    boxShadow: showKeypad ? '0 0 20px rgba(59,130,246,0.15)' : 'none'
                  }}
                />
                <div
                  className="absolute right-2 top-1/2 flex -translate-y-1/2 rounded-lg p-0.5"
                  style={{ backgroundColor: 'var(--color-card-base)' }}
                >
                  {(['KRW', 'USD'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        currencyField.onChange(option)
                        setValue('amount', '')
                        haptic('light')
                      }}
                      className="rounded-md px-3 py-1.5 text-xs font-black transition-all"
                      style={{
                        backgroundColor:
                          currencyField.value === option
                            ? 'var(--color-accent-base)'
                            : 'transparent',
                        color:
                          currencyField.value === option ? 'white' : 'var(--color-text-secondary)',
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />
          <div className="flex justify-between items-center mt-2 px-1">
             <div className="text-[10px] font-black uppercase tracking-tighter text-[var(--color-text-secondary)]">
                {amountRaw?.includes(' ') ? 'Calculation in progress...' : ''}
             </div>
             {convertedHint && amountNum > 0 && (
               <p className="text-right text-[13px] font-black tracking-tight" style={{ color: 'var(--color-accent-base)' }}>
                 {convertedHint}
               </p>
             )}
          </div>
          {errors.amount && (
            <p className="mt-1 text-xs font-bold" style={{ color: 'var(--color-expense-base)' }}>
              {errors.amount.message}
            </p>
          )}
        </div>

        {filteredCategories.length > 0 && (
          <div className="space-y-3">
            <p className="pl-1 text-xs font-bold uppercase tracking-wider" style={fieldLabelStyle}>
              Category
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              <Controller
                name="category_id"
                control={control}
                render={({ field }) => (
                  <>
                    {filteredCategories.map((category) => {
                      const isSelected = field.value === category.id
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => {
                            field.onChange(category.id)
                            haptic('light')
                          }}
                          className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-1 transition-all active:scale-90 shadow-sm"
                          style={{
                            backgroundColor: isSelected 
                              ? `color-mix(in srgb, ${category.color || 'var(--color-accent-base)'} 20%, transparent)`
                              : 'var(--color-card-elevated-base)',
                            border: `2px solid ${isSelected ? (category.color || 'var(--color-accent-base)') : 'transparent'}`,
                          }}
                        >
                          <span className="text-2xl leading-none">{category.icon}</span>
                          <span 
                            className="text-[10px] font-black truncate w-full text-center px-0.5 uppercase tracking-tighter"
                            style={{ color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                          >
                            {category.name}
                          </span>
                        </button>
                      )
                    })}
                  </>
                )}
              />
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 pl-1 text-[11px] font-bold uppercase tracking-wider" style={fieldLabelStyle}>
            Payment Method
          </p>
          <select {...register('payment_method_id')} className="font-medium" style={inputStyle}>
            <option value="">Select payment method</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.icon} {method.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <p style={sectionLabelStyle}>When & What</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input
              {...register('date')}
              type="date"
              className="font-bold"
              style={{ ...inputStyle, padding: '12px 16px', fontSize: '15px' }}
            />
          </div>
          <div>
            <input
              {...register('description')}
              placeholder="Description"
              className="font-bold"
              style={{ ...inputStyle, padding: '12px 16px', fontSize: '15px' }}
            />
          </div>
        </div>
        <textarea
          {...register('note')}
          placeholder="Optional note"
          rows={2}
          className="font-medium"
          style={{ ...inputStyle, minHeight: '64px', resize: 'none' as const }}
        />
      </div>
    </div>
  )

  const submitButton = (
    <button
      type="button"
      onClick={() => {
        handleCalculate()
        handleSubmit(onSubmit)()
      }}
      disabled={isSubmitting}
      className="w-full rounded-button py-4 text-base font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-50 shadow-xl"
      style={{ 
        backgroundColor: type === 'expense' ? 'var(--color-expense-base)' : 'var(--color-income-base)',
        boxShadow: type === 'expense' ? '0 12px 24px rgba(239,68,68,0.25)' : '0 12px 24px rgba(16,185,129,0.25)'
      }}
    >
      {isSubmitting ? 'Saving...' : isEditing ? 'Update Transaction' : 'Confirm Transaction'}
    </button>
  )

  if (!isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
        footer={submitButton}
      >
        <form onSubmit={handleSubmit(onSubmit)}>{formContent}</form>
      </BottomSheet>
    )
  }

  const mobilePanel = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-90"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-100 flex flex-col overflow-hidden"
            style={{ background: 'var(--color-bg)', willChange: 'transform' }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-5 pb-4 pt-[max(12px,env(safe-area-inset-top,12px))] border-bottom border-[var(--color-border-base)]">
              <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                {isEditing ? 'Edit' : 'New'} Transaction
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)] active:scale-90 transition-transform"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto pt-2"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {formContent}
            </div>

            {/* Footer / Keypad Area */}
            <div className="shrink-0">
              <AnimatePresence mode="wait">
                {showKeypad ? (
                  <motion.div
                    key="keypad"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  >
                    <NumericKeypad 
                      onInput={handleKeypadInput} 
                      onDelete={handleKeypadDelete} 
                      onDone={() => {
                        handleCalculate()
                        setShowKeypad(false)
                      }} 
                      onCalculate={handleCalculate}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="px-5 py-4 glass-ios"
                    style={{ 
                      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
                      borderTop: '1px solid var(--color-border-base)' 
                    }}
                  >
                    {submitButton}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(mobilePanel, document.body) : null
}
