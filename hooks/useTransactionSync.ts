import { useEffect } from 'react'

const TRANSACTIONS_CHANGED_EVENT = 'money-flow:transactions-changed'

/** Notifies every mounted page that transaction data changed so they can refetch. */
export function emitTransactionsChanged() {
  window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED_EVENT))
}

/** Refetch hook for pages showing transaction-derived data (balance, lists, budgets, analytics). */
export function useTransactionsChanged(onChange: () => void) {
  useEffect(() => {
    window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChange)
  }, [onChange])
}
