import unittest
from build_member_registry import resolve_legacy_ids


class LegacyIdentityTests(unittest.TestCase):
    def setUp(self):
        self.rows = [
            {"id": "1", "name": "Nom, Camille", "email": "first@example.org", "phone": "514-555-0101"},
            {"id": "2", "name": "Camille Nom", "email": "second@example.org", "phone": "514-555-0102"},
        ]

    def historical(self, email="", phone=""):
        return [["AP-DEMO", "Nom", "Camille", phone, email, None, None, "FR"]]

    def test_email_distinguishes_two_same_name_records_without_merging(self):
        self.assertEqual(resolve_legacy_ids(self.rows, self.historical("first@example.org")), {"AP-DEMO": "1"})
        self.assertEqual(resolve_legacy_ids(self.rows, self.historical("second@example.org")), {"AP-DEMO": "2"})
        self.assertEqual(len(self.rows), 2)

    def test_ambiguous_name_alone_stays_unassigned(self):
        self.assertEqual(resolve_legacy_ids(self.rows, self.historical()), {})

    def test_phone_helps_only_when_it_is_unambiguous(self):
        self.assertEqual(resolve_legacy_ids(self.rows, self.historical(phone="+1 514 555 0102")), {"AP-DEMO": "2"})
        self.rows[1]["phone"] = self.rows[0]["phone"]
        self.assertEqual(resolve_legacy_ids(self.rows, self.historical(phone="514-555-0101")), {})


if __name__ == "__main__":
    unittest.main()
