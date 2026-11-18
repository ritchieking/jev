// Checks every puzzle against the real model: its starter has to get at least one
// case wrong, and its reference solution has to get them all right. Goes through the
// local proxy, whose cache makes a repeat run free unless a puzzle changed.
//
//   npm run check-puzzles              all puzzles
//   npm run check-puzzles -- toppings  just one

import type { AskRequest, AskResponse } from '../shared/types'
import { evaluate, matches, toQuestions, validate } from '../src/puzzles/engine'
import { PUZZLES } from '../src/puzzles/puzzles'
import { compile, toOutcome } from '../src/puzzles/solve'
import type { CardPuzzle, CodePuzzle, Outcome, Program } from '../src/puzzles/types'

const PROXY = process.env.JEV_PROXY ?? 'http://127.0.0.1:8686'
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))

let sent = 0
let tokens = 0

async function ask(request: AskRequest): Promise<AskResponse> {
  // The proxy's per-visitor rate limit applies to this script too. A full run is about
  // as many requests as it allows in a minute, so wait and carry on rather than fail.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${PROXY}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost' },
      body: JSON.stringify(request),
    })
    if (res.status === 429 && attempt < 5) {
      const seconds = Number(res.headers.get('retry-after')) || 10
      await new Promise((resolve) => setTimeout(resolve, (seconds + 1) * 1000))
      continue
    }
    if (!res.ok) throw new Error(`Proxy answered ${res.status}: ${await res.text()}`)
    const response = (await res.json()) as AskResponse
    if (!response.meta.cached) {
      sent += 1
      tokens += response.usage.input_tokens
    }
    return response
  }
}

const brief = (answers: AskResponse['answers']) =>
  Object.entries(answers)
    .map(([name, answer]) =>
      answer.type === 'noul'
        ? `${name}=${answer.noul}`
        : answer.type === 'choice'
          ? `${name}=${answer.choice}@${answer.probabilities[answer.choice]}`
          : `${name}=${answer.score}`,
    )
    .join(' ')

const show = (value: unknown) => (Array.isArray(value) ? `{${value.join(', ')}}` : String(value))

async function run(puzzle: CardPuzzle, program: Program, label: string): Promise<number> {
  const problems = validate(puzzle, program)
  if (problems.length > 0) throw new Error(`${puzzle.id} ${label} is invalid: ${problems.join(' ')}`)
  const questions = toQuestions(program)
  let wrong = 0
  console.log(`\n${puzzle.id} · ${label}`)
  for (const testCase of puzzle.cases) {
    const { answers } = await ask({ state: testCase.state, questions })
    const result = evaluate(puzzle, program, answers)
    const ok = result !== undefined && matches(result, testCase.expected)
    if (!ok) wrong += 1
    const detail = brief(answers)
    console.log(`  ${ok ? 'ok   ' : 'WRONG'} ${testCase.id.padEnd(13)} got ${show(result)}, want ${show(testCase.expected)}  [${detail}]`)
  }
  return wrong
}

/** Runs a code puzzle's program on every case, the way the page's sandbox does. */
async function runCode(puzzle: CodePuzzle, code: string, label: string): Promise<number> {
  const solve = compile(code)
  let wrong = 0
  console.log(`\n${puzzle.id} · ${label}`)
  for (const testCase of puzzle.cases) {
    const trail: string[] = []
    const jev = async (request: unknown) => {
      const response = await ask(request as AskRequest)
      trail.push(brief(response.answers))
      return response
    }
    let got: Outcome | string
    let ok = false
    try {
      const outcome = toOutcome(await solve(testCase.state, jev))
      got = outcome.ok ? outcome.value : `(${outcome.error})`
      ok = outcome.ok && matches(outcome.value, testCase.expected)
    } catch (err) {
      got = `(threw: ${err instanceof Error ? err.message : String(err)})`
    }
    if (!ok) wrong += 1
    console.log(`  ${ok ? 'ok   ' : 'WRONG'} ${testCase.id.padEnd(15)} got ${show(got)}, want ${show(testCase.expected)}  ${trail.map((step) => `[${step}]`).join(' → ')}`)
  }
  return wrong
}

const failures: string[] = []
for (const puzzle of PUZZLES) {
  if (only.length > 0 && !only.includes(puzzle.id)) continue
  const starterWrong = puzzle.kind === 'cards' ? await run(puzzle, puzzle.starter, 'starter') : await runCode(puzzle, puzzle.starter, 'starter')
  if (starterWrong === 0) failures.push(`${puzzle.id}: the starter already passes, so there is nothing to solve`)
  const wrong = puzzle.kind === 'cards' ? await run(puzzle, puzzle.solution, 'solution') : await runCode(puzzle, puzzle.solution, 'solution')
  if (wrong > 0) failures.push(`${puzzle.id}: the reference solution gets ${wrong} wrong`)
}

console.log(`\nSent ${sent} new requests to Jev (${tokens} tokens, $${((tokens / 1e6) * 0.042).toFixed(6)}); the rest came from the cache.`)
if (failures.length > 0) {
  console.log(`\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('Every starter fails and every solution passes.')
