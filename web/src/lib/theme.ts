import { useSyncExternalStore } from 'react'
import { DEFAULT_THEME } from '../config'

/**
 * Dark or light, by the switch in Settings, kept in this browser. index.html puts it on <html data-theme> before the
 * page draws (no flash); every color token in styles.css goes by that attribute, never by a media query. Until the
 * person chooses, DEFAULT_THEME decides — 'system' follows the device and keeps following it while the page is open.
 */
export type Theme = 'dark' | 'light'

const KEY = 'theme'
const BARS: Record<Theme, string> = { dark: '#000000', light: '#f2f2f7' }
const listeners = new Set<() => void>()

function chosen(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', BARS[theme])
  listeners.forEach((l) => l())
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* private mode: it lasts till the page closes */
  }
  apply(theme)
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'),
  )
}

// 'system' and nothing chosen yet: the device switching its theme switches the page too
if (DEFAULT_THEME === 'system') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  mql.addEventListener('change', () => {
    if (!chosen()) apply(mql.matches ? 'dark' : 'light')
  })
}
