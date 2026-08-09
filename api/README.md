# HorariosTec API

Python Worker API backed by Cloudflare D1.

For the repository-wide setup and deployment model, see
[`../docs/development.md`](../docs/development.md) and
[`../docs/architecture.md`](../docs/architecture.md). For the complete
scrape-to-publication procedure, see
[`../docs/data-update.md`](../docs/data-update.md).

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

Audit teacher names across the HazTuHorario and Mindbox artifacts before an
import. The report is read-only and includes exact normalized matches plus
fuzzy matches that need manual confirmation:

```bash
uv run python audit_teacher_names.py --json /tmp/teacher-name-audit.json
```

The importer ignores accents, punctuation, name order, and common academic
titles such as `Dr.` or `Ing.` when assigning a teacher key. It keeps the
original display name and does not automatically merge ambiguous fuzzy matches.

To start over and import every current artifact in one transaction, use the
interactive reset command. It uses the current academic term by default;
exact normalized matches are combined automatically and fuzzy matches are
presented one by one at the end:

```bash
uv run python import_all.py
```

This deletes the local D1 contents first, including reviews, catalog, teachers,
terms, and careers. Run it only when a full rebuild is intended.

Import Mindbox artifacts. With no extra options, the importer uses the current
academic term and finds artifacts in `../scraper/mindbox/output/` using the
`{career}-{term}.json` naming convention. Omit `--career` to import every
career; failed careers are skipped and summarized after all attempts. Other
terms and careers are left untouched. Use `--activate` when this should be
the catalog served by the active-term API endpoints:

```bash
uv run python importer.py mindbox \
  --career sistemas \
  --activate
```

To import all careers for the current term:

```bash
uv run python importer.py mindbox --activate
```

The current term is inferred as `1` from January through July and `2` from
August through December. Its name is generated as `Enero - Junio YEAR` or
`Agosto - Diciembre YEAR`. Use `--input` and `--career` for a custom
single-career artifact, or provide `--term-code` to import a different term.

The legacy import replaces all previously imported legacy summaries and
comments. Mindbox imports remove only the selected career/term sections;
teachers and subjects are retained so their IDs and review relationships stay
stable even when a semester's offerings change.
