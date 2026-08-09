from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import date
from pathlib import Path

from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from .pipeline import build_artifact
from .playwright_client import PlaywrightMindboxClient
from .credentials import CAREERS, DEFAULT_CREDENTIALS_FILE, load_credentials


PROJECT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SESSION_DIR = PROJECT_DIR / "sessions"
OUTPUT_DIR = PROJECT_DIR / "output"


def add_common_arguments(
    parser: argparse.ArgumentParser, *, career_required: bool = False
) -> None:
    parser.add_argument(
        "--career",
        required=career_required,
        choices=CAREERS,
        help="Career identifier; omit to scrape every career",
    )
    parser.add_argument("--session-file", type=Path)
    parser.add_argument("--headed", action="store_true", help="Show the Chromium browser")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import class offerings from Mindbox")
    subparsers = parser.add_subparsers(dest="command", required=True)

    auth = subparsers.add_parser("auth", help="Log in and save an authenticated browser session")
    add_common_arguments(auth, career_required=True)
    auth.add_argument(
        "--credentials-file",
        type=Path,
        default=DEFAULT_CREDENTIALS_FILE,
        help="Local JSON credentials file",
    )

    scrape = subparsers.add_parser("scrape", help="Scrape all available semesters")
    add_common_arguments(scrape)
    scrape.add_argument(
        "--filename",
        help="Output filename for one career; default: {career}-{year}-{term}.json",
    )
    scrape.add_argument("--semester", type=int, nargs="+", help="Specific semesters; default: all")
    scrape.add_argument(
        "--auth",
        action="store_true",
        help="Authenticate before scraping (uses credentials.json)",
    )
    scrape.add_argument(
        "--credentials-file",
        type=Path,
        default=DEFAULT_CREDENTIALS_FILE,
        help="Local JSON credentials file used with --auth",
    )
    return parser.parse_args()


def session_path(args: argparse.Namespace, career: str | None = None) -> Path:
    career = career or args.career
    return args.session_file or DEFAULT_SESSION_DIR / f"{career}.json"


def default_filename(career: str, today: date | None = None) -> str:
    today = today or date.today()
    term = 1 if today.month <= 7 else 2
    return f"{career}-{today.year}-{term}.json"


def output_path(filename: str | None, career: str) -> Path:
    value = filename or default_filename(career)
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


async def scrape_career(args: argparse.Namespace, career: str) -> None:
    if args.auth:
        username, password = load_credentials(args.credentials_file, career)
        async with PlaywrightMindboxClient(
            session_file=session_path(args, career),
            career=career,
            headed=args.headed,
        ) as client:
            await client.authenticate(username, password)

    destination = output_path(args.filename, career)
    session = session_path(args, career)
    async with PlaywrightMindboxClient(
        session_file=session,
        career=career,
        headed=args.headed,
    ) as client:
        offerings, available, empty_semesters = await client.scrape(args.semester)

    requested = available if args.semester is None else sorted(set(args.semester))
    artifact = build_artifact(
        offerings,
        career=career,
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


async def run_scrape(args: argparse.Namespace) -> int:
    careers = (args.career,) if args.career else CAREERS
    failures: list[tuple[str, Exception]] = []

    for career in careers:
        try:
            await scrape_career(args, career)
        except Exception as error:
            failures.append((career, error))

    if failures:
        print("\nScrape failures:", file=sys.stderr)
        for career, error in failures:
            print(f"- {career}: {error}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    args = parse_args()
    try:
        if args.command == "auth":
            return asyncio.run(run_auth(args))
        if not args.career and (args.filename or args.session_file):
            raise ValueError("--filename and --session-file require --career")
        return asyncio.run(run_scrape(args))
    except (FileNotFoundError, RuntimeError, ValueError, PlaywrightTimeoutError) as error:
        print(f"Scrape failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
