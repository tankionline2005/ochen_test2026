import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Layers,
  Palette as PaletteIcon,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Switch } from '../components/Controls'
import { Chips, Segmented } from '../components/Segmented'
import { useWheelScrollX } from '../hooks/useWheelScrollX'
import { useStored, useStoredJson } from '../hooks/useStored'
import { type Bodies, loadBodies, objectById, OBJECTS, type Palette, type Size, type State } from '../engine/library'
import { FORMATS, paint, type Scene, TINTS } from '../engine/scene'
import { useEditor } from '../state/editor'
import { usePalettes } from '../state/palettes'

/** Object markup of the current size, loaded once per size. */
export function useBodies(size: Size): Bodies | null {
  const [bodies, setBodies] = useState<{ size: Size; b: Bodies } | null>(null)
  useEffect(() => {
    let alive = true
    loadBodies(size).then((b) => alive && setBodies({ size, b }))
    return () => {
      alive = false
    }
  }, [size])
  return bodies?.size === size ? bodies.b : null
}

export type SizeMode = Size | 'auto'
export const useSizeMode = () => useStored<SizeMode>('sizeMode', 'auto', ['auto', 'large', 'small'])

export const PROMPT_EXAMPLES = {
  meaning: ['Финансовая грамотность для начинающих', 'Командная работа над проектом', 'Подкаст для тех, кто учится по вечерам', 'Как безопасно платить онлайн'],
  names: ['книга, телефон, лампа фоном', 'кошелёк и две монеты', 'наушники, пазл, ваза фоном', 'папка, ручка'],
}

/** Scenario 1 and 2: a metaphor/headline, or the objects' names. */
export function PromptPanel({ onCompose, busy }: { onCompose: (mode: 'meaning' | 'names', text: string) => void; busy: boolean }) {
  const [mode, setMode] = useStored<'meaning' | 'names'>('promptMode', 'meaning', ['meaning', 'names'])
  const [text, setText] = useStoredJson('promptText', '')
  const chips = useWheelScrollX()
  const go = () => text.trim() && onCompose(mode, text.trim())
  return (
    <div className="section prompt">
      <Segmented
        id="prompt-mode"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'meaning', label: 'По смыслу' },
          { value: 'names', label: 'По названиям' },
        ]}
      />
      <div className="group" style={{ marginTop: 10 }}>
        <textarea
          className="field prompt-field"
          rows={3}
          value={text}
          placeholder={mode === 'meaning' ? 'Метафора или заголовок статьи, например: «Финансовая грамотность для начинающих»' : 'Объекты через запятую: «книга, телефон, лампа фоном»'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go()
          }}
        />
      </div>
      <div className="prompt-examples" ref={chips}>
        {PROMPT_EXAMPLES[mode].map((ex) => (
          <button key={ex} className="example-chip" onClick={() => setText(ex)}>
            {ex}
          </button>
        ))}
      </div>
      <button className="button" disabled={!text.trim() || busy} onClick={go}>
        {mode === 'meaning' ? <Sparkles size={19} /> : <Wand2 size={19} />}
        Собрать композицию
      </button>
      <div className="section-footer">
        {mode === 'meaning' ? (
          <>
            Объекты подбирает ИИ — бесплатная модель NVIDIA Nemotron 3.5 Super через OpenRouter. Ответ занимает от пары секунд
            до минуты: это ограничение бесплатного тарифа. Если модель не ответит, объекты подберёт словарь смыслов.
          </>
        ) : (
          <>Можно писать в любом падеже и добавлять «фоном», чтобы объект стал фоновым, и числа: «две монеты».</>
        )}
      </div>
    </div>
  )
}

/** Why the AI picked these objects — shown after a run. */
export interface AiNote {
  text: string
  picks: string
  reason?: string
  source: 'ai' | 'dictionary' | 'names'
  note?: string
  seconds: number
}

export function AiNoteCard({ note, onClose }: { note: AiNote; onClose: () => void }) {
  return (
    <motion.div className="ai-note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
      <div className="ai-note-head">
        <span className={`ai-badge ${note.source}`}>
          {note.source === 'ai' ? 'ИИ' : note.source === 'names' ? 'Названия' : 'Словарь'}
        </span>
        <span className="ai-note-time">{note.seconds} с</span>
        <button className="ai-note-close" onClick={onClose} aria-label="Скрыть">
          ×
        </button>
      </div>
      <div className="ai-note-picks">{note.picks}</div>
      {note.reason && <div className="ai-note-reason">{note.reason}</div>}
      {note.note && <div className="ai-note-warn">{note.note}</div>}
    </motion.div>
  )
}

