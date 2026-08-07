# Scrapers

This directory contains the two importers used by HorariosTec.

## Mindbox scraper

Path: [`mindbox/`](mindbox/)

Imports current subjects, sections, teachers, credits, and schedules from the
authenticated Instituto Tecnológico de Saltillo Mindbox portal.

```bash
cd mindbox
uv run python -m scraper scrape \
  --career sistemas \
  --filename sistemas-2026-2.json
```

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

If `--filename` is omitted, the scraper prompts for the filename. Outputs are
always written to the corresponding scraper's `output/` directory.
