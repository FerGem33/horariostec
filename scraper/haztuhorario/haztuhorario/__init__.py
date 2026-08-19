from .client import HazTuHorarioClient
from .models import LegacyArtifact, LegacyComment, LegacyTeacher
from .normalization import clean_teacher_name, comparison_key, teacher_slug
from .parser import (
    ParseError,
    parse_career_page,
    parse_career_page_entries,
    parse_careers_page,
    parse_teacher_page,
)

__all__ = [
    "HazTuHorarioClient",
    "LegacyArtifact",
    "LegacyComment",
    "LegacyTeacher",
    "ParseError",
    "clean_teacher_name",
    "comparison_key",
    "parse_career_page",
    "parse_career_page_entries",
    "parse_careers_page",
    "parse_teacher_page",
    "teacher_slug",
]
