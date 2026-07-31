'use client'

import { useState } from 'react'
import type { FilterType, SortOption } from '../_types'

export function useTransactionFilters() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortOption>('date')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAmountMin, setFilterAmountMin] = useState('')
  const [filterAmountMax, setFilterAmountMax] = useState('')

  const activeFilterCount = [filterDateFrom, filterDateTo, filterCategory, filterAmountMin, filterAmountMax].filter(Boolean).length

  const clearFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setFilterCategory('')
    setFilterAmountMin('')
    setFilterAmountMax('')
  }

  return {
    filter, setFilter,
    sort, setSort,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    filterCategory, setFilterCategory,
    filterAmountMin, setFilterAmountMin,
    filterAmountMax, setFilterAmountMax,
    activeFilterCount,
    clearFilters,
  }
}
