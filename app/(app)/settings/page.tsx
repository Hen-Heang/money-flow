'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { haptic } from '@/lib/utils'
import { useSettingsData } from './_hooks/useSettingsData'
import { ProfileHeader } from './_components/ProfileHeader'
import { AppearanceSection } from './_components/AppearanceSection'
import { AIAssistantSection } from './_components/AIAssistantSection'
import { CategoriesSection } from './_components/CategoriesSection'
import { PaymentMethodsSection } from './_components/PaymentMethodsSection'
import { TelegramSection } from './_components/TelegramSection'
import { BudgetsSection } from './_components/BudgetsSection'
import { EducationSection } from './_components/EducationSection'
import { DataSafetySection } from './_components/DataSafetySection'
import { Group } from './_components/Primitives'
import type { SettingsSection } from './_types'

export default function SettingsPage() {
  const {
    profile, setProfile,
    categories, paymentMethods, budgets, budgetInputs, setBudgetInputs,
    aiProvider, aiSwitching, switchAIProvider,
    telegramLinked, setTelegramLinked,
    deleteCategory, addCategory,
    deletePaymentMethod, addPaymentMethod,
    saveBudget,
  } = useSettingsData()

  const [activeSection, setActiveSection] = useState<SettingsSection | null>(null)
  const toggleSection = (section: SettingsSection) =>
    setActiveSection(prev => prev === section ? null : section)

  return (
    <div className="px-mobile pt-6 pb-12 max-w-2xl mx-auto overflow-x-hidden">
      <ProfileHeader profile={profile} setProfile={setProfile} />

      <AppearanceSection />

      <AIAssistantSection
        aiProvider={aiProvider}
        aiSwitching={aiSwitching}
        switchAIProvider={switchAIProvider}
        activeSection={activeSection}
        onToggle={toggleSection}
      />

      <Group title="Personalization">
        <CategoriesSection
          categories={categories}
          deleteCategory={deleteCategory}
          addCategory={addCategory}
          activeSection={activeSection}
          onToggle={toggleSection}
        />
        <PaymentMethodsSection
          paymentMethods={paymentMethods}
          deletePaymentMethod={deletePaymentMethod}
          addPaymentMethod={addPaymentMethod}
          activeSection={activeSection}
          onToggle={toggleSection}
        />
      </Group>

      <TelegramSection
        telegramLinked={telegramLinked}
        setTelegramLinked={setTelegramLinked}
        activeSection={activeSection}
        onToggle={toggleSection}
      />

      <BudgetsSection
        categories={categories}
        budgets={budgets}
        budgetInputs={budgetInputs}
        setBudgetInputs={setBudgetInputs}
        saveBudget={saveBudget}
        activeSection={activeSection}
        onToggle={toggleSection}
      />

      <EducationSection activeSection={activeSection} onToggle={toggleSection} />

      <DataSafetySection />

      <div className="flex flex-col items-center gap-2 opacity-30 mt-4 pb-2">
         <p className="text-[10px] font-black uppercase tracking-[0.4em]">Money Flow</p>
         <p className="text-[9px] font-bold">Version 1.2.0 • Pro Edition</p>
      </div>

      <div className="flex justify-center pb-8">
        <button
          onClick={async () => {
            haptic('light')
            const t = toast.loading('Checking version...')
            try {
              const res = await fetch('/api/version')
              const { version } = await res.json() as { version: string }
              toast.success(`v${version} — You're on the latest version`, { id: t, duration: 3000 })
            } catch {
              toast.error('Could not check version', { id: t })
            }
          }}
          className="text-[10px] font-black uppercase tracking-widest text-[var(--color-accent-base)] px-4 py-2 rounded-full bg-blue-500/5 active:scale-95 transition-all"
        >
          Check for updates
        </button>
      </div>
    </div>
  )
}
