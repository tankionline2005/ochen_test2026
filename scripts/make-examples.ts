/**
 * The example compositions for the write-up: objects chosen by the deployed AI (scripts/examples-ai.json, the real
 * answers of /api/compose), laid out by the engine, written as SVG + PNG previews into examples/.
 *
 *   npx tsx scripts/make-examples.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMES, type Size } from '../web/src/engine/library'
import { autoLayout, suggestSize, type Pick } from '../web/src/engine/layout'
import { FORMATS, sceneSvg } from '../web/src/engine/scene'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'web', 'package.json'))
const { Resvg } = require('@resvg/resvg-js')
const bodies = (s: Size) => JSON.parse(readFileSync(join(root, 'web', 'src', 'library', `bodies-${s}.json`), 'utf8'))
const answers: { prompt: string; result: { picks: Pick[]; title: string; reason: string } }[] = JSON.parse(
  readFileSync(join(root, 'scripts', 'examples-ai.json'), 'utf8'),
)

// each example in its own format and colour scheme, to show all three
const plan = [
  { file: '1-finance-square-lilac', format: 'square', scheme: 'lilac' },
  { file: '2-teamwork-wide-peach', format: 'wide', scheme: 'peach' },
  { file: '3-podcast-tall-teal', format: 'tall', scheme: 'teal' },
] as const

mkdirSync(join(root, 'examples'), { recursive: true })
answers.forEach((a, i) => {
  const p = plan[i]
  const format = FORMATS.find((f) => f.id === p.format)!
  const size = suggestSize(a.result.picks, format)
  // a few seeds, the best-scored arrangement wins
  const best = [11, 23, 37, 41, 59].map((seed) => autoLayout(a.result.picks, { format, size, seed, effort: 1.5 })).sort((x, y) => x.score - y.score)[0]
  const scene = { format, size, scale: 1, palette: SCHEMES.find((s) => s.id === p.scheme)!, items: best.items, decor: true }
  const svg = sceneSvg(scene, bodies(size))
  writeFileSync(join(root, 'examples', `${p.file}.svg`), svg)
  writeFileSync(join(root, 'examples', `${p.file}.png`), new Resvg(svg, { fitTo: { mode: 'width', value: Math.min(800, format.w) } }).render().asPng())
  console.log(`${p.file}: «${a.prompt}» → ${a.result.picks.map((x) => x.id + (x.state === 'bg' ? ' (фон)' : '')).join(', ')} — ${size}, score ${best.score.toFixed(2)}, ${(svg.length / 1024).toFixed(0)} KB`)
})
