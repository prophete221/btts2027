#!/usr/bin/env python3
"""
BTTSPredict — Enrichissement AI des pronostics (BATCH MODE, Marque Blanche)
=============================================================================

UN SEUL appel API pour enrichir TOUS les matchs (Free + VIP)
en une seule requête — évite les timeouts et les erreurs 429.

Génère pour chaque match :
  - ai_exact_score : le score exact prédit (ex: "2-1")
  - ai_key_fact   : une statistique clé percutante (max 15 mots)
  - ai_analysis    : une analyse statistique de 2 phrases max

Marque blanche 100% BTTSPredict AI — aucune mention d'API tierce.

Utilisation :
  GEMINI_API_KEY=your_key python3 scripts/enrich_predictions.py

En l'absence de GEMINI_API_KEY, le script s'arrête proprement sans modifier
le fichier (mode dry-run silencieux — le build CI ne doit pas casser).
"""

import json
import os
import sys
import time
from pathlib import Path

# ─── Constants ──────────────────────────────────────────────────────────────
MODELS_TO_TRY = [
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-flash",
]
PREDICTIONS_FILE = Path(__file__).parent.parent / "public" / "predictions.json"
MAX_RETRIES = 2
RETRY_DELAY = 5  # seconds between retries
RATE_LIMIT_WAIT = 20  # seconds on 429

# ─── Gemini SDK ────────────────────────────────────────────────────────────
try:
    from google import genai
except ImportError:
    print("[enrich] google-genai not installed — skipping enrichment")
    sys.exit(0)


def get_client():
    """Initialize Gemini client from environment variable."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[enrich] GEMINI_API_KEY not set — skipping enrichment (dry-run)")
        return None
    return genai.Client(api_key=api_key)


def build_batch_prompt(all_matches: list, id_offset: int = 0) -> str:
    """Build a single batch prompt for ALL matches at once."""
    matches_summary = []
    for i, m in enumerate(all_matches, start=id_offset):
        home = m.get("home", "Unknown")
        away = m.get("away", "Unknown")
        league = m.get("league", "Unknown")
        xg_home = m.get("xgHome", m.get("homeLambda", 0))
        xg_away = m.get("xgAway", m.get("awayLambda", 0))
        btts_prob = m.get("bttsProb", 0)
        over25_prob = m.get("over25Prob", 0)
        reliability = m.get("reliabilityScore", 0)
        existing = m.get("analysis", "")

        preds = m.get("predictions", [])
        btts_pred = next((p for p in preds if p.get("type") == "BTTS"), {})
        over_pred = next((p for p in preds if p.get("type", "").startswith("Over")), {})
        btts_value = btts_pred.get("prediction", "N/A")
        over_value = over_pred.get("prediction", "N/A")

        matches_summary.append({
            "id": i,
            "match": f"{home} vs {away}",
            "league": league,
            "xG_home": xg_home,
            "xG_away": xg_away,
            "BTTS_prob_pct": round(btts_prob * 100, 1),
            "BTTS_prediction": btts_value,
            "Over25_prob_pct": round(over25_prob * 100, 1),
            "Over25_prediction": over_value,
            "reliability": reliability,
            "existing_data": existing,
        })

    prompt = f"""# ROLE
Tu es un analyste de football quantitatif pour BTTSPredict. Ton objectif est de modéliser chaque match à partir de données fournies, pas de donner un avis de fan.

# CADRE DE DONNÉES ET DE FRAÎCHEUR
Le pipeline amont a déjà collecté et calculé les données transmises ci-dessous. La date et l'heure du match présentes dans l'entrée sont la seule référence temporelle autorisée.
Tu ne dois pas prétendre utiliser un navigateur, une recherche web, une API externe ou Python dans cet appel Gemini. Tu ne dois citer une source que si elle est explicitement présente dans les données fournies. Si une source, une date de source ou une donnée récente n'est pas fournie, écris « donnée indisponible » au lieu de l'inventer.

Analyse les {len(all_matches)} matchs suivants :
{json.dumps(matches_summary, ensure_ascii=False, indent=2)}

# MÉTHODE QUANTITATIVE EN 4 ÉTAPES
ÉTAPE 1 — COLLECTE STRICTE : utilise uniquement les équipes, la ligue, les dates, les xG, les probabilités, la fiabilité et l'analyse fournis. Pour la composition probable, les blessés, les suspendus, la forme détaillée, le classement, la motivation, la fatigue ou la météo, indique « Donnée insuffisante: [nom] » si le champ n'est pas présent.

ÉTAPE 2 — MODÉLISATION : les probabilités BTTS et Over 2.5 transmises par le pipeline sont les calculs Poisson de référence. Ne les remplace pas par une intuition. Si les moyennes de buts, xGA ou composantes nécessaires aux formules sont absentes, n'invente pas de force offensive ou défensive et indique la donnée manquante. Le score exact doit rester cohérent avec les xG fournis.

ÉTAPE 3 — INCERTITUDE : une information critique absente doit être signalée clairement dans l'analyse. Ne bloque pas les autres champs, mais réduis la confiance lorsque les données sont faibles ou incomplètes.

