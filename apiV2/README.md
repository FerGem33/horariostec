# HorariosTec API v2

TypeScript/JavaScript Cloudflare Worker replacement for the Python/Pyodide API.
It keeps the existing `/api/health` and `/api/v1/*` response contracts and uses
the existing `horariostec` D1 database.

## Local development

```bash
cd apiV2
pnpm install
pnpm exec wrangler d1 migrations apply horariostec --local
pnpm dev --local --port 8788
```

The local API is available at `http://localhost:8788`. Local D1 contains the
schema and seed careers, but not the production data.

## Checks

```bash
pnpm typecheck
pnpm exec wrangler deploy --dry-run
```

## Deployment

Deploy this Worker separately from the current Python API:

```bash
cd apiV2
pnpm exec wrangler deploy
```

After validating the new Worker URL, update the frontend's
`VITE_API_BASE_URL` and redeploy the Pages frontend.
