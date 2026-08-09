import unittest

from src.cors import configured_origins


class CorsTests(unittest.TestCase):
    def test_parses_multiple_origins(self):
        self.assertEqual(
            configured_origins("https://one.example, https://two.example/"),
            {"https://one.example", "https://two.example"},
        )

    def test_empty_configuration_keeps_wildcard_fallback(self):
        self.assertEqual(configured_origins(""), {"*"})


if __name__ == "__main__":
    unittest.main()
