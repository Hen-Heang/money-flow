'use client'

import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie,
  LineChart, Line,
} from 'recharts'
import { CalendarClock, ShieldCheck, ShieldAlert } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/constants'
import { TrendBadge } from './TrendIndicators'
import type { AnalyticsDerived, Period } from '../_types'

const cardStyle = {
  backgroundColor: 'var(--color-card-base)',
  borderRadius: '20px',
  padding: '20px',
  marginBottom: '16px',
}

export function TrendsView({ loading, period, derived }: { loading: boolean; period: Period; derived: AnalyticsDerived }) {
  const {
    monthlyData, netFlowData, categoryData, categoryMap, prevCatMap,
    budgetComparison, overBudgetCount, totalIncome, totalExpense, avgMonthly,
    savingsRate, prevIncome, prevExpense, prevSavings, curSavings,
    paymentMethodData, forecast,
  } = derived

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-40 rounded-[20px]" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-20 rounded-[16px]" />
          <div className="skeleton h-20 rounded-[16px]" />
          <div className="skeleton h-20 rounded-[16px]" />
          <div className="skeleton h-20 rounded-[16px]" />
        </div>
        <div className="skeleton h-56 rounded-[20px]" />
        <div className="skeleton h-44 rounded-[20px]" />
      </div>
    )
  }

  return (
    <>
      {/* Forecast card — current month projection */}
      {forecast.dayOfMonth > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 overflow-hidden rounded-[20px] border border-white/10 p-5"
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.06) 100%)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-[13px] font-black uppercase tracking-widest text-blue-400">
                {format(new Date(), 'MMMM')} Forecast
              </p>
            </div>
            <span className="text-[11px] font-bold opacity-40">
              Day {forecast.dayOfMonth} of {forecast.daysInMonth} · {forecast.daysRemaining}d left
            </span>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Spent', value: formatKRW(forecast.thisMonthSpend), color: 'var(--color-text-primary)' },
              { label: 'Projected', value: formatKRW(Math.round(forecast.projectedSpend)), color: forecast.projectedVsBudget !== null && forecast.projectedVsBudget > 0 ? '#ef4444' : '#22c55e' },
              { label: 'Daily', value: formatKRW(Math.round(forecast.dailyRate)), color: 'var(--color-text-primary)' },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40 mb-1">{m.label}</p>
                <p className="text-[12px] font-black leading-tight break-all" style={{ color: m.color }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Budget impact */}
          {forecast.projectedVsBudget !== null && (
            <div
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5 mb-4"
              style={{
                backgroundColor: forecast.projectedVsBudget > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${forecast.projectedVsBudget > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
              }}
            >
              {forecast.projectedVsBudget > 0
                ? <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                : <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
              }
              <p className="text-[12px] font-bold" style={{ color: forecast.projectedVsBudget > 0 ? '#f87171' : '#4ade80' }}>
                {forecast.projectedVsBudget > 0
                  ? `Projected to exceed total budget by ${formatKRW(Math.round(forecast.projectedVsBudget))}`
                  : `On track — ${formatKRW(Math.round(Math.abs(forecast.projectedVsBudget)))} under budget`
                }
              </p>
            </div>
          )}

          {/* Per-category projections */}
          {forecast.categoryForecast.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-40 mb-2">Category Outlook</p>
              {forecast.categoryForecast.map(({ cat, projected, budget, pct }) => {
                const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e'
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {cat.icon} {cat.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black" style={{ color: barColor }}>
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-[10px] opacity-40 font-medium">
                          {formatKRW(Math.round(projected))} / {formatKRW(budget)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        style={{ backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}50` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Budget vs Actual — current month */}
      {budgetComparison.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Budget vs Actual
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {format(new Date(), 'MMMM')}
              </span>
              {overBudgetCount > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'var(--color-expense-base)' }}
                >
                  {overBudgetCount} over
                </span>
              )}
              {overBudgetCount === 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-black"
                  style={{ backgroundColor: 'rgba(16,185,129,0.12)', color: 'var(--color-income-base)' }}
                >
                  On track
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {budgetComparison.map(({ cat, spent, budget, pct, over }) => {
              const barColor = over
                ? 'var(--color-expense-base)'
                : pct >= 80
                  ? 'var(--color-warning-base)'
                  : 'var(--color-income-base)'

              return (
                <div key={cat!.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {cat!.icon} {cat!.name}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: over ? 'var(--color-expense-base)' : 'var(--color-text-secondary)' }}>
                        {formatKRW(spent)}
                      </span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>/</span>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{formatKRW(budget)}</span>
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: barColor }}>{pct.toFixed(0)}% used</span>
                    {over
                      ? <span style={{ color: 'var(--color-expense-base)' }}>+{formatKRW(spent - budget)} over</span>
                      : <span>{formatKRW(budget - spent)} left</span>
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          {
            label: `${period} Income`, value: formatKRW(totalIncome), color: 'var(--color-income-base)',
            trend: <TrendBadge current={totalIncome} previous={prevIncome} />,
          },
          {
            label: `${period} Expense`, value: formatKRW(totalExpense), color: 'var(--color-expense-base)',
            trend: <TrendBadge current={totalExpense} previous={prevExpense} invertColor />,
          },
          {
            label: 'Avg / Month', value: formatKRW(avgMonthly), color: 'var(--color-accent-base)',
            trend: null,
          },
          {
            label: 'Savings Rate', value: `${savingsRate}%`, color: 'var(--color-warning-base)',
            trend: <TrendBadge current={curSavings} previous={prevSavings} />,
          },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ backgroundColor: 'var(--color-card-base)', borderRadius: '16px', padding: '16px' }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</p>
              {stat.trend}
            </div>
            <p className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Monthly Income vs Expense */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Income vs Expense · {period}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-card-elevated-base)',
                border: '1px solid var(--color-border-base)',
                borderRadius: '12px',
                color: 'var(--color-text-primary)',
              }}
              formatter={(value) => [formatKRW(Number(value))]}
            />
            <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--color-text-secondary)' }} />
            <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
            <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Net Flow */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Net Cash Flow</h3>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={netFlowData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-base)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-card-elevated-base)',
                border: '1px solid var(--color-border-base)',
                borderRadius: '12px',
                color: 'var(--color-text-primary)',
              }}
              formatter={(value) => [formatKRW(Number(value)), 'Net']}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Category Breakdown */}
      {categoryData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Expense by Category · {period}
          </h3>
          <div className="flex gap-4 items-center mb-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={categoryData.map((entry, i) => ({ ...entry, fill: entry.color || CHART_COLORS[i % CHART_COLORS.length] }))} dataKey="total" cx="50%" cy="50%" innerRadius={30} outerRadius={55} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {categoryData.slice(0, 5).map((cat, index) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatKRW(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bar list */}
          <div className="space-y-3">
            {categoryData.map((cat, index) => {
              const max = categoryData[0].total
              const curCat = categoryMap[cat.name]?.total || 0
              const prevCat = prevCatMap[cat.name] || 0
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <TrendBadge current={curCat} previous={prevCat} invertColor />
                      <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {formatKRW(cat.total)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.total / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: index * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Payment Method Breakdown */}
      {paymentMethodData.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Expense by Payment Method · {period}
          </h3>
          <div className="flex gap-4 items-center mb-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={paymentMethodData.map((entry, i) => ({ ...entry, fill: CHART_COLORS[i % CHART_COLORS.length] }))}
                  dataKey="total"
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {paymentMethodData.slice(0, 5).map((pm, i) => (
                <div key={pm.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                      {pm.icon} {pm.name}
                    </span>
                  </div>
                  <span className="ml-2 shrink-0 text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {formatKRW(pm.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {paymentMethodData.map((pm, i) => {
              const max = paymentMethodData[0].total
              return (
                <div key={pm.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {pm.icon} {pm.name}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {formatKRW(pm.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(pm.total / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </>
  )
}
