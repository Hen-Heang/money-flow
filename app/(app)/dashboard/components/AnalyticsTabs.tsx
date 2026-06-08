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
      <div className="flex gap-8 sm:gap-12 border-b border-white/5 mb-8 overflow-x-auto no-scrollbar pt-2">
        {(['overview', 'trends', 'categories'] as const).map(tab => (
          <button 
            key={tab} 
            onClick={() => { setActiveTab(tab) }} 
            className={`pb-4 text-tiny font-black tracking-[0.25em] relative transition-all whitespace-nowrap ${
              activeTab === tab ? 'text-white' : 'text-[var(--color-text-secondary)] opacity-40 hover:opacity-100'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="tab-line" 
                className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full shadow-[0_0_12px_rgba(59,130,246,0.6)]" 
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab} 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -10 }} 
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {activeTab === 'overview' && children}

          {activeTab === 'trends' && (
            <div className="card-premium p-6 sm:p-10 min-h-[420px] bg-white/[0.01]">
              <h3 className="text-tiny font-black opacity-40 mb-10 text-center tracking-[0.3em]">Capital Flow Trendline</h3>
              <div className="h-[320px] sm:h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent-base)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--color-accent-base)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(255,255,255,0.3)' }} 
                      interval={isDesktop ? 2 : 4} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 900, fill: 'rgba(255,255,255,0.3)' }} 
                      width={45} 
                      tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(v)} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(10, 15, 26, 0.95)', 
                        backdropFilter: 'blur(20px)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '20px', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        fontWeight: 900,
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
            <div className="card-premium p-6 sm:p-10 bg-white/[0.01]">
               <h3 className="text-tiny font-black opacity-40 mb-10 text-center tracking-[0.3em]">Resource Distribution</h3>
               <div className="flex flex-col xl:flex-row items-center gap-12">
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
                            backgroundColor: 'rgba(10, 15, 26, 0.95)', 
                            backdropFilter: 'blur(20px)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '20px',
                            fontWeight: 900
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full xl:w-1/2 space-y-4">
                    {categoryTotals.map((cat, i) => (
                      <div key={cat.name} className="flex items-center justify-between p-5 rounded-[24px] bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                        <div className="flex items-center gap-4 min-w-0">
                           <div 
                             className="w-4 h-4 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.5)] group-hover:scale-125 transition-transform" 
                             style={{ backgroundColor: cat.color || CHART_COLORS[i % CHART_COLORS.length] }} 
                           />
                           <span className="text-lg font-bold truncate tracking-tight text-white/90">
                             <span className="mr-2 text-2xl opacity-100">{cat.icon}</span>
                             {cat.name}
                           </span>
                        </div>
                        <span className="text-2xl font-black shrink-0 ml-2 tracking-tighter">{fmt(cat.total)}</span>
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
