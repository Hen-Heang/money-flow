'use client'

import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'
import { haptic } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface BudgetAlertsProps {
  alerts: {
    name: string
    icon: string
    spent: number
    budget: number
    over: boolean
    pct: number
  }[]
  dismissed: boolean
  onDismiss: () => void
}

export const BudgetAlerts = memo(function BudgetAlerts({ alerts, dismissed, onDismiss }: BudgetAlertsProps) {
  const router = useRouter()
  if (alerts.length === 0 || dismissed) return null

  const isCritical = alerts.some(a => a.over)

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`group relative overflow-hidden rounded-[28px] border p-5 shadow-lg transition-colors duration-500 ${
          isCritical 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <AlertTriangle size={16} />
            </div>
            <span className={`text-sm font-semibold ${isCritical ? 'text-red-400' : 'text-amber-400'}`}>
              {isCritical ? 'Budget exceeded' : 'Budget nearly reached'}
            </span>
          </div>
          <button 
            type="button"
            onClick={() => { haptic('light'); onDismiss() }} 
            aria-label="Dismiss budget alert"
            className="p-1.5 hover:bg-white/5 rounded-full opacity-40 hover:opacity-100 transition-all active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5">
          {alerts.map(alert => (
            <button
              type="button"
              key={alert.name} 
              onClick={() => { haptic('medium'); router.push('/analytics') }} 
              className="group/item block w-full rounded-xl text-left"
            >
              <div className="flex justify-between mb-2.5">
                <span className="text-sm font-bold flex items-center gap-2">
                  <span className="text-lg">{alert.icon}</span>
                  {alert.name}
                </span>
                <span className={`text-xs font-semibold tabular-nums ${alert.over ? 'text-red-400' : 'text-amber-400'}`}>
                  {alert.pct}% used
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden p-[1px] border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(alert.pct, 100)}%` }}
                  className={`h-full rounded-full shadow-lg transition-all duration-1000 ${
                    alert.over ? 'bg-red-500' : 'bg-amber-500'
                  }`} 
                />
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  )
})
