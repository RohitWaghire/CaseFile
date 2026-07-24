# Deploying CaseFile

CaseFile runs as **one Node service**: the Express server ([server/index.js](server/index.js))
serves the built React app from `dist/` **and** the `/api` routes. Build once, run one process.

```bash
npm run build   # produces dist/
npm start       # serves dist/ + API on $PORT (default 8787)
```

## Environment variables

Set these on your host (never commit real values — `.env` is git-ignored).

| Variable | Required | Purpose |
|----------|----------|---------|
| `GOOGLE_GEMINI_KEY` | for Enrich | Google Gemini key. **You are billed for this** — see cost note below. |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest`. |
| `COURTLISTENER_TOKEN` | no | Full opinion text from CourtListener's authenticated API. |
| `CASEFILE_ACCESS_PASSWORD` | recommended for pre-launch | Locks the API behind a shared password. Testers are prompted once. |
| `RATE_LIMIT_API` | no | Requests / 15 min / IP (default `120`). |
| `RATE_LIMIT_COSTLY` | no | Extract+Enrich calls / hour / IP (default `30`). |
| `PORT` | no | Hosts set this automatically. |

## ⚠️ Cost protection (read before going public)

Because **you** pay for the Gemini key, the `/api/enrich` and `/api/extract` endpoints
spend real money on every call. Two guards ship enabled:

- **Rate limiting** — per-IP caps on the costly endpoints (tune with the env vars above).
- **Access gate** — set `CASEFILE_ACCESS_PASSWORD` to keep the instance private until
  billing exists. Strongly recommended for the first deploy.

Do **not** expose this publicly without either a low `RATE_LIMIT_COSTLY` or the access
password, or a stranger can run up your Gemini bill.

## Option A — Render (git-based, recommended)

1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com): **New → Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** the folder containing this file (if the repo root is elsewhere).
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
4. Add the environment variables from the table above.
5. Deploy. Render gives you an HTTPS URL and sets `PORT` for you.

## Option B — Docker (Railway, Fly.io, Cloud Run, any VPS)

A [Dockerfile](Dockerfile) is included (multi-stage: build then run).

```bash
docker build -t casefile .
docker run -p 8787:8787 \
  -e GOOGLE_GEMINI_KEY=your-key \
  -e CASEFILE_ACCESS_PASSWORD=choose-one \
  casefile
# open http://localhost:8787
```

Point Railway/Fly/Cloud Run at the Dockerfile and set the same env vars in their dashboard.

## After it's live

1. Verify `GET /api/health` returns `{"ok":true, "llmEnrichment":true, ...}`.
2. Confirm the access gate: an API call without the password returns `401`.
3. **Then build the paywall** — accounts + Stripe subscription — which replaces the
   shared password with real per-user billing and usage metering. See the roadmap below.

## Roadmap to a paid product

- [x] Deploy live (this doc)
- [ ] Accounts / auth
- [ ] Stripe subscription + customer portal
- [ ] Per-plan usage metering & limits (protects LLM margin)
- [ ] Database: cache CourtListener results, store users & saved work
- [ ] Confirm commercial use terms with Free Law Project (CourtListener)
