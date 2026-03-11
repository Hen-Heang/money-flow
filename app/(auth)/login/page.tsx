'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { ensureUserProfile } from '@/lib/profile'
import Logo from '@/components/ui/Logo'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Eye, EyeOff } from 'lucide-react'


const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

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
        router.push('/')
        router.refresh()
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
              className="w-full rounded-[12px] px-4 py-4 text-base placeholder:opacity-50 focus:outline-none transition-colors"
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
              className="w-full rounded-[12px] px-4 py-4 pr-12 text-base placeholder:opacity-50 focus:outline-none transition-colors"
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
            className="w-full text-white rounded-[14px] py-4 font-semibold text-base active:scale-95 transition-transform disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-income-base)' }}
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

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
