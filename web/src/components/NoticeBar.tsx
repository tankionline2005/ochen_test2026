import { motion } from 'framer-motion'
import { CircleAlert } from 'lucide-react'
import { spring } from '../lib/motion'

/**
 * A banner under a root section's large title about the account's state — the plan ends in 3 days, the project is
 * frozen, the AI stopped — that a tap resolves (opens the screen that fixes it). Let the server compose it (one
 * `notice` in the "who am I" response) so every screen says the same; render it on root pages only. Not dismissible:
 * it goes when the cause does.
 */
export function NoticeBar({ text, tone = 'warn', onClick }: { text: string; tone?: 'warn' | 'danger'; onClick?: () => void }) {
  return (
    <motion.button
      className={`notice-bar ${tone}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      <CircleAlert size={18} />
      <span>{text}</span>
    </motion.button>
  )
}
