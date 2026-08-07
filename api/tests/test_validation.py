import unittest

from src.validation import (
    validate_answers,
    validate_comment,
    validate_global_rating,
    validate_slug,
)


class ValidationTests(unittest.TestCase):
    def test_valid_review_values(self):
        self.assertEqual(validate_global_rating(99), 99)
        self.assertEqual(validate_comment("  buen profesor  "), "buen profesor")

    def test_invalid_rating(self):
        with self.assertRaises(ValueError):
            validate_global_rating(101)

    def test_answers_allow_optional_method_weights(self):
        self.assertEqual(
            validate_answers({"attendance_weight": 20, "difficulty": 4}),
            {"attendance_weight": 20, "difficulty": 4},
        )
        with self.assertRaises(ValueError):
            validate_answers({"fairness": 6})

    def test_slug(self):
        self.assertEqual(validate_slug("sistemas"), "sistemas")
        with self.assertRaises(ValueError):
            validate_slug("sistemas/teachers")


if __name__ == "__main__":
    unittest.main()
