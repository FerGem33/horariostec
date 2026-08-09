# HorariosTec architecture

## Current system

```text
Student browser
      │ HTTPS
      ▼
Cloudflare Pages / Vite static app
      │ JSON requests
      ▼
Cloudflare Python Worker
      │ D1 binding
      ▼
Cloudflare D1 (SQLite)

Operator machine
  ├─ Mindbox Playwright scraper ── JSON artifacts
  ├─ HazTuHorario scraper ──────── JSON artifact
  └─ importer.py / import_all.py ── D1 writes
```

The frontend generates schedules in the browser. It downloads the active
catalog from `/api/v1/catalog`, filters sections by availability and conflicts,
and can export a selected result as a PDF. It does not persist schedules.

The API exposes public catalog, teacher, review, and comment-vote routes. D1 is
not exposed to the browser. The Worker uses the `DB` binding configured in
`api/wrangler.toml`.

## Data model

- `terms` identifies academic terms and one can be active.
- `careers` contains stable slugs and display names.
- `subjects` belongs to a career and semester.
- `sections` connects a term, career, subject, teacher, and group.
- `class_meetings` stores the day, time, and room for a section.
- `teachers` uses a normalized name as its stable identity.
- `legacy_teacher_summaries` and `legacy_comments` hold HazTuHorario data.
- `teacher_evaluations` and `evaluation_answers` hold current anonymous input.
- `comment_votes` stores anonymous like/dislike records.

Mindbox imports replace only `sections` for the selected career and term. The
subjects and teachers are retained and reused. Legacy data and current
evaluations are separate from catalog replacement.

## Update flow

The update flow is intentionally operator-run:

1. Authenticate to Mindbox using one account per career.
2. Scrape current offerings into one JSON artifact per career.
3. Audit teacher-name matches against legacy data.
4. Apply migrations if the schema changed.
5. Import and inspect the new term in local D1.
6. Publish the verified artifacts to remote D1 with `--activate`.
7. Verify `/api/v1/terms`, `/api/v1/catalog`, and the deployed frontend.

See [the data update runbook](data-update.md) for exact commands and failure
handling.

## Deployment boundaries

The frontend can be deployed independently to Cloudflare Pages. The Worker
deployment and D1 migrations are controlled from `api/`. The scraper is never
part of the public runtime and must not be moved into the Worker: Playwright,
credentials, and browser sessions belong on the operator machine.

## Current limitations and roadmap

The following are not implemented yet:

- automated scheduled scraping or publication;
- a staging/published snapshot table and atomic multi-career release;
- a protected administrative import endpoint;
- a moderation dashboard and complete abuse-control workflow;
- automated backups and rollback tooling;
- CI configuration for tests, builds, or deployment.

Until these exist, the operator runbook and local-before-remote verification
are the release controls.
