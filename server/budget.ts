import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

type Tally = { day: string; usedTokens: number }

/**
 * The hard ceiling on what the proxy can spend on the Jev account in one UTC day,
 * counted in input tokens (the only thing Jev bills). The tally is written to disk
 * so a restart doesn't hand out a fresh day's budget.
 */
export class Budget {
  readonly limitTokens: number
  private file: string | null
  private now: () => number
  private tally: Tally

  constructor(limitTokens: number, file: string | null, now: () => number = Date.now) {
    this.limitTokens = limitTokens
    this.file = file
    this.now = now
    this.tally = this.load()
  }

  /**
   * Set aside an estimate before calling Jev, so concurrent requests can't all
   * slip under the limit together. Returns false if the day's budget can't cover it.
   */
  reserve(estimateTokens: number): boolean {
    this.rollover()
    if (this.tally.usedTokens + estimateTokens > this.limitTokens) return false
    this.tally.usedTokens += estimateTokens
    return true
  }

  /** Swap a reservation for what Jev actually billed (0 if the call failed). */
  settle(estimateTokens: number, actualTokens: number): void {
    this.rollover()
    this.tally.usedTokens = Math.max(0, this.tally.usedTokens - estimateTokens + actualTokens)
    this.save()
  }

  snapshot(): Tally & { limitTokens: number } {
    this.rollover()
    return { ...this.tally, limitTokens: this.limitTokens }
  }

  private today(): string {
    return new Date(this.now()).toISOString().slice(0, 10)
  }

  private rollover(): void {
    const today = this.today()
    if (this.tally.day !== today) this.tally = { day: today, usedTokens: 0 }
  }

  private load(): Tally {
    const fresh = { day: this.today(), usedTokens: 0 }
    if (!this.file) return fresh
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Tally>
      if (saved.day === fresh.day && typeof saved.usedTokens === 'number' && saved.usedTokens >= 0) {
        return { day: saved.day, usedTokens: saved.usedTokens }
      }
    } catch {
      // No file yet, or an unreadable one: start the day at zero.
    }
    return fresh
  }

  private save(): void {
    if (!this.file) return
    try {
      mkdirSync(dirname(this.file), { recursive: true })
      writeFileSync(this.file, JSON.stringify(this.tally))
    } catch (err) {
      console.error('Could not save the usage tally:', err instanceof Error ? err.message : err)
    }
  }
}
