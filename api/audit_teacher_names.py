"""Report probable teacher matches between HazTuHorario and Mindbox artifacts.

This tool is intentionally report-only. It does not merge database records, since
two similar names can still belong to different people and need human review.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from importer import normalized_teacher_name


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEGACY = ROOT / "scraper/haztuhorario/output/reviews.json"
DEFAULT_MINDBOX = ROOT / "scraper/mindbox/output"


def load_records(legacy_paths: list[Path], mindbox_paths: list[Path]) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for path in legacy_paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        for teacher in data.get("teachers", []):
            if isinstance(teacher, dict) and isinstance(teacher.get("name"), str):
                records.append({"source": "HazTuHorario", "file": str(path), "name": teacher["name"]})
    for path in mindbox_paths:
        data = json.loads(path.read_text(encoding="utf-8"))
        for offering in data.get("offerings", []):
            if isinstance(offering, dict) and isinstance(offering.get("teacher"), str):
                records.append({"source": "Mindbox", "file": str(path), "name": offering["teacher"]})
    return records


def unique_records(records: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[tuple[str, str]] = set()
    unique: list[dict[str, str]] = []
    for record in records:
        key = (record["source"], record["name"])
        if key not in seen:
            seen.add(key)
            unique.append(record)
    return unique


def fuzzy_score(left: str, right: str) -> tuple[float, float]:
    left_tokens = set(left.split())
    right_tokens = set(right.split())
    overlap = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    sequence = SequenceMatcher(None, left.replace(" ", ""), right.replace(" ", "")).ratio()
    return sequence, overlap


def audit(records: list[dict[str, str]]) -> dict[str, Any]:
    records = unique_records(records)
    by_key: dict[str, list[dict[str, str]]] = defaultdict(list)
    for record in records:
        enriched = {**record, "normalized": normalized_teacher_name(record["name"])}
        by_key[enriched["normalized"]].append(enriched)

    exact: list[dict[str, Any]] = []
    for normalized, matches in sorted(by_key.items()):
        sources = {match["source"] for match in matches}
        names = sorted({match["name"] for match in matches})
        if len(sources) == 2 and len(names) > 1:
            exact.append({"normalized": normalized, "names": names, "files": sorted({match["file"] for match in matches})})

    source_records = {source: [record for record in records if record["source"] == source] for source in ("HazTuHorario", "Mindbox")}
    fuzzy: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for legacy in source_records["HazTuHorario"]:
        legacy_key = normalized_teacher_name(legacy["name"])
        for mindbox in source_records["Mindbox"]:
            mindbox_key = normalized_teacher_name(mindbox["name"])
            if legacy_key == mindbox_key:
                continue
            sequence, overlap = fuzzy_score(legacy_key, mindbox_key)
            if sequence >= 0.86 and overlap >= 0.65:
                pair = (legacy["name"], mindbox["name"])
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                fuzzy.append({"legacy": legacy["name"], "mindbox": mindbox["name"], "sequence": round(sequence, 3), "token_overlap": round(overlap, 3)})
    fuzzy.sort(key=lambda item: (-item["sequence"], -item["token_overlap"], item["legacy"]))
    return {"records": len(records), "exact_matches": exact, "fuzzy_matches": fuzzy}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy", type=Path, action="append", help="HazTuHorario JSON artifact")
    parser.add_argument("--mindbox", type=Path, action="append", help="Mindbox JSON artifact; may be repeated")
    parser.add_argument("--json", dest="json_path", type=Path, help="Also write the report as JSON")
    args = parser.parse_args()
    legacy_paths = args.legacy or [DEFAULT_LEGACY]
    mindbox_paths = args.mindbox or sorted(DEFAULT_MINDBOX.glob("*.json"))
    report = audit(load_records(legacy_paths, mindbox_paths))
    print(f"Registros únicos comparados: {report['records']}")
    print(f"Coincidencias exactas normalizadas: {len(report['exact_matches'])}")
    for match in report["exact_matches"]:
        print(f"  - {' / '.join(match['names'])}")
    print(f"Coincidencias aproximadas para revisión: {len(report['fuzzy_matches'])}")
    for match in report["fuzzy_matches"]:
        print(f"  - {match['legacy']}  <->  {match['mindbox']} (similaridad {match['sequence']}, tokens {match['token_overlap']})")
    if args.json_path:
        args.json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
