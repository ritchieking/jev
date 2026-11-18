import { describe, expect, it } from 'vitest'
import type { Answer } from '../../shared/types'
import { evaluate, matches, toCode, toQuestions, validate } from './engine'
import { PUZZLES } from './puzzles'
import type { CardPuzzle, Program } from './types'

const CARD_PUZZLES = PUZZLES.filter((candidate): candidate is CardPuzzle => candidate.kind === 'cards')
const puzzle = (id: string): CardPuzzle => CARD_PUZZLES.find((candidate) => candidate.id === id)!
const noul = (p: number): Answer => ({ type: 'noul', noul: p })
const choice = (pick: string, p: number): Answer => ({ type: 'choice', choice: pick, confidence: p, probabilities: { [pick]: p } })

describe('the shipped puzzles', () => {
  it.each(CARD_PUZZLES)('$id has a valid starter and solution', (shipped) => {
    expect(validate(shipped, shipped.starter)).toEqual([])
    expect(validate(shipped, shipped.solution)).toEqual([])
  })

  it.each(CARD_PUZZLES)('$id only expects results it can produce', (shipped) => {
    for (const testCase of shipped.cases) {
      if (shipped.result.kind === 'one') {
        expect(shipped.result.outcomes.map((outcome) => outcome.id)).toContain(testCase.expected)
      } else {
        for (const item of testCase.expected as string[]) expect(shipped.result.items).toContain(item)
      }
    }
  })

  it('have unique ids', () => {
    expect(new Set(PUZZLES.map((shipped) => shipped.id)).size).toBe(PUZZLES.length)
  })
})

describe('toQuestions', () => {
  it('builds the request Jev receives', () => {
    expect(toQuestions(puzzle('none-of-these').solution)).toEqual({
      product: {
        type: 'choice',
        instructions: 'Which product is this message about?',
        criteria: { desk: 'The standing desk', chair: 'The office chair', monitor_arm: 'The monitor arm' },
      },
      about_a_product: {
        type: 'noul',
        instructions: 'Is this message about one of the three products we sell: the standing desk, the office chair or the monitor arm?',
      },
    })
  })

  it('sends an option with no description as null, so Jev judges it by name', () => {
    expect(toQuestions(puzzle('toppings').starter).topping).toMatchObject({ criteria: { mushrooms: null, onions: null } })
  })
})

describe('evaluate', () => {
  it('applies the first rule that holds, then the fallback', () => {
    const p = puzzle('none-of-these')
    expect(evaluate(p, p.solution, { product: choice('desk', 0.98), about_a_product: noul(0.04) })).toBe('none')
    expect(evaluate(p, p.solution, { product: choice('desk', 0.98), about_a_product: noul(0.93) })).toBe('desk')
    expect(evaluate(p, p.starter, { product: choice('desk', 0.98) })).toBe('desk')
  })

  it('treats the cutoff as inclusive', () => {
    const p = puzzle('needs-reply')
    expect(evaluate(p, p.solution, { needs_reply: noul(0.5) })).toBe('reply')
    expect(evaluate(p, p.solution, { needs_reply: noul(0.49) })).toBe('no_reply')
  })

  it('compares a choice by how sure it is of its pick, or by what it picked', () => {
    const p = puzzle('none-of-these')
    const unsure: Program = {
      ...p.starter,
      rules: [
        { uid: 'a', when: { question: 'product', op: 'lt', value: 0.9 }, then: { kind: 'outcome', outcome: 'none' } },
        { uid: 'b', when: { question: 'product', op: 'picks', option: 'chair' }, then: { kind: 'outcome', outcome: 'chair' } },
      ],
      otherwise: { kind: 'outcome', outcome: 'desk' },
    }
    expect(validate(p, unsure)).toEqual([])
    expect(evaluate(p, unsure, { product: choice('desk', 0.78) })).toBe('none')
    expect(evaluate(p, unsure, { product: choice('chair', 0.95) })).toBe('chair')
    expect(evaluate(p, unsure, { product: choice('monitor_arm', 0.95) })).toBe('desk')
  })

  it('collects every yes for a set puzzle, and a choice adds its one pick', () => {
    const p = puzzle('toppings')
    const answers = { mushrooms: noul(0.98), pepperoni: noul(0.03), olives: noul(0.5), onions: noul(0.07) }
    expect(evaluate(p, p.solution, answers)).toEqual(['mushrooms', 'olives'])
    expect(evaluate(p, p.starter, { topping: choice('onions', 0.38) })).toEqual(['onions'])
  })

  it('has no result until every answer it needs is there', () => {
    const p = puzzle('toppings')
    expect(evaluate(p, p.solution, { mushrooms: noul(0.98) })).toBeUndefined()
    expect(evaluate(puzzle('needs-reply'), puzzle('needs-reply').solution, {})).toBeUndefined()
  })
})

describe('matches', () => {
  it('ignores order for sets and requires the same members', () => {
    expect(matches(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(matches(['a'], ['a', 'b'])).toBe(false)
    expect(matches([], [])).toBe(true)
    expect(matches('reply', 'reply')).toBe(true)
    expect(matches('reply', ['reply'])).toBe(false)
    expect(matches(3, 3)).toBe(true)
    expect(matches(3, 4)).toBe(false)
    expect(matches(3, '3')).toBe(false)
  })
})

describe('validate', () => {
  const p = puzzle('none-of-these')
  const withQuestions = (edit: (program: Program) => Program) => validate(p, edit(structuredClone(p.solution)))

  it('explains what is wrong with a question', () => {
    expect(withQuestions((program) => ({ ...program, questions: [] }))[0]).toMatch(/at least one question/)
    expect(withQuestions((program) => ((program.questions[1]!.name = 'About Product'), program))[0]).toMatch(/lowercase/)
    expect(withQuestions((program) => ((program.questions[1]!.name = 'product'), program))[0]).toMatch(/Names have to be different/)
    expect(withQuestions((program) => ((program.questions[1]!.instructions = '  '), program))[0]).toMatch(/no question text/)
    expect(withQuestions((program) => ((program.questions[0]!.options = program.questions[0]!.options.slice(0, 1)), program))).toContainEqual(
      expect.stringMatching(/at least two options/),
    )
  })

  it('catches rules left pointing at something that changed', () => {
    expect(withQuestions((program) => ({ ...program, questions: program.questions.slice(0, 1) }))).toContainEqual(
      expect.stringMatching(/Rule 1 refers to a question that was removed/),
    )
    expect(withQuestions((program) => ((program.questions[0]!.type = 'noul'), program))).toContainEqual(
      expect.stringMatching(/otherwise.*no longer a choice/),
    )
  })
})

describe('toCode', () => {
  it('writes the rules as the code around one request', () => {
    const p = puzzle('none-of-these')
    const code = toCode(p, p.solution)
    expect(code).toContain('async function solve(message, jev) {')
    expect(code).toContain('state: message,')
    expect(code).toContain('      about_a_product: {\n        type: "noul",')
    expect(code).toContain(`if (answers.about_a_product.noul < 0.5) return "none"`)
    expect(code).toContain('return answers.product.choice')
  })

  it('writes a set puzzle as a loop over the yes-or-no questions', () => {
    const p = puzzle('toppings')
    const code = toCode(p, p.solution)
    expect(code).toContain('for (const name of ["mushrooms","pepperoni","olives","onions"]) {')
    expect(code).toContain('if (answers[name].noul >= 0.5) toppings.push(name)')
    expect(toCode(p, p.starter)).toContain('toppings.push(answers.topping.choice)')
  })
})
