# CaseFile

Legal research desk for attorneys, law students, and researchers. Search a topic, pull matching opinions from [CourtListener](https://www.courtlistener.com/), structure each case as **Id / Link / Title / opinion text**, then view or export JSON.

## Run locally

```bash
cd casefile-app
npm install
npm run dev
```

- App: http://localhost:8080  
- API: http://localhost:8787  

## Optional full-text API token

Without a token, CaseFile uses the public CourtListener search index (titles, links, snippets) and attempts court `download_url` pages when present.

For authenticated opinion text from the REST API:

```bash
# Windows PowerShell
$env:COURTLISTENER_TOKEN="your-token"
npm run dev
```

Create a free token at https://www.courtlistener.com/api/

## Optional LLM enrichment & delivery

These mirror the original n8n workflow's Google Gemini extraction and webhook / write-to-disk steps. All are off by default and degrade gracefully when unset — the app stays fully usable without them.

```bash
# Windows PowerShell
$env:GOOGLE_GEMINI_KEY="your-gemini-key"      # enables POST /api/enrich (summary, jurisdiction, outcome, precedents)
$env:GEMINI_MODEL="gemini-2.0-flash"          # optional, defaults to gemini-2.0-flash
$env:CASEFILE_WEBHOOK_URL="https://…"         # POST each record to a webhook
$env:CASEFILE_ARCHIVE_DIR="./archive"         # write Case-{Id}.json to disk
npm run dev
```

Get a free Gemini key at https://aistudio.google.com/. `GET /api/health` reports which features are active.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/search?q=…` | Search published opinions |
| `POST /api/extract` | Body `{ cases: [...] }` - enrich with fuller text |
| `POST /api/enrich` | Body `{ cases: [...] }` - LLM summary / jurisdiction / outcome / precedents (needs `GOOGLE_GEMINI_KEY`) |
| `POST /api/deliver` | Body `{ cases: [...] }` - send to webhook and/or archive to disk |
| `GET /api/health` | Service status (token, enrichment, sinks) |

## Stack

React + Vite, Express proxy, Motion, Phosphor Icons, CourtListener REST v4, optional Google Gemini for enrichment.
