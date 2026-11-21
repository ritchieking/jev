// Asks Jev the basics page's questions about every preset pitch and saves the real
// answers to src/data/recorded.json, so the page can show them without a request.
// Goes through the local proxy, so it needs `jev` (or `npm run dev:server`) running.
//
//   npm run record            write recorded.json
//   npm run record -- --dry   print the answers without writing

import { writeFileSync } from 'node:fs'
import type { AskRequest, AskResponse } from '../shared/types'
import { PRESETS, QUESTIONS, stateOf } from '../src/data/sample'

const PROXY = process.env.JEV_PROXY ?? 'http://127.0.0.1:8686'
const OUT = new URL('../src/data/recorded.json', import.meta.url)
const dry = process.argv.includes('--dry')

async function ask(request: AskRequest): Promise<AskResponse> {
  const res = await fetch(`${PROXY}/api/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost' },
    body: JSON.stringify(request),
  })
  if (!res.ok) throw new Error(`Proxy answered ${res.status}: ${await res.text()}`)
  return (await res.json()) as AskResponse
}

const responses: Record<string, AskResponse> = {}
for (const preset of PRESETS) {
  const response = await ask({ state: stateOf(preset), questions: QUESTIONS, fresh: true })
  responses[preset.id] = response
  const answers = Object.entries(response.answers).map(([id, answer]) => {
    if (answer.type === 'noul') return `${id}=${answer.noul}`
    if (answer.type === 'choice') return `${id}=${JSON.stringify(answer.probabilities)}`
    return `${id}=${answer.score} ${JSON.stringify(answer.probabilities)}`
  })
  console.log(`${preset.id.padEnd(12)} ${answers.join('  ')}  (${response.usage.input_tokens} tok, ${response.meta.upstream_ms} ms)`)
}

if (!dry) {
  const models = new Set(Object.values(responses).map((response) => response.model))
  if (models.size !== 1) throw new Error(`Answers came from more than one model: ${[...models].join(', ')}`)
  const recorded = { recordedAt: new Date().toISOString().slice(0, 10), model: [...models][0], responses }
  writeFileSync(OUT, JSON.stringify(recorded, null, 2) + '\n')
  console.log(`Wrote ${OUT.pathname}`)
}
