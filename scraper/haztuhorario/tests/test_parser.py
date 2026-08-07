import json
import unittest

from haztuhorario.normalization import clean_teacher_name, teacher_slug
from haztuhorario.parser import parse_career_page, parse_teacher_page


def next_data_page_props(page_props: dict) -> str:
    payload = {"props": {"pageProps": page_props}}
    return (
        '<script id="__NEXT_DATA__" type="application/json">'
        + json.dumps(payload)
        + "</script>"
    )


class LegacyParserTests(unittest.TestCase):
    def test_career_page_returns_unique_clean_names(self):
        html = next_data_page_props(
            {
                "searchTeachers": [
                    {"name": "VERONICA MARTINEZ VILLAFUERTE", "subject": "Cálculo"},
                    {"name": "Veronica Martinez Villafuerte", "subject": "Programación"},
                    {"name": "  RENE   SANCHEZ RAMOS ", "subject": "Cálculo"},
                ]
            }
        )
        names = parse_career_page(html)
        self.assertIn("Veronica Martinez Villafuerte", names)
        self.assertEqual(names, ["Rene Sanchez Ramos", "Veronica Martinez Villafuerte"])

    def test_teacher_page_extracts_aggregates_and_comments(self):
        html = next_data_page_props(
            {
                "teacher": {
                    "name": "VERONICA MARTINEZ VILLAFUERTE",
                    "reviews": [
                        {
                            "fair": 100,
                            "explainsWell": 80,
                            "hard": 40,
                            "homework": 20,
                            "attendance": 100,
                            "generalScore": 90,
                            "_links": {"self": {"href": "/api/reviews/1"}},
                        },
                        {
                            "fair": 60,
                            "explainsWell": 100,
                            "hard": 60,
                            "homework": 40,
                            "attendance": 80,
                            "generalScore": 70,
                            "_links": {"self": {"href": "/api/reviews/2"}},
                        },
                    ],
                    "comments": [
                        {
                            "content": "  Explica muy bien. ",
                            "date": "2026-01-01T12:00:00",
                            "_links": {"self": {"href": "/api/comments/3"}},
                        },
                        {"content": "   "},
                    ],
                }
            }
        )
        teacher = parse_teacher_page(html)
        self.assertEqual(teacher.name, "Veronica Martinez Villafuerte")
        self.assertEqual(teacher.review_count, 2)
        self.assertEqual(teacher.metrics["fair_percent"], 80)
        self.assertEqual(teacher.metrics["general_score"], 80)
        self.assertEqual(len(teacher.comments), 1)
        self.assertEqual(teacher.comments[0].source_id, "3")
        self.assertNotIn("_links", json.dumps(teacher.to_dict()))

    def test_name_normalization(self):
        self.assertEqual(clean_teacher_name("  CASTAÑUELA   FUENTES LUIS ENRIQUE "), "Castañuela Fuentes Luis Enrique")
        self.assertEqual(teacher_slug("Verónica Martínez Villafuerte"), "veronica-martinez-villafuerte")

    def test_unavailable_career_is_empty(self):
        html = next_data_page_props({"error": {"statusCode": 404}})
        self.assertEqual(parse_career_page(html), [])


if __name__ == "__main__":
    unittest.main()
