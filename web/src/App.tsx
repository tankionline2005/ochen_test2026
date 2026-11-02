import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { TABS, TabBar, type Tab } from './components/TabBar'
import { IntroHost } from './components/Intro'
import { ToastProvider } from './components/Toast'
import { useWide } from './hooks/useMedia'
import { softSpring } from './lib/motion'
import { INTROS } from './screens/intros'
import { Advanced } from './screens/Advanced'
import { Home } from './screens/Home'
import { ItemDetail } from './screens/ItemDetail'
import { Items } from './screens/Items'
import { Settings } from './screens/Settings'

/**
 * Routes live in the URL hash so Back/Forward, reloads and shared links work without a router:
 *   #/home, #/items, #/settings       — root tabs
 *   #/item/42                         — a detail screen pushed inside the "items" tab
 *   #/advanced                        — a sub-screen pushed inside "settings"
 */
const SUB_SCREENS = ['advanced'] as const
type Route = { tab: Tab; itemId?: number; sub?: (typeof SUB_SCREENS)[number] }

function parseHash(hash: string): Route {
  const [, first, second] = hash.replace(/^#/, '').split('/')
  if (first === 'item' && second && /^\d+$/.test(second)) return { tab: 'items', itemId: Number(second) }
  const sub = SUB_SCREENS.find((s) => s === first)
  if (sub) return { tab: 'settings', sub }
  const tab = TABS.find((t) => t.id === first)
  return { tab: tab ? tab.id : TABS[0].id }
}

function routeKey(r: Route) {
  return r.itemId ? `item/${r.itemId}` : (r.sub ?? r.tab)
}

function isDetail(r: Route) {
  return Boolean(r.itemId || r.sub)
}

function useRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = useCallback((path: string) => {
    location.hash = `/${path}`
  }, [])
  return [route, go] as const
}

// push = slide in from the right, pop = back to the left, tab = crossfade
const variants = {
  enter: (dir: string) => ({ opacity: 0, x: dir === 'push' ? 60 : dir === 'pop' ? -40 : 0, scale: dir === 'tab' ? 0.99 : 1 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: string) => ({ opacity: 0, x: dir === 'push' ? -40 : dir === 'pop' ? 60 : 0, transition: { duration: 0.12 } }),
}

export default function App() {
  // If the app needs a login, gate <Shell> here (see references/components.md → "Login").
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}

function Shell() {
  const [route, go] = useRoute()
  const wide = useWide()
  const key = routeKey(route)
  const prev = useRef(route)
  const scrolls = useRef<Record<string, number>>({})

  const direction = isDetail(route) && !isDetail(prev.current) ? 'push' : !isDetail(route) && isDetail(prev.current) ? 'pop' : 'tab'
  const back = (fallback: Tab) => (history.length > 1 ? history.back() : go(fallback))

  // remember where each screen was scrolled, restore it on return
  useLayoutEffect(() => {
    return () => {
      scrolls.current[key] = window.scrollY
    }
  }, [key])

  useEffect(() => {
    prev.current = route
  })

  // tapping the active tab again scrolls to the top, like iOS
  const selectTab = (tab: Tab) => {
    if (tab === route.tab && !isDetail(route)) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    go(tab)
  }
  const selectRef = useRef(selectTab)
  selectRef.current = selectTab

  // keyboard: 1–N switch sections, Esc goes back from a detail screen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // typing — a field, a select, a rich-text editor (contenteditable), any open window: the keys are theirs
      const typing = target.isContentEditable || target.closest('input, textarea, select, [role="dialog"], [role="alertdialog"]')
      if (e.metaKey || e.ctrlKey || e.altKey || typing) return
      const tab = TABS[Number(e.key) - 1]
      if (tab) selectRef.current(tab.id)
      else if (e.key === 'Escape' && isDetail(parseHash(location.hash))) history.back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`app${wide ? ' wide' : ''}`}>
      {wide && <Sidebar active={route.tab} onSelect={selectTab} />}
      <AnimatePresence
        mode="wait"
        custom={direction}
        initial={false}
        // braces, not an arrow returning scrollTo(): newer browsers return a promise from it, and React reads a
        // returned value from a callback the same way as from an effect
        onExitComplete={() => {
          window.scrollTo(0, direction === 'pop' ? (scrolls.current[key] ?? 0) : 0)
        }}
      >
        <motion.main key={key} custom={direction} variants={variants} initial="enter" animate="center" exit="exit" transition={softSpring}>
          {route.itemId ? (
            <ItemDetail id={route.itemId} onBack={() => back('items')} />
          ) : route.sub === 'advanced' ? (
            <Advanced onBack={() => back('settings')} />
          ) : route.tab === 'items' ? (
            <Items onOpen={(id) => go(`item/${id}`)} />
          ) : route.tab === 'settings' ? (
            <Settings onOpenAdvanced={() => go('advanced')} />
          ) : (
            <Home />
          )}
        </motion.main>
      </AnimatePresence>
      {!wide && <TabBar active={route.tab} onSelect={selectTab} />}
      <IntroHost sections={INTROS} />
    </div>
  )
}
