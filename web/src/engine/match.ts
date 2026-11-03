import { OBJECTS, type State } from './library'
import type { Pick } from './layout'

/**
 * Words → objects without the AI: scenario 2 (the person names the objects) and the fallback for scenario 1 when
 * the free model doesn't answer. Russian words change endings, so words are compared by their first letters.
 */

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
const words = (s: string) => norm(s).match(/[a-zа-я0-9-]+/g) ?? []
/** Same word in another form: they share the beginning, all but the last two letters of the shorter one. */
const same = (a: string, b: string) => {
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  return p >= 3 && p >= Math.min(a.length, b.length) - 2
}

const NUMBERS: Record<string, number> = { два: 2, две: 2, пара: 2, три: 3, четыре: 4, 2: 2, 3: 3, 4: 4 }
const BG_WORDS = ['фон', 'фоном', 'фоновый', 'фоновая', 'фоновое', 'фоновые', 'сзади', 'позади', 'background', 'bg']

export interface NamesResult {
  picks: Pick[]
  /** words that were not recognised */
  unknown: string[]
}

/**
 * "книга, телефон и две монеты, лампа фоном" → book, phone, coin, coin, lamp (bg).
 * Separators: commas, «и», «+», new lines. A part with «фон…» makes its object a background one.
 */
export function parseNames(text: string): NamesResult {
  const picks: Pick[] = []
  const unknown: string[] = []
  const parts = norm(text)
    .split(/[,;+\n]|\sи\s|\sand\s/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const part of parts) {
    const ws = words(part)
    const state: State = ws.some((w) => BG_WORDS.includes(w)) ? 'bg' : 'main'
    const count = Math.min(4, ws.map((w) => NUMBERS[w]).find(Boolean) ?? 1)
    let found = false
    for (const w of ws) {
      if (BG_WORDS.includes(w) || NUMBERS[w]) continue
      const obj = OBJECTS.find((o) => o.synonyms.some((syn) => !syn.includes(' ') && same(w, norm(syn))))
      if (obj) {
        for (let i = 0; i < count; i++) picks.push({ id: obj.id, state })
        found = true
        break
      }
    }
    if (!found) {
      const multi = OBJECTS.find((o) => o.synonyms.some((syn) => syn.includes(' ') && part.includes(norm(syn))))
      if (multi) picks.push({ id: multi.id, state })
      else unknown.push(part)
    }
  }
  return { picks: picks.slice(0, 8), unknown }
}

/**
 * A metaphor or a headline → objects by their meanings ("финансовая грамотность" → coin, wallet, book).
 * Two or three best matches become main objects, the next one goes to the background.
 */
export function matchMeaning(text: string): Pick[] {
  const ws = words(text).filter((w) => w.length > 2)
  const scored = OBJECTS.map((o) => {
    let s = 0
    for (const w of ws) {
      if (o.synonyms.some((syn) => same(w, norm(syn)))) s += 3
      for (const m of o.meanings) for (const mw of words(m)) if (mw.length > 3 && same(w, mw)) s += 1.5
    }
    return { id: o.id, s }
  }).sort((a, b) => b.s - a.s)
  const hit = scored.filter((x) => x.s > 0)
  if (!hit.length) {
    // nothing matched: a calm, universal desk scene rather than an empty frame
    return [
      { id: 'book', state: 'main' },
      { id: 'pen', state: 'main' },
      { id: 'lamp', state: 'bg' },
    ]
  }
  const main = hit.slice(0, hit.length > 2 && hit[2].s >= hit[0].s * 0.6 ? 3 : 2).map((x) => ({ id: x.id, state: 'main' as State }))
  const bgCandidate = scored.find((x) => !main.some((m) => m.id === x.id) && ['lamp', 'vase', 'book', 'folder'].includes(x.id))
  return bgCandidate ? [...main, { id: bgCandidate.id, state: 'bg' }] : main
}
