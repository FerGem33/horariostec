import json
import tempfile
import unittest
from pathlib import Path

from scraper.credentials import CAREERS, load_credentials


class CredentialsTests(unittest.TestCase):
    def test_supported_careers(self):
        self.assertEqual(
            CAREERS,
            (
                "sistemas",
                "mecatronica",
                "mecanica",
                "industrial",
                "electrica",
                "electronica",
                "gestion",
                "materiales",
            ),
        )

    def test_loads_credentials_for_career(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "credentials.json"
            path.write_text(
                json.dumps({"sistemas": {"username": "123", "password": "secret"}}),
                encoding="utf-8",
            )
            self.assertEqual(load_credentials(path, "sistemas"), ("123", "secret"))


if __name__ == "__main__":
    unittest.main()
