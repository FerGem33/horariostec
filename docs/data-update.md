# Data update runbook

This is the operator workflow for refreshing the current academic catalog.
Scraping and importing are separate steps:

```text
Mindbox credentials
        ↓
local authenticated session
        ↓
Mindbox JSON artifacts
        ↓
teacher-name audit and validation
        ↓
local D1 import and verification
        ↓
remote D1 import with --activate
        ↓
API and frontend verification
```

The current project does not have a scheduled publisher, staging database, or
protected administrative API. An operator runs these commands manually.

## 1. Prepare the scraper

Create the local credentials file once:

```bash
cd scraper/mindbox
uv sync
uv run playwright install chromium
cp credentials.example.json credentials.json
```

Add one account per career to `credentials.json`. The file is ignored by Git;
never share or commit it. The supported slugs are `sistemas`, `mecatronica`,
`mecanica`, `industrial`, `electrica`, `electronica`, `gestion`, and
`materiales`.

## 2. Authenticate and scrape

For one career, authenticate and scrape in one command:

```bash
uv run python -m scraper scrape \
  --career sistemas \
  --auth \
  --headed
```

`--headed` is useful for login challenges. If sessions are already valid, omit
`--auth` and scrape directly. To authenticate separately:

```bash
uv run python -m scraper auth --career sistemas --headed
```

To attempt every career, omit `--career`:

```bash
uv run python -m scraper scrape --auth --headed
```

The scraper writes one artifact per successful career to
`scraper/mindbox/output/{career}-{year}-{term}.json`. Term `1` means January
through July; term `2` means August through December. Failed careers continue
to the next one and are reported after the run.

To scrape selected Mindbox semester numbers, add for example:

```bash
uv run python -m scraper scrape --career sistemas --semester 7 8
```

The filename still follows the current year/term convention unless
`--filename` is supplied for a single career.

## 3. Audit names before publishing

From `api/`, compare historical and current teacher names:

```bash
cd ../../api
uv run python audit_teacher_names.py --json /tmp/teacher-name-audit.json
```

Exact normalized matches are safe to combine automatically. Fuzzy matches may
refer to different people and need manual review. The regular Mindbox importer
does not merge fuzzy matches; the destructive `import_all.py` workflow asks
for confirmation and can create aliases for confirmed matches.

## 4. Ensure the database schema exists

For local D1:

```bash
npx wrangler d1 migrations apply horariostec --local
```

For remote D1, apply migrations before the first publication or after adding a
new migration:

```bash
npx wrangler d1 migrations apply horariostec --remote
```

## 5. Import locally first

From `api/`, the simplest command imports every artifact for the current term:

```bash
uv run python importer.py mindbox --activate
```

The importer automatically derives the term code and name. It expects files
such as `../scraper/mindbox/output/sistemas-2026-2.json`. It processes careers
independently, so a missing or invalid artifact is reported while successful
careers remain imported.

Import one career or a custom term when needed:

```bash
uv run python importer.py mindbox \
  --career sistemas \
  --input ../scraper/mindbox/output/sistemas-2026-2.json \
  --term-code 2026-2 \
  --term-name "Agosto - Diciembre 2026" \
  --activate
```

`--activate` makes the imported term active. Without it, the catalog is
stored but existing active-term API requests continue using the previous
active term. The selected career/term sections are replaced; other terms,
careers, teachers, and subjects are retained.

Check the local API before publishing:

```bash
curl http://localhost:8787/api/v1/terms
curl 'http://localhost:8787/api/v1/catalog?career=sistemas'
```

## 6. Publish to remote D1

Authenticate Wrangler if necessary:

```bash
npx wrangler login
```

After local verification, run the same importer with `--remote`:

```bash
uv run python importer.py mindbox --activate --remote
```

For a single career:

```bash
uv run python importer.py mindbox \
  --career sistemas \
  --activate \
  --remote
```

The remote command uses the D1 database configured in `api/wrangler.toml`.
Verify the deployment through the public API or a configured Worker URL after
the command finishes.

## 7. Historical HazTuHorario data

Scrape the public historical source:

```bash
cd scraper/haztuhorario
uv sync
uv run python -m haztuhorario --filename haztuhorario-reviews.json
```

Then import the generated artifact locally or remotely using `importer.py
legacy`. This replaces the legacy summaries and comments; it does not replace
current Mindbox sections or current student evaluations.

## 8. Full reset workflow

`import_all.py` is destructive. It deletes local or remote catalog, teacher,
term, evaluation-answer, and legacy-import rows before rebuilding them. Use it
only when a complete rebuild is intended:

```bash
uv run python import_all.py
```

It uses the current term by default, supports `--term-code` and `--term-name`,
and can target remote D1 with `--remote`. Review its fuzzy name prompts before
confirming. Keep a database export or backup plan before using `--remote`.

## Failure handling

- A scraper failure does not invalidate successful career artifacts.
- A regular importer failure is reported by career; rerun that career after
  correcting the artifact or credentials.
- A successful career import is committed independently of another career's
  failure.
- Do not activate a new term until its catalog has been checked locally.
- If a remote import is incomplete, rerun the affected career(s) and verify
  `/api/v1/terms` and `/api/v1/catalog`.
