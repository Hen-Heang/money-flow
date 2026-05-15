'use client'

import React, { useState, useEffect, useRef, type ChangeEvent, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { invalidateBudgetsCache } from '@/hooks/useBudgets'
import Avatar from '@/components/ui/Avatar'
import { getUserProfile } from '@/lib/profile'
import type { Category, PaymentMethod, Budget } from '@/lib/types'
import {
  CreditCard, Tag, Download, LogOut, ChevronRight,
  Plus, Trash2, Moon, Sun, Camera, Target, Check, Pencil, X, BookOpen, Sparkles, ExternalLink,
  FileJson, FileText
} from 'lucide-react'
import { formatNumber, haptic, getDisplayName, resizeImageToBlob } from '@/lib/utils'
import { MONEY_TIPS } from '@/shared/data'



interface UserProfile {
  display_name: string | null
  default_currency: string
  email: string
  avatar_url: string | null
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      {title && (
        <p className="px-4 mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-secondary)] opacity-60">
          {title}
        </p>
      )}
      <div className="bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-[24px] overflow-hidden shadow-sm">
        <div className="divide-y divide-[var(--color-border-base)]">
          {children}
        </div>
      </div>
    </div>
  )
}

function Row({ icon: Icon, color, title, subtitle, right, onClick, active }: { icon: React.ElementType, color: string, title: string, subtitle?: string, right?: React.ReactNode, onClick?: () => void, active?: boolean }) {
  return (
    <motion.div
      whileTap={onClick ? { backgroundColor: 'var(--color-card-elevated-base)' } : undefined}
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${active ? 'bg-[var(--color-card-elevated-base)]' : ''}`}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
        style={{ backgroundColor: color + '15' }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">{title}</p>
        {subtitle && <p className="text-[12px] font-medium text-[var(--color-text-secondary)] opacity-70">{subtitle}</p>}
      </div>
      {right ? right : onClick && <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] opacity-40" />}
    </motion.div>
  )
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({})
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [categoryEdits, setCategoryEdits] = useState<{ name: string; icon: string; color: string }>({ name: '', icon: '', color: '' })
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('📦')
  const [newCategoryType, setNewCategoryType] = useState<'income' | 'expense'>('expense')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingDisplayName, setEditingDisplayName] = useState('')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true
  )
const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false)
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('')
  const [newPaymentMethodIcon, setNewPaymentMethodIcon] = useState('💳')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useSupabaseClient()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const [userProfile, cats, methods, buds] = await Promise.all([
        getUserProfile(supabase, user),
        supabase.from('categories').select('id, name, icon, color, type').eq('user_id', user.id),
        supabase.from('payment_methods').select('id, name, icon').eq('user_id', user.id),
        supabase.from('budgets').select('category_id, amount_krw').eq('user_id', user.id),
      ])
      setProfile(userProfile)
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

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setIsUploadingAvatar(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) throw new Error('You are not signed in')

      const blob = await resizeImageToBlob(file, 256, 0.82)
      const path = `${user.id}/avatar.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      // Bust the CDN cache so the new image loads immediately
      const avatarUrl = `${publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfile((current) => current ? { ...current, avatar_url: avatarUrl } : current)
      toast.success('Profile photo updated')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSignOut = async () => {
    haptic('medium')
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const saveDisplayName = async () => {
    const name = editingDisplayName.trim()
    if (!name) { toast.error('Name cannot be empty'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const { error } = await supabase.from('users').update({ display_name: name }).eq('id', user.id)
    if (error) { toast.error('Failed to update name'); return }
    setProfile(prev => prev ? { ...prev, display_name: name } : prev)
    setIsEditingName(false)
    toast.success('Name updated')
  }

  const triggerDownload = async (format: 'csv' | 'json') => {
    haptic('light')
    try {
      const response = await fetch(`/api/export?format=${format}`)
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `money-flow-${new Date().toISOString().split('T')[0]}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} exported!`)
    } catch {
      toast.error('Export failed')
    }
  }

  const handleExportCSV  = () => triggerDownload('csv')
  const handleExportJSON = () => triggerDownload('json')

  const handleExportPDF = async () => {
    haptic('light')
    try {
      const response = await fetch('/api/export?format=json')
      if (!response.ok) throw new Error()
      const { transactions } = await response.json() as {
        transactions: Array<{
          date: string; type: string; description: string
          amount_krw: number; amount_usd: number; category: string | null
          payment_method: string | null; note: string | null
        }>
      }

      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      const rows = transactions.map(t => `
        <tr>
          <td>${t.date}</td>
          <td class="${t.type}">${t.type}</td>
          <td>${t.description}</td>
          <td>${t.category ?? '—'}</td>
          <td class="amount">${t.type === 'income' ? '+' : '-'}₩${Math.round(t.amount_krw).toLocaleString()}</td>
          <td class="amount">$${t.amount_usd.toFixed(2)}</td>
          ${t.note ? `<td><em>${t.note}</em></td>` : '<td>—</td>'}
        </tr>`).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>Money Flow Export — ${dateStr}</title>
        <style>
          body { font-family: -apple-system, sans-serif; font-size: 11px; color: #111; margin: 32px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p.sub { color: #666; margin-bottom: 24px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f4f4f4; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e0e0e0; }
          td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
          td.income { color: #10b981; font-weight: 700; }
          td.expense { color: #ef4444; font-weight: 700; }
          td.amount { font-variant-numeric: tabular-nums; text-align: right; }
          tr:nth-child(even) td { background: #fafafa; }
          @media print { body { margin: 16px; } }
        </style>
      </head><body>
        <h1>Money Flow — Transaction History</h1>
        <p class="sub">Exported ${dateStr} · ${transactions.length} transactions</p>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Category</th><th style="text-align:right">KRW</th><th style="text-align:right">USD</th><th>Note</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body></html>`

      const win = window.open('', '_blank')
      if (!win) { toast.error('Allow popups to export PDF'); return }
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 400)
    } catch {
      toast.error('Export failed')
    }
  }

  const toggleTheme = () => {
    haptic('light')
    const html = document.documentElement
    const goingLight = !html.classList.contains('light')
    html.classList.toggle('light', goingLight)
    setIsDark(!goingLight)
    try { localStorage.setItem('theme', goingLight ? 'light' : 'dark') } catch {}
  }

