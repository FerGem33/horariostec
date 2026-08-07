from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from .pipeline import build_artifact
from .playwright_client import PlaywrightMindboxClient
from .credentials import CAREERS, DEFAULT_CREDENTIALS_FILE, load_credentials


PROJECT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SESSION_DIR = PROJECT_DIR / "sessions"
OUTPUT_DIR = PROJECT_DIR / "output"


def add_common_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--career", required=True, choices=CAREERS, help="Career identifier")
    parser.add_argument("--session-file", type=Path)
    parser.add_argument("--headed", action="store_true", help="Show the Chromium browser")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import class offerings from Mindbox")
    subparsers = parser.add_subparsers(dest="command", required=True)

    auth = subparsers.add_parser("auth", help="Log in and save an authenticated browser session")
    add_common_arguments(auth)
    auth.add_argument(
        "--credentials-file",
        type=Path,
        default=DEFAULT_CREDENTIALS_FILE,
        help="Local JSON credentials file",
    )

    scrape = subparsers.add_parser("scrape", help="Scrape all available semesters")
    add_common_arguments(scrape)
    scrape.add_argument("--filename", help="Output filename only; otherwise prompt")
    scrape.add_argument("--semester", type=int, nargs="+", help="Specific semesters; default: all")
    return parser.parse_args()


def session_path(args: argparse.Namespace) -> Path:
    return args.session_file or DEFAULT_SESSION_DIR / f"{args.career}.json"


def output_path(filename: str | None) -> Path:
    value = filename or input("Output filename: ").strip()
    if not value:
        raise ValueError("Output filename cannot be empty")
    path = Path(value)
    if path.name != value:
        raise ValueError("Provide a filename only, not a path")
    if path.suffix.lower() != ".json":
        path = path.with_suffix(".json")
    return OUTPUT_DIR / path.name


def write_json_atomically(path: Path, artifact: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(artifact, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


async def run_auth(args: argparse.Namespace) -> int:
    username, password = load_credentials(args.credentials_file, args.career)
    session = session_path(args)
    async with PlaywrightMindboxClient(
        session_file=session,
        career=args.career,
        headed=args.headed,
    ) as client:
        await client.authenticate(username, password)
    print(f"Authenticated session saved to {session}")
    return 0


async def run_scrape(args: argparse.Namespace) -> int:
    destination = output_path(args.filename)
    session = session_path(args)
    async with PlaywrightMindboxClient(
        session_file=session,
        career=args.career,
        headed=args.headed,
    ) as client:
        offerings, available, empty_semesters = await client.scrape(args.semester)

    requested = available if args.semester is None else sorted(set(args.semester))
    artifact = build_artifact(
        offerings,
        career=args.career,
        endpoint="https://itsaltillo.mindbox.app/students/enrollment/groups",
        semesters=requested,
    )
    artifact["source"]["mode"] = "playwright"
    artifact["empty_semesters"] = empty_semesters
    write_json_atomically(destination, artifact)
    print(
        f"Imported {len(offerings)} offerings from semesters {', '.join(map(str, requested))} "
        f"into {destination}"
    )
    if empty_semesters:
        print(
            "No groups were published for semesters: "
            + ", ".join(map(str, empty_semesters))
        )
    return 0


def main() -> int:
    args = parse_args()
    try:
        if args.command == "auth":
            return asyncio.run(run_auth(args))
        return asyncio.run(run_scrape(args))
    except (FileNotFoundError, RuntimeError, ValueError, PlaywrightTimeoutError) as error:
        print(f"Scrape failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
