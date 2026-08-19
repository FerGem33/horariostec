from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from requests import RequestException

from .client import HazTuHorarioClient
from .models import LegacyArtifact
from .normalization import comparison_key
from .parser import ParseError


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import teacher reviews from HazTuHorario")
    parser.add_argument("--career", action="append", help="Career to import; default: all careers")
    parser.add_argument("--filename", help="Output filename only; otherwise prompt")
    parser.add_argument("--base-url", default="https://haztuhorario.com")
    return parser.parse_args()


def output_path(filename: str | None) -> Path:
    value = filename or input("Output filename: ").strip()
    if not value:
        raise ValueError("Output filename cannot be empty")
    path = Path(value)
    if path.name != value:
        raise ValueError("Provide a filename only, not a path")
    if path.suffix.lower() != ".json":
        path = path.with_suffix(".json")
    return OUTPUT_DIR / path.name


def main() -> int:
    args = parse_args()
    destination = output_path(args.filename)
    client = HazTuHorarioClient(args.base_url)
    careers = args.career or client.careers()
    teacher_entries: dict[str, tuple[str, str]] = {}

    for career in careers:
        try:
            entries = client.teacher_entries(career)
        except (ParseError, RequestException) as error:
            print(f"Skipping career without a published teacher page: {career} ({error})")
            continue

        if not entries:
            print(f"Skipping career without a published teacher page: {career}")
            continue

        for name, path in entries:
            key = comparison_key(name)
            if key not in teacher_entries:
                teacher_entries[key] = (name, path)

    teachers = []
    sorted_items = sorted(teacher_entries.values(), key=lambda item: comparison_key(item[0]))
    for index, (name, path) in enumerate(sorted_items, start=1):
        print(f"[{index}/{len(sorted_items)}] {name}")
        try:
            teachers.append(client.teacher(path))
        except (ParseError, RequestException) as error:
            print(f"Skipping unavailable teacher profile: {name} ({error})")

    artifact = LegacyArtifact(
        schema_version=1,
        source={"system": "haztuhorario", "base_url": args.base_url},
        teachers=teachers,
    ).to_dict()
    artifact["fetched_at"] = datetime.now(timezone.utc).isoformat()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(teachers)} teachers into {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
