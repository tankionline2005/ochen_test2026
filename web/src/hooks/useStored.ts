import { useState } from 'react'

/** useState remembered in localStorage (per-browser UI preference only). */
export function useStored<T extends string>(key: string, initial: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key) as T | null
      return saved && allowed.includes(saved) ? saved : initial
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, v)
    } catch {
      /* storage unavailable */
    }
  }
  return [value, set] as const
}

/** The same for any JSON value (a draft text, the last AI answer); a broken or missing value falls back to `initial`. */
export function useStoredJson<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? initial : (JSON.parse(saved) as T)
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* storage unavailable */
    }
  }
  return [value, set] as const
}
