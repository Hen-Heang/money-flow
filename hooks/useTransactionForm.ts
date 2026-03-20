'use client'

import { useCallback, useState } from 'react'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { formatNumber } from '@/lib/utils'

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  currency: z.enum(['KRW', 'USD']),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string(),
  description: z.string().min(1, 'Description is required'),
  category_id: z.string().optional(),
  payment_method_id: z.string().optional(),
  note: z.string().optional(),
})

export type TransactionFormData = z.infer<typeof transactionSchema>

export function evaluateExpression(expr: string): number {
  try {
    const clean = expr.replace(/,/g, '').trim()
    if (!clean) return 0
    const tokens = clean.split(/\s*([+-])\s*/).filter((t) => t !== '')
    let result = parseFloat(tokens[0] || '0')
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i]
      const val = parseFloat(tokens[i + 1] || '0')
      if (op === '+') result += val
      else if (op === '-') result -= val
    }
    return isNaN(result) ? 0 : Math.max(0, result)
  } catch {
    return 0
  }
}

export function useTransactionForm(initialData?: Partial<TransactionFormData>) {
  const exchangeRate = useExchangeRate()

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: initialData || {
      type: 'expense',
      currency: 'KRW',
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: '',
      description: '',
    },
  })

  const { setValue, control } = form
  const amountRaw = useWatch({ control, name: 'amount' })
  const currency = useWatch({ control, name: 'currency' })

  const amountNum = evaluateExpression(amountRaw || '0')
  const hasExpression = !!(amountRaw && (amountRaw.includes('+') || amountRaw.includes('-')))


  const handleKeypadInput = useCallback((val: string) => {
    const current = amountRaw || ''
    const raw = current.replace(/,/g, '')

    if (val === '+' || val === '-') {
      if (!raw || /[+\-]\s*$/.test(raw)) return
      setValue('amount', current.trimEnd() + ' ' + val + ' ')
      return
    }

    if (val === '.') {
      const parts = raw.split(/[+-]/)
      const lastPart = parts[parts.length - 1] ?? ''
      if (lastPart.includes('.')) return
    }

    const next = raw + val
    if (!next.includes('+') && !next.includes('-') && currency === 'KRW') {
      const num = parseFloat(next)
      if (!isNaN(num)) {
        setValue('amount', formatNumber(Math.round(num)))
      } else {
        setValue('amount', next)
      }
    } else {
      setValue('amount', next)
    }
  }, [amountRaw, currency, setValue])

  const handleKeypadDelete = useCallback(() => {
    if (!amountRaw) return
    let next: string
    if (amountRaw.endsWith(' ')) {
      next = amountRaw.slice(0, -3)
    } else {
      next = amountRaw.slice(0, -1)
    }
    const raw = next.replace(/,/g, '')
    if (!raw.includes('+') && !raw.includes('-') && currency === 'KRW' && raw) {
      const num = parseFloat(raw)
      if (!isNaN(num)) {
        setValue('amount', formatNumber(Math.round(num)))
        return
      }
    }
    setValue('amount', next)
  }, [amountRaw, currency, setValue])

  const handleCalculate = useCallback(() => {
    const result = evaluateExpression(amountRaw || '0')
    if (result > 0) {
      setValue('amount', currency === 'KRW' ? String(Math.round(result)) : result.toFixed(2))
    }
  }, [amountRaw, currency, setValue])

  return {
    form,
    exchangeRate,
    amountNum,
    hasExpression,
    handleKeypadInput,
    handleKeypadDelete,
    handleCalculate
  }
}
