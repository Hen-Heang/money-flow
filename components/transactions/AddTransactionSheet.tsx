'use client'

import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, X, Delete } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { formatNumber, haptic } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'

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

// Detects when the native iOS keyboard is open by watching visualViewport height
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

// Keypad rows: last row has 3 keys, with '0' spanning 2 columns
const KEYPAD_ROWS: string[][] = [
  ['7', '8', '9', '+'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '='],
  ['.', '0', '⌫'],
]

export default function AddTransactionSheet({
  isOpen,
  onClose,
  onSuccess,
  editTransaction,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [exchangeRate, setExchangeRate] = useState(1300)
  const [canDrag, setCanDrag] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  // Calc buffer/op — only ever set in event handlers, never in effects
  const [calcBuffer, setCalcBuffer] = useState<number | null>(null)
  const [calcOp, setCalcOp] = useState<'+' | '-' | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const isEditing = !!editTransaction
  const isMobile = useIsMobile()
  const keyboardVisible = useKeyboardVisible()

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
  const categoryId = useWatch({ control, name: 'category_id' })
  // displayValue is derived from the form — no separate state or sync effect needed
  const amountRaw = useWatch({ control, name: 'amount' })
  const displayValue = amountRaw || '0'
  const activeExchangeRate = editTransaction?.exchange_rate || exchangeRate

  // Auto-fill description from selected category (mobile only, not when editing)
  useEffect(() => {
    if (!isMobile || isEditing || !categoryId) return
    const cat = categories.find((c) => c.id === categoryId)
    if (cat) setValue('description', cat.name)
  }, [categoryId, categories, isMobile, isEditing, setValue])

  // Body scroll lock on mobile
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
    if (!isOpen) return

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
      const rawNum =
        editCurrency === 'USD'
          ? editTransaction.amount_usd
          : editTransaction.amount_krw

      // Store raw number in the form — displayValue is derived from it
      reset({
        type: editTransaction.type,
        currency: editCurrency,
        amount:
          editCurrency === 'USD'
            ? editTransaction.amount_usd.toFixed(2)
            : String(Math.round(rawNum)),
        date: editTransaction.date,
        description: editTransaction.description,
        category_id: editTransaction.category_id || '',
        payment_method_id: editTransaction.payment_method_id || '',
        note: editTransaction.note || '',
      })
      return
    }

    // New transaction — form reset is an external-library call, not our own setState
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
  }, [editTransaction, isOpen, reset, setValue, supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Single close handler — resets transient UI state in an event context, not an effect
  const handleClose = () => {
    setCalcBuffer(null)
    setCalcOp(null)
    setShowDetails(false)
    onClose()
  }

  const onSubmit = async (data: FormData) => {
    const rawNum = parseFloat(data.amount.replace(/,/g, ''))
    if (isNaN(rawNum) || rawNum <= 0) {
      toast.error('Invalid amount')
      return
    }

    let amountKrw: number
    let amountUsd: number

    if (data.currency === 'USD') {
      amountUsd = rawNum
      amountKrw = Math.round(rawNum * activeExchangeRate)
    } else {
      amountKrw = rawNum
      amountUsd = rawNum / activeExchangeRate
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
    handleClose()
  }

  // handleKey — plain function, no useCallback (React Compiler handles memoization)
  // Calls setValue (form library) and setCalcBuffer/setCalcOp (event handler, not effect)
  function handleKey(key: string) {
    haptic('light')
    const op = key === '−' ? '-' : key
    const current = displayValue // derived from useWatch, always fresh

    if (/^[0-9]$/.test(op)) {
      if (current === '0') {
        setValue('amount', op)
      } else if (currency === 'KRW' && current.length >= 10) {
        // limit digits
      } else if (currency === 'USD') {
        const dotIdx = current.indexOf('.')
        if (dotIdx !== -1 && current.length - dotIdx - 1 >= 2) return
        setValue('amount', current + op)
      } else {
        setValue('amount', current + op)
      }
    } else if (op === '.') {
      if (currency === 'KRW') return
      if (!current.includes('.')) setValue('amount', current === '0' ? '0.' : current + '.')
    } else if (op === '⌫') {
      setValue('amount', current.length <= 1 ? '' : current.slice(0, -1))
    } else if (op === '+' || op === '-') {
      setCalcBuffer(parseFloat(current) || 0)
      setCalcOp(op)
      setValue('amount', '')
    } else if (op === '=') {
      if (calcBuffer !== null && calcOp) {
        const b = parseFloat(current) || 0
        const result = calcOp === '+' ? calcBuffer + b : Math.max(0, calcBuffer - b)
        const resolved =
          currency === 'KRW'
            ? String(Math.round(result))
            : result.toFixed(2).replace(/0+$/, '').replace(/\.$/, '') || '0'
        setValue('amount', resolved)
        setCalcBuffer(null)
        setCalcOp(null)
      }
    }
  }

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  // Formatted display
  const amountNum = parseFloat(displayValue) || 0
  const amountFormatted =
    currency === 'KRW' ? formatNumber(Math.round(amountNum)) : displayValue
  const convertedHint =
    currency === 'USD'
      ? amountNum > 0
        ? `≈ ₩${formatNumber(Math.round(amountNum * activeExchangeRate))}`
        : ''
      : amountNum > 0
        ? `≈ $${(amountNum / activeExchangeRate).toFixed(2)}`
        : ''

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-card-elevated-base)',
    border: '1px solid var(--color-border-base)',
    color: 'var(--color-text-primary)',
    fontSize: '16px',
    borderRadius: '12px',
    padding: '14px 16px',
    width: '100%',
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    paddingRight: '40px',
  }

  const sectionLabelStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
  }

  // ─── Desktop form (unchanged from original) ───────────────────────────────
  const desktopFormContent = (
    <form
      id="add-transaction-form"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5 px-4 pb-6 sm:px-6"
    >
      <div
        className="flex rounded-xl p-1"
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
                className="flex-1 rounded-[10px] py-3 text-sm font-semibold transition-all"
                style={{
                  backgroundColor:
                    field.value === option
                      ? option === 'expense'
                        ? 'var(--color-expense-base)'
                        : 'var(--color-income-base)'
                      : 'transparent',
                  color: field.value === option ? 'white' : 'var(--color-text-secondary)',
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {currency === 'USD' ? '$' : '₩'}
                </span>
                <input
                  value={amountFormatted === '0' ? '' : amountFormatted}
                  readOnly
                  placeholder="0"
                  style={{
                    ...inputStyle,
                    paddingLeft: currency === 'USD' ? '40px' : '44px',
                    paddingRight: '120px',
                    fontSize: 'clamp(22px, 6vw, 28px)',
                    fontWeight: 'bold',
                    cursor: 'default',
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
                        setCalcBuffer(null)
                        setCalcOp(null)
                        setValue('amount', '')
                        haptic('light')
                      }}
                      className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
                      style={{
                        backgroundColor:
                          currencyField.value === option
                            ? 'var(--color-accent-base)'
                            : 'transparent',
                        color:
                          currencyField.value === option
                            ? 'white'
                            : 'var(--color-text-secondary)',
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          />
          {convertedHint && amountNum > 0 && (
            <p className="mt-1.5 pl-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {convertedHint}
            </p>
          )}
        </div>

        {filteredCategories.length > 0 && (
          <div>
            <p className="mb-2 pl-1 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Category
            </p>
            <div className="relative">
              <select {...register('category_id')} style={selectStyle}>
                <option value="">Select category</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--color-text-secondary)' }}
              />
            </div>
          </div>
        )}

        {paymentMethods.length > 0 && (
          <div>
            <p className="mb-2 pl-1 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Payment Method
            </p>
            <div className="relative">
              <select {...register('payment_method_id')} style={selectStyle}>
                <option value="">Select payment method</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.icon} {method.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--color-text-secondary)' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p style={sectionLabelStyle}>When</p>
        <input
          {...register('date')}
          type="date"
          style={{ ...inputStyle, padding: '12px 16px', fontSize: '16px' }}
        />
      </div>

      <div className="space-y-3">
        <p style={sectionLabelStyle}>Details</p>
        <div>
          <input
            {...register('description')}
            placeholder="What was this for?"
            style={inputStyle}
          />
          {errors.description && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-expense-base)' }}>
              {errors.description.message}
            </p>
          )}
        </div>
        <textarea
          {...register('note')}
          placeholder="Optional note"
          rows={2}
          style={{ ...inputStyle, minHeight: '72px', resize: 'none' }}
        />
      </div>
    </form>
  )

  // ─── Desktop ──────────────────────────────────────────────────────────────
  if (!isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Edit Transaction' : 'New Transaction'}
        footer={
          <button
            type="submit"
            form="add-transaction-form"
            disabled={isSubmitting}
            className="w-full rounded-button py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-income-base)' }}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Transaction' : 'Save Transaction'}
          </button>
        }
      >
        {desktopFormContent}
      </BottomSheet>
    )
  }

  // ─── Mobile: full-screen with custom keypad ────────────────────────────────
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
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
            onClick={handleClose}
          />
          <motion.div
            key="panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            drag={canDrag ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80) handleClose()
            }}
            className="fixed inset-0 z-100 flex flex-col overflow-hidden"
            style={{ background: 'var(--color-card-base)', willChange: 'transform' }}
          >
            {/* Drag handle */}
            <div
              className="flex shrink-0 justify-center pb-1 pt-3"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
            >
              <div
                className="h-1 w-9 rounded-full"
                style={{ background: 'var(--color-border-base)', opacity: 0.7 }}
              />
            </div>

            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4 pb-3 pt-1"
              style={{ borderBottom: '1px solid var(--color-border-base)' }}
            >
              <h2
                className="text-xl font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {isEditing ? 'Edit Transaction' : 'New Transaction'}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              onScroll={() => {
                const el = scrollRef.current
                setCanDrag(!el || el.scrollTop === 0)
              }}
            >
              <form id="add-transaction-form-mobile" onSubmit={handleSubmit(onSubmit)}>
                {/* Expense / Income toggle */}
                <div className="px-4 pt-3 pb-3">
                  <div
                    className="flex rounded-xl p-1"
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
                            onPointerDown={(e) => {
                              e.preventDefault()
                              field.onChange(option)
                              haptic('light')
                            }}
                            className="flex-1 rounded-[10px] py-3 text-sm font-bold tracking-wider transition-all"
                            style={{
                              backgroundColor:
                                field.value === option
                                  ? option === 'expense'
                                    ? 'var(--color-expense-base)'
                                    : 'var(--color-income-base)'
                                  : 'transparent',
                              color:
                                field.value === option ? 'white' : 'var(--color-text-secondary)',
                              touchAction: 'manipulation',
                              userSelect: 'none',
                            }}
                          >
                            {option.toUpperCase()}
                          </button>
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Amount display */}
                <div className="px-4 pb-3">
                  <p style={sectionLabelStyle}>Core Details</p>
                  <div
                    className="mt-2 flex items-center gap-3 rounded-xl px-4 py-4"
                    style={{
                      backgroundColor: 'var(--color-card-elevated-base)',
                      border: '1.5px solid var(--color-accent-base)',
                    }}
                  >
                    {/* Currency symbol */}
                    <span
                      className="shrink-0 text-2xl font-bold"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {currency === 'USD' ? '$' : '₩'}
                    </span>

                    {/* Amount number + calc hint */}
                    <div className="min-w-0 flex-1">
                      {calcBuffer !== null && (
                        <p
                          className="mb-0.5 text-right text-xs font-medium"
                          style={{ color: 'var(--color-accent-base)' }}
                        >
                          {currency === 'KRW'
                            ? formatNumber(Math.round(calcBuffer))
                            : calcBuffer.toFixed(2)}{' '}
                          {calcOp}
                        </p>
                      )}
                      <p
                        className="truncate text-right font-bold leading-tight"
                        style={{
                          fontSize: 'clamp(26px, 8vw, 38px)',
                          color:
                            amountNum > 0
                              ? 'var(--color-text-primary)'
                              : 'var(--color-text-secondary)',
                        }}
                      >
                        {amountNum > 0 ? amountFormatted : '0'}
                      </p>
                      {convertedHint && (
                        <p
                          className="mt-0.5 text-right text-xs"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {convertedHint}
                        </p>
                      )}
                    </div>

                    {/* Currency toggle */}
                    <Controller
                      name="currency"
                      control={control}
                      render={({ field }) => (
                        <div
                          className="flex shrink-0 rounded-lg p-0.5"
                          style={{ backgroundColor: 'var(--color-card-base)' }}
                        >
                          {(['KRW', 'USD'] as const).map((option) => (
                            <button
                              key={option}
                              type="button"
                              onPointerDown={(e) => {
                                e.preventDefault()
                                field.onChange(option)
                                setCalcBuffer(null)
                                setCalcOp(null)
                                setValue('amount', '')
                                haptic('light')
                              }}
                              className="rounded-md px-3 py-1.5 text-xs font-semibold transition-all"
                              style={{
                                backgroundColor:
                                  field.value === option
                                    ? 'var(--color-accent-base)'
                                    : 'transparent',
                                color:
                                  field.value === option
                                    ? 'white'
                                    : 'var(--color-text-secondary)',
                                touchAction: 'manipulation',
                                userSelect: 'none',
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    />
                  </div>
                </div>

                {/* Category grid */}
                {filteredCategories.length > 0 && (
                  <div className="px-4 pb-3">
                    <p style={sectionLabelStyle}>Category</p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {filteredCategories.map((cat) => (
                        <Controller
                          key={cat.id}
                          name="category_id"
                          control={control}
                          render={({ field }) => {
                            const selected = field.value === cat.id
                            return (
                              <button
                                type="button"
                                onPointerDown={(e) => {
                                  e.preventDefault()
                                  field.onChange(selected ? '' : cat.id)
                                  haptic('light')
                                }}
                                className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition-all"
                                style={{
                                  backgroundColor: selected
                                    ? 'var(--color-accent-base)'
                                    : 'var(--color-card-elevated-base)',
                                  touchAction: 'manipulation',
                                  userSelect: 'none',
                                }}
                              >
                                <span className="text-xl leading-none">{cat.icon}</span>
                                <span
                                  className="w-full truncate text-center text-[9px] font-semibold leading-tight"
                                  style={{
                                    color: selected ? 'white' : 'var(--color-text-secondary)',
                                    letterSpacing: '0.05em',
                                  }}
                                >
                                  {cat.name.toUpperCase()}
                                </span>
                              </button>
                            )
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Description (visible by default on mobile) */}
                <div className="px-4 pb-2">
                  <input
                    {...register('description')}
                    placeholder="Description (e.g. Coffee, Salary)"
                    style={inputStyle}
                  />
                  {errors.description && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-expense-base)' }}>
                      {errors.description.message}
                    </p>
                  )}
                </div>

                {/* More details toggle */}
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault()
                      setShowDetails((v) => !v)
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: 'var(--color-accent-base)', touchAction: 'manipulation' }}
                  >
                    {showDetails ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    {showDetails ? 'LESS DETAILS' : 'MORE DETAILS'}
                  </button>

                  {showDetails && (
                    <div className="mt-3 space-y-3">
                      {/* Date */}
                      <div>
                        <p
                          className="mb-1.5 text-xs font-medium"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Date
                        </p>
                        <input
                          {...register('date')}
                          type="date"
                          style={{ ...inputStyle, padding: '12px 16px' }}
                        />
                      </div>

                      {/* Payment method */}
                      {paymentMethods.length > 0 && (
                        <div>
                          <p
                            className="mb-1.5 text-xs font-medium"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Payment Method
                          </p>
                          <div className="relative">
                            <select {...register('payment_method_id')} style={selectStyle}>
                              <option value="">Select payment method</option>
                              {paymentMethods.map((method) => (
                                <option key={method.id} value={method.id}>
                                  {method.icon} {method.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown
                              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
                              style={{ color: 'var(--color-text-secondary)' }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Note */}
                      <div>
                        <p
                          className="mb-1.5 text-xs font-medium"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Note
                        </p>
                        <textarea
                          {...register('note')}
                          placeholder="Optional note"
                          rows={2}
                          style={{ ...inputStyle, resize: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>

            {/* Custom keypad — hidden when native keyboard is open */}
            {!keyboardVisible && (
              <div
                className="shrink-0"
                style={{ borderTop: '1px solid var(--color-border-base)' }}
              >
                <div className="px-3 pt-3 pb-2 space-y-2">
                  {KEYPAD_ROWS.map((row, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="grid gap-2"
                      style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
                    >
                      {row.map((key) => {
                        const isOperator = ['+', '−', '='].includes(key)
                        const isBackspace = key === '⌫'
                        const isZeroWide = rowIdx === 3 && key === '0'

                        return (
                          <button
                            key={key}
                            type="button"
                            onPointerDown={(e) => {
                              e.preventDefault()
                              handleKey(key)
                            }}
                            className="flex items-center justify-center rounded-xl font-semibold transition-transform active:scale-90"
                            style={{
                              height: '52px',
                              gridColumn: isZeroWide ? 'span 2' : undefined,
                              backgroundColor: isOperator
                                ? 'rgba(99,102,241,0.18)'
                                : isBackspace
                                  ? 'rgba(239,68,68,0.12)'
                                  : 'var(--color-card-elevated-base)',
                              color: isOperator
                                ? 'var(--color-accent-base)'
                                : isBackspace
                                  ? 'var(--color-expense-base)'
                                  : 'var(--color-text-primary)',
                              fontSize: '20px',
                              touchAction: 'manipulation',
                              userSelect: 'none',
                              WebkitUserSelect: 'none',
                            }}
                          >
                            {isBackspace ? <Delete className="h-5 w-5" /> : key}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>

                {/* DONE button — padded above iPhone home indicator */}
                <div
                  className="px-3"
                  style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
                  }}
                >
                  <button
                    type="submit"
                    form="add-transaction-form-mobile"
                    disabled={isSubmitting}
                    className="w-full rounded-xl py-4 text-base font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--color-accent-base)',
                      touchAction: 'manipulation',
                    }}
                  >
                    {isSubmitting ? 'Saving...' : '✓  DONE'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(mobilePanel, document.body) : null
}
