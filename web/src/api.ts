/**
 * Thin fetch wrapper for a JSON backend. The demo screens use lib/demo.ts instead;
 * replace those calls with `api.*` methods as the real backend appears.
 *
 * Errors: the backend should answer with {"detail": "human-readable message"} — that text is
 * shown to the user as is (toast or inline), so write it for people, not for logs.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Listener = () => void
const unauthorizedListeners = new Set<Listener>()

/** Called on any 401 — App uses it to drop back to the login screen. */
export function onUnauthorized(fn: Listener) {
  unauthorizedListeners.add(fn)
  return () => {
    unauthorizedListeners.delete(fn)
  }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  if (res.status === 401) unauthorizedListeners.forEach((fn) => fn())
  if (!res.ok) {
    let message = `Error ${res.status}`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (Array.isArray(data.detail) && data.detail[0]?.msg) message = data.detail[0].msg
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, message)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

/** What the server streams while the model works on a metaphor (server/app.py). */
export type ComposeEvent =
  | { type: 'stage'; stage: 'queued' | 'sent' | 'thinking' | 'answer'; text?: string }
  | { type: 'thinking'; text: string }
  | { type: 'result'; picks: { id: string; state: 'main' | 'bg' }[]; title?: string; reason?: string; model?: string; seconds?: number }
  | { type: 'error'; detail: string }

/**
 * POST /api/compose and read the server-sent events as they come (EventSource can't POST). Resolves when the stream
 * ends; `onEvent` gets every event on the way.
 */
export async function composeStream(
  body: { prompt: string; mode: 'meaning' | 'names' },
  onEvent: (e: ComposeEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/compose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    let message = `Сервер ответил ${res.status}`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, message)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let cut
    while ((cut = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, cut)
      buf = buf.slice(cut + 2)
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (data) onEvent(JSON.parse(data) as ComposeEvent)
    }
  }
}
