from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path
from typing import Any, Iterable


API_DIR = Path(__file__).resolve().parent
CAREER_NAMES = {
    "sistemas": "Sistemas",
    "mecatronica": "Mecatrónica",
    "mecanica": "Mecánica",
    "industrial": "Industrial",
    "electrica": "Eléctrica",
    "electronica": "Electrónica",
    "gestion": "Gestión Empresarial",
    "materiales": "Materiales",
}
DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
TIME_PATTERN = re.compile(r"^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})(?:\s+(.*))?$")


def sql_value(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def sql_statements(statements: Iterable[str]) -> str:
    return "PRAGMA foreign_keys = ON;\nBEGIN TRANSACTION;\n" + "\n".join(
        statement.rstrip(";") + ";" for statement in statements
    ) + "\nCOMMIT;\n"


def normalized_teacher_name(name: str) -> str:
    """Create an order-independent key for surname-first and given-name-first data."""

    folded = unicodedata.normalize("NFKD", name.casefold())
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    tokens = re.findall(r"[a-z0-9]+", folded)
    return " ".join(sorted(tokens))


def display_teacher_name(name: str) -> str:
    return " ".join(part[:1].upper() + part[1:].lower() for part in name.split())


def load_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"Artifact not found: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Artifact is not valid JSON: {path}") from error
    if not isinstance(data, dict):
        raise ValueError(f"Artifact must contain a JSON object: {path}")
    return data


def teacher_upsert(name: str) -> str:
    normalized = normalized_teacher_name(name)
    return (
        "INSERT INTO teachers (normalized_name, display_name) VALUES "
        f"({sql_value(normalized)}, {sql_value(display_teacher_name(name))}) "
        "ON CONFLICT(normalized_name) DO NOTHING"
    )


def legacy_sql(artifact: dict[str, Any]) -> list[str]:
    teachers = artifact.get("teachers")
    if not isinstance(teachers, list):
        raise ValueError("Legacy artifact is missing its teachers list")

    statements = ["DELETE FROM legacy_comments", "DELETE FROM legacy_teacher_summaries"]
    for teacher in teachers:
        if not isinstance(teacher, dict):
            continue
        name = teacher.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        normalized = normalized_teacher_name(name)
        statements.append(teacher_upsert(name))
        teacher_id = f"(SELECT id FROM teachers WHERE normalized_name = {sql_value(normalized)})"
        metrics = teacher.get("metrics") or {}
        statements.append(
            "INSERT INTO legacy_teacher_summaries "
            "(teacher_id, review_count, fair_percent, explains_well_percent, "
            "hard_percent, homework_percent, attendance_percent, general_score, source_url) VALUES "
            f"({teacher_id}, {sql_value(teacher.get('review_count', 0))}, "
            f"{sql_value(metrics.get('fair_percent'))}, {sql_value(metrics.get('explains_well_percent'))}, "
            f"{sql_value(metrics.get('hard_percent'))}, {sql_value(metrics.get('homework_percent'))}, "
            f"{sql_value(metrics.get('attendance_percent'))}, {sql_value(metrics.get('general_score'))}, "
            f"{sql_value(teacher.get('source_url'))})"
        )
        for comment in teacher.get("comments") or []:
            if not isinstance(comment, dict) or not comment.get("content"):
                continue
            statements.append(
                "INSERT INTO legacy_comments "
                "(teacher_id, source_id, body, published_at, source_url) VALUES "
                f"({teacher_id}, {sql_value(comment.get('source_id'))}, "
                f"{sql_value(comment.get('content'))}, {sql_value(comment.get('published_at'))}, "
                f"{sql_value(teacher.get('source_url'))})"
            )
    return statements


def parse_meeting(value: str, *, teacher: str, subject: str, day: str) -> tuple[str, str, str | None]:
    match = TIME_PATTERN.match(value.strip())
    if not match:
        raise ValueError(f"Invalid schedule for {subject} / {teacher} on {day}: {value!r}")
    return match.group(1), match.group(2), match.group(3)


