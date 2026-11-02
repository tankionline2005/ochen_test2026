/** Stress check: bigger sets in the small size, every format. `npx tsx ../scripts/layout-many.ts <out.png>` */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMES, type Size } from '../web/src/engine/library'
import { autoLayout, suggestSize, type Pick } from '../web/src/engine/layout'
import { FORMATS, sceneSvg } from '../web/src/engine/scene'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, '..', 'web', 'package.json'))
const { Resvg } = require('@resvg/resvg-js')
const body = (s: Size) => JSON.parse(readFileSync(join(here, '..', 'web', 'src', 'library', `bodies-${s}.json`), 'utf8'))
const bodies = { large: body('large'), small: body('small') }
const sets: Pick[][] = [
  [{ id: 'book', state: 'main' }, { id: 'coin', state: 'main' }, { id: 'wallet', state: 'main' }, { id: 'lamp', state: 'bg' }, { id: 'pen', state: 'bg' }],
  [{ id: 'headphones', state: 'main' }, { id: 'phone', state: 'main' }, { id: 'vase', state: 'bg' }, { id: 'puzzle', state: 'main' }],
  [{ id: 'folder', state: 'main' }, { id: 'pen', state: 'main' }, { id: 'coin', state: 'main' }, { id: 'coin', state: 'main' }, { id: 'lamp', state: 'main' }],
  [{ id: 'coin', state: 'main' }],
]
let sheet = ''
let y = 0
const W = 260
for (const [r, picks] of sets.entries()) {
  let rowH = 0
  FORMATS.forEach((format, c) => {
    const size = suggestSize(picks, format)
    const t = Date.now()
    const res = autoLayout(picks, { format, size, seed: 3 })
    const ms = Date.now() - t
    const h = (W * format.h) / format.w
    rowH = Math.max(rowH, h)
    const svg = sceneSvg({ format, size, scale: 1, palette: SCHEMES[r % 3], items: res.items, decor: true }, bodies[size])
      .replace(/id="[^"]*"/g, '')
      .replace(/<clipPath id="frame">/, `<clipPath id="f${r}${c}">`)
      .replace(/url\(#frame\)/, `url(#f${r}${c})`)
      .replace(/^<svg[^>]*>/, (m) => m.replace(/width="\d+" height="\d+"/, `x="${c * (W + 14)}" y="${y + 16}" width="${W}" height="${h}"`))
    sheet += `<text x="${c * (W + 14)}" y="${y + 11}" font-size="10" font-family="Arial">${size} ${ms}ms score ${res.score.toFixed(2)} ${JSON.stringify(res.parts).replace(/"/g, '')}</text>${svg}`
  })
  y += rowH + 30
}
const width = 3 * (W + 14)
writeFileSync(process.argv[2], new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}"><rect width="100%" height="100%" fill="#fff"/>${sheet}</svg>`).render().asPng())
