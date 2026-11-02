import { type Kind, objectById, type Size, type State } from './library'
import { type Format, type Item, newUid } from './scene'

/**
 * Automatic composition.
 *
 * The rules come from the designers' 16 example frames (measured from "Примеры композиций"): objects are used at
 * scale 1, so they are big and run off the frame; main objects stay almost whole, a large flat object (book,
 * folder) may be cut by half; a background object hides in the upper part or a corner, half of it outside; main
 * objects sit close together and never cover each other; the painted mass is balanced around the centre; nothing
 * "kisses" a frame edge — an object is either clearly inside or clearly cut.
 *
 * Every object has an occupancy mask (which cells hold paint, shadow included), so overlaps and crops are measured
 * on the real silhouette, not on bounding boxes. The search is simulated annealing from several random starts;
 * a seed makes it repeatable, a new seed gives another variant.
 */

export interface Pick {
  id: string
  state: State
}

export interface LayoutOptions {
  format: Format
  size: Size
  scale?: number
  seed?: number
  /** restarts × steps: the time budget */
  effort?: number
}

interface Grid {
  cols: number
  rows: number
  data: Uint8Array
  /** prefix sums per row, (cols + 1) per row */
  prefix: Int32Array
  filled: number
  /** painted extent, in cells */
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Engine cell in object units: masks are built at 8 / 4, combined 2×2 / 3×3 (about 60–90 cells per frame side). */
const ENGINE_CELL: Record<Size, number> = { large: 16, small: 12 }

const gridCache = new Map<string, Grid>()

function decode(b64: string): Uint8Array {
  if (typeof atob === 'function') return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new Uint8Array((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(b64, 'base64'))
}

export function gridOf(id: string, size: Size): Grid {
  const key = `${id}:${size}`
  const hit = gridCache.get(key)
  if (hit) return hit
  const m = objectById(id).sizes[size].mask
  const bits = decode(m.bits)
  const f = ENGINE_CELL[size] / m.cell
  const cols = Math.ceil(m.cols / f)
  const rows = Math.ceil(m.rows / f)
  const data = new Uint8Array(cols * rows)
  for (let y = 0; y < m.rows; y++)
    for (let x = 0; x < m.cols; x++) {
      const i = y * m.cols + x
      if (bits[i >> 3] & (1 << (i & 7))) data[Math.floor(y / f) * cols + Math.floor(x / f)] = 1
    }
  const prefix = new Int32Array(rows * (cols + 1))
  let filled = 0
  let x0 = cols, y0 = rows, x1 = 0, y1 = 0
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const v = data[y * cols + x]
      prefix[y * (cols + 1) + x + 1] = prefix[y * (cols + 1) + x] + v
      if (v) {
        filled++
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x + 1 > x1) x1 = x + 1
        if (y + 1 > y1) y1 = y + 1
      }
    }
  const g = { cols, rows, data, prefix, filled, x0, y0, x1, y1 }
  gridCache.set(key, g)
  return g
}

/** Seeded PRNG (mulberry32): the same seed gives the same composition. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** How much of a main object must stay in the frame. */
const MIN_VISIBLE: Record<Kind, number> = { small: 0.95, medium: 0.85, tall: 0.7, flat: 0.5 }

/**
 * Objects that can lie on top of a book or a folder, as the designers put the phone on the open book. Such a pair may
 * overlap when most of the upper object rests on the lower one; the upper one is then drawn after it.
 */
const SUPPORT: Kind = 'flat'
const CARRIED = ['phone', 'puzzle', 'pen', 'coin']
const CARRY_ON = 0.45
const canCarry = (lower: Body, upper: Body) => lower.kind === SUPPORT && CARRIED.includes(upper.pick.id)

interface Body {
  pick: Pick
  g: Grid
  kind: Kind
  main: boolean
}

interface Pos {
  x: number
  y: number
}

function visible(b: Body, p: Pos, fw: number, fh: number) {
  const g = b.g
  const r0 = Math.max(0, -p.y)
  const r1 = Math.min(g.rows, fh - p.y)
  const c0 = Math.max(0, -p.x)
  const c1 = Math.min(g.cols, fw - p.x)
  if (r1 <= r0 || c1 <= c0) return 0
  let n = 0
  const w = g.cols + 1
  for (let r = r0; r < r1; r++) n += g.prefix[r * w + c1] - g.prefix[r * w + c0]
  return n
}

