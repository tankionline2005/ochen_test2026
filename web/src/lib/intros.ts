import { useEffect, useSyncExternalStore } from 'react'
import { anyOpen } from './layers'

/**
 * Welcome cards (components/Intro.tsx) and one-time tips (components/Tip.tsx): which ones this person has seen, and
 * the cards open now. A section's cards open by themselves on its first visit, once; the «?» by its title (Page
 * onHelp) opens them again. A tip shows until closed, once.
 *
 * What was seen is kept in localStorage. With accounts, keep it on the server instead so a phone and a computer
 * agree: call `initIntros(me.intros_seen)` once you know who is signed in, and pass `onSeen` to save each key.
 */

let seen = new Set<string>()
let current: string | null = null
let save: ((key: string) => void) | null = null
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((l) => l())
const STORE = 'intros-seen'

try {
  seen = new Set(JSON.parse(localStorage.getItem(STORE) || '[]'))
} catch {
  /* private mode: they show once per page load */
}

/** What the server says this person has seen, and how to tell it about a new one (optional). */
export function initIntros(list: string[], onSeen?: (key: string) => void) {
  seen = new Set(list)
  save = onSeen ?? null
  tell()
}

function markSeen(key: string) {
  if (seen.has(key)) return
  seen.add(key)
  try {
    localStorage.setItem(STORE, JSON.stringify([...seen]))
  } catch {
    /* fine */
  }
  save?.(key)
}

function useStore<T>(read: () => T): T {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, read)
}

export function openIntro(key: string) {
  current = key
  tell()
}

/** The cards are closed — by the last button, «Skip» or a swipe down: that section's are seen. */
export function closeIntro() {
  const key = current
  current = null
  tell()
  if (key) markSeen(key)
}

export function useOpenIntro(): string | null {
  return useStore(() => current)
}

/**
 * A section shown: its cards open by themselves the first time, a moment after it appears (its screen transition
 * done) — or, if a window is already open there, once it is closed. `when`: false while the section can't show them
 * yet (still loading, not this person's).
 */
export function useFirstVisit(key: string, when = true) {
  useEffect(() => {
    if (!when || seen.has(key)) return
    let timer = 0
    const later = (ms: number) => {
      timer = window.setTimeout(() => {
        if (seen.has(key) || current !== null) return
        if (anyOpen()) later(700)
        else openIntro(key)
      }, ms)
    }
    later(550)
    return () => window.clearTimeout(timer)
  }, [key, when])
}

/** A one-time tip ("New: covers"): shown until closed. [shown, close]. */
export function useTip(key: string): [boolean, () => void] {
  const shown = useStore(() => !seen.has(key))
  const close = () => {
    markSeen(key)
    tell()
  }
  return [shown, close]
}
