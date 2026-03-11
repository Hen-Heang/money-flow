'use client'

import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase'
import Avatar from '@/components/ui/Avatar'
import { getUserProfile } from '@/lib/profile'
import {
  CreditCard, Tag, Download, LogOut, ChevronRight,
  Plus, Trash2, Moon, Sun, Camera, Target, Check, Pencil, X, BookOpen,
} from 'lucide-react'

const MONEY_TIPS = [
  {
    emoji: '📊',
    title: '50 / 30 / 20 Rule',
    desc: 'Split every paycheck: 50% on needs (rent, food, transport), 30% on wants (eating out, entertainment), 20% straight to savings. On ₩1.2M that\'s ₩240,000 saved every month.',
    tag: 'Framework',
    tagColor: '#3b82f6',
  },
  {
    emoji: '🤖',
    title: 'Pay Yourself First',
    desc: 'The moment your salary lands, transfer your savings target before spending anything. Treat it like rent — non-negotiable. What\'s left is what you can spend.',
    tag: 'Habit',
    tagColor: '#10b981',
  },
  {
    emoji: '🚨',
    title: 'Emergency Fund Before Everything',
    desc: 'Before investing a single won, save 3 months of living expenses in cash. In Seoul that\'s roughly ₩3,000,000–₩4,500,000. This is your financial safety net.',
    tag: 'Priority',
    tagColor: '#ef4444',
  },
  {
    emoji: '⏳',
    title: '24-Hour Rule',
    desc: 'Any non-essential purchase over ₩50,000 — wait 24 hours. Most impulse buys disappear. Rich people are rich partly because they delay gratification.',
    tag: 'Habit',
    tagColor: '#8b5cf6',
  },
  {
    emoji: '🚇',
    title: 'Seoul Transport: Use T-money',
    desc: 'Bus + metro costs ₩100,000–₩150,000/month with a T-money card. Avoid taxis (especially Kakao Black). That\'s ₩50,000–₩100,000 saved vs riding taxis.',
    tag: 'Seoul',
    tagColor: '#06b6d4',
  },
  {
    emoji: '🍱',
    title: 'Cut Delivery Apps',
    desc: '배민/쿠팡이츠 adds a ₩3,000–₩6,000 fee per order + inflated prices. Cooking twice a week or eating at nearby 식당 (₩7,000–₩9,000) saves ₩80,000+/month.',
    tag: 'Seoul',
    tagColor: '#06b6d4',
  },
  {
    emoji: '🏠',
    title: 'Live Outside Gangnam',
    desc: 'A studio in Mapo, Seongbuk, or Dobong costs ₩300,000–₩400,000 less/month than Gangnam/Hongdae. Over a year that\'s ₩3,600,000+ in savings.',
    tag: 'Seoul',
    tagColor: '#06b6d4',
  },
  {
    emoji: '💻',
    title: 'Your Skills Are Your Best Investment',
    desc: 'As a dev, one freelance project or a skill upgrade (cloud, AI, mobile) can add 30–50% to your income. ₩900 USD won\'t stay ₩900 USD — keep leveling up.',
    tag: 'Career',
    tagColor: '#10b981',
  },
  {
    emoji: '📈',
    title: 'Invest the 20% in Index Funds',
    desc: 'Once emergency fund is full, invest consistently in low-cost ETFs. KODEX S&P500TR (Korean exchange) or buy SPY/QQQ via Toss or Kakao Securities. Time in market beats timing the market.',
    tag: 'Investing',
    tagColor: '#f59e0b',
  },
  {
    emoji: '🎯',
    title: 'Zero-Based Budgeting',
    desc: 'Assign every won a job before the month starts: Income − All assigned spending = ₩0. Forces intentional spending. Use the budget feature in this app per category.',
    tag: 'Framework',
    tagColor: '#3b82f6',
  },
]
import { formatNumber } from '@/lib/utils'
import { getDisplayName, resizeImageToDataUrl } from '@/lib/utils'

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: 'income' | 'expense' | 'both'
}

