import { z } from 'zod'
import type { AskRequest } from '../shared/types'

// Jev takes a string, object or array wherever it takes prose.
const structured = z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())])

const noul = z.object({
  type: z.literal('noul'),
  instructions: structured,
  criteria: z
    .object({ true: structured.nullable().optional(), false: structured.nullable().optional() })
    .optional(),
})

const choice = z.object({
  type: z.literal('choice'),
  instructions: structured,
  criteria: z.record(structured.nullable()).refine(
    (options) => {
      const count = Object.keys(options).length
      return count >= 1 && count <= 255
    },
    { message: 'A choice needs between 1 and 255 options' },
  ),
})

const score = z.object({
  type: z.literal('score'),
  instructions: structured,
  criteria: z.array(structured).min(2).max(10),
})

// `box` is deliberately absent: it needs images, which this proxy does not forward.
const question = z.discriminatedUnion('type', [noul, choice, score])

/** Unknown top-level keys (`model`, `assets`) are dropped: the proxy picks the model. */
export function askSchema(maxQuestions: number) {
  return z.object({
    state: structured,
    questions: z.record(question).refine(
      (questions) => {
        const count = Object.keys(questions).length
        return count >= 1 && count <= maxQuestions
      },
      { message: `Send between 1 and ${maxQuestions} questions` },
    ),
  })
}

export function parseAsk(body: unknown, maxQuestions: number): AskRequest {
  return askSchema(maxQuestions).parse(body)
}
