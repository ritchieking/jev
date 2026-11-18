import { createHash } from 'node:crypto'
import type { AskResponse } from '../shared/types'

type Entry = { response: AskResponse; storedAt: number }

/**
 * Remembers Jev's answers so the same context and questions are only paid for once.
 * Puzzles make this worthwhile: every visitor starts from the same starter questions
 * about the same test messages. In memory, least-recently-used entries dropped first.
 */
export class AnswerCache {
  private entries = new Map<string, Entry>()
  private maxEntries: number
  private ttlMs: number
  private now: () => number

  constructor(maxEntries: number, ttlMs: number, now: () => number = Date.now) {
    this.maxEntries = maxEntries
    this.ttlMs = ttlMs
    this.now = now
  }

  /** The key covers everything that affects the answer: model, context and questions. */
  static key(model: string, state: unknown, questions: unknown): string {
    return createHash('sha256').update(JSON.stringify([model, state, questions])).digest('hex')
  }

  get(key: string): AskResponse | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (this.now() - entry.storedAt > this.ttlMs) {
      this.entries.delete(key)
      return undefined
    }
    // Re-insert so Map order tracks recency.
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.response
  }

  set(key: string, response: AskResponse): void {
    if (this.maxEntries <= 0) return
    this.entries.delete(key)
    this.entries.set(key, { response, storedAt: this.now() })
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!)
    }
  }
}
