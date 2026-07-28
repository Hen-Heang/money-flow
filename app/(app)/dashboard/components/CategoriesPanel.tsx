'use client'

import { ResponsiveContainer, PieChart, Pie, Tooltip } from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import type { CategoryTotal } from './AnalyticsTabs'

interface CategoriesPanelProps {
  categoryTotals: CategoryTotal[]
  fmt: (amount: number) => string
}

export default function CategoriesPanel({ categoryTotals, fmt }: CategoriesPanelProps) {
  return (
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
  )
}
