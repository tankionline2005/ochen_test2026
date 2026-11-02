import { Hand, Inbox, ListFilter, RefreshCw, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { IntroSection } from '../components/Intro'

/**
 * Each section's welcome cards (components/Intro.tsx): they open by themselves on the first visit (useFirstVisit)
 * and again from the «?» by the title (Page onHelp). Two or three cards, each one idea in a short title and two
 * sentences. With roles, build this per person so a card never names a button they don't have.
 */
export const INTROS: Record<string, IntroSection> = {
  home: {
    title: 'Home',
    slides: [
      {
        icon: Sparkles,
        color: 'var(--accent)',
        title: 'Everything new, in one feed',
        text: 'Cards come grouped by day, newest first. The switch under the title narrows them to today or this week.',
      },
      {
        icon: RefreshCw,
        color: 'var(--green)',
        title: 'Always fresh',
        text: 'Pull the page down to refresh — or press the round arrow at the top on a computer.',
      },
    ],
  },
  items: {
    title: 'Items',
    slides: [
      {
        icon: Inbox,
        color: 'var(--indigo)',
        title: 'Your collection',
        text: 'Add items with the plus at the top. Tap one to open its card with the numbers and details.',
      },
      {
        icon: Hand,
        color: 'var(--orange)',
        title: 'Actions at hand',
        text: 'Swipe an item left to pause or delete it; on a computer the buttons appear when you hover.',
      },
      {
        icon: ListFilter,
        color: 'var(--accent)',
        title: 'Find anything',
        text: 'Search by name, and filter by status with the chips under the search field.',
      },
    ],
  },
  settings: {
    title: 'Settings',
    slides: [
      {
        icon: SlidersHorizontal,
        color: 'var(--text-2)',
        title: 'Saved as you go',
        text: 'Every switch and value is saved the moment you change it — there is no Save button to forget.',
      },
    ],
  },
}
