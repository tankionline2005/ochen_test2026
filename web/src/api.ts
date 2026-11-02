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

export const api = {
  // example: items: () => request<Item[]>('GET', '/api/items'),
}
