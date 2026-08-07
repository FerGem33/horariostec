# HorariosTec — MVP Architecture

## 1. Goals

The MVP must:

- Help students select compatible subjects and generate class schedules.
- Provide public teacher ratings and reviews.
- Import subject, group, teacher, and schedule data from the Instituto Tecnológico de Saltillo Mindbox portal.
- Remain available throughout the year.
- Handle a short period of high traffic before subject selection while remaining nearly free during the rest of the year.
- Avoid requiring student accounts in the MVP.

The initial infrastructure target is less than MXN 600 per year, excluding development time and the domain name.

## 2. Architecture decision

The MVP will use a serverless Cloudflare architecture:

```text
Student browser
        |
        v
Cloudflare Pages
  React static frontend
        |
        v
Cloudflare Worker
  Python API
        |
        v
Cloudflare D1
  SQLite database

Python scraper and publisher
  Run manually from an administrator's computer
```

The frontend will be deployed on Cloudflare Pages. The public API will run as a Python Worker and will access the database through a D1 binding. The scraper will not run as part of the public application; it will be executed manually before a semester is published.

## 3. Why this architecture

The application's usage is highly seasonal. It is mostly idle during the year, receives moderate usage for teacher reviews, and receives a concentrated burst during the two or three weeks before subject selection.

A permanently running EC2 instance would charge for compute even when nobody is using the application. Cloudflare Workers and D1 scale with requests and provide free usage limits that are appropriate for the expected MVP workload.

The schedule-generation algorithm will run in the student's browser. The API will provide versioned semester data, teacher information, and review operations. This prevents every student from consuming server CPU while generating combinations.

## 4. Components

### 4.1 React frontend on Cloudflare Pages

Responsibilities:

- Render the schedule builder and teacher-review pages.
- Download the active semester snapshot.
- Filter subjects, groups, teachers, and time slots.
- Generate compatible schedules locally in the browser.
- Submit ratings and comments to the API.
- Display cached or static content whenever possible.

The frontend should be built as a static application. It must not contain Mindbox credentials, administrative secrets, or database credentials.

### 4.2 Python Worker API

The API will be implemented as a Python Worker. Cloudflare Python Workers run Python through Pyodide/WebAssembly and can access Cloudflare bindings such as D1 and secrets.

The first implementation should prefer the native Worker `fetch` handler for small endpoints. FastAPI may be introduced if it provides a clear benefit and is compatible with the required Worker runtime.

Initial API responsibilities:

- Return the active semester and its catalog.
- Return subjects, groups, schedules, and teachers.
- Return teacher rating summaries and reviews.
- Accept anonymous ratings and comments.
- Verify Turnstile challenges when required.
- Expose protected administrative import/publication endpoints.

The API must remain stateless. Persistent data belongs in D1, and temporary files must not be relied upon because the Worker filesystem is ephemeral.

### 4.3 Cloudflare D1

D1 will be the MVP database. It is a SQLite-based database managed by Cloudflare and accessed through a Worker binding.

The initial schema should include entities similar to:

- `careers`
- `terms`
- `subjects`
- `sections`
- `teachers`
- `class_meetings`
- `imports`
- `published_snapshots`
- `teacher_ratings`
- `teacher_reviews`
- `reports`

The schema must include indexes for the fields most often used by the frontend and API, especially active term, career, subject, teacher, and import status.

D1 is sufficient for the expected catalog and review workload. The schema and data-access layer should avoid unnecessary vendor-specific features so that migration to PostgreSQL remains possible if the project grows.

### 4.4 Python scraper and publisher

The scraper will remain a local Python tool based on the existing MindScrap project. It will initially use direct authenticated HTTP requests when possible. Playwright may be added later if Mindbox requires browser-based login or dynamic token extraction.

The scraper will:

1. Authenticate to Mindbox using a dedicated account for each career.
2. Fetch the available semesters and groups for that career.
3. Store raw responses locally for troubleshooting.
4. Normalize names, subjects, teachers, groups, and meeting times.
5. Validate the imported data.
6. Produce a versioned import artifact.
7. Publish the validated artifact to D1 through an administrative script or protected API endpoint.

The scraper will not run for student requests and will not run during the traffic peak.

## 5. Mindbox credentials

Mindbox requires authenticated sessions and may expose different subject data depending on the career account. Credentials must be treated as administrative secrets.

Rules:

