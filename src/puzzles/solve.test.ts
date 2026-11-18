import { describe, expect, it } from 'vitest'
import type { Answer } from '../../shared/types'
import { CODE_PUZZLES } from './codePuzzles'
import { evaluate, toCode } from './engine'
import { PUZZLES } from './puzzles'
import { compile, toOutcome, toRequest } from './solve'
import type { CardPuzzle } from './types'

describe('compile', () => {
  it('returns the solve function the code defines', async () => {
    const solve = compile('async function solve(text, jev) { return (await jev({ state: text })).length }')
    expect(await solve('abc', async (request) => (request as { state: string }).state)).toBe(3)
  })

  it('explains code that does not parse or has no solve', () => {
    expect(() => compile('async function solve( {')).toThrow(/didn’t run/)
    expect(() => compile('const answer = 42')).toThrow(/function called solve/)
    expect(() => compile('throw new Error("boom")')).toThrow(/didn’t run: boom/)
  })

  it('keeps helpers defined beside solve in scope', async () => {
    const solve = compile('const twice = (n) => n * 2\nfunction solve(text) { return twice(text.length) }')
    expect(await solve('abcd', async () => null)).toBe(8)
  })
})

describe('toOutcome', () => {
  it('accepts a string, a number or a list of strings', () => {
    expect(toOutcome('reply')).toEqual({ ok: true, value: 'reply' })
    expect(toOutcome(0)).toEqual({ ok: true, value: 0 })
    expect(toOutcome([])).toEqual({ ok: true, value: [] })
    expect(toOutcome(['a', 'b'])).toEqual({ ok: true, value: ['a', 'b'] })
  })

  it('says what is wrong with anything else', () => {
    expect(toOutcome(undefined)).toMatchObject({ ok: false, error: expect.stringMatching(/didn’t return anything/) })
    expect(toOutcome(Number.NaN)).toMatchObject({ ok: false })
    expect(toOutcome([1, 2])).toMatchObject({ ok: false, error: expect.stringMatching(/\[1,2\]/) })
    expect(toOutcome({ a: 1 })).toMatchObject({ ok: false })
  })
})

describe('toRequest', () => {
  it('forwards only state and questions', () => {
    const questions = { q: { type: 'noul', instructions: 'Is it?' } }
    expect(toRequest({ state: 'text', questions, fresh: true, model: 'other' })).toEqual({ ok: true, state: 'text', questions })
  })

  it('explains a malformed request', () => {
    expect(toRequest('text')).toMatchObject({ ok: false })
    expect(toRequest({ questions: { q: {} } })).toMatchObject({ ok: false, error: expect.stringMatching(/no state/) })
    expect(toRequest({ state: 'text', questions: [] })).toMatchObject({ ok: false })
    expect(toRequest({ state: 'text', questions: {} })).toMatchObject({ ok: false, error: expect.stringMatching(/no questions/) })
  })
})

describe('the code puzzles', () => {
  it.each(CODE_PUZZLES)('$id has a starter and a solution that compile', (puzzle) => {
    expect(typeof compile(puzzle.starter)).toBe('function')
    expect(typeof compile(puzzle.solution)).toBe('function')
    expect(puzzle.starter).not.toBe(puzzle.solution)
  })

  it('send the request the solution describes', async () => {
    const order = CODE_PUZZLES.find((puzzle) => puzzle.id === 'take-the-order')!
    const requests: { state: string; questions: Record<string, { type: string; criteria?: Record<string, null> }> }[] = []
    const jev = async (request: unknown) => {
      const sent = request as (typeof requests)[number]
      requests.push(sent)
      const answers = Object.fromEntries(
        Object.entries(sent.questions).map(([name, question]) =>
          question.type === 'noul'
            ? [name, { type: 'noul', noul: name === 'pizza' || name === 'garlic_bread' ? 0.99 : 0.02 }]
            : [name, { type: 'choice', choice: Object.keys(question.criteria!)[2] }],
        ),
      )
      return { answers }
    }
    expect(await compile(order.solution)('A large pizza and garlic bread', jev)).toEqual(['pizza: large', 'garlic_bread'])
    // The second request asks only about what the first one found.
    expect(requests).toHaveLength(2)
    expect(Object.keys(requests[1]!.questions)).toEqual(['pizza'])
    expect(await compile(order.starter)('A large pizza and garlic bread', jev)).toEqual(['pizza', 'garlic_bread'])
  })
})

describe('a card puzzle as code', () => {
  const cards = PUZZLES.filter((puzzle): puzzle is CardPuzzle => puzzle.kind === 'cards')
  const noul = (p: number): Answer => ({ type: 'noul', noul: p })

  it.each(cards)('$id: the generated code compiles', (puzzle) => {
    expect(typeof compile(toCode(puzzle, puzzle.starter))).toBe('function')
    expect(typeof compile(toCode(puzzle, puzzle.solution))).toBe('function')
  })

  it('gives the same result as the cards', async () => {
    const answerSets: Record<string, Answer>[] = [
      { product: { type: 'choice', choice: 'desk', confidence: 0.98, probabilities: { desk: 0.98 } }, about_a_product: noul(0.04) },
      { product: { type: 'choice', choice: 'chair', confidence: 1, probabilities: { chair: 1 } }, about_a_product: noul(0.93) },
    ]
    const puzzle = cards.find((candidate) => candidate.id === 'none-of-these')!
    for (const answers of answerSets) {
      const fromCode = await compile(toCode(puzzle, puzzle.solution))('message', async () => ({ answers }))
      expect(fromCode).toBe(evaluate(puzzle, puzzle.solution, answers))
    }

    const toppings = cards.find((candidate) => candidate.id === 'toppings')!
    const yes = { mushrooms: noul(0.98), pepperoni: noul(0.03), olives: noul(0.5), onions: noul(0.07) }
    expect(await compile(toCode(toppings, toppings.solution))('order', async () => ({ answers: yes }))).toEqual(
      evaluate(toppings, toppings.solution, yes),
    )
  })
})
