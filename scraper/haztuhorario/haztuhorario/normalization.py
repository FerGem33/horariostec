from __future__ import annotations

import re
import unicodedata


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def clean_teacher_name(value: str | None) -> str:
    """Return a consistent display name while preserving accents."""

    name = clean_text(value)
    if not name:
        return ""
    # The source contains both `JUAN PEREZ` and `Juan Perez` forms. Applying
    # title case to every name makes matching deterministic and readable.
    return " ".join(part[:1].upper() + part[1:].lower() for part in name.split(" "))


def comparison_key(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", clean_text(value))
    without_accents = "".join(
        character for character in normalized if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z0-9]+", " ", without_accents.lower()).strip()


def teacher_slug(value: str | None) -> str:
    return comparison_key(value).replace(" ", "-")
