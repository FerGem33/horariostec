from __future__ import annotations

import re
from urllib.parse import quote, urljoin

import requests

from .normalization import comparison_key, teacher_slug
from .parser import parse_career_page_entries, parse_careers_page, parse_teacher_page


class HazTuHorarioClient:
    def __init__(self, base_url: str = "https://haztuhorario.com", *, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
            }
        )
        self.timeout = timeout
        self._career_paths: dict[str, str] = {}
        self._teacher_paths: dict[str, str] = {}

    def get(self, path: str) -> str:
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        response = self.session.get(url, timeout=self.timeout)
        response.raise_for_status()
        return response.text

    def careers(self) -> list[str]:
        html = self.get("/recomendaciones")
        for match in re.finditer(r'href=["\'](/recomendaciones/(\d+-[^"\'\s>]+))["\']', html):
            full_path, slug = match.group(1), match.group(2)
            self._career_paths[slug] = full_path
            self._career_paths[comparison_key(slug)] = full_path
            short_slug = re.sub(r"^\d+-", "", slug)
            self._career_paths[short_slug] = full_path
            self._career_paths[comparison_key(short_slug)] = full_path
            self._career_paths[teacher_slug(short_slug)] = full_path

        return parse_careers_page(html)

    def career_path(self, career: str) -> str:
        career_clean = career.strip().lstrip("/")
        if career_clean.startswith("recomendaciones/"):
            return f"/{career_clean}"
        if re.match(r"^\d+-[a-z0-9\-]+$", career_clean):
            return f"/recomendaciones/{career_clean}"

        key = comparison_key(career_clean)
        slug_key = teacher_slug(career_clean)
        if key in self._career_paths:
            return self._career_paths[key]
        if slug_key in self._career_paths:
            return self._career_paths[slug_key]

        if not self._career_paths:
            try:
                self.careers()
                if key in self._career_paths:
                    return self._career_paths[key]
                if slug_key in self._career_paths:
                    return self._career_paths[slug_key]
            except Exception:
                pass

        return f"/recomendaciones/{quote(teacher_slug(career))}"

    def teacher_entries(self, career: str) -> list[tuple[str, str]]:
        path = self.career_path(career)
        html = self.get(path)
        entries = parse_career_page_entries(html)
        for name, teacher_path in entries:
            self._teacher_paths[comparison_key(name)] = teacher_path
            self._teacher_paths[teacher_slug(name)] = teacher_path
            slug_from_path = teacher_path.rstrip("/").rsplit("/", 1)[-1]
            self._teacher_paths[slug_from_path] = teacher_path
            short_slug = re.sub(r"^\d+-", "", slug_from_path)
            self._teacher_paths[short_slug] = teacher_path
        return entries

    def teachers(self, career: str) -> list[str]:
        entries = self.teacher_entries(career)
        names = {name for name, _ in entries}
        return sorted(names, key=lambda name: (teacher_slug(name), name))

    def teacher(self, target: str):
        target_clean = target.strip()
        if target_clean.startswith("http://") or target_clean.startswith("https://"):
            full_url = target_clean
            response = self.session.get(full_url, timeout=self.timeout)
            response.raise_for_status()
            return parse_teacher_page(response.text, source_url=full_url)

        if target_clean.startswith("/profesores/"):
            path = target_clean
        elif target_clean.startswith("profesores/"):
            path = f"/{target_clean}"
        elif target_clean in self._teacher_paths:
            path = self._teacher_paths[target_clean]
        elif comparison_key(target_clean) in self._teacher_paths:
            path = self._teacher_paths[comparison_key(target_clean)]
        elif teacher_slug(target_clean) in self._teacher_paths:
            path = self._teacher_paths[teacher_slug(target_clean)]
        elif re.match(r"^\d+-[a-z0-9\-]+$", target_clean):
            path = f"/profesores/{target_clean}"
        else:
            path = f"/profesores/{quote(teacher_slug(target_clean))}"

        full_url = f"{self.base_url}{path}"
        html = self.get(path)
        return parse_teacher_page(html, source_url=full_url)
