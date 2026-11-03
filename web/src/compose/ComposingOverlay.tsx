import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LiquidSphere } from '../components/LiquidSphere'
import { useWide } from '../hooks/useMedia'
import { Leaving, useScrollLock } from '../lib/freezeGuard'
import { backdropZ, isTop, useLayer } from '../lib/layers'
import { spring } from '../lib/motion'
import { cancelCompose, useCompose } from './compose'

/**
 * Full-screen status while a composition is being made: the liquid-glass sphere with the live status over it, the
 * steps under it. A custom overlay, so it takes the kit's window plumbing: portal, layer, scroll lock, <Leaving>.
 */
export function ComposingOverlay() {
  const s = useCompose()
  const wide = useWide()
  useScrollLock(s.open)
  const level = useLayer(s.open)
  const elapsed = useElapsed(s.open, s.startedAt)

  useEffect(() => {
    if (!s.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && isTop(level) && cancelCompose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.open, level])

  // the steps and the note need ~330px under the sphere: on a low window the sphere gives way
  const size = Math.max(200, Math.min(wide ? 420 : 340, window.innerWidth - 32, window.innerHeight - 340))
  const usesModel = s.mode === 'meaning'

  return createPortal(
    <AnimatePresence>
      {s.open && (
        <Leaving key="composing">
          {(leaving) => (
            <motion.div
              className="composing"
              role="alertdialog"
              aria-live="polite"
              aria-label={s.status}
              style={{ ...leaving, zIndex: backdropZ(level) }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
            >
              <motion.div
                className="composing-stage"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.04, opacity: 0 }}
                transition={spring}
              >
                <LiquidSphere size={size} />
                <div className="composing-status" style={{ width: size * 0.78, height: size }}>
                  <div className="composing-title-box">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={s.status}
                        className="composing-title"
                        initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
                        transition={{ duration: 0.35 }}
                      >
                        {s.status}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="composing-live">{s.live}</div>
                </div>
              </motion.div>

              <div className="composing-steps">
                {s.stages.map((st) => (
                  <div key={st.id} className={`composing-step ${st.state}`}>
                    <span className="composing-dot">
                      {st.state === 'done' ? <Check size={12} strokeWidth={3} /> : st.state === 'active' ? <span className="composing-pulse" /> : null}
                    </span>
                    {st.label}
                  </div>
                ))}
              </div>

              <div className="composing-foot">
                <span className="composing-time">{elapsed} с</span>
                {usesModel && (
                  <span>
                    Бесплатная модель NVIDIA Nemotron 3.5 Super через OpenRouter: в часы нагрузки она думает до минуты —
                    это ограничение бесплатного тарифа, а не сервиса.
                  </span>
                )}
              </div>
              <button className="composing-cancel" onClick={cancelCompose}>
                Отменить
              </button>
            </motion.div>
          )}
        </Leaving>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function useElapsed(open: boolean, since: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [open])
  return Math.max(0, (now - since) / 1000).toFixed(1)
}
