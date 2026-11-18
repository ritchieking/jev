import type { AskRequest, AskResponse } from '../../shared/types'
import { ApiError } from '../lib/api'
import { toRequest } from './solve'

// The page's side of code mode. The learner's code runs in a worker (sandbox.worker.ts);
// every request it wants to make arrives here, where it is counted, capped and sent
// through the same proxy as everything else on the page.

export type ToWorker =
  | { type: 'start'; code: string; cases: { id: string; input: string }[] }
  | { type: 'answer'; callId: number; ok: true; response: AskResponse }
  | { type: 'answer'; callId: number; ok: false; error: string }

export type FromWorker =
  | { type: 'ask'; caseId: string; callId: number; request: unknown }
  | { type: 'result'; caseId: string; ok: true; value: unknown }
  | { type: 'result'; caseId: string; ok: false; error: string }
  | { type: 'log'; text: string }
  | { type: 'fatal'; error: string }
  | { type: 'finished' }

/** One request the code made, and what came back. */
export type Step = { request: AskRequest; response?: AskResponse; error?: string }

export type CaseRun = {
  steps: Step[]
  /** What `solve` returned or threw for this input. */
  outcome: { ok: true; value: unknown } | { ok: false; error: string }
}

export type RunResult = {
  cases: Record<string, CaseRun>
  logs: string[]
  /** Set when the code couldn't start at all, e.g. a syntax error. */
  fatal?: string
}

export const MAX_REQUESTS_PER_CASE = 25
export const TIMEOUT_MS = 30_000
const MAX_LOG_LINES = 200

type Options = {
  ask: (request: AskRequest) => Promise<AskResponse>
  createWorker?: () => Worker
  timeoutMs?: number
}

const createSandboxWorker = () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })

/** Runs `code` once per case, all at the same time, and resolves when every case has finished or time is up. */
export function runCode(code: string, cases: { id: string; input: string }[], options: Options): Promise<RunResult> {
  const { ask, createWorker = createSandboxWorker, timeoutMs = TIMEOUT_MS } = options

  return new Promise((resolve) => {
    const worker = createWorker()
    const steps = new Map<string, Step[]>(cases.map((testCase) => [testCase.id, []]))
    const outcomes = new Map<string, CaseRun['outcome']>()
    const logs: string[] = []
    let done = false

    const finish = (fatal?: string, unfinished = 'This didn’t finish.') => {
      if (done) return
      done = true
      clearTimeout(timer)
      worker.terminate()
      const result: RunResult = { cases: {}, logs, fatal }
      for (const testCase of cases) {
        result.cases[testCase.id] = {
          steps: steps.get(testCase.id) ?? [],
          outcome: outcomes.get(testCase.id) ?? { ok: false, error: unfinished },
        }
      }
      resolve(result)
    }

    const timer = setTimeout(
      () => finish(undefined, `Stopped after ${Math.round(timeoutMs / 1000)} seconds. Is there a loop that never ends?`),
      timeoutMs,
    )

    const send = (outgoing: ToWorker) => {
      if (!done) worker.postMessage(outgoing)
    }

    worker.onerror = (event) => finish(event.message || 'The code stopped unexpectedly.')

    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const incoming = event.data
      switch (incoming.type) {
        case 'log':
          if (logs.length < MAX_LOG_LINES) logs.push(incoming.text)
          return
        case 'fatal':
          finish(incoming.error)
          return
        case 'finished':
          finish()
          return
        case 'result':
          outcomes.set(incoming.caseId, incoming.ok ? { ok: true, value: incoming.value } : { ok: false, error: incoming.error })
          return
        case 'ask': {
          const { callId } = incoming
          const made = steps.get(incoming.caseId)
          const parsed = toRequest(incoming.request)
          if (!made || !parsed.ok) {
            send({ type: 'answer', callId, ok: false, error: parsed.ok ? 'Unknown input.' : parsed.error })
            return
          }
          if (made.length >= MAX_REQUESTS_PER_CASE) {
            send({ type: 'answer', callId, ok: false, error: `That’s more than ${MAX_REQUESTS_PER_CASE} requests for one input, which is the limit here.` })
            return
          }
          const step: Step = { request: { state: parsed.state, questions: parsed.questions } as AskRequest }
          made.push(step)
          ask(step.request).then(
            (response) => {
              step.response = response
              send({ type: 'answer', callId, ok: true, response })
            },
            (err: unknown) => {
              step.error = describe(err)
              send({ type: 'answer', callId, ok: false, error: step.error })
            },
          )
        }
      }
    }

    send({ type: 'start', code, cases })
  })
}

/** An error from the proxy, in words that make sense inside the learner's code. */
export function describe(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Something went wrong sending the request.'
  if (err.code === 'not_configured') return 'The server doesn’t have a Jev key yet, so live answers are off.'
  if (err.retryAfterSeconds) return `${err.message} Try again in ${err.retryAfterSeconds}s.`
  const detail = typeof err.detail === 'string' ? err.detail : err.detail ? JSON.stringify(err.detail) : ''
  if ((err.code === 'jev_rejected' || err.code === 'bad_request') && detail) return `${err.message} ${detail}`
  return err.message
}
