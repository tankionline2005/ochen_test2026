import { ExternalLink, Github, Moon, Send, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Switch } from '../components/Controls'
import { REPO, TELEGRAM } from '../components/Credits'
import { InstallSheet } from '../components/InstallSheet'
import { Page } from '../components/Page'
import { Logo } from '../components/TopBar'
import { usePwaInstall } from '../hooks/usePwa'
import { t } from '../lib/strings'
import { setTheme, useTheme } from '../lib/theme'

/** Who made it and for whom; how it works in a few lines; the theme switch for phones (desktop has it in the top bar). */
export function About() {
  const theme = useTheme()
  const pwa = usePwaInstall()
  const [installing, setInstalling] = useState(false)
  return (
    <Page title="О проекте">
      <div className="about-hero showcase">
        <Logo size={56} />
        <div className="about-hero-title">Конструктор иллюстраций</div>
        <div className="about-hero-sub">
          Тестовое задание для ООО «Студия Очень» на должность Junior AI Developer.
          <br />
          Выполнил Nikolai Kondakov.
        </div>
      </div>

      <div className="section">
        <div className="group">
          <a className="cell" href={TELEGRAM} target="_blank" rel="noreferrer">
            <div className="cell-icon" style={{ background: '#2AABEE' }}>
              <Send size={16} />
            </div>
            <div className="cell-main">Telegram</div>
            <span className="cell-value">@tankionline2005</span>
            <ExternalLink size={16} color="var(--text-3)" />
          </a>
          <a className="cell" href={REPO} target="_blank" rel="noreferrer" style={{ ['--inset' as string]: '57px' }}>
            <div className="cell-icon" style={{ background: '#24292f' }}>
              <Github size={16} />
            </div>
            <div className="cell-main">Исходный код</div>
            <span className="cell-value">GitHub</span>
            <ExternalLink size={16} color="var(--text-3)" />
          </a>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Что умеет</div>
        <div className="group">
          <div className="cell text-cell">
            Собирает иллюстрацию из объектов исходной библиотеки — по метафоре или заголовку (объекты подбирает ИИ) или по
            названиям объектов. Объекты не перерисовываются и не генерируются: каждый копируется из исходного SVG как есть,
            меняются только место, поворот, порядок слоёв, роль (главный или фоновый) и цвета внутри палитры.
          </div>
          <div className="cell text-cell">
            Три формата из примеров дизайнеров, два размера объектов, три цветовые схемы и свои палитры с автоматической
            перекраской. Результат скачивается в SVG: вектор, каждый объект — отдельная именованная группа.
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">Как устроено</div>
        <div className="group">
          <div className="cell text-cell">
            <b>Библиотека.</b> Скрипт сборки берёт 40 SVG из Figma, заменяет каждый цвет его ролью в палитре и строит маску
            занятых клеток каждого объекта. Геометрия путей не меняется.
          </div>
          <div className="cell text-cell">
            <b>Раскладка.</b> Правила сняты с 16 кадров дизайнеров: объекты в масштабе 1, главные почти целиком в кадре,
            фоновые уходят за край, телефон можно положить на книгу, ничего не протыкает друг друга. Поиск — имитация
            отжига по маскам, в отдельном потоке браузера.
          </div>
          <div className="cell text-cell">
            <b>ИИ.</b> Сервер на FastAPI спрашивает бесплатную модель NVIDIA Nemotron 3.5 Super через OpenRouter, какие
            объекты передают смысл, и транслирует ход её рассуждений в живой статус. Если модель молчит, объекты подбирает
            словарь смыслов.
          </div>
        </div>
      </div>

      <div className="section">
        <div className="group">
          <div className="cell" style={{ ['--inset' as string]: '57px' }}>
            <div className="cell-icon" style={{ background: 'var(--indigo)' }}>
              <Moon size={17} />
            </div>
            <div className="cell-main">{t.darkTheme}</div>
            <Switch label={t.darkTheme} on={theme === 'dark'} onChange={(on) => setTheme(on ? 'dark' : 'light')} />
          </div>
          {pwa.available && (
            <button className="cell" style={{ ['--inset' as string]: '57px' }} onClick={() => setInstalling(true)}>
              <div className="cell-icon" style={{ background: 'var(--accent)' }}>
                <Smartphone size={18} />
              </div>
              <div className="cell-main">{t.homeScreen}</div>
            </button>
          )}
        </div>
      </div>
      {pwa.available && <InstallSheet open={installing} onClose={() => setInstalling(false)} />}
    </Page>
  )
}
