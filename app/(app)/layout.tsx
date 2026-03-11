import TabBar from '@/components/layout/TabBar'
import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-h-screen"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <style>{`@media (min-width: 768px) { main { margin-left: 16rem; padding-bottom: 2rem; } }`}</style>
        {children}
      </main>
      <TabBar />
    </div>
  )
}
