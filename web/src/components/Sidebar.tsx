import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { APP_NAME } from '../config'
import { spring } from '../lib/motion'
import { TABS, type Tab } from './TabBar'

interface Props {
  active: Tab
  onSelect: (tab: Tab) => void
}

/** Desktop navigation: a sidebar instead of the bottom tab bar. */
export function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Sparkles size={18} strokeWidth={2.2} />
        </div>
        {APP_NAME}
      </div>
      <nav className="sidebar-nav">
        {TABS.map(({ id, label, icon: Icon }, i) => {
          const isActive = id === active
          return (
            <button
              key={id}
              className={`sidebar-item${isActive ? ' active' : ''}`}
              onClick={() => onSelect(id)}
              aria-current={isActive ? 'page' : undefined}
              title={`${label} (${i + 1})`}
            >
              {isActive && <motion.div layoutId="sidebar-active" className="sidebar-highlight" transition={spring} />}
              <Icon size={20} strokeWidth={isActive ? 2.1 : 1.8} />
              <span>{label}</span>
              <kbd>{i + 1}</kbd>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
