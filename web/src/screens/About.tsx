import { ArrowRight, Boxes, Download, ExternalLink, Github, Layers, Moon, Palette, Send, ShieldCheck, Sparkles, Wand2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Switch } from '../components/Controls'
import { REPO, TELEGRAM } from '../components/Credits'
import { Page } from '../components/Page'
import { useWide } from '../hooks/useMedia'
import { t } from '../lib/strings'
import { setTheme, useTheme } from '../lib/theme'

/**
 * Who made it, for whom, and how it works — for the reviewer who opens the link first. The step-by-step
 * presentation of the work will get its own page later.
 */
export function About({ onOpenEditor }: { onOpenEditor: () => void }) {
  const theme = useTheme()
  const wide = useWide()
  return (
    <Page title="О проекте">
      <div className="about-hero showcase">
        <img className="about-hero-pic" src="/about-hero.png" width={112} height={112} alt="Композиция дизайнеров студии: телефон на раскрытой книге" />
        <div className="about-hero-title">Конструктор иллюстраций</div>
        <div className="about-hero-sub">
          Тестовое задание для ООО «Студия Очень» на должность Junior AI Developer.
          <br />
          Выполнил Nikolai Kondakov.
        </div>
      </div>

      <div className="about-grid">
        <div>
          <div className="section">
            <div className="group">
              <button className="cell" onClick={onOpenEditor}>
                <div className="cell-icon" style={{ background: 'var(--accent)' }}>
                  <Wand2 size={16} />
                </div>
                <div className="cell-main">Открыть конструктор</div>
                <ArrowRight size={17} color="var(--text-3)" />
              </button>
              <a className="cell" href={REPO} target="_blank" rel="noreferrer" style={{ ['--inset' as string]: '57px' }}>
                <div className="cell-icon" style={{ background: '#24292f' }}>
                  <Github size={16} />
                </div>
                <div className="cell-main">Исходный код</div>
                <span className="cell-value">GitHub</span>
                <ExternalLink size={16} color="var(--text-3)" />
              </a>
              <a className="cell" href={TELEGRAM} target="_blank" rel="noreferrer" style={{ ['--inset' as string]: '57px' }}>
                <div className="cell-icon" style={{ background: '#2AABEE' }}>
                  <Send size={15} />
                </div>
                <div className="cell-main">Автор</div>
                <span className="cell-value">@tankionline2005</span>
                <ExternalLink size={16} color="var(--text-3)" />
              </a>
            </div>
          </div>

          <div className="section">
            <div className="section-header">Задание</div>
            <div className="group">
              <div className="cell text-cell">
                Сервис, который собирает иллюстрации из объектов 20 исходных иллюстраций студии в разных форматах — по
                метафоре или по названиям объектов. Главное ограничение: ничего не генерировать. Объекты не меняются,
                результат — вектор, цветовая схема не нарушается.
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-header">Как это работает</div>
            <div className="group">
              <Step icon={Sparkles} color="var(--indigo)" title="Смысл → объекты">
                ИИ читает метафору и выбирает 1–3 главных и 0–2 фоновых объекта из десяти. Он только выбирает — рисовать ему
                нечего. Названия объектов распознаются и без ИИ.
              </Step>
              <Step icon={Layers} color="var(--orange)" title="Раскладка">
                Движок расставляет объекты по правилам, снятым с кадров дизайнеров, и проверяет их по маскам настоящих
                силуэтов: главные объекты не перекрывают друг друга, телефон можно положить на книгу, фоновые объекты уходят
                за край кадра.
              </Step>
              <Step icon={Palette} color="var(--red)" title="Палитра">
                Каждый цвет объекта хранится как роль: фон светлый, средний, тёмный, три цвета объектов, контур, белый.
                Перекраска — подстановка ролей, поэтому любая схема ложится без новых файлов.
              </Step>
              <Step icon={Download} color="var(--green)" title="SVG">
                Результат скачивается вектором: каждый объект — отдельная группа с именем, в Figma он открывается слоями.
              </Step>
            </div>
          </div>
        </div>

        <div>
          <div className="section">
            <div className="section-header">Что было интересно</div>
            <div className="group">
              <div className="cell text-cell">
                <b>Правила из кадров дизайнеров.</b> Я нашёл в «Примерах композиций» те же контуры, что в библиотеке, и
                восстановил точные координаты объектов во всех 16 кадрах. Оказалось, объекты стоят в масштабе 1 — крупно и
                с выходом за край. Кадры самих дизайнеров по этим правилам получают лишь небольшой штраф — значит, правила
                описывают их стиль, а не мой вкус.
              </div>
              <div className="cell text-cell">
                <b>Живой статус.</b> Сервер получает ответ модели потоком и пересылает её рассуждения в браузер — поверх сферы
                видно, о чём она думает прямо сейчас, а не крутящийся индикатор.
              </div>
              <div className="cell text-cell">
                <b>Запасной путь.</b> Бесплатная модель бывает медленной или перегруженной. Если она не ответит, объекты
                подберёт словарь смыслов, и интерфейс скажет об этом честно.
              </div>
              <div className="cell text-cell">
                <b>Почему нельзя менять размер объекта.</b> Мне очень хотелось добавить ползунок размера — без него
                конструктором пользоваться не так удобно. Но в правилах студии прямо сказано: нельзя менять пропорции
                объектов относительно друг друга. Отдельный размер у каждого объекта позволил бы сделать монету размером с
                книгу, поэтому я оставил объекты как есть: вместо масштаба — крупный и мелкий наборы, которые нарисовали сами
                дизайнеры.
              </div>
              <div className="cell text-cell">
                <b>Что я заметил в исходниках.</b> Разбирая библиотеку по координатам, я наткнулся на несколько мелочей.
                Мелкий набор — почти везде ровно половина крупного, но монета и ваза чуть крупнее (0,53 и 0,55), поэтому в
                мелком наборе они немного больше относительно остальных предметов. В мелкой персиковой подложке линии декора
                тоньше, чем в остальных: толщина 1 против 2. В «Примерах композиций» попадаются оттенки вне палитры —
                например, папка там светлее, чем в библиотеке (#F5EFC9), — и градиент на ручке, которого нет в библиотеке:
                похоже на ручную подгонку. Дыры в пазлах не вырезаны, а залиты цветом: на фоне незаметно, но если положить под
                пазл другой предмет, его не будет видно. А декор подложек дизайнеры, судя по примерам, подбирают под каждый
                кадр: в сиреневых кадрах стоит уголок из персиковой схемы. Сервис всё это копирует как есть — менять объекты
                правила не позволяют.
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-header">Стек и инструменты</div>
            <div className="group">
              <Tech icon={Boxes} name="React 19, TypeScript, Vite" note="интерфейс в стиле iOS на телефоне, широкий редактор на компьютере" />
              <Tech icon={Layers} name="Раскладка в Web Worker" note="имитация отжига по маскам объектов, 0,3–0,6 с" />
              <Tech icon={Sparkles} name="NVIDIA Nemotron 3.5 Super" note="бесплатная модель через OpenRouter, строгий JSON" />
              <Tech icon={ShieldCheck} name="FastAPI, nginx, Cloudflare" note="сайт открыт только через Cloudflare, лимиты на запросы" />
              <Tech icon={Wand2} name="Claude Code" note="разработка: Claude Opus 5.5" />
            </div>
          </div>

          {!wide && (
            <div className="section">
              <div className="group">
                <div className="cell" style={{ ['--inset' as string]: '57px' }}>
                  <div className="cell-icon" style={{ background: 'var(--indigo)' }}>
                    <Moon size={17} />
                  </div>
                  <div className="cell-main">{t.darkTheme}</div>
                  <Switch label={t.darkTheme} on={theme === 'dark'} onChange={(on) => setTheme(on ? 'dark' : 'light')} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}

function Step({ icon: Icon, color, title, children }: { icon: LucideIcon; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="cell step-cell" style={{ ['--inset' as string]: '57px' }}>
      <div className="cell-icon" style={{ background: color }}>
        <Icon size={16} />
      </div>
      <div className="cell-main">
        <div className="step-title">{title}</div>
        <div className="step-text">{children}</div>
      </div>
    </div>
  )
}

function Tech({ icon: Icon, name, note }: { icon: LucideIcon; name: string; note: string }) {
  return (
    <div className="cell" style={{ ['--inset' as string]: '57px' }}>
      <div className="cell-icon" style={{ background: 'var(--text-2)' }}>
        <Icon size={16} />
      </div>
      <div className="cell-main">
        <div>{name}</div>
        <div className="cell-sub wrap">{note}</div>
      </div>
    </div>
  )
}
