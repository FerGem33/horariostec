"""Reset and import all local HorariosTec source artifacts.

Exact matches are combined automatically by the importer. Fuzzy matches are
shown at the end of the preflight and require explicit confirmation.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from audit_teacher_names import audit, load_records
from importer import CAREER_NAMES, execute_sql, legacy_sql, load_json, mindbox_sql, sql_statements, normalized_teacher_name, sql_value


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LEGACY = ROOT / "scraper/haztuhorario/output/reviews.json"
DEFAULT_MINDBOX = ROOT / "scraper/mindbox/output"


def reset_statements() -> list[str]:
    statements = [
        "DELETE FROM evaluation_answers",
        "DELETE FROM teacher_evaluations",
        "DELETE FROM legacy_comments",
        "DELETE FROM legacy_teacher_summaries",
        "DELETE FROM class_meetings",
        "DELETE FROM sections",
        "DELETE FROM subjects",
        "DELETE FROM teachers",
        "DELETE FROM terms",
        "DELETE FROM careers",
    ]
    statements.extend(
        f"INSERT INTO careers (slug, name) VALUES ({sql_value(slug)}, {sql_value(name)})"
        for slug, name in CAREER_NAMES.items()
    )
    return statements


def ask_fuzzy_matches(matches: list[dict]) -> dict[str, str]:
    aliases: dict[str, str] = {}
    if not matches:
        print("No hay coincidencias difusas pendientes de confirmar.")
        return aliases
    print(f"\nHay {len(matches)} coincidencia(s) sensible(s) para revisión:")
    for index, match in enumerate(matches, 1):
        print(f"\n{index}. HazTuHorario: {match['legacy']}\n   Mindbox: {match['mindbox']}\n   Similaridad: {match['sequence']} / tokens: {match['token_overlap']}")
        answer = input("¿Combinar estos registros? [s/N]: ").strip().casefold()
        if answer in {"s", "si", "sí", "y", "yes"}:
            aliases[normalized_teacher_name(match["mindbox"])] = normalized_teacher_name(match["legacy"])
    return aliases


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy", type=Path, default=DEFAULT_LEGACY)
    parser.add_argument("--mindbox", type=Path, action="append", help="Mindbox artifact; defaults to all output/*.json")
    parser.add_argument("--term-code", default="2026-2")
    parser.add_argument("--term-name", default="Agosto - Diciembre 2026")
    parser.add_argument("--database", default="horariostec")
    parser.add_argument("--sql-file", type=Path, help="Write the SQL instead of using a temporary file")
    args = parser.parse_args()

    mindbox_paths = args.mindbox or sorted(DEFAULT_MINDBOX.glob("*.json"))
    records = load_records([args.legacy], mindbox_paths)
    report = audit(records)
    print(f"Coincidencias seguras normalizadas: {len(report['exact_matches'])}")
    aliases = ask_fuzzy_matches(report["fuzzy_matches"])

    statements = reset_statements()
    statements.extend(legacy_sql(load_json(args.legacy)))
    for path in mindbox_paths:
        artifact = load_json(path)
        statements.extend(mindbox_sql(
            artifact,
            career=artifact["career"],
            term_code=args.term_code,
            term_name=args.term_name,
            activate=True,
            aliases=aliases,
        ))
    execute_sql(sql_statements(statements), database=args.database, sql_file=args.sql_file)
    print(f"Base reiniciada e importada: {len(mindbox_paths)} catálogo(s), {len(aliases)} coincidencia(s) difusa(s) combinada(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
