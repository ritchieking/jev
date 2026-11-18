import type { Answer, Question } from '../../shared/types'
import type { CardPuzzle, CardQuestion, Condition, Outcome, Program, Result } from './types'

export const MAX_QUESTIONS = 12
export const MAX_OPTIONS = 12
export const MAX_LEVELS = 10

const NAME = /^[a-z][a-z0-9_]*$/

/** Problems that stop a program from being sent or evaluated, in plain words. Empty means fine. */
export function validate(puzzle: CardPuzzle, program: Program): string[] {
  const problems: string[] = []
  const { questions } = program

  if (questions.length === 0) problems.push('Add at least one question.')
  if (questions.length > MAX_QUESTIONS) problems.push(`Use at most ${MAX_QUESTIONS} questions.`)

  const seen = new Set<string>()
  for (const question of questions) {
    const label = question.name ? `“${question.name}”` : 'A question'
    if (!NAME.test(question.name)) {
      problems.push(`${label} needs a name made of lowercase letters, digits and underscores, starting with a letter.`)
    } else if (seen.has(question.name)) {
      problems.push(`Two questions are named “${question.name}”. Names have to be different.`)
    }
    seen.add(question.name)
    if (question.instructions.trim() === '') problems.push(`${label} has no question text.`)

    if (question.type === 'choice') {
      const names = question.options.map((option) => option.name.trim())
      if (names.length < 2) problems.push(`${label} needs at least two options.`)
      if (names.length > MAX_OPTIONS) problems.push(`${label} can have at most ${MAX_OPTIONS} options.`)
      if (names.some((name) => name === '')) problems.push(`${label} has an option with no name.`)
      if (new Set(names).size !== names.length) problems.push(`${label} has two options with the same name.`)
    }
    if (question.type === 'score') {
      if (question.levels.length < 2) problems.push(`${label} needs at least two levels.`)
      if (question.levels.length > MAX_LEVELS) problems.push(`${label} can have at most ${MAX_LEVELS} levels.`)
      if (question.levels.some((level) => level.trim() === '')) problems.push(`${label} has a level with no description.`)
    }
  }

  if (puzzle.result.kind === 'one') {
    const byUid = new Map(questions.map((question) => [question.uid, question]))
    const checkResult = (result: Result, where: string) => {
      if (result.kind === 'pick' && byUid.get(result.question)?.type !== 'choice') {
        problems.push(`${where} uses the pick of a question that is no longer a choice.`)
      }
    }
    program.rules.forEach((rule, index) => {
      const where = `Rule ${index + 1}`
      const question = byUid.get(rule.when.question)
      if (!question) {
        problems.push(`${where} refers to a question that was removed.`)
      } else if (rule.when.op === 'picks') {
        const wanted = rule.when.option
        if (question.type !== 'choice') problems.push(`${where} checks a pick, but “${question.name}” is not a choice.`)
        else if (!question.options.some((option) => option.name.trim() === wanted)) {
          problems.push(`${where} checks for an option that “${question.name}” doesn’t have.`)
        }
      } else if (!Number.isFinite(rule.when.value)) {
        problems.push(`${where} needs a number to compare with.`)
      }
      checkResult(rule.then, where)
    })
    checkResult(program.otherwise, 'The “otherwise” rule')
  } else if (!(program.threshold >= 0 && program.threshold <= 1)) {
    problems.push('The cutoff has to be between 0 and 1.')
  }

  return problems
}

/** The `questions` object of the request, exactly as Jev receives it. */
export function toQuestions(program: Program): Record<string, Question> {
  return Object.fromEntries(program.questions.map((question) => [question.name, toQuestion(question)]))
}

function toQuestion(question: CardQuestion): Question {
  const instructions = question.instructions.trim()
  switch (question.type) {
    case 'noul':
      return { type: 'noul', instructions }
    case 'choice':
      return {
        type: 'choice',
        instructions,
        // No description means Jev judges the option by its name alone.
        criteria: Object.fromEntries(question.options.map((option) => [option.name.trim(), option.description.trim() || null])),
      }
    case 'score':
      return { type: 'score', instructions, criteria: question.levels.map((level) => level.trim()) }
  }
}

/** The number a rule compares: see `Condition`. */
function measure(answer: Answer): number {
  switch (answer.type) {
    case 'noul':
      return answer.noul
    case 'score':
      return answer.score
    case 'choice':
      return answer.probabilities[answer.choice] ?? 0
  }
}

