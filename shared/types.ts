// The contract between the page and our proxy. It mirrors Jev's own request and
// response shapes (https://docs.typesafe.ai/api/system-one) minus `model`, which
// the proxy pins, and minus `box`/images, which the proxy does not forward.

/** Jev accepts a string, object or array wherever it takes prose. */
export type Structured = string | { [key: string]: unknown } | unknown[]

export type NoulQuestion = {
  type: 'noul'
  instructions: Structured
  criteria?: { true?: Structured | null; false?: Structured | null }
}

export type ChoiceQuestion = {
  type: 'choice'
  instructions: Structured
  /** Option name → description. `null` means "judge by the name alone". */
  criteria: Record<string, Structured | null>
}

export type ScoreQuestion = {
  type: 'score'
  instructions: Structured
  /** Ordered level descriptions; a level's score is its index. */
  criteria: Structured[]
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion

export type AskRequest = {
  state: Structured
  questions: Record<string, Question>
  /** Skip the proxy's answer cache and ask Jev anew. */
  fresh?: boolean
}

export type NoulAnswer = { type: 'noul'; noul: number }

export type ChoiceAnswer = {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

export type ScoreAnswer = {
  type: 'score'
  score: number
  confidence: number
  legend: Record<string, Structured>
  probabilities: Record<string, number>
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer

export type AskResponse = {
  /** The versioned model that answered, e.g. "jev-1.14.0". */
  model: string
  answers: Record<string, Answer>
  usage: { input_tokens: number; output_tokens: number }
  /**
   * Added by the proxy. `upstream_ms` is the round trip to TypeSafe measured on the
   * server; `cached` means this is a remembered answer and nothing was sent or billed.
   */
  meta: { upstream_ms: number; cached: boolean }
}

export type ErrorCode =
  | 'bad_request'
  | 'too_large'
  | 'origin'
  | 'rate_limited'
  | 'budget_exhausted'
  | 'not_configured'
  | 'jev_rejected'
  | 'upstream'
  | 'server'

export type ErrorResponse = {
  error: string
  code: ErrorCode
  /** Jev's own explanation, passed through when it rejected the request. */
  detail?: unknown
}

export type Health = {
  ok: true
  configured: boolean
  model: string
  budget: { day: string; usedTokens: number; limitTokens: number }
}

/** USD per million input tokens for Jev 1.13/1.14; output tokens are free. */
export const PRICE_PER_MTOK_USD = 0.042

export function costUsd(inputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICE_PER_MTOK_USD
}
