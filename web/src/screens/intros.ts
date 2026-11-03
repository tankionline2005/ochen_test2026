import { Boxes, Hand, Palette, Sparkles, SwatchBook, Wand2 } from 'lucide-react'
import type { IntroSection } from '../components/Intro'

/** Each section's welcome cards: open by themselves on the first visit, again from the «?» by the title. */
export const INTROS: Record<string, IntroSection> = {
  editor: {
    title: 'Конструктор',
    slides: [
      {
        icon: Sparkles,
        color: 'var(--indigo)',
        title: 'Опишите смысл',
        text: 'Напишите метафору или заголовок — ИИ подберёт подходящие объекты, а раскладка соберёт из них кадр, как это делают дизайнеры.',
      },
      {
        icon: Wand2,
        color: 'var(--accent)',
        title: 'Или назовите объекты',
        text: 'Режим «По названиям»: «книга, телефон, лампа фоном». Объекты не генерируются — только копируются из исходной библиотеки.',
      },
      {
        icon: Hand,
        color: 'var(--orange)',
        title: 'Доведите руками',
        text: 'Двигайте объекты, поворачивайте, меняйте слои и роль, пробуйте другой вариант раскладки. Готовое скачивается в SVG.',
      },
    ],
  },
  library: {
    title: 'Библиотека',
    slides: [
      {
        icon: Boxes,
        color: 'var(--green)',
        title: '10 предметов, 40 версий',
        text: 'Каждый предмет есть в крупном и мелком размере, в двух версиях: главной (цветной) и фоновой (монохромной). Нажмите «Главный» или «Фоновый», чтобы добавить его на холст.',
      },
    ],
  },
  palettes: {
    title: 'Палитры',
    slides: [
      {
        icon: Palette,
        color: 'var(--red)',
        title: 'Перекраска одним нажатием',
        text: 'Выберите схему — вся композиция перекрасится сразу: цвета фона остаются фоном, цвета объектов — объектами.',
      },
      {
        icon: SwatchBook,
        color: 'var(--indigo)',
        title: 'Своя палитра',
        text: 'Вставьте hex-коды или JSON, загрузите файл или возьмите цвета с картинки. Сервис проверит правила схемы и покажет превью.',
      },
    ],
  },
}
