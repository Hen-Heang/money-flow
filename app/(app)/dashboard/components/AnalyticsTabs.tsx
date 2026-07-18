'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie } from 'recharts'
import { CHART_COLORS } from '@/lib/constants'

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
            <div className="card-premium min-h-[390px] bg-[var(--color-card-base)] p-5 sm:p-8">
              <div className="mb-6">
                <h3 className="text-base font-semibold">Daily spending</h3>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Your expenses across the selected month</p>
              </div>
              <div className="h-[320px] sm:h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent-base)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-accent-base)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-base)" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-secondary)' }}
                      interval={isDesktop ? 2 : 4} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-secondary)' }}
                      width={45} 
                      tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--color-card-elevated-base)',
                        backdropFilter: 'blur(20px)', 
                        border: '1px solid var(--color-border-base)',
                        borderRadius: '16px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                        fontWeight: 650,
                        fontSize: '12px'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="expense" 
                      stroke="var(--color-accent-base)" 
                      strokeWidth={4} 
                      fill="url(#trendGrad)" 
                      animationDuration={1500} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="card-premium bg-[var(--color-card-base)] p-5 sm:p-8">
               <div className="mb-6">
                 <h3 className="text-base font-semibold">Spending by category</h3>
                 <p className="mt-1 text-sm text-[var(--color-text-secondary)]">See where most of your money went</p>
               </div>
               <div className="flex flex-col items-center gap-8 xl:flex-row">
                  <div className="w-full xl:w-1/2 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie 
                          data={categoryTotals.map((entry, i) => ({ ...entry, fill: entry.color || CHART_COLORS[i % CHART_COLORS.length] }))} 
                          dataKey="total" 
                          nameKey="name" 
                          innerRadius={90} 
                          outerRadius={120} 
                          paddingAngle={8} 
                          animationBegin={0} 
                          animationDuration={1500} 
                          stroke="none" 
                        />
                        <Tooltip 
                           contentStyle={{ 
                            backgroundColor: 'var(--color-card-elevated-base)',
                            backdropFilter: 'blur(20px)', 
                            border: '1px solid var(--color-border-base)',
                            borderRadius: '16px',
                            fontWeight: 650
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full space-y-3 xl:w-1/2">
                    {categoryTotals.map((cat, i) => (
                      <div key={cat.name} className="group flex items-center justify-between rounded-[20px] border border-[var(--color-border-base)] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06]">
                        <div className="flex items-center gap-4 min-w-0">
                           <div 
                             className="w-4 h-4 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover:scale-125 transition-transform" 
                             style={{ backgroundColor: cat.color || CHART_COLORS[i % CHART_COLORS.length] }} 
                           />
                           <span className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-base">
                             <span className="mr-2 text-xl opacity-100">{cat.icon}</span>
                             {cat.name}
                           </span>
                        </div>
                        <span className="ml-2 shrink-0 text-sm font-bold tracking-tight tabular-nums sm:text-base">{fmt(cat.total)}</span>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
})
