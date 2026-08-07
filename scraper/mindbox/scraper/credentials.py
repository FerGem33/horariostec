from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CAREERS = (
    "sistemas",
    "mecatronica",
    "mecanica",
    "industrial",
    "electrica",
    "electronica",
    "gestion",
    "materiales",
)

DEFAULT_CREDENTIALS_FILE = Path(__file__).resolve().parents[1] / "credentials.json"


def load_credentials(path: Path, career: str) -> tuple[str, str]:
    try:
        data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise FileNotFoundError(
            f"Credentials file not found: {path}. Copy credentials.example.json to credentials.json."
        ) from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Credentials file is not valid JSON: {path}") from error

    entry = data.get(career)
    if not isinstance(entry, dict):
        raise ValueError(f"Credentials file has no entry for career: {career}")
    username = entry.get("username")
    password = entry.get("password")
    if not isinstance(username, str) or not username.strip():
        raise ValueError(f"Credentials entry has no username for career: {career}")
    if not isinstance(password, str) or not password:
        raise ValueError(f"Credentials entry has no password for career: {career}")
    return username.strip(), password
