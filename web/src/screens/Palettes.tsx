import { Check, ChevronRight, FileUp, ImageUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Credits } from '../components/Credits'
import { Page } from '../components/Page'
import { ActionSheet, Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { PaletteDots, useBodies } from '../editor/parts'
import { type Colors, type Palette, ROLES, SCHEMES, type TileStyle } from '../engine/library'
import { sceneSvg } from '../engine/scene'
import { openIntro, useFirstVisit } from '../lib/intros'
import { useEditor } from '../state/editor'
import { checkPalette, LIST_ORDER, newPaletteId, paletteFromImage, parsePalette, ROLE_LABEL, usePalettes } from '../state/palettes'

/**
 * Colour schemes. Picking one recolours the composition at once; a new one can be pasted (hex list, JSON), loaded
 * from a file or taken from a picture — like the recolouring plugin the studio uses in Figma.
 */
export function Palettes() {
  const { scene, patch } = useEditor()
  const { all, custom, put, remove } = usePalettes()
  const [editing, setEditing] = useState<Palette | null>(null)
  const [deleting, setDeleting] = useState<Palette | null>(null)
  const toast = useToast()
  useFirstVisit('palettes')

  const apply = (p: Palette) => {
    patch({ palette: p })
    toast(`Композиция в схеме «${p.name}»`)
  }

  return (
    <Page
      title="Палитры"
      onHelp={() => openIntro('palettes')}
    >
      <div className="section">
        <div className="section-header">Схемы</div>
        <div className="group">
          {all.map((p) => (
            <div key={p.id} className="cell palette-cell" style={{ ['--inset' as string]: '16px' }}>
              <button className="palette-cell-main" onClick={() => apply(p)}>
                <PaletteDots palette={p} big />
                <span className="cell-main">
                  {p.name}
                  <small>{p.custom ? 'своя' : 'из библиотеки'}</small>
                </span>
                {scene.palette.id === p.id && <Check size={20} color="var(--accent)" />}
              </button>
              {p.custom && (
                <>
                  <button className="layer-act" onClick={() => setEditing(p)} aria-label="Изменить">
                    <ChevronRight size={18} />
                  </button>
                  <button className="layer-act danger" onClick={() => setDeleting(p)} aria-label="Удалить">
                    <Trash2 size={17} />
                  </button>
                </>
              )}
            </div>
          ))}
          <button className="cell accent" onClick={() => setEditing(blank())}>
            <Plus size={20} />
            Загрузить свою палитру
          </button>
        </div>
        <div className="section-footer">
          Палитра — это восемь ролей: три цвета фона (светлый, средний, тёмный), три цвета объектов, контур и белый. Цвета фона
          можно встретить и в объектах, а цвета объектов на фон не попадают никогда — так перекраска не ломает схему.
        </div>
      </div>

      <div className="section">
        <div className="section-header">Сейчас на холсте</div>
        <Preview colors={scene.palette.colors} tile={scene.palette.tile} />
      </div>

      <PaletteEditor
        palette={editing}
        onClose={() => setEditing(null)}
        onSave={(p) => {
          put(p)
          patch({ palette: p })
          setEditing(null)
          toast(`Палитра «${p.name}» сохранена и применена`)
        }}
      />
      <ActionSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        message={`Палитра «${deleting?.name}» будет удалена из этого браузера.`}
        actions={[
          {
            label: 'Удалить палитру',
            destructive: true,
            onClick: () => {
              if (!deleting) return
              remove(deleting.id)
              if (scene.palette.id === deleting.id) patch({ palette: SCHEMES[0] })
            },
          },
        ]}
      />
      {custom.length === 0 && <div className="section-footer">Своих палитр пока нет.</div>}
      <Credits />
    </Page>
  )
}

const blank = (): Palette => ({ id: newPaletteId(), name: 'Моя палитра', tile: 'dots', colors: { ...SCHEMES[0].colors }, custom: true })

/** The current composition in given colours — what the palette will do, before it's saved. */
function Preview({ colors, tile }: { colors: Colors; tile: TileStyle }) {
  const { scene } = useEditor()
  const bodies = useBodies(scene.size)
  const html = useMemo(
    () => (bodies ? sceneSvg({ ...scene, palette: { ...scene.palette, colors, tile } }, bodies).replace(/<svg /, '<svg class="preview-svg" ') : ''),
    [bodies, scene, colors, tile],
  )
  if (!scene.items.length) return <div className="group"><div className="cell muted">Соберите композицию в конструкторе — здесь будет видно, как она выглядит в палитре.</div></div>
  return <div className="preview showcase" dangerouslySetInnerHTML={{ __html: html }} />
}

function PaletteEditor({ palette, onClose, onSave }: { palette: Palette | null; onClose: () => void; onSave: (p: Palette) => void }) {
  const [draft, setDraft] = useState<Palette | null>(palette)
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const image = useRef<HTMLInputElement>(null)
  // a new palette opened: start from it (the sheet keeps the last one while it slides away)
  useEffect(() => {
    if (!palette) return
    setDraft(palette)
    setPaste('')
    setError(null)
  }, [palette])
  const current = draft
  const warnings = current ? checkPalette(current.colors) : []

  const setColor = (role: (typeof ROLES)[number], value: string) => current && setDraft({ ...current, colors: { ...current.colors, [role]: value.toUpperCase() } })
  const fromText = (text: string) => {
    if (!current) return
    const parsed = parsePalette(text, current.colors)
    if (!parsed) return setError('Не нашёл цветов: нужно хотя бы шесть hex-кодов или JSON с ролями bg1…obj3.')
    setError(null)
    setDraft({ ...current, colors: parsed.colors, name: parsed.name ?? current.name })
  }

  return (
    <Sheet
      open={!!palette}
      onClose={onClose}
      title="Палитра"
      left={
        <button className="nav-button" onClick={onClose}>
          Отмена
        </button>
      }
      right={
        <button className="nav-button" style={{ fontWeight: 600 }} onClick={() => current && onSave({ ...current, custom: true })}>
          Сохранить
        </button>
      }
    >
      {current && (
        <>
          <div className="section">
            <div className="group">
              <input className="field" value={current.name} onChange={(e) => setDraft({ ...current, name: e.target.value })} placeholder="Название" />
            </div>
          </div>
          <div className="section">
            <div className="section-header">Загрузить</div>
            <div className="group">
              <textarea
                className="field mono"
                rows={3}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'#FDD7B9 #FAC896 #D27532 #F9ECB0 #80DADA #BEEBEB\nили JSON: {"bg1": "#…", "obj1": "#…"}'}
              />
              <button className="cell accent" disabled={!paste.trim()} onClick={() => fromText(paste)}>
                Разобрать цвета
              </button>
              <button className="cell accent" onClick={() => file.current?.click()}>
                <FileUp size={18} /> Файл JSON или TXT
              </button>
              <button className="cell accent" onClick={() => image.current?.click()}>
                <ImageUp size={18} /> Взять цвета с картинки
              </button>
            </div>
            <input
              ref={file}
              type="file"
              accept=".json,.txt,.css,application/json,text/plain"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) fromText(await f.text())
              }}
            />
            <input
              ref={image}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  setDraft({ ...current, colors: await paletteFromImage(f, current.colors) })
                  setError(null)
                } catch (err) {
                  setError((err as Error).message)
                }
              }}
            />
            <div className={`section-footer${error ? ' error' : ''}`}>
              {error ?? `Список hex-кодов читается в порядке: ${LIST_ORDER.slice(0, 6).map((r) => ROLE_LABEL[r].toLowerCase()).join(', ')}; контур и белый — по желанию.`}
            </div>
          </div>
          <div className="section">
            <div className="section-header">Роли</div>
            <div className="group">
              {ROLES.map((r) => (
                <label key={r} className="cell color-cell">
                  <input type="color" value={current.colors[r]} onChange={(e) => setColor(r, e.target.value)} />
                  <span className="cell-main">{ROLE_LABEL[r]}</span>
                  <input
                    className="cell-input mono"
                    value={current.colors[r]}
                    maxLength={7}
                    onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && setColor(r, e.target.value)}
                  />
                </label>
              ))}
              <div className="cell">
                <span className="cell-main">Декор фона</span>
                <select className="cell-select" value={current.tile} onChange={(e) => setDraft({ ...current, tile: e.target.value as TileStyle })}>
                  <option value="dots">Конфетти и линии</option>
                  <option value="corner">Уголок и диагонали</option>
                </select>
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="section-footer warn">
                {warnings.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
            )}
          </div>
          <div className="section">
            <div className="section-header">Как будет выглядеть</div>
            <Preview colors={current.colors} tile={current.tile} />
          </div>
        </>
      )}
    </Sheet>
  )
}
