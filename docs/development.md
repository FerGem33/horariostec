# Development guide

## Prerequisites

Install:

- Python 3.11 or newer and [`uv`](https://docs.astral.sh/uv/).
- Node.js and `pnpm` for the frontend and Wrangler commands.
- A Cloudflare account only when deploying or using remote D1.

The Mindbox scraper also needs Chromium installed through Playwright.

## Local API

```bash
cd api
uv sync
npx wrangler d1 migrations apply horariostec --local
uv run pywrangler dev
```

The local Worker normally listens on `http://localhost:8787`. Check health:

```bash
curl http://localhost:8787/api/health
```

The local D1 state is managed by Wrangler under `api/.wrangler/` and is
ignored by Git. Reapplying migrations is safe because the migrations use
idempotent schema statements, but it does not reset existing data.

## Local frontend

```bash
cd app
pnpm install
cp .env.example .env.local
pnpm dev
```

The frontend uses `http://localhost:8787` by default in development. Set
`VITE_API_BASE_URL` in `.env.local` when the API runs elsewhere. Never commit
`.env.local`.

Build checks the TypeScript project and creates `app/dist/`:

```bash
pnpm build
pnpm preview
```

## Tests

Run Python tests for the API and Mindbox scraper:

```bash
cd api
uv run python -m unittest discover -s tests -v

cd ../scraper/mindbox
uv run python -m unittest discover -s tests -v
```

Run the frontend production build:

```bash
cd app
pnpm build
```

## Repository conventions

- Keep generated artifacts, Wrangler state, credentials, sessions, and builds
  out of Git.
- Use the career slugs in `api/importer.py` consistently across filenames,
  URLs, artifacts, and database rows.
- Update documentation when a command, route, environment variable, or data
  contract changes.
- Prefer a focused migration for schema changes. Do not edit an already
  applied migration to change production behavior.
