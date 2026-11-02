import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTip } from '../lib/intros'
import { spring } from '../lib/motion'
import { t } from '../lib/strings'

/**
 * A one-time tip card over a screen's content ("New: covers — set the style"): an icon or picture, a title, a line,
 * an optional action; × or the action closes it for good (lib/intros useTip). For telling about something new where
 * it lives — not for errors (DismissibleNote) or account state (NoticeBar).
 */
export function Tip({
  id,
  title,
  children,
  icon: Icon,
  picture,
  action,
  onAction,
  when = true,
}: {
  /** what was seen is remembered by this */
  id: string
  title: string
  children: ReactNode
  icon?: LucideIcon
  /** a 64px picture instead of the icon */
  picture?: ReactNode
  action?: string
  onAction?: () => void
  /** false: not for this person (yet) */
  when?: boolean
}) {
  const [shown, close] = useTip(id)
  return (
    <AnimatePresence initial={false}>
      {shown && when && (
        <motion.div
          key={id}
          className="tip"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
          transition={spring}
        >
          <div className={`tip-picture${picture ? '' : ' icon'}`}>{picture ?? (Icon && <Icon size={30} strokeWidth={1.7} />)}</div>
          <div className="tip-text">
            <div className="tip-title">{title}</div>
            <div>{children}</div>
            {action && (
              <button
                className="tip-action"
                onClick={() => {
                  close()
                  onAction?.()
                }}
              >
                {action}
              </button>
            )}
          </div>
          <button className="tip-close" onClick={close} aria-label={t.hide}>
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
