import { describe, expect, it, vi } from 'vitest'
import { buildApp } from './app'
import { Budget } from './budget'
import { AnswerCache } from './cache'
import { loadEnv, type Env } from './env'
import { RateLimiter } from './limits'

const ORIGIN = 'https://ritchiesking.com'

// Response bodies are checked field by field below, so a loose type is fine here.
const json = (res: Response): Promise<any> => res.json()

const ASK = {
  state: 'I was charged twice this month. Please refund the extra charge.',
  questions: {
    refund: { type: 'noul', instructions: 'Does the customer request a refund?' },
    team: { type: 'choice', instructions: 'Which team?', criteria: { billing: null, technical: 'Bugs and outages' } },
    urgency: { type: 'score', instructions: 'How urgent?', criteria: ['Can wait', 'This week', 'Today'] },
  },
}

const JEV_OK = {
  model: 'jev-1.14.0',
  answers: {
    refund: { type: 'noul', noul: 0.98 },
    team: { type: 'choice', choice: 'billing', confidence: 0.9, probabilities: { billing: 0.95, technical: 0.05 } },
    urgency: {
      type: 'score',
      score: 1.7,
      confidence: 0.55,
      legend: { '0': 'Can wait', '1': 'This week', '2': 'Today' },
      probabilities: { '0': 0.1, '1': 0.1, '2': 0.8 },
    },
  },
  usage: { input_tokens: 120, output_tokens: 12 },
}

function setup(overrides: Partial<Env> = {}, upstream: () => Response = () => Response.json(JEV_OK)) {
  const env = { ...loadEnv({ TYPESAFE_API_KEY: 'test-key' }), ...overrides }
  const budget = new Budget(env.dailyBudgetTokens, null)
  const limiter = new RateLimiter(env.ratePerMinute, env.ratePerDay)
  const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => upstream())
  const cache = new AnswerCache(env.cacheEntries, env.cacheTtlMs)
  const app = buildApp({ env, budget, limiter, cache, fetch: fetchMock })
  const ask = (body: unknown = ASK, headers: Record<string, string> = { origin: ORIGIN }) =>
    app.request('/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  return { app, ask, budget, fetchMock }
}