def mindbox_sql(
    artifact: dict[str, Any],
    *,
    career: str,
    term_code: str,
    term_name: str,
    activate: bool,
) -> list[str]:
    if artifact.get("career") != career:
        raise ValueError(f"Artifact career is {artifact.get('career')!r}, expected {career!r}")
    offerings = artifact.get("offerings")
    if not isinstance(offerings, list):
        raise ValueError("Mindbox artifact is missing its offerings list")

    career_name = CAREER_NAMES[career]
    career_id = f"(SELECT id FROM careers WHERE slug = {sql_value(career)})"
    term_id = f"(SELECT id FROM terms WHERE code = {sql_value(term_code)})"
    statements = [
        f"INSERT INTO careers (slug, name) VALUES ({sql_value(career)}, {sql_value(career_name)}) "
        "ON CONFLICT(slug) DO UPDATE SET name = excluded.name",
        f"INSERT INTO terms (code, name) VALUES ({sql_value(term_code)}, {sql_value(term_name)}) "
        "ON CONFLICT(code) DO UPDATE SET name = excluded.name",
    ]
    if activate:
        statements.extend(
            [
                "UPDATE terms SET is_active = 0",
                f"UPDATE terms SET is_active = 1 WHERE code = {sql_value(term_code)}",
            ]
        )
    statements.append(
        f"DELETE FROM sections WHERE term_id = {term_id} AND career_id = {career_id}"
    )

    for index, offering in enumerate(offerings):
        if not isinstance(offering, dict):
            raise ValueError(f"Offering {index} is not an object")
        subject = str(offering.get("subject") or "").strip()
        teacher = str(offering.get("teacher") or "").strip()
        semester = offering.get("semester")
        group = offering.get("group")
        if not subject or not teacher or not isinstance(semester, int):
            raise ValueError(f"Offering {index} is missing subject, teacher, or semester")
        course_code = offering.get("course_code")
        credits = offering.get("credits")
        code_condition = (
            "code IS NULL"
            if course_code is None
            else f"code = {sql_value(course_code)}"
        )
        subject_id = (
            "(SELECT id FROM subjects WHERE career_id = "
            f"{career_id} AND semester = {semester} AND {code_condition} "
            f"AND name = {sql_value(subject)})"
        )
        statements.append(
            "INSERT INTO subjects (career_id, semester, code, name, credits) "
            "SELECT "
            f"{career_id}, {semester}, {sql_value(course_code)}, {sql_value(subject)}, {sql_value(credits)} "
            "WHERE NOT EXISTS "
            f"(SELECT 1 FROM subjects WHERE career_id = {career_id} AND semester = {semester} "
            f"AND {code_condition} AND name = {sql_value(subject)})"
        )
        statements.append(
            f"UPDATE subjects SET credits = {sql_value(credits)} WHERE id = {subject_id}"
        )
        statements.append(teacher_upsert(teacher))
        teacher_id = (
            f"(SELECT id FROM teachers WHERE normalized_name = "
            f"{sql_value(normalized_teacher_name(teacher))})"
        )
        source_key = f"{term_code}:{career}:{semester}:{course_code or subject}:{group or ''}:{normalized_teacher_name(teacher)}"
        statements.append(
            "INSERT INTO sections "
            "(term_id, career_id, subject_id, teacher_id, group_name, source_key) VALUES "
            f"({term_id}, {career_id}, {subject_id}, {teacher_id}, {sql_value(group)}, {sql_value(source_key)})"
        )
        section_id = f"(SELECT id FROM sections WHERE source_key = {sql_value(source_key)})"
        schedule = offering.get("schedule") or {}
        for day_index, day in enumerate(DAYS):
            value = schedule.get(day)
            if not value:
                continue
            start, end, room = parse_meeting(value, teacher=teacher, subject=subject, day=day)
            statements.append(
                "INSERT INTO class_meetings "
                "(section_id, day_of_week, start_time, end_time, room) VALUES "
                f"({section_id}, {day_index}, {sql_value(start)}, {sql_value(end)}, {sql_value(room)})"
            )
    return statements


def execute_sql(sql: str, *, database: str, sql_file: Path | None) -> None:
    temporary: Path | None = None
    if sql_file is None:
        handle = tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8")
        handle.write(sql)
        handle.close()
        sql_path = Path(handle.name)
        temporary = sql_path
    else:
        sql_file.parent.mkdir(parents=True, exist_ok=True)
        sql_file.write_text(sql, encoding="utf-8")
        sql_path = sql_file
    try:
        subprocess.run(
            ["npx", "wrangler", "d1", "execute", database, "--local", f"--file={sql_path}"],
            cwd=API_DIR,
            check=True,
        )
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Import local HorariosTec D1 data")
    subparsers = parser.add_subparsers(dest="command", required=True)

    legacy = subparsers.add_parser("legacy", help="Replace the HazTuHorario import")
    legacy.add_argument("--input", type=Path, required=True)
    legacy.add_argument("--database", default="horariostec")
    legacy.add_argument("--sql-file", type=Path)

    mindbox = subparsers.add_parser("mindbox", help="Replace one Mindbox career/term catalog")
    mindbox.add_argument("--input", type=Path, required=True)
    mindbox.add_argument("--career", choices=tuple(CAREER_NAMES), required=True)
    mindbox.add_argument("--term-code", required=True, help="Stable code, e.g. 2026-2")
    mindbox.add_argument("--term-name", required=True, help="Display name, e.g. Agosto - Diciembre 2026")
    mindbox.add_argument("--activate", action="store_true")
    mindbox.add_argument("--database", default="horariostec")
    mindbox.add_argument("--sql-file", type=Path)
    args = parser.parse_args()

    artifact = load_json(args.input)
    if args.command == "legacy":
        statements = legacy_sql(artifact)
    else:
        statements = mindbox_sql(
            artifact,
            career=args.career,
            term_code=args.term_code,
            term_name=args.term_name,
            activate=args.activate,
        )
    execute_sql(sql_statements(statements), database=args.database, sql_file=args.sql_file)
    print(f"Imported {args.command} data into local D1 database {args.database}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
