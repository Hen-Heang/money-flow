'use client'

import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import type { DailyDataPoint } from './AnalyticsTabs'

interface TrendsPanelProps {
  dailyData: DailyDataPoint[]
  isDesktop: boolean
}

export default function TrendsPanel({ dailyData, isDesktop }: TrendsPanelProps) {
  return (
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
  )
}
