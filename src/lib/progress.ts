// Which puzzles this visitor has solved, kept in their browser. A convenience only:
// storage can be unavailable (private windows, blocked site data), and the page works without it.
const KEY = 'jev:solved'

export function loadSolved(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveSolved(ids: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Not saved; the ticks just won't survive a reload.
  }
}
