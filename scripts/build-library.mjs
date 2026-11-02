/**
 * Builds the app's illustration library from the SVGs exported from Figma (library/src).
 *
 *   library/src/{large,small}/{main,bg}/<id>.svg   40 objects
 *   library/src/tiles/{large,small}/<scheme>.svg    background tiles
 *   library/meta.json                               names, synonyms, meanings, colour schemes
 *
 * Geometry is copied as is: every path keeps its `d`, nothing is simplified or re-drawn. The only change is the
 * colour: each hex is replaced by its role in the palette (`$bg1`, `$obj2`, …), so a composition can be recoloured
 * into any scheme by substituting the role colours back. Unknown colours stop the build — a colour outside the
 * palette would break the "don't break the colour scheme" rule silently.
 *
 * Output: web/src/library/manifest.json (small: names, sizes, occupancy masks, tile decor) and
 * web/src/library/bodies-{large,small}.json (the path markup, loaded on demand).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'web', 'package.json'))
const { Resvg } = require('@resvg/resvg-js')

const SRC = join(root, 'library', 'src')
const OUT = join(root, 'web', 'src', 'library')
const meta = JSON.parse(readFileSync(join(root, 'library', 'meta.json'), 'utf8'))

const SIZES = ['large', 'small']
const STATES = ['main', 'bg']
/** Occupancy masks: one cell per this many scene units (objects are drawn in units of their own size set). */
const CELL = { large: 8, small: 4 }

const schemeById = Object.fromEntries(meta.schemes.map((s) => [s.id, s]))
const roleOf = (scheme) => {
  const map = {}
  for (const [role, hex] of Object.entries(scheme.colors)) map[hex.toUpperCase()] = role
  return map
}
// objects are drawn in the lilac scheme
const LILAC = roleOf(schemeById.lilac)

function attrs(tag) {
  const out = {}
  for (const [, k, v] of tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) out[k] = v
  return out
}

function colourRole(value, roles, where) {
  if (value === undefined || value === 'none') return value
  const hex = value.toLowerCase() === 'white' ? '#FFFFFF' : value.toUpperCase()
  const role = roles[hex]
  if (!role) throw new Error(`${where}: colour ${value} is not in the palette`)
  return `$${role}`
}

/** Flat list of drawable elements of a Figma export, colours turned into roles. */
function elements(svg, roles, where) {
  const list = []
  for (const [tag, name] of svg.matchAll(/<(path|rect)\b[^>]*\/>/g).map((m) => [m[0], m[1]])) {
    const a = attrs(tag)
    if (tag.includes('clip')) continue
    const el = { tag: name, a: {} }
    if (name === 'path') el.a.d = a.d
    else for (const k of ['x', 'y', 'width', 'height', 'transform']) if (a[k] !== undefined) el.a[k] = a[k]
    if (a.fill !== undefined) el.a.fill = colourRole(a.fill, roles, where)
    if (a.stroke !== undefined) el.a.stroke = colourRole(a.stroke, roles, where)
    if (a['stroke-width'] !== undefined) el.a['stroke-width'] = a['stroke-width']
    if (a['fill-rule']) el.a['fill-rule'] = a['fill-rule']
    if (a['clip-rule']) el.a['clip-rule'] = a['clip-rule']
    list.push(el)
  }
  return list
}

const markup = (els) => els.map((e) => `<${e.tag} ${Object.entries(e.a).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
const size = (svg) => {
  const m = svg.match(/<svg[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/)
  return { w: Number(m[1]), h: Number(m[2]) }
}

/** Which cells of the object hold paint (shadows included): used by the layout to measure overlaps and crops. */
function mask(svg, w, h, cell) {
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / cell)
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: cols } })
  const img = r.render()
  const px = img.pixels
  const bits = new Uint8Array(Math.ceil((cols * rows) / 8))
  let filled = 0
  for (let y = 0; y < Math.min(rows, img.height); y++) {
    for (let x = 0; x < Math.min(cols, img.width); x++) {
      if (px[(y * img.width + x) * 4 + 3] > 40) {
        const i = y * cols + x
        bits[i >> 3] |= 1 << (i & 7)
        filled++
      }
    }
  }
  return { cols, rows, cell, filled, bits: Buffer.from(bits).toString('base64') }
}

const manifest = { schemes: meta.schemes, objects: {}, decor: {} }
const bodies = { large: {}, small: {} }

for (const [id, info] of Object.entries(meta.objects)) {
  const entry = { id, name: info.name, kind: info.kind, synonyms: info.synonyms, meanings: info.meanings, sizes: {} }
  for (const s of SIZES) {
    const files = Object.fromEntries(STATES.map((st) => [st, readFileSync(join(SRC, s, st, `${id}.svg`), 'utf8')]))
    const { w, h } = size(files.main)
    const b = size(files.bg)
    if (b.w !== w || b.h !== h) throw new Error(`${s}/${id}: main and bg differ in size`)
    for (const st of STATES) {
      const els = elements(files[st], LILAC, `${s}/${st}/${id}`)
      bodies[s][`${id}:${st}`] = markup(els)
    }
    entry.sizes[s] = { w, h, mask: mask(files.main, w, h, CELL[s]) }
  }
  manifest.objects[id] = entry
}

/**
 * Tile decor: the confetti, lines and the corner of each background style. Each element is tied to the corner of
 * the tile it sits in, so on a 1200×630 or 800×1200 frame it stays at the same distance from that corner instead of
 * being stretched.
 */
const TILE_STYLE = { dots: 'lilac', corner: 'peach' }
for (const [style, scheme] of Object.entries(TILE_STYLE)) {
  manifest.decor[style] = {}
  for (const s of SIZES) {
    const svg = readFileSync(join(SRC, 'tiles', s, `${scheme}.svg`), 'utf8')
    const { w } = size(svg)
    const els = elements(svg, roleOf(schemeById[scheme]), `tiles/${s}/${scheme}`).filter((e) => e.tag === 'path')
    const groups = { tl: [], tr: [], bl: [], br: [] }
    for (const e of els) {
      const n = e.a.d.match(/-?\d*\.?\d+/g).map(Number)
      const xs = n.filter((_, i) => i % 2 === 0)
      const ys = n.filter((_, i) => i % 2 === 1)
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2
      groups[(cy < w / 2 ? 't' : 'b') + (cx < w / 2 ? 'l' : 'r')].push(e)
    }
    manifest.decor[style][s] = {
      tile: w,
      groups: Object.fromEntries(Object.entries(groups).filter(([, v]) => v.length).map(([k, v]) => [k, markup(v)])),
    }
  }
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest))
for (const s of SIZES) writeFileSync(join(OUT, `bodies-${s}.json`), JSON.stringify(bodies[s]))
const kb = (f) => (readFileSync(join(OUT, f)).length / 1024).toFixed(0)
console.log(`library: ${Object.keys(manifest.objects).length} objects × ${SIZES.length} sizes × ${STATES.length} states — manifest ${kb('manifest.json')} KB, bodies ${kb('bodies-large.json')} / ${kb('bodies-small.json')} KB`)
