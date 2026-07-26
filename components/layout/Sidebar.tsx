'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, List, BarChart2, PiggyBank, Settings, Plus, LogOut, Wallet, Repeat, ClipboardCheck } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { memo, useEffect, useState } from 'react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { getUserProfile } from '@/lib/profile'
import Avatar from '@/components/ui/Avatar'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'

const AddTransactionSheet = dynamic(() => import('@/components/transactions/AddTransactionSheet'), { ssr: false })

const TABS = [
  { href: '/dashboard',    label: 'Overview',     icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: List },
  { href: '/savings',      label: 'Savings',      icon: PiggyBank },
  { href: '/budget',       label: 'Budget',       icon: Wallet },
  { href: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { href: '/analytics',   label: 'Analytics',    icon: BarChart2 },
  { href: '/review',       label: 'Monthly review', icon: ClipboardCheck },
  { href: '/settings',     label: 'Settings',     icon: Settings },
]

export default memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return
      setEmail(user.email ?? '')
      const profile = await getUserProfile(supabase, user)
      setDisplayName(profile?.display_name ?? user.email?.split('@')[0] ?? '')
      setAvatarUrl(profile?.avatar_url ?? null)
    }
    load()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }


  return (
    <>
      <aside
        className="fixed left-0 top-0 z-50 hidden h-screen w-72 flex-col p-5 lg:flex"
      >
        <div
          className="glass-card flex h-full flex-col overflow-hidden rounded-[28px]"
          style={{
            background: 'color-mix(in srgb, var(--color-card-base) 94%, transparent)',
            borderColor: 'var(--color-border-base)',
            boxShadow: '0 24px 60px -32px rgba(0,0,0,0.75)',
          }}
        >
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3.5 px-6 pb-7 pt-7 transition-opacity hover:opacity-85 active:scale-[0.98]">
            <Logo size={36} />
            <div className="flex flex-col">
              <p
                className="text-tiny opacity-40 font-black"
                style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.35em' }}
              >
                Personal finance
              </p>
              <p
                className="text-xl font-black tracking-tight leading-none mt-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Money Flow
              </p>
            </div>
          </Link>

          {/* Quick Add */}
          <div className="px-5 pb-6">
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-[filter,transform] hover:brightness-110 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-base) 0%, color-mix(in srgb, var(--color-accent-base) 80%, black) 100%)',
                color: '#fff',
                boxShadow: '0 10px 25px -5px color-mix(in srgb, var(--color-accent-base) 40%, transparent)',
              }}
            >
              <Plus size={18} strokeWidth={3} />
              Add transaction
            </button>
          </div>

          {/* Nav links */}
          <nav aria-label="Primary navigation" className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-4">
            {TABS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-[color,background-color] duration-200 ${
                    isActive
                      ? 'text-[var(--color-accent-base)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-bg"
                      className="absolute inset-0 rounded-2xl border"
                      style={{
                        background: 'color-mix(in srgb, var(--color-accent-base) 11%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--color-accent-base) 24%, transparent)',
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className={`h-5 w-5 transition-all duration-300 relative z-10 ${isActive ? 'scale-110' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`} />
                  <span className="font-bold tracking-tight flex-1 relative z-10">{label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active-dot"
                      className="relative z-10 h-1.5 w-1.5 rounded-full bg-[var(--color-accent-base)]"
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User profile */}
          <div className="p-4 mt-auto">
            <div
              className="flex items-center gap-3 rounded-2xl border p-4"
              style={{ background: 'var(--color-card-elevated-base)', borderColor: 'var(--color-border-base)' }}
            >
              <Avatar src={avatarUrl ?? undefined} name={displayName} size={36} className="ring-2 ring-white/5 shadow-xl" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-black truncate tracking-tight"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {displayName || '—'}
                </p>
                <p className="truncate text-[11px] font-medium opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
                  {email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="flex-shrink-0 rounded-xl p-2.5 transition-[background-color,color,transform] hover:bg-red-500/10 hover:text-red-400 active:scale-90"
                title="Sign out"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {showAdd && (
        <AddTransactionSheet
          isOpen={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => setShowAdd(false)}
        />
      )}
    </>
  )
})
