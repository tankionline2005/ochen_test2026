import { useSyncExternalStore } from 'react'
import { composeStream, type ComposeEvent } from '../api'
import { loadBodies, objectById, type Size } from '../engine/library'
import { type Pick, suggestSize } from '../engine/layout'
import { matchMeaning, parseNames } from '../engine/match'
import { randomSeed, runLayout } from '../engine/runLayout'
import type { Item, Scene } from '../engine/scene'

/**
 * One composition run, from words to a finished scene, with a live status for the sphere overlay.
 *
 *   by meaning: the server asks the model which objects fit (streamed: queued → sent → the model's thinking → answer);
 *               if the model fails or is too slow, the local dictionary of meanings picks them instead
 *   by names:   the words are matched to objects right here
 *   then:       layout (in a worker) → colours of the palette → the scene
 *
 * The state lives outside React so the overlay can sit at the app root while the editor starts the run.
 */

export type StageId = 'read' | 'send' | 'think' | 'pick' | 'layout' | 'paint' | 'render'
export type StageState = 'wait' | 'active' | 'done'

export interface Stage {
  id: StageId
  label: string
  state: StageState
}

export interface ComposeState {
  open: boolean
  mode: 'meaning' | 'names'
  stages: Stage[]
  /** the big line over the sphere */
  status: string
  /** the small live line under it: the model's thoughts, the objects found */
  live: string
  startedAt: number
}

export interface ComposeOutcome {
  picks: Pick[]
  size: Size
  source: 'ai' | 'dictionary' | 'names'
  title?: string
  reason?: string
  note?: string
  seconds: number
}

const MODEL_TIMEOUT = 95_000