function overlap(a: Body, pa: Pos, b: Body, pb: Pos) {
  const x0 = Math.max(pa.x, pb.x)
  const x1 = Math.min(pa.x + a.g.cols, pb.x + b.g.cols)
  const y0 = Math.max(pa.y, pb.y)
  const y1 = Math.min(pa.y + a.g.rows, pb.y + b.g.rows)
  if (x1 <= x0 || y1 <= y0) return 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    const ra = (y - pa.y) * a.g.cols - pa.x
    const rb = (y - pb.y) * b.g.cols - pb.x
    for (let x = x0; x < x1; x++) if (a.g.data[ra + x] && b.g.data[rb + x]) n++
  }
  return n
}

/** Distance between two painted extents, 0 when they touch or overlap. */
function gap(a: Body, pa: Pos, b: Body, pb: Pos) {
  const dx = Math.max(0, pb.x + b.g.x0 - (pa.x + a.g.x1), pa.x + a.g.x0 - (pb.x + b.g.x1))
  const dy = Math.max(0, pb.y + b.g.y0 - (pa.y + a.g.y1), pa.y + a.g.y0 - (pb.y + b.g.y1))
  return Math.hypot(dx, dy)
}

/** `upper` lies on `lower`: most of its paint is over the lower object's paint. */
function resting(lower: Body, upper: Body, overlapCells: number) {
  return canCarry(lower, upper) && overlapCells / upper.g.filled >= CARRY_ON
}

/**
 * Draw order: background objects first; then by where the painted part ends — lower on the table is nearer; an
 * object lying on a book or a folder goes right after it whatever its position.
 */
function drawOrder(bodies: Body[], pos: Pos[]): number[] {
  const order = bodies
    .map((_, i) => i)
    .sort(
      (u, v) =>
        Number(bodies[u].main) - Number(bodies[v].main) ||
        pos[u].y + bodies[u].g.y1 - (pos[v].y + bodies[v].g.y1) ||
        u - v,
    )
  for (let pass = 0; pass < bodies.length; pass++) {
    let moved = false
    for (let a = 0; a < order.length; a++)
      for (let c = a + 1; c < order.length; c++) {
        const upper = order[a]
        const lower = order[c]
        const o = overlap(bodies[lower], pos[lower], bodies[upper], pos[upper])
        if (o && resting(bodies[lower], bodies[upper], o)) {
          order.splice(a, 1)
          order.splice(c, 0, upper)
          moved = true
        }
      }
    if (!moved) break
  }
  return order
}

export interface ScoreParts {
  [term: string]: number
}

