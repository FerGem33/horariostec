from __future__ import annotations

from bs4 import BeautifulSoup

import re

from .models import DAYS, ClassOffering
from .normalization import clean_schedule, clean_text


class ParseError(ValueError):
    """Raised when Mindbox returns an unexpected page structure."""


def _cell_parts(cell) -> list[str]:
    # Mindbox uses <br> and <small> elements inside cells. Newlines preserve
    # those boundaries while avoiding the old parser's nested-list behavior.
    parts = [clean_text(part) for part in cell.get_text("\n", strip=True).split("\n")]
    return [part for part in parts if part]


def _first(parts: list[str]) -> str:
    return parts[0] if parts else ""


def _parse_course_header(cell, value: list[str]) -> tuple[str, str | None, str]:
    """Parse the current Mindbox subject cell.

    The live page renders the code, slash, subject, and teacher as separate
    spans, so using only ``get_text`` can produce ``[code, '/', subject,
    teacher]`` rather than two lines.
    """

    subject_element = cell.find("span", class_="text-mb-primary")
    teacher_element = cell.find("span", class_="text-xs")
    spans = cell.find_all("span")

    if subject_element and teacher_element and spans:
        course_code = clean_text(spans[0].get_text(" ", strip=True))
        subject = clean_text(subject_element.get_text(" ", strip=True))
        teacher = clean_text(teacher_element.get_text(" ", strip=True))
        return subject, course_code or None, teacher

    if "/" in value:
        slash_index = value.index("/")
        course_code = value[slash_index - 1] if slash_index > 0 else ""
        subject = value[slash_index + 1] if slash_index + 1 < len(value) else ""
        teacher = value[slash_index + 2] if slash_index + 2 < len(value) else ""
        return subject, course_code or None, teacher

    header = _first(value)
    teacher = value[1] if len(value) > 1 else ""
    return header, None, teacher


def _parse_credits(value: str) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_offerings(html: str, *, semester: int, career: str) -> list[ClassOffering]:
    """Parse the authenticated groups table returned by Mindbox.

    The current Mindbox format contains subject/teacher, group, credits, and
    one column per day from Monday through Sunday. The older MindScrap format
    is also accepted for backwards compatibility.
    """

    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="table table-bordered table-striped default")
    if table is None:
        # Keep the parser tolerant of harmless class-name changes while still
        # selecting the table with the most data rows.
        tables = soup.find_all("table")
        if tables:
            table = max(tables, key=lambda candidate: len(candidate.find_all("tr")))
    if table is None:
        # Keep this error explicit: a login page can otherwise look like a
        # successful empty import.
        raise ParseError("Mindbox groups table was not found; the session may be invalid")

    offerings: list[ClassOffering] = []
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 9:
            continue

        values = [_cell_parts(cell) for cell in cells]
        current_format = len(cells) >= 10 and len(values[0]) >= 2
        if current_format:
            subject, course_code, teacher = _parse_course_header(cells[0], values[0])
            group = _first(values[1]) or None
            credits = _parse_credits(_first(values[2]))
            schedule_values = values[3:10]
        else:
            subject = _first(values[0])
            teacher = _first(values[1])
            group = _first(values[2]) or None
            course_code = None
            credits = None
            schedule_values = values[4:9]

        if not subject or not teacher:
            continue

        schedule = {
            day: clean_schedule(" ".join(schedule_values[index]))
            if index < len(schedule_values)
            else None
            for index, day in enumerate(DAYS)
        }

        offerings.append(
            ClassOffering(
                subject=subject,
                teacher=teacher,
                group=group,
                semester=semester,
                schedule=schedule,
                career=clean_text(career),
                course_code=course_code,
                credits=credits,
            )
        )

    return offerings
