import type { ReactNode } from 'react'
import type { Answer } from '../../shared/types'
import type { Outcome, Puzzle } from './types'

type Props = {
  state: string
  /** Jev's answers for this input, one entry per request, in the order they were made. */
  steps: Record<string, Answer>[]
  /** Undefined until this input has been run. */
  verdict: 'right' | 'wrong' | undefined
  /** The solution's result, already in words. */
  yours: string | undefined
  expected: string
  /** Why there is no result, when the solution failed on this input. */
  error?: string
  children?: ReactNode
}

/** One test case: the input, what Jev answered, the solution's result and whether it is right. */
export function CaseItem({ state, steps, verdict, yours, expected, error, children }: Props) {
  return (
    <li className={verdict}>
      <p className="case-state">{state}</p>
      {steps.map((answers, index) => (
        <p key={index} className="case-answers">
          {steps.length > 1 && <span className="step-label">Request {index + 1}</span>}
          {Object.entries(answers).map(([name, answer]) => (
            <span key={name} className="answer-chip">
              <span className="mono">{name}</span> {summarize(answer)}
            </span>
          ))}
        </p>
      ))}
      <p className="case-result">
        {verdict ? (
          <>
            <span className="verdict">{verdict === 'right' ? '✓ Right' : '✗ Wrong'}</span>
            {error ? (
              <span className="case-error">{error}</span>
            ) : (
              <span>
                Yours: <strong>{yours}</strong>
              </span>
            )}
            {verdict === 'wrong' && (
              <span>
                Should be: <strong>{expected}</strong>
              </span>
            )}
          </>
        ) : (
          <span className="muted">
            Should be: <strong>{expected}</strong>
          </span>
        )}
      </p>
      {children}
    </li>
  )
}

const pct = (p: number) => `${Math.round(p * 100)}%`

function summarize(answer: Answer): string {
  switch (answer.type) {
    case 'noul':
      return pct(answer.noul)
    case 'choice':
      return `${answer.choice} ${pct(answer.probabilities[answer.choice] ?? 0)}`
    case 'score':
      return answer.score.toFixed(2)
  }
}

/** A result in words: the outcome's label where the puzzle has one, otherwise the value itself. */
export function show(puzzle: Puzzle, result: Outcome | undefined): string {
  if (result === undefined) return 'no result'
  if (typeof result === 'number') return String(result)
  if (typeof result !== 'string') return result.length === 0 ? 'nothing' : result.join(', ')
  if (puzzle.kind === 'cards' && puzzle.result.kind === 'one') {
    // A pick that isn't one of the puzzle's outcomes is shown as Jev returned it.
    return puzzle.result.outcomes.find((outcome) => outcome.id === result)?.label ?? result
  }
  return result
}
