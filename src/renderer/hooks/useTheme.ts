import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'pdf-viewer-theme'
const api = (window as any).electronAPI

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Sync native titlebar overlay colors with the renderer theme
  api?.setTheme?.(theme)
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    return stored ?? getSystemTheme()
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // Apply immediately on mount (avoids flash)
  useEffect(() => { applyTheme(theme) }, [])

  // Listen for system theme changes when no stored preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function onChange() {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(mq.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Listen for system theme events from main process (Electron nativeTheme updates)
  useEffect(() => {
    const handler = (t: string) => {
      // Always follow system updates regardless of stored preference (user requested auto-follow)
      setTheme(t === 'dark' ? 'dark' : 'light')
    }
    try {
      api?.onSystemTheme?.(handler)
    } catch {
      /* ignore if not available */
    }
    return () => {
      try { api?.removeAllListeners?.('theme:system') } catch {}
    }
  }, [])

  function toggle() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggle }
}
