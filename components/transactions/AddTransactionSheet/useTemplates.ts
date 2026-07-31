import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { haptic } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form'
import type { TransactionFormData } from '@/hooks/useTransactionForm'
import type { Template } from './types'

export function useTemplates({
  supabase,
  activeExchangeRate,
  amountNum,
  getValues,
  setValue,
}: {
  supabase: SupabaseClient
  activeExchangeRate: number
  amountNum: number
  getValues: UseFormGetValues<TransactionFormData>
  setValue: UseFormSetValue<TransactionFormData>
}) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [savingTemplate, setSavingTemplate] = useState(false)

  const loadTemplates = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { data } = await supabase
      .from('transaction_templates')
      .select('*, categories(icon)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) setTemplates(data as Template[])
  }, [supabase])

  const applyTemplate = (t: Template) => {
    haptic('light')
    setValue('type', t.type)
    setValue('currency', t.currency as 'KRW' | 'USD')
    setValue('amount', t.currency === 'USD' ? (t.amount_krw / activeExchangeRate).toFixed(2) : String(Math.round(t.amount_krw)))
    setValue('description', t.description)
    setValue('category_id', t.category_id || '')
    setValue('payment_method_id', t.payment_method_id || '')
    setValue('note', t.note || '')
  }

  const saveAsTemplate = async () => {
    if (amountNum <= 0) { toast.error('Enter an amount first'); return }
    const values = getValues()
    if (!values.description.trim()) { toast.error('Enter a description first'); return }
    setSavingTemplate(true)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setSavingTemplate(false); return }
    const amtKrw = values.currency === 'USD' ? Math.round(amountNum * activeExchangeRate) : amountNum
    const { error } = await supabase.from('transaction_templates').insert({
      user_id: user.id,
      type: values.type,
      description: values.description.trim(),
      amount_krw: amtKrw,
      currency: values.currency,
      category_id: values.category_id || null,
      payment_method_id: values.payment_method_id || null,
      note: values.note || null,
    })
    setSavingTemplate(false)
    if (error) { toast.error('Failed to save template'); return }
    haptic('medium')
    toast.success('Template saved!')
    loadTemplates()
  }

  const deleteTemplate = async (id: string) => {
    await supabase.from('transaction_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    haptic('light')
  }

  return { templates, savingTemplate, loadTemplates, applyTemplate, saveAsTemplate, deleteTemplate }
}
