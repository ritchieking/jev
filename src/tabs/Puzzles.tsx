import { useState } from 'react'
import type { Mode } from '../App'
import { loadSolved, saveSolved } from '../lib/progress'
import { PuzzleView } from '../puzzles/PuzzleView'
import { PUZZLES } from '../puzzles/puzzles'

/** `selected` is the puzzle id from the URL (`#puzzles/<id>`); anything else shows the first. */
export function Puzzles({ mode, selected }: { mode: Mode; selected: string }) {
  const [solved, setSolved] = useState(loadSolved)
  const index = Math.max(0, PUZZLES.findIndex((puzzle) => puzzle.id === selected))
  const puzzle = PUZZLES[index]!
  const next = PUZZLES[index + 1]

  function markSolved(id: string) {
    if (solved.includes(id)) return
    const updated = [...solved, id]
    setSolved(updated)
    saveSolved(updated)
  }

  return (
    <section className="stack">
      <p className="intro">
        Each puzzle starts with a solution that runs but gets some cases wrong. Fix it by changing what you ask Jev,
        what you do with the answers, or both. The answers are real: each check sends your questions to Jev.
      </p>
      <nav className="puzzle-nav" aria-label="Puzzles">
        {PUZZLES.map((candidate, i) => (
          <a key={candidate.id} href={`#puzzles/${candidate.id}`} aria-current={candidate.id === puzzle.id ? 'page' : undefined}>
            <span className="puzzle-number">{solved.includes(candidate.id) ? '✓' : i + 1}</span>
            {candidate.title}
            {solved.includes(candidate.id) && <span className="visually-hidden"> (solved)</span>}
          </a>
        ))}
      </nav>
      {/* Keyed so each puzzle starts from its own starter rather than inheriting the last one's edits. */}
      <PuzzleView
        key={puzzle.id}
        puzzle={puzzle}
        technical={mode === 'technical'}
        nextHref={next && `#puzzles/${next.id}`}
        onSolved={() => markSolved(puzzle.id)}
      />
    </section>
  )
}
