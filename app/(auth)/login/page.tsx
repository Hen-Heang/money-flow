'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { ensureUserProfile } from '@/lib/profile'
import Logo from '@/components/ui/Logo'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'


const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  // Start false to match the server render, then read the URL after mount so
  // ?mode=signup opens sign-up mode without a hydration mismatch.
  const [isSignUp, setIsSignUp] = useState(false)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'signup') {
      setIsSignUp(true)
    }
  }, [])
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const getNext = () => {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    // Only allow relative paths to prevent open redirect attacks
    return next && next.startsWith('/') ? next : '/dashboard'
  }

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      const next = getNext()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      })
      if (error) throw error
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Google sign-in failed')
      setLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      if (isSignUp) {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
        if (signUpData.user) {
          await ensureUserProfile(supabase, signUpData.user)
        }
        toast.success('Account created! Check your email to verify.')
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        if (error) throw error
        if (signInData.user) {
          await ensureUserProfile(supabase, signInData.user)
        }
        // Full navigation avoids iOS Safari flash from two-step soft-navigation
        window.location.href = getNext()
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 pt-safe-top pb-safe-bottom"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Logo size={92} className="mb-4 drop-shadow-[0_16px_34px_rgba(16,185,129,0.2)]" />
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Money Flow</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Track your finances beautifully</p>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <input
              {...register('email')}
              type="email"
              inputMode="email"
              placeholder="Email"
              className="w-full rounded-xl px-4 py-4 text-base placeholder:opacity-50 focus:outline-none transition-colors"
              style={{
                backgroundColor: 'var(--color-card-base)',
                border: '1px solid var(--color-border-base)',
                color: 'var(--color-text-primary)',
                fontSize: '16px',
              }}
            />
            {errors.email && <p className="text-xs mt-1 ml-1" style={{ color: 'var(--color-expense-base)' }}>{errors.email.message}</p>}
          </div>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              className="w-full rounded-xl px-4 py-4 pr-12 text-base placeholder:opacity-50 focus:outline-none transition-colors"
              style={{
                backgroundColor: 'var(--color-card-base)',
                border: '1px solid var(--color-border-base)',
                color: 'var(--color-text-primary)',
                fontSize: '16px',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            {errors.password && <p className="text-xs mt-1 ml-1" style={{ color: 'var(--color-expense-base)' }}>{errors.password.message}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white rounded-button py-4 font-semibold text-base active:scale-95 transition-transform disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-income-base)' }}
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border-base)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--color-border-base)' }} />
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 rounded-button py-4 font-semibold text-base active:scale-95 transition-transform disabled:opacity-50"
          style={{
            backgroundColor: 'var(--color-card-base)',
            border: '1px solid var(--color-border-base)',
            color: 'var(--color-text-primary)',
          }}
        >
          {/* Google logo SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-center text-sm mt-6"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <span style={{ color: 'var(--color-accent-base)' }}>{isSignUp ? 'Sign In' : 'Sign Up'}</span>
        </button>
      </motion.div>
    </div>
  )
}
