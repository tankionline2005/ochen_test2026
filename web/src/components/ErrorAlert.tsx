import { useEffect } from 'react'
import { copyText } from '../lib/clipboard'
import { t } from '../lib/strings'
import { Alert } from './Alert'
import { useToast } from './Toast'

export interface ErrorInfo {
  /** what happened, for people */
  text: string
  /** what the service said itself (a provider's message, a code): shown small, copied whole */
  detail?: string | null
}

/**
 * An alert for a failure worth reading — a long operation that failed, an outside service's refusal: the human words,
 * the raw detail under them, «Copy error text» (so the person can send it to support) and «Got it». A small failure
 * of a click is a toast instead.
 */
export function ErrorAlert({
  error,
  title = t.failed,
  onClose,
}: {
  error: ErrorInfo | null
  title?: string
  onClose: () => void
}) {
  const toast = useToast()

  // Enter agrees too, as in a system alert
  useEffect(() => {
    if (!error) return
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [error, onClose])

  const copy = async () => {
    if (!error) return
    const all = error.detail && error.detail !== error.text ? `${error.text}\n\n${error.detail}` : error.text
    toast((await copyText(all)) ? t.errorCopied : all)
  }

  return (
    <Alert
      open={!!error}
      title={title}
      text={error?.text}
      buttons={[
        { label: t.copyError, onClick: copy },
        { label: t.gotIt, onClick: onClose, strong: true },
      ]}
      onClose={onClose}
    >
      {error?.detail && error.detail !== error.text && <div className="alert-detail">{error.detail}</div>}
    </Alert>
  )
}
