import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Budget } from './budget'
import { RateLimiter } from './limits'

describe('RateLimiter', () => {
  it('reopens when the minute window passes', () => {
    let now = 0
    const limiter = new RateLimiter(2, 100, () => now)
    expect(limiter.take('a')).toBeNull()
    expect(limiter.take('a')).toBeNull()
    expect(limiter.take('a')).toBe(60)
    now = 61_000
    expect(limiter.take('a')).toBeNull()
  })

  it('enforces the daily cap across minutes, and blocked tries are not counted', () => {
    let now = 0
    const limiter = new RateLimiter(10, 3, () => now)
    for (let i = 0; i < 3; i++) {
      expect(limiter.take('a')).toBeNull()
      now += 61_000
    }
    expect(limiter.take('a')).toBeGreaterThan(80_000)
    now = 24 * 60 * 60_000 + 1
    expect(limiter.take('a')).toBeNull()
  })
})

describe('Budget', () => {
  const day1 = Date.parse('2026-11-18T12:00:00Z')

  it('reserves, settles to the billed amount, and refuses past the limit', () => {
    const budget = new Budget(1000, null, () => day1)
    expect(budget.reserve(600)).toBe(true)
    expect(budget.reserve(600)).toBe(false)
    budget.settle(600, 150)
    expect(budget.snapshot().usedTokens).toBe(150)
    expect(budget.reserve(850)).toBe(true)
  })

  it('resets at midnight UTC', () => {
    let now = day1
    const budget = new Budget(1000, null, () => now)
    budget.reserve(900)
    now = Date.parse('2026-11-19T00:00:01Z')
    expect(budget.snapshot()).toMatchObject({ day: '2026-11-19', usedTokens: 0 })
  })

  it('survives a restart on the same day, and ignores a stale file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'jev-budget-')), 'nested', 'usage.json')
    const first = new Budget(1000, file, () => day1)
    first.reserve(400)
    first.settle(400, 300)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ day: '2026-11-18', usedTokens: 300 })

    expect(new Budget(1000, file, () => day1).snapshot().usedTokens).toBe(300)

    writeFileSync(file, JSON.stringify({ day: '2026-11-01', usedTokens: 999 }))
    expect(new Budget(1000, file, () => day1).snapshot().usedTokens).toBe(0)
  })
})
