// Checks every puzzle against the real model: its starter has to get at least one
// case wrong, and its reference solution has to get them all right. Goes through the
// local proxy, whose cache makes a repeat run free unless a puzzle changed.
//
//   npm run check-puzzles              all puzzles
//   npm run check-puzzles -- toppings  just one

import type { AskRequest, AskResponse } from '../shared/types'
import { evaluate, matches, toQuestions, validate } from '../src/puzzles/engine'
import { PUZZLES } from '../src/puzzles/puzzles'
import type { Program, Puzzle } from '../src/puzzles/types'

const PROXY = process.env.JEV_PROXY ?? 'http://127.0.0.1:8686'
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'))

let sent = 0
let tokens = 0

async function ask(request: AskRequest): Promise<AskResponse> {
  const res = await fetch(`${PROXY}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost' },
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error(`Proxy answered ${res.status}: ${await res.text()}`)
  const response = (await res.json()) as AskResponse
  if (!response.meta.cached) {
    sent += 1
    tokens += response.usage.input_tokens
  }
  return response
}

const show = (value: unknown) => (Array.isArray(value) ? `{${value.join(', ')}}` : String(value))

async function run(puzzle: Puzzle, program: Program, label: string): Promise<number> {
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
    const detail = Object.entries(answers)
      .map(([name, answer]) =>
        answer.type === 'noul'
          ? `${name}=${answer.noul}`
          : answer.type === 'choice'
            ? `${name}=${answer.choice}@${answer.probabilities[answer.choice]}`
            : `${name}=${answer.score}`,
      )
      .join(' ')
    console.log(`  ${ok ? 'ok   ' : 'WRONG'} ${testCase.id.padEnd(13)} got ${show(result)}, want ${show(testCase.expected)}  [${detail}]`)
  }
  return wrong
}

const failures: string[] = []
for (const puzzle of PUZZLES) {
  if (only.length > 0 && !only.includes(puzzle.id)) continue
  if ((await run(puzzle, puzzle.starter, 'starter')) === 0) failures.push(`${puzzle.id}: the starter already passes, so there is nothing to solve`)
  const wrong = await run(puzzle, puzzle.solution, 'solution')
  if (wrong > 0) failures.push(`${puzzle.id}: the reference solution gets ${wrong} wrong`)
}

console.log(`\nSent ${sent} new requests to Jev (${tokens} tokens, $${((tokens / 1e6) * 0.042).toFixed(6)}); the rest came from the cache.`)
if (failures.length > 0) {
  console.log(`\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('Every starter fails and every solution passes.')
