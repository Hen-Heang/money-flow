'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'
import { createClient } from '@/lib/supabase'
import { formatKRW } from '@/lib/utils'

interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense'
  amount_krw: number
  categories?: { name: string; icon: string; color: string } | null
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5))
      const now = endOfMonth(new Date())

      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name, icon, color)')
        .eq('user_id', user.id)
        .gte('date', format(sixMonthsAgo, 'yyyy-MM-dd'))
        .lte('date', format(now, 'yyyy-MM-dd'))
        .order('date', { ascending: true })

      setTransactions((data as Transaction[]) || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Monthly data for bar chart
  const monthlyData = []
  for (let i = 5; i >= 0; i--) {
    const m = subMonths(new Date(), i)
    const monthStr = format(m, 'yyyy-MM')
    const monthTxns = transactions.filter(t => t.date.startsWith(monthStr))
    monthlyData.push({
      month: format(m, 'MMM'),
      income: monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0),
      expense: monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0),
    })
  }

  // Category breakdown (all time expense)
  const categoryMap: Record<string, { name: string; icon: string; color: string; total: number }> = {}
  transactions
    .filter(t => t.type === 'expense' && t.categories)
    .forEach(t => {
      const cat = t.categories!
      if (!categoryMap[cat.name]) {
        categoryMap[cat.name] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0 }
      }
      categoryMap[cat.name].total += t.amount_krw
    })
  const categoryData = Object.values(categoryMap).sort((a, b) => b.total - a.total)

  // Net flow line chart (monthly)
  const netFlowData = monthlyData.map(m => ({
    month: m.month,
    net: m.income - m.expense,
  }))

  // Summary stats
  const totalIncome6M = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_krw, 0)
  const totalExpense6M = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_krw, 0)
  const avgMonthlyExpense = totalExpense6M / 6
  const savingsRate = totalIncome6M > 0 ? ((totalIncome6M - totalExpense6M) / totalIncome6M * 100).toFixed(1) : '0'

  const cardStyle = {
    backgroundColor: 'var(--color-card-base)',
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '16px',
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-6"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Analytics
      </motion.h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: '6M Income', value: formatKRW(totalIncome6M), color: 'var(--color-income-base)' },
          { label: '6M Expense', value: formatKRW(totalExpense6M), color: 'var(--color-expense-base)' },
          { label: 'Avg Monthly', value: formatKRW(avgMonthlyExpense), color: 'var(--color-accent-base)' },
          { label: 'Savings Rate', value: `${savingsRate}%`, color: 'var(--color-warning-base)' },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ backgroundColor: 'var(--color-card-base)', borderRadius: '16px', padding: '16px' }}
          >
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</p>
            <p className="text-base font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Monthly Income vs Expense */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={cardStyle}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Monthly Income vs Expense
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
            Expense by Category (6 months)
          </h3>
          <div className="flex gap-4 items-center mb-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={categoryData} dataKey="total" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                  {categoryData.map((entry, index) => (
                    <Cell key={entry.name} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {categoryData.slice(0, 5).map((cat, index) => (
                <div key={cat.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
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
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {cat.icon} {cat.name}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {formatKRW(cat.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-card-elevated-base)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.total / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: index * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color || COLORS[index % COLORS.length] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-income-base)', borderTopColor: 'transparent' }}
          />
        </div>
      )}
    </div>
  )
}
