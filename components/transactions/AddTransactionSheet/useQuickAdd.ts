import { useState } from 'react'
import { toast } from 'sonner'
import { haptic } from '@/lib/utils'
import type { UseFormSetValue } from 'react-hook-form'
import type { TransactionFormData } from '@/hooks/useTransactionForm'
import type { TransactionPreview } from '@/lib/types'

export function useQuickAdd({
  isMobile,
  setValue,
  setShowKeypad,
  setShowDetails,
}: {
  isMobile: boolean
  setValue: UseFormSetValue<TransactionFormData>
  setShowKeypad: (v: boolean) => void
  setShowDetails: (v: boolean) => void
}) {
  const [quickAddText, setQuickAddText] = useState('')
  const [quickAddPreview, setQuickAddPreview] = useState<TransactionPreview | null>(null)
  const [quickAddError, setQuickAddError] = useState('')
  const [isQuickAddLoading, setIsQuickAddLoading] = useState(false)

  const resetQuickAdd = () => {
    setQuickAddText('')
    setQuickAddPreview(null)
    setQuickAddError('')
  }

  const parseQuickAdd = async () => {
    const text = quickAddText.trim()
    if (text.length < 3) {
      setQuickAddError('Include what it was and the amount.')
      return
    }

    setIsQuickAddLoading(true)
    setQuickAddError('')
    setQuickAddPreview(null)
    if (isMobile) setShowKeypad(false)

    try {
      const response = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.preview) {
        throw new Error(body.error || 'AI quick add is unavailable right now.')
      }
      setQuickAddPreview(body.preview as TransactionPreview)
      haptic('light')
    } catch (error) {
      setQuickAddError(error instanceof Error ? error.message : 'AI quick add is unavailable right now.')
    } finally {
      setIsQuickAddLoading(false)
    }
  }

  const applyQuickAddPreview = () => {
    if (!quickAddPreview) return
    setValue('type', quickAddPreview.type)
    setValue('currency', quickAddPreview.currency)
    setValue('amount', String(quickAddPreview.amount))
    setValue('date', quickAddPreview.date)
    setValue('description', quickAddPreview.description)
    setValue('category_id', quickAddPreview.categoryId || '')
    setValue('payment_method_id', quickAddPreview.paymentMethodId || '')
    setValue('note', quickAddPreview.note || '')
    if (quickAddPreview.paymentMethodId || quickAddPreview.note) setShowDetails(true)
    setQuickAddPreview(null)
    setQuickAddText('')
    setQuickAddError('')
    haptic('medium')
    toast.success('Preview applied — review and save')
  }

  return {
    quickAddText, setQuickAddText,
    quickAddPreview, setQuickAddPreview,
    quickAddError, setQuickAddError,
    isQuickAddLoading,
    resetQuickAdd,
    parseQuickAdd,
    applyQuickAddPreview,
  }
}
