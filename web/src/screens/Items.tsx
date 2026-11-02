import { AnimatePresence, motion } from 'framer-motion'
import { List, Loader2, Pause, Play, Plus, RotateCw, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Page } from '../components/Page'
import { Chips } from '../components/Segmented'
import { ActionSheet, Sheet } from '../components/Sheet'
import { SwipeRow, type SwipeAction } from '../components/SwipeRow'
import { useToast } from '../components/Toast'
import { useMouse } from '../hooks/useMedia'
import { demo, type Item, type ItemStatus } from '../lib/demo'
import { compact, shortDate } from '../lib/format'
import { spring } from '../lib/motion'
import { openIntro, useFirstVisit } from '../lib/intros'
import { t } from '../lib/strings'

type Filter = 'all' | ItemStatus

const STATUS_LABEL: Partial<Record<ItemStatus, string>> = { pending: 'waiting', paused: 'paused', error: 'error' }

function subtitle(item: Item) {
  if (item.status === 'paused') return 'Paused'
  if (item.detail) return item.detail
  return [item.subtitle, item.views ? `${compact(item.views)} views` : ''].filter(Boolean).join(' · ')
}

/** A chat-list style list: search, filter chips, swipe (or hover) actions, add sheet, delete confirmation. */
export function Items({ onOpen }: { onOpen: (id: number) => void }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<Item | null>(null)
  const toast = useToast()
  const mouse = useMouse()

  const reload = useCallback(async () => setItems(await demo.items()), [])
  useEffect(() => {
    reload()
  }, [reload])

  const counts = useMemo(() => {
    const c: Partial<Record<ItemStatus, number>> = {}
    items?.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1))
    return c
  }, [items])

  useFirstVisit('items', items !== null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((i) => (filter === 'all' || i.status === filter) && (!q || i.title.toLowerCase().includes(q)))
  }, [items, filter, query])

  // chips appear only for statuses that exist, each with its count
  const filters = [
    { value: 'all' as const, label: `All ${items?.length ?? ''}`.trim() },
    { value: 'active' as const, label: `Active ${counts.active ?? 0}` },
    ...(counts.pending ? [{ value: 'pending' as const, label: `Waiting ${counts.pending}` }] : []),
    ...(counts.error ? [{ value: 'error' as const, label: `Errors ${counts.error}` }] : []),
    ...(counts.paused ? [{ value: 'paused' as const, label: `Paused ${counts.paused}` }] : []),
  ]

  const setStatus = async (item: Item, status: ItemStatus) => {
    await demo.setStatus(item.id, status)
    await reload()
  }

  const remove = async (item: Item) => {
    await demo.removeItem(item.id)
    toast('Item deleted')
    await reload()
  }

  const rowActions = (item: Item): SwipeAction[] => [
    item.status === 'error'
      ? { label: 'Retry', icon: RotateCw, color: 'var(--accent)', onClick: () => setStatus(item, 'pending') }
      : item.status === 'paused'
        ? { label: 'Resume', icon: Play, color: 'var(--green)', onClick: () => setStatus(item, 'active') }
        : { label: 'Pause', icon: Pause, color: 'var(--orange)', onClick: () => setStatus(item, 'paused') },
    { label: 'Delete', icon: Trash2, color: 'var(--red)', onClick: () => setConfirm(item) },
  ]

  return (
    <Page
      title="Items"
      titleCount={items?.length || undefined}
      onHelp={() => openIntro('items')}
      onRefresh={reload}
      right={
        <motion.button className="nav-button" onClick={() => setAdding(true)} aria-label="Add item" whileTap={{ scale: 0.85 }}>
          <Plus size={26} />
        </motion.button>
      }
      accessory={
        items && items.length > 0 ? (
          <>
            <label className="search">
              <Search size={17} />
              <input placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
              {query && (
                <button aria-label={t.clear} onClick={() => setQuery('')} style={{ display: 'flex' }}>
                  <X size={17} />
                </button>
              )}
            </label>
            {filters.length > 2 && <Chips id="items-filter" options={filters} value={filter} onChange={setFilter} />}
          </>
        ) : null
      }
    >
      {items === null && (
        <div className="loader">
          <Loader2 size={22} className="spinner" />
        </div>
      )}

      {items && items.length === 0 && (
        <motion.div className="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <div className="empty-icon">
            <List size={32} strokeWidth={1.6} />
          </div>
          <div className="empty-title">No items</div>
          <div>Add the first one to get started</div>
          <button className="button" style={{ width: 'auto', padding: '0 24px', marginTop: 16 }} onClick={() => setAdding(true)}>
            Add item
          </button>
        </motion.div>
      )}

      {visible.length > 0 && (
        <div className="list-plain">
          <AnimatePresence initial={false}>
            {visible.map((item) => (
              <motion.div
                key={item.id}
                className="list-item"
                style={{ overflow: 'hidden', ['--inset' as string]: '78px' }}
                layout="position"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
              >
                <SwipeRow actions={rowActions(item)}>
                  <button className="chat-row" onClick={() => onOpen(item.id)}>
                    <Avatar title={item.title} seed={item.id} size={54} />
                    <div className="chat-row-main">
                      <div className="chat-row-top">
                        <span className="chat-row-title">{item.title}</span>
                        {STATUS_LABEL[item.status] && <span className={`status-pill ${item.status}`}>{STATUS_LABEL[item.status]}</span>}
                        <span className="chat-row-time">{shortDate(item.updated_at)}</span>
                      </div>
                      <div className={`chat-row-sub${item.status === 'error' ? ' error' : ''}`}>{subtitle(item)}</div>
                    </div>
                  </button>
                </SwipeRow>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {items && items.length > 0 && visible.length === 0 && (
        <div className="empty">
          <div className="empty-title">Nothing found</div>
        </div>
      )}

      {/* the hint names the gesture the user actually has */}
      {items && items.length > 0 && (
        <div className="section-footer" style={{ textAlign: 'center', padding: '12px 32px' }}>
          {mouse ? 'Hover over an item to pause or delete it' : 'Swipe an item left to pause or delete it'}
        </div>
      )}

      <AddItemSheet open={adding} onClose={() => setAdding(false)} onAdded={reload} />
      <ActionSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.title}
        message="The item and its history will be deleted"
        actions={confirm ? [{ label: 'Delete item', destructive: true, onClick: () => remove(confirm) }] : []}
      />
    </Page>
  )
}

function AddItemSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setTitle('')
      setError(null)
    }
  }, [open])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await demo.addItem(title.trim())
      toast('Item added')
      onAdded()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const valid = title.trim().length > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New item"
      left={
        <button className="nav-button" onClick={onClose}>
          {t.cancel}
        </button>
      }
      right={
        <button className="nav-button" style={{ fontWeight: 600 }} disabled={busy || !valid} onClick={submit}>
          {busy ? <Loader2 size={20} className="spinner" /> : 'Add'}
        </button>
      }
    >
      <div className="section">
        <div className="group">
          <input
            className="field"
            placeholder="Title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && valid && submit()}
          />
        </div>
        <div className="section-footer" style={error ? { color: 'var(--red)' } : undefined}>
          {error ?? 'The item appears at the top of the list and starts syncing right away.'}
        </div>
      </div>
    </Sheet>
  )
}
