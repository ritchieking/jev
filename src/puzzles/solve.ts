import type { Outcome } from './types'

// The parts of code mode that don't need a browser: turning the learner's text into
// a function, and checking what it returned. The worker and `npm run check-puzzles`
// both use these, so a solution behaves the same in the page and in the check.

/** Sends one request to Jev and resolves to its response. */
export type JevFn = (request: unknown) => Promise<unknown>
export type SolveFn = (input: string, jev: JevFn) => unknown

/**
 * Compiles code that defines `solve(input, jev)`. Throws with a readable message if
 * the code doesn't parse or doesn't define the function.
 */
export function compile(code: string): SolveFn {
  let solve: unknown
  try {
    solve = new Function(`"use strict";\n${code}\n;return typeof solve === "function" ? solve : undefined`)()
  } catch (err) {
    throw new Error(`The code didn’t run: ${message(err)}`)
  }
  if (typeof solve !== 'function') throw new Error('The code has to define a function called solve.')
  return solve as SolveFn
}

/** What `solve` returned, as a result that can be compared, or why it can't be. */
export function toOutcome(value: unknown): { ok: true; value: Outcome } | { ok: false; error: string } {
  if (typeof value === 'string') return { ok: true, value }
  if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, value }
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return { ok: true, value: value as string[] }
  if (value === undefined) return { ok: false, error: 'solve didn’t return anything.' }
  return { ok: false, error: `solve returned ${preview(value)}, which isn’t a string, a number or a list of strings.` }
}

export function message(err: unknown): string {
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : 'Something went wrong.'
}

function preview(value: unknown): string {
  let text: string
  try {
    text = JSON.stringify(value) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

/** `{ state, questions }` from whatever the learner's code passed to `jev`, or why it isn't a request. */
export function toRequest(value: unknown): { ok: true; state: unknown; questions: Record<string, unknown> } | { ok: false; error: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'jev() takes one object: { state, questions }.' }
  }
  const { state, questions } = value as { state?: unknown; questions?: unknown }
  if (state === undefined || state === null) return { ok: false, error: 'The request has no state. Pass the text Jev should read.' }
  if (questions === null || typeof questions !== 'object' || Array.isArray(questions)) {
    return { ok: false, error: 'The request’s questions have to be an object: a name for each question, and the question.' }
  }
  if (Object.keys(questions).length === 0) return { ok: false, error: 'The request has no questions.' }
  // Only these two fields are forwarded, so code can't set proxy options such as `fresh`.
  return { ok: true, state, questions: questions as Record<string, unknown> }
}
