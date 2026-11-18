# How Jev works

An explainer for [Jev](https://docs.typesafe.ai), TypeSafe's decision model: what its
question types are, why batching questions is cheap, and puzzles to solve with real
requests.

Two halves live in this repo:

- **The page** (`src/`): a static React app, published by GitHub Pages at
  `ritchiesking.com/jev/`.
- **The proxy** (`server/`): a small service on the VPS that holds the TypeSafe API key
  and forwards the page's questions to Jev. It is reachable at
  `https://jev.drjivewire.com` through the Cloudflare Tunnel.

`shared/types.ts` is the contract between them.

## Run it locally

```sh
npm install
npm run dev:server   # proxy on 127.0.0.1:8686
npm run dev          # page on http://localhost:5173/jev/, forwarding /api to the proxy
```

`npm run typecheck && npm test && npm run build` should pass before a commit.

## The API key

Create `.env` in the repo root (it is gitignored) with one line:

```
TYPESAFE_API_KEY=your-key-here
```

Then `chmod 600 .env` and `systemctl --user restart jev`. Without a key the proxy runs
but answers `503 not_configured`.

Optional settings, with their defaults:

| Variable | Default | What it does |
|---|---|---|
| `DAILY_BUDGET_USD` | `1` | Hard ceiling on Jev spend per UTC day |
| `RATE_PER_MINUTE` | `120` | Requests per visitor per minute |
| `RATE_PER_DAY` | `3000` | Requests per visitor per day |
| `MAX_BODY_BYTES` | `32768` | Largest request the proxy will forward |
| `MAX_QUESTIONS` | `64` | Most questions in one request |
| `JEV_MODEL` | `jev-1.14.0` | Pinned so recorded answers don't drift |
| `ALLOWED_ORIGINS` | `https://ritchiesking.com` | Sites allowed to call the proxy (localhost always is) |
| `PORT` | `8686` | Loopback port the proxy listens on |

## Deploy

- **Proxy:** systemd user unit in `deploy/jev.service`; install steps are in its header.
  After changing server code: `systemctl --user restart jev`. Logs:
  `journalctl --user -u jev -f`. Check it with
  `curl https://jev.drjivewire.com/api/health`.
- **Tunnel:** `jev.drjivewire.com → localhost:8686` in `~/.cloudflared/config.yml`,
  served by the `cloudflared-campsites` unit alongside the other projects.
- **Page:** `.github/workflows/pages.yml` builds and publishes on every push to `main`.
  One-time setup on GitHub: Settings → Pages → Source → "GitHub Actions".
