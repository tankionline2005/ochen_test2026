import { createContext, type ReactNode, useContext, useEffect, useMemo, useReducer } from 'react'
import { objectById, type Palette, SCHEMES, type Size, type State } from '../engine/library'
import { FORMATS, type Format, type Item, newUid, type Scene } from '../engine/scene'

/**
 * The composition being edited, with undo/redo, kept in localStorage so a reload doesn't lose it.
 * Dragging an object changes it many times a second: `begin` snapshots once, the moves that follow are `silent`.
 */

interface EditorState {
  scene: Scene
  selected: string | null
  past: Scene[]
  future: Scene[]
}

type Action =
  | { type: 'set'; scene: Scene; keepSelection?: boolean }
  | { type: 'patch'; patch: Partial<Omit<Scene, 'items'>> }
  | { type: 'begin' }
  | { type: 'update'; uid: string; patch: Partial<Item>; silent?: boolean }
  | { type: 'add'; items: Item[] }
  | { type: 'remove'; uid: string }
  | { type: 'duplicate'; uid: string }
  | { type: 'order'; uid: string; to: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'select'; uid: string | null }
  | { type: 'undo' }
  | { type: 'redo' }

const HISTORY = 80

function remember(s: EditorState): EditorState {
  return { ...s, past: [...s.past.slice(-HISTORY + 1), s.scene], future: [] }
}

function reducer(s: EditorState, a: Action): EditorState {
  switch (a.type) {
    case 'set':
      return { ...remember(s), scene: a.scene, selected: a.keepSelection ? s.selected : null }
    case 'patch':
      return { ...remember(s), scene: { ...s.scene, ...a.patch } }
    case 'begin':
      return remember(s)
    case 'update': {
      const base = a.silent ? s : remember(s)
      return { ...base, scene: { ...s.scene, items: s.scene.items.map((it) => (it.uid === a.uid ? { ...it, ...a.patch } : it)) } }
    }
    case 'add':
      return { ...remember(s), scene: { ...s.scene, items: [...s.scene.items, ...a.items] }, selected: a.items.at(-1)?.uid ?? s.selected }
    case 'remove':
      return {
        ...remember(s),
        scene: { ...s.scene, items: s.scene.items.filter((it) => it.uid !== a.uid) },
        selected: s.selected === a.uid ? null : s.selected,
      }
    case 'duplicate': {
      const i = s.scene.items.findIndex((it) => it.uid === a.uid)
      if (i < 0) return s
      const copy = { ...s.scene.items[i], uid: newUid(), x: s.scene.items[i].x + 40, y: s.scene.items[i].y + 24 }
      const items = [...s.scene.items]
      items.splice(i + 1, 0, copy)
      return { ...remember(s), scene: { ...s.scene, items }, selected: copy.uid }
    }
    case 'order': {
      const items = [...s.scene.items]
      const i = items.findIndex((it) => it.uid === a.uid)
      if (i < 0) return s
      const [it] = items.splice(i, 1)
      const to = a.to === 'top' ? items.length : a.to === 'bottom' ? 0 : a.to === 'up' ? Math.min(items.length, i + 1) : Math.max(0, i - 1)
      items.splice(to, 0, it)
      return { ...remember(s), scene: { ...s.scene, items } }
    }
    case 'select':
      return { ...s, selected: a.uid }
    case 'undo': {
      const prev = s.past.at(-1)
      if (!prev) return s
      return { ...s, scene: prev, past: s.past.slice(0, -1), future: [s.scene, ...s.future] }
    }
    case 'redo': {
      const next = s.future[0]
      if (!next) return s
      return { ...s, scene: next, past: [...s.past, s.scene], future: s.future.slice(1) }
    }
  }
}

const STORAGE = 'scene.v1'

export const emptyScene = (): Scene => ({
  format: FORMATS[0],
  size: 'large',
  scale: 1,
  palette: SCHEMES[0],
  items: [],
  decor: true,
})

function load(): Scene | null {
  try {
    const raw = localStorage.getItem(STORAGE)
    if (!raw) return null
    const s = JSON.parse(raw) as Scene
    return s.format && Array.isArray(s.items) && s.palette?.colors ? s : null
  } catch {
    return null
  }
}

interface EditorApi {
  scene: Scene
  selected: Item | null
  canUndo: boolean
  canRedo: boolean
  /** true when nothing was ever composed here (first visit) */
  fresh: boolean
  setScene: (scene: Scene, keepSelection?: boolean) => void
  patch: (patch: Partial<Omit<Scene, 'items'>>) => void
  begin: () => void
  update: (uid: string, patch: Partial<Item>, silent?: boolean) => void
  add: (items: Item[]) => void
  addObject: (id: string, state: State) => void
  remove: (uid: string) => void
  duplicate: (uid: string) => void
  order: (uid: string, to: 'up' | 'down' | 'top' | 'bottom') => void
  select: (uid: string | null) => void
  undo: () => void
  redo: () => void
}

const Ctx = createContext<EditorApi | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    const saved = load()
    return { scene: saved ?? emptyScene(), selected: null, past: [], future: [] }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state.scene))
    } catch {
      // private mode or a full quota: the scene just isn't remembered
    }
  }, [state.scene])

  const api = useMemo<EditorApi>(() => {
    const { scene } = state
    return {
      scene,
      selected: scene.items.find((it) => it.uid === state.selected) ?? null,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      fresh: state.past.length === 0 && scene.items.length === 0,
      setScene: (s, keepSelection) => dispatch({ type: 'set', scene: s, keepSelection }),
      patch: (patch) => dispatch({ type: 'patch', patch }),
      begin: () => dispatch({ type: 'begin' }),
      update: (uid, patch, silent) => dispatch({ type: 'update', uid, patch, silent }),
      add: (items) => dispatch({ type: 'add', items }),
      addObject: (id, st) => {
        const { w, h } = objectBox(id, scene.size, scene.scale)
        // a new object lands in the middle, a little lower each time so copies don't hide each other
        const shift = (scene.items.length % 5) * 24
        dispatch({
          type: 'add',
          items: [{ uid: newUid(), id, state: st, x: Math.round((scene.format.w - w) / 2 + shift), y: Math.round((scene.format.h - h) / 2 + shift), rot: 0, tint: 0 }],
        })
      },
      remove: (uid) => dispatch({ type: 'remove', uid }),
      duplicate: (uid) => dispatch({ type: 'duplicate', uid }),
      order: (uid, to) => dispatch({ type: 'order', uid, to }),
      select: (uid) => dispatch({ type: 'select', uid }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
    }
  }, [state])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useEditor(): EditorApi {
  const api = useContext(Ctx)
  if (!api) throw new Error('useEditor outside EditorProvider')
  return api
}

export function objectBox(id: string, size: Size, scale: number) {
  const { w, h } = objectById(id).sizes[size]
  return { w: w * scale, h: h * scale }
}

export type { Format, Palette }
