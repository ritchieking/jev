import { useEffect, useState } from 'react'
import { useHashTab } from './lib/useHashTab'
import { Basics } from './tabs/Basics'
import { Puzzles } from './tabs/Puzzles'

const PAGES = ['basics', 'puzzles'] as const
type Page = (typeof PAGES)[number]

const LABELS: Record<Page, string> = {
  basics: 'Jev basics',
  puzzles: 'Jev puzzles',
}

export type Mode = 'conceptual' | 'technical'

export function App() {
  const { tab: page, rest } = useHashTab(PAGES)
  const [mode, setMode] = useState<Mode>('conceptual')

  // A new page starts at its top; moving between puzzles stays where you are.
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = page === 'basics' ? 'Using Jev' : 'Jev puzzles'
  }, [page])

  return (
    <>
      <header className="bar">
        <nav aria-label="Pages">
          {PAGES.map((name) => (
            <a key={name} href={`#${name}`} aria-current={page === name ? 'page' : undefined}>
              {LABELS[name]}
            </a>
          ))}
        </nav>
        <div className="segmented" role="group" aria-label="Level of detail">
          {(['conceptual', 'technical'] as const).map((option) => (
            <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)}>
              {option === 'conceptual' ? 'Conceptual' : 'Technical'}
            </button>
          ))}
        </div>
      </header>
      <main className="page">
        {page === 'basics' && <Basics mode={mode} />}
        {page === 'puzzles' && <Puzzles mode={mode} selected={rest} />}
      </main>
    </>
  )
}
