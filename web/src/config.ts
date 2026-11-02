/** App-wide settings. scripts/scaffold.py fills these in; edit by hand afterwards. */
export const APP_NAME = 'Конструктор иллюстраций'

/** Language of the built-in UI strings and of number/date formatting (see lib/strings.ts). */
export const LANG: 'en' | 'ru' = 'ru'

/**
 * The theme until the person picks one with the switch in Settings: 'dark', 'light', or 'system' (follows the device,
 * live). Keep the same value in index.html's inline script — it applies the theme before the page draws.
 */
export const DEFAULT_THEME: 'dark' | 'light' | 'system' = 'system'

/**
 * Where lib/freezeGuard.tsx reports a frozen page (a leftover invisible layer, a scroll lock nobody holds) as JSON:
 * {kind, detail}. null: only the console hears it. A backend endpoint that just logs the body is enough.
 */
export const CLIENT_LOG_URL: string | null = null
