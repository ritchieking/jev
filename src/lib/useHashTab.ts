import { useEffect, useState } from 'react'

// Navigation lives in the URL hash: GitHub Pages can't route real paths to index.html.
// Links are plain anchors like `#puzzles` or `#puzzles/toppings`; this reports where we are.
export function useHashTab<T extends string>(tabs: readonly T[]): { tab: T; rest: string } {
  const read = () => {
    const [first = '', ...more] = window.location.hash.slice(1).split('/')
    const tab = tabs.includes(first as T) ? (first as T) : tabs[0]!
    return { tab, rest: tab === first ? more.join('/') : '' }
  }
  const [location, setLocation] = useState(read)

  useEffect(() => {
    const onChange = () => setLocation(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // `tabs` is a module-level constant at every call site, so this never needs to re-run.
  }, [])

  return location
}
