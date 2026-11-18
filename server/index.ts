import { serve } from '@hono/node-server'
import { buildApp } from './app'
import { Budget } from './budget'
import { AnswerCache } from './cache'
import { loadEnv } from './env'
import { RateLimiter } from './limits'

const env = loadEnv()
const budget = new Budget(env.dailyBudgetTokens, env.usageFile)
const limiter = new RateLimiter(env.ratePerMinute, env.ratePerDay)
setInterval(() => limiter.sweep(), 10 * 60_000).unref()

const cache = new AnswerCache(env.cacheEntries, env.cacheTtlMs)

const app = buildApp({ env, budget, limiter, cache, fetch })

// Public-IP VPS: bind to loopback only. The Cloudflare Tunnel is the one way in.
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: env.port }, ({ port }) => {
  console.log(
    `jev proxy on 127.0.0.1:${port} model=${env.model} key=${env.apiKey ? 'set' : 'MISSING'} ` +
      `budget=${env.dailyBudgetTokens.toLocaleString('en-US')} tokens/day`,
  )
})
