import { AnimatePresence } from 'framer-motion'
import { Download, Layers, Redo2, Shuffle, SlidersHorizontal, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ErrorAlert, type ErrorInfo } from '../components/ErrorAlert'
import { Page } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useWide } from '../hooks/useMedia'
import { useStoredJson } from '../hooks/useStored'
import { compose, ComposeError, relayout } from '../compose/compose'
import { Canvas } from '../editor/Canvas'
import { downloadSvg } from '../editor/exportSvg'
import {
  type AiNote,
  AiNoteCard,
  LayersList,
  ObjectControls,
  PalettePicker,
  PromptPanel,
  QuickLibrary,
  SceneSettings,
  useBodies,
} from '../editor/parts'
import { objectById, type Size } from '../engine/library'
import { FORMATS } from '../engine/scene'
import { openIntro, useFirstVisit } from '../lib/intros'
import { useEditor } from '../state/editor'
import { Credits } from '../components/Credits'

/**
 * The constructor. Desktop: three columns over the whole width — the words and the library on the left, the canvas
 * in the middle, the frame / palette / object / layers on the right. Phone: an iOS page — the canvas, the object's
 * buttons under it, the words, and the rest in sheets.
 */
export function Editor({ onOpenPalettes }: { onOpenPalettes: () => void }) {
  const ed = useEditor()
  const { scene, selected } = ed
  const wide = useWide()
  const toast = useToast()
  const bodies = useBodies(scene.size)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ErrorInfo | null>(null)
  const [note, setNote] = useStoredJson<AiNote | null>('aiNote', null)
  const [layersOpen, setLayersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  useFirstVisit('editor')

  const run = async (mode: 'meaning' | 'names', text: string) => {
    setBusy(true)
    try {
      const res = await compose({ mode, text, scene, size: scene.size })
      if (!res) return
      ed.setScene(res.scene)
      const o = res.outcome
      setNote({
        text,
        picks: o.picks.map((p) => objectById(p.id).name + (p.state === 'bg' ? ' (фон)' : '')).join(', '),
        reason: o.reason,
        source: o.source,
        note: o.note,
        seconds: o.seconds,
      })
    } catch (e) {
      if (e instanceof ComposeError) setFailure({ text: e.message })
      else setFailure({ text: 'Не получилось собрать композицию. Попробуйте ещё раз.', detail: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const another = async () => {
    if (!scene.items.length) return
    const items = await relayout(scene)
    ed.setScene({ ...scene, items })
  }

  const changeFormat = async (id: string) => {
    const format = FORMATS.find((f) => f.id === id)!
    const next = { ...scene, format }
    if (!scene.items.length) return ed.patch({ format })
    ed.setScene({ ...next, items: await relayout(next) })
  }

  const changeSize = async (size: Size) => {
    if (size === scene.size) return
    if (!scene.items.length) return ed.patch({ size })
    ed.setScene({ ...scene, size, items: await relayout({ ...scene, size }, size) })
  }

  const exportSvg = async () => {
    if (!scene.items.length) return toast('Кадр пуст — сначала соберите композицию')
    const r = await downloadSvg(scene)
    toast(`SVG скачан: ${r.objects} ${r.objects === 1 ? 'объект' : r.objects < 5 ? 'объекта' : 'объектов'}, ${Math.round(r.bytes / 1024)} КБ`)
  }

  useEditorHotkeys()

  // first visit: a ready composition instead of an empty frame, so it's clear at once what the service makes
  const seeded = useRef(false)
  useEffect(() => {
    if (!ed.fresh || seeded.current) return
    seeded.current = true
    const first = { ...scene, items: [] as typeof scene.items }
    relayout({ ...first, items: STARTER.map((p, i) => ({ uid: `s${i}`, ...p, x: 0, y: 0, rot: 0, tint: 0 })) }).then((items) =>
      ed.setScene({ ...first, items }),
    )
  }, [ed, scene])

  const toolbar = (
    <div className="stage-toolbar">
      <button className="tool" onClick={ed.undo} disabled={!ed.canUndo} title="Отменить (Ctrl+Z)">
        <Undo2 size={19} />
      </button>
      <button className="tool" onClick={ed.redo} disabled={!ed.canRedo} title="Повторить (Ctrl+Shift+Z)">
        <Redo2 size={19} />
      </button>
      <div className="tool-gap" />
      <button className="tool text" onClick={another} disabled={!scene.items.length || busy} title="Те же объекты, другая раскладка">
        <Shuffle size={18} />
        Другой вариант
      </button>
      <button className="tool text primary" onClick={exportSvg} disabled={!scene.items.length}>
        <Download size={18} />
        Скачать SVG
      </button>
    </div>
  )

  const noteCard = <AnimatePresence>{note && <AiNoteCard note={note} onClose={() => setNote(null)} />}</AnimatePresence>

  if (wide) {
    return (
      <div className="editor-wide">
        <aside className="editor-col left">
          <h1 className="col-title">
            Конструктор
            <button className="title-help" onClick={() => openIntro('editor')} aria-label="Как это работает">
              ?
            </button>
          </h1>
          <PromptPanel onCompose={run} busy={busy} />
          {noteCard}
          <QuickLibrary bodies={bodies} />
        </aside>
        <section className="editor-stage">
          {toolbar}
          <Canvas bodies={bodies} />
          <div className="stage-hint">
            Перетаскивайте объекты, крутите за кружок. Delete — удалить, Ctrl+D — копия, [ ] — слой, стрелки — сдвиг, Ctrl+Z —
            отмена.
          </div>
        </section>
        <aside className="editor-col right">
          <SceneSettings onFormat={changeFormat} onSize={changeSize} />
          <PalettePicker onEdit={onOpenPalettes} />
          <ObjectControls />
          <LayersList bodies={bodies} />
        </aside>
        <ErrorAlert error={failure} title="Композиция не собралась" onClose={() => setFailure(null)} />
      </div>
    )
  }

  return (
    <Page
      title="Конструктор"
      onHelp={() => openIntro('editor')}
      right={
        <button className="nav-button" onClick={exportSvg} aria-label="Скачать SVG" disabled={!scene.items.length}>
          <Download size={22} />
        </button>
      }
    >
      <div className="phone-stage">
        <Canvas bodies={bodies} />
        <div className="phone-stage-bar">
          <button className="tool" onClick={ed.undo} disabled={!ed.canUndo} aria-label="Отменить">
            <Undo2 size={19} />
          </button>
          <button className="tool" onClick={ed.redo} disabled={!ed.canRedo} aria-label="Повторить">
            <Redo2 size={19} />
          </button>
          <button className="tool text" onClick={another} disabled={!scene.items.length || busy}>
            <Shuffle size={17} />
            Вариант
          </button>
          <button className="tool" onClick={() => setLayersOpen(true)} aria-label="Слои">
            <Layers size={19} />
          </button>
          <button className="tool" onClick={() => setSettingsOpen(true)} aria-label="Кадр и цвета">
            <SlidersHorizontal size={19} />
          </button>
        </div>
        <AnimatePresence>{selected && <ObjectControls compact />}</AnimatePresence>
      </div>
      <PromptPanel onCompose={run} busy={busy} />
      <div style={{ margin: '0 16px 24px' }}>{noteCard}</div>
      <PalettePicker onEdit={onOpenPalettes} />
      <QuickLibrary bodies={bodies} onAdd={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
      <Credits />

      <Sheet open={layersOpen} onClose={() => setLayersOpen(false)} title="Слои" right={<button className="nav-button" onClick={() => setLayersOpen(false)}>Готово</button>}>
        <LayersList bodies={bodies} />
      </Sheet>
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Кадр" right={<button className="nav-button" onClick={() => setSettingsOpen(false)}>Готово</button>}>
        <SceneSettings onFormat={changeFormat} onSize={changeSize} />
        <PalettePicker />
      </Sheet>
      <ErrorAlert error={failure} title="Композиция не собралась" onClose={() => setFailure(null)} />
    </Page>
  )
}

const STARTER = [
  { id: 'book', state: 'main' as const },
  { id: 'phone', state: 'main' as const },
  { id: 'vase', state: 'bg' as const },
]

/** Desktop keys for the selected object; quiet while typing or while a window is open. */
function useEditorHotkeys() {
  const ed = useEditor()
  const ref = useRef(ed)
  ref.current = ed
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.isContentEditable || target.closest('input, textarea, select, [role="dialog"], [role="alertdialog"]')) return
      const { selected, update, remove, duplicate, order, undo, redo, select } = ref.current
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (!selected) return
      const step = e.shiftKey ? 20 : 4
      const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (moves[e.key]) {
        e.preventDefault()
        const [dx, dy] = moves[e.key]
        update(selected.uid, { x: selected.x + dx, y: selected.y + dy })
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        remove(selected.uid)
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicate(selected.uid)
      } else if (e.key === ']') order(selected.uid, e.shiftKey ? 'top' : 'up')
      else if (e.key === '[') order(selected.uid, e.shiftKey ? 'bottom' : 'down')
      else if (e.key.toLowerCase() === 'r' && !mod) update(selected.uid, { rot: Math.round(((selected.rot + (e.shiftKey ? -15 : 15) + 540) % 360) - 180) })
      else if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
