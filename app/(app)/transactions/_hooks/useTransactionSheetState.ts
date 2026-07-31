'use client'

import { useState, useCallback } from 'react'
import { haptic } from '@/lib/utils'
import type { Transaction } from '@/lib/types'
import type { EditTransaction } from '@/components/transactions/AddTransactionSheet'

export function useTransactionSheetState() {
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<EditTransaction | undefined>()
  const [isDuplicating, setIsDuplicating] = useState(false)

  const handleEdit = useCallback((t: Transaction) => {
    haptic('light')
    setIsDuplicating(false)
    setEditingTransaction({ ...t, currency: t.currency, exchange_rate: t.exchange_rate })
    setShowAddSheet(true)
  }, [])

  const handleNewTransaction = useCallback(() => {
    setEditingTransaction(undefined)
    setIsDuplicating(false)
    setShowAddSheet(true)
  }, [])

  const handleDuplicate = useCallback((t: Transaction) => {
    setEditingTransaction({ ...t, currency: t.currency, exchange_rate: t.exchange_rate })
    setIsDuplicating(true)
    setShowAddSheet(true)
    haptic('light')
  }, [])

  const handleSheetClose = useCallback(() => {
    setShowAddSheet(false)
    setEditingTransaction(undefined)
    setIsDuplicating(false)
  }, [])

  return {
    showAddSheet, setShowAddSheet,
    editingTransaction, setEditingTransaction,
    isDuplicating,
    handleEdit,
    handleNewTransaction,
    handleDuplicate,
    handleSheetClose,
  }
}
