import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IntroHost } from './components/Intro'
import { TABS, TabBar, type Tab } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { TopBar } from './components/TopBar'
import { ComposingOverlay } from './compose/ComposingOverlay'
import { useWide } from './hooks/useMedia'
import { softSpring } from './lib/motion'
import { About } from './screens/About'
import { Editor } from './screens/Editor'
import { INTROS } from './screens/intros'
import { Library } from './screens/Library'
import { Palettes } from './screens/Palettes'
import { EditorProvider } from './state/editor'

/** Routes live in the URL hash (#/editor, #/library, #/palettes, #/about): Back/Forward and reloads just work. */
function parseHash(hash: string): Tab {
  const first = hash.replace(/^#\/?/, '').split('/')[0]
  return TABS.find((t) => t.id === first)?.id ?? TABS[0].id
}

function useRoute() {
  const [tab, setTab] = useState<Tab>(() => parseHash(location.hash))
  useEffect(() => {
    const onHash = () => setTab(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = useCallback((t: Tab) => {
    location.hash = `/${t}`
  }, [])
  return [tab, go] as const
}

const variants = {
  enter: { opacity: 0, scale: 0.99 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

export default function App() {
  return (
    <ToastProvider>
      <EditorProvider>
        <Shell />
      </EditorProvider>
    </ToastProvider>
  )
}

function Shell() {
  const [tab, go] = useRoute()
  const wide = useWide()
  const scrolls = useRef<Record<string, number>>({})

  useLayoutEffect(() => {
    return () => {
      scrolls.current[tab] = window.scrollY
    }
  }, [tab])

  // tapping the active tab again scrolls to the top, like iOS
  const selectTab = (t: Tab) => {
    if (t === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    go(t)
  }
  const selectRef = useRef(selectTab)
  selectRef.current = selectTab

  // keyboard: 1–N switch sections
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.isContentEditable || target.closest('input, textarea, select, [role="dialog"], [role="alertdialog"]')
      if (e.metaKey || e.ctrlKey || e.altKey || typing) return
      const t = TABS[Number(e.key) - 1]
      if (t) selectRef.current(t.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`app${wide ? ' wide' : ''}${tab === 'editor' ? ' on-editor' : ''}`}>
      {wide && <TopBar active={tab} onSelect={selectTab} />}
      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => {
          window.scrollTo(0, 0)
        }}
      >
        <motion.main key={tab} variants={variants} initial="enter" animate="center" exit="exit" transition={softSpring}>
          {tab === 'library' ? (
            <Library onAdded={() => go('editor')} />
          ) : tab === 'palettes' ? (
            <Palettes />
          ) : tab === 'about' ? (
            <About />
          ) : (
            <Editor onOpenPalettes={() => go('palettes')} />
          )}
        </motion.main>
      </AnimatePresence>
      {!wide && <TabBar active={tab} onSelect={selectTab} />}
      <IntroHost sections={INTROS} />
      <ComposingOverlay />
    </div>
  )
}
