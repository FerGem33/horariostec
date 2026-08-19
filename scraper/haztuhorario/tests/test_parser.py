import json
import unittest

from haztuhorario.normalization import clean_teacher_name, teacher_slug
from haztuhorario.parser import (
    parse_career_page,
    parse_career_page_entries,
    parse_careers_page,
    parse_teacher_page,
)


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


class AppRouterHtmlParserTests(unittest.TestCase):
    def test_parse_careers_page_html(self):
        html = """
        <html><body>
          <a href="/recomendaciones/37076-sistemas">Sistemas</a>
          <a href="/recomendaciones/37169-mecatronica">Mecatrónica</a>
          <a href="/acerca-del-proyecto">Acerca</a>
        </body></html>
        """
        careers = parse_careers_page(html)
        self.assertEqual(careers, ["Mecatrónica", "Sistemas"])

    def test_parse_career_page_html(self):
        html = """
        <html><body>
          <h1>Profesores de Sistemas</h1>
          <ul>
            <li><a href="/profesores/345-eduardo-fernandez-chavez">→Eduardo Fernandez Chavez</a></li>
            <li><a href="/profesores/412389-castanuela-fuentes-luis-enrique">→CASTAÑUELA FUENTES LUIS ENRIQUE</a></li>
            <li><a href="/profesores/345-eduardo-fernandez-chavez">→Eduardo Fernandez Chavez</a></li>
          </ul>
        </body></html>
        """
        entries = parse_career_page_entries(html)
        self.assertEqual(
            entries,
            [
                ("Eduardo Fernandez Chavez", "/profesores/345-eduardo-fernandez-chavez"),
                ("Castañuela Fuentes Luis Enrique", "/profesores/412389-castanuela-fuentes-luis-enrique"),
            ],
        )
        names = parse_career_page(html)
        self.assertEqual(
            names,
            ["Castañuela Fuentes Luis Enrique", "Eduardo Fernandez Chavez"],
        )

    def test_parse_teacher_page_html(self):
        html = """
        <html><body>
          <header>
            <h1>Eduardo Fernandez Chavez</h1>
            <div aria-label="Calificación general">
              <strong>90.4</strong>
            </div>
          </header>
          <main>
            <p>Este profesor ha sido calificado 24 veces. Comparte el link.</p>
            <article>
              <h3>Califica de manera justa</h3>
              <div><strong>91.5%</strong><span>De acuerdo</span></div>
            </article>
            <article>
              <h3>Explica bien los temas</h3>
              <div><strong>82%</strong><span>De acuerdo</span></div>
            </article>
            <article>
              <h3>Es difícil pasar su materia</h3>
              <div><strong>33.8%</strong><span>De acuerdo</span></div>
            </article>
            <article>
              <h3>Encarga mucha tarea</h3>
              <div><strong>50%</strong><span>De acuerdo</span></div>
            </article>
            <article>
              <h3>Toma en cuenta la asistencia</h3>
              <div><strong>58.3%</strong><span>De acuerdo</span></div>
            </article>
            <section id="comentarios">
              <h2>Comentarios</h2>
              <ol>
                <li>
                  <article>
                    <p class="font-semibold leading-7">Excelente docente</p>
                    <p><time datetime="2026-08-10T22:53:14.000Z">10 de agosto</time></p>
                  </article>
                </li>
              </ol>
            </section>
          </main>
        </body></html>
        """
        teacher = parse_teacher_page(html, source_url="https://haztuhorario.com/profesores/345-eduardo-fernandez-chavez")
        self.assertEqual(teacher.name, "Eduardo Fernandez Chavez")
        self.assertEqual(teacher.review_count, 24)
        self.assertEqual(teacher.metrics["general_score"], 90.4)
        self.assertEqual(teacher.metrics["fair_percent"], 91.5)
        self.assertEqual(teacher.metrics["explains_well_percent"], 82.0)
        self.assertEqual(teacher.metrics["hard_percent"], 33.8)
        self.assertEqual(teacher.metrics["homework_percent"], 50.0)
        self.assertEqual(teacher.metrics["attendance_percent"], 58.3)
        self.assertEqual(len(teacher.comments), 1)
        self.assertEqual(teacher.comments[0].content, "Excelente docente")
        self.assertEqual(teacher.comments[0].published_at, "2026-08-10T22:53:14.000Z")


if __name__ == "__main__":
    unittest.main()
