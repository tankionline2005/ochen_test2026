import { Check, Compass, EllipsisVertical, Share, SquarePlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { APP_NAME } from '../config'
import { isInAppBrowser, isIOS, usePwaInstall } from '../hooks/usePwa'
import { t } from '../lib/strings'
import { Sheet } from './Sheet'
import { useToast } from './Toast'

/**
 * How to put the app on the home screen, for the browser the person is in: Chrome/Android get a real «Install» button
 * (beforeinstallprompt); iOS Safari has none, so it shows the three taps; an in-app browser (Telegram, Instagram)
 * can't install at all and says to open the page in Safari/Chrome. Offer it from Settings only when
 * `usePwaInstall().available` (a phone, not already installed).
 */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pwa = usePwaInstall()
  const toast = useToast()
  const ios = isIOS()

  const install = async () => {
    if (await pwa.install()) {
      toast(t.installed)
      onClose()
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.homeScreen}
      right={
        <button className="nav-button" style={{ fontWeight: 600 }} onClick={onClose}>
          {t.done}
        </button>
      }
    >
      <div className="install-hero">
        <img src="/icons/icon-192.png" alt="" width={72} height={72} />
        <div className="hero-sub">
          {APP_NAME} {t.installLead}
        </div>
      </div>

      {pwa.canPrompt ? (
        <div className="section">
          <button className="button" onClick={install}>
            {t.install}
          </button>
        </div>
      ) : (
        <div className="section">
          <div className="group">
            {isInAppBrowser() && <Step icon={<Compass size={18} />}>{t.openInBrowser(ios ? 'Safari' : 'Chrome')}</Step>}
            {ios ? (
              <>
                <Step icon={<Share size={18} />}>{t.iosShare}</Step>
                <Step icon={<SquarePlus size={18} />}>{t.iosAdd}</Step>
                <Step icon={<Check size={18} />}>{t.iosConfirm}</Step>
              </>
            ) : (
              <>
                <Step icon={<EllipsisVertical size={18} />}>{t.androidMenu}</Step>
                <Step icon={<SquarePlus size={18} />}>{t.androidAdd}</Step>
              </>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function Step({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="cell" style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12, ['--inset' as string]: '57px' }}>
      <div className="cell-icon" style={{ background: 'var(--accent)' }}>
        {icon}
      </div>
      <div className="cell-main" style={{ fontSize: 15, lineHeight: 1.35, whiteSpace: 'normal' }}>
        {children}
      </div>
    </div>
  )
}