function score(bodies: Body[], pos: Pos[], fw: number, fh: number, parts?: ScoreParts): number {
  let total = 0
  const add = (term: string, v: number) => {
    if (!v) return
    total += v
    if (parts) parts[term] = (parts[term] ?? 0) + v
  }
  const vis = bodies.map((b, i) => visible(b, pos[i], fw, fh))
  const mains = bodies.map((b, i) => (b.main ? i : -1)).filter((i) => i >= 0)
  const minSide = Math.min(fw, fh)

  bodies.forEach((b, i) => {
    const v = vis[i] / b.g.filled
    if (b.main) {
      const need = MIN_VISIBLE[b.kind]
      if (v < need) add('crop', (need - v) ** 2 * 40 + (need - v) * 2)
    } else {
      if (v < 0.3) add('bgHidden', (0.3 - v) ** 2 * 40 + (0.3 - v) * 2)
      if (v > 0.7) add('bgWhole', (v - 0.7) ** 2 * 20)
      // a background object belongs to the upper part of the frame
      const cy = (pos[i].y + (b.g.y0 + b.g.y1) / 2) / fh
      if (cy > 0.4) add('bgLow', (cy - 0.4) ** 2 * 4)
    }
    // kissing an edge: the painted extent ends within a cell or two of the frame border
    const p = pos[i]
    for (const g of [p.x + b.g.x0, p.y + b.g.y0, fw - (p.x + b.g.x1), fh - (p.y + b.g.y1)]) {
      if (g > -2 && g < 1.5) add('edge', b.main ? 0.25 : 0.1)
    }
  })

  // main objects must not cover each other; a background one may be covered only partly; one thing may lie on a
  // book or a folder
  const carrying = new Set<number>()
  for (let a = 0; a < bodies.length; a++)
    for (let c = a + 1; c < bodies.length; c++) {
      const o = overlap(bodies[a], pos[a], bodies[c], pos[c])
      if (!o) continue
      const lower = resting(bodies[a], bodies[c], o) ? a : resting(bodies[c], bodies[a], o) ? c : -1
      if (lower >= 0 && !carrying.has(lower)) {
        carrying.add(lower)
        continue
      }
      if (bodies[a].main && bodies[c].main) {
        const f = o / Math.min(bodies[a].g.filled, bodies[c].g.filled)
        add('overlap', Math.max(0, f - 0.01) * 30 + Math.max(0, f - 0.05) ** 2 * 300)
      } else if (bodies[a].main || bodies[c].main) {
        const bg = bodies[a].main ? c : a
        const main = bg === a ? c : a
        const f = o / Math.max(1, vis[bg])
        if (f > 0.45) add('bgCovered', (f - 0.45) * 4)
        // a background object is always drawn first, so a main object over it must also stand nearer to the viewer
        // (end lower on the table) — otherwise the lamp's pole goes "through" the wallet behind it
        const mainEnd = pos[main].y + bodies[main].g.y1
        const bgEnd = pos[bg].y + bodies[bg].g.y1
        if (mainEnd < bgEnd) add('depth', (o / bodies[main].g.filled) * 20 + 0.3)
      }
    }

  // main objects stay together; the more of them, the tighter the group, or a big set looks scattered
  if (mains.length > 1) {
    const allowed = mains.length > 2 ? 0.08 : 0.2
    for (const i of mains) {
      let near = Infinity
      for (const j of mains) if (j !== i) near = Math.min(near, gap(bodies[i], pos[i], bodies[j], pos[j]))
      const d = near / minSide
      if (d > allowed) add('apart', (d - allowed) * 5)
    }
  }

  // filled, but not crammed; balanced around the centre
  let painted = 0
  let mx = 0
  let my = 0
  let mw = 0
  const frame = new Uint8Array(fw * fh)
  bodies.forEach((b, i) => {
    const p = pos[i]
    const wgt = b.main ? 1 : 0.35
    for (let y = Math.max(0, p.y); y < Math.min(fh, p.y + b.g.rows); y++) {
      const row = (y - p.y) * b.g.cols - p.x
      for (let x = Math.max(0, p.x); x < Math.min(fw, p.x + b.g.cols); x++) {
        if (!b.g.data[row + x]) continue
        mx += x * wgt
        my += y * wgt
        mw += wgt
        const k = y * fw + x
        if (!frame[k]) {
          frame[k] = 1
          painted++
        }
      }
    }
  })
  const cover = painted / (fw * fh)
  if (cover < 0.26) add('empty', (0.26 - cover) ** 2 * 30 + (0.26 - cover) * 2)
  if (cover > 0.62) add('crammed', (cover - 0.62) ** 2 * 20)
  if (mw) {
    const d = Math.hypot(mx / mw / fw - 0.5, my / mw / fh - 0.5)
    if (d > 0.07) add('balance', (d - 0.07) ** 2 * 14)
  }
  return total
}

/** Picks the detail size for a set of objects: the large set unless its main objects would cram the frame. */
export function suggestSize(picks: Pick[], format: Format): Size {
  const area = picks
    .filter((p) => p.state === 'main')
    .reduce((s, p) => {
      const g = gridOf(p.id, 'large')
      return s + g.filled * ENGINE_CELL.large ** 2
    }, 0)
  return area / (format.w * format.h) > 0.5 || picks.length > 4 ? 'small' : 'large'
}

/** Scores a finished arrangement with the same rules (used to check the rules against the designers' frames). */
export function evaluate(items: Item[], format: Format, size: Size, scale = 1): LayoutResult {
  const cell = ENGINE_CELL[size] * scale
  const fw = Math.ceil(format.w / cell)
  const fh = Math.ceil(format.h / cell)
  const bodies: Body[] = items.map((it) => ({
    pick: { id: it.id, state: it.state },
    g: gridOf(it.id, size),
    kind: objectById(it.id).kind,
    main: it.state === 'main',
  }))
  const pos = items.map((it) => ({ x: Math.round(it.x / cell), y: Math.round(it.y / cell) }))
  const parts: ScoreParts = {}
  return { items, score: score(bodies, pos, fw, fh, parts), parts }
}

