'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, LayoutDashboard, TrendingUp, Sparkles, BrainCircuit, Wallet, ShieldCheck } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
})

export const HeroBadge = () => (
  <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-white/60 tracking-wide mb-6">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
    Personal finance, reimagined with AI
  </motion.div>
)

export const HeroTitle = ({ children }: { children: React.ReactNode }) => (
  <motion.h1 {...fadeUp(0.08)} className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6 max-w-3xl mx-auto">
    {children}
  </motion.h1>
)

export const HeroSubtitle = ({ children }: { children: React.ReactNode }) => (
  <motion.p {...fadeUp(0.16)} className="text-base sm:text-lg text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
    {children}
  </motion.p>
)

export const HeroCTA = ({ user }: { user: { id: string } | null }) => (
  <motion.div {...fadeUp(0.24)} className="flex flex-col sm:flex-row items-center justify-center gap-3">
    {user ? (
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-xl"
      >
        Open Dashboard <LayoutDashboard size={15} />
      </Link>
    ) : (
      <>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-xl"
        >
          Get started free <ArrowRight size={15} />
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-white text-sm font-semibold hover:bg-white/[0.08] transition-all active:scale-95"
        >
          Sign in
        </Link>
      </>
    )}
  </motion.div>
)

export const DashboardPreview = () => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
    className="relative mt-16 mx-auto max-w-4xl px-4"
  >
    {/* Glow */}
    <div className="absolute inset-x-0 -top-20 h-40 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

    <div className="relative rounded-2xl border border-white/8 bg-[#111827] overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <span className="w-3 h-3 rounded-full bg-white/10" />
        <span className="w-3 h-3 rounded-full bg-white/10" />
        <span className="w-3 h-3 rounded-full bg-white/10" />
        <span className="ml-4 text-[11px] text-white/20 font-mono">moneyflow.app/dashboard</span>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Balance card */}
        <div className="sm:col-span-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/10 border border-white/5 p-5">
          <p className="text-[11px] text-white/40 font-medium mb-1 uppercase tracking-wider">Total Balance</p>
          <p className="text-3xl font-black text-white mb-3">$12,480.00</p>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Income</p>
              <p className="text-sm font-bold text-emerald-400">+$3,200</p>
            </div>
            <div>
              <p className="text-[10px] text-red-400/70 uppercase tracking-wider">Expenses</p>
              <p className="text-sm font-bold text-red-400">-$1,840</p>
            </div>
          </div>
        </div>

        {/* AI suggestion */}
        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/20">
              <BrainCircuit size={12} className="text-blue-400" />
            </div>
            <p className="text-[11px] font-semibold text-white/60">AI Insight</p>
          </div>
          <p className="text-xs text-white/50 leading-relaxed flex-1">
            Dining expenses up 18% this week. Consider cooking at home 2 more days.
          </p>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '72%' }}
              transition={{ delay: 1, duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full bg-blue-500/60"
            />
          </div>
        </div>

        {/* Transactions */}
        <div className="sm:col-span-3 rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-2">
          <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">Recent Transactions</p>
          {[
            { emoji: '☕', name: 'Starbucks Coffee', cat: 'Food & Drink', amount: '-$6.50', color: 'text-red-400' },
            { emoji: '💼', name: 'Salary Deposit', cat: 'Income', amount: '+$3,200', color: 'text-emerald-400' },
            { emoji: '🚕', name: 'Uber Ride', cat: 'Transport', amount: '-$14.20', color: 'text-red-400' },
          ].map((t) => (
            <div key={t.name} className="flex items-center gap-3 py-1.5">
              <span className="text-lg w-8 text-center">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/80 truncate">{t.name}</p>
                <p className="text-[10px] text-white/30">{t.cat}</p>
              </div>
              <p className={`text-xs font-bold ${t.color}`}>{t.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
)

export const AIPreview = () => (
  <div className="relative">
    <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/10 blur-sm" />
    <div className="relative rounded-2xl border border-white/8 bg-[#111827] p-6 space-y-4">
      <div className="flex items-center gap-3 pb-4 border-b border-white/5">
        <div className="p-2 rounded-xl bg-blue-500/15">
          <BrainCircuit size={20} className="text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-bold">AI Assistant</p>
          <p className="text-[11px] text-white/40">Powered by Gemini 1.5 Flash</p>
        </div>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold flex-shrink-0">You</div>
          <div className="bg-white/5 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/70 leading-relaxed">
            How much did I spend on food this month?
          </div>
        </div>
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles size={12} className="text-blue-400" />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/80 leading-relaxed"
          >
            You spent <span className="text-white font-bold">$342.80</span> on Food &amp; Drink this month — that&apos;s <span className="text-emerald-400 font-bold">12% less</span> than last month. Great progress! 🎉
          </motion.div>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
          <p className="text-[11px] text-white/20 flex-1">Ask about your finances...</p>
          <ArrowRight size={12} className="text-white/20" />
        </div>
      </div>
    </div>
  </div>
)

const LandingClient = {
  HeroBadge,
  HeroTitle,
  HeroSubtitle,
  HeroCTA,
  DashboardPreview,
  AIPreview,
}

export default LandingClient
