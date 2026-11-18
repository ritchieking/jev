import { useEffect, useState } from 'react'

// Tabs live in the URL hash: GitHub Pages can't route real paths to index.html.
// Tab links are plain `#name` anchors; this just reports which one is current.
export function useHashTab<T extends string>(tabs: readonly T[]): T {
  const read = (): T => {
    const hash = window.location.hash.slice(1) as T
    return tabs.includes(hash) ? hash : tabs[0]!
  }
  const [tab, setTab] = useState<T>(read)

  useEffect(() => {
    const onChange = () => setTab(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // `tabs` is a module-level constant at every call site, so this never needs to re-run.
  }, [])

  return tab
}
