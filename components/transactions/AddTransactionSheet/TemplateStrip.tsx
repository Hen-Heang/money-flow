import { Trash2 } from 'lucide-react'
import type { Template } from './types'

export function TemplateStrip({
  isEditing,
  templates,
  activeExchangeRate,
  applyTemplate,
  deleteTemplate,
  sectionLabelStyle,
}: {
  isEditing: boolean
  templates: Template[]
  activeExchangeRate: number
  applyTemplate: (t: Template) => void
  deleteTemplate: (id: string) => void
  sectionLabelStyle: string
}) {
  if (isEditing || templates.length === 0) return null

  return (
    <div className="mb-4">
      <p className={sectionLabelStyle}>Templates</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {templates.map(t => (
          <div key={t.id} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => applyTemplate(t)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all active:scale-95"
              style={{
                backgroundColor: t.type === 'expense'
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(16,185,129,0.12)',
                color: t.type === 'expense'
                  ? 'var(--color-expense-base)'
                  : 'var(--color-income-base)',
                border: `1px solid ${t.type === 'expense' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
              }}
            >
              <span>{t.categories?.icon ?? (t.type === 'expense' ? '💸' : '💰')}</span>
              <span className="max-w-[80px] truncate">{t.description}</span>
              <span className="opacity-60">
                {t.currency === 'USD' ? `$${(t.amount_krw / activeExchangeRate).toFixed(0)}` : `₩${Math.round(t.amount_krw).toLocaleString()}`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => deleteTemplate(t.id)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center hidden group-hover:flex active:scale-90"
            >
              <Trash2 size={8} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
