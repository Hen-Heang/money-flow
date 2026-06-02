'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import Logo from '@/components/ui/Logo'
import {
  ArrowRight,
  PieChart,
  Wallet,
  Target,
  Sparkles,
  Repeat,
  Globe,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
}

const features = [
  {
    icon: Wallet,
    title: 'Track every flow',
    desc: 'Log income and expenses in seconds with smart categories.',
    color: 'var(--color-income-base)',
  },
  {
    icon: PieChart,
    title: 'Visual analytics',
    desc: 'Beautiful charts that show exactly where your money goes.',
    color: 'var(--color-accent-base)',
  },
  {
    icon: Target,
    title: 'Savings goals',
    desc: 'Set targets and watch your progress grow automatically.',
    color: 'var(--color-warning-base)',
  },
  {
    icon: Repeat,
    title: 'Recurring & budgets',
    desc: 'Automate repeating bills and stay inside your limits.',
    color: '#a855f7',
  },
  {
    icon: Sparkles,
    title: 'AI assistant',
    desc: 'Ask questions about your spending and get instant answers.',
    color: '#ec4899',
  },
  {
    icon: Globe,
    title: 'Multi-currency',
    desc: 'Manage money across currencies, wherever you are.',
    color: 'var(--color-income-base)',
  },
]

export default function LandingPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 40% at 50% 0%, color-mix(in srgb, var(--color-income-base) 16%, transparent), transparent 70%)',
        }}
      />

      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 px-mobile pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between">
          <Logo size={34} />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              color: 'var(--color-text-primary)',
              backgroundColor: 'var(--color-card-base)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="px-mobile pb-safe">
        {/* ── Hero ── */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center pt-10 text-center sm:pt-16">
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
            style={{
              backgroundColor: 'var(--color-card-base)',
              border: '1px solid var(--color-border-base)',
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: 'var(--color-income-base)' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Your finances, beautifully organized
            </span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-6 max-w-[16ch] text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Take control of your{' '}
            <span
              className="whitespace-nowrap bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  'linear-gradient(120deg, #14F195, var(--color-income-base) 50%, var(--color-accent-base))',
              }}
            >
              money flow
            </span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 max-w-md text-base leading-relaxed sm:text-lg"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Track spending, set budgets, hit savings goals, and understand your
            money — all in one elegant app.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center"
          >
            <Link
              href="/login?mode=signup"
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-button px-6 text-base font-semibold text-white active:scale-[0.98] sm:flex-none"
              style={{ backgroundColor: 'var(--color-income-base)' }}
            >
              Get started free
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href="/login"
              className="flex h-13 flex-1 items-center justify-center rounded-button px-6 text-base font-semibold active:scale-[0.98] sm:flex-none"
              style={{
                color: 'var(--color-text-primary)',
                backgroundColor: 'var(--color-card-base)',
                border: '1px solid var(--color-border-base)',
              }}
            >
              I have an account
            </Link>
          </motion.div>

          {/* ── App preview card ── */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-12 w-full max-w-sm sm:max-w-md"
          >
            <div className="glass-card overflow-hidden p-5 text-left">
              {/* Balance header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Total balance
                  </p>
                  <p
                    className="mt-1 text-3xl font-bold tracking-tight"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    $12,480.50
                  </p>
                </div>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-income-base) 16%, transparent)' }}
                >
                  <Wallet className="h-5 w-5" style={{ color: 'var(--color-income-base)' }} />
                </div>
              </div>

              {/* Income / expense pills */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div
                  className="rounded-2xl p-3.5"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-income-base) 10%, transparent)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4" style={{ color: 'var(--color-income-base)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Income
                    </span>
                  </div>
                  <p className="mt-1.5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    $8,200
                  </p>
                </div>
                <div
                  className="rounded-2xl p-3.5"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-expense-base) 10%, transparent)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-4 w-4" style={{ color: 'var(--color-expense-base)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Expenses
                    </span>
                  </div>
                  <p className="mt-1.5 text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    $3,640
                  </p>
                </div>
              </div>

              {/* Mini bar chart */}
              <div className="mt-5 flex h-20 items-end justify-between gap-2">
                {[40, 65, 35, 80, 55, 70, 48].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.5, delay: 0.5 + i * 0.06 }}
                    className="flex-1 rounded-md"
                    style={{
                      background:
                        'linear-gradient(to top, var(--color-income-base), color-mix(in srgb, var(--color-income-base) 30%, transparent))',
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── Features ── */}
        <section className="mx-auto mt-20 w-full max-w-5xl sm:mt-28">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <h2
              className="text-2xl font-bold tracking-tight sm:text-4xl"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Everything you need
            </h2>
            <p className="mt-2 text-sm sm:text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Powerful tools, wrapped in a clean and simple experience.
            </p>
          </motion.div>

          <div className="mt-8 grid grid-cols-1 gap-4 xs:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                variants={fadeUp}
                transition={{ duration: 0.45, delay: (i % 2) * 0.06 }}
                className="glass-card p-5"
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `color-mix(in srgb, ${f.color} 16%, transparent)` }}
                >
                  <f.icon className="h-5 w-5" style={{ color: f.color }} />
                </div>
                <h3
                  className="mt-4 text-base font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {f.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="mx-auto mt-20 w-full max-w-3xl sm:mt-28">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="glass-card relative overflow-hidden p-8 text-center sm:p-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10"
              style={{
                background:
                  'radial-gradient(70% 60% at 50% 0%, color-mix(in srgb, var(--color-income-base) 18%, transparent), transparent 75%)',
              }}
            />
            <Logo size={56} className="mx-auto drop-shadow-[0_16px_34px_rgba(16,185,129,0.25)]" />
            <h2
              className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Start your money journey today
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm sm:text-base" style={{ color: 'var(--color-text-secondary)' }}>
              Free to use. No card required. Set up in under a minute.
            </p>
            <Link
              href="/login?mode=signup"
              className="mt-6 inline-flex h-13 items-center justify-center gap-2 rounded-button px-8 text-base font-semibold text-white active:scale-[0.98]"
              style={{ backgroundColor: 'var(--color-income-base)' }}
            >
              Get started free
              <ArrowRight className="h-[18px] w-[18px]" />
            </Link>
            <div
              className="mt-5 flex items-center justify-center gap-1.5 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Your data stays private and secure
            </div>
          </motion.div>
        </section>

        {/* ── Footer ── */}
        <footer className="mx-auto mt-16 flex w-full max-w-5xl flex-col items-center gap-3 border-t pt-8 pb-10 sm:flex-row sm:justify-between"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          <Logo size={26} />
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            © {new Date().getFullYear()} Money Flow. All rights reserved.
          </p>
        </footer>
      </main>
    </div>
  )
}
