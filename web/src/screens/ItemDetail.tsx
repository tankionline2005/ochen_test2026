import { ChevronLeft, Clock, Eye, Star } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Page } from '../components/Page'
import { demo, type Item } from '../lib/demo'
import { compact, relative } from '../lib/format'
import { LOCALE } from '../lib/strings'

/** A pushed detail screen: back button, hero with big avatar and stat tiles, grouped info below. */
export function ItemDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setItem(await demo.item(id))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  const title = item?.title ?? ''

  return (
    <Page
      title={title}
      onRefresh={reload}
      left={
        <button className="nav-button" onClick={onBack}>
          <ChevronLeft size={26} style={{ marginLeft: -6 }} />
          Items
        </button>
      }
      hero={
        <div className="hero">
          {item ? <Avatar title={item.title} seed={item.id} size={88} /> : <div style={{ height: 88 }} />}
          <div className="hero-title">{title || ' '}</div>
          <div className="hero-sub">{item?.subtitle || ' '}</div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">{item ? compact(item.views) : '–'}</div>
              <div className="hero-stat-label">views</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{item?.rating ? item.rating.toLocaleString(LOCALE, { minimumFractionDigits: 1 }) : '–'}</div>
              <div className="hero-stat-label">rating</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">{item ? item.status : '–'}</div>
              <div className="hero-stat-label">status</div>
            </div>
          </div>
        </div>
      }
    >
      {error && <div className="error-banner">{error}</div>}
      {item && (
        <div className="section">
          <div className="section-header">Details</div>
          <div className="group">
            <div className="cell">
              <div className="cell-icon" style={{ background: 'var(--accent)' }}>
                <Eye size={17} />
              </div>
              <div className="cell-main">Views</div>
              <span className="cell-value">{item.views.toLocaleString(LOCALE)}</span>
            </div>
            <div className="cell">
              <div className="cell-icon" style={{ background: 'var(--orange)' }}>
                <Star size={17} />
              </div>
              <div className="cell-main">Rating</div>
              <span className="cell-value">{item.rating ? item.rating.toLocaleString(LOCALE) : '—'}</span>
            </div>
            <div className="cell">
              <div className="cell-icon" style={{ background: 'var(--indigo)' }}>
                <Clock size={17} />
              </div>
              <div className="cell-main">Updated</div>
              <span className="cell-value">{relative(item.updated_at)}</span>
            </div>
          </div>
        </div>
      )}
    </Page>
  )
}
