import { ChevronLeft, Copy, Loader2, PlugZap } from 'lucide-react'
import { useState } from 'react'
import { ErrorAlert, type ErrorInfo } from '../components/ErrorAlert'
import { Segmented } from '../components/Segmented'
import { Page } from '../components/Page'
import { useToast } from '../components/Toast'
import { copyText } from '../lib/clipboard'

/** A sub-screen pushed from Settings: back button with the parent's name, text fields, plain buttons. */
export function Advanced({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<'fast' | 'balanced' | 'careful'>('balanced')
  const [note, setNote] = useState('')
  const toast = useToast()
  const token = 'demo-7f3a9c21e4b84d0f'
  const [testing, setTesting] = useState(false)
  const [failure, setFailure] = useState<ErrorInfo | null>(null)

  // a failure worth reading (an outside service refused): an alert with the human words and the raw detail to copy
  const test = async () => {
    setTesting(true)
    await new Promise((r) => setTimeout(r, 900))
    setTesting(false)
    setFailure({
      text: 'The server refused the token. Check that it was copied in full and has not been revoked.',
      detail: 'HTTP 401: {"error": {"code": "invalid_token", "message": "token expired at 2026-10-30T12:00:00Z"}}',
    })
  }

  return (
    <Page
      title="Advanced"
      left={
        <button className="nav-button" onClick={onBack}>
          <ChevronLeft size={26} style={{ marginLeft: -6 }} />
          Settings
        </button>
      }
    >
      {/* a segmented control sits on the page background, aligned with the groups below */}
      <div className="section-header" style={{ paddingLeft: 32 }}>
        Sync mode
      </div>
      <Segmented
        id="sync-mode"
        options={[
          { value: 'fast', label: 'Fast' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'careful', label: 'Careful' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <div className="section">
        <div className="section-footer" style={{ paddingTop: 0 }}>
          {mode === 'fast'
            ? 'Checks every minute. Uses more battery and traffic.'
            : mode === 'careful'
              ? 'Checks once an hour and never in the background.'
              : 'Checks every 5 minutes — a good default.'}
        </div>
      </div>

      <div className="section">
        <div className="section-header">Access token</div>
        <div className="group">
          <div className="cell">
            <div className="cell-main">
              <code style={{ fontFamily: 'ui-monospace, SF Mono, Menlo, monospace', fontSize: 15, wordBreak: 'break-all' }}>{token}</code>
            </div>
          </div>
          <button className="cell accent" onClick={async () => toast((await copyText(token)) ? 'Copied' : token)}>
            <Copy size={18} />
            Copy token
          </button>
          <button className="cell accent" disabled={testing} onClick={test}>
            {testing ? <Loader2 size={18} className="spinner" /> : <PlugZap size={18} />}
            Test connection
          </button>
        </div>
        <div className="section-footer">
          Pass it in the <code>Authorization</code> header. Anyone with the token can read your data.
        </div>
      </div>

      <div className="section">
        <div className="section-header">Note</div>
        <div className="group">
          <textarea className="field" placeholder="Anything worth remembering" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="section" style={{ display: 'grid', gap: 10 }}>
        <button className="button" disabled={!note.trim()} onClick={() => toast('Note saved')}>
          Save note
        </button>
        <button className="button secondary" onClick={() => setNote('')}>
          Clear
        </button>
      </div>
      <ErrorAlert error={failure} title="Connection failed" onClose={() => setFailure(null)} />
    </Page>
  )
}
