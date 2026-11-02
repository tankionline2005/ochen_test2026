import { type Bodies, type Colors, manifest, objectById, type Palette, type Role, type Size, type State } from './library'

export interface Format {
  id: 'square' | 'wide' | 'tall'
  name: string
  w: number
  h: number
}

/** The formats from the designers' examples. */
export const FORMATS: Format[] = [
  { id: 'square', name: 'Квадрат', w: 1000, h: 1000 },
  { id: 'wide', name: 'Обложка', w: 1200, h: 630 },
  { id: 'tall', name: 'Вертикаль', w: 800, h: 1200 },
]

export interface Item {
  uid: string
  id: string
  state: State
  /** top-left corner of the object in frame units */
  x: number
  y: number
  /** degrees, around the object's centre */
  rot: number
  /** which permutation of the object colours (obj1–3) it wears, 0 = as drawn */
  tint: number
}

export interface Scene {
  format: Format
  size: Size
  /** one scale for the whole scene — objects never change size relative to each other */
  scale: number
  palette: Palette
  /** draw order: first is the farthest */
  items: Item[]
  /** the background's confetti / corner shapes */
  decor: boolean
}

/** Six ways to hand the three object colours around; the background roles never move. */
export const TINTS: [Role, Role, Role][] = [
  ['obj1', 'obj2', 'obj3'],
  ['obj2', 'obj1', 'obj3'],
  ['obj1', 'obj3', 'obj2'],
  ['obj3', 'obj1', 'obj2'],
  ['obj2', 'obj3', 'obj1'],
  ['obj3', 'obj2', 'obj1'],
]

export const objectSize = (id: string, size: Size) => objectById(id).sizes[size]

/** Object markup in real colours. */
export function paint(markup: string, colors: Colors, tint = 0): string {
  const [a, b, c] = TINTS[tint] ?? TINTS[0]
  const swap: Partial<Record<Role, Role>> = { obj1: a, obj2: b, obj3: c }
  return markup.replace(/\$(bg1|bg2|bg3|ink|obj1|obj2|obj3|white)/g, (_, role: Role) => colors[swap[role] ?? role])
}

export function itemTransform(item: Item, size: Size, scale: number): string {
  const { w, h } = objectSize(item.id, size)
  const parts = [`translate(${r2(item.x)} ${r2(item.y)})`]
  if (scale !== 1) parts.push(`scale(${r4(scale)})`)
  if (item.rot) parts.push(`rotate(${r2(item.rot)} ${r2(w / 2)} ${r2(h / 2)})`)
  return parts.join(' ')
}

/** Background: the flat fill plus the decor of the palette's tile style, each piece kept at its corner. */
export function backgroundMarkup(scene: Scene): string {
  const { w, h } = scene.format
  const c = scene.palette.colors
  let out = `<rect width="${w}" height="${h}" fill="${c.bg1}"/>`
  if (!scene.decor) return out
  const decor = manifest.decor[scene.palette.tile][scene.size]
  const t = decor.tile
  const shift: Record<string, [number, number]> = { tl: [0, 0], tr: [w - t, 0], bl: [0, h - t], br: [w - t, h - t] }
  for (const [corner, markup] of Object.entries(decor.groups)) {
    const [dx, dy] = shift[corner]
    const body = paint(markup, c)
    out += dx || dy ? `<g transform="translate(${r2(dx)} ${r2(dy)})">${body}</g>` : body
  }
  return out
}

export const layerName = (item: Item) => `${objectById(item.id).name} (${item.state === 'main' ? 'главный' : 'фоновый'})`

/**
 * The whole composition as a standalone SVG. Every object is its own group named after it (Figma shows the ids as
 * layer names), so the file stays editable; nothing is rasterised.
 */
export function sceneSvg(scene: Scene, bodies: Bodies): string {
  const { w, h } = scene.format
  const used = new Map<string, number>()
  const groups = scene.items
    .map((item) => {
      const name = layerName(item)
      const n = (used.get(name) ?? 0) + 1
      used.set(name, n)
      const id = escapeAttr(n > 1 ? `${name} ${n}` : name)
      return `<g id="${id}" transform="${itemTransform(item, scene.size, scene.scale)}">${paint(bodies[`${item.id}:${item.state}`], scene.palette.colors, item.tint)}</g>`
    })
    .join('\n')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">\n` +
    `<defs><clipPath id="frame"><rect width="${w}" height="${h}"/></clipPath></defs>\n` +
    `<g clip-path="url(#frame)">\n<g id="Фон">${backgroundMarkup(scene)}</g>\n${groups}\n</g>\n</svg>\n`
  )
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10000) / 10000

let counter = 0
export const newUid = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`
