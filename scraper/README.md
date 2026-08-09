# Scrapers

This directory contains the two data scrapers used by HorariosTec. Scraping
only creates local JSON artifacts; it never updates D1. See
[`../docs/data-update.md`](../docs/data-update.md) for the complete scrape,
audit, import, and verification workflow.

## Mindbox scraper

Path: [`mindbox/`](mindbox/)

Imports current subjects, sections, teachers, credits, and schedules from the
authenticated Instituto Tecnológico de Saltillo Mindbox portal.

```bash
cd mindbox
uv run python -m scraper scrape \
  --career sistemas
```

The filename is automatic: `{career}-{year}-{term}.json`, with term `1` from
January through July and term `2` from August through December. Omit
`--career` to scrape every career into its corresponding file; failed careers
are skipped and summarized after all attempts. Add `--auth` (and optionally
`--headed`) to authenticate each career before scraping.

## HazTuHorario scraper

Path: [`haztuhorario/`](haztuhorario/)

Imports historical teacher aggregate statistics, review counts, and comments
from the public HazTuHorario site. It does not import individual historical
review responses.

```bash
cd haztuhorario
uv run python -m haztuhorario \
  --filename haztuhorario-reviews.json
```

If `--filename` is omitted, the HazTuHorario scraper prompts for the filename.
Outputs are always written to the corresponding scraper's `output/` directory.
