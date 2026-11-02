import { AnimatePresence } from 'framer-motion'
import { Bell, ChevronRight, Clock, Moon, SlidersHorizontal, Smartphone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { InstallSheet } from '../components/InstallSheet'
import { Stepper, Switch } from '../components/Controls'
import { DismissibleNote } from '../components/DismissibleNote'
import { Page } from '../components/Page'
import { ActionSheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { usePwaInstall } from '../hooks/usePwa'
import { plural } from '../lib/format'
import { openIntro, useFirstVisit } from '../lib/intros'
import { t } from '../lib/strings'
import { setTheme, useTheme } from '../lib/theme'

const RETENTION_STEPS = [7, 14, 30, 60, 90, 365]

/**
 * iOS Settings: grouped sections, icon cells, switch, stepper, a pushed sub-screen, a destructive action — and the
 * app-wide pieces every app needs: the dark-theme switch and «Add to Home Screen».
 */
export function Settings({ onOpenAdvanced }: { onOpenAdvanced: () => void }) {
  const [notify, setNotify] = useState(true)
  const [days, setDays] = useState(30)
  const [problem, setProblem] = useState<string | null>('Last sync failed: the server did not answer in time')
  const [confirmReset, setConfirmReset] = useState(false)
  const [installing, setInstalling] = useState(false)
  const theme = useTheme()
  const pwa = usePwaInstall()
  const toast = useToast()
  useFirstVisit('settings')

  // save immediately on change and confirm with a toast — iOS settings have no "Save" button
  const saveNotify = (on: boolean) => {
    setNotify(on)
    toast(on ? 'Notifications on' : 'Notifications off')
  }

  return (
    <Page title="Settings" onHelp={() => openIntro('settings')}>
      <div className="section">
        <div className="group">
          <div className="cell">
            <div className="cell-icon" style={{ background: 'var(--red)' }}>
              <Bell size={17} />
            </div>
            <div className="cell-main">Notifications</div>
            <Switch on={notify} onChange={saveNotify} label="Notifications" />
          </div>
          <button className="cell" style={{ ['--inset' as string]: '57px' }} onClick={onOpenAdvanced}>
            <div className="cell-icon" style={{ background: 'var(--indigo)' }}>
              <SlidersHorizontal size={17} />
            </div>
            <div className="cell-main">Advanced</div>
            <span className="cell-value">2</span>
            <ChevronRight size={18} color="var(--text-3)" />
          </button>
        </div>
        {/* an error the user can dismiss: × with a mouse, sideways swipe on touch */}
        <AnimatePresence>{problem && <DismissibleNote onDismiss={() => setProblem(null)}>{problem}</DismissibleNote>}</AnimatePresence>
        <div className="section-footer">
          Alerts arrive when something breaks. Fine-tune them in{' '}
          <button className="link-inline" onClick={onOpenAdvanced}>
            advanced settings
          </button>
          .
        </div>
      </div>

      <div className="section">
        <div className="section-header">Storage</div>
        <div className="group">
          <div className="cell">
            <div className="cell-icon" style={{ background: 'var(--orange)' }}>
              <Clock size={17} />
            </div>
            <div className="cell-main">
              Keep for {days} {plural(days, { one: 'day', other: 'days' })}
            </div>
            <Stepper value={days} steps={RETENTION_STEPS} onChange={setDays} />
          </div>
        </div>
        <div className="section-footer">Older records are deleted automatically.</div>
      </div>

      {/* the theme flips at once — no toast, no animation: it is not an action to confirm */}
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
              <ChevronRight size={18} color="var(--text-3)" />
            </button>
          )}
        </div>
      </div>

      <div className="section">
        <div className="group">
          <button className="cell destructive" onClick={() => setConfirmReset(true)}>
            <Trash2 size={18} />
            Reset all data
          </button>
        </div>
      </div>

      <ActionSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        message="Everything will be deleted. This cannot be undone."
        actions={[{ label: 'Reset all data', destructive: true, onClick: () => toast('Data reset') }]}
      />
      {pwa.available && <InstallSheet open={installing} onClose={() => setInstalling(false)} />}
    </Page>
  )
}
