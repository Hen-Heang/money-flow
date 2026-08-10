'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { X, BookmarkPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useSupabaseClient } from '@/hooks/useSupabaseClient'
import { useDescriptionSuggestions, type DescriptionSuggestion } from '@/hooks/useDescriptionSuggestions'
import { formatNumber, haptic } from '@/lib/utils'
import type { Category, PaymentMethod } from '@/lib/types'
import { useIsMobile } from '@/hooks/useIsMobile'
import BottomSheet from '@/components/ui/BottomSheet'
import NumericKeypad from '@/components/ui/NumericKeypad'
import { useTransactionForm, type TransactionFormData } from '@/hooks/useTransactionForm'
import { emitTransactionsChanged } from '@/hooks/useTransactionSync'
import { useWatch } from 'react-hook-form'
import { useKeyboardVisible } from './useKeyboardVisible'
import { useTemplates } from './useTemplates'
import { useQuickAdd } from './useQuickAdd'
import { TemplateStrip } from './TemplateStrip'
import { QuickAddPanel } from './QuickAddPanel'
import { CategoryField } from './CategoryField'
import { PaymentMethodField } from './PaymentMethodField'
import { DescriptionSuggestions } from './DescriptionSuggestions'
import type { EditTransaction } from './types'

export type { EditTransaction }

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (transaction: unknown) => void
  editTransaction?: EditTransaction
  isDuplicate?: boolean
}

