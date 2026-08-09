# HorariosTec

HorariosTec is an open-source schedule planner and teacher-experience site
for students at Instituto Tecnológico de Saltillo. It combines current class
offerings from the authenticated Mindbox portal with historical teacher data
from HazTuHorario and anonymous evaluations submitted through the web app.

The project has four parts:

- `app/` — React + TypeScript frontend deployed as a static site.
- `api/` — Python Cloudflare Worker and D1 schema/import tools.
- `scraper/mindbox/` — authenticated Playwright scraper for current offerings.
- `scraper/haztuhorario/` — public-site scraper for historical teacher data.

## Documentation

- [Development setup](docs/development.md) — install dependencies, run the
  local API/frontend, and run tests.
- [Architecture](docs/architecture.md) — current components, boundaries, and
  planned improvements.
- [Data update runbook](docs/data-update.md) — the operational workflow for
  refreshing a semester and publishing it to local or remote D1.
- [API reference](docs/api-reference.md) — routes, query parameters, and data
  behavior.
- [Security and contribution notes](docs/security.md) — secrets, generated
  files, review data, and safe contribution practices.


## Quick start

Run these in separate terminals from the repository root:

```bash
cd api
uv sync
npx wrangler d1 migrations apply horariostec --local
uv run pywrangler dev
```

```bash
cd app
pnpm install
cp .env.example .env.local
pnpm dev
```

Then open the Vite URL printed by `pnpm dev`. The frontend defaults to an API
running at `http://localhost:8787` during development.

For the full workflow, including Mindbox credentials and remote publication,
read [the data update runbook](docs/data-update.md) before importing anything.

## Project status

The current deployment is an operator-run MVP. Scraping, teacher-name review,
and D1 publication are local administrative commands; there is no scheduled
job or public administrative import endpoint. Anonymous evaluations and
comment votes are accepted by the public API and require moderation and abuse
controls as the project grows.
