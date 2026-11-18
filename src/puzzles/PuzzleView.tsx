import { useCallback, useEffect, useRef, useState } from 'react'
import { CardsBench } from './CardsBench'
import { CodeBench } from './CodeBench'
import { toCode } from './engine'
import type { Program, Puzzle } from './types'

type Props = {
  puzzle: Puzzle
  technical: boolean
  /** Where "next puzzle" goes, if there is one. */
  nextHref: string | undefined
  onSolved: () => void
}

type View = 'cards' | 'code'

export function PuzzleView({ puzzle, technical, nextHref, onSolved }: Props) {
  const [view, setView] = useState<View>(puzzle.kind)
  // Card puzzles keep the cards and any hand-edited code side by side: switching
  // views loses neither. `code` stays null until the learner types in the editor.
  const [program, setProgram] = useState<Program | null>(puzzle.kind === 'cards' ? puzzle.starter : null)
  const [code, setCode] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)

  const onSolvedRef = useRef(onSolved)
  onSolvedRef.current = onSolved
  useEffect(() => {
    if (solved) onSolvedRef.current()
  }, [solved])
  const onSolvedChange = useCallback((next: boolean) => setSolved(next), [])

  function showSolution() {
    if (puzzle.kind === 'cards') {
      setProgram(puzzle.solution)
      setCode(null)
    } else {
      setCode(puzzle.solution)
    }
  }

  const toggle =
    puzzle.kind === 'cards' ? (
      <div className="segmented small-seg" role="group" aria-label="How to write the solution">
        {(['cards', 'code'] as const).map((option) => (
          <button key={option} type="button" aria-pressed={view === option} onClick={() => setView(option)}>
            {option === 'cards' ? 'Cards' : 'Code'}
          </button>
        ))}
      </div>
    ) : null

  return (
    <div className="stack">
      <div className="panel">
        <h2 className="puzzle-title">{puzzle.title}</h2>
        <p className="brief">{puzzle.brief}</p>
        <details className="hint">
          <summary>Hint</summary>
          <p>{puzzle.hint}</p>
          <button type="button" className="quiet" onClick={showSolution}>
            Show me a solution
          </button>
        </details>
      </div>

      {solved && (
        <div className="panel solved" role="status">
          <p>
            <strong>Solved.</strong> {puzzle.lesson}
          </p>
          {nextHref && (
            <a className="next" href={nextHref}>
              Next puzzle →
            </a>
          )}
        </div>
      )}

      {puzzle.kind === 'cards' && program && view === 'cards' ? (
        <CardsBench
          puzzle={puzzle}
          program={program}
          onChange={setProgram}
          technical={technical}
          toggle={toggle}
          onEditAsCode={() => setView('code')}
          onSolvedChange={onSolvedChange}
        />
      ) : (
        <CodeBench
          puzzle={puzzle}
          code={code ?? (puzzle.kind === 'cards' ? toCode(puzzle, program ?? puzzle.starter) : puzzle.starter)}
          onChange={setCode}
          onReset={() => setCode(null)}
          resetLabel={puzzle.kind === 'cards' ? 'Reset to the cards' : 'Start over'}
          technical={technical}
          toggle={toggle}
          onSolvedChange={onSolvedChange}
        />
      )}
    </div>
  )
}
