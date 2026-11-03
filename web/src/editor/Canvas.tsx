import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { Bodies, Colors, Size } from '../engine/library'
import { backgroundMarkup, type Item, itemTransform, objectSize, paint } from '../engine/scene'
import { useEditor } from '../state/editor'

/**
 * The composition, drawn as the very SVG that gets exported. Objects are moved by dragging, turned by the round
 * handle (or two fingers on a phone); the part of the selected object outside the frame shows faintly, so it's
 * clear what the crop takes away.
 */
export function Canvas({ bodies }: { bodies: Bodies | null }) {
  const { scene, selected, select, begin, update } = useEditor()
  const { w: W, h: H } = scene.format
  const svg = useRef<SVGSVGElement>(null)
  const [unit, setUnit] = useState(1) // scene units per screen pixel

  useEffect(() => {
    const el = svg.current
    if (!el) return
    const ro = new ResizeObserver(() => setUnit(W / Math.max(1, el.getBoundingClientRect().width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [W])

  const gesture = useRef<{
    uid: string
    mode: 'move' | 'rotate'
    start: { x: number; y: number }
    item: Item
    pointers: Map<number, { x: number; y: number }>
    twoAngle?: number
  } | null>(null)

  const toScene = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height }
  }
  const centre = (it: Item) => {
    const { w, h } = objectSize(it.id, scene.size)
    return { x: it.x + (w * scene.scale) / 2, y: it.y + (h * scene.scale) / 2 }
  }
  const angle = (a: { x: number; y: number }, b: { x: number; y: number }) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  const snap = (deg: number, fine: boolean) => {
    let d = ((((deg + 180) % 360) + 360) % 360) - 180
    if (fine) d = Math.round(d / 15) * 15
    else if (Math.abs(d) < 3) d = 0
    return Math.round(d * 10) / 10
  }

  const onItemDown = (e: React.PointerEvent, it: Item, mode: 'move' | 'rotate' = 'move') => {
    e.stopPropagation()
    const g = gesture.current
    // a second finger on the selected object: turn it with both fingers
    if (g && g.uid === it.uid && e.pointerType === 'touch') {
      g.pointers.set(e.pointerId, toScene(e))
      const [a, b] = [...g.pointers.values()]
      g.twoAngle = angle(a, b)
      g.item = scene.items.find((x) => x.uid === it.uid) ?? it
      svg.current?.setPointerCapture(e.pointerId)
      return
    }
    select(it.uid)
    begin()
    gesture.current = { uid: it.uid, mode, start: toScene(e), item: it, pointers: new Map([[e.pointerId, toScene(e)]]) }
    svg.current?.setPointerCapture(e.pointerId)
  }

  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g || !g.pointers.has(e.pointerId)) return
    const p = toScene(e)
    g.pointers.set(e.pointerId, p)
    if (g.pointers.size >= 2 && g.twoAngle !== undefined) {
      const [a, b] = [...g.pointers.values()]
      update(g.uid, { rot: snap(g.item.rot + angle(a, b) - g.twoAngle, false) }, true)
      return
    }
    if (g.mode === 'rotate') {
      const c = centre(g.item)
      const delta = angle(c, p) - angle(c, g.start)
      update(g.uid, { rot: snap(g.item.rot + delta, e.shiftKey) }, true)
    } else {
      update(g.uid, { x: Math.round(g.item.x + p.x - g.start.x), y: Math.round(g.item.y + p.y - g.start.y) }, true)
    }
  }

  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current
    if (!g) return
    g.pointers.delete(e.pointerId)
    if (g.pointers.size === 0) gesture.current = null
    else if (g.pointers.size === 1) {
      // one finger left after a two-finger turn: carry on moving from here
      const [p] = [...g.pointers.values()]
      const now = scene.items.find((x) => x.uid === g.uid)
      if (now) Object.assign(g, { start: p, item: now, twoAngle: undefined, mode: 'move' })
    }
  }

  const sel = selected
  const selBox = sel ? objectSize(sel.id, scene.size) : null
  const handle = 44 * unit
  const bg = useMemo(() => backgroundMarkup(scene), [scene.format, scene.palette, scene.size, scene.decor])

  return (
    <div className="canvas-wrap">
      <svg
        ref={svg}
        className="canvas"
        viewBox={`0 0 ${W} ${H}`}
        style={{ aspectRatio: `${W} / ${H}`, ['--ar' as string]: W / H }}
        onPointerDown={() => select(null)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="img"
        aria-label="Холст композиции"
      >
        <defs>
          <clipPath id="canvas-frame">
            <rect width={W} height={H} />
          </clipPath>
        </defs>
        {/* the selected object's part beyond the frame, faint */}
        {sel && bodies && (
          <ItemNode item={sel} size={scene.size} scale={scene.scale} colors={scene.palette.colors} bodies={bodies} ghost />
        )}
        <g clipPath="url(#canvas-frame)">
          <g dangerouslySetInnerHTML={{ __html: bg }} />
          {bodies &&
            scene.items.map((it) => (
              <ItemNode
                key={it.uid}
                item={it}
                size={scene.size}
                scale={scene.scale}
                colors={scene.palette.colors}
                bodies={bodies}
                onPointerDown={(e) => onItemDown(e, it)}
              />
            ))}
        </g>
        <rect width={W} height={H} fill="none" className="canvas-edge" vectorEffect="non-scaling-stroke" />
        {sel && selBox && (
          <g transform={itemTransform(sel, scene.size, scene.scale)} className="selection">
            <rect width={selBox.w} height={selBox.h} vectorEffect="non-scaling-stroke" />
            <line x1={selBox.w / 2} y1={0} x2={selBox.w / 2} y2={-handle / scene.scale} vectorEffect="non-scaling-stroke" />
            <circle
              className="rotate-handle"
              cx={selBox.w / 2}
              cy={-handle / scene.scale}
              r={(11 * unit) / scene.scale}
              vectorEffect="non-scaling-stroke"
              onPointerDown={(e) => onItemDown(e, sel, 'rotate')}
            >
              <title>Повернуть (Shift — шагами по 15°)</title>
            </circle>
          </g>
        )}
      </svg>
      {!scene.items.length && (
        <div className="canvas-empty">
          <div className="canvas-empty-title">Пустой кадр</div>
          Опишите метафору или перечислите объекты — композиция соберётся сама. Или добавьте объекты из библиотеки.
        </div>
      )}
    </div>
  )
}

interface NodeProps {
  item: Item
  size: Size
  scale: number
  colors: Colors
  bodies: Bodies
  ghost?: boolean
  onPointerDown?: (e: React.PointerEvent) => void
}

/** One object: its paths in the palette's colours. Repainted only when its look changes, not while others move. */
const ItemNode = memo(function ItemNode({ item, size, scale, colors, bodies, ghost, onPointerDown }: NodeProps) {
  const html = useMemo(() => paint(bodies[`${item.id}:${item.state}`] ?? '', colors, item.tint), [bodies, item.id, item.state, item.tint, colors])
  return (
    <g
      transform={itemTransform(item, size, scale)}
      className={ghost ? 'ghost' : 'item'}
      onPointerDown={onPointerDown}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
