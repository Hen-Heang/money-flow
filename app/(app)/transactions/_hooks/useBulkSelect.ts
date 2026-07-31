'use client'

import { useState, useCallback } from 'react'

export function useBulkSelect() {
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  return {
    selectMode, setSelectMode,
    selectedIds, setSelectedIds,
    toggleSelect,
    exitSelectMode,
  }
}
