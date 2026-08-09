import unittest
from datetime import date

from importer import current_term, current_term_name, default_mindbox_input


class ImporterCliTests(unittest.TestCase):
    def test_first_term_runs_through_july(self):
        self.assertEqual(current_term(date(2026, 7, 31)), ("2026-1", "Enero - Junio 2026"))

    def test_second_term_starts_in_august(self):
        self.assertEqual(current_term(date(2026, 8, 1)), ("2026-2", "Agosto - Diciembre 2026"))

    def test_term_name_can_be_derived_from_code(self):
        self.assertEqual(current_term_name("2026-2"), "Agosto - Diciembre 2026")

    def test_default_input_uses_scraper_artifact_convention(self):
        self.assertEqual(
            default_mindbox_input("sistemas", "2026-2").name,
            "sistemas-2026-2.json",
        )


if __name__ == "__main__":
    unittest.main()
