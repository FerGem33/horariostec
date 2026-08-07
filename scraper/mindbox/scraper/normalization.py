from __future__ import annotations

import re
import unicodedata


def clean_text(value: str | None) -> str:
    """Collapse HTML whitespace without changing the display casing."""

    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def comparison_key(value: str | None) -> str:
    """Return a stable key for matching names across imports."""

    normalized = unicodedata.normalize("NFKD", clean_text(value))
    without_accents = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", " ", without_accents.lower()).strip()


def clean_schedule(value: str | None) -> str | None:
    value = clean_text(value)
    if not value or value in {"-", "--", "—"}:
        return None
    return value
