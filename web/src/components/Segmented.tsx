import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { spring } from '../lib/motion'

interface Option<T> {
  value: T
  label: ReactNode
}

interface Props<T extends string> {
  id: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
}

/** iOS segmented control with a sliding thumb. */
export function Segmented<T extends string>({ id, options, value, onChange }: Props<T>) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`segment${o.value === value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.value === value && <motion.div layoutId={`seg-${id}`} className="segment-thumb" transition={spring} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Horizontally scrolling filter chips with a sliding selection. */
export function Chips<T extends string>({ id, options, value, onChange }: Props<T>) {
  return (
    <div className="chips" role="tablist">
      {options.map((o) => (
        <motion.button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className={`chip${o.value === value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
          whileTap={{ scale: 0.94 }}
          style={{ isolation: 'isolate' }}
        >
          {o.value === value && <motion.div layoutId={`chip-${id}`} className="chip-thumb" transition={spring} />}
          <span>{o.label}</span>
        </motion.button>
      ))}
    </div>
  )
}
