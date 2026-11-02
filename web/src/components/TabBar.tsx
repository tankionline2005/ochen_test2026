import { motion } from 'framer-motion'
import { Home, List, Settings, type LucideIcon } from 'lucide-react'

/** Root sections. Edit this list: the tab bar, the sidebar and the 1–N hotkeys follow it. */
export type Tab = 'home' | 'items' | 'settings'

export const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'items', label: 'Items', icon: List },
  { id: 'settings', label: 'Settings', icon: Settings },
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
