/**
 * Fake data so the template runs without a backend. Delete this file once the screens call
 * the real API — it only exists to show loading states and list animations.
 */

export type ItemStatus = 'active' | 'pending' | 'paused' | 'error'

export interface Item {
  id: number
  title: string
  subtitle: string
  status: ItemStatus
  detail?: string
  updated_at: string
  views: number
  rating: number
}

export interface Card {
  id: number
  item: Pick<Item, 'id' | 'title'>
  text: string
  image?: string
  posted_at: string
  views: number
  reactions: { e: string; c: number }[]
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms))

let items: Item[] = [
  { id: 1, title: 'Design Weekly', subtitle: 'Layouts, type and color', status: 'active', updated_at: ago(12), views: 48200, rating: 4.8 },
  { id: 2, title: 'Product Notes', subtitle: 'What shipped this week', status: 'active', updated_at: ago(95), views: 12900, rating: 4.5 },
  { id: 3, title: 'Field Reports', subtitle: '', status: 'pending', detail: 'Waiting for the first sync', updated_at: ago(300), views: 0, rating: 0 },
  { id: 4, title: 'Archive', subtitle: '', status: 'paused', updated_at: ago(2900), views: 3100, rating: 4.1 },
  { id: 5, title: 'Broken Source', subtitle: '', status: 'error', detail: 'Source not found — check the link', updated_at: ago(8000), views: 0, rating: 0 },
  { id: 6, title: 'Science Simply', subtitle: 'Big ideas in plain words', status: 'active', updated_at: ago(30), views: 512000, rating: 4.9 },
]

const cards: Card[] = [
  { id: 1, item: items[0], text: 'Spacing does more for hierarchy than color. Try removing a divider and adding 8px instead.', posted_at: ago(20), views: 6400, reactions: [{ e: '👍', c: 120 }, { e: '🔥', c: 34 }] },
  { id: 2, item: items[5], text: 'Why is the sky blue? Shorter wavelengths scatter more — so blue light reaches your eyes from every direction.', posted_at: ago(180), views: 52000, reactions: [{ e: '🤯', c: 410 }] },
  { id: 3, item: items[1], text: 'New: offline mode, faster search, and a calmer notification sound.', posted_at: ago(60 * 26), views: 3100, reactions: [] },
  { id: 4, item: items[0], text: 'Rounded corners on nested elements: inner radius = outer radius − padding.', posted_at: ago(60 * 50), views: 9800, reactions: [{ e: '❤️', c: 88 }] },
]

export const demo = {
  async items() {
    await wait()
    return [...items]
  },
  async item(id: number) {
    await wait(250)
    const found = items.find((i) => i.id === id)
    if (!found) throw new Error('Item not found')
    return { ...found }
  },
  async addItem(title: string) {
    await wait(300)
    const item: Item = { id: Date.now(), title, subtitle: '', status: 'pending', detail: 'Just added', updated_at: ago(0), views: 0, rating: 0 }
    items = [item, ...items]
    return item
  },
  async setStatus(id: number, status: ItemStatus) {
    await wait(200)
    items = items.map((i) => (i.id === id ? { ...i, status, detail: undefined } : i))
  },
  async removeItem(id: number) {
    await wait(200)
    items = items.filter((i) => i.id !== id)
  },
  async cards() {
    await wait(700)
    return [...cards]
  },
}
