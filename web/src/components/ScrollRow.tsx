import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useMouse } from '../hooks/useMedia'
import { useWheelScrollX } from '../hooks/useWheelScrollX'

/**
 * A sideways row (chips, examples). On a phone it's a plain swipeable strip. With a mouse it also gets arrows over
 * faded edges — only on the side there is more to see — and can be dragged; the wheel scrolls it too.
 */
export function ScrollRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  const mouse = useMouse()
  const el = useRef<HTMLDivElement | null>(null)
  const wheel = useWheelScrollX<HTMLDivElement>()
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const r = el.current
    if (!r) return
    setEdges({ left: r.scrollLeft > 2, right: r.scrollLeft < r.scrollWidth - r.clientWidth - 2 })
  }, [])

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node
      wheel(node)
      measure()
    },
    [wheel, measure],
  )

  useEffect(() => {
    const r = el.current
    if (!r) return
    const ro = new ResizeObserver(measure)
    ro.observe(r)
    return () => ro.disconnect()
  }, [measure])

  const by = (dir: number) => el.current?.scrollBy({ left: dir * el.current.clientWidth * 0.7, behavior: 'smooth' })

  // drag with the mouse; a drag longer than a few pixels doesn't count as a click on the chip under it
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !el.current) return
    drag.current = { x: e.clientX, left: el.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || !el.current) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 4) d.moved = true
    if (d.moved) el.current.scrollLeft = d.left - dx
  }
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.stopPropagation()
      e.preventDefault()
    }
    drag.current = null
  }

  return (
    <div className={`scroll-row${mouse ? ' mouse' : ''}${edges.left ? ' at-left' : ''}${edges.right ? ' at-right' : ''}`}>
      <div
        ref={ref}
        className={`scroll-row-track ${className}`}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          if (drag.current && !drag.current.moved) drag.current = null
        }}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
      {mouse && edges.left && (
        <button className="scroll-row-arrow left" onClick={() => by(-1)} aria-label="Листать назад">
          <ChevronLeft size={16} />
        </button>
      )}
      {mouse && edges.right && (
        <button className="scroll-row-arrow right" onClick={() => by(1)} aria-label="Листать дальше">
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
