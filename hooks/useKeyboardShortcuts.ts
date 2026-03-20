import { useEffect } from 'react'

interface Shortcut {
  key: string
  meta?: boolean
  shift?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return

      for (const s of shortcuts) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()
        const metaMatch = s.meta ? (e.metaKey || e.ctrlKey) : true
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        if (keyMatch && metaMatch && shiftMatch) {
          e.preventDefault()
          s.action()
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