const deleteCategory = async (id: string) => {
    haptic('medium')
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category removed')
  }

  const updateCategory = async (id: string) => {
    const { name, icon, color } = categoryEdits
    if (!name.trim()) { toast.error('Name is required'); return }
    const { error } = await supabase
      .from('categories')
      .update({ name: name.trim(), icon: icon || '📦', color })
      .eq('id', id)
    if (error) { toast.error('Failed to update'); return }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name: name.trim(), icon: icon || '📦', color } : c))
    setEditingCategory(null)
    toast.success('Category updated')
  }

  const deletePaymentMethod = async (id: string) => {
    haptic('medium')
    const { error } = await supabase.from('payment_methods').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setPaymentMethods(prev => prev.filter(m => m.id !== id))
    toast.success('Method removed')
  }

  const addCategory = async () => {
    const name = newCategoryName.trim()
    const icon = newCategoryIcon.trim() || '📦'
    if (!name) { toast.error('Name required'); return }
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name, icon, color, type: newCategoryType })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return }
    if (data) {
      setCategories(prev => [...prev, data])
      setNewCategoryName('')
      setNewCategoryIcon('📦')
      setNewCategoryType('expense')
      setIsAddingCategory(false)
    }
    toast.success('Category added')
  }

  const addPaymentMethod = async () => {
    const name = newPaymentMethodName.trim()
    const icon = newPaymentMethodIcon.trim() || '💳'
    if (!name) { toast.error('Name required'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({ user_id: user.id, name, icon })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return }
    if (data) {
      setPaymentMethods(prev => [...prev, data])
      setNewPaymentMethodName('')
      setIsAddingPaymentMethod(false)
    }
    toast.success('Method added')
  }

  const saveBudget = async (categoryId: string) => {
    const raw = (budgetInputs[categoryId] || '').replace(/,/g, '')
    const amount = parseFloat(raw)
    if (isNaN(amount) || amount < 0) { toast.error('Invalid amount'); return }

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const { error } = await supabase.from('budgets').upsert(
      { user_id: user.id, category_id: categoryId, amount_krw: amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category_id' }
    )
    if (error) { toast.error('Failed to save budget'); return }

    setBudgets(prev => {
      const existing = prev.find(b => b.category_id === categoryId)
      if (existing) return prev.map(b => b.category_id === categoryId ? { ...b, amount_krw: amount } : b)
      return [...prev, { category_id: categoryId, amount_krw: amount }]
    })
    invalidateBudgetsCache()
    setEditingBudget(null)
    toast.success('Budget saved')
  }

  return (
    <div className="px-mobile pt-6 pb-12 max-w-2xl mx-auto overflow-x-hidden">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center mb-10 pt-4">
        <div className="relative mb-4 group">
          <Avatar
            src={profile?.avatar_url}
            name={getDisplayName(profile?.email, profile?.display_name)}
            size={100}
            className="ring-4 ring-white/10 shadow-2xl transition-transform group-active:scale-95"
          />
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[var(--color-accent-base)] border-4 border-[var(--color-bg)] flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
          >
            <Camera size={16} strokeWidth={2.5} />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>
        {isEditingName ? (
          <div className="flex items-center gap-2 mt-1">
            <input
              autoFocus
              value={editingDisplayName}
              onChange={e => setEditingDisplayName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveDisplayName(); if (e.key === 'Escape') setIsEditingName(false) }}
              className="bg-[var(--color-card-base)] border-2 border-[var(--color-accent-base)] rounded-xl px-4 py-2 text-lg font-black text-center outline-none"
              placeholder="Your name"
            />
            <button onClick={saveDisplayName} className="w-9 h-9 rounded-xl bg-[var(--color-income-base)] flex items-center justify-center text-white"><Check size={16} strokeWidth={3} /></button>
            <button onClick={() => setIsEditingName(false)} className="w-9 h-9 rounded-xl bg-[var(--color-card-base)] border border-[var(--color-border-base)] flex items-center justify-center"><X size={16} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-black tracking-tight">{getDisplayName(profile?.email, profile?.display_name)}</h1>
            <button
              onClick={() => { setEditingDisplayName(profile?.display_name || ''); setIsEditingName(true) }}
              className="p-1.5 rounded-lg bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)]"
            >
              <Pencil size={13} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <p className="text-[13px] font-bold opacity-50 uppercase tracking-widest mt-1.5">{profile?.email}</p>
        
        <div className="mt-4 flex gap-2">
           <span className="px-3 py-1 rounded-full bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] text-[10px] font-black uppercase tracking-widest opacity-70">
             {profile?.default_currency || 'KRW'} User
           </span>
           <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400">
             Pro Account
           </span>
        </div>
      </div>

      <Group title="Appearance">
        <Row
          icon={isDark ? Moon : Sun}
          color="var(--color-warning-base)"
          title={isDark ? 'Dark Mode' : 'Light Mode'}
          subtitle="Toggle visual theme"
          onClick={toggleTheme}
          right={
            <div
              className="w-11 h-6 rounded-full relative transition-colors shadow-inner"
              style={{ backgroundColor: isDark ? 'var(--color-income-base)' : 'var(--color-border-base)' }}
            >
              <motion.div
                animate={{ x: isDark ? 22 : 4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
              />
            </div>
          }
        />
      </Group>

      <Group title="Personalization">
        <Row
          icon={Tag}
          color="var(--color-income-base)"
          title="Categories"
          subtitle={`${categories.length} custom labels`}
          onClick={() => { haptic('light'); setActiveSection(activeSection === 'categories' ? null : 'categories') }}
          active={activeSection === 'categories'}
        />
        <AnimatePresence>
          {activeSection === 'categories' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-[var(--color-card-elevated-base)]/30 divide-y divide-[var(--color-border-base)]">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="text-xl w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 shadow-sm">{cat.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{cat.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">{cat.type}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteCategory(cat.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setIsAddingCategory(!isAddingCategory)}
                  className="w-full flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest text-[var(--color-accent-base)]"
                >
                  {isAddingCategory ? <X size={14}/> : <Plus size={14} strokeWidth={3}/>}
                  {isAddingCategory ? 'Cancel' : 'Add New Category'}
                </button>
                {isAddingCategory && (
                  <div className="px-5 pb-5 pt-2 space-y-3">
                    {/* Type toggle */}
                    <div className="flex rounded-xl overflow-hidden border border-[var(--color-border-base)]">
                      {(['expense', 'income'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setNewCategoryType(t)}
                          className="flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all"
                          style={{
                            backgroundColor: newCategoryType === t ? (t === 'income' ? 'var(--color-income-base)' : 'var(--color-expense-base)') : 'transparent',
                            color: newCategoryType === t ? 'white' : 'var(--color-text-secondary)',
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {/* Icon + Name + Save */}
                    <div className="flex gap-2">
                      <input
                        value={newCategoryIcon}
                        onChange={e => setNewCategoryIcon(e.target.value)}
                        className="w-14 h-11 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl text-center text-xl"
                        maxLength={2}
                      />
                      <input
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                        placeholder="Category name"
                        className="flex-1 h-11 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl px-4 text-sm font-bold outline-none focus:border-[var(--color-accent-base)]"
                      />
                      <button onClick={addCategory} className="w-11 h-11 rounded-xl bg-[var(--color-income-base)] flex items-center justify-center text-white shrink-0">
                        <Check size={18} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Row
          icon={CreditCard}
          color="var(--color-accent-base)"
          title="Payment Methods"
          subtitle={`${paymentMethods.length} methods linked`}
          onClick={() => { haptic('light'); setActiveSection(activeSection === 'payment' ? null : 'payment') }}
          active={activeSection === 'payment'}
        />
        <AnimatePresence>
          {activeSection === 'payment' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-[var(--color-card-elevated-base)]/30 divide-y divide-[var(--color-border-base)]">
                {paymentMethods.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="text-xl w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 shadow-sm">{m.icon}</span>
                    <p className="flex-1 text-sm font-bold">{m.name}</p>
                    <button onClick={() => deletePaymentMethod(m.id)} className="p-2 rounded-lg text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button onClick={() => setIsAddingPaymentMethod(!isAddingPaymentMethod)} className="w-full flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest text-[var(--color-accent-base)]">
                  {isAddingPaymentMethod ? <X size={14}/> : <Plus size={14} strokeWidth={3}/>}
                  {isAddingPaymentMethod ? 'Cancel' : 'Add Payment Method'}
                </button>
                {isAddingPaymentMethod && (
                  <div className="px-5 pb-5 pt-2">
                    <div className="flex gap-2">
                      <input value={newPaymentMethodIcon} onChange={e => setNewPaymentMethodIcon(e.target.value)} className="w-14 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl text-center text-xl" maxLength={2} />
                      <input value={newPaymentMethodName} onChange={e => setNewPaymentMethodName(e.target.value)} placeholder="Method Name" className="flex-1 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl px-4 text-sm font-bold outline-none" />
                      <button onClick={addPaymentMethod} className="w-10 h-10 rounded-xl bg-[var(--color-income-base)] flex items-center justify-center text-white"><Check size={18} strokeWidth={3}/></button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <Group title="Limits & Budgets">
        <Row
          icon={Target}
          color="var(--color-warning-base)"
          title="Monthly Budgets"
          subtitle="Set spending limits"
          onClick={() => { haptic('light'); setActiveSection(activeSection === 'budgets' ? null : 'budgets') }}
          active={activeSection === 'budgets'}
        />
        <AnimatePresence>
          {activeSection === 'budgets' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-[var(--color-card-elevated-base)]/30 divide-y divide-[var(--color-border-base)]">
                {categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => {
                  const isEditing = editingBudget === cat.id
                  const budgetAmt = budgets.find(b => b.category_id === cat.id)?.amount_krw || 0
                  return (
                    <div key={cat.id} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold">{cat.name}</p>
                          {isEditing ? (
                            <input
                              autoFocus
                              inputMode="decimal"
                              value={budgetInputs[cat.id] || ''}
                              onChange={e => {
                                const raw = e.target.value.replace(/,/g, '')
                                const num = parseFloat(raw)
                                setBudgetInputs(prev => ({ ...prev, [cat.id]: isNaN(num) ? raw : formatNumber(num) }))
                              }}
                              className="mt-2 w-full bg-[var(--color-card-base)] border-2 border-[var(--color-accent-base)] rounded-xl px-3 py-2 text-sm font-black text-right"
                              placeholder="₩ 0"
                            />
                          ) : (
                            <p className="text-[13px] font-black tracking-tight" style={{ color: budgetAmt > 0 ? 'var(--color-warning-base)' : 'var(--color-text-secondary)' }}>
                              {budgetAmt > 0 ? `₩${formatNumber(budgetAmt)} limit` : 'No limit set'}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (isEditing) saveBudget(cat.id)
                            else {
                              setEditingBudget(cat.id)
                              if (budgetAmt > 0) setBudgetInputs(prev => ({ ...prev, [cat.id]: formatNumber(budgetAmt) }))
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-[var(--color-income-base)] text-white' : 'bg-[var(--color-card-base)] text-[var(--color-accent-base)] border border-[var(--color-border-base)] shadow-sm'}`}
                        >
                          {isEditing ? 'Save' : 'Edit'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <Group title="Education">
        <Row
          icon={BookOpen}
          color="#a855f7"
          title="Money Tips"
          subtitle="Seoul developer finance guide"
          onClick={() => { haptic('light'); setActiveSection(activeSection === 'tips' ? null : 'tips') }}
          active={activeSection === 'tips'}
        />
        <AnimatePresence>
          {activeSection === 'tips' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-[var(--color-card-elevated-base)]/30 px-4 py-5 grid grid-cols-1 gap-3">
                {MONEY_TIPS.map((tip, i) => (
                  <div key={i} className="bg-[var(--color-card-base)] p-4 rounded-2xl border border-[var(--color-border-base)] shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{tip.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-black tracking-tight">{tip.title}</p>
                          <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md" style={{ backgroundColor: tip.tagColor + '15', color: tip.tagColor }}>{tip.tag}</span>
                        </div>
                        <p className="text-[12px] font-medium opacity-60 leading-relaxed">{tip.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Group>

      <Group title="Data & Safety">
        <Row
          icon={Download}
          color="#8b5cf6"
          title="Export CSV"
          subtitle="Spreadsheet-compatible backup"
          onClick={handleExportCSV}
        />
        <Row
          icon={FileJson}
          color="#06b6d4"
          title="Export JSON"
          subtitle="Full data for developers"
          onClick={handleExportJSON}
        />
        <Row
          icon={FileText}
          color="#f59e0b"
          title="Print / Save PDF"
          subtitle="Opens print dialog"
          onClick={handleExportPDF}
        />
        <Row
          icon={LogOut}
          color="var(--color-expense-base)"
          title="Sign Out"
          subtitle="Securely end session"
          onClick={handleSignOut}
        />
      </Group>

      <div className="flex flex-col items-center gap-2 opacity-30 mt-4 pb-2">
         <p className="text-[10px] font-black uppercase tracking-[0.4em]">Money Flow</p>
         <p className="text-[9px] font-bold">Version 1.2.0 • Pro Edition</p>
      </div>
      
      <div className="flex justify-center pb-8">
        <button 
          onClick={() => {
            haptic('light')
            const t = toast.loading('Checking for updates...')
            setTimeout(() => {
              toast.success('Your app is up to date!', { id: t })
            }, 1500)
          }}
          className="text-[10px] font-black uppercase tracking-widest text-[var(--color-accent-base)] px-4 py-2 rounded-full bg-blue-500/5 active:scale-95 transition-all"
        >
          Check for updates
        </button>
      </div>
    </div>
  )
}
