from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

import requests
from bs4 import BeautifulSoup


class ScrapeError(RuntimeError):
    """Raised for network, authentication, or Mindbox response errors."""


REQUIRED_COOKIES = ("INGRESSCOOKIE", "XSRF-TOKEN", "mbid_11_session")


def load_cookie_file(path: Path) -> dict[str, str]:
    try:
        data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ScrapeError(f"Cookie file not found: {path}") from error
    except json.JSONDecodeError as error:
        raise ScrapeError(f"Cookie file is not valid JSON: {path}") from error

    missing = [name for name in REQUIRED_COOKIES if not data.get(name)]
    if missing:
        raise ScrapeError(f"Cookie file is missing required cookies: {', '.join(missing)}")

    cookies = {name: str(data[name]) for name in REQUIRED_COOKIES}
    if data.get("_token"):
        cookies["_token"] = str(data["_token"])
    return cookies


class MindboxClient:
    def __init__(
        self,
        endpoint: str,
        cookies: dict[str, str],
        *,
        timeout: float = 30,
    ) -> None:
        self.endpoint = endpoint
        self.cookies = cookies
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "HorariosTec-MindboxImporter/0.1",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": endpoint,
            }
        )

        xsrf_token = cookies.get("XSRF-TOKEN")
        if xsrf_token:
            # Laravel-style XSRF cookies are commonly URL encoded. The header
            # must contain the decoded value while the cookie stays encoded.
            self.session.headers["X-XSRF-TOKEN"] = unquote(xsrf_token)

        parsed_endpoint = urlparse(endpoint)
        self.session.headers["Origin"] = f"{parsed_endpoint.scheme}://{parsed_endpoint.netloc}"

    def _discover_form_token(self) -> str | None:
        """Look for a legacy hidden CSRF token in the authenticated page."""

        try:
            response = self.session.get(self.endpoint, timeout=self.timeout)
            response.raise_for_status()
        except requests.RequestException:
            return None

        soup = BeautifulSoup(response.text, "html.parser")
        input_token = soup.find("input", attrs={"name": "_token"})
        if input_token and input_token.get("value"):
            return str(input_token["value"])

        meta_token = soup.find("meta", attrs={"name": "csrf-token"})
        if meta_token and meta_token.get("content"):
            return str(meta_token["content"])
        return None

    def fetch_semester(self, semester: int) -> str:
        token = self.cookies.get("_token")
        if not token:
            token = self._discover_form_token()
        form_data = {"semester": str(semester)}
        # Older Mindbox deployments required a hidden form token. The current
        # deployment may authenticate the request only with the session
        # cookies, so the token is optional and is sent only when provided.
        if token:
            form_data["_token"] = token

        try:
            response = self.session.post(
                self.endpoint,
                cookies={name: value for name, value in self.cookies.items() if name != "_token"},
                data=form_data,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except requests.RequestException as error:
            if getattr(error.response, "status_code", None) == 419:
                raise ScrapeError(
                    "Mindbox rejected the CSRF/session data (HTTP 419). "
                    "Refresh the Mindbox page, export the three current cookies, "
                    "and try again. If the browser request includes a hidden '_token', "
                    "add it to the cookie file."
                ) from error
            raise ScrapeError(f"Mindbox request failed for semester {semester}: {error}") from error

        if "groups" not in response.text.lower() and "table" not in response.text.lower():
            raise ScrapeError(
                f"Mindbox returned an unexpected page for semester {semester}; session may be invalid"
            )
        return response.text
