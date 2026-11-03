import { useSyncExternalStore } from 'react'
import { type Colors, type Palette, ROLES, type Role, SCHEMES } from '../engine/library'

/**
 * Colour schemes: the three from the library plus the person's own, kept in localStorage. A palette is eight roles;
 * recolouring a composition is substituting them (engine/scene.ts → paint), so a new scheme needs no new artwork.
 */

const KEY = 'palettes.v1'

function read(): Palette[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Palette[]
    return Array.isArray(list) ? list.filter((p) => p?.colors && ROLES.every((r) => /^#[0-9a-f]{6}$/i.test(p.colors[r]))) : []
  } catch {
    return []
  }
}

let custom = read()
let snapshot = { custom, all: [...SCHEMES, ...custom] }
const listeners = new Set<() => void>()
function save(next: Palette[]) {
  custom = next
  snapshot = { custom, all: [...SCHEMES, ...custom] }
  try {
    localStorage.setItem(KEY, JSON.stringify(custom))
  } catch {
    // not remembered in private mode
  }
  listeners.forEach((l) => l())
}

export function usePalettes() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => snapshot,
  )
  return {
    ...s,
    put: (p: Palette) => save(custom.some((c) => c.id === p.id) ? custom.map((c) => (c.id === p.id ? p : c)) : [...custom, p]),
    remove: (id: string) => save(custom.filter((c) => c.id !== id)),
  }
}

export const ROLE_LABEL: Record<Role, string> = {
  bg1: 'Фон — светлый',
  bg2: 'Фон — средний',
  bg3: 'Фон — тёмный',
  ink: 'Контур и тени',
  obj1: 'Объект — 1',
  obj2: 'Объект — 2',
  obj3: 'Объект — 3',
  white: 'Белый',
}

/** The order hex codes are read in when pasted as a plain list — the same as the palette cards in Figma. */
export const LIST_ORDER: Role[] = ['bg1', 'bg2', 'bg3', 'obj1', 'obj2', 'obj3', 'ink', 'white']

const HEX = /#?\b([0-9a-f]{6}|[0-9a-f]{3})\b/gi
const full = (h: string) => {
  const x = h.replace('#', '').toUpperCase()
  return '#' + (x.length === 3 ? x.split('').map((c) => c + c).join('') : x)
}

/**
 * Reads a palette from text: JSON with role names ({"bg1": "#…"} or {"colors": {…}}), a JSON array, or any text
 * with hex codes in it (CSS variables, a list from Figma). A plain list goes in LIST_ORDER; ink and white default to
 * the library's.
 */
export function parsePalette(text: string, base: Colors = SCHEMES[0].colors): { colors: Colors; name?: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    const data = JSON.parse(trimmed)
    const obj = data?.colors ?? data
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const colors = { ...base }
      let n = 0
      for (const r of ROLES) {
        if (typeof obj[r] === 'string' && obj[r].match(HEX)) {
          colors[r] = full(obj[r])
          n++
        }
      }
      if (n >= 3) return { colors, name: typeof data.name === 'string' ? data.name : undefined }
    }
    if (Array.isArray(obj)) return fromList(obj.filter((x) => typeof x === 'string').join(' '), base)
  } catch {
    // not JSON — look for hex codes
  }
  return fromList(trimmed, base)
}

function fromList(text: string, base: Colors) {
  const codes = [...text.matchAll(HEX)].map((m) => full(m[0]))
  if (codes.length < 6) return null
  const colors = { ...base }
  LIST_ORDER.forEach((r, i) => {
    if (codes[i]) colors[r] = codes[i]
  })
  return { colors }
}

// --- colour maths for the checks and for palettes taken from a picture ---

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
export const luminance = (h: string) => {
  const [r, g, b] = rgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

/** The scheme's rules as warnings: they don't block saving, they say what will look off. */
export function checkPalette(c: Colors): string[] {
  const out: string[] = []
  if (!(luminance(c.bg1) > luminance(c.bg2) && luminance(c.bg2) > luminance(c.bg3)))
    out.push('Цвета фона должны идти от светлого к тёмному: светлый — заливка кадра, тёмный — тени и линии на фоне.')
  if (contrast(c.ink, c.bg1) < 4) out.push('Контур почти сливается со светлым фоном — объекты потеряют очертания.')
  if (contrast(c.bg3, c.bg1) < 1.6) out.push('Тёмный цвет фона слишком близок к светлому: фоновые объекты будут почти не видны.')
  const bg = [c.bg1, c.bg2, c.bg3]
  for (const o of ['obj1', 'obj2', 'obj3'] as const)
    if (bg.some((b) => b.toUpperCase() === c[o].toUpperCase()))
      out.push(`${ROLE_LABEL[o]} совпадает с цветом фона: на главном объекте этот цвет сольётся с кадром.`)
  return out
}

/**
 * A palette from a picture: the dominant colours by k-means; the largest family of similar hues becomes the
 * background (light → dark), the most distinct remaining colours become the object colours.
 */
export async function paletteFromImage(file: File, base: Colors = SCHEMES[0].colors): Promise<Colors> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Не получилось открыть картинку'))
      i.src = url
    })
    const side = 96
    const cv = document.createElement('canvas')
    cv.width = side
    cv.height = Math.max(1, Math.round((side * img.height) / img.width))
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0, cv.width, cv.height)
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data
    const pts: number[][] = []
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 200) pts.push([px[i], px[i + 1], px[i + 2]])
    if (pts.length < 20) throw new Error('В картинке слишком мало цвета')
    const k = 7
    let cent = Array.from({ length: k }, (_, i) => pts[Math.floor((i + 0.5) * (pts.length / k))].slice())
    let assign = new Array(pts.length).fill(0)
    for (let iter = 0; iter < 12; iter++) {
      assign = pts.map((p) => {
        let best = 0
        let bd = Infinity
        cent.forEach((c, j) => {
          const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2
          if (d < bd) {
            bd = d
            best = j
          }
        })
        return best
      })
      cent = cent.map((c, j) => {
        const mine = pts.filter((_, i) => assign[i] === j)
        if (!mine.length) return c
        return [0, 1, 2].map((ch) => mine.reduce((s, p) => s + p[ch], 0) / mine.length)
      })
    }
    const clusters = cent
      .map((c, j) => ({ hex: toHex(c[0], c[1], c[2]), n: assign.filter((a) => a === j).length, hsl: hsl(c) }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n)
    const anchor = clusters[0]
    const family = clusters.filter((c) => hueGap(c.hsl[0], anchor.hsl[0]) < 28 || c.hsl[1] < 0.12)
    const bgFam = family.slice(0, 3).sort((a, b) => b.hsl[2] - a.hsl[2])
    while (bgFam.length < 3) {
      const last = bgFam[bgFam.length - 1].hsl
      bgFam.push({ hex: hslHex(last[0], last[1], Math.max(0.2, last[2] - 0.18)), n: 0, hsl: [last[0], last[1], last[2] - 0.18] })
    }
    const rest = clusters.filter((c) => !bgFam.includes(c)).sort((a, b) => b.hsl[1] - a.hsl[1])
    const objs = rest.slice(0, 3).map((c) => c.hex)
    while (objs.length < 3) objs.push([base.obj1, base.obj2, base.obj3][objs.length])
    return { ...base, bg1: bgFam[0].hex, bg2: bgFam[1].hex, bg3: bgFam[2].hex, obj1: objs[0], obj2: objs[1], obj3: objs[2] }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function hsl([r, g, b]: number[]): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
function hslHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
  }
  return toHex(f(0), f(8), f(4))
}

export const newPaletteId = () => `custom-${Date.now().toString(36)}`
