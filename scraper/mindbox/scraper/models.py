from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


DAYS = (
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
)


@dataclass(frozen=True)
class ClassOffering:
    subject: str
    teacher: str
    group: str | None
    semester: int
    schedule: dict[str, str | None]
    career: str
    course_code: str | None = None
    credits: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