let state: ComposeState = { open: false, mode: 'meaning', stages: [], status: '', live: '', startedAt: 0 }
const listeners = new Set<() => void>()
const set = (patch: Partial<ComposeState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const useCompose = () => useSyncExternalStore(subscribe, () => state)

let controller: AbortController | null = null
export function cancelCompose() {
  controller?.abort()
  set({ open: false })
}

const STAGES: Record<ComposeState['mode'], [StageId, string][]> = {
  meaning: [
    ['send', 'Отправляю запрос модели'],
    ['think', 'ИИ размышляет над смыслом'],
    ['pick', 'ИИ выбирает объекты'],
    ['layout', 'Компоновка объектов'],
    ['paint', 'Перекраска в палитру'],
    ['render', 'Рендер SVG'],
  ],
  names: [
    ['read', 'Распознаю названия'],
    ['layout', 'Компоновка объектов'],
    ['paint', 'Перекраска в палитру'],
    ['render', 'Рендер SVG'],
  ],
}

function stage(id: StageId, st: StageState, label?: string) {
  set({
    stages: state.stages.map((s) => (s.id === id ? { ...s, state: st, label: label ?? s.label } : s)),
    ...(st === 'active' ? { status: label ?? state.stages.find((s) => s.id === id)?.label ?? '' } : {}),
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Fast local steps still show for a moment: a status that flashes by reads as a glitch. */
async function atLeast<T>(ms: number, work: Promise<T>): Promise<T> {
  const [v] = await Promise.all([work, sleep(ms)])
  return v
}

export class ComposeError extends Error {}

const namesOf = (picks: Pick[]) =>
  picks.map((p) => objectById(p.id).name.toLowerCase() + (p.state === 'bg' ? ' (фон)' : '')).join(', ')

/** The model's thoughts arrive in pieces; the sphere shows the tail of the latest sentence. */
function tail(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  const cut = clean.length > 110 ? '…' + clean.slice(-110).replace(/^\S*\s/, '') : clean
  return cut
}

export async function compose(opts: {
  mode: 'meaning' | 'names'
  text: string
  scene: Scene
  size: Size | 'auto'
}): Promise<{ scene: Scene; outcome: ComposeOutcome } | null> {
  const { mode, text, scene } = opts
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  const started = Date.now()
  set({
    open: true,
    mode,
    startedAt: started,
    live: '',
    stages: STAGES[mode].map(([id, label]) => ({ id, label, state: 'wait' })),
  })

  try {
    let picks: Pick[] = []
    let source: ComposeOutcome['source'] = mode === 'names' ? 'names' : 'ai'
    let title: string | undefined
    let reason: string | undefined
    let note: string | undefined

    if (mode === 'names') {
      stage('read', 'active')
      const parsed = await atLeast(500, Promise.resolve(parseNames(text)))
      if (!parsed.picks.length) {
        throw new ComposeError(
          parsed.unknown.length
            ? `В библиотеке нет: ${parsed.unknown.join(', ')}. Есть книга, телефон, пазл, монета, наушники, лампа, ваза, кошелёк, папка и ручка.`
            : 'Напишите названия объектов через запятую, например: «книга, телефон, лампа фоном».',
        )
      }
      picks = parsed.picks
      if (parsed.unknown.length) note = `Нет в библиотеке и пропущено: ${parsed.unknown.join(', ')}`
      set({ live: namesOf(picks) })
      stage('read', 'done')
    } else {
      stage('send', 'active')
      let thoughts = ''
      let gotResult = false
      const timer = setTimeout(() => controller?.abort('timeout'), MODEL_TIMEOUT)
      try {
        await composeStream(
          { prompt: text, mode },
          (e: ComposeEvent) => {
            if (e.type === 'stage') {
              if (e.stage === 'queued') set({ live: e.text ?? 'Жду очереди у бесплатной модели' })
              if (e.stage === 'sent') set({ live: e.text ?? 'Модель NVIDIA Nemotron приняла запрос' })
              if (e.stage === 'thinking') {
                stage('send', 'done')
                stage('think', 'active')
              }
              if (e.stage === 'answer') {
                stage('send', 'done')
                stage('think', 'done')
                stage('pick', 'active')
                set({ live: 'Собираю ответ модели' })
              }
            } else if (e.type === 'thinking') {
              if (state.stages.find((s) => s.id === 'think')?.state !== 'active') {
                stage('send', 'done')
                stage('think', 'active')
              }
              thoughts += e.text
              set({ live: tail(thoughts) })
            } else if (e.type === 'result') {
              gotResult = true
              picks = e.picks.filter((p) => objectById(p.id))
              title = e.title
              reason = e.reason
            } else if (e.type === 'error') {
              throw new Error(e.detail)
            }
          },
          signal,
        )
        if (!gotResult || !picks.length) throw new Error('Модель не вернула объекты')
      } catch (err) {
        if (signal.aborted && signal.reason !== 'timeout') return null
        // the free model failed or took too long: the dictionary of meanings picks the objects instead
        const why = signal.aborted ? 'не ответила за 95 секунд' : (err as Error).message
        source = 'dictionary'
        note = `ИИ недоступен (${why}) — объекты подобраны по словарю смыслов`
        controller = new AbortController()
        stage('send', 'done')
        stage('think', 'active', 'ИИ не ответил — подбираю по словарю смыслов')
        await sleep(700)
        picks = matchMeaning(text)
        stage('think', 'done')
      } finally {
        clearTimeout(timer)
      }
      stage('pick', 'active')
      set({ live: namesOf(picks) })
      await sleep(source === 'ai' ? 900 : 600)
      stage('pick', 'done')
    }

    if (controller.signal.aborted) return null
    const size: Size = opts.size === 'auto' ? suggestSize(picks, scene.format) : opts.size

    stage('layout', 'active')
    set({ live: `${picks.length} ${picks.length === 1 ? 'объект' : picks.length < 5 ? 'объекта' : 'объектов'} — ищу равновесие в кадре ${scene.format.w}×${scene.format.h}` })
    const layout = await atLeast(900, runLayout(picks, { format: scene.format, size, seed: randomSeed() }))
    stage('layout', 'done')
    if (controller.signal.aborted) return null

    stage('paint', 'active')
    set({ live: `Палитра «${scene.palette.name}»` })
    await atLeast(500, loadBodies(size))
    stage('paint', 'done')

    stage('render', 'active')
    set({ live: 'Векторные слои, без растра' })
    const next: Scene = { ...scene, size, items: layout.items }
    await sleep(450)
    stage('render', 'done')
    await sleep(250)
    set({ open: false })
    return {
      scene: next,
      outcome: { picks, size, source, title, reason, note, seconds: Math.round((Date.now() - started) / 100) / 10 },
    }
  } catch (err) {
    set({ open: false })
    throw err
  }
}

/** Another arrangement of the same objects (a new seed), or the same objects in a new format / size. */
export async function relayout(scene: Scene, size: Size = scene.size): Promise<Item[]> {
  const picks = scene.items.map((it) => ({ id: it.id, state: it.state }))
  const { items } = await runLayout(picks, { format: scene.format, size, seed: randomSeed() })
  // keep each object's colour variant
  const tints = new Map<string, number[]>()
  for (const it of scene.items) tints.set(`${it.id}:${it.state}`, [...(tints.get(`${it.id}:${it.state}`) ?? []), it.tint])
  return items.map((it) => ({ ...it, tint: tints.get(`${it.id}:${it.state}`)?.shift() ?? 0 }))
}
