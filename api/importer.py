from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any, Iterable


API_DIR = Path(__file__).resolve().parent
MINDBOX_OUTPUT_DIR = API_DIR.parent / "scraper/mindbox/output"
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
TEACHER_TITLES = {
    "dr", "dra", "doctor", "doctora", "ing", "ingeniero", "ingeniera",
    "lic", "licenciado", "licenciada", "mtro", "mtra", "maestro", "maestra",
    "prof", "profr", "profesor", "profesora",
}


def sql_value(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def sql_statements(statements: Iterable[str], *, transaction: bool = True) -> str:
    body = "\n".join(statement.rstrip(";") + ";" for statement in statements)
    if transaction:
        return "PRAGMA foreign_keys = ON;\nBEGIN TRANSACTION;\n" + body + "\nCOMMIT;\n"
    return "PRAGMA foreign_keys = ON;\n" + body + "\n"


def normalized_teacher_name(name: str) -> str:
    """Create an order-independent key for surname-first and given-name-first data."""

    folded = unicodedata.normalize("NFKD", name.casefold())
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    tokens = [token for token in re.findall(r"[a-z0-9]+", folded) if token not in TEACHER_TITLES]
    return " ".join(sorted(tokens))


def display_teacher_name(name: str) -> str:
    return " ".join(part[:1].upper() + part[1:].lower() for part in name.split())


def display_subject_name(name: str) -> str:
    """Normalize Mindbox subject labels for consistent display across imports."""

    clean = " ".join(name.split())
    roman_numerals = {"I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"}
    lowercase_words = {"a", "al", "con", "de", "del", "e", "el", "en", "la", "las", "los", "para", "por", "y"}
    words = []
    for index, word in enumerate(clean.split(" ")):
        normalized = word.upper()
        if normalized in roman_numerals:
            words.append(normalized)
        elif index > 0 and word.casefold() in lowercase_words:
            words.append(word.lower())
        else:
            words.append(word[:1].upper() + word[1:].lower())
    return " ".join(words)


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


def current_term(today: date | None = None) -> tuple[str, str]:
    """Return the current academic term code and its Spanish display name."""

    today = today or date.today()
    number = 1 if today.month <= 7 else 2
    if number == 1:
        name = f"Enero - Junio {today.year}"
    else:
        name = f"Agosto - Diciembre {today.year}"
    return f"{today.year}-{number}", name


def default_mindbox_input(career: str, term_code: str) -> Path:
    return MINDBOX_OUTPUT_DIR / f"{career}-{term_code}.json"


def teacher_upsert(name: str, *, normalized: str | None = None) -> str:
    normalized = normalized or normalized_teacher_name(name)
    accented = " + ".join(
        f"(instr(excluded.display_name, {sql_value(character)}) > 0)"
        for character in "áéíóúüñÁÉÍÓÚÜÑ"
    )
    existing_accented = " + ".join(
        f"(instr(teachers.display_name, {sql_value(character)}) > 0)"
        for character in "áéíóúüñÁÉÍÓÚÜÑ"
    )
    return (
        "INSERT INTO teachers (normalized_name, display_name) VALUES "
        f"({sql_value(normalized)}, {sql_value(display_teacher_name(name))}) "
        "ON CONFLICT(normalized_name) DO UPDATE SET display_name = "
        f"CASE WHEN ({accented}) > ({existing_accented}) "
        "THEN excluded.display_name ELSE teachers.display_name END"
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
    aliases: dict[str, str] | None = None,
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
        subject = display_subject_name(str(offering.get("subject") or "").strip())
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
        teacher_key = (aliases or {}).get(normalized_teacher_name(teacher), normalized_teacher_name(teacher))
        statements.append(teacher_upsert(teacher, normalized=teacher_key))
        teacher_id = (
            f"(SELECT id FROM teachers WHERE normalized_name = "
            f"{sql_value(teacher_key)})"
        )
        source_key = f"{term_code}:{career}:{semester}:{course_code or subject}:{group or ''}:{teacher_key}"
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


def execute_sql(sql: str, *, database: str, sql_file: Path | None, remote: bool = False) -> None:
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
            ["npx", "wrangler", "d1", "execute", database, "--remote" if remote else "--local", f"--file={sql_path}"],
            cwd=API_DIR,
            check=True,
        )
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def import_mindbox_career(
    args: argparse.Namespace,
    *,
    career: str,
    term_code: str,
    term_name: str,
) -> None:
    input_path = args.input or default_mindbox_input(career, term_code)
    artifact = load_json(input_path)
    statements = mindbox_sql(
        artifact,
        career=career,
        term_code=term_code,
        term_name=term_name,
        activate=args.activate,
    )
    execute_sql(
        sql_statements(statements, transaction=not args.remote),
        database=args.database,
        sql_file=args.sql_file,
        remote=args.remote,
    )
    location = "remote" if args.remote else "local"
    print(f"Imported {career} data from {input_path} into {location} D1 database {args.database}")


def run_mindbox_import(args: argparse.Namespace) -> int:
    term_code, term_name = current_term()
    term_code = args.term_code or term_code
    term_name = args.term_name or current_term_name(term_code)
    careers = (args.career,) if args.career else tuple(CAREER_NAMES)
    failures: list[tuple[str, Exception]] = []

    for career in careers:
        input_path = args.input or default_mindbox_input(career, term_code)
        print(f"Importing {career} from {input_path}...", flush=True)
        try:
            import_mindbox_career(
                args,
                career=career,
                term_code=term_code,
                term_name=term_name,
            )
        except Exception as error:
            failures.append((career, error))

    if failures:
        print("\nMindbox import failures (successful careers were kept):", file=sys.stderr)
        for career, error in failures:
            print(f"- {career}: {error}", file=sys.stderr)
        return 1
    return 0


def current_term_name(term_code: str) -> str:
    year, number = term_code.split("-", maxsplit=1)
    if number == "1":
        return f"Enero - Junio {year}"
    if number == "2":
        return f"Agosto - Diciembre {year}"
    raise ValueError(f"Unsupported term code: {term_code}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import local HorariosTec D1 data")
    subparsers = parser.add_subparsers(dest="command", required=True)

    legacy = subparsers.add_parser("legacy", help="Replace the HazTuHorario import")
    legacy.add_argument("--input", type=Path, required=True)
    legacy.add_argument("--database", default="horariostec")
    legacy.add_argument("--sql-file", type=Path)

    mindbox = subparsers.add_parser("mindbox", help="Replace Mindbox career/term catalogs")
    mindbox.add_argument(
        "--input",
        type=Path,
        help="Artifact for one career; default: output/{career}-{term}.json",
    )
    mindbox.add_argument(
        "--career",
        choices=tuple(CAREER_NAMES),
        help="Career to import; omit to import every career",
    )
    mindbox.add_argument("--term-code", help="Stable code; default: current academic term")
    mindbox.add_argument("--term-name", help="Display name; default: derived from term code")
    mindbox.add_argument("--activate", action="store_true")
    mindbox.add_argument("--database", default="horariostec")
    mindbox.add_argument("--sql-file", type=Path)
    mindbox.add_argument("--remote", action="store_true", help="Write to the deployed remote D1 database")
    args = parser.parse_args()

    if args.command == "legacy":
        artifact = load_json(args.input)
        statements = legacy_sql(artifact)
        execute_sql(sql_statements(statements), database=args.database, sql_file=args.sql_file)
        print(f"Imported {args.command} data into local D1 database {args.database}")
        return 0
    else:
        if not args.career and (args.input or args.sql_file):
            raise ValueError("--input and --sql-file require --career")
        return run_mindbox_import(args)


if __name__ == "__main__":
    raise SystemExit(main())
