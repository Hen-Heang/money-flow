'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { invalidateBudgetsCache } from '@/hooks/useBudgets'
import { getUserProfile } from '@/lib/profile'
import { formatNumber } from '@/lib/utils'
import type { AIProvider } from '@/lib/ai-provider'
import type { Category, PaymentMethod, Budget } from '@/lib/types'
import type { UserProfile } from '../_types'

export function useSettingsData() {
  const supabase = useSupabaseClient()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({})
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini')
  const [telegramLinked, setTelegramLinked] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const [userProfile, cats, methods, buds, aiPref] = await Promise.all([
        getUserProfile(supabase, user),
        supabase.from('categories').select('id, name, icon, color, type').eq('user_id', user.id),
        supabase.from('payment_methods').select('id, name, icon').eq('user_id', user.id),
        supabase.from('budgets').select('category_id, amount_krw').eq('user_id', user.id),
        supabase.from('users').select('ai_provider').eq('id', user.id).single(),
      ])
      setProfile(userProfile)
      if (aiPref.data?.ai_provider) setAiProvider(aiPref.data.ai_provider as AIProvider)

      // Telegram link status (best-effort)
      try {
        const res = await fetch('/api/telegram/link')
        if (res.ok) {
          const { linked } = await res.json() as { linked: boolean }
          setTelegramLinked(linked)
        }
      } catch {}

      if (cats.data) setCategories(cats.data)
      if (methods.data) setPaymentMethods(methods.data)
      if (buds.data) {
        setBudgets(buds.data as Budget[])
        const inputs: Record<string, string> = {}
        buds.data.forEach((b: Budget) => {
          inputs[b.category_id] = formatNumber(b.amount_krw)
        })
        setBudgetInputs(inputs)
      }
    }
    load()
  }, [supabase])

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category removed')
  }

  const addCategory = async (name: string, icon: string, type: 'income' | 'expense') => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return false

    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name, icon, color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'), type })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return false }
    if (data) setCategories(prev => [...prev, data])
    toast.success('Category added')
    return true
  }

  const deletePaymentMethod = async (id: string) => {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setPaymentMethods(prev => prev.filter(m => m.id !== id))
    toast.success('Method removed')
  }

  const addPaymentMethod = async (name: string, icon: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return false

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({ user_id: user.id, name, icon })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return false }
    if (data) setPaymentMethods(prev => [...prev, data])
    toast.success('Method added')
    return true
  }

  const saveBudget = async (categoryId: string, amount: number) => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return false

    const { error } = await supabase.from('budgets').upsert(
      { user_id: user.id, category_id: categoryId, amount_krw: amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category_id' }
    )
    if (error) { toast.error('Failed to save budget'); return false }

    setBudgets(prev => {
      const existing = prev.find(b => b.category_id === categoryId)
      if (existing) return prev.map(b => b.category_id === categoryId ? { ...b, amount_krw: amount } : b)
      return [...prev, { category_id: categoryId, amount_krw: amount }]
    })
    invalidateBudgetsCache()
    toast.success('Budget saved')
    return true
  }

  const [aiSwitching, setAiSwitching] = useState(false)
  const switchAIProvider = async (provider: AIProvider) => {
    if (provider === aiProvider) return
    setAiSwitching(true)
    try {
      const res = await fetch('/api/settings/ai-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      if (!res.ok) throw new Error()
      setAiProvider(provider)
      const providerLabel = provider === 'openai'
        ? 'OpenAI GPT-5.6'
        : provider === 'ling'
          ? 'Ling 3.0 Tiny'
          : 'Google Gemini'
      toast.success(`Switched to ${providerLabel}`)
    } catch {
      toast.error('Failed to switch AI provider')
    } finally {
      setAiSwitching(false)
    }
  }

  return {
    profile, setProfile,
    categories, paymentMethods, budgets, budgetInputs, setBudgetInputs,
    aiProvider, aiSwitching, switchAIProvider,
    telegramLinked, setTelegramLinked,
    deleteCategory, addCategory,
    deletePaymentMethod, addPaymentMethod,
    saveBudget,
  }
}
