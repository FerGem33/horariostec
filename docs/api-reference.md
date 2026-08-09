# API reference

The API is a Python Cloudflare Worker backed by D1. The browser never talks to
D1 directly. The base URL is the deployed Worker URL in production or
`http://localhost:8787` during local development.

## Health and directories

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Returns `{ "status": "ok" }`. |
| `GET` | `/api/v1/terms` | Lists terms, including `is_active`. |
| `GET` | `/api/v1/careers` | Lists careers with subject and teacher counts. |
| `GET` | `/api/v1/subjects` | Lists subjects, optionally filtered by `career` and `term`. |
| `GET` | `/api/v1/catalog` | Lists schedule sections, optionally filtered by `career` and `term`. |

When `term` is omitted from `/subjects`, subjects are collected across imported
terms. When `term` is omitted from `/catalog`, only the active term is used.
`career` is a slug such as `sistemas`.

Examples:

```bash
curl http://localhost:8787/api/v1/terms
curl 'http://localhost:8787/api/v1/subjects?career=sistemas&term=2026-2'
curl 'http://localhost:8787/api/v1/catalog?career=sistemas'
```

## Teachers and reviews

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/teachers` | Search/filter teachers with current and legacy ratings. |
| `GET` | `/api/v1/teachers/{id}` | Teacher profile, subjects, and rating summary. |
| `GET` | `/api/v1/teachers/{id}/evaluations` | Visible current evaluations. Supports `subject_id` and `term_id`. |
| `POST` | `/api/v1/teachers/{id}/evaluations` | Creates an anonymous evaluation. |
| `GET` | `/api/v1/teachers/{id}/legacy` | Returns historical HazTuHorario data. |
| `POST` | `/api/v1/comments/{evaluation\|legacy}/{comment_id}/vote` | Adds, changes, or removes an anonymous comment vote. |

Teacher search accepts `career`, `subject_id`, and `search`. Searches are
case-insensitive and the API validates career slugs and positive IDs.

Evaluation payloads use a `global_rating` from `0` to `100`, five-point
experience answers, optional `0`–`100` method weights, and an optional
`subject_id` and comment. New evaluations are associated with the active term
when one exists. The current API stores evaluations as `visible` or `hidden`;
the public MVP does not yet expose a moderation dashboard.

## Response and security notes

- Responses are JSON and include CORS headers for the configured frontend
  origin.
- Published catalogs and visible reviews are public data.
- D1 credentials and import commands stay on the operator's machine.
- The current MVP accepts anonymous evaluation and voting requests; abuse
  prevention and moderation remain operational responsibilities.