function holds(condition: Condition, answer: Answer): boolean {
  if (condition.op === 'picks') return answer.type === 'choice' && answer.choice === condition.option
  return condition.op === 'gte' ? measure(answer) >= condition.value : measure(answer) < condition.value
}

/**
 * Turns Jev's answers into the program's result for one input. This is the part of
 * a solution that is ordinary code: it costs nothing and needs no request.
 * Returns undefined if an answer the rules need is missing.
 */
export function evaluate(puzzle: CardPuzzle, program: Program, answers: Record<string, Answer>): Outcome | undefined {
  const byUid = new Map(program.questions.map((question) => [question.uid, question]))
  const answerTo = (uid: string) => {
    const question = byUid.get(uid)
    return question ? answers[question.name] : undefined
  }

  if (puzzle.result.kind === 'set') {
    const items: string[] = []
    for (const question of program.questions) {
      const answer = answers[question.name]
      if (!answer) return undefined
      if (answer.type === 'noul' && answer.noul >= program.threshold) items.push(question.name)
      if (answer.type === 'choice') items.push(answer.choice)
    }
    return [...new Set(items)]
  }

  const resolve = (result: Result): string | undefined => {
    if (result.kind === 'outcome') return result.outcome
    const answer = answerTo(result.question)
    return answer?.type === 'choice' ? answer.choice : undefined
  }
  for (const rule of program.rules) {
    const answer = answerTo(rule.when.question)
    if (!answer) return undefined
    if (holds(rule.when, answer)) return resolve(rule.then)
  }
  return resolve(program.otherwise)
}

export function matches(result: Outcome, expected: Outcome): boolean {
  if (typeof result !== 'object' || typeof expected !== 'object') return result === expected
  return result.length === expected.length && result.every((item) => expected.includes(item))
}

/** The program as the JavaScript a developer would write around one Jev request. */
export function toCode(puzzle: CardPuzzle, program: Program): string {
  const byUid = new Map(program.questions.map((question) => [question.uid, question]))
  const name = (uid: string) => byUid.get(uid)?.name ?? 'missing'
  const questions = literal(toQuestions(program), 2)

  const lines = [
    `async function solve(${puzzle.input}, jev) {`,
    `  const { answers } = await jev({`,
    `    state: ${puzzle.input},`,
    `    questions: ${questions},`,
    `  })`,
    ``,
  ]

  if (puzzle.result.kind === 'set') {
    const nouls = program.questions.filter((question) => question.type === 'noul').map((question) => question.name)
    const choices = program.questions.filter((question) => question.type === 'choice').map((question) => question.name)
    lines.push(`  const ${puzzle.result.noun} = []`)
    if (nouls.length > 0) {
      lines.push(`  for (const name of ${JSON.stringify(nouls)}) {`)
      lines.push(`    if (answers[name].noul >= ${program.threshold}) ${puzzle.result.noun}.push(name)`)
      lines.push(`  }`)
    }
    for (const choice of choices) lines.push(`  ${puzzle.result.noun}.push(answers.${choice}.choice)`)
    lines.push(`  return ${puzzle.result.noun}`)
  } else {
    const value = (result: Result) =>
      result.kind === 'outcome' ? JSON.stringify(result.outcome) : `answers.${name(result.question)}.choice`
    const test = (condition: Condition) => {
      const question = byUid.get(condition.question)
      const ref = `answers.${question?.name ?? 'missing'}`
      if (condition.op === 'picks') return `${ref}.choice === ${JSON.stringify(condition.option)}`
      const compare = condition.op === 'gte' ? '>=' : '<'
      if (question?.type === 'choice') return `${ref}.probabilities[${ref}.choice] ${compare} ${condition.value}`
      return `${ref}.${question?.type === 'score' ? 'score' : 'noul'} ${compare} ${condition.value}`
    }
    for (const rule of program.rules) lines.push(`  if (${test(rule.when)}) return ${value(rule.then)}`)
    lines.push(`  return ${value(program.otherwise)}`)
  }
  lines.push(`}`)
  return lines.join('\n')
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** A value as a JavaScript literal: like JSON, but with bare keys where they are valid. */
function literal(value: unknown, depth: number): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  const pad = '  '.repeat(depth + 1)
  const end = '  '.repeat(depth)
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map((item) => `${pad}${literal(item, depth + 1)},`).join('\n')}\n${end}]`
  }
  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'
  return `{\n${entries
    .map(([key, item]) => `${pad}${IDENTIFIER.test(key) ? key : JSON.stringify(key)}: ${literal(item, depth + 1)},`)
    .join('\n')}\n${end}}`
}
