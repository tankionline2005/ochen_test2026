import { LOCALE, t } from './strings'

const decimal = (1.5).toLocaleString(LOCALE).charAt(1)

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '').replace('.', decimal)
}

/** 950 → "950", 6 400 → "6.4K", 64 000 → "64K", 1 200 000 → "1.2M" — like Telegram counters. */
export function compact(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return trim(n / 1000) + 'K'
  if (n < 1_000_000) return Math.round(n / 1000) + 'K'
  return trim(n / 1_000_000) + 'M'
}

export function percent(n: number): string {
  return n.toFixed(n >= 10 ? 1 : 2).replace('.', decimal) + '%'
}

const pluralRules = new Intl.PluralRules(LOCALE)

/**
 * Word form for a count, using the language's own plural rules.
 * en: plural(n, { one: 'post', other: 'posts' })
 * ru: plural(n, { one: 'пост', few: 'поста', many: 'постов' })
 */
export function plural(n: number, forms: Partial<Record<Intl.LDMLPluralRule, string>>): string {
  return forms[pluralRules.select(n)] ?? forms.other ?? forms.many ?? Object.values(forms)[0] ?? ''
}

/** 1 536 000 → "1.5 MB" */
export function bytes(n: number): string {
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = n / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? Math.round(value) : trim(value)} ${units[unit]}`
}

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
const longDayFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' })
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' })
const relativeFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })

/** "14:05" for today, "Mon" within a week, "Oct 7" otherwise — like the Telegram chat list. */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return timeFmt.format(d)
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return weekdayFmt.format(d)
  return dayFmt.format(d)
}

export function time(iso: string): string {
  return timeFmt.format(new Date(iso))
}

/** "just now", "5 minutes ago", "3 hours ago", then the short date and time. */
export function relative(iso: string): string {
  const min = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return t.justNow
  if (min < 60) return relativeFmt.format(-min, 'minute')
  if (min < 24 * 60) return relativeFmt.format(-Math.floor(min / 60), 'hour')
  return `${shortDate(iso)}, ${time(iso)}`
}

/** Day separator text in a feed: "Today", "Yesterday", "October 5". */
export function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return t.today
  if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return t.yesterday
  return longDayFmt.format(d)
}
