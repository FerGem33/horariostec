# HorariosTec API

Python Worker API backed by Cloudflare D1.

The Worker currently exposes:

- `GET /api/health`
- `GET /api/v1/terms`
- `GET /api/v1/careers`
- `GET /api/v1/teachers?search=martinez`
- `GET /api/v1/subjects?career=sistemas&term=2026-2`
- `GET /api/v1/catalog?career=sistemas&term=2026-2`
- `GET /api/v1/teachers/{id}`
- `GET /api/v1/teachers/{id}/evaluations`
- `POST /api/v1/teachers/{id}/evaluations`
- `GET /api/v1/teachers/{id}/legacy`
- `POST /api/v1/comments/{evaluation|legacy}/{comment_id}/vote`

The catalog and subject endpoints use the active term when `term` is omitted.
Providing `term` selects that term explicitly. Catalog results contain one
entry per section with its teacher and class meetings, which allows the
schedule builder to calculate combinations in the browser.

Directory endpoints return JSON collections under `terms`, `careers`,
`subjects`, and `teachers`. Teacher search is case-insensitive. Career and
subject relationships include all imported Mindbox terms, while catalog
without an explicit term continues to use the active term.

New evaluations are linked to a teacher, an active academic term, and an
optional subject. The global rating uses `0..100`. Other answers use `1..5`,
while evaluation-method weights use optional `0..100` percentages and do not
need to add up to 100.

Example submission:

```json
{
  "subject_id": null,
  "global_rating": 92,
  "answers": {
    "attendance_weight": 10,
    "assignments_weight": 30,
    "exams_weight": 40,
    "projects_weight": 20,
    "fairness": 5,
    "explains": 4,
    "attitude": 5,
    "accessibility": 4,
    "difficulty": 3
  },
  "comment": "Explica claramente y responde dudas."
}
```

Legacy data is intentionally kept separate and is returned by the `legacy`
endpoint with `source: "HazTuHorario"`. It is intended to be imported later
from the original site and should not be mixed with new evaluation averages.
The legacy summary is one aggregate record per teacher containing the total
review count and the six historical metrics; legacy comments are stored
separately.

## Setup

Install the Python Worker tooling and dependencies:

```bash
uv sync
```

Create the D1 database once, then copy its ID into `wrangler.toml`:

```bash
npx wrangler d1 create horariostec
```

Apply the schema locally:

```bash
npx wrangler d1 migrations apply horariostec --local
```

Start the local Worker:

```bash
uv run pywrangler dev
```

Deploy after configuring the real D1 ID:

```bash
npx wrangler d1 migrations apply horariostec --remote
npx wrangler deploy
```

Python Workers are currently beta. The Worker intentionally uses the native
`fetch` handler and D1 bindings, keeping the API small and avoiding a web
framework dependency in the Worker runtime.

## Local data imports

The importer runs from this directory and writes to Wrangler's local D1
database. Apply the schema first:

```bash
npx wrangler d1 migrations apply horariostec --local
```

Import the historical HazTuHorario snapshot:

```bash
uv run python importer.py legacy \
  --input ../scraper/haztuhorario/output/reviews.json
```

Import a Mindbox artifact. The selected career and term are replaced inside
one transaction, so rerunning this command safely refreshes that catalog.
Other terms and careers are left untouched. Use `--activate` when this should
be the catalog served by the active-term API endpoints:

```bash
uv run python importer.py mindbox \
  --input ../scraper/mindbox/output/sistemas-2026-2.json \
  --career sistemas \
  --term-code 2026-2 \
  --term-name "Agosto - Diciembre 2026" \
  --activate
```

The legacy import replaces all previously imported legacy summaries and
comments. Mindbox imports remove only the selected career/term sections;
teachers and subjects are retained so their IDs and review relationships stay
stable even when a semester's offerings change.
