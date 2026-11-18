import { PRICE_PER_MTOK_USD } from '../shared/types'

export type Env = {
  port: number
  /** Undefined until the key is added to .env; the proxy then answers 503. */
  apiKey: string | undefined
  endpoint: string
  model: string
  allowedOrigins: string[]
  dailyBudgetTokens: number
  maxBodyBytes: number
  maxQuestions: number
  ratePerMinute: number
  ratePerDay: number
  usageFile: string
}

function num(source: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = source[name]
  if (raw === undefined || raw.trim() === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number, got "${raw}"`)
  return value
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const dailyBudgetUsd = num(source, 'DAILY_BUDGET_USD', 1)
  return {
    port: num(source, 'PORT', 8686),
    apiKey: source.TYPESAFE_API_KEY?.trim() || undefined,
    endpoint: (source.TYPESAFE_ENDPOINT?.trim() || 'https://api.typesafe.ai').replace(/\/+$/, ''),
    // Pinned rather than jev-latest so recorded answers and tuned thresholds don't drift.
    model: source.JEV_MODEL?.trim() || 'jev-1.14.0',
    allowedOrigins: (source.ALLOWED_ORIGINS ?? 'https://ritchiesking.com')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    dailyBudgetTokens: Math.floor((dailyBudgetUsd / PRICE_PER_MTOK_USD) * 1_000_000),
    maxBodyBytes: num(source, 'MAX_BODY_BYTES', 32 * 1024),
    maxQuestions: num(source, 'MAX_QUESTIONS', 64),
    ratePerMinute: num(source, 'RATE_PER_MINUTE', 120),
    ratePerDay: num(source, 'RATE_PER_DAY', 3000),
    usageFile: source.USAGE_FILE?.trim() || 'data/usage.json',
  }
}
