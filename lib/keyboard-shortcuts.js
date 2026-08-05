'use client'

import { useEffect } from 'react'

const SHORTCUTS = {
  'ctrl+enter': { action: 'publish', label: 'Publish current' },
  'ctrl+s': { action: 'save_draft', label: 'Save draft' },
  'escape': { action: 'cancel', label: 'Cancel/Close' },
  '?': { action: 'show_help', label: 'Show shortcuts' },
}

export function useKeyboardShortcuts(handlers = {}) {
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key !== 'Escape' && e.key !== '?') return
      }

      const key = []
      if (e.ctrlKey || e.metaKey) key.push('ctrl')
      if (e.key.toLowerCase() === 'enter') key.push('enter')
      else if (e.key === 'Escape') key.push('escape')
      else if (e.key === 's' && (e.ctrlKey || e.metaKey)) key.push('ctrl', 's')
      else if (e.key === '?') key.push('?')
      
      const combo = key.join('+')
      const shortcut = SHORTCUTS[combo]
      if (shortcut && handlers[shortcut.action]) {
        e.preventDefault()
        handlers[shortcut.action](e)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handlers])
}
