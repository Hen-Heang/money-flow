import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import {
  TrendingUp, Shield, Zap, Globe, BrainCircuit,
  Smartphone, CheckCircle2, ArrowRight, LayoutDashboard,
} from 'lucide-react'
import LandingClient from './LandingClient'

export default async function LandingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: '#080d18' }}>

      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06]" style={{ backgroundColor: 'rgba(8,13,24,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-bold text-sm tracking-tight">Money Flow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            <Link href="#features" className="text-[13px] text-white/50 hover:text-white/90 transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-[13px] text-white/50 hover:text-white/90 transition-colors">How it works</Link>
            <Link href="#ai" className="text-[13px] text-white/50 hover:text-white/90 transition-colors">AI</Link>
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-[13px] font-bold hover:bg-white/90 transition-all active:scale-95">
                Dashboard <LayoutDashboard size={13} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-[13px] text-white/50 hover:text-white px-4 py-2 transition-colors">Sign in</Link>
                <Link href="/login" className="px-4 py-2 rounded-lg bg-white text-black text-[13px] font-bold hover:bg-white/90 transition-all active:scale-95">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-36 pb-12 px-6 text-center overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
        <div className="max-w-3xl mx-auto relative z-10">
          <LandingClient.HeroBadge />
          <LandingClient.HeroTitle>
            Track every dollar.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Grow your wealth.</span>
          </LandingClient.HeroTitle>
          <LandingClient.HeroSubtitle>
            Money Flow gives you a real-time view of your finances with AI-powered insights,
            multi-currency support, and beautiful analytics — all in one place.
          </LandingClient.HeroSubtitle>
          <LandingClient.HeroCTA user={user} />
        </div>
        <LandingClient.DashboardPreview />
      </section>

      {/* ── Trust bar ── */}
      <section className="py-12 px-6 border-y border-white/[0.05]" style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {[
            { icon: <Shield size={14} />, text: 'End-to-end secure' },
            { icon: <Globe size={14} />, text: 'Multi-currency (KRW · USD)' },
            { icon: <BrainCircuit size={14} />, text: 'AI-powered insights' },
            { icon: <Smartphone size={14} />, text: 'PWA — install on any device' },
            { icon: <Zap size={14} />, text: 'Real-time sync' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-[12px] text-white/35 font-medium">
              <span className="text-white/25">{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Everything you need, nothing you don&apos;t.</h2>
            <p className="text-white/40 max-w-lg mx-auto text-sm leading-relaxed">
              Built for people who want clarity over their money without the complexity of enterprise software.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.05]">
            {[
              {
                icon: <BrainCircuit size={20} className="text-blue-400" />,
                title: 'AI Intelligence',
                desc: 'Auto-categorize transactions and get personalized savings tips powered by Google Gemini.',
              },
              {
                icon: <TrendingUp size={20} className="text-emerald-400" />,
                title: 'Advanced Analytics',
                desc: 'Interactive charts that show exactly where your money goes, week by week.',
              },
              {
                icon: <Globe size={20} className="text-purple-400" />,
                title: 'Multi-Currency',
                desc: 'Switch between KRW and USD with live exchange rates. Built for global users.',
              },
              {
                icon: <Smartphone size={20} className="text-amber-400" />,
                title: 'PWA Ready',
                desc: 'Install on your home screen for a native app feel. Works offline too.',
              },
              {
                icon: <Shield size={20} className="text-indigo-400" />,
                title: 'Private by Default',
                desc: 'Supabase Row Level Security means only you can ever see your data.',
              },
              {
                icon: <Zap size={20} className="text-rose-400" />,
                title: 'Instant Logging',
                desc: 'Add a transaction in under 5 seconds with smart templates and quick actions.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="p-7 bg-[#080d18] hover:bg-white/[0.02] transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  {icon}
                </div>
                <h3 className="font-bold mb-2 text-[15px]">{title}</h3>
                <p className="text-white/40 text-[13px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-6" style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Up and running in minutes.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Create your account', desc: 'Sign up in seconds with your email. No credit card required.' },
              { step: '02', title: 'Log your transactions', desc: 'Add income and expenses manually, or let AI suggest categories as you type.' },
              { step: '03', title: 'Get insights', desc: 'Watch your dashboard populate with analytics, trends, and AI-powered recommendations.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="relative pl-6 border-l border-white/[0.06]">
                <p className="text-[11px] font-black text-white/20 uppercase tracking-widest mb-3">{step}</p>
                <h3 className="font-bold text-[15px] mb-2">{title}</h3>
                <p className="text-white/40 text-[13px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Section ── */}
      <section id="ai" className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">AI-Powered</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Your personal CFO,<br />available 24/7.
            </h2>
            <p className="text-white/40 leading-relaxed text-sm">
              Ask Money Flow anything about your finances in plain English.
              It learns your spending patterns, flags anomalies, and helps you
              reach your goals faster.
            </p>
            <ul className="space-y-3">
              {[
                'Smart category auto-suggestions',
                'Natural language chat assistant',
                'Automated monthly burn rate analysis',
                'Savings goal tracking & coaching',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-[13px]">
                  <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-white/70">{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className="inline-flex items-center gap-2 text-[13px] font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Try it free <ArrowRight size={14} />
            </Link>
          </div>
          <LandingClient.AIPreview />
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="rounded-2xl border border-white/[0.07] p-12 relative overflow-hidden" style={{ backgroundColor: '#0d1424' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-emerald-500/5 pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Start tracking for free.</h2>
              <p className="text-white/40 text-sm mb-8">No credit card. No setup fee. Just clarity.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all active:scale-95 shadow-xl"
                >
                  Create free account <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.05] py-14 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <Logo size={24} />
              <span className="font-bold text-sm">Money Flow</span>
            </div>
            <p className="text-white/30 text-[12px] max-w-[200px] leading-relaxed">
              Personal finance tracking, powered by AI.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-[13px]">
            <div>
              <p className="font-semibold text-white/60 mb-3 text-[11px] uppercase tracking-wider">Product</p>
              <ul className="space-y-2 text-white/35">
                <li><Link href="#features" className="hover:text-white/80 transition-colors">Features</Link></li>
                <li><Link href="#how-it-works" className="hover:text-white/80 transition-colors">How it works</Link></li>
                <li><Link href="/dashboard" className="hover:text-white/80 transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/60 mb-3 text-[11px] uppercase tracking-wider">Legal</p>
              <ul className="space-y-2 text-white/35">
                <li><span className="cursor-not-allowed">Privacy</span></li>
                <li><span className="cursor-not-allowed">Terms</span></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-white/60 mb-3 text-[11px] uppercase tracking-wider">Connect</p>
              <ul className="space-y-2 text-white/35">
                <li>
                  <a href="https://github.com/Hen-Heang/money-flow" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-white/20 text-[11px]">&copy; {new Date().getFullYear()} Money Flow. Built with Next.js &amp; Supabase.</p>
          <p className="text-white/20 text-[11px]">Made by Hen Heang</p>
        </div>
      </footer>
    </div>
  )
}
