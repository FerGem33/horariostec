from __future__ import annotations


def configured_origins(value: str) -> set[str]:
    """Parse comma-separated origins while keeping wildcard compatibility."""

    origins = {item.strip().rstrip("/") for item in value.split(",") if item.strip()}
    return origins or {"*"}
