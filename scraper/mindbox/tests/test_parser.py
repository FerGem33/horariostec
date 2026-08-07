import unittest

from scraper.parser import parse_offerings


HTML = """
<html><body>
  <table class="table table-bordered table-striped default">
    <tr><th>Materia</th><th>Profesor</th></tr>
    <tr>
      <td>Af1 / Cálculo Diferencial</td>
      <td><small>Gaytán Tanguma Celina</small></td>
      <td>A</td><td>1</td>
      <td>10:00-11:00</td><td>10:00-11:00</td>
      <td>10:00-11:00</td><td>10:00-11:00</td><td>10:00-11:00</td>
    </tr>
  </table>
</body></html>
"""

CURRENT_HTML = """
<html><body>
  <table class="table table-bordered table-striped default">
    <tr><th>Materia / Docente</th><th>Grupo</th><th>Créditos</th>
      <th>Lunes</th><th>Martes</th><th>Miércoles</th><th>Jueves</th>
      <th>Viernes</th><th>Sábado</th><th>Domingo</th></tr>
    <tr>
      <td>
        <span>SCD1016</span> / <span class="text-mb-primary">LENGUAJES Y AUTÓMATAS II</span><br>
        <span class="text-xs">CABRERA CHAGOYAN KARINA</span>
      </td>
      <td>C</td><td>5</td>
      <td>11:00 - 12:00<br>R04</td><td>11:00 - 12:00<br>R04</td>
      <td>11:00 - 12:00<br>R04</td><td>11:00 - 12:00<br>R04</td>
      <td>11:00 - 12:00<br>R04</td><td>--</td><td>--</td>
    </tr>
  </table>
</body></html>
"""

EMPTY_TABLE_HTML = """
<table class="table table-bordered table-striped default">
  <thead><tr><th>Materia / Docente</th><th>Grupo</th></tr></thead>
  <tbody></tbody>
</table>
"""


class ParserTests(unittest.TestCase):
    def test_parses_current_mindbox_table_shape(self):
        offerings = parse_offerings(HTML, semester=1, career="Sistemas")

        self.assertEqual(len(offerings), 1)
        offering = offerings[0]
        self.assertEqual(offering.subject, "Af1 / Cálculo Diferencial")
        self.assertEqual(offering.teacher, "Gaytán Tanguma Celina")
        self.assertEqual(offering.group, "A")
        self.assertEqual(offering.semester, 1)
        self.assertEqual(offering.schedule["monday"], "10:00-11:00")
        self.assertEqual(offering.career, "Sistemas")

    def test_parses_current_mindbox_subject_teacher_and_weekend_columns(self):
        offerings = parse_offerings(CURRENT_HTML, semester=7, career="Sistemas")

        offering = offerings[0]
        self.assertEqual(offering.course_code, "SCD1016")
        self.assertEqual(offering.subject, "LENGUAJES Y AUTÓMATAS II")
        self.assertEqual(offering.teacher, "CABRERA CHAGOYAN KARINA")
        self.assertEqual(offering.credits, 5)
        self.assertEqual(offering.schedule["thursday"], "11:00 - 12:00 R04")
        self.assertIsNone(offering.schedule["saturday"])
        self.assertIsNone(offering.schedule["sunday"])

    def test_accepts_a_table_without_group_rows(self):
        self.assertEqual(parse_offerings(EMPTY_TABLE_HTML, semester=9, career="Sistemas"), [])


if __name__ == "__main__":
    unittest.main()
