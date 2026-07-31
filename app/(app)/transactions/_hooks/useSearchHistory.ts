'use client'

import { useState, useEffect, useCallback } from 'react'
import { SEARCH_HISTORY_MAX } from '@/shared/presets'

export function useSearchHistory() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('txSearchHistory') || '[]') } catch { return [] }
  })
  const [showHistory, setShowHistory] = useState(false)

  const addToSearchHistory = useCallback((term: string) => {
    if (!term.trim()) return
    setSearchHistory(prev => {
      const updated = [term, ...prev.filter(h => h !== term)].slice(0, SEARCH_HISTORY_MAX)
      localStorage.setItem('txSearchHistory', JSON.stringify(updated))
      return updated
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      if (search.trim()) addToSearchHistory(search.trim())
    }, 400)
    return () => clearTimeout(timer)
  }, [search, addToSearchHistory])

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem('txSearchHistory')
  }

  return {
    search, setSearch,
    debouncedSearch,
    searchHistory, clearHistory,
    showHistory, setShowHistory,
  }
}
