from __future__ import annotations

import re
from pathlib import Path

from playwright.async_api import Browser, Page, Playwright, TimeoutError, async_playwright

from .parser import parse_offerings


LOGIN_URL = "https://itsaltillo.mindbox.app/login/student"
GROUPS_URL = "https://itsaltillo.mindbox.app/students/enrollment/groups"


class PlaywrightMindboxClient:
    def __init__(
        self,
        *,
        session_file: Path,
        career: str,
        headed: bool = False,
        login_url: str = LOGIN_URL,
        groups_url: str = GROUPS_URL,
    ) -> None:
        self.session_file = session_file
        self.career = career
        self.headed = headed
        self.login_url = login_url
        self.groups_url = groups_url
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None

    async def __aenter__(self) -> "PlaywrightMindboxClient":
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=not self.headed)
        return self

    async def __aexit__(self, exc_type, exc, traceback) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def authenticate(self, username: str, password: str) -> None:
        if not self._browser:
            raise RuntimeError("Client must be used as an async context manager")

        context = await self._browser.new_context()
        page = await context.new_page()
        await page.goto(self.login_url, wait_until="domcontentloaded")
        await page.get_by_label("Matrícula").fill(username)
        await page.get_by_label("Contraseña").fill(password)
        await page.get_by_role("button", name=re.compile("iniciar sesión", re.I)).click()

        try:
            await page.wait_for_url(re.compile(r"/students/"), timeout=30_000)
        except TimeoutError as error:
            raise RuntimeError(
                "Mindbox login did not reach the student portal. "
                "Check the credentials or complete any challenge in headed mode."
            ) from error

        self.session_file.parent.mkdir(parents=True, exist_ok=True)
        await context.storage_state(path=str(self.session_file))
        await context.close()

    async def scrape(self, semesters: list[int] | None = None):
        if not self._browser:
            raise RuntimeError("Client must be used as an async context manager")
        if not self.session_file.exists():
            raise FileNotFoundError(f"Session file not found: {self.session_file}")

        context = await self._browser.new_context(storage_state=str(self.session_file))
        page = await context.new_page()
        try:
            available = await self._discover_semesters(page)
            requested = available if semesters is None else semesters
            missing = sorted(set(requested) - set(available))
            if missing:
                raise RuntimeError(
                    f"Requested semesters are not available in Mindbox: {', '.join(map(str, missing))}"
                )

            offerings = []
            empty_semesters = []
            for semester in requested:
                has_results = await self._open_semester(page, semester)
                if not has_results:
                    empty_semesters.append(semester)
                    continue
                semester_offerings = await self._scrape_semester_pages(
                    page, semester=semester
                )
                if not semester_offerings:
                    empty_semesters.append(semester)
                    continue
                offerings.extend(semester_offerings)
            return offerings, available, empty_semesters
        finally:
            await context.close()

    async def _scrape_semester_pages(self, page: Page, *, semester: int):
        """Parse every paginated table page for a semester.

        Mindbox renders only one page of groups at a time. The table is
        replaced after clicking the pagination control, so parsing the page
        once silently drops all groups after the first page.
        """
        offerings = []
        seen_pages: set[str] = set()

        while True:
            table = page.locator("table").last
            page_signature = await table.inner_text()
            if page_signature in seen_pages:
                break
            seen_pages.add(page_signature)

            offerings.extend(
                parse_offerings(
                    await page.content(), semester=semester, career=self.career
                )
            )
            if not await self._click_next_page(page, before=page_signature):
                break

        return offerings

    async def _click_next_page(self, page: Page, *, before: str) -> bool:
        """Click the next pagination control, returning False on the last page."""
        containers = page.locator(
            "ul.pagination, .pagination, nav[aria-label*='pagination' i]"
        )
        container = None
        for index in range(await containers.count() - 1, -1, -1):
            candidate = containers.nth(index)
            if await candidate.is_visible():
                container = candidate
                break
        if container is None:
            return False

        controls = container.locator("a, button")
        metadata = await controls.evaluate_all(
            """
            elements => elements.map((element, index) => {
              const parent = element.closest('li');
              const text = (element.textContent || '').trim();
              const label = (element.getAttribute('aria-label') || '').trim();
              const title = (element.getAttribute('title') || '').trim();
              const classes = `${element.className || ''} ${parent?.className || ''}`;
              return {
                index,
                text,
                label,
                title,
                classes,
                current: element.getAttribute('aria-current') === 'page'
                  || /(^|\\s)(active|current)(\\s|$)/i.test(classes),
                disabled: element.hasAttribute('disabled')
                  || element.getAttribute('aria-disabled') === 'true'
                  || /(^|\\s)disabled(\\s|$)/i.test(classes),
              };
            })
            """
        )

        if not metadata:
            return False

        next_index = None
        for item in metadata:
            searchable = " ".join(
                (item["text"], item["label"], item["title"])
            ).lower()
            if not item["disabled"] and any(
                marker in searchable
                for marker in ("siguiente", "next", "›", "»", "→")
            ):
                next_index = item["index"]
                break

        if next_index is None:
            current_index = next(
                (item["index"] for item in metadata if item["current"]), None
            )
            if current_index is not None:
                candidate = next(
                    (
                        item
                        for item in metadata
                        if item["index"] > current_index
                        and item["text"].strip().isdigit()
                        and not item["disabled"]
                    ),
                    None,
                )
                if candidate is not None:
                    next_index = candidate["index"]

        if next_index is None:
            return False

        await controls.nth(next_index).click()
        for _ in range(40):
            await page.wait_for_timeout(100)
            current = await page.locator("table").last.inner_text()
            if current != before:
                return True
        return False

    async def _discover_semesters(self, page: Page) -> list[int]:
        await page.goto(self.groups_url, wait_until="domcontentloaded")
        if "/login" in page.url:
            raise RuntimeError(
                "Mindbox session is missing or expired. Run "
                f"`uv run python -m scraper auth --career {self.career} --headed` "
                "to authenticate again."
            )
        select = page.locator("select").first
        options = await select.locator("option").evaluate_all(
            "options => options.map(option => ({ value: option.value, text: option.textContent }))"
        )
        semesters = []
        for option in options:
            match = re.search(r"\d+", str(option["value"]))
            if match:
                semesters.append(int(match.group()))
        if not semesters:
            raise RuntimeError("Could not discover semester options on the Mindbox page")
        return sorted(set(semesters))

    async def _open_semester(self, page: Page, semester: int) -> bool:
        await page.goto(self.groups_url, wait_until="domcontentloaded")
        select = page.locator("select").first
        try:
            await select.select_option(str(semester))
        except Exception:
            await select.select_option(label=f"{semester}°")

        await page.get_by_role("button", name=re.compile("buscar", re.I)).click()
        try:
            await page.wait_for_url(re.compile(r"grade="), timeout=15_000)
        except TimeoutError:
            # Some deployments update the table without changing the URL.
            pass
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5_000)
        except TimeoutError:
            # A long-lived external resource should not prevent us from
            # checking the server-rendered DOM.
            pass

        try:
            await page.locator("table").last.wait_for(state="attached", timeout=5_000)
        except TimeoutError as error:
            body_text = (await page.locator("body").inner_text()).lower()
            empty_messages = (
                "no se encontraron",
                "no hay grupos",
                "no hay grupos disponibles",
                "no existen grupos disponibles",
                "sin resultados",
                "no existen grupos",
                "total de grupos: 0",
                "total de grupos 0",
            )
            if any(message in body_text for message in empty_messages):
                return False
            # Mindbox can return a successful grade URL with an empty result
            # area and no explanatory message. If we are still on the
            # authenticated grade page, treat that semester as empty. A
            # redirect to login is handled as an actual failure below.
            if "grade=" in page.url and "/login" not in page.url:
                return False
            title = await page.title()
            raise RuntimeError(
                f"Mindbox did not render a results table for semester {semester} "
                f"(URL: {page.url}, title: {title!r}). Run with --headed to inspect the page."
            ) from error
        return True
