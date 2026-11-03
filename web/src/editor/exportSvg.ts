import { loadBodies } from '../engine/library'
import { type Scene, sceneSvg } from '../engine/scene'

/** The composition as an .svg file: vector, every object its own named group, real colours. */
export async function downloadSvg(scene: Scene) {
  const bodies = await loadBodies(scene.size)
  const svg = sceneSvg(scene, bodies)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  a.href = url
  a.download = `illustration-${scene.format.w}x${scene.format.h}-${scene.palette.id}-${stamp}.svg`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return { bytes: blob.size, objects: scene.items.length }
}