/** Format, detail size, background decor. */
export function SceneSettings({ onFormat, onSize }: { onFormat: (id: Scene['format']['id']) => void; onSize: (s: SizeMode) => void }) {
  const { scene, patch } = useEditor()
  const [sizeMode] = useSizeMode()
  return (
    <div className="section">
      <div className="section-header">Кадр</div>
      <div className="group">
        <div className="cell stack">
          <div className="cell-title-sm">Формат</div>
          <Segmented
            id="format"
            value={scene.format.id}
            onChange={onFormat}
            options={FORMATS.map((f) => ({ value: f.id, label: <span className="seg-two">{f.name}<small>{f.w}×{f.h}</small></span> }))}
          />
        </div>
        <div className="cell stack">
          <div className="cell-title-sm">Размер объектов</div>
          <Segmented
            id="size"
            value={sizeMode}
            onChange={onSize}
            options={[
              { value: 'auto', label: 'Авто' },
              { value: 'large', label: 'Крупный' },
              { value: 'small', label: 'Мелкий' },
            ]}
          />
        </div>
        <div className="cell">
          <div className="cell-main">Декор фона</div>
          <Switch label="Декор фона" on={scene.decor} onChange={(on) => patch({ decor: on })} />
        </div>
      </div>
      <div className="section-footer">
        Крупный набор — детальные объекты крупным планом, мелкий — упрощённые, чтобы в кадр вошло больше. Сейчас:{' '}
        {scene.size === 'large' ? 'крупный' : 'мелкий'}. Смена формата или размера пересобирает раскладку.
      </div>
    </div>
  )
}

