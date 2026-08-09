# Mindbox scraper

This is the Mindbox scraper. The separate `../haztuhorario` project is the
HazTuHorario scraper for importing historical teacher reviews.

This directory contains the semester data importer for HorariosTec.

The scraper is intentionally independent from the public API. It runs manually
with a dedicated Mindbox account for each career and writes a JSON artifact.
The separate API importer publishes verified artifacts to local or remote D1;
see [`../../docs/data-update.md`](../../docs/data-update.md).

## Setup

```bash
cd scraper/mindbox
uv sync
```

## Playwright setup

Install the Python dependencies and the Chromium browser:

```bash
uv sync
uv run playwright install chromium
```

## Authenticate

Create a local credentials file from the example:

```bash
cp credentials.example.json credentials.json
```

Edit `credentials.json` and add one entry for each career account. The file is
ignored by Git and must never be committed:

```json
{
  "sistemas": {
    "username": "your_matricula",
    "password": "your_password"
  }
}
```

The supported career identifiers are:

```text
sistemas
mecatronica
mecanica
industrial
electrica
electronica
gestion
materiales
```

Create a persistent authenticated session for one career. The command opens a
visible browser so that Mindbox can handle any additional login challenge:

```bash
uv run python -m scraper auth \
  --career sistemas \
  --headed
```

The scraper loads the matching matrícula and password from `credentials.json`.
The session is saved under `sessions/` and must never be committed. If the
session expires, run the authentication command again.

## Scrape semesters

By default, the scraper reads the semester options displayed by Mindbox and
imports every available semester in one run. The output filename is automatic:
`{career}-{year}-{term}.json`, where term is `1` from January through July and
`2` from August through December.

```bash
uv run python -m scraper scrape \
  --career sistemas
```

To scrape every supported career, omit `--career`. Each career is written to
its own automatic output file. If one career fails, the others still run and
all failures are reported at the end:

```bash
uv run python -m scraper scrape
```

If the saved session has expired, add `--auth` to authenticate immediately
before scraping. This can also be used with the all-careers command:

```bash
uv run python -m scraper scrape \
  --career sistemas \
  --auth \
  --headed
```

Use `--filename` when scraping one career and you need a custom name. The
value is treated as a filename in `output/` (a `.json` extension is added when
omitted).

To scrape only selected semesters:

```bash
uv run python -m scraper scrape \
  --career sistemas \
  --semester 7 8
```

Run the tests with:

```bash
uv run python -m unittest discover -s tests -v
```

The generated artifact contains metadata, the import timestamp, and normalized class offerings. It does not contain cookies or authentication tokens.
