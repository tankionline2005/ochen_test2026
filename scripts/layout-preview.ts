/**
 * Puts the automatic layout next to the designers' frames: for each of the 16 example frames the same objects in the
 * same format are composed by the engine (two seeds), and everything is rendered into one PNG sheet.
 *
 *   npm run layout -- <out.png> [effort]
 *
 * The designers' frames are also scored by the engine's rules — if they get large penalties, the rules are wrong.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMES, type Bodies } from '../web/src/engine/library'
import { autoLayout, evaluate } from '../web/src/engine/layout'
import { FORMATS, type Item, type Scene, sceneSvg } from '../web/src/engine/scene'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '..', 'web', 'package.json'))
const { Resvg } = require('@resvg/resvg-js')
const bodies: Bodies = JSON.parse(readFileSync(join(here, '..', 'web', 'src', 'library', 'bodies-large.json'), 'utf8'))
const examples: { w: number; h: number; objects: { id: string; state: 'main' | 'bg'; x: number; y: number }[] }[] = JSON.parse(
  readFileSync(join(here, 'examples-placements.json'), 'utf8'),
)

const out = process.argv[2] ?? 'layout-preview.png'
const effort = Number(process.argv[3] ?? 1)
const CELL = 300
const GAP = 16
const cols = 3
const fmt = (s: number) => s.toFixed(2)

let sheet = ''
let y = 0
let totalDesigner = 0
let totalOurs = 0
const t0 = Date.now()
examples.forEach((ex, row) => {
  const format = FORMATS.find((f) => f.w === ex.w && f.h === ex.h)!
  const designer: Item[] = ex.objects
    .map((o, i) => ({ uid: `d${i}`, id: o.id, state: o.state, x: o.x, y: o.y, rot: 0, tint: 0 }))
    .sort((a, b) => Number(a.state === 'main') - Number(b.state === 'main'))
  const picks = ex.objects.map((o) => ({ id: o.id, state: o.state }))
  const scenes: { scene: Scene; label: string }[] = []
  const base = { format, size: 'large' as const, scale: 1, palette: SCHEMES[0], decor: true }
  const d = evaluate(designer, format, 'large')
  totalDesigner += d.score
  scenes.push({ scene: { ...base, items: designer }, label: `designer ${fmt(d.score)} ${JSON.stringify(roundParts(d.parts))}` })
  for (const seed of [1, 2]) {
    const r = autoLayout(picks, { format, size: 'large', seed, effort })
    if (seed === 1) totalOurs += r.score
    scenes.push({ scene: { ...base, items: r.items }, label: `seed ${seed}: ${fmt(r.score)} ${JSON.stringify(roundParts(r.parts))}` })
  }
  const h = (CELL * format.h) / format.w
  scenes.forEach(({ scene, label }, c) => {
    const x = c * (CELL + GAP)
    const svg = sceneSvg(scene, bodies).replace(/^<svg[^>]*>/, (m) =>
      m.replace(/width="\d+" height="\d+"/, `x="${x}" y="${y + 18}" width="${CELL}" height="${h}"`),
    )
    sheet += `<text x="${x}" y="${y + 12}" font-size="9" font-family="Arial" fill="#333">${row + 1}. ${escape(label)}</text>${svg.replace(/id="[^"]*"/g, '').replace(/clip-path="url\(#frame\)"/, `clip-path="url(#f${row}_${c})"`).replace(/<clipPath id="frame">/, `<clipPath id="f${row}_${c}">`)}`
  })
  y += h + 18 + GAP
})
const width = cols * (CELL + GAP)
const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}"><rect width="100%" height="100%" fill="#fff"/>${sheet}</svg>`
writeFileSync(out, new Resvg(full, { fitTo: { mode: 'width', value: width } }).render().asPng())
console.log(`designer total ${fmt(totalDesigner)} — ours (seed 1) ${fmt(totalOurs)} — ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out}`)

function roundParts(p: Record<string, number>) {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v * 100) / 100]))
}
function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '')
}