export default function AddTransactionSheet({
  isOpen,
  onClose,
  onSuccess,
  editTransaction,
  isDuplicate = false,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [canDrag, setCanDrag] = useState(true)
  const [showKeypad, setShowKeypad] = useState(false)
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastLearnedDescriptionRef = useRef('')
  const supabase = useSupabaseClient()
  const isEditing = !!editTransaction && !isDuplicate
  const isMobile = useIsMobile()
  const keyboardVisible = useKeyboardVisible()

  const {
    form,
    exchangeRate: liveRate,
    amountNum,
    hasExpression,
    handleKeypadInput,
    handleKeypadDelete,
    handleCalculate
  } = useTransactionForm()

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = form

  const [type, currency, amountRaw, description, currentCategoryId] = useWatch({
    control,
    name: ['type', 'currency', 'amount', 'description', 'category_id'],
  })
  const activeExchangeRate = editTransaction?.exchange_rate || liveRate

  const {
    suggestions: descriptionSuggestions,
    exactMatch: learnedDescription,
    isReady: descriptionHistoryReady,
  } = useDescriptionSuggestions(isOpen && !isEditing, type, description || '')

  const { templates, savingTemplate, loadTemplates, applyTemplate, saveAsTemplate, deleteTemplate } = useTemplates({
    supabase, activeExchangeRate, amountNum, getValues, setValue,
  })

  const {
    quickAddText, setQuickAddText,
    quickAddPreview, setQuickAddPreview,
    quickAddError, setQuickAddError,
    isQuickAddLoading,
    resetQuickAdd,
    parseQuickAdd,
    applyQuickAddPreview,
  } = useQuickAdd({ isMobile, setValue, setShowKeypad })

  useEffect(() => {
    if (isEditing || !learnedDescription) return
    const learnedKey = `${type}:${learnedDescription.description.toLocaleLowerCase()}`
    if (lastLearnedDescriptionRef.current === learnedKey) return

    let applied = false
    if (!getValues('category_id') && learnedDescription.categoryId) {
      setValue('category_id', learnedDescription.categoryId)
      applied = true
    }
    if (!getValues('payment_method_id') && learnedDescription.paymentMethodId) {
      setValue('payment_method_id', learnedDescription.paymentMethodId)
      applied = true
    }
    lastLearnedDescriptionRef.current = learnedKey
    if (applied) haptic('light')
  }, [getValues, isEditing, learnedDescription, setValue, type])

  // AI Suggestion Logic
  useEffect(() => {
    if (
      isEditing ||
      !description ||
      description.length < 2 ||
      currentCategoryId ||
      !descriptionHistoryReady ||
      learnedDescription?.categoryId
    ) return

    const timeoutId = setTimeout(async () => {
      setIsAiSuggesting(true)
      try {
        const response = await fetch('/api/ai/suggest-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description, type }),
        })
        if (!response.ok) return
        const { categoryId } = await response.json()
        if (categoryId && !getValues('category_id')) {
          setValue('category_id', categoryId)
          haptic('light')
        }
      } catch (err) {
        console.error('AI Suggestion Error:', err)
      } finally {
        setIsAiSuggesting(false)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [description, type, setValue, getValues, isEditing, currentCategoryId, descriptionHistoryReady, learnedDescription])

  const applyDescriptionSuggestion = (suggestion: DescriptionSuggestion) => {
    setValue('description', suggestion.description)
    if (suggestion.categoryId) setValue('category_id', suggestion.categoryId)
    if (suggestion.paymentMethodId) setValue('payment_method_id', suggestion.paymentMethodId)
    haptic('light')
  }

  const amountFormatted = (() => {
    if (!amountRaw) return '0'
    if (hasExpression) return amountRaw
    const num = parseFloat(amountRaw.replace(/,/g, ''))
    if (isNaN(num)) return amountRaw
    return currency === 'KRW' ? formatNumber(Math.round(num)) : amountRaw
  })()

  const convertedHint =
    currency === 'USD'
      ? amountNum > 0 ? `≈ ₩${formatNumber(Math.round(amountNum * activeExchangeRate))}` : ''
      : amountNum > 0 ? `≈ $${(amountNum / activeExchangeRate).toFixed(2)}` : ''

  useEffect(() => {
    if (!isOpen) return
    resetQuickAdd()
    lastLearnedDescriptionRef.current = ''
    const loadData = async () => {
      const [cats, methods] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('payment_methods').select('*'),
      ])
      if (cats.data) setCategories(cats.data)
      if (methods.data) setPaymentMethods(methods.data)
    }
    loadData()

    if (!editTransaction) loadTemplates()

    if (editTransaction) {
      const editCurrency = (editTransaction.currency as 'KRW' | 'USD') || 'KRW'
      reset({
        type: editTransaction.type,
        currency: editCurrency,
        amount: editCurrency === 'USD' ? editTransaction.amount_usd.toFixed(2) : String(Math.round(editTransaction.amount_krw)),
        date: isDuplicate ? format(new Date(), 'yyyy-MM-dd') : editTransaction.date,
        description: editTransaction.description,
        category_id: editTransaction.category_id || '',
        payment_method_id: editTransaction.payment_method_id || '',
        note: editTransaction.note || '',
      })
    } else {
      const lastPaymentMethod = typeof window !== 'undefined'
        ? localStorage.getItem('lastPaymentMethod') ?? ''
        : ''
      reset({
        type: 'expense',
        currency: 'KRW',
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        description: '',
        payment_method_id: lastPaymentMethod,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editTransaction, isDuplicate, reset, supabase, isMobile, loadTemplates])

  const handleClose = () => {
    setShowKeypad(false)
    onClose()
  }

  const onSubmit = async (data: TransactionFormData) => {
    const finalAmount = amountNum
    if (finalAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    let amountKrw: number
    let amountUsd: number

    if (data.currency === 'USD') {
      amountUsd = finalAmount
      amountKrw = Math.round(finalAmount * activeExchangeRate)
    } else {
      amountKrw = finalAmount
      amountUsd = finalAmount / activeExchangeRate
    }

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const payload = {
      date: data.date,
      type: data.type,
      currency: data.currency,
      category_id: data.category_id || null,
      description: data.description,
      amount_krw: amountKrw,
      amount_usd: amountUsd,
      exchange_rate: activeExchangeRate,
      payment_method_id: data.payment_method_id || null,
      note: data.note || null,
    }

    // Budget check for new expenses with a category
    if (!isEditing && data.type === 'expense' && data.category_id) {
      const thisMonth = new Date().toISOString().slice(0, 7)
      const [{ data: budget }, { data: spent }] = await Promise.all([
        supabase.from('budgets').select('amount_krw').eq('user_id', user.id).eq('category_id', data.category_id).single(),
        supabase.from('transactions').select('amount_krw').eq('user_id', user.id).eq('category_id', data.category_id).eq('type', 'expense').gte('date', `${thisMonth}-01`),
      ])
      if (budget && budget.amount_krw > 0) {
        const totalSpent = (spent || []).reduce((s: number, t: { amount_krw: number }) => s + t.amount_krw, 0) + amountKrw
        if (totalSpent > budget.amount_krw) {
          toast(`Over budget by ₩${Math.round(totalSpent - budget.amount_krw).toLocaleString()} in this category`, { icon: '⚠️', duration: 4000 })
        } else if (totalSpent / budget.amount_krw >= 0.9) {
          toast(`90%+ of budget used in this category`, { icon: '📊', duration: 3000 })
        }
      }
    }

    const { data: saved, error } = isEditing
      ? await supabase.from('transactions').update(payload).eq('id', editTransaction.id).select().single()
      : await supabase.from('transactions').insert({ ...payload, user_id: user.id }).select().single()

    if (error) {
      toast.error('Failed to save transaction')
      return
    }

    if (data.payment_method_id) {
      localStorage.setItem('lastPaymentMethod', data.payment_method_id)
    }
    haptic('medium')
    toast.success(isEditing ? 'Updated' : 'Saved')
    emitTransactionsChanged()
    onSuccess(saved)
    handleClose()
  }

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')
  // UI Styles
  const sectionLabelStyle = "text-tiny text-[var(--color-text-secondary)] mb-3"
  const inputBaseStyle = "w-full bg-[var(--color-card-elevated-base)] border border-[var(--color-border-base)] rounded-[var(--radius-md)] px-4 py-3.5 focus:border-[var(--color-accent-base)] transition-all outline-none"

  const quickAddPanel = (
    <QuickAddPanel
      isEditing={!!editTransaction}
      quickAddText={quickAddText}
      setQuickAddText={setQuickAddText}
      setQuickAddError={setQuickAddError}
      setQuickAddPreview={setQuickAddPreview}
      setShowKeypad={setShowKeypad}
      isQuickAddLoading={isQuickAddLoading}
      parseQuickAdd={parseQuickAdd}
      quickAddError={quickAddError}
      quickAddPreview={quickAddPreview}
      categories={categories}
      paymentMethods={paymentMethods}
      applyQuickAddPreview={applyQuickAddPreview}
      inputBaseStyle={inputBaseStyle}
    />
  )

  const templateStrip = (
    <TemplateStrip
      isEditing={isEditing}
      templates={templates}
      activeExchangeRate={activeExchangeRate}
      applyTemplate={applyTemplate}
      deleteTemplate={deleteTemplate}
      sectionLabelStyle={sectionLabelStyle}
    />
  )

  const descriptionSuggestionList = (
    <DescriptionSuggestions type={type} suggestions={descriptionSuggestions} onApply={applyDescriptionSuggestion} />
  )

  const desktopForm = (
    <form id="tx-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 pb-8">
      {quickAddPanel}
      {templateStrip}
      {/* Type & Amount */}
      <div className="space-y-4">
        <div className="flex bg-[var(--color-card-elevated-base)] p-1 rounded-[var(--radius-md)]">
          {(['expense', 'income'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { setValue('type', opt); haptic('light') }}
              className={`flex-1 py-2.5 rounded-[var(--radius-sm)] text-sm font-bold transition-all ${
                type === opt ? (opt === 'expense' ? 'bg-[var(--color-expense-base)] text-white' : 'bg-[var(--color-income-base)] text-white') : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-[var(--color-text-secondary)]">
            {currency === 'USD' ? '$' : '₩'}
          </span>
          <input
            {...register('amount')}
            className={`${inputBaseStyle} pl-12 pr-28 text-3xl font-black tracking-tight`}
            placeholder="0"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex bg-[var(--color-card-base)] p-1 rounded-[var(--radius-sm)]">
            {(['KRW', 'USD'] as const).map(cur => (
              <button
                key={cur}
                type="button"
                onClick={() => { setValue('currency', cur); haptic('light') }}
                className={`px-3 py-1 rounded-[var(--radius-xs)] text-xs font-bold ${currency === cur ? 'bg-[var(--color-accent-base)] text-white' : 'text-[var(--color-text-secondary)]'}`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
        {convertedHint && <p className="text-xs text-[var(--color-text-secondary)] font-medium pl-1">{convertedHint}</p>}
      </div>

      {/* Category for pc */}
      <CategoryField
        control={control}
        filteredCategories={filteredCategories}
        isAiSuggesting={isAiSuggesting}
        inputBaseStyle={inputBaseStyle}
        sectionLabelStyle={sectionLabelStyle}
      />

      {/* Details */}
      <div className="space-y-4">
        <p className={sectionLabelStyle}>Details</p>
        <input {...register('description')} className={inputBaseStyle} placeholder="Description" />
        {descriptionSuggestionList}
        <div className="grid grid-cols-2 gap-3">
          <input {...register('date')} type="date" className={inputBaseStyle} />
          <PaymentMethodField control={control} paymentMethods={paymentMethods} inputBaseStyle={inputBaseStyle} />
        </div>
        <textarea {...register('note')} className={inputBaseStyle} placeholder="Optional note" rows={2} />
        {!isEditing && (
          <button
            type="button"
            onClick={saveAsTemplate}
            disabled={savingTemplate}
            className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-secondary)] opacity-60 hover:opacity-100 transition-opacity"
          >
            <BookmarkPlus size={14} />
            {savingTemplate ? 'Saving...' : 'Save as Template'}
          </button>
        )}
      </div>
    </form>
  )

  const sheetTitle = isDuplicate ? 'Duplicate' : isEditing ? 'Edit' : 'New'

  if (!isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title={sheetTitle} footer={
        <button form="tx-form" disabled={isSubmitting} className="w-full py-4 bg-[var(--color-accent-base)] text-white rounded-[var(--radius-md)] font-bold active:scale-[0.98] transition-all disabled:opacity-50">
          {isSubmitting ? 'Saving...' : 'SAVE'}
        </button>
      }>
        {desktopForm}
      </BottomSheet>
    )
  }

  // Mobile Version
  const mobilePanel = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-90 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 280 }}
            drag={canDrag ? 'y' : false} dragConstraints={{ top: 0 }} onDragEnd={(_, info) => { if (info.offset.y > 80) handleClose() }}
            className="fixed inset-0 z-100 flex flex-col bg-[var(--color-card-base)]"
          >
            <div className="flex shrink-0 justify-center pb-1" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}>
              <div className="h-1.5 w-10 rounded-full bg-[var(--color-border-base)] opacity-50" />
            </div>
            <div className="flex items-center justify-between px-6 pb-4 pt-2 border-b border-[var(--color-border-base)]">
              <h2 className="text-xl font-bold">{isDuplicate ? 'Duplicate Transaction' : isEditing ? 'Edit Transaction' : 'New Transaction'}</h2>
              <button onClick={handleClose} className="p-2 rounded-full bg-[var(--color-card-elevated-base)] text-[var(--color-text-secondary)]"><X size={20} /></button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 space-y-8" onScroll={() => setCanDrag(scrollRef.current?.scrollTop === 0)}>
              <form id="tx-form-mobile" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-6">
                  {quickAddPanel}
                  {templateStrip}
                  {/* Expense / Income */}
                  <div className="flex bg-[var(--color-card-elevated-base)] p-1 rounded-[var(--radius-lg)]">
                    {(['expense', 'income'] as const).map(opt => (
                      <button key={opt} type="button" onClick={() => { setValue('type', opt); haptic('light') }} className={`flex-1 py-3.5 rounded-[var(--radius-md)] text-sm font-black transition-all ${type === opt ? (opt === 'expense' ? 'bg-[var(--color-expense-base)] text-white shadow-lg' : 'bg-[var(--color-income-base)] text-white shadow-lg') : 'text-[var(--color-text-secondary)]'}`}>
                        {opt.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Amount and currency */}
                  <div onClick={() => setShowKeypad(true)} aria-label="Amount" className={`p-6 rounded-[var(--radius-lg)] border-2 transition-all ${showKeypad ? 'border-[var(--color-accent-base)] bg-[var(--color-accent-base)]/[0.03]' : 'border-[var(--color-border-base)] bg-[var(--color-card-elevated-base)]'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex bg-[var(--color-card-base)] p-1 rounded-[var(--radius-sm)]">
                        {(['KRW', 'USD'] as const).map(cur => (
                          <button key={cur} type="button" onPointerDown={(e) => { e.preventDefault(); setValue('currency', cur); haptic('light') }} className={`px-4 py-1.5 rounded-[var(--radius-xs)] text-xs font-black ${currency === cur ? 'bg-[var(--color-accent-base)] text-white' : 'text-[var(--color-text-secondary)]'}`}>
                            {cur}
                          </button>
                        ))}
                      </div>
                      <span className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Amount</span>
                    </div>
                    <div className="flex items-baseline justify-end gap-2 overflow-hidden">
                      <span className="text-xl font-black text-[var(--color-text-secondary)]">{currency === 'USD' ? '$' : '₩'}</span>
                      <span className="text-4xl font-black tracking-tighter truncate">{amountFormatted}</span>
                    </div>
                    {convertedHint && <p className="text-right mt-2 text-sm font-bold text-[var(--color-accent-base)]">{convertedHint}</p>}
                  </div>

                  {/* Category */}
                  <CategoryField
                    control={control}
                    filteredCategories={filteredCategories}
                    isAiSuggesting={isAiSuggesting}
                    inputBaseStyle={inputBaseStyle}
                    sectionLabelStyle={sectionLabelStyle}
                  />

                  {/* Description */}
                  <div>
                    <input {...register('description')} onFocus={() => setShowKeypad(false)} className={`${inputBaseStyle} font-bold`} placeholder="Description" />
                    {descriptionSuggestionList}
                  </div>

                  {/* Date */}
                  <div>
                    <p className={sectionLabelStyle}>Date</p>
                    <input {...register('date')} type="date" onFocus={() => setShowKeypad(false)} className={inputBaseStyle} />
                  </div>

                  {/* Payment Method */}
                  <div>
                    <p className={sectionLabelStyle}>Payment Method</p>
                    <PaymentMethodField control={control} paymentMethods={paymentMethods} inputBaseStyle={inputBaseStyle} />
                  </div>

                  {/* Note */}
                  <div>
                    <p className={sectionLabelStyle}>Note</p>
                    <textarea {...register('note')} onFocus={() => setShowKeypad(false)} className={inputBaseStyle} placeholder="Add a note..." rows={2} />
                  </div>

                  {/* Save as Template */}
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={saveAsTemplate}
                      disabled={savingTemplate}
                      className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-secondary)] opacity-60"
                    >
                      <BookmarkPlus size={16} />
                      {savingTemplate ? 'Saving...' : 'Save as Template'}
                    </button>
                  )}
                </div>
              </form>
            </div>

            {!keyboardVisible && (
              <div className="shrink-0 bg-[var(--color-card-base)]">
                <AnimatePresence mode="wait">
                  {showKeypad ? (
                    <motion.div key="keypad" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}>
                      <NumericKeypad onInput={handleKeypadInput} onDelete={handleKeypadDelete} onDone={() => { handleCalculate(); setShowKeypad(false) }} onCalculate={handleCalculate} />
                    </motion.div>
                  ) : (
                    <motion.div key="done" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="px-6 py-8 border-t border-[var(--color-border-base)] pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">
                      <button form="tx-form-mobile" disabled={isSubmitting} className="w-full py-4 bg-[var(--color-accent-base)] text-white rounded-[var(--radius-lg)] font-black text-base shadow-xl shadow-blue-500/20 active:scale-[0.97] transition-all">
                        {isSubmitting ? 'SAVING...' : '✓ DONE'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(mobilePanel, document.body) : null
}
