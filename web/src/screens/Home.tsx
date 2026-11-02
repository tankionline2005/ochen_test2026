import { Eye, Inbox } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Page } from '../components/Page'
import { Segmented } from '../components/Segmented'
import { Tip } from '../components/Tip'
import { useStored } from '../hooks/useStored'
import { demo, type Card } from '../lib/demo'
import { compact, dayLabel, time } from '../lib/format'
import { openIntro, useFirstVisit } from '../lib/intros'

const PERIODS = ['day', 'week', 'all'] as const
type Period = (typeof PERIODS)[number]
const PERIOD_MS: Record<Period, number> = { day: 86_400_000, week: 7 * 86_400_000, all: Infinity }

/** A feed of cards grouped by day — the Telegram channel look. */
export function Home() {
  const [cards, setCards] = useState<Card[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // remembered per browser: the user comes back to the same filter
  const [period, setPeriod] = useStored<Period>('home.period', 'week', PERIODS)

  const reload = useCallback(async () => {
    try {
      setCards(await demo.cards())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useFirstVisit('home')

  const visible = useMemo(
    () => (cards ?? []).filter((c) => Date.now() - new Date(c.posted_at).getTime() < PERIOD_MS[period]),
    [cards, period],
  )

  return (
    <Page
      title="Home"
      onHelp={() => openIntro('home')}
      onRefresh={reload}
      accessory={
        <Segmented
          id="home-period"
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'all', label: 'All time' },
          ]}
          value={period}
          onChange={setPeriod}
        />
      }
    >
      {error && <div className="error-banner">{error}</div>}

      {/* a one-time tip about something new, where it lives: × or its action hides it for good */}
      <Tip id="home-period" icon={Eye} title="New: periods" action="Show this week" onAction={() => setPeriod('week')}>
        Narrow the feed to today or this week with the switch above.
      </Tip>

      <div className="feed">
        {cards === null &&
          [0, 1, 2].map((i) => (
            <div className="skeleton" key={i}>
              <div className="skeleton-line" style={{ width: '40%' }} />
              <div className="skeleton-line" />
              <div className="skeleton-line" style={{ width: '75%' }} />
            </div>
          ))}

        {visible.map((card, i) => {
          const day = dayLabel(card.posted_at)
          const newDay = i === 0 || dayLabel(visible[i - 1].posted_at) !== day
          return (
            <Fragment key={card.id}>
              {newDay && <div className="day-separator">{day}</div>}
              <article className="card">
                <div className="card-header">
                  <Avatar title={card.item.title} seed={card.item.id} size={38} />
                  <div className="card-header-main">
                    <div className="card-title">{card.item.title}</div>
                    <div className="card-sub">{time(card.posted_at)}</div>
                  </div>
                </div>
                <div className="card-body">{card.text}</div>
                {card.reactions.length > 0 && (
                  <div className="reactions">
                    {card.reactions.map((r) => (
                      <span className="reaction" key={r.e}>
                        <span className="reaction-emoji">{r.e}</span>
                        {compact(r.c)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="card-meta">
                  <span className="meta-item">
                    <Eye size={13} />
                    {compact(card.views)}
                  </span>
                  {time(card.posted_at)}
                </div>
              </article>
            </Fragment>
          )
        })}
      </div>

      {cards !== null && visible.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <Inbox size={32} strokeWidth={1.6} />
          </div>
          <div className="empty-title">Nothing here yet</div>
          <div>Try a longer period</div>
        </div>
      )}
    </Page>
  )
}
