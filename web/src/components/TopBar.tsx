import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { APP_NAME } from '../config'
import { spring } from '../lib/motion'
import { setTheme, useTheme } from '../lib/theme'
import { Credits } from './Credits'
import { TABS, type Tab } from './TabBar'

/** Desktop navigation: a regular site header instead of the kit's sidebar — the editor needs the whole width. */
export function TopBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const theme = useTheme()
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <img className="wordmark" src="/snapbuild-logo.png" width={138} height={20} alt={`снэпбилд — ${APP_NAME}`} />
      </div>
      <nav className="topbar-nav">
        {TABS.map(({ id, label, icon: Icon }, i) => {
          const on = id === active
          return (
            <button key={id} className={`topbar-item${on ? ' active' : ''}`} onClick={() => onSelect(id)} title={`${label} (${i + 1})`}>
              {on && <motion.div layoutId="topbar-active" className="topbar-highlight" transition={spring} />}
              <Icon size={18} strokeWidth={on ? 2.1 : 1.8} />
              <span>{label}</span>
            </button>
          )
        })}
      </nav>
      <Credits inline />
      <button
        className="topbar-theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  )
}

/** Three isometric tiles — the library's colours. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <rect width="32" height="32" rx="8" fill="#D7CDF5" />
      <path d="M16 6 L26 11.5 L16 17 L6 11.5 Z" fill="#F9ECB0" stroke="#181817" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 11.5 L16 17 L16 26 L6 20.5 Z" fill="#F9A3AA" stroke="#181817" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M26 11.5 L16 17 L16 26 L26 20.5 Z" fill="#7864D7" stroke="#181817" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}