ÉTAPE 4 — DÉCISION : transforme uniquement les données disponibles en probabilités prudentes. Aucune garantie de gain n'est autorisée.

# FORMAT FINAL STRICT
Retourne uniquement un tableau JSON valide, sans Markdown et sans texte avant ou après :
[
  {{
    "id": 0,
    "ai_exact_score": "2-1",
    "exact_score_prob": "18%",
    "ai_btts_view": "74%",
    "ai_over25_view": "68%",
    "winner": "1 / N / 2",
    "winner_prob": "XX%",
    "team_over15": "Equipe: OUI/NON",
    "double_chance": "1X / X2 / 12",
    "main_prediction": "Phrase unique, prudente",
    "risk": "FAIBLE / MOYEN / ÉLEVÉ",
    "ai_key_fact": "Statistique clé, 15 mots maximum",
    "ai_analysis": "Justification de 3 à 5 phrases maximum, basée uniquement sur les chiffres fournis."
  }},
  ...
]

# RÈGLES DE SORTIE
- Écris en français.
- Le score exact doit être réaliste et basé sur les xG fournis.
- Les probabilités doivent être exprimées en pourcentage avec le signe %. Ne fabrique aucune précision non justifiée.
- « winner » doit être 1, N ou 2, et « double_chance » doit être 1X, X2 ou 12. Si les données ne permettent pas une décision fiable, utilise « Donnée insuffisante » dans le champ concerné.
- « main_prediction » doit rester prudente et ne jamais promettre un résultat.
- N'utilise jamais « sure bet », « gain garanti » ou « 100% sûr ».

