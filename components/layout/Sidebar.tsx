'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, List, BarChart2, PiggyBank, Settings, Plus, LogOut, Wallet, FileText } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import { memo, useEffect, useState } from 'react'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { getUserProfile } from '@/lib/profile'
import Avatar from '@/components/ui/Avatar'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'

const AddTransactionSheet = dynamic(() => import('@/components/transactions/AddTransactionSheet'), { ssr: false })

const TABS = [
  { href: '/dashboard',    label: 'Home',         icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions',  icon: List },
  { href: '/savings',      label: 'Savings',       icon: PiggyBank },
  { href: '/budget',       label: 'Budget',        icon: Wallet },
  { href: '/analytics',    label: 'Analytics',     icon: BarChart2 },
  { href: '/report',       label: 'Report',        icon: FileText },
  { href: '/settings',     label: 'Settings',      icon: Settings },
]

export default memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useSupabaseClient()

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
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
        className="fixed left-0 top-0 hidden h-screen w-72 md:flex flex-col z-50 p-6"
      >
        <div
          className="flex h-full flex-col rounded-[32px] overflow-hidden glass-card"
          style={{
            background: 'rgba(10, 15, 26, 0.8)',
            backdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 0 40px rgba(0,0,0,0.3)',
          }}
        >
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3.5 px-6 pt-8 pb-8 hover:opacity-80 transition-opacity">
            <Logo size={32} />
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Finance
              </p>
              <p
                className="text-xl font-black tracking-tight leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Money Flow
              </p>
            </div>
          </Link>

          {/* Quick Add */}
          <div className="px-5 pb-8">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black uppercase tracking-widest transition-all active:scale-95 hover:opacity-90"
              style={{
                background: 'var(--color-accent-base)',
                color: '#fff',
                boxShadow: '0 8px 24px color-mix(in srgb, var(--color-accent-base) 40%, transparent)',
              }}
            >
              <Plus size={18} strokeWidth={3} />
              New Entry
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex flex-col gap-2 px-4 flex-1 overflow-y-auto no-scrollbar">
            {TABS.map(({ href, label, icon: Icon }) => {
              const isActive = isMounted && pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-300 group ${
                    isActive 
                      ? 'bg-blue-500/15 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
                      : 'text-[var(--color-text-secondary)] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-bold tracking-tight flex-1">{label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                    />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User profile */}
          <div className="p-4 mt-auto">
            <div
              className="rounded-2xl p-4 flex items-center gap-3 border border-white/5"
              style={{ background: 'rgba(255, 255, 255, 0.03)' }}
            >
              <Avatar src={avatarUrl ?? undefined} name={displayName} size={36} className="ring-2 ring-white/5 shadow-xl" />
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-black truncate tracking-tight"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {displayName || '—'}
                </p>
                <p className="text-[10px] truncate opacity-40 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  {email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex-shrink-0 p-2 rounded-xl transition-all hover:bg-red-500/10 hover:text-red-400 active:scale-90"
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
