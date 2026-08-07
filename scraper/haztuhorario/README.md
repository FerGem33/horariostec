# HazTuHorario scraper

This scraper reads the public HazTuHorario teacher pages. It intentionally
does not preserve individual review records. It calculates the historical
aggregate metrics from the embedded review data, and preserves the public
comments and total review count.

## Setup

```bash
cd scraper/haztuhorario
uv sync
```

Import every career:

```bash
uv run python -m haztuhorario \
  --filename haztuhorario-reviews.json
```

Import one career:

```bash
uv run python -m haztuhorario \
  --career Sistemas \
  --filename haztuhorario-sistemas.json
```

Teacher names are normalized to a consistent display form such as
`Claudia Hernandez Perez`, while accents are preserved. The artifact
contains one aggregate record per teacher:

```json
{
  "name": "Claudia Hernandez Perez",
  "review_count": 20,
  "metrics": {
    "fair_percent": 94.5,
    "explains_well_percent": 96.2,
    "hard_percent": 42.1,
    "homework_percent": 47.8,
    "attendance_percent": 88.4,
    "general_score": 91.0
  },
  "comments": []
}
```