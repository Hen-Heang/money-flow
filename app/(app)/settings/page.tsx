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
  Plus, Trash2, Moon, Sun, Camera,
} from 'lucide-react'
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
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true
  )
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userProfile = await getUserProfile(supabase, user)
      setProfile(userProfile)

      const [cats, methods] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('payment_methods').select('*').eq('user_id', user.id),
      ])
      if (cats.data) setCategories(cats.data)
      if (methods.data) setPaymentMethods(methods.data)
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

      const { data, error } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)
        .select('*')
        .single<UserProfile>()

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
    html.classList.toggle('dark')
    setIsDark(html.classList.contains('dark'))
  }

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Category deleted')
  }

  const deletePaymentMethod = async (id: string) => {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id)
    if (error) { toast.error('Failed to delete'); return }
    setPaymentMethods(prev => prev.filter(m => m.id !== id))
    toast.success('Payment method deleted')
  }

  const addCategory = async () => {
    const name = prompt('Category name:')
    if (!name) return
    const icon = prompt('Emoji icon:', '📦') || '📦'
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name, icon, color, type: 'expense' })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return }
    if (data) setCategories(prev => [...prev, data])
    toast.success('Category added!')
  }

  const addPaymentMethod = async () => {
    const name = prompt('Payment method name:')
    if (!name) return
    const icon = prompt('Emoji icon:', '💳') || '💳'
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('payment_methods')
      .insert({ user_id: user.id, name, icon })
      .select()
      .single()

    if (error) { toast.error('Failed to add'); return }
    if (data) setPaymentMethods(prev => [...prev, data])
    toast.success('Payment method added!')
  }

  const sectionStyle = {
    backgroundColor: 'var(--color-card-base)',
    borderRadius: '16px',
    overflow: 'hidden',
    marginBottom: '16px',
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderBottom: '1px solid var(--color-border-base)',
    cursor: 'pointer',
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
            {categories.map(cat => (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: '1px solid var(--color-border-base)' }}
              >
                <span className="text-lg">{cat.icon}</span>
                <div className="flex-1">
                  <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{cat.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{cat.type}</p>
                </div>
                <button onClick={() => deleteCategory(cat.id)}>
                  <Trash2 className="w-4 h-4" style={{ color: 'var(--color-expense-base)' }} />
                </button>
              </div>
            ))}
            <button
              onClick={addCategory}
              className="w-full flex items-center gap-3 px-4 py-3"
              style={{ borderTop: '1px solid var(--color-border-base)' }}
            >
              <Plus className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
              <span className="text-sm" style={{ color: 'var(--color-accent-base)' }}>Add Category</span>
            </button>
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
              onClick={addPaymentMethod}
              className="w-full flex items-center gap-3 px-4 py-3"
              style={{ borderTop: '1px solid var(--color-border-base)' }}
            >
              <Plus className="w-5 h-5" style={{ color: 'var(--color-accent-base)' }} />
              <span className="text-sm" style={{ color: 'var(--color-accent-base)' }}>Add Payment Method</span>
            </button>
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
