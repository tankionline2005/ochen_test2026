import { LANG } from '../config'

/**
 * Strings the UI kit itself shows (buttons inside components, gesture hints, the install steps).
 * Screen texts live in the screens. To add a language, add a dictionary with the same keys.
 */
const dict = {
  en: {
    cancel: 'Cancel',
    done: 'Done',
    back: 'Back',
    refresh: 'Refresh',
    less: 'Less',
    more: 'More',
    hide: 'Hide',
    swipeToHide: 'Swipe to hide',
    clear: 'Clear',
    search: 'Search',
    today: 'Today',
    yesterday: 'Yesterday',
    justNow: 'just now',
    // Alert / ErrorAlert
    gotIt: 'Got it',
    failed: 'Something went wrong',
    copyError: 'Copy error text',
    errorCopied: 'Error text copied',
    // welcome cards and tips
    howItWorks: 'How it works',
    skip: 'Skip',
    next: 'Next',
    continue: 'Continue',
    card: 'Card',
    // theme
    darkTheme: 'Dark theme',
    // install to the home screen
    homeScreen: 'Home Screen',
    install: 'Install',
    installed: 'App installed',
    installLead: 'opens as an app of its own — full screen, without the browser bars.',
    openInBrowser: (browser: string) => `Open this page in ${browser} — an in-app browser can't install it.`,
    iosShare: 'Tap "Share" in the browser bar.',
    iosAdd: 'Choose "Add to Home Screen" — scroll the list if you don’t see it.',
    iosConfirm: 'Tap "Add". The icon appears on your Home Screen.',
    androidMenu: 'Open the browser menu (three dots).',
    androidAdd: 'Choose "Install app" or "Add to Home screen".',
  },
  ru: {
    cancel: 'Отмена',
    done: 'Готово',
    back: 'Назад',
    refresh: 'Обновить',
    less: 'Меньше',
    more: 'Больше',
    hide: 'Скрыть',
    swipeToHide: 'Смахните, чтобы скрыть',
    clear: 'Очистить',
    search: 'Поиск',
    today: 'Сегодня',
    yesterday: 'Вчера',
    justNow: 'только что',
    gotIt: 'Понятно',
    failed: 'Не получилось',
    copyError: 'Скопировать текст ошибки',
    errorCopied: 'Текст ошибки скопирован',
    howItWorks: 'Как это работает',
    skip: 'Пропустить',
    next: 'Далее',
    continue: 'Продолжить',
    card: 'Карточка',
    darkTheme: 'Тёмная тема',
    homeScreen: 'На экран «Домой»',
    install: 'Установить',
    installed: 'Приложение установлено',
    installLead: 'откроется как отдельное приложение — на весь экран, без панелей браузера.',
    openInBrowser: (browser: string) => `Откройте эту страницу в ${browser} — из встроенного браузера установить нельзя.`,
    iosShare: 'Нажмите «Поделиться» в панели браузера.',
    iosAdd: 'Выберите «На экран „Домой“» — пролистайте список, если пункта не видно.',
    iosConfirm: 'Нажмите «Добавить». Иконка появится на экране «Домой».',
    androidMenu: 'Откройте меню браузера (три точки).',
    androidAdd: 'Выберите «Установить приложение» или «Добавить на главный экран».',
  },
} as const

export const t = dict[LANG]

/** BCP 47 locale for Intl formatting. */
export const LOCALE = { en: 'en-US', ru: 'ru-RU' }[LANG]
