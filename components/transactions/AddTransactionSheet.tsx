'use client'

import { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ChevronDown, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { haptic, formatNumber } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'

const schema = z.object({
  type: z.enum(['income', 'expense']),
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
  amount_krw: number
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

export default function AddTransactionSheet({ isOpen, onClose, onSuccess, editTransaction }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [exchangeRate, setExchangeRate] = useState(1300)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const isEditing = !!editTransaction

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      description: '',
    },
  })

  const type = watch('type')

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const [cats, methods] = await Promise.all([
          supabase.from('categories').select('*'),
          supabase.from('payment_methods').select('*'),
        ])
        if (cats.data) setCategories(cats.data)
        if (methods.data) setPaymentMethods(methods.data)
      }
      loadData()

      fetch('/api/exchange-rate')
        .then(r => r.json())
        .then(d => { if (d.rate) setExchangeRate(d.rate) })
        .catch(() => {})

      if (editTransaction) {
        // Pre-fill form for editing
        reset({
          type: editTransaction.type,
          amount: formatNumber(editTransaction.amount_krw),
          date: editTransaction.date,
          description: editTransaction.description,
          category_id: editTransaction.category_id || '',
          payment_method_id: editTransaction.payment_method_id || '',
          note: editTransaction.note || '',
        })
        if (editTransaction.exchange_rate) setExchangeRate(editTransaction.exchange_rate)
      } else {
        // New transaction defaults
        reset({
          type: 'expense',
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
      }
    }
  }, [isOpen, editTransaction]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: FormData) => {
    const amountKrw = parseFloat(data.amount.replace(/,/g, ''))
    if (isNaN(amountKrw)) {
      toast.error('Invalid amount')
      return
    }
    const amountUsd = amountKrw / exchangeRate

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      date: data.date,
      type: data.type,
      category_id: data.category_id || null,
      description: data.description,
      amount_krw: amountKrw,
      amount_usd: amountUsd,
      exchange_rate: exchangeRate,
      payment_method_id: data.payment_method_id || null,
      note: data.note || null,
    }

    let saved, error
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

    if (!isEditing) {
      const currentDate = data.date
      const currentPaymentMethod = data.payment_method_id
      reset({
        type: 'expense',
        date: currentDate,
        amount: '',
        description: '',
        payment_method_id: currentPaymentMethod,
      })
    }
    onClose()
  }

  const filteredCategories = categories.filter(c => c.type === type || c.type === 'both')

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

  const submitButton = (
    <button
      type="submit"
      form="add-transaction-form"
      disabled={isSubmitting}
      className="w-full text-white rounded-button py-4 font-semibold text-base active:scale-95 transition-transform disabled:opacity-50"
      style={{ backgroundColor: 'var(--color-income-base)' }}
    >
      {isSubmitting ? 'Saving...' : isEditing ? 'Update Transaction' : 'Save Transaction'}
    </button>
  )

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
      footer={submitButton}
    >
      <form id="add-transaction-form" onSubmit={handleSubmit(onSubmit)} className="px-4 pb-2 sm:px-6 space-y-4">
        {/* Type Toggle */}
        <div
          className="flex rounded-[12px] p-1"
          style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
        >
          {(['expense', 'income'] as const).map(t => (
            <Controller
              key={t}
              name="type"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => { field.onChange(t); haptic('light') }}
                  className="flex-1 py-3 rounded-[10px] text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: field.value === t
                      ? t === 'expense' ? 'var(--color-expense-base)' : 'var(--color-income-base)'
                      : 'transparent',
                    color: field.value === t ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  {t === 'expense' ? '💸 Expense' : '💰 Income'}
                </button>
              )}
            />
          ))}
        </div>

        {/* Amount */}
        <div className="relative">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-lg"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            ₩
          </span>
          <input
            {...register('amount')}
            ref={(e) => {
              register('amount').ref(e)
              amountInputRef.current = e
            }}
            inputMode="decimal"
            placeholder="0"
            style={{
              ...inputStyle,
              paddingLeft: '40px',
              fontSize: 'clamp(22px, 6vw, 28px)',
              fontWeight: 'bold',
            }}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, '')
              const num = parseFloat(raw)
              if (!isNaN(num)) {
                setValue('amount', formatNumber(num))
              } else {
                setValue('amount', raw)
              }
            }}
          />
        </div>
        {errors.amount && <p className="text-xs" style={{ color: 'var(--color-expense-base)' }}>{errors.amount.message}</p>}

        {/* Description */}
        <div>
          <input
            {...register('description')}
            placeholder="Description"
            style={inputStyle}
          />
          {errors.description && <p className="text-xs mt-1" style={{ color: 'var(--color-expense-base)' }}>{errors.description.message}</p>}
        </div>

        {/* Date */}
        <input
          {...register('date')}
          type="date"
          style={inputStyle}
        />

        {/* Category */}
        {filteredCategories.length > 0 && (
          <select
            {...register('category_id')}
            style={inputStyle}
          >
            <option value="">No category</option>
            {filteredCategories.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        )}

        {/* Payment Method */}
        {paymentMethods.length > 0 && (
          <select
            {...register('payment_method_id')}
            style={inputStyle}
          >
            <option value="">No payment method</option>
            {paymentMethods.map(m => (
              <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
            ))}
          </select>
        )}

        {/* Note */}
        <input
          {...register('note')}
          placeholder="Note (optional)"
          style={inputStyle}
        />

      </form>
    </BottomSheet>
  )
}
