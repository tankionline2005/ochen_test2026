import { motion, useMotionValue, useScroll, useTransform, animate } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMouse, useWide } from '../hooks/useMedia'
import { spring } from '../lib/motion'
import { t } from '../lib/strings'

interface Props {
  title: string
  left?: ReactNode
  right?: ReactNode
  /** Rendered under the large title (search field, segmented control, chips…) */
  accessory?: ReactNode
  /** Replaces the large title block (e.g. a detail screen's avatar header) */
  hero?: ReactNode
  /** A small grey number right after the large title: "Channels 160" */
  titleCount?: number
  /** A short grey note right of the large title (what the current sort means); clamped to 3 lines */
  titleAside?: ReactNode
  /** A button right of the large title, on every screen size (an "AI" pill, an avatar switcher) */
  titleAction?: ReactNode
  /** On a phone, a slot right of the large title for the section's own buttons — fill it with <TitleActions> */
  titleActions?: boolean
  /** The title can be tapped (rename a chat) */
  onTitleClick?: () => void
  /** «?» after the title: opens the section's welcome cards again (components/Intro.tsx) */
  onHelp?: () => void
  onRefresh?: () => Promise<unknown>
  children: ReactNode
}

const PULL_TRIGGER = 72

// the room right of the large title on a phone (`titleActions`), for the page's sections
const TitleSlot = createContext<HTMLElement | null>(null)

/**
 * A section's buttons: right of the page's large title on a phone (where a toolbar under it would cost a row), where
 * they stand (inline) on a wide screen. Needs <Page titleActions>.
 */
export function TitleActions({ children }: { children: ReactNode }) {
  const slot = useContext(TitleSlot)
  return slot ? createPortal(children, slot) : <>{children}</>
}

/** iOS page: large title that collapses into a blurred navigation bar, plus pull-to-refresh. */
export function Page({
  title,
  left,
  right,
  accessory,
  hero,
  titleCount,
  titleAside,
  titleAction,
  titleActions,
  onTitleClick,
  onHelp,
  onRefresh,
  children,
}: Props) {
  const { scrollY } = useScroll()
  const collapseAt = hero ? 120 : 34
  // The bar and its title show as the page scrolls under them — and go once the page's top edge is in sight. Scroll
  // position alone is not enough: an iPhone flung up past the top bounces without reporting scrollY, and the bar
  // stayed hanging, opaque, in the empty space above the page. An IntersectionObserver on a 1px marker at the top
  // sees every frame, bounce or not.
  const edge = useRef<HTMLDivElement>(null)
  const atTop = useMotionValue(1)
  useEffect(() => {
    const el = edge.current
    if (!el) return
    const watch = new IntersectionObserver(([e]) => {
      animate(atTop, e.isIntersecting ? 1 : 0, { duration: 0.15 })
    })
    watch.observe(el)
    return () => watch.disconnect()
  }, [atTop])
  const titleByScroll = useTransform(scrollY, [collapseAt, collapseAt + 18], [0, 1])
  const barByScroll = useTransform(scrollY, [0, 10], [0, 1])
  const titleOpacity = useTransform(() => titleByScroll.get() * (1 - atTop.get()))
  const barOpacity = useTransform(() => barByScroll.get() * (1 - atTop.get()))
  const largeScale = useTransform(scrollY, [-150, 0], [1.1, 1], { clamp: true })

  const pull = useMotionValue(0)
  const iconRotate = useTransform(pull, [0, PULL_TRIGGER], [0, 270])
  const iconOpacity = useTransform(pull, [12, PULL_TRIGGER], [0, 1])
  const [refreshing, setRefreshing] = useState(false)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh
  const mouse = useMouse()
  const wide = useWide()
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  const refreshByClick = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!onRefresh || mouse) return
    let startY: number | null = null
    let busy = false
    const onStart = (e: TouchEvent) => {
      startY = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dist = Math.max(0, e.touches[0].clientY - startY)
      pull.set(Math.min(110, dist * 0.45))
    }
    const onEnd = async () => {
      if (startY === null) return
      startY = null
      if (pull.get() >= PULL_TRIGGER && refreshRef.current) {
        busy = true
        setRefreshing(true)
        animate(pull, 52, spring)
        try {
          await refreshRef.current()
        } finally {
          busy = false
          setRefreshing(false)
          animate(pull, 0, spring)
        }
      } else {
        animate(pull, 0, spring)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [onRefresh, pull, mouse])

  const help = onHelp && (
    <button className="title-help" onClick={onHelp} aria-label={t.howItWorks} title={t.howItWorks}>
      ?
    </button>
  )
  const name = onTitleClick ? (
    <button className="large-title-button" onClick={onTitleClick}>
      {title}
    </button>
  ) : (
    title
  )
  const heading = (
    <motion.h1 className="large-title" style={{ scale: largeScale }}>
      {name}
      {titleCount !== undefined && <span className="title-count">{titleCount}</span>}
      {help}
    </motion.h1>
  )
  const largeTitle =
    titleAside !== undefined ? (
      <div className="large-title-row">
        {heading}
        <div className="title-aside">{titleAside}</div>
      </div>
    ) : (
      heading
    )

  return (
    <div className="page">
      <div ref={edge} className="page-top-edge" aria-hidden="true" />
      <header className="navbar">
        <motion.div className="navbar-bg" style={{ opacity: barOpacity }} />
        <div className="navbar-side">{left}</div>
        <motion.div className="navbar-title" style={{ opacity: titleOpacity }}>
          {title}
        </motion.div>
        <div className="navbar-side right">
          {mouse && onRefresh && (
            <button className="nav-button" onClick={refreshByClick} aria-label={t.refresh} title={t.refresh}>
              <RefreshCw size={19} className={refreshing ? 'spinner' : undefined} />
            </button>
          )}
          {right}
        </div>
      </header>

      {onRefresh && !mouse && (
        <motion.div className="ptr" style={{ height: pull }}>
          <motion.div style={{ rotate: iconRotate, opacity: iconOpacity, paddingBottom: 14 }}>
            <RefreshCw size={22} className={refreshing ? 'spinner' : undefined} />
          </motion.div>
        </motion.div>
      )}

      {hero ??
        (titleAction ? (
          <div className="large-title-bar">
            {largeTitle}
            {titleAction}
          </div>
        ) : titleActions && !wide ? (
          <div className="large-title-bar">
            {largeTitle}
            <div className="title-actions" ref={setSlot} />
          </div>
        ) : (
          largeTitle
        ))}
      <TitleSlot.Provider value={titleActions && !wide ? slot : null}>
        {accessory}
        {children}
      </TitleSlot.Provider>
    </div>
  )
}
