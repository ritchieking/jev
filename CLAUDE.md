# Project instructions — Jev explainer

Explainer site for TypeSafe's Jev decision model. The brief is
`~/sync/Jev capabilities explainer.md` (voice-dictated: "Jeb/Jeff" = Jev, "nuel" = noul).
Jev's docs index is `https://docs.typesafe.ai/llms.txt`; append `.md` to a docs path for markdown.

- `shared/types.ts` is the contract between page and proxy; change it first, then both sides.
- `npm run typecheck && npm test && npm run build` must pass before a commit.
- The page (`src/`) is static and goes to GitHub Pages under `/jev/`. It reaches Jev only
  through `src/lib/api.ts`. The TypeSafe key never goes anywhere under `src/`.
- The proxy binds 127.0.0.1:8686 (public-IP VPS) and is exposed only via Cloudflare Tunnel
  at `jev.drjivewire.com`. Service `jev` (systemd user unit in `deploy/`).
- Every request to Jev goes through the origin check, per-visitor rate limit and daily
  budget in `server/app.ts`. Don't add a route that skips them.
- "Code mode" for puzzles must run visitors' code in their browser, never on the server.
- No real key in tests: `buildApp` takes `fetch` as a dependency, so fake the upstream.
- Tabs are hash-based (`#explainer`, `#performance`, `#puzzles`); Pages can't route paths.
- Don't state Jev numbers (cost, speed, accuracy) on the page unless we measured them or
  the page attributes them to TypeSafe.
- The Explainer's sample messages and questions are in `src/data/sample.ts`; Jev's real answers
  to them are in `src/data/recorded.json`. After changing either, run `npm run record` (needs the
  `jev` service up) and reread each preset's `notice` against the new answers.
- Jev credits are Ritchie's own money. Develop and browser-test against cached answers or a fake
  upstream, not fresh requests. The proxy caches by (model, context, questions), so re-running
  `npm run check-puzzles` or driving the page with a puzzle's shipped starter/solution sends nothing.
- Puzzles live in `src/puzzles/puzzles.ts`; `engine.ts` holds the pure logic (validate, build the
  request, turn answers into a result, print as code). Every puzzle ships a `starter` that must
  fail and a `solution` that must pass against the real model: run `npm run check-puzzles` after
  adding or changing one, and fix the puzzle (not the checker) if it disagrees.