# ANTI-HALLUCINATION OBLIGATOIRE
- Utilise exclusivement les données présentes dans la liste ci-dessus.
- Tu NE DOIS PAS inventer de statistiques, de H2H, de blessures, de classement, de résultats, de météo, de sources ou de xG.
- Si une donnée manque, écris exactement « donnée indisponible » ou « Donnée insuffisante: [nom] ».
- Ne prétends jamais avoir consulté une source qui ne t'a pas été fournie.
- Ne transforme jamais une donnée manquante en estimation présentée comme réelle.
- L'"id" doit correspondre exactement à l'index du match dans la liste ci-dessus."""

    return prompt


def _call_gemini_chunk(client, matches: list, id_offset: int) -> list:
    """Enrich one small chunk so the strict JSON response is not truncated."""
    prompt = build_batch_prompt(matches, id_offset=id_offset)

    for model_name in MODELS_TO_TRY:
        print(f"[enrich] Trying model: {model_name} for chunk {id_offset + 1}-{id_offset + len(matches)}...")

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json",
                        "temperature": 0.7,
                        "max_output_tokens": 4096,
                    },
                )

                result = json.loads(response.text or "")
                if isinstance(result, list) and len(result) > 0:
                    print(f"[enrich] ✅ Received {len(result)} enrichments from {model_name}")
                    return result
                print(f"[enrich] ⚠️ Unexpected response format (attempt {attempt + 1})")

            except json.JSONDecodeError as e:
                print(f"[enrich] ⚠️ JSON parse error (attempt {attempt + 1}): {e}")
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    print(f"[enrich] ⏳ Rate limited on {model_name}, waiting {RATE_LIMIT_WAIT}s...")
                    time.sleep(RATE_LIMIT_WAIT)
                    continue
                if "quota" in err_str.lower():
                    print(f"[enrich] ❌ Quota exceeded on {model_name} — skipping this model")
                    break
                if "404" in err_str or "NOT_FOUND" in err_str:
                    print(f"[enrich] ⚠️ Model {model_name} not found — trying fallback")
                    break
                print(f"[enrich] ⚠️ API error on {model_name} (attempt {attempt + 1}): {err_str[:150]}")

            if attempt < MAX_RETRIES:
                print(f"[enrich] Retrying in {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)

        print(f"[enrich] {model_name} failed — trying next fallback model...")

    print(f"[enrich] ❌ All models exhausted for chunk {id_offset + 1}-{id_offset + len(matches)}")
    return []


def call_gemini_batch(client, all_matches: list) -> list:
    """Enrich all matches in small chunks and preserve global match indexes."""
    chunk_size = 4
    enrichments = []
    for id_offset in range(0, len(all_matches), chunk_size):
        chunk = all_matches[id_offset:id_offset + chunk_size]
        result = _call_gemini_chunk(client, chunk, id_offset)
        enrichments.extend(result)
        if not result:
            print(f"[enrich] ⚠️ Chunk {id_offset + 1}-{id_offset + len(chunk)} returned no enrichment")
    print(f"[enrich] Received {len(enrichments)}/{len(all_matches)} total enrichments")
    return enrichments


def main():
    print("[enrich] Starting BTTSPredict AI enrichment (BATCH MODE)")

    # Check predictions file exists
    if not PREDICTIONS_FILE.exists():
        print(f"[enrich] {PREDICTIONS_FILE} not found — skipping")
        sys.exit(0)

    # Load predictions
    with open(PREDICTIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    free_matches = data.get("free", [])
    vip_matches = data.get("vipPreview", [])

    total = len(free_matches) + len(vip_matches)
    if total == 0:
        print("[enrich] No matches to enrich — skipping")
        sys.exit(0)

    print(f"[enrich] Found {len(free_matches)} free + {len(vip_matches)} VIP = {total} matches")

    # Get Gemini client
    client = get_client()
    if client is None:
        print("[enrich] Dry-run complete (no API key)")
        sys.exit(0)

    # Build combined list of all matches to enrich.
    # Mission « données réelles » : Gemini ne reçoit que des lignes prédictives
    # portant une probabilité réelle du modèle (issues de vraies données ESPN).
    # Les lignes « données limitées » (dataLimited: true, sans probabilité) sont
    # EXCLUES — rien à résumer sans données, et aucune invention possible.
    # Plafond de quota : GEMINI_MAX_LINES lignes max par run (48).
    GEMINI_MAX_LINES = 48
    eligible = [m for m in list(free_matches) + list(vip_matches) if isinstance(m.get("proba"), (int, float)) and not m.get("dataLimited")]
    skipped = (len(free_matches) + len(vip_matches)) - len(eligible)
    all_matches = eligible[:GEMINI_MAX_LINES]
    capped = len(eligible) - len(all_matches)
    if skipped:
        print(f"[enrich] {skipped} ligne(s) « données limitées » exclue(s) de l'enrichissement (aucune probabilité réelle)")
    if capped:
        print(f"[enrich] {capped} ligne(s) éligible(s) au-delà du plafond de {GEMINI_MAX_LINES} (quota Gemini)")

    # Diagnostic: list available models for this API key
    try:
        available = [m.name for m in client.models.list()]
        print(f"[enrich] Models available for this key: {available}")
    except Exception as e:
        print(f"[enrich] Could not list models: {e}")

    print(f"[enrich] Sending 1 batch API call for {len(all_matches)} matches...")

    # Single batch API call
    enrichments = call_gemini_batch(client, all_matches)

    if not enrichments:
        print("[enrich] No enrichments received — saving file unchanged")
    else:
        # Apply enrichments to matches by index
        enriched_count = 0
        for item in enrichments:
            idx = item.get("id")
            ai_exact_score = item.get("ai_exact_score", "").strip()
            exact_score_prob = item.get("exact_score_prob", "").strip()
            ai_btts_view = item.get("ai_btts_view", "").strip()
            ai_over25_view = item.get("ai_over25_view", "").strip()
            ai_key_fact = item.get("ai_key_fact", "").strip()
            ai_analysis = item.get("ai_analysis", "").strip()
            winner = item.get("winner", "").strip()
            winner_prob = item.get("winner_prob", "").strip()
            team_over15 = item.get("team_over15", "").strip()
            double_chance = item.get("double_chance", "").strip()
            main_prediction = item.get("main_prediction", "").strip()
            risk = item.get("risk", "").strip()

            # VALIDATION: vérifier que les probabilités sont valides
            def validate_prob(val):
                if not val: return False
                try:
                    num = float(val.replace('%', ''))
                    return 0 <= num <= 100 and not (val == 'nan' or val == 'inf')
                except:
                    return False

            if idx is None:
                continue

            idx = int(idx)
            if 0 <= idx < len(all_matches):
                match = all_matches[idx]
                if ai_exact_score:
                    match["ai_exact_score"] = ai_exact_score
                if validate_prob(exact_score_prob):
                    match["exact_score_prob"] = exact_score_prob
                if validate_prob(ai_btts_view):
                    match["ai_btts_view"] = ai_btts_view
                # Keep old field for backward compat (UI reads ai_btts_prob)
                match["ai_btts_prob"] = ai_btts_view if validate_prob(ai_btts_view) else ""
                if validate_prob(ai_over25_view):
                    match["ai_over25_view"] = ai_over25_view
                match["ai_over25_prob"] = ai_over25_view if validate_prob(ai_over25_view) else ""
                if ai_key_fact:
                    match["ai_key_fact"] = ai_key_fact
                if ai_analysis:
                    match["ai_analysis"] = ai_analysis
                if winner:
                    match["ai_winner"] = winner
                if validate_prob(winner_prob):
                    match["ai_winner_prob"] = winner_prob
                if team_over15:
                    match["ai_team_over15"] = team_over15
                if double_chance:
                    match["ai_double_chance"] = double_chance
                if main_prediction:
                    match["ai_main_prediction"] = main_prediction
                if risk:
                    match["ai_risk"] = risk
                match_name = f"{match.get('home', '?')} vs {match.get('away', '?')}"
                print(f"  [{idx+1}] ✅ {match_name}: score={ai_exact_score} ({exact_score_prob}), BTTS_view={ai_btts_view}, O2.5_view={ai_over25_view}")
                enriched_count += 1

        print(f"[enrich] Enriched {enriched_count}/{len(all_matches)} matches")

    # Sync legacy "predictions" array with free
    data["predictions"] = data.get("free", [])

    # Save enriched predictions
    with open(PREDICTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[enrich] Saved enriched predictions to {PREDICTIONS_FILE}")
    print("[enrich] Done.")


if __name__ == "__main__":
    main()