interface PaymentMethod {
  id: string
  name: string
  icon: string
}

interface Budget {
  category_id: string
  amount_krw: number
}

interface UserProfile {
  display_name: string | null
  default_currency: string
  email: string
  avatar_url: string | null
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
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userProfile = await getUserProfile(supabase, user)
      setProfile(userProfile)

      const [cats, methods, buds] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('payment_methods').select('*').eq('user_id', user.id),
        supabase.from('budgets').select('category_id, amount_krw').eq('user_id', user.id),
      ])
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      const avatarUrl = await resizeImageToDataUrl(file, 256, 0.82)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You are not signed in')

      const { data: updatedProfileData, error } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
        .select('*')
        .single()

      const data = updatedProfileData as UserProfile | null

      if (error) throw error

      setProfile((current) => {
        return data || current
      })
      toast.success('Profile photo updated')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/export')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `money-flow-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exported successfully!')
    } catch {
      toast.error('Export failed')
    }
  }

  const toggleTheme = () => {
    const html = document.documentElement
    const goingLight = !html.classList.contains('light')
    html.classList.toggle('light', goingLight)
    setIsDark(!goingLight)
    try { localStorage.setItem('theme', goingLight ? 'light' : 'dark') } catch {}
  }

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category deleted')
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
    toast.success('Category updated!')
  }

  const deletePaymentMethod = async (id: string) => {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setPaymentMethods(prev => prev.filter(m => m.id !== id))
    toast.success('Payment method deleted')
  }

  const addCategory = async () => {
    const name = newCategoryName.trim()
    const icon = newCategoryIcon.trim() || '📦'
    if (!name) { toast.error('Category name is required'); return }
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name, icon, color, type: 'expense' })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return }
    if (data) {
      setCategories(prev => [...prev, data])
      setNewCategoryName('')
      setNewCategoryIcon('📦')
      setIsAddingCategory(false)
    }
    toast.success('Category added!')
  }

  const addPaymentMethod = async () => {
    const name = newPaymentMethodName.trim()
    const icon = newPaymentMethodIcon.trim() || '💳'
    if (!name) { toast.error('Payment method name is required'); return }
    const { data: { user } } = await supabase.auth.getUser()
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
      setNewPaymentMethodIcon('💳')
      setIsAddingPaymentMethod(false)
    }
    toast.success('Payment method added!')
  }

  const saveBudget = async (categoryId: string) => {
    const raw = (budgetInputs[categoryId] || '').replace(/,/g, '')
    const amount = parseFloat(raw)
    if (isNaN(amount) || amount < 0) { toast.error('Invalid amount'); return }

    const { data: { user } } = await supabase.auth.getUser()
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
    setEditingBudget(null)
    toast.success('Budget saved!')
  }

  const sectionStyle = {
    backgroundColor: 'color-mix(in srgb, var(--color-card-base) 92%, transparent)',
    border: '1px solid color-mix(in srgb, var(--color-border-base) 90%, white 10%)',
    boxShadow: '0 8px 22px rgba(0,0,0,0.14)',
    borderRadius: '16px',
    overflow: 'hidden',
    marginBottom: '16px',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--color-border-base)',
    cursor: 'pointer',
    transition: 'background-color 0.18s ease',
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Settings
      </motion.h1>

      {/* Profile */}
      <div style={sectionStyle}>
        <div style={{ ...rowStyle, borderBottom: 'none', cursor: 'default' }}>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="relative shrink-0"
          >
            <Avatar
              src={profile?.avatar_url}
              name={getDisplayName(profile?.email, profile?.display_name)}
              size={52}
              className="ring-1 ring-white/10"
            />
            <div
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-accent-base)', border: '2px solid var(--color-card-base)' }}
            >
              <Camera className="h-3.5 w-3.5 text-white" />
            </div>
          </button>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {profile?.email || 'Loading...'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Default currency: {profile?.default_currency || 'KRW'}
            </p>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="mt-2 text-xs font-medium"
              style={{ color: 'var(--color-accent-base)' }}
            >
              {isUploadingAvatar ? 'Uploading photo...' : 'Upload profile photo'}
            </button>
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Appearance */}
      <div style={sectionStyle}>
        <div
          style={{ ...rowStyle, borderBottom: 'none', cursor: 'default' }}
          onClick={toggleTheme}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}
          >
            {isDark ? (
              <Moon className="w-5 h-5" style={{ color: 'var(--color-warning-base)' }} />
            ) : (
              <Sun className="w-5 h-5" style={{ color: 'var(--color-warning-base)' }} />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Tap to toggle</p>
          </div>
          <div
            className="w-12 h-6 rounded-full relative transition-colors"
            style={{ backgroundColor: isDark ? 'var(--color-income-base)' : 'var(--color-border-base)' }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
              style={{ transform: isDark ? 'translateX(24px)' : 'translateX(4px)' }}
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={sectionStyle}>
        <div
          style={{ ...rowStyle }}
          onClick={() => setActiveSection(activeSection === 'categories' ? null : 'categories')}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
          >
            <Tag className="w-5 h-5" style={{ color: 'var(--color-income-base)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Categories</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{categories.length} categories</p>
          </div>
          <ChevronRight
            className="w-4 h-4 transition-transform"
            style={{
              color: 'var(--color-text-secondary)',
              transform: activeSection === 'categories' ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {activeSection === 'categories' && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            {categories.map(cat => {
              const isEditing = editingCategory === cat.id
              return (
                <div
                  key={cat.id}
                  className="px-4 py-3"
                  style={{ borderTop: '1px solid var(--color-border-base)' }}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      {/* Icon + Color row */}
                      <div className="flex items-center gap-2">
                        <input
                          value={categoryEdits.icon}
                          onChange={e => setCategoryEdits(prev => ({ ...prev, icon: e.target.value }))}
                          placeholder="Emoji"
                          className="w-14 rounded-lg px-2 py-1.5 text-center focus:outline-none"
                          style={{
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-border-base)',
                            color: 'var(--color-text-primary)',
                            fontSize: '18px',
                          }}
                          maxLength={2}
                        />
                        <input
                          value={categoryEdits.name}
                          onChange={e => setCategoryEdits(prev => ({ ...prev, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') updateCategory(cat.id) }}
                          placeholder="Category name"
                          autoFocus
                          className="flex-1 rounded-lg px-3 py-1.5 focus:outline-none"
                          style={{
                            backgroundColor: 'var(--color-bg)',
                            border: '1px solid var(--color-accent-base)',
                            color: 'var(--color-text-primary)',
                            fontSize: '14px',
                          }}
                        />
                        <input
                          type="color"
                          value={categoryEdits.color}
                          onChange={e => setCategoryEdits(prev => ({ ...prev, color: e.target.value }))}
                          className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0.5"
                          style={{ backgroundColor: 'var(--color-bg)' }}
                          title="Pick color"
                        />
                      </div>
                      {/* Save / Cancel */}
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
                          style={{ backgroundColor: 'var(--color-card-elevated-base)', color: 'var(--color-text-secondary)' }}
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                        <button
                          onClick={() => updateCategory(cat.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-white"
                          style={{ backgroundColor: 'var(--color-income-base)' }}
                        >
                          <Check className="w-3 h-3" /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span
                        className="text-lg w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat.color + '26' }}
                      >
                        {cat.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{cat.type}</p>
                      </div>
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <button
                        onClick={() => {
                          setEditingCategory(cat.id)
                          setCategoryEdits({ name: cat.name, icon: cat.icon, color: cat.color })
                        }}
                        className="p-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-card-elevated-base)' }}
                      >
                        <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--color-accent-base)' }} />
                      </button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-full" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                        <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--color-expense-base)' }} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
            <button
              onClick={() => {
                setIsAddingCategory(prev => !prev)
                setNewCategoryName('')
                setNewCategoryIcon('📦')
              }}
              className="w-full flex items-center gap-3 px-4 py-3"
              style={{ borderTop: '1px solid var(--color-border-base)' }}
            >
              <Plus className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
              <span className="text-sm" style={{ color: 'var(--color-accent-base)' }}>
                {isAddingCategory ? 'Cancel' : 'Add Category'}
              </span>
            </button>
            {isAddingCategory && (
              <div className="space-y-2 px-4 pb-3" style={{ borderTop: '1px solid var(--color-border-base)' }}>
                <div className="flex items-center gap-2 pt-3">
                  <input
                    value={newCategoryIcon}
                    onChange={e => setNewCategoryIcon(e.target.value)}
                    className="w-14 rounded-lg px-2 py-2 text-center focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border-base)',
                      color: 'var(--color-text-primary)',
                      fontSize: '18px',
                    }}
                    maxLength={2}
                    placeholder="📦"
                  />
                  <input
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-accent-base)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder="Category name"
                  />
                  <button
                    onClick={addCategory}
                    className="rounded-full px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-income-base)' }}
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Payment Methods */}
      <div style={sectionStyle}>
        <div
          style={{ ...rowStyle }}
          onClick={() => setActiveSection(activeSection === 'payment' ? null : 'payment')}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
          >
            <CreditCard className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Payment Methods</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{paymentMethods.length} methods</p>
          </div>
          <ChevronRight
            className="w-4 h-4 transition-transform"
            style={{
              color: 'var(--color-text-secondary)',
              transform: activeSection === 'payment' ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {activeSection === 'payment' && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}>
            {paymentMethods.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: '1px solid var(--color-border-base)' }}
              >
                <span className="text-lg">{m.icon}</span>
                <p className="flex-1 text-sm" style={{ color: 'var(--color-text-primary)' }}>{m.name}</p>
                <button onClick={() => deletePaymentMethod(m.id)}>
                  <Trash2 className="w-4 h-4" style={{ color: 'var(--color-expense-base)' }} />
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                setIsAddingPaymentMethod(prev => !prev)
                setNewPaymentMethodName('')
                setNewPaymentMethodIcon('💳')
              }}
              className="w-full flex items-center gap-3 px-4 py-3"
              style={{ borderTop: '1px solid var(--color-border-base)' }}
            >
              <Plus className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
              <span className="text-sm" style={{ color: 'var(--color-accent-base)' }}>
                {isAddingPaymentMethod ? 'Cancel' : 'Add Payment Method'}
              </span>
            </button>
            {isAddingPaymentMethod && (
              <div className="space-y-2 px-4 pb-3" style={{ borderTop: '1px solid var(--color-border-base)' }}>
                <div className="flex items-center gap-2 pt-3">
                  <input
                    value={newPaymentMethodIcon}
                    onChange={e => setNewPaymentMethodIcon(e.target.value)}
                    className="w-14 rounded-lg px-2 py-2 text-center focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border-base)',
                      color: 'var(--color-text-primary)',
                      fontSize: '18px',
                    }}
                    maxLength={2}
                    placeholder="💳"
                  />
                  <input
                    value={newPaymentMethodName}
                    onChange={e => setNewPaymentMethodName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addPaymentMethod() }}
                    className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-accent-base)',
                      color: 'var(--color-text-primary)',
                    }}
                    placeholder="Payment method name"
                  />
                  <button
                    onClick={addPaymentMethod}
                    className="rounded-full px-3 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-income-base)' }}
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Monthly Budgets */}
      <div style={sectionStyle}>
        <div
          style={{ ...rowStyle }}
          onClick={() => setActiveSection(activeSection === 'budgets' ? null : 'budgets')}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)' }}
          >
            <Target className="w-5 h-5" style={{ color: 'var(--color-warning-base)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Monthly Budgets</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {budgets.filter(b => b.amount_krw > 0).length} categories with budget
            </p>
          </div>
          <ChevronRight
            className="w-4 h-4 transition-transform"
            style={{
              color: 'var(--color-text-secondary)',
              transform: activeSection === 'budgets' ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {activeSection === 'budgets' && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            {categories.filter(c => c.type === 'expense' || c.type === 'both').map(cat => {
              const isEditing = editingBudget === cat.id
              const budgetAmt = budgets.find(b => b.category_id === cat.id)?.amount_krw || 0
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderTop: '1px solid var(--color-border-base)' }}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</p>
                    {isEditing ? (
                      <input
                        autoFocus
                        inputMode="decimal"
                        value={budgetInputs[cat.id] || ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '')
                          const num = parseFloat(raw)
                          setBudgetInputs(prev => ({
                            ...prev,
                            [cat.id]: isNaN(num) ? raw : formatNumber(num),
                          }))
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') saveBudget(cat.id) }}
                        placeholder="₩ monthly limit"
                        className="mt-1 text-xs rounded-lg px-2 py-1.5 w-full focus:outline-none"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-accent-base)',
                          color: 'var(--color-text-primary)',
                          fontSize: '14px',
                        }}
                      />
                    ) : (
                      <p className="text-xs" style={{ color: budgetAmt > 0 ? 'var(--color-warning-base)' : 'var(--color-text-secondary)' }}>
                        {budgetAmt > 0 ? `₩${formatNumber(budgetAmt)} / month` : 'No limit set'}
                      </p>
                    )}
                  </div>
                  {isEditing ? (
                    <button
                      onClick={() => saveBudget(cat.id)}
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--color-income-base)' }}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingBudget(cat.id)
                        if (!budgetInputs[cat.id] && budgetAmt > 0) {
                          setBudgetInputs(prev => ({ ...prev, [cat.id]: formatNumber(budgetAmt) }))
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: 'var(--color-card-elevated-base)',
                        color: 'var(--color-accent-base)',
                        border: '1px solid var(--color-border-base)',
                      }}
                    >
                      {budgetAmt > 0 ? 'Edit' : 'Set'}
                    </button>
                  )}
                </div>
              )
            })}
            {categories.filter(c => c.type === 'expense' || c.type === 'both').length === 0 && (
              <p className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border-base)' }}>
                Add expense categories first to set budgets.
              </p>
            )}
          </motion.div>
        )}
      </div>

      {/* Money Tips */}
      <div style={sectionStyle}>
        <div
          style={{ ...rowStyle }}
          onClick={() => setActiveSection(activeSection === 'tips' ? null : 'tips')}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}
          >
            <BookOpen className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Money Tips</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Frameworks & advice for Seoul devs</p>
          </div>
          <ChevronRight
            className="w-4 h-4 transition-transform"
            style={{
              color: 'var(--color-text-secondary)',
              transform: activeSection === 'tips' ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </div>

        {activeSection === 'tips' && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}>
            <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid var(--color-border-base)' }}>
              {MONEY_TIPS.map((tip, i) => (
                <div
                  key={i}
                  className="rounded-button p-4"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none mt-0.5 shrink-0">{tip.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{tip.title}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
                          style={{ backgroundColor: tip.tagColor + '20', color: tip.tagColor }}
                        >
                          {tip.tag}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                        {tip.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Export */}
      <div style={sectionStyle}>
        <button
          onClick={handleExportCSV}
          style={{ ...rowStyle, borderBottom: 'none', width: '100%', textAlign: 'left' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)' }}
          >
            <Download className="w-5 h-5" style={{ color: '#8b5cf6' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Export Data</p>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Download as CSV</p>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-secondary)' }} />
        </button>
      </div>

      {/* Sign Out */}
      <div style={sectionStyle}>
        <button
          onClick={handleSignOut}
          style={{ ...rowStyle, borderBottom: 'none', width: '100%', textAlign: 'left' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
          >
            <LogOut className="w-5 h-5" style={{ color: 'var(--color-expense-base)' }} />
          </div>
          <p className="flex-1 text-sm font-medium" style={{ color: 'var(--color-expense-base)' }}>Sign Out</p>
        </button>
      </div>

      <p className="text-center text-xs mt-6" style={{ color: 'var(--color-text-secondary)' }}>
        Money Flow v1.0.0
      </p>
    </div>
  )
}
