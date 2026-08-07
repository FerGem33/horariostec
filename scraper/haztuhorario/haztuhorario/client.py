from __future__ import annotations

from urllib.parse import quote

import requests

from .normalization import teacher_slug
from .parser import parse_career_page, parse_careers_page, parse_teacher_page


class HazTuHorarioClient:
    def __init__(self, base_url: str = "https://haztuhorario.com", *, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.timeout = timeout

    def get(self, path: str) -> str:
        response = self.session.get(self.base_url + path, timeout=self.timeout)
        response.raise_for_status()
        return response.text

    def careers(self) -> list[str]:
        return parse_careers_page(self.get("/recomendaciones"))

    def teachers(self, career: str) -> list[str]:
        return parse_career_page(self.get(f"/recomendaciones/{quote(teacher_slug(career))}"))

    def teacher(self, name: str):
        slug = teacher_slug(name)
        return parse_teacher_page(
            self.get(f"/profesores/{quote(slug)}"),
            source_url=f"{self.base_url}/profesores/{quote(slug)}",
        )
