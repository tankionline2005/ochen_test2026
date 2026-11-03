import { Plus } from 'lucide-react'
import { Credits } from '../components/Credits'
import { Page } from '../components/Page'
import { Segmented } from '../components/Segmented'
import { useToast } from '../components/Toast'
import { useStored } from '../hooks/useStored'
import { Thumb, useBodies } from '../editor/parts'
import { OBJECTS, type Size, type State } from '../engine/library'
import { openIntro, useFirstVisit } from '../lib/intros'
import { useEditor } from '../state/editor'

/** The 10 objects in both detail sizes and both roles, with the meanings the AI matches them by. */
export function Library({ onAdded }: { onAdded: () => void }) {
  const { scene, addObject } = useEditor()
  const [size, setSize] = useStored<Size>('librarySize', 'large', ['large', 'small'])
  const bodies = useBodies(size)
  const toast = useToast()
  useFirstVisit('library')

  const add = (id: string, state: State, name: string) => {
    if (size !== scene.size) toast(`Добавлено в ${scene.size === 'large' ? 'крупном' : 'мелком'} размере — как остальная композиция`)
    else toast(`${name} — на холсте`)
    addObject(id, state)
    onAdded()
  }

  return (
    <Page
      title="Библиотека"
      onHelp={() => openIntro('library')}
      accessory={
        <div className="accessory">
          <Segmented
            id="lib-size"
            value={size}
            onChange={setSize}
            options={[
              { value: 'large', label: 'Крупный набор' },
              { value: 'small', label: 'Мелкий набор' },
            ]}
          />
        </div>
      }
    >
      <div className="section-footer top">
        Объекты из 20 исходных иллюстраций — 10 предметов в двух размерах. У каждого есть главная (цветная) и фоновая
        (монохромная) версия. Объекты копируются как есть, без изменения формы и пропорций.
      </div>
      <div className="library-grid">
        {OBJECTS.map((o) => {
          const dims = o.sizes[size]
          return (
            <div key={o.id} className="library-card">
              <div className="library-pics showcase">
                <Thumb bodies={bodies} id={o.id} state="main" size={size} palette={scene.palette} />
                <Thumb bodies={bodies} id={o.id} state="bg" size={size} palette={scene.palette} />
              </div>
              <div className="library-info">
                <div className="library-name">
                  {o.name}
                  <span>
                    {Math.round(dims.w)}×{Math.round(dims.h)}
                  </span>
                </div>
                <div className="library-tags">{o.meanings.slice(0, 6).join(' · ')}</div>
                <div className="library-actions">
                  <button className="mini-button" onClick={() => add(o.id, 'main', o.name)}>
                    <Plus size={16} /> Главный
                  </button>
                  <button className="mini-button" onClick={() => add(o.id, 'bg', o.name)}>
                    <Plus size={16} /> Фоновый
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <Credits />
    </Page>
  )
}
