'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Check, ChevronDown, Info } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { categoriesQueryKey } from '@/hooks/useCategories'
import { haptic } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'
import { SPENDING_CLASSES, UNCLASSIFIED_META, spendingClassColor, spendingClassLabel } from '@/lib/finance/spending-class'
import type { Category, SpendingClassValue } from '@/lib/types'

interface CategoryTypesSheetProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Called after each successful save, ahead of the categories query
   * invalidation resolving, so an already-mounted caller can apply the
   * change optimistically instead of waiting on the background refetch.
   */
  onSaved?: (categoryId: string, value: SpendingClassValue | null) => void
}

export default function CategoryTypesSheet({ isOpen, onClose, onSaved }: CategoryTypesSheetProps) {
  const supabase = useSupabaseClient()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Refetches each time the sheet opens. The previously-loaded list stays on
  // screen while it refreshes, so reopening never flashes a skeleton.
  useEffect(() => {
    if (!isOpen) return
    let active = true

    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        if (active) setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon, color, type, spending_class')
        .eq('user_id', user.id)
        .in('type', ['expense', 'both'])
        .order('name')

      if (!active) return

      if (error) {
        console.error('[CategoryTypesSheet] Load failed:', error)
        toast.error('Could not load categories')
      } else {
        setCategories((data as Category[]) ?? [])
      }
      setLoading(false)
    })()

    return () => { active = false }
  }, [isOpen, supabase])

  const setClass = async (category: Category, value: SpendingClassValue | null) => {
    // Tapping the current class again clears it back to unclassified.
    const next = category.spending_class === value ? null : value
    haptic('light')
    setSavingId(category.id)

    const previous = category.spending_class ?? null
    setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, spending_class: next } : c)))

    const { error } = await supabase
      .from('categories')
      .update({ spending_class: next })
      .eq('id', category.id)

    setSavingId(null)

    if (error) {
      console.error('[CategoryTypesSheet] Save failed:', error)
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, spending_class: previous } : c)))
      toast.error('Could not save that change')
      return
    }

    queryClient.invalidateQueries({ queryKey: categoriesQueryKey })
    setExpandedId(null)
    onSaved?.(category.id, next)
  }

  const classifiedCount = categories.filter((c) => c.spending_class).length

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Category types">
      <div className="space-y-5 pb-4">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
          <Info size={15} className="mt-0.5 shrink-0 text-blue-400" aria-hidden />
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
            Telling Money Flow what each category is for lets budget suggestions know what is safe to adjust.
            Anything you leave unset is never reduced automatically.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}
          </div>
        ) : categories.length === 0 ? (
          <p className="py-8 text-center text-sm font-medium opacity-55">
            No expense categories yet. Add some in Settings first.
          </p>
        ) : (
          <>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-45">
              {classifiedCount} of {categories.length} classified
            </p>

            <div className="space-y-2.5">
              {categories.map((category) => {
                const isExpanded = expandedId === category.id
                const color = spendingClassColor(category.spending_class)

                return (
                  <div
                    key={category.id}
                    className="overflow-hidden rounded-2xl border"
                    style={{
                      borderColor: isExpanded ? color : 'var(--color-border-base)',
                      backgroundColor: 'var(--color-card-elevated-base)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { haptic('light'); setExpandedId(isExpanded ? null : category.id) }}
                      aria-expanded={isExpanded}
                      className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                        style={{ backgroundColor: `${category.color}1f` }}
                      >
                        {category.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          {category.name}
                        </span>
                        <span
                          className="mt-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: `${color}1f`, color }}
                        >
                          {spendingClassLabel(category.spending_class)}
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className={`shrink-0 opacity-40 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div
                            role="group"
                            aria-label={`Category type for ${category.name}`}
                            className="space-y-2 px-3 pb-3"
                          >
                            {SPENDING_CLASSES.map((meta) => {
                              const active = category.spending_class === meta.value
                              return (
                                <button
                                  key={meta.value}
                                  type="button"
                                  onClick={() => setClass(category, meta.value)}
                                  disabled={savingId === category.id}
                                  aria-pressed={active}
                                  className="flex min-h-[44px] w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-transform active:scale-[0.98] disabled:opacity-50"
                                  style={{
                                    borderColor: active ? meta.color : 'var(--color-border-base)',
                                    backgroundColor: active ? `${meta.color}14` : 'var(--color-card-base)',
                                  }}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className="block text-[13px] font-black"
                                      style={{ color: active ? meta.color : 'var(--color-text-primary)' }}
                                    >
                                      {meta.label}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-relaxed opacity-60">
                                      {meta.description}
                                    </span>
                                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider opacity-45">
                                      {meta.effect}
                                    </span>
                                  </span>
                                  {active && (
                                    <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: meta.color }} aria-hidden />
                                  )}
                                </button>
                              )
                            })}

                            <p className="px-1 pt-1 text-[10px] leading-relaxed opacity-40">
                              {UNCLASSIFIED_META.description} Tap the selected type again to clear it.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
