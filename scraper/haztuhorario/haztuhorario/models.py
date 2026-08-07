from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class LegacyComment:
    content: str
    published_at: str | None = None
    source_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class LegacyTeacher:
    name: str
    slug: str
    review_count: int
    metrics: dict[str, float | None]
    comments: list[LegacyComment]
    source_url: str

    def to_dict(self) -> dict[str, Any]:
        result = asdict(self)
        result["comments"] = [comment.to_dict() for comment in self.comments]
        return result


@dataclass(frozen=True)
class LegacyArtifact:
    schema_version: int
    source: dict[str, str]
    teachers: list[LegacyTeacher]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "source": self.source,
            "teacher_count": len(self.teachers),
            "teachers": [teacher.to_dict() for teacher in self.teachers],
        }