describe('POST /api/ask', () => {
  it('forwards to Jev with the key and the pinned model, and adds timing', async () => {
    const { ask, fetchMock } = setup()
    const res = await ask({ ...ASK, model: 'something-else', assets: { a: 1 } })
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)

    const body = await json(res)
    expect(body.answers.refund.noul).toBe(0.98)
    expect(body.usage.input_tokens).toBe(120)
    expect(typeof body.meta.upstream_ms).toBe('number')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer test-key')
    const sent = JSON.parse(init!.body as string)
    expect(sent.model).toBe('jev-1.14.0')
    expect(sent.assets).toBeUndefined()
    expect(Object.keys(sent.questions)).toEqual(['refund', 'team', 'urgency'])
  })

  it('answers a repeated request from memory without calling or paying Jev again', async () => {
    const { ask, budget, fetchMock } = setup()
    const first = await json(await ask())
    const second = await json(await ask())
    expect(first.meta.cached).toBe(false)
    expect(second.meta.cached).toBe(true)
    expect(second.answers).toEqual(first.answers)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(budget.snapshot().usedTokens).toBe(120)

    // A different context is a different request.
    await ask({ ...ASK, state: 'Something else entirely.' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('asks Jev again when the page wants a fresh answer', async () => {
    const { ask, fetchMock } = setup()
    await ask()
    const fresh = await json(await ask({ ...ASK, fresh: true }))
    expect(fresh.meta.cached).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string).fresh).toBeUndefined()
  })

  it('still serves remembered answers when the daily budget is spent', async () => {
    const { ask, budget } = setup()
    await ask()
    expect(budget.reserve(budget.limitTokens - budget.snapshot().usedTokens)).toBe(true)
    expect((await ask()).status).toBe(200)
    expect((await ask({ ...ASK, state: 'New context.' })).status).toBe(429)
  })

  it('never returns the key', async () => {
    const { ask } = setup()
    expect(await (await ask()).text()).not.toContain('test-key')
  })

  it('charges the budget what Jev billed, not the estimate', async () => {
    const { ask, budget } = setup()
    await ask()
    expect(budget.snapshot().usedTokens).toBe(120)
  })

  it('refuses other origins and requests with no origin', async () => {
    const { ask, fetchMock } = setup()
    expect((await ask(ASK, { origin: 'https://example.com' })).status).toBe(403)
    expect((await ask(ASK, {})).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows localhost origins for development', async () => {
    const { ask } = setup()
    expect((await ask(ASK, { origin: 'http://localhost:5173' })).status).toBe(200)
  })

  it('rejects malformed questions before spending anything', async () => {
    const { ask, fetchMock } = setup()
    const noOptions = await ask({ state: 'x', questions: { q: { type: 'choice', instructions: 'Which?', criteria: {} } } })
    expect(noOptions.status).toBe(400)
    expect((await json(noOptions)).code).toBe('bad_request')
    expect((await ask({ state: 'x', questions: {} })).status).toBe(400)
    expect((await ask({ state: 'x', questions: { q: { type: 'box', instructions: 'Find it' } } })).status).toBe(400)
    expect((await ask('{not json')).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caps the number of questions and the body size', async () => {
    const { ask } = setup({ maxQuestions: 2, maxBodyBytes: 1000 })
    expect((await ask()).status).toBe(400)
    const big = await ask({ state: 'x'.repeat(2000), questions: { q: ASK.questions.refund } })
    expect(big.status).toBe(413)
  })

  it('says so when no key is configured', async () => {
    const { ask, fetchMock } = setup({ apiKey: undefined })
    const res = await ask()
    expect(res.status).toBe(503)
    expect((await json(res)).code).toBe('not_configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rate-limits a visitor without affecting others', async () => {
    const { ask } = setup({ ratePerMinute: 2 })
    const from = (ip: string) => ask(ASK, { origin: ORIGIN, 'cf-connecting-ip': ip })
    expect((await from('1.1.1.1')).status).toBe(200)
    expect((await from('1.1.1.1')).status).toBe(200)
    const limited = await from('1.1.1.1')
    expect(limited.status).toBe(429)
    expect((await json(limited)).code).toBe('rate_limited')
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await from('2.2.2.2')).status).toBe(200)
  })

  it('stops when the daily budget is spent', async () => {
    const { ask, fetchMock } = setup({ dailyBudgetTokens: 100 })
    // The request is a few hundred bytes, so its 2-bytes-per-token estimate exceeds 100.
    const res = await ask()
    expect(res.status).toBe(429)
    expect((await json(res)).code).toBe('budget_exhausted')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("passes on Jev's explanation when it rejects the questions", async () => {
    const detail = [{ loc: ['body', 'questions', 'team'], msg: 'bad criteria', type: 'value_error' }]
    const { ask, budget } = setup({}, () => Response.json({ detail }, { status: 422 }))
    const res = await ask()
    expect(res.status).toBe(422)
    expect(await json(res)).toMatchObject({ code: 'jev_rejected', detail })
    expect(budget.snapshot().usedTokens).toBe(0)
  })

  it('hides auth failures and reports overload as retryable', async () => {
    const unauthorized = setup({}, () => Response.json({ detail: 'Invalid API key test-key' }, { status: 401 }))
    const res = await unauthorized.ask()
    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain('test-key')

    const busy = setup({}, () => Response.json({ detail: 'overloaded' }, { status: 529, headers: { 'retry-after': '3' } }))
    const res2 = await busy.ask()
    expect(res2.status).toBe(503)
    expect(res2.headers.get('retry-after')).toBe('3')
  })
})

describe('GET /api/health', () => {
  it('reports configuration and budget without the key', async () => {
    const { app } = setup()
    const res = await app.request('/api/health')
    const body = await json(res)
    expect(body).toMatchObject({ ok: true, configured: true, model: 'jev-1.14.0' })
    expect(body.budget.limitTokens).toBe(5_952_380)
    expect(JSON.stringify(body)).not.toContain('test-key')
  })
})
