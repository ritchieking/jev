type Window = { start: number; count: number }

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** Per-visitor fixed-window limiter, in memory. A restart forgets everyone. */
export class RateLimiter {
  private minutes = new Map<string, Window>()
  private days = new Map<string, Window>()
  private perMinute: number
  private perDay: number
  private now: () => number

  constructor(perMinute: number, perDay: number, now: () => number = Date.now) {
    this.perMinute = perMinute
    this.perDay = perDay
    this.now = now
  }

  /** Counts the request and returns null, or returns seconds until the visitor may retry. */
  take(visitor: string): number | null {
    const now = this.now()
    const minute = this.window(this.minutes, visitor, MINUTE, now)
    const day = this.window(this.days, visitor, DAY, now)
    if (day.count >= this.perDay) return Math.ceil((day.start + DAY - now) / 1000)
    if (minute.count >= this.perMinute) return Math.ceil((minute.start + MINUTE - now) / 1000)
    minute.count += 1
    day.count += 1
    return null
  }

  /** Drop expired windows so the maps don't grow with every visitor ever seen. */
  sweep(): void {
    const now = this.now()
    for (const [visitor, window] of this.minutes) if (now - window.start >= MINUTE) this.minutes.delete(visitor)
    for (const [visitor, window] of this.days) if (now - window.start >= DAY) this.days.delete(visitor)
  }

  private window(map: Map<string, Window>, visitor: string, length: number, now: number): Window {
    const existing = map.get(visitor)
    if (existing && now - existing.start < length) return existing
    const fresh = { start: now, count: 0 }
    map.set(visitor, fresh)
    return fresh
  }
}
