import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "enrich_predictions.py"
SPEC = importlib.util.spec_from_file_location("enrich_predictions", SCRIPT)
enrich = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(enrich)


class EnrichmentImmutabilityTests(unittest.TestCase):
    def test_gemini_can_only_write_allowlisted_narrative_fields(self):
        match = {
            "proba": 0.6432,
            "confidence": 64,
            "bttsProb": 0.6432,
            "over25Prob": 0.7021,
            "xgHome": 1.42,
            "xgAway": 1.11,
            "estimatedCote": 1.55,
            "ai_exact_score": "1-1",
            "exact_score_prob": "12%",
            "ai_btts_view": "64%",
            "ai_winner": "N",
            "ai_absences": "Texte issu du fallback",
            "predictions": [{"type": "BTTS", "prediction": "Oui", "confidence": 64}],
        }
        before = {key: value.copy() if isinstance(value, list) else value for key, value in match.items()}
        hostile = {
            "id": 0,
            "ai_analysis": "Analyse fondée sur les seules données du match.",
            "ai_key_fact": "La forme récente fournie est contrastée.",
            "ai_absences": "Un joueur vedette est blessé.",
            "ai_odds_insight": "Nouvelle cote supposée: 9.99.",
            "ai_exact_score": "5-0",
            "exact_score_prob": "99%",
            "ai_btts_view": "99%",
            "ai_over25_view": "99%",
            "ai_winner_prob": "99%",
            "winner": "1",
            "team_over15": "A: OUI",
            "double_chance": "1X",
            "risk": "FAIBLE",
            "confidence": 99,
            "proba": 0.99,
            "xgHome": 5.0,
            "estimatedCote": 9.99,
        }

        self.assertTrue(enrich.apply_enrichment(match, hostile))
        for key in ("proba", "confidence", "bttsProb", "over25Prob", "xgHome", "xgAway", "estimatedCote",
                    "ai_exact_score", "exact_score_prob", "ai_btts_view", "ai_winner", "predictions", "ai_absences"):
            self.assertEqual(match[key], before[key], key)
        self.assertEqual(match["ai_analysis"], hostile["ai_analysis"])
        self.assertEqual(match["ai_key_fact"], hostile["ai_key_fact"])
        self.assertNotIn("ai_odds_insight", match)

    def test_fallback_never_returns_numeric_or_score_prediction_fields(self):
        fields = enrich.local_fallback({
            "home": "Home FC", "away": "Away FC", "bttsProb": 0.6, "over25Prob": 0.7,
            "xgHome": 1.4, "xgAway": 1.2,
        })
        self.assertTrue(all(isinstance(value, (str, bool)) for value in fields.values()))
        forbidden = {"ai_exact_score", "exact_score_prob", "ai_btts_view", "ai_over25_view", "winner",
                     "winner_prob", "ai_winner_prob", "team_over15", "double_chance", "risk"}
        self.assertTrue(forbidden.isdisjoint(fields))

    def test_prompt_does_not_ask_gemini_for_any_prediction_number_fields(self):
        prompt = enrich.build_batch_prompt([{"home": "A", "away": "B", "bttsProb": 0.6, "over25Prob": 0.5}])
        self.assertNotIn('"ai_exact_score":', prompt)
        self.assertNotIn('"ai_btts_view":', prompt)
        self.assertNotIn('"winner_prob":', prompt)
        self.assertIn("Ne retourne aucun champ numérique", prompt)


if __name__ == "__main__":
    unittest.main()
