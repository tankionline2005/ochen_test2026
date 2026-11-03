/**
 * Pictures for the site itself, from the designers' own frames (scripts/examples-placements.json): the composition
 * on the "About" page and the 1200×630 link preview.   npx tsx scripts/make-hero.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMES } from '../web/src/engine/library'
import { FORMATS, type Item, sceneSvg } from '../web/src/engine/scene'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'web', 'package.json'))
const { Resvg } = require('@resvg/resvg-js')
const bodies = JSON.parse(readFileSync(join(root, 'web', 'src', 'library', 'bodies-large.json'), 'utf8'))
const frames: { w: number; h: number; objects: { id: string; state: 'main' | 'bg'; x: number; y: number }[] }[] = JSON.parse(
  readFileSync(join(root, 'scripts', 'examples-placements.json'), 'utf8'),
)

function render(index: number, out: string, width: number) {
  const f = frames[index]
  const format = FORMATS.find((x) => x.w === f.w && x.h === f.h)!
  const items: Item[] = f.objects
    .map((o, i) => ({ uid: `h${i}`, id: o.id, state: o.state, x: o.x, y: o.y, rot: 0, tint: 0 }))
    .sort((a, b) => Number(a.state === 'main') - Number(b.state === 'main'))
  const svg = sceneSvg({ format, size: 'large', scale: 1, palette: SCHEMES[0], items, decor: true }, bodies)
  writeFileSync(join(root, 'web', 'public', out), new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng())
  console.log(out, f.objects.map((o) => o.id).join('+'))
}

render(0, 'about-hero.png', 360) // the phone on the open book, 1000×1000
render(5, 'og.png', 1200) // the same pair, 1200×630
