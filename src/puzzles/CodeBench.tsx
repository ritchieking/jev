import { useEffect, useState, type ReactNode } from 'react'
import { costUsd } from '../../shared/types'
import { JsonView } from '../components/JsonView'
import { CaseItem, show } from './CaseItem'
import { CodeEditor } from './CodeEditor'
import { matches } from './engine'
import { askOnce } from './memo'
import { MAX_REQUESTS_PER_CASE, runCode, type RunResult } from './sandbox'
import { toOutcome } from './solve'
import type { Puzzle } from './types'

type Props = {
  puzzle: Puzzle
  code: string
  onChange: (next: string) => void
  onReset: () => void
  /** What the reset button says, since it means different things for card and code puzzles. */
  resetLabel: string
  technical: boolean
  /** The Cards / Code switch, for puzzles that have both. */
  toggle: ReactNode
  onSolvedChange: (solved: boolean) => void
}

/** A puzzle as code: the learner writes `solve`, and it runs in their browser once per input. */
export function CodeBench({ puzzle, code, onChange, onReset, resetLabel, technical, toggle, onSolvedChange }: Props) {
  // Results belong to the exact code that produced them; any edit makes them stale.
  const [last, setLast] = useState<{ code: string; result: RunResult } | null>(null)
  const [running, setRunning] = useState(false)
  const result = last && last.code === code ? last.result : null

  const rows = puzzle.cases.map((testCase) => {
    const run = result?.cases[testCase.id]
    const outcome = run?.outcome.ok ? toOutcome(run.outcome.value) : undefined
    const error = run && !run.outcome.ok ? run.outcome.error : outcome && !outcome.ok ? outcome.error : undefined
    const value = outcome?.ok ? outcome.value : undefined
    return { testCase, run, value, error, correct: value !== undefined && matches(value, testCase.expected) }
  })
  const ran = result !== null && !result.fatal
  const right = rows.filter((row) => row.correct).length
  const solved = ran && right === rows.length
  const steps = rows.flatMap((row) => row.run?.steps ?? [])
  const tokens = steps.reduce((sum, step) => sum + (step.response?.usage.input_tokens ?? 0), 0)

  useEffect(() => onSolvedChange(solved), [solved, onSolvedChange])

  async function run() {
    setRunning(true)
    const started = code
    const finished = await runCode(
      started,
      puzzle.cases.map((testCase) => ({ id: testCase.id, input: testCase.state })),
      { ask: askOnce },
    )
    setLast({ code: started, result: finished })
    setRunning(false)
  }

  const count = puzzle.cases.length
  const plural = puzzle.input.endsWith('s') ? `sets of ${puzzle.input}` : `${puzzle.input}s`

  return (
    <div className="workbench wide-left">
      <div className="panel">
        <div className="step-head">
          <h3>
            <span className="step">1</span> Write the solution
          </h3>
          <div className="step-tools">
            {toggle}
            <button type="button" className="link" onClick={onReset}>
              {resetLabel}
            </button>
          </div>
        </div>
        <p className="muted small">
          <code>solve</code> is called once for each input and has to return {returns(puzzle)}. Each call to <code>jev</code>{' '}
          sends one request, up to {MAX_REQUESTS_PER_CASE} per input. The code runs in your browser.
        </p>
        <CodeEditor value={code} onChange={onChange} label="Solution code" />
        {result && result.logs.length > 0 && (
          <figure className="json">
            <figcaption>Printed by console.log</figcaption>
            <pre className="code">{result.logs.join('\n')}</pre>
          </figure>
        )}
      </div>

      <div className="panel">
        <div className="step-head">
          <h3>
            <span className="step">2</span> Check
          </h3>
          <p className="tally" role="status">
            {ran ? `${right} of ${count} right` : `${count} ${plural}`}
          </p>
        </div>

        {ran ? (
          <p className="muted small stats">
            {steps.length} {steps.length === 1 ? 'request' : 'requests'} · {tokens.toLocaleString('en-US')} tokens · $
            {costUsd(tokens).toFixed(6)}
            {/* Answers already received are remembered, so this only re-sends what failed. */}
            <button type="button" className="link" onClick={run} disabled={running}>
              {running ? 'Running…' : 'Run again'}
            </button>
          </p>
        ) : (
          <div className="run-row">
            <button type="button" className="primary" onClick={run} disabled={running}>
              {running ? 'Running…' : `Run it on all ${count}`}
            </button>
          </div>
        )}
        {result?.fatal && <p className="error small">{result.fatal}</p>}

        <ul className="cases">
          {rows.map(({ testCase, run: caseRun, value, error, correct }) => (
            <CaseItem
              key={testCase.id}
              state={testCase.state}
              steps={ran && caseRun ? caseRun.steps.flatMap((step) => (step.response ? [step.response.answers] : [])) : []}
              verdict={ran && caseRun ? (correct ? 'right' : 'wrong') : undefined}
              yours={show(puzzle, value)}
              expected={show(puzzle, testCase.expected)}
              error={error}
            >
              {technical && ran && caseRun && caseRun.steps.length > 0 && (
                <details className="trace">
                  <summary>
                    {caseRun.steps.length === 1 ? 'The request and response' : `All ${caseRun.steps.length} requests and responses`}
                  </summary>
                  {caseRun.steps.map((step, index) => (
                    <div key={index}>
                      <JsonView label={`Request ${index + 1}`} value={{ model: step.response?.model ?? 'jev-1.14.0', ...step.request }} />
                      {step.response ? (
                        <JsonView label={`Response ${index + 1}`} value={{ answers: step.response.answers, usage: step.response.usage }} />
                      ) : (
                        <p className="error small">{step.error ?? 'No response.'}</p>
                      )}
                    </div>
                  ))}
                </details>
              )}
            </CaseItem>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** What `solve` has to return, in words. */
function returns(puzzle: Puzzle): string {
  if (puzzle.kind === 'code') return puzzle.returns
  if (puzzle.result.kind === 'set') return `the list of ${puzzle.result.noun}, such as ${JSON.stringify(puzzle.result.items.slice(0, 2))}`
  return `one of ${puzzle.result.outcomes.map((outcome) => JSON.stringify(outcome.id)).join(', ')}`
}
