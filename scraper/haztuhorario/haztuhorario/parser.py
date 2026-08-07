from __future__ import annotations

import json
from statistics import mean
from typing import Any

from bs4 import BeautifulSoup

from .models import LegacyComment, LegacyTeacher
from .normalization import clean_teacher_name, clean_text, teacher_slug


class ParseError(ValueError):
    pass


def _next_data(html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    node = soup.find("script", id="__NEXT_DATA__")
    if node is None or not node.string:
        raise ParseError("Could not find __NEXT_DATA__ in HazTuHorario page")
    try:
        return json.loads(node.string)
    except json.JSONDecodeError as error:
        raise ParseError("Invalid __NEXT_DATA__ JSON") from error


def parse_careers_page(html: str) -> list[str]:
    page_props = _next_data(html).get("props", {}).get("pageProps", {})
    careers = page_props.get("careers")
    if not isinstance(careers, list) or not all(isinstance(item, str) for item in careers):
        raise ParseError("Could not find careers in HazTuHorario page")
    return careers


def parse_career_page(html: str) -> list[str]:
    page_props = _next_data(html).get("props", {}).get("pageProps", {})
    if isinstance(page_props.get("error"), dict):
        # Some careers are listed in the landing page but no longer have a
        # published recommendation page. Treat those as empty careers so an
        # all-careers import can continue.
        return []
    teachers = page_props.get("searchTeachers")
    if not isinstance(teachers, list):
        raise ParseError("Could not find teachers in HazTuHorario career page")
    names = {
        clean_teacher_name(item["name"])
        for item in teachers
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    }
    return sorted(names, key=lambda name: (teacher_slug(name), name))


def _average(reviews: list[dict[str, Any]], key: str) -> float | None:
    values = [review[key] for review in reviews if isinstance(review.get(key), (int, float))]
    return round(mean(values), 2) if values else None


def parse_teacher_page(html: str, *, source_url: str | None = None) -> LegacyTeacher:
    page_props = _next_data(html).get("props", {}).get("pageProps", {})
    data = page_props.get("teacher")
    if not isinstance(data, dict) or not isinstance(data.get("name"), str):
        raise ParseError("Could not find teacher data in HazTuHorario page")

    name = clean_teacher_name(data["name"])
    reviews = data.get("reviews") or []
    if not isinstance(reviews, list):
        raise ParseError(f"Invalid reviews for teacher {name}")
    review_rows = [review for review in reviews if isinstance(review, dict)]

    comments: list[LegacyComment] = []
    for comment in data.get("comments") or []:
        if not isinstance(comment, dict):
            continue
        content = clean_text(comment.get("content"))
        if not content:
            continue
        comments.append(
            LegacyComment(
                content=content,
                published_at=comment.get("date"),
                source_id=_source_id(comment),
            )
        )

    metrics = {
        "fair_percent": _average(review_rows, "fair"),
        "explains_well_percent": _average(review_rows, "explainsWell"),
        "hard_percent": _average(review_rows, "hard"),
        "homework_percent": _average(review_rows, "homework"),
        "attendance_percent": _average(review_rows, "attendance"),
        "general_score": _average(review_rows, "generalScore"),
    }
    return LegacyTeacher(
        name=name,
        slug=teacher_slug(name),
        review_count=len(review_rows),
        metrics=metrics,
        comments=comments,
        source_url=source_url or "",
    )


def _source_id(item: dict[str, Any]) -> str | None:
    links = item.get("_links")
    if not isinstance(links, dict):
        return None
    self_link = links.get("self")
    if not isinstance(self_link, dict):
        return None
    href = self_link.get("href")
    return href.rsplit("/", 1)[-1] if isinstance(href, str) else None
