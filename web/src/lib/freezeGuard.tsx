import { useIsPresent } from 'framer-motion'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { CLIENT_LOG_URL } from '../config'

/*
 * The page that "freezes" now and then — stops scrolling and ignores taps — on any screen.
 *
 * Two causes, both real and both found the hard way:
 *
 * 1. A window that never left. framer-motion's AnimatePresence sometimes never finishes an exit when a layout
 *    animation runs elsewhere on the page at that moment (a text unfolding with `layout`, rows moving, a number
 *    rolling). The window's backdrop stays in the DOM at opacity 0 over the whole screen and catches every tap and
 *    swipe. Fix: a leaving window stops catching pointer events the moment its exit starts, and is display:none'd
 *    after the longest exit could have ended — whether or not the library removes it.
 *
 * 2. A scroll lock put back wrong. Each window used to remember body.style.overflow and restore it on close; two
 *    windows closing in another order than they opened (a photo still fading as a sheet opens) restored the other
 *    one's "hidden" and the page stayed locked with nothing open. Fix: windows hold a counted lock; the page scrolls
 *    again when the last one lets go.
 *
 * And a guard watches every tap, wheel and swipe: a lock nobody holds, or an invisible full-screen layer catching
 * taps, is undone on the spot and reported (CLIENT_LOG_URL in config.ts) with what was on screen.
 *
 * Every overlay inside AnimatePresence uses `useLeavingStyle`/`<Leaving>` and `useScrollLock` — Sheet, ActionSheet
 * and Alert already do.
 */

let locks = 0

const HIDE_AFTER = 700 // the longest of the windows' exit animations, and some

/** How a window inside AnimatePresence leaves: lets taps through at once, hidden after its exit had time to end. */
export function useLeavingStyle(): CSSProperties | undefined {
  const present = useIsPresent()
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (present) return
    const timer = window.setTimeout(() => setGone(true), HIDE_AFTER)
    return () => window.clearTimeout(timer)
  }, [present])
  return present ? undefined : gone ? { pointerEvents: 'none', display: 'none' } : { pointerEvents: 'none' }
}

/** The same for a window of several layers (a backdrop and a sheet): the style is handed to each of them. */
export function Leaving({ children }: { children: (style: CSSProperties | undefined) => ReactNode }) {
  return <>{children(useLeavingStyle())}</>
}

function apply() {
  document.body.style.overflow = locks > 0 ? 'hidden' : ''
}

/** The page does not scroll while `active` (a window is open over it). Counted: windows may close in any order. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    locks++
    apply()
    return () => {
      locks = Math.max(0, locks - 1)
      apply()
    }
  }, [active])
}

const REPORT_EVERY = 5 * 60_000 // one report of a kind in this long
const reported: Record<string, number> = {}

/** What was on the screen: enough to tell which window froze the page. */
function snapshot(extra: Record<string, unknown> = {}) {
  const layers = document
    .elementsFromPoint(innerWidth / 2, innerHeight / 2)
    .slice(0, 6)
    .map((el) => {
      const s = getComputedStyle(el)
      return `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className || '').slice(0, 40)} pos=${s.position} op=${s.opacity} pe=${s.pointerEvents}`
    })
  return {
    route: location.hash,
    locks,
    body_overflow: document.body.style.overflow,
    scroll: `${Math.round(scrollY)} of ${document.documentElement.scrollHeight - innerHeight}`,
    viewport: `${innerWidth}x${innerHeight}`,
    layers,
    ...extra,
  }
}

function report(kind: string, extra?: Record<string, unknown>) {
  const now = Date.now()
  if (now - (reported[kind] ?? 0) < REPORT_EVERY) return
  reported[kind] = now
  const detail = snapshot(extra)
  console.warn(`freeze guard: ${kind}`, detail)
  if (!CLIENT_LOG_URL) return
  try {
    const body = JSON.stringify({ kind, detail })
    navigator.sendBeacon?.(CLIENT_LOG_URL, new Blob([body], { type: 'application/json' })) ||
      fetch(CLIENT_LOG_URL, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
  } catch {
    /* the report is a nicety */
  }
}

/** The fixed layer over most of the screen that `el` belongs to, if it cannot be seen. */
function invisibleLayer(el: Element | null): HTMLElement | null {
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    const s = getComputedStyle(node)
    if (s.position !== 'fixed') continue
    const r = node.getBoundingClientRect()
    if (r.width * r.height < innerWidth * innerHeight * 0.6) return null
    let opacity = 1
    for (let up: Element | null = node; up; up = up.parentElement) opacity *= Number(getComputedStyle(up).opacity)
    return opacity < 0.05 ? (node as HTMLElement) : null
  }
  return null
}

function look(x: number, y: number) {
  // a lock with no window holding it
  if (document.body.style.overflow === 'hidden' && locks === 0) {
    report('scroll-lock-left')
    document.body.style.overflow = ''
  }
  // an invisible layer catching the taps: given a moment (a window may just be starting to fade in)
  const layer = invisibleLayer(document.elementFromPoint(x, y))
  if (layer) {
    window.setTimeout(() => {
      if (!layer.isConnected || invisibleLayer(layer) !== layer) return
      report('invisible-layer', { layer: `${layer.tagName.toLowerCase()}.${layer.className}` })
      layer.style.pointerEvents = 'none'
    }, 700)
  }
}

let started = false

/** Started once, in main.tsx. */
export function startFreezeGuard() {
  if (started) return
  started = true
  window.addEventListener('pointerdown', (e) => look(e.clientX, e.clientY), true)
  window.addEventListener('wheel', (e) => look(e.clientX, e.clientY), { capture: true, passive: true })
  window.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0]
      if (t) look(t.clientX, t.clientY)
    },
    { capture: true, passive: true },
  )
}
