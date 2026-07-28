'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'

// recharts is a large dependency only needed once a user switches off the
// default "overview" tab — code-split it so it doesn't inflate the initial
// dashboard bundle every user pays for on first load.
const TrendsPanel = dynamic(() => import('./TrendsPanel'), { ssr: false })
const CategoriesPanel = dynamic(() => import('./CategoriesPanel'), { ssr: false })

export interface DailyDataPoint {
  day: string
  expense: number
}

export interface CategoryTotal {
  name: string
  icon: string
  color: string
  total: number
}

interface AnalyticsTabsProps {
  activeTab: 'overview' | 'trends' | 'categories'
  setActiveTab: (tab: 'overview' | 'trends' | 'categories') => void
  dailyData: DailyDataPoint[]
  categoryTotals: CategoryTotal[]
  isDesktop: boolean
  fmt: (amount: number) => string
  children: React.ReactNode // For RecentActivity and Budget Pill in overview
}

export const AnalyticsTabs = memo(function AnalyticsTabs({
  activeTab,
  setActiveTab,
  dailyData,
  categoryTotals,
  isDesktop,
  fmt,
  children
}: AnalyticsTabsProps) {
  return (
    <div className="px-5 sm:px-0">
      <div role="tablist" aria-label="Dashboard views" className="no-scrollbar mb-6 flex gap-6 overflow-x-auto border-b border-[var(--color-border-base)] pt-1 sm:gap-8">
        {(['overview', 'trends', 'categories'] as const).map(tab => (
          <button 
            type="button"
            role="tab"
            key={tab} 
            id={`dashboard-tab-${tab}`}
            aria-selected={activeTab === tab}
            aria-controls={`dashboard-panel-${tab}`}
            onClick={() => { setActiveTab(tab) }} 
            className={`relative whitespace-nowrap pb-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="tab-line" 
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--color-accent-base)]"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab} 
          id={`dashboard-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`dashboard-tab-${activeTab}`}
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -10 }} 
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {activeTab === 'overview' && children}

          {activeTab === 'trends' && (
            <TrendsPanel dailyData={dailyData} isDesktop={isDesktop} />
          )}

          {activeTab === 'categories' && (
            <CategoriesPanel categoryTotals={categoryTotals} fmt={fmt} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
})
