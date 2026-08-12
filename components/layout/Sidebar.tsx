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
  {
    href: '/dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    iconClass: 'text-blue-500',
    tintClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/25',
    dotClass: 'bg-blue-500',
  },
  {
    href: '/transactions',
    label: 'Transactions',
    icon: List,
    iconClass: 'text-cyan-500',
    tintClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/25',
    dotClass: 'bg-cyan-500',
  },
  {
    href: '/savings',
    label: 'Savings',
    icon: PiggyBank,
    iconClass: 'text-emerald-500',
    tintClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/25',
    dotClass: 'bg-emerald-500',
  },
  {
    href: '/budget',
    label: 'Budget',
    icon: Wallet,
    iconClass: 'text-amber-500',
    tintClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/25',
    dotClass: 'bg-amber-500',
  },
  {
    href: '/subscriptions',
    label: 'Subscriptions',
    icon: Repeat,
    iconClass: 'text-violet-500',
    tintClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/25',
    dotClass: 'bg-violet-500',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart2,
    iconClass: 'text-fuchsia-500',
    tintClass: 'bg-fuchsia-500/10',
    borderClass: 'border-fuchsia-500/25',
    dotClass: 'bg-fuchsia-500',
  },
  {
    href: '/review',
    label: 'Monthly review',
    icon: ClipboardCheck,
    iconClass: 'text-indigo-500',
    tintClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/25',
    dotClass: 'bg-indigo-500',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    iconClass: 'text-slate-400',
    tintClass: 'bg-slate-400/10',
    borderClass: 'border-slate-400/25',
    dotClass: 'bg-slate-400',
  },
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
            {TABS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-[color,background-color] duration-200 ${
                    isActive
                      ? `text-[var(--color-text-primary)] ${item.iconClass}`
                      : 'text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-bg"
                      className={`absolute inset-0 rounded-2xl border ${item.tintClass} ${item.borderClass}`}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  <span
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-[background-color,transform,box-shadow] duration-200 ${item.tintClass} ${
                      isActive ? `scale-105 border shadow-sm ${item.borderClass}` : 'group-hover:scale-105'
                    }`}
                  >
                    <Icon
                      aria-hidden="true"
                      className={`h-5 w-5 ${item.iconClass} transition-[opacity,transform] duration-200 ${
                        isActive ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'
                      }`}
                    />
                  </span>

                  <span className="relative z-10 flex-1 font-bold tracking-tight">{item.label}</span>

                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-dot"
                      aria-hidden="true"
                      className={`relative z-10 h-1.5 w-1.5 rounded-full ${item.dotClass}`}
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
