from __future__ import annotations

import json
import re
from statistics import mean
from typing import Any

from bs4 import BeautifulSoup

from .models import LegacyComment, LegacyTeacher
from .normalization import clean_teacher_name, clean_text, comparison_key, teacher_slug


class ParseError(ValueError):
    pass


def _next_data(html: str) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    node = soup.find("script", id="__NEXT_DATA__")
    if node is None or not node.string:
        return None
    try:
        return json.loads(node.string)
    except json.JSONDecodeError as error:
        raise ParseError("Invalid __NEXT_DATA__ JSON") from error


def parse_careers_page(html: str) -> list[str]:
    # Check for legacy __NEXT_DATA__
    next_data = _next_data(html)
    if next_data is not None:
        page_props = next_data.get("props", {}).get("pageProps", {})
        careers = page_props.get("careers")
        if isinstance(careers, list) and all(isinstance(item, str) for item in careers):
            return careers
        raise ParseError("Could not find careers in HazTuHorario page")

    # Next.js App Router HTML parsing
    soup = BeautifulSoup(html, "html.parser")
    careers: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if re.search(r"/recomendaciones/\d+-[a-z0-9\-]+", href):
            name = clean_text(a.get_text(strip=True))
            if name and name not in seen:
                seen.add(name)
                careers.append(name)

    if not careers:
        raise ParseError("Could not find careers in HazTuHorario page")
    return sorted(careers, key=comparison_key)


def parse_career_page_entries(html: str) -> list[tuple[str, str]]:
    """Return a list of (teacher_name, teacher_href_or_slug) pairs."""
    next_data = _next_data(html)
    if next_data is not None:
        page_props = next_data.get("props", {}).get("pageProps", {})
        if isinstance(page_props.get("error"), dict):
            return []
        teachers = page_props.get("searchTeachers")
        if not isinstance(teachers, list):
            raise ParseError("Could not find teachers in HazTuHorario career page")
        results: list[tuple[str, str]] = []
        for item in teachers:
            if isinstance(item, dict) and isinstance(item.get("name"), str):
                name = clean_teacher_name(item["name"])
                if name:
                    results.append((name, f"/profesores/{teacher_slug(name)}"))
        return results

    # Next.js App Router HTML parsing
    soup = BeautifulSoup(html, "html.parser")
    error_node = soup.find(lambda tag: tag.name in ["h1", "h2", "p"] and "404" in tag.get_text())
    prof_links = soup.find_all("a", href=lambda h: bool(h and h.startswith("/profesores/")))
    if error_node and not prof_links:
        return []

    entries: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for a in prof_links:
        href = a["href"].strip()
        raw_name = a.get_text(strip=True).lstrip("→").strip()
        clean_name = clean_teacher_name(raw_name)
        if clean_name:
            entry = (clean_name, href)
            if entry not in seen:
                seen.add(entry)
                entries.append(entry)
    return entries


def parse_career_page(html: str) -> list[str]:
    entries = parse_career_page_entries(html)
    names = {name for name, _ in entries}
    return sorted(names, key=lambda name: (teacher_slug(name), name))


def _average(reviews: list[dict[str, Any]], key: str) -> float | None:
    values = [review[key] for review in reviews if isinstance(review.get(key), (int, float))]
    return round(mean(values), 2) if values else None


def parse_teacher_page(html: str, *, source_url: str | None = None) -> LegacyTeacher:
    next_data = _next_data(html)
    if next_data is not None:
        page_props = next_data.get("props", {}).get("pageProps", {})
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

    # Next.js App Router HTML parsing
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    if not h1 or not h1.get_text(strip=True):
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            title_text = title_tag.string
            m = re.search(r"Calificaciones de (.+?) \| Haztuhorario", title_text)
            raw_name = m.group(1) if m else title_text.split("|")[0].strip()
        else:
            raise ParseError("Could not find teacher data in HazTuHorario page")
    else:
        raw_name = h1.get_text(strip=True)

    name = clean_teacher_name(raw_name)
    if not name:
        raise ParseError("Could not find teacher name in HazTuHorario page")

    # General score
    general_score: float | None = None
    gen_elem = soup.find(attrs={"aria-label": re.compile(r"calificaci[oó]n general", re.I)})
    if gen_elem:
        st = gen_elem.find("strong")
        if st:
            try:
                general_score = float(st.get_text(strip=True))
            except ValueError:
                pass

    # Review count
    review_count = 0
    p_count = soup.find(lambda t: t.name in ["p", "span", "div"] and "ha sido calificado" in t.get_text())
    if p_count:
        m = re.search(r"ha sido calificado\s*(\d+)\s*veces", p_count.get_text())
        if m:
            review_count = int(m.group(1))

    # Metrics
    metric_aliases = {
        "fair_percent": ["califica de manera justa", "califica justamente", "justa"],
        "explains_well_percent": ["explica bien los temas", "explica bien"],
        "hard_percent": ["es dificil pasar su materia", "es difícil pasar su materia", "dificil", "dificultad"],
        "homework_percent": ["encarga mucha tarea", "mucha tarea", "tarea"],
        "attendance_percent": ["toma en cuenta la asistencia", "asistencia"],
    }

    metrics: dict[str, float | None] = {
        "fair_percent": None,
        "explains_well_percent": None,
        "hard_percent": None,
        "homework_percent": None,
        "attendance_percent": None,
        "general_score": general_score,
    }

    for heading in soup.find_all(["h3", "h4"]):
        title = heading.get_text(strip=True).lower()
        parent = heading.find_parent(["article", "div", "section", "li"])
        if not parent:
            continue
        strong_tag = parent.find("strong")
        if not strong_tag:
            continue
        val_str = strong_tag.get_text(strip=True).rstrip("%")
        try:
            val = float(val_str)
        except ValueError:
            continue

        for key, aliases in metric_aliases.items():
            if any(alias in title for alias in aliases):
                metrics[key] = val
                break

    # Comments
    comments: list[LegacyComment] = []
    sec = soup.find(id=re.compile(r"comentarios", re.I)) or soup.find(
        lambda t: t.name in ["section", "div"]
        and t.find(lambda h: h.name in ["h2", "h3"] and "comentarios" in h.get_text().lower())
    )
    if sec:
        for index, art in enumerate(sec.find_all("article"), start=1):
            p = art.find("p", class_=lambda c: c and ("font-semibold" in c or "leading-7" in c)) or art.find("p")
            if not p:
                continue
            text = clean_text(p.get_text(strip=True))
            if not text or text.lower().startswith("las reseñas reflejan"):
                continue

            time_tag = art.find("time")
            published_at = None
            if time_tag:
                published_at = time_tag.get("datetime") or time_tag.get("dateTime") or time_tag.get_text(strip=True)

            source_id = str(index)
            comments.append(
                LegacyComment(
                    content=text,
                    published_at=published_at,
                    source_id=source_id,
                )
            )

    return LegacyTeacher(
        name=name,
        slug=teacher_slug(name),
        review_count=review_count,
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