- Use dedicated institutional accounts whenever possible.
- Never expose credentials to the frontend or public API.
- Never commit credentials, cookies, tokens, or raw authenticated responses to Git.
- Never write credentials or session cookies to application logs.
- Store credentials locally in a secret file or environment variables during manual imports.
- Rotate credentials when an account owner changes.
- Keep an audit record of import date, career, result, and administrator, but not the credentials themselves.

The scraper must support both of these modes:

- HTTP mode using exported cookies/tokens when the existing MindScrap flow works.
- Browser mode using Playwright when login and token acquisition must be automated.

Selenium or Playwright cannot be used inside a Cloudflare Worker. Browser automation belongs in the local administrative scraper or another separate execution environment.

## 6. Versioned imports and publication

An import must never modify the active catalog directly. The process should use a staging import:

```text
started -> fetching -> normalized -> validated -> published
                                      \-> failed
```

The import should be published atomically after validation. If a scrape fails or returns incomplete data, the previous published snapshot remains active.

Each published catalog must identify its academic term, career, source import, publication timestamp, and data version. This prevents data from different semesters from being mixed.

## 7. Anonymous teacher reviews

The MVP will not require student accounts. Anyone can submit a rating or review.

This is intentionally weaker than authenticated voting, so the API must include basic abuse controls:

- Validate and sanitize all input.
- Rate-limit review and rating endpoints.
- Use Cloudflare Turnstile when suspicious activity is detected or before submission.
- Store minimal request metadata for abuse prevention.
- Provide an administrative report/hide workflow.
- Do not display hidden or reported reviews automatically.
- Keep ratings separated by academic term when appropriate.

Anonymous submissions cannot guarantee one vote per student. This limitation must be communicated in the product documentation and considered when interpreting rating results.

## 8. Schedule generation

Schedule generation will happen client-side:

1. The API returns the active catalog.
2. The student chooses subjects, groups, teachers, and time preferences.
3. The browser filters conflicting sections.
4. The browser generates compatible combinations.
5. The student can save, share, or download a resulting schedule.

The API should not generate all combinations for every request. This keeps Worker CPU usage low and allows many students to calculate schedules concurrently without putting equivalent load on the backend.

## 9. Security boundaries

Public resources:

- Frontend assets.
- Published academic catalogs.
- Teacher rating summaries.
- Visible reviews.

Protected resources:

- D1 write operations beyond public reviews.
- Import and publication operations.
- Mindbox credentials and session data.
- Administrative reports and moderation actions.

The database must never be exposed directly to the browser. All writes must pass through the Worker API and its validation rules.

## 10. Expected limits and cost

The target deployment uses Cloudflare free plans during the MVP. Current documented limits include 100,000 Worker requests per day, 5 million D1 rows read per day, 100,000 D1 rows written per day, and 5 GB of D1 storage on the free plans.

The expected catalog size and review volume should fit within these limits. Database queries must use indexes to avoid unnecessary full-table scans.

Expected infrastructure cost:

```text
Cloudflare Pages       $0
Python Worker          $0 within free limits
Cloudflare D1          $0 within free limits
Turnstile              $0
Scraper execution      $0 when run locally
Domain                 Separate cost
```

Usage limits and pricing must be checked again before launch. Alerts should be configured if the account is upgraded to a paid plan.

## 11. Known trade-offs

### Python Workers are in beta

Python Workers run through Pyodide rather than a native CPython server. Some packages and runtime features may not work, and threading/multiprocessing are unavailable. The API must remain small and I/O-oriented.

### D1 is not PostgreSQL

D1 is appropriate for the MVP, but it has SQLite semantics and Cloudflare-specific bindings. A repository layer should isolate database access so that PostgreSQL can be adopted later.

### Free limits are not an SLA

The free plans are suitable for the MVP but do not provide the same operational guarantees as paid infrastructure. The project should maintain local exports of published catalogs and review data.

### Anonymous reviews are vulnerable to abuse

Turnstile and rate limiting reduce abuse but do not eliminate it. Stronger identity or voting controls can be introduced after validating the product with real users.

## 12. Migration path

If usage, reliability requirements, or funding increase, the system can evolve in stages:

1. Upgrade Cloudflare Workers and D1 to paid plans.
2. Move the scraper to a private scheduled job.
3. Move D1 to PostgreSQL if relational requirements or reporting become more complex.
4. Run FastAPI on EC2, Lightsail, or another managed container platform.
5. Separate the frontend, API, database, and scraper into independent services.

The initial application should therefore keep the frontend/API boundary, database access, import pipeline, and domain models modular even though the deployment is intentionally small.
