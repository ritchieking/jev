import { useState } from 'react'
import { useHashTab } from './lib/useHashTab'
import { Explainer } from './tabs/Explainer'
import { Performance } from './tabs/Performance'
import { Puzzles } from './tabs/Puzzles'

const TABS = ['explainer', 'performance', 'puzzles'] as const
type Tab = (typeof TABS)[number]

const LABELS: Record<Tab, string> = {
  explainer: 'Explainer',
  performance: 'Performance',
  puzzles: 'Puzzles',
}

export type Mode = 'conceptual' | 'technical'

export function App() {
  const { tab, rest } = useHashTab(TABS)
  const [mode, setMode] = useState<Mode>('conceptual')

  return (
    <div className="page">
      <header className="masthead">
        <h1>How Jev works</h1>
        <p className="lede">
          Jev is a model that doesn’t write. You hand it some context and a set of questions, and it answers each one
          with probabilities.
        </p>
        <div className="controls">
          <nav className="tabs" aria-label="Sections">
            {TABS.map((name) => (
              <a key={name} href={`#${name}`} aria-current={tab === name ? 'page' : undefined}>
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
        </div>
      </header>
      <main>
        {tab === 'explainer' && <Explainer mode={mode} />}
        {tab === 'performance' && <Performance mode={mode} />}
        {tab === 'puzzles' && <Puzzles mode={mode} selected={rest} />}
      </main>
    </div>
  )
}
