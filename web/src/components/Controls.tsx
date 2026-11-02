import { motion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { spring } from '../lib/motion'
import { t } from '../lib/strings'

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      {/* moved by x, not by `layout`: a layout animation replays on every re-render inside a scrolled sheet */}
      <motion.div className="switch-knob" initial={false} animate={{ x: on ? 20 : 0 }} transition={spring} />
    </button>
  )
}

interface StepperProps {
  value: number
  steps: number[]
  onChange: (v: number) => void
}

/** Moves through a fixed list of values, like the iOS stepper. */
export function Stepper({ value, steps, onChange }: StepperProps) {
  const lower = [...steps].reverse().find((s) => s < value)
  const higher = steps.find((s) => s > value)
  return (
    <div className="stepper">
      <button aria-label={t.less} disabled={lower === undefined} onClick={() => lower !== undefined && onChange(lower)}>
        <Minus size={18} />
      </button>
      <div className="stepper-divider" />
      <button
        aria-label={t.more}
        disabled={higher === undefined}
        onClick={() => higher !== undefined && onChange(higher)}
      >
        <Plus size={18} />
      </button>
    </div>
  )
}
