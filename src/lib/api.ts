import type { AskRequest, AskResponse, ErrorCode, ErrorResponse } from '../../shared/types'

// The only way the page reaches Jev. The API key lives on the proxy, never here.
// Published, the page is on GitHub Pages and the proxy is on another host; in dev
// Vite forwards /api to the local server, so the base is empty.
const API_BASE = import.meta.env.PROD ? 'https://jev.drjivewire.com' : ''

export class ApiError extends Error {
  code: ErrorCode | 'network'
  detail: unknown
  retryAfterSeconds: number | null

  constructor(code: ErrorCode | 'network', message: string, detail?: unknown, retryAfterSeconds: number | null = null) {
    super(message)
    this.code = code
    this.detail = detail
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function ask(request: AskRequest, signal?: AbortSignal): Promise<AskResponse> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError('network', "Couldn't reach the server. Check your connection and try again.")
  }

  if (res.ok) return (await res.json()) as AskResponse

  const body = (await res.json().catch(() => null)) as ErrorResponse | null
  const retryAfter = Number(res.headers.get('retry-after'))
  throw new ApiError(
    body?.code ?? 'server',
    body?.error ?? `The server answered ${res.status}.`,
    body?.detail,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
  )
}
