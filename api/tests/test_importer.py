import sqlite3
import unittest
from pathlib import Path

from importer import legacy_sql, mindbox_sql, sql_statements


SCHEMA = (Path(__file__).resolve().parents[1] / "migrations/0001_initial.sql").read_text(
    encoding="utf-8"
)


def database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.executescript(SCHEMA)
    return connection


class ImporterTests(unittest.TestCase):
    def test_legacy_import_replaces_previous_snapshot(self):
        connection = database()
        first = {
            "teachers": [
                {
                    "name": "PEREZ ÁLVAREZ ANA",
                    "review_count": 2,
                    "metrics": {"general_score": 80},
                    "comments": [{"content": "Buen curso", "source_id": "1"}],
                    "source_url": "https://example.test/teacher",
                }
            ]
        }
        second = {
            "teachers": [
                {
                    "name": "Ana Perez Alvarez",
                    "review_count": 4,
                    "metrics": {"general_score": 90},
                    "comments": [{"content": "Actualizado", "source_id": "2"}],
                    "source_url": "https://example.test/teacher",
                }
            ]
        }
        connection.executescript(sql_statements(legacy_sql(first)))
        connection.executescript(sql_statements(legacy_sql(second)))

        self.assertEqual(connection.execute("SELECT COUNT(*) FROM legacy_teacher_summaries").fetchone()[0], 1)
        self.assertEqual(connection.execute("SELECT review_count FROM legacy_teacher_summaries").fetchone()[0], 4)
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM legacy_comments").fetchone()[0], 1)
        self.assertEqual(connection.execute("SELECT body FROM legacy_comments").fetchone()[0], "Actualizado")

    def test_mindbox_import_replaces_only_selected_term_and_cascades_meetings(self):
        connection = database()
        first = {
            "career": "sistemas",
            "offerings": [
                {
                    "subject": "CÁLCULO DIFERENCIAL",
                    "course_code": "ACF0901",
                    "teacher": "JUAREZ MARTINEZ RODRIGO",
                    "group": "A",
                    "semester": 1,
                    "credits": 5,
                    "schedule": {"monday": "14:00 - 15:00 N20"},
                }
            ],
        }
        replacement = {
            "career": "sistemas",
            "offerings": [
                {
                    "subject": "CÁLCULO DIFERENCIAL",
                    "course_code": "ACF0901",
                    "teacher": "Rodrigo Juarez Martinez",
                    "group": "B",
                    "semester": 1,
                    "credits": 5,
                    "schedule": {"monday": "15:00 - 16:00 N21"},
                }
            ],
        }
        other_term = {
            "career": "sistemas",
            "offerings": [
                {
                    "subject": "PROGRAMACIÓN",
                    "course_code": "SCD1008",
                    "teacher": "OTRO DOCENTE",
                    "group": "A",
                    "semester": 2,
                    "credits": 5,
                    "schedule": {"tuesday": "10:00 - 11:00 R01"},
                }
            ],
        }
        connection.executescript(sql_statements(mindbox_sql(
            first, career="sistemas", term_code="2026-1", term_name="Enero - Junio 2026", activate=False
        )))
        connection.executescript(sql_statements(mindbox_sql(
            other_term, career="sistemas", term_code="2026-1", term_name="Enero - Junio 2026", activate=False
        )))
        connection.executescript(sql_statements(mindbox_sql(
            first, career="sistemas", term_code="2026-2", term_name="Agosto - Diciembre 2026", activate=True
        )))
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM sections").fetchone()[0], 2)
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM class_meetings").fetchone()[0], 2)

        connection.executescript(sql_statements(mindbox_sql(
            replacement, career="sistemas", term_code="2026-2", term_name="Agosto - Diciembre 2026", activate=True
        )))
        rows = connection.execute(
            "SELECT tm.code, sec.group_name, cm.start_time FROM sections sec "
            "JOIN terms tm ON tm.id = sec.term_id "
            "JOIN class_meetings cm ON cm.section_id = sec.id ORDER BY tm.code"
        ).fetchall()
        self.assertEqual(rows, [("2026-1", "A", "10:00"), ("2026-2", "B", "15:00")])
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM class_meetings").fetchone()[0], 2)
        self.assertEqual(connection.execute("SELECT display_name FROM teachers WHERE normalized_name = 'juarez martinez rodrigo'").fetchone()[0], "Juarez Martinez Rodrigo")


if __name__ == "__main__":
    unittest.main()
