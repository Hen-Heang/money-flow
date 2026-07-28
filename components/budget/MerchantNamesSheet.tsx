'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { Merge, Undo2, Info, AlertTriangle } from 'lucide-react'
import { formatKRW, haptic } from '@/lib/utils'
import BottomSheet from '@/components/ui/BottomSheet'

interface AliasMember {
  normalizedKey: string
  sample: string
  variants: string[]
  count: number
  totalKrw: number
}

interface AliasSuggestion {
  id: string
  suggestedCanonical: string
  members: AliasMember[]
  confidence: 'exact' | 'likely'
  occurrenceCount: number
  totalKrw: number
}

interface StoredAlias {
  normalizedKey: string
  canonicalDescription: string
}

interface MerchantNamesSheetProps {
  isOpen: boolean
  onClose: () => void
  onChanged?: () => void
}

export default function MerchantNamesSheet({ isOpen, onClose, onChanged }: MerchantNamesSheetProps) {
  const reduceMotion = useReducedMotion()

  const [suggestions, setSuggestions] = useState<AliasSuggestion[]>([])
  const [aliases, setAliases] = useState<StoredAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({})

  // All state updates happen after an await, so this is safe to call
  // directly from an effect.
  const load = useCallback(async () => {
    const response = await fetch('/api/finance/aliases')
    if (!response.ok) {
      toast.error('Could not load merchant names')
      setLoading(false)
      return
    }
    const data = await response.json()
    setSuggestions(data.suggestions ?? [])
    setAliases(data.aliases ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  const confirm = async (suggestion: AliasSuggestion) => {
    const canonical = (nameEdits[suggestion.id] ?? suggestion.suggestedCanonical).trim()
    if (!canonical) {
      toast.error('Give the merged name a title first')
      return
    }

    haptic('medium')
    setBusyId(suggestion.id)

    try {
      const response = await fetch('/api/finance/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalDescription: canonical,
          normalizedKeys: suggestion.members.map((m) => m.normalizedKey),
        }),
      })
      if (!response.ok) throw new Error('save failed')

      toast.success(`Grouped as "${canonical}"`)
      await load()
      onChanged?.()
    } catch {
      toast.error('Could not save that merge')
    } finally {
      setBusyId(null)
    }
  }

  const undo = async (alias: StoredAlias) => {
    const keys = aliases.filter((a) => a.canonicalDescription === alias.canonicalDescription).map((a) => a.normalizedKey)
    haptic('light')
    setBusyId(alias.canonicalDescription)

    try {
      const response = await fetch('/api/finance/aliases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ normalizedKeys: keys }),
      })
      if (!response.ok) throw new Error('delete failed')

      toast.success(`Ungrouped "${alias.canonicalDescription}"`)
      await load()
      onChanged?.()
    } catch {
      toast.error('Could not undo that merge')
    } finally {
      setBusyId(null)
    }
  }

  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id))

  // One row per canonical name, not per stored key.
  const groupedAliases = Array.from(
    aliases.reduce((map, alias) => {
      const entry = map.get(alias.canonicalDescription) ?? { canonicalDescription: alias.canonicalDescription, keys: [] as string[] }
      entry.keys.push(alias.normalizedKey)
      map.set(alias.canonicalDescription, entry)
      return map
    }, new Map<string, { canonicalDescription: string; keys: string[] }>())
  ).map(([, value]) => value)

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Merchant names">
      <div className="space-y-5 pb-4">
        <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
          <Info size={15} className="mt-0.5 shrink-0 text-blue-400" aria-hidden />
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
            When the same shop is typed slightly differently, grouping the spellings makes totals and subscription
            detection more accurate. Your transactions are never edited — only how they are grouped for analysis.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
          </div>
        ) : (
          <>
            {visibleSuggestions.length > 0 && (
              <section aria-label="Suggested groups" className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest opacity-45">
                  Suggested ({visibleSuggestions.length})
                </h3>

                <AnimatePresence initial={false}>
                  {visibleSuggestions.map((suggestion) => {
                    const allVariants = suggestion.members.flatMap((m) => m.variants)
                    const isBusy = busyId === suggestion.id

                    return (
                      <motion.div
                        key={suggestion.id}
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: suggestion.confidence === 'exact' ? 'var(--color-border-base)' : 'rgba(245,158,11,0.3)',
                          backgroundColor: 'var(--color-card-elevated-base)',
                        }}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider opacity-45">
                              {suggestion.confidence === 'exact' ? 'Same name, different spacing' : 'Possibly the same merchant'}
                            </p>
                            <p className="mt-1 font-mono text-[12px] tabular-nums opacity-60">
                              {suggestion.occurrenceCount} transactions · {formatKRW(suggestion.totalKrw)}
                            </p>
                          </div>
                          {suggestion.confidence === 'likely' && (
                            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
                          )}
                        </div>

                        <ul className="mb-3 space-y-1">
                          {allVariants.map((variant) => (
                            <li key={variant} className="truncate font-mono text-[12px] opacity-70">
                              “{variant}”
                            </li>
                          ))}
                        </ul>

                        {suggestion.confidence === 'likely' && (
                          <p className="mb-3 text-[11px] leading-relaxed text-amber-400/90">
                            These are spelled differently, so only group them if they really are the same shop.
                          </p>
                        )}

                        <label className="mb-3 block">
                          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider opacity-45">
                            Group them as
                          </span>
                          <input
                            value={nameEdits[suggestion.id] ?? suggestion.suggestedCanonical}
                            onChange={(e) => setNameEdits((prev) => ({ ...prev, [suggestion.id]: e.target.value }))}
                            aria-label={`Merged name for ${suggestion.suggestedCanonical}`}
                            className="min-h-[44px] w-full rounded-xl border px-3 py-2.5 font-bold outline-none"
                            style={{
                              backgroundColor: 'var(--color-card-base)',
                              borderColor: 'var(--color-border-base)',
                              color: 'var(--color-text-primary)',
                              fontSize: '16px',
                            }}
                          />
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => confirm(suggestion)}
                            disabled={isBusy}
                            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--color-accent-base)] px-3.5 py-2 text-xs font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
                          >
                            <Merge size={13} aria-hidden />
                            {isBusy ? 'Grouping…' : 'Group them'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { haptic('light'); setDismissed((prev) => new Set(prev).add(suggestion.id)) }}
                            disabled={isBusy}
                            className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--color-border-base)] px-3.5 py-2 text-xs font-bold transition-transform active:scale-95 disabled:opacity-50"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            Keep separate
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </section>
            )}

            {groupedAliases.length > 0 && (
              <section aria-label="Confirmed groups" className="space-y-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest opacity-45">
                  Grouped ({groupedAliases.length})
                </h3>
                <div className="overflow-hidden rounded-2xl border border-[var(--color-border-base)]">
                  {groupedAliases.map((group, i) => (
                    <div
                      key={group.canonicalDescription}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--color-border-base)' : 'none',
                        backgroundColor: 'var(--color-card-elevated-base)',
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          {group.canonicalDescription}
                        </p>
                        <p className="text-[11px] opacity-50">{group.keys.length} spelling{group.keys.length === 1 ? '' : 's'} grouped</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => undo({ normalizedKey: group.keys[0], canonicalDescription: group.canonicalDescription })}
                        disabled={busyId === group.canonicalDescription}
                        aria-label={`Ungroup ${group.canonicalDescription}`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform active:scale-95 disabled:opacity-40"
                      >
                        <Undo2 size={15} className="opacity-55" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {visibleSuggestions.length === 0 && groupedAliases.length === 0 && (
              <p className="py-10 text-center text-sm font-medium opacity-55">
                No inconsistent merchant names found. Nothing to group right now.
              </p>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
