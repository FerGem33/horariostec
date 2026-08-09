import unittest
from datetime import date

from scraper.__main__ import default_filename


class CliTests(unittest.TestCase):
    def test_default_filename_uses_first_term_through_july(self):
        self.assertEqual(
            default_filename("sistemas", date(2026, 7, 31)),
            "sistemas-2026-1.json",
        )

    def test_default_filename_uses_second_term_from_august(self):
        self.assertEqual(
            default_filename("sistemas", date(2026, 8, 1)),
            "sistemas-2026-2.json",
        )


if __name__ == "__main__":
    unittest.main()
