from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from .client import MindboxClient
from .models import ClassOffering
from .parser import parse_offerings


def scrape_semesters(
    client: MindboxClient,
    *,
    semesters: Iterable[int],
    career: str,
) -> list[ClassOffering]:
    offerings: list[ClassOffering] = []
    for semester in semesters:
        html = client.fetch_semester(semester)
        offerings.extend(parse_offerings(html, semester=semester, career=career))
    return offerings


def build_artifact(
    offerings: list[ClassOffering],
    *,
    career: str,
    endpoint: str,
    semesters: list[int],
) -> dict:
    return {
        "schema_version": 1,
        "source": {
            "system": "mindbox",
            "endpoint": endpoint,
        },
        "career": career,
        "semesters": semesters,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "offering_count": len(offerings),
        "offerings": [offering.to_dict() for offering in offerings],
    }
