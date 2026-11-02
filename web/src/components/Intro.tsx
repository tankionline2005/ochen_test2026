import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { closeIntro, useOpenIntro } from '../lib/intros'
import { spring } from '../lib/motion'
import { t } from '../lib/strings'
import { Sheet } from './Sheet'

export interface IntroSlide {
  title: string
  text: string
  /** the picture: a big icon on a soft gradient… */
  icon?: LucideIcon
  /** …tinted with this (a CSS color, a var) */
  color?: string
  /** …or a picture of your own: a small live mock-up of the screen works best */
  art?: ReactNode
}

export interface IntroSection {
  /** the sheet's title: the section's name */
  title: string
  slides: IntroSlide[]
}

/**
 * The welcome cards of the section open now (lib/intros): a carousel in a sheet — swipe or tap the dots, «Next» to
 * the end, «Skip» on top. Mount once, in App, with every section's cards; build `sections` from what the person may
 * do, so a card never describes a button they don't have.
 */
export function IntroHost({ sections }: { sections: Record<string, IntroSection> }) {
  const key = useOpenIntro()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const content = key ? sections[key] : null

  useEffect(() => {
    if (key) {
      setIndex(0)
      setDir(1)
    }
  }, [key])

  const count = content?.slides.length ?? 0
  const last = index === count - 1
  const go = (to: number) => {
    if (to < 0 || to >= count) return
    setDir(to > index ? 1 : -1)
    setIndex(to)
  }
  const slide = content?.slides[index]

  return (
    <Sheet
      open={!!content}
      onClose={closeIntro}
      title={content?.title}
      right={
        !last && (
          <button className="nav-button intro-skip" onClick={closeIntro}>
            {t.skip}
          </button>
        )
      }
    >
      {content && slide && (
        <div className="intro">
          <div className="intro-stage">
            {/* not initial={false}: it would stop a live picture's loop on the first card, at its last frame */}
            <AnimatePresence custom={dir} mode="popLayout">
              <motion.div
                key={`${key}-${index}`}
                className="intro-slide"
                custom={dir}
                variants={{
                  enter: (d: number) => ({ x: d * 60, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (d: number) => ({ x: d * -60, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={spring}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.35}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60 || info.velocity.x < -400) go(index + 1)
                  else if (info.offset.x > 60 || info.velocity.x > 400) go(index - 1)
                }}
              >
                <div className="intro-art" style={slide.color ? { ['--intro-tint' as string]: slide.color } : undefined}>
                  {slide.art ??
                    (slide.icon && (
                      <span className="intro-icon">
                        <slide.icon size={44} strokeWidth={1.7} />
                      </span>
                    ))}
                </div>
                <h2 className="intro-title">{slide.title}</h2>
                <p className="intro-text">{slide.text}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          {count > 1 && (
            <div className="intro-dots" role="tablist" aria-label={t.card}>
              {content.slides.map((_, i) => (
                <button
                  key={i}
                  className={`intro-dot${i === index ? ' on' : ''}`}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${t.card} ${i + 1}`}
                  onClick={() => go(i)}
                />
              ))}
            </div>
          )}
          <div className="intro-actions">
            <motion.button className="button" whileTap={{ scale: 0.97 }} onClick={() => (last ? closeIntro() : go(index + 1))}>
              {last ? t.continue : t.next}
            </motion.button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
