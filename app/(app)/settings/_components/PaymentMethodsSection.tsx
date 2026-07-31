'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { CreditCard, Trash2, Plus, X, Check } from 'lucide-react'
import { haptic } from '@/lib/utils'
import type { PaymentMethod } from '@/lib/types'
import { Row } from './Primitives'
import type { SettingsSection } from '../_types'

export function PaymentMethodsSection({
  paymentMethods,
  deletePaymentMethod,
  addPaymentMethod,
  activeSection,
  onToggle,
}: {
  paymentMethods: PaymentMethod[]
  deletePaymentMethod: (id: string) => void
  addPaymentMethod: (name: string, icon: string) => void
  activeSection: SettingsSection | null
  onToggle: (section: SettingsSection) => void
}) {
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false)
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('')
  const [newPaymentMethodIcon, setNewPaymentMethodIcon] = useState('💳')

  const handleAdd = () => {
    const name = newPaymentMethodName.trim()
    const icon = newPaymentMethodIcon.trim() || '💳'
    if (!name) { toast.error('Name required'); return }
    addPaymentMethod(name, icon)
    setNewPaymentMethodName('')
    setIsAddingPaymentMethod(false)
  }

  return (
    <>
      <Row
        icon={CreditCard}
        color="var(--color-accent-base)"
        title="Payment Methods"
        subtitle={`${paymentMethods.length} methods linked`}
        onClick={() => { haptic('light'); onToggle('payment') }}
        active={activeSection === 'payment'}
      />
      <AnimatePresence>
        {activeSection === 'payment' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-[var(--color-card-elevated-base)]/30 divide-y divide-[var(--color-border-base)]">
              {paymentMethods.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="text-xl w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 shadow-sm">{m.icon}</span>
                  <p className="flex-1 text-sm font-bold">{m.name}</p>
                  <button onClick={() => deletePaymentMethod(m.id)} className="p-2 rounded-lg text-red-400">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button onClick={() => setIsAddingPaymentMethod(!isAddingPaymentMethod)} className="w-full flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest text-[var(--color-accent-base)]">
                {isAddingPaymentMethod ? <X size={14}/> : <Plus size={14} strokeWidth={3}/>}
                {isAddingPaymentMethod ? 'Cancel' : 'Add Payment Method'}
              </button>
              {isAddingPaymentMethod && (
                <div className="px-5 pb-5 pt-2">
                  <div className="flex gap-2">
                    <input value={newPaymentMethodIcon} onChange={e => setNewPaymentMethodIcon(e.target.value)} className="w-14 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl text-center text-xl" maxLength={2} />
                    <input value={newPaymentMethodName} onChange={e => setNewPaymentMethodName(e.target.value)} placeholder="Method Name" className="flex-1 bg-[var(--color-card-base)] border border-[var(--color-border-base)] rounded-xl px-4 text-sm font-bold outline-none" />
                    <button onClick={handleAdd} className="w-10 h-10 rounded-xl bg-[var(--color-income-base)] flex items-center justify-center text-white"><Check size={18} strokeWidth={3}/></button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