/** The palette swatches: pick a scheme, the whole composition is recoloured at once. */
export function PalettePicker({ onEdit }: { onEdit?: () => void }) {
  const { scene, patch } = useEditor()
  const { all } = usePalettes()
  return (
    <div className="section">
      <div className="section-header">Цветовая схема</div>
      <div className="palette-row">
        {all.map((p) => (
          <button
            key={p.id}
            className={`palette-chip${p.id === scene.palette.id ? ' active' : ''}`}
            onClick={() => patch({ palette: p })}
            title={p.name}
          >
            <PaletteDots palette={p} />
            <span>{p.name}</span>
          </button>
        ))}
        {onEdit && (
          <button className="palette-chip add" onClick={onEdit}>
            <PaletteIcon size={18} />
            <span>Своя…</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function PaletteDots({ palette, big }: { palette: Palette; big?: boolean }) {
  const c = palette.colors
  return (
    <span className={`palette-dots${big ? ' big' : ''}`}>
      {[c.bg1, c.bg2, c.bg3, c.obj1, c.obj2, c.obj3].map((col, i) => (
        <i key={i} style={{ background: col }} />
      ))}
    </span>
  )
}

/** What can be done with the selected object. */
export function ObjectControls({ compact }: { compact?: boolean }) {
  const { scene, selected, update, duplicate, remove, order } = useEditor()
  if (!selected) {
    if (compact) return null
    return (
      <div className="section">
        <div className="section-header">Объект</div>
        <div className="group">
          <div className="cell muted">Нажмите на объект на холсте, чтобы двигать, поворачивать и менять его.</div>
        </div>
      </div>
    )
  }
  const obj = objectById(selected.id)
  const idx = scene.items.findIndex((it) => it.uid === selected.uid)
  const setState = (st: State) => update(selected.uid, { state: st })
  const nextTint = () => update(selected.uid, { tint: (selected.tint + 1) % TINTS.length })
  const turn = (d: number) => update(selected.uid, { rot: Math.round(((((selected.rot + d + 180) % 360) + 360) % 360) - 180) })

  if (compact) {
    return (
      <div className="object-bar">
        <div className="object-bar-name">
          {obj.name}
          <span>{selected.state === 'main' ? 'главный' : 'фоновый'}</span>
        </div>
        <div className="object-bar-buttons">
          <button onClick={() => setState(selected.state === 'main' ? 'bg' : 'main')}>
            <Layers size={20} />
            {selected.state === 'main' ? 'В фон' : 'Главный'}
          </button>
          <button onClick={nextTint} disabled={selected.state === 'bg'}>
            <PaletteIcon size={20} />
            Цвета
          </button>
          <button onClick={() => turn(-15)}>
            <RotateCcw size={20} />
            −15°
          </button>
          <button onClick={() => turn(15)}>
            <RotateCw size={20} />
            +15°
          </button>
          <button onClick={() => order(selected.uid, 'up')} disabled={idx === scene.items.length - 1}>
            <ArrowUp size={20} />
            Выше
          </button>
          <button onClick={() => order(selected.uid, 'down')} disabled={idx === 0}>
            <ArrowDown size={20} />
            Ниже
          </button>
          <button onClick={() => duplicate(selected.uid)}>
            <Copy size={20} />
            Копия
          </button>
          <button className="danger" onClick={() => remove(selected.uid)}>
            <Trash2 size={20} />
            Удалить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="section-header">Объект — {obj.name}</div>
      <div className="group">
        <div className="cell stack">
          <Segmented
            id="obj-state"
            value={selected.state}
            onChange={setState}
            options={[
              { value: 'main', label: 'Главный' },
              { value: 'bg', label: 'Фоновый' },
            ]}
          />
        </div>
        <button className="cell" onClick={nextTint} disabled={selected.state === 'bg'}>
          <div className="cell-main">Цвета объекта</div>
          <TintPreview tint={selected.tint} palette={scene.palette} />
        </button>
        <div className="cell stack">
          <div className="cell-row">
            <span className="cell-title-sm">Поворот</span>
            <span className="cell-value">{Math.round(selected.rot)}°</span>
          </div>
          <input
            className="range"
            type="range"
            min={-180}
            max={180}
            step={1}
            value={selected.rot}
            onChange={(e) => update(selected.uid, { rot: Number(e.target.value) })}
          />
        </div>
        <div className="cell buttons-row">
          <button className="mini-button" onClick={() => order(selected.uid, 'up')} disabled={idx === scene.items.length - 1} title="Выше (])">
            <ArrowUp size={17} /> Выше
          </button>
          <button className="mini-button" onClick={() => order(selected.uid, 'down')} disabled={idx === 0} title="Ниже ([)">
            <ArrowDown size={17} /> Ниже
          </button>
          <button className="mini-button" onClick={() => duplicate(selected.uid)} title="Копия (Ctrl+D)">
            <Copy size={17} /> Копия
          </button>
          <button className="mini-button danger" onClick={() => remove(selected.uid)} title="Удалить (Delete)">
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      <div className="section-footer">
        Объект копируется из библиотеки как есть: меняются только место, поворот, слой, роль и цвета внутри палитры. Пропорции
        и форма не меняются.
      </div>
    </div>
  )
}

function TintPreview({ tint, palette }: { tint: number; palette: Palette }) {
  const roles = TINTS[tint]
  return (
    <span className="palette-dots">
      {roles.map((r, i) => (
        <i key={i} style={{ background: palette.colors[r] }} />
      ))}
    </span>
  )
}

/** Layers, nearest on top, like in Figma. */
export function LayersList({ bodies }: { bodies: Bodies | null }) {
  const { scene, selected, select, order, remove } = useEditor()
  const items = [...scene.items].reverse()
  return (
    <div className="section">
      <div className="section-header">Слои — {scene.items.length}</div>
      <div className="group layers">
        {!items.length && <div className="cell muted">Пока пусто.</div>}
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.div
              key={it.uid}
              layout="position"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`layer-row${selected?.uid === it.uid ? ' active' : ''}`}
            >
              <button className="layer-main" onClick={() => select(it.uid)}>
                <Thumb bodies={bodies} id={it.id} state={it.state} size={scene.size} palette={scene.palette} tint={it.tint} />
                <span className="layer-name">
                  {objectById(it.id).name}
                  <small>{it.state === 'main' ? 'главный' : 'фоновый'}</small>
                </span>
              </button>
              <button className="layer-act" onClick={() => order(it.uid, 'up')} disabled={i === 0} aria-label="Выше">
                <ArrowUp size={16} />
              </button>
              <button className="layer-act" onClick={() => order(it.uid, 'down')} disabled={i === items.length - 1} aria-label="Ниже">
                <ArrowDown size={16} />
              </button>
              <button className="layer-act danger" onClick={() => remove(it.uid)} aria-label="Удалить">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** A small picture of an object in the current palette. */
export function Thumb({
  bodies,
  id,
  state,
  size,
  palette,
  tint = 0,
}: {
  bodies: Bodies | null
  id: string
  state: State
  size: Size
  palette: Palette
  tint?: number
}) {
  const { w, h } = objectById(id).sizes[size]
  const html = useMemo(() => (bodies ? paint(bodies[`${id}:${state}`] ?? '', palette.colors, tint) : ''), [bodies, id, state, palette, tint])
  return (
    <svg className="thumb" viewBox={`-8 -8 ${w + 16} ${h + 16}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <g dangerouslySetInnerHTML={{ __html: html }} />
    </svg>
  )
}

/** The objects to add by hand. */
export function QuickLibrary({ bodies, onAdd }: { bodies: Bodies | null; onAdd?: () => void }) {
  const { scene, addObject } = useEditor()
  const [state, setState] = useStored<State>('quickState', 'main', ['main', 'bg'])
  return (
    <div className="section">
      <div className="section-header-row">
        <div className="section-header">Добавить объект</div>
        <Chips
          id="quick-state"
          value={state}
          onChange={setState}
          options={[
            { value: 'main', label: 'Главный' },
            { value: 'bg', label: 'Фоновый' },
          ]}
        />
      </div>
      <div className="quick-grid">
        {OBJECTS.map((o) => (
          <button
            key={o.id}
            className="quick-cell"
            onClick={() => {
              addObject(o.id, state)
              onAdd?.()
            }}
            title={`${o.name} — ${o.meanings.slice(0, 3).join(', ')}`}
          >
            <Thumb bodies={bodies} id={o.id} state={state} size={scene.size} palette={scene.palette} />
            <span>{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

