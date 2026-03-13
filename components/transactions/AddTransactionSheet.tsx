'use client'

import { useEffect, useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronDown, X } from 'lucide-react'
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

function useKeyboardOffset() {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setOffset(Math.max(0, window.innerHeight - vv.height))
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])
  return offset
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
  const amountInputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const isEditing = !!editTransaction
  const isMobile = useIsMobile()
  const keyboardOffset = useKeyboardOffset()

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

  const amountNum = parseFloat((amountRaw || '0').replace(/,/g, '')) || 0
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

    setTimeout(() => amountInputRef.current?.focus(), 300)
  }, [editTransaction, isOpen, reset, setValue, supabase])

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
                  {currency === 'USD' ? '$' : 'KRW'}
                </span>
                <input
                  {...register('amount')}
                  ref={(element) => {
                    register('amount').ref(element)
                    amountInputRef.current = element
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  style={{
                    ...inputStyle,
                    paddingLeft: currency === 'USD' ? '40px' : '58px',
                    paddingRight: '112px',
                    fontSize: 'clamp(22px, 6vw, 28px)',
                    fontWeight: 'bold',
                  }}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '')
                    const num = parseFloat(raw)
                    if (currency === 'KRW') {
                      if (!isNaN(num)) {
                        setValue('amount', formatNumber(num))
                      } else {
                        setValue('amount', raw)
                      }
                    } else {
                      setValue('amount', raw)
                    }
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
                      className="rounded-md px-2.5 py-1 text-xs font-semibold transition-all"
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
          {convertedHint && amountNum > 0 && (
            <p className="mt-1.5 pl-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {convertedHint}
            </p>
          )}
          {errors.amount && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-expense-base)' }}>
              {errors.amount.message}
            </p>
          )}
        </div>

        {filteredCategories.length > 0 && (
          <div>
            <p className="mb-2 pl-1 text-xs font-medium" style={fieldLabelStyle}>
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
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
          </div>
        )}

        {paymentMethods.length > 0 && (
          <div>
            <p className="mb-2 pl-1 text-xs font-medium" style={fieldLabelStyle}>
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
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p style={sectionLabelStyle}>When</p>

        <div>
          <p className="mb-2 pl-1 text-xs font-medium" style={fieldLabelStyle}>
            Date
          </p>
          <input
            {...register('date')}
            type="date"
            style={{ ...inputStyle, padding: '12px 16px', fontSize: '16px' }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <p style={sectionLabelStyle}>Details</p>

        <div>
          <p className="mb-2 pl-1 text-xs font-medium" style={fieldLabelStyle}>
            Description
          </p>
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

        <div>
          <p className="mb-2 pl-1 text-xs font-medium" style={fieldLabelStyle}>
            Note
          </p>
          <textarea
            {...register('note')}
            placeholder="Optional note"
            rows={2}
            style={{ ...inputStyle, minHeight: '72px', resize: 'none' as const }}
          />
        </div>
      </div>
    </form>
  )

  const submitButton = (
    <button
      type="submit"
      form="add-transaction-form"
      disabled={isSubmitting}
      className="w-full rounded-button py-4 text-base font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
      style={{ backgroundColor: 'var(--color-income-base)' }}
    >
      {isSubmitting ? 'Saving...' : isEditing ? 'Update Transaction' : 'Save Transaction'}
    </button>
  )

  // Desktop: use BottomSheet as before
  if (!isMobile) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
        footer={submitButton}
      >
        {formContent}
      </BottomSheet>
    )
  }

  // Mobile: full-screen slide-up panel (same pattern as ChatBot)
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
            onClick={onClose}
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
              if (info.offset.y > 80) onClose()
            }}
            className="fixed inset-0 z-100 flex flex-col overflow-hidden"
            style={{
              background: 'var(--color-card-base)',
              willChange: 'transform',
            }}
          >
            {/* Drag handle */}
            <div
              className="flex shrink-0 justify-center pb-1 pt-3"
              style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
            >
              <div
                className="h-1 w-9 rounded-full"
                style={{ background: 'var(--color-border-base)', opacity: 0.7 }}
              />
            </div>

            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4 pb-4 pt-1"
              style={{ borderBottom: '1px solid var(--color-border-base)' }}
            >
              <h2
                className="text-xl font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {isEditing ? 'Edit Transaction' : 'Add Transaction'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto pt-4"
              style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
              onScroll={() => {
                const el = scrollRef.current
                setCanDrag(!el || el.scrollTop === 0)
              }}
            >
              {formContent}
            </div>

            {/* Footer */}
            <div
              className="shrink-0 px-4 pt-3"
              style={{
                borderTop: '1px solid var(--color-border-base)',
                paddingBottom:
                  keyboardOffset > 0
                    ? `${keyboardOffset + 8}px`
                    : 'max(20px, env(safe-area-inset-bottom, 20px))',
              }}
            >
              {submitButton}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(mobilePanel, document.body) : null
}