export interface LayoutResult {
  items: Item[]
  score: number
  parts: ScoreParts
}

export function autoLayout(picks: Pick[], opts: LayoutOptions): LayoutResult {
  const { format, size, scale = 1, seed = 1, effort = 1 } = opts
  const cell = ENGINE_CELL[size] * scale
  const fw = Math.ceil(format.w / cell)
  const fh = Math.ceil(format.h / cell)
  const bodies: Body[] = picks.map((pick) => ({
    pick,
    g: gridOf(pick.id, size),
    kind: objectById(pick.id).kind,
    main: pick.state === 'main',
  }))
  if (!bodies.length) return { items: [], score: 0, parts: {} }
  const rand = rng(seed * 7919 + bodies.length)

  const randomPos = (b: Body): Pos => {
    const { g } = b
    if (b.main) {
      // centre of the painted part somewhere in the middle 70% of the frame
      const cx = fw * (0.15 + rand() * 0.7)
      const cy = fh * (0.15 + rand() * 0.7)
      return { x: Math.round(cx - (g.x0 + g.x1) / 2), y: Math.round(cy - (g.y0 + g.y1) / 2) }
    }
    // a background object starts half out of the frame, along the top or a side
    const side = rand()
    const cx = side < 0.6 ? fw * rand() : side < 0.8 ? 0 : fw
    const cy = side < 0.6 ? 0 : fh * rand() * 0.5
    return { x: Math.round(cx - (g.x0 + g.x1) / 2), y: Math.round(cy - (g.y0 + g.y1) / 2) }
  }

  const restarts = Math.max(3, Math.round(6 * effort))
  const steps = Math.round(260 * bodies.length * effort)
  let best: Pos[] = []
  let bestScore = Infinity
  for (let r = 0; r < restarts; r++) {
    let cur = bodies.map(randomPos)
    let curScore = score(bodies, cur, fw, fh)
    let localBest = cur
    let localScore = curScore
    for (let s = 0; s < steps; s++) {
      const t = 1 - s / steps
      const temp = 0.08 * t * t + 0.001
      const i = Math.floor(rand() * bodies.length)
      const reach = Math.max(1, Math.round(Math.min(fw, fh) * (0.04 + 0.3 * t)))
      const next = cur.slice()
      next[i] = {
        x: cur[i].x + Math.round((rand() * 2 - 1) * reach),
        y: cur[i].y + Math.round((rand() * 2 - 1) * reach),
      }
      // now and then swap two objects of the same role: escapes local minima the small steps can't leave
      if (bodies.length > 1 && rand() < 0.05) {
        const j = Math.floor(rand() * bodies.length)
        if (j !== i && bodies[j].main === bodies[i].main) {
          const ci = { x: cur[i].x + bodies[i].g.cols / 2, y: cur[i].y + bodies[i].g.rows / 2 }
          const cj = { x: cur[j].x + bodies[j].g.cols / 2, y: cur[j].y + bodies[j].g.rows / 2 }
          next[i] = { x: Math.round(cj.x - bodies[i].g.cols / 2), y: Math.round(cj.y - bodies[i].g.rows / 2) }
          next[j] = { x: Math.round(ci.x - bodies[j].g.cols / 2), y: Math.round(ci.y - bodies[j].g.rows / 2) }
        }
      }
      const ns = score(bodies, next, fw, fh)
      if (ns < curScore || rand() < Math.exp((curScore - ns) / temp)) {
        cur = next
        curScore = ns
        if (ns < localScore) {
          localBest = next
          localScore = ns
        }
      }
    }
    if (localScore < bestScore) {
      best = localBest
      bestScore = localScore
    }
  }

  const parts: ScoreParts = {}
  score(bodies, best, fw, fh, parts)

  const items: Item[] = drawOrder(bodies, best).map((i) => ({ b: bodies[i], p: best[i] })).map(({ b, p }) => ({
    uid: newUid(),
    id: b.pick.id,
    state: b.pick.state,
    x: Math.round(p.x * cell),
    y: Math.round(p.y * cell),
    rot: 0,
    tint: 0,
  }))
  return { items, score: bestScore, parts }
}
