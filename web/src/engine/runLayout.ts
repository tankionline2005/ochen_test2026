import { autoLayout, type LayoutOptions, type LayoutResult, type Pick } from './layout'

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, { resolve: (r: LayoutResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (worker) return worker
  try {
    worker = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; result?: LayoutResult; error?: string }>) => {
      const w = waiting.get(e.data.id)
      if (!w) return
      waiting.delete(e.data.id)
      if (e.data.result) w.resolve(e.data.result)
      else w.reject(new Error(e.data.error ?? 'layout failed'))
    }
    return worker
  } catch {
    return null
  }
}

/** Runs the layout in a worker (or right here where workers are unavailable). */
export function runLayout(picks: Pick[], opts: LayoutOptions): Promise<LayoutResult> {
  const w = getWorker()
  if (!w) return Promise.resolve(autoLayout(picks, opts))
  const id = ++seq
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject })
    w.postMessage({ id, picks, opts })
  })
}

export const randomSeed = () => Math.floor(Math.random() * 1e9)
