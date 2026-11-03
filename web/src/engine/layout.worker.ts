/// <reference lib="webworker" />
import { autoLayout, type LayoutOptions, type Pick } from './layout'

/** The layout search takes a few hundred milliseconds; here it runs off the main thread so the sphere keeps moving. */
self.onmessage = (e: MessageEvent<{ id: number; picks: Pick[]; opts: LayoutOptions }>) => {
  const { id, picks, opts } = e.data
  try {
    const result = autoLayout(picks, opts)
    self.postMessage({ id, result })
  } catch (err) {
    self.postMessage({ id, error: String(err) })
  }
}
