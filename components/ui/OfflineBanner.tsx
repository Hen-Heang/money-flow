'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    // Set initial state after mount (navigator.onLine is browser-only)
    setOffline(!navigator.onLine)
    const goOffline = () => setOffline(true)
    const goOnline  = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed top-0 inset-x-0 z-[999] flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest text-white"
          style={{ backgroundColor: '#ef4444', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
        >
          <WifiOff size={13} />
          You're offline — showing cached data
        </motion.div>
      )}
    </AnimatePresence>
  )
}
