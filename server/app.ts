import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import type { AskResponse, ErrorCode, ErrorResponse, Health } from '../shared/types'
import type { Budget } from './budget'
import type { Env } from './env'
import type { RateLimiter } from './limits'
import { parseAsk } from './validation'

export type Deps = {
  env: Env
  budget: Budget
  limiter: RateLimiter
  fetch: typeof fetch
}

const UPSTREAM_TIMEOUT_MS = 20_000

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

/** A page on another site can't claim a localhost origin, so dev origins are safe to allow. */
function originAllowed(origin: string | undefined, env: Env): origin is string {
  if (!origin) return false
  return env.allowedOrigins.includes(origin) || LOCALHOST.test(origin)
}

function fail(c: Context, status: ContentfulStatusCode, code: ErrorCode, error: string, detail?: unknown) {
  const body: ErrorResponse = detail === undefined ? { error, code } : { error, code, detail }
  return c.json(body, status)
}

export function buildApp({ env, budget, limiter, fetch: fetchImpl }: Deps): Hono {
  const app = new Hono()

  app.use(
    '/api/*',
    cors({
      origin: (origin) => (originAllowed(origin, env) ? origin : null),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['content-type'],
      exposeHeaders: ['retry-after'],
      maxAge: 86_400,
    }),
  )

  app.get('/api/health', (c) => {
    const { day, usedTokens, limitTokens } = budget.snapshot()
    const health: Health = {
      ok: true,
      configured: env.apiKey !== undefined,
      model: env.model,
      budget: { day, usedTokens, limitTokens },
    }
    return c.json(health)
  })

  app.post('/api/ask', async (c) => {
    // Browsers send Origin on every POST. This keeps other sites' pages off the proxy;
    // the rate limit and daily budget are what bound a script that fakes the header.
    if (!originAllowed(c.req.header('origin'), env)) {
      return fail(c, 403, 'origin', 'This endpoint only serves the Jev explainer.')
    }

    // Only cloudflared can reach this port, so its client-IP header can be trusted.
    const visitor = c.req.header('cf-connecting-ip') ?? 'local'
    const retryAfter = limiter.take(visitor)
    if (retryAfter !== null) {
      c.header('retry-after', String(retryAfter))
      return fail(c, 429, 'rate_limited', 'Too many requests. Give it a moment.')
    }

    const raw = await c.req.text()
    const bytes = Buffer.byteLength(raw)
    if (bytes > env.maxBodyBytes) {
      return fail(c, 413, 'too_large', `Requests are capped at ${env.maxBodyBytes} bytes.`)
    }

    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return fail(c, 400, 'bad_request', 'The request body is not valid JSON.')
    }
    const ask = parseAsk(json, env.maxQuestions)

    if (!env.apiKey) {
      return fail(c, 503, 'not_configured', 'The proxy has no Jev API key yet.')
    }

    // Tokens aren't known until Jev answers. Two bytes per token overestimates
    // English and JSON, which is the safe direction for a spending cap.
    const estimate = Math.ceil(bytes / 2)
    if (!budget.reserve(estimate)) {
      return fail(c, 429, 'budget_exhausted', "Today's shared Jev budget is used up. It resets at midnight UTC.")
    }

    let billed = 0
    try {
      const started = performance.now()
      let upstream: Response
      try {
        upstream = await fetchImpl(`${env.endpoint}/v1/systemone`, {
          method: 'POST',
          headers: { authorization: `Bearer ${env.apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ model: env.model, state: ask.state, questions: ask.questions }),
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
      } catch (err) {
        console.error('Jev unreachable:', err instanceof Error ? err.message : err)
        return fail(c, 502, 'upstream', 'Could not reach Jev.')
      }
      const upstreamMs = Math.round(performance.now() - started)
      const payload: unknown = await upstream.json().catch(() => null)

      if (upstream.ok) {
        const parsed = jevResponse.safeParse(payload)
        if (!parsed.success) {
          console.error('Unexpected Jev response shape:', parsed.error.issues[0]?.message)
          return fail(c, 502, 'upstream', 'Jev sent back something unexpected.')
        }
        billed = parsed.data.usage.input_tokens
        console.log(`ask ok questions=${Object.keys(ask.questions).length} in=${billed} ms=${upstreamMs}`)
        const body = { ...parsed.data, meta: { upstream_ms: upstreamMs } } as AskResponse
        return c.json(body)
      }

      const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : undefined
      // Jev's validation and context-limit errors are about the visitor's questions, so pass them on.
      if (upstream.status === 400 || upstream.status === 422) {
        return fail(c, 422, 'jev_rejected', 'Jev rejected this request.', detail)
      }
      if (upstream.status === 413) {
        return fail(c, 413, 'too_large', 'That request is too large for Jev.')
      }
      if (upstream.status === 429 || upstream.status === 529) {
        const wait = upstream.headers.get('retry-after')
        if (wait) c.header('retry-after', wait)
        return fail(c, 503, 'upstream', 'Jev is busy. Try again shortly.')
      }
      // 401 and anything else is our problem (bad key, outage), not the visitor's.
      console.error(`Jev answered ${upstream.status}:`, JSON.stringify(detail ?? payload)?.slice(0, 500))
      return fail(c, 502, 'upstream', 'Jev returned an error.')
    } finally {
      budget.settle(estimate, billed)
    }
  })

  app.notFound((c) => fail(c, 404, 'bad_request', 'Not found.'))

  app.onError((err, c) => {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0]
      const where = issue?.path.join('.') || 'request'
      return fail(c, 400, 'bad_request', `${where}: ${issue?.message ?? 'invalid'}`)
    }
    console.error(err instanceof Error ? (err.stack ?? err.message) : err)
    return fail(c, 500, 'server', 'Something went wrong.')
  })

  return app
}

// Just enough checking to trust the fields the proxy and page rely on.
const jevResponse = z.object({
  model: z.string(),
  answers: z.record(z.object({ type: z.string() }).passthrough()),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
})
