from __future__ import annotations

import re


MAX_COMMENT_LENGTH = 1_000
NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{1,80}$")
VOTER_PATTERN = re.compile(r"^[a-zA-Z0-9:_-]{16,128}$")
ANSWER_KEYS = (
    "attendance_weight",
    "assignments_weight",
    "exams_weight",
    "projects_weight",
    "fairness",
    "explains",
    "attitude",
    "accessibility",
    "difficulty",
)


def validate_rating(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 5:
        raise ValueError("rating must be an integer between 1 and 5")
    return value


def validate_global_rating(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= 100:
        raise ValueError("global_rating must be an integer between 0 and 100")
    return value


def validate_answers(value: object) -> dict[str, int]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError("answers must be an object")

    answers: dict[str, int] = {}
    for key, raw_value in value.items():
        if key not in ANSWER_KEYS:
            raise ValueError(f"unknown answer: {key}")
        if raw_value is None:
            continue
        if isinstance(raw_value, bool) or not isinstance(raw_value, int):
            raise ValueError(f"answer {key} must be an integer")
        maximum = 100 if key.endswith("_weight") else 5
        minimum = 0 if key.endswith("_weight") else 1
        if not minimum <= raw_value <= maximum:
            raise ValueError(f"answer {key} must be between {minimum} and {maximum}")
        answers[key] = raw_value
    return answers


def validate_comment(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("comment must be a string")
    comment = value.strip()
    if len(comment) > MAX_COMMENT_LENGTH:
        raise ValueError(f"comment must be at most {MAX_COMMENT_LENGTH} characters")
    return comment or None


def validate_slug(value: str) -> str:
    if not NAME_PATTERN.fullmatch(value):
        raise ValueError("invalid identifier")
    return value


def validate_voter_key(value: object) -> str:
    if not isinstance(value, str) or not VOTER_PATTERN.fullmatch(value):
        raise ValueError("voter_id must be a valid anonymous identifier")
    return value


def validate_vote(value: object) -> str:
    if value not in ("like", "dislike", "remove"):
        raise ValueError("vote must be like, dislike, or remove")
    return value
