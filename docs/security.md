# Security and contribution notes

## Secrets and generated files

Never commit:

- `scraper/mindbox/credentials.json`
- Mindbox session files under `scraper/mindbox/sessions/`
- cookies, exported tokens, or authenticated HTML responses
- `.env.local` or other environment files
- `api/.wrangler/` state, generated SQL, or scraper output artifacts unless a
  deliberately curated fixture is needed for a test

The repository's `.gitignore` covers the normal locations, but contributors
must still check `git status` before committing.

Mindbox credentials are administrative secrets. Use dedicated accounts, limit
access, avoid logging credentials, and rotate them when ownership changes.

## Data boundaries

The frontend is public and has no database binding. The API is the only public
database boundary. Scraper credentials and D1 publication access belong only
to trusted operators.

CORS is allowlisted through `ALLOWED_ORIGINS` in `api/wrangler.toml`. Keep it
limited to the actual frontend origins; do not use `*` for the production API,
especially while it accepts `POST` requests.

Current student evaluations and comment votes are anonymous. Treat them as
untrusted input: validation, visibility status, rate limiting, Turnstile, and
moderation are important before a larger public launch. Do not add a client
feature that assumes anonymous votes identify a unique student.

## Safe data changes

- Add schema changes as a new migration in `api/migrations/`.
- Test migrations locally before applying them remotely.
- Import a new catalog locally, inspect API responses, then publish remotely.
- Use `--activate` only after verifying the term and career data.
- Treat `import_all.py` as destructive; never run it against remote D1 casually.
- Keep a record of who ran a publication, which term was imported, and which
  careers failed, without recording credentials.

## Pull requests

Before opening a pull request:

1. Run the API and scraper Python tests.
2. Run `pnpm build` in `app/`.
3. Run `git diff --check`.
4. Confirm no credentials, sessions, local databases, or generated output are
   included.
5. Update the relevant documentation if a route, command, schema, or data
   contract changed.
