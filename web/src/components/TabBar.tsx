import { motion } from 'framer-motion'
import { Boxes, Info, Palette, Wand2, type LucideIcon } from 'lucide-react'

/** Root sections. The tab bar (phone), the top bar (desktop) and the 1–N hotkeys follow this list. */
export type Tab = 'editor' | 'library' | 'palettes' | 'about'

export const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'editor', label: 'Конструктор', icon: Wand2 },
  { id: 'library', label: 'Библиотека', icon: Boxes },
  { id: 'palettes', label: 'Палитры', icon: Palette },
  { id: 'about', label: 'О проекте', icon: Info },
]

interface Props {
  active: Tab
  badges?: Partial<Record<Tab, number>>
  onSelect: (tab: Tab) => void
}

export function TabBar({ active, badges = {}, onSelect }: Props) {
  return (
    <nav className="tabbar">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active
        const badge = badges[id]
        return (
          <motion.button
            key={id}
            className={`tab${isActive ? ' active' : ''}`}
            onClick={() => onSelect(id)}
            whileTap={{ scale: 0.88 }}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={25} strokeWidth={isActive ? 2.1 : 1.7} />
            <span>{label}</span>
            {badge ? <span className="tab-badge">{badge}</span> : null}
          </motion.button>
        )
      })}
    </nav>
  )
}
