#!/usr/bin/env python3
"""
BTTSPredict — Enrichissement AI des pronostics (BATCH MODE v2, Marque Blanche)
==============================================================================

Appels API Gemini par petits chunks (4 matchs) pour enrichir Free + VIP.

NOUVEAUTÉS v2 :
  - Données réelles injectées dans le prompt : forme 5 derniers matchs,
    classement, cotes bookmaker réelles (ESPN/DraftKings, sans clé API).
  - Champs de sortie enrichis :
      ai_form_summary : résumé de la forme des DEUX équipes
      ai_absences     : disponibilités/absents (honnête, avec mention « à confirmer »)
      ai_odds_insight : lecture des cotes réelles + détection de value
      ai_analysis     : analyse solide de 4 à 6 phrases
  - FALLBACK LOCAL : si Gemini échoue sur un chunk, chaque match reçoit
    quand même une analyse complète générée localement depuis les données
    réelles → aucun pronostic n'est jamais incomplet ou absent.

Marque blanche 100% BTTSPredict AI — aucune mention d'API tierce.

Utilisation :
  GEMINI_API_KEY=your_key python3 scripts/enrich_predictions.py

En l'absence de GEMINI_API_KEY, le script applique uniquement le fallback
local (les analyses restent complètes, sans texte AI).
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
CHUNK_SIZE = 4
MAX_OUTPUT_TOKENS = 8192

# ─── Gemini SDK ────────────────────────────────────────────────────────────
try:
    from google import genai
except ImportError:
    print("[enrich] google-genai not installed — local fallback only")
    genai = None


def get_client():
    """Initialize Gemini client from environment variable."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[enrich] GEMINI_API_KEY not set — local fallback only")
        return None
    return genai.Client(api_key=api_key)


# ─── Helpers de formatage des données réelles ──────────────────────────────
def fmt_form(form):
    """Forme d'une équipe → lisible pour le prompt."""
    if not form:
        return None
    return {
        "5_derniers": form.get("last5String"),
        "bilan": f"{form.get('wins', 0)}V-{form.get('draws', 0)}N-{form.get('losses', 0)}D",
        "buts_marques": form.get("goalsFor"),
        "buts_encaisses": form.get("goalsAgainst"),
        "btts_rate": form.get("bttsRate"),
        "clean_sheets": form.get("cleanSheets"),
        "sans_marquer": form.get("failedToScore"),
    }


def fmt_standing(st):
    if not st:
        return None
    return {
        "classement": f"{st.get('rank')}e" if st.get("rank") else None,
        "points": st.get("points"),
        "matchs_joues": st.get("played"),
        "buts_pour": st.get("gf"),
        "buts_contre": st.get("ga"),
    }


def fmt_odds(odds):
    """Cotes bookmaker réelles (décimales)."""
    if not odds:
        return None
    return {
        "source": odds.get("provider"),
        "victoire_domicile": odds.get("home"),
        "nul": odds.get("draw"),
        "victoire_exterieur": odds.get("away"),
        "over_2_5": odds.get("over25"),
        "under_2_5": odds.get("under25"),
    }


def implied_prob(odds_val):
    """Probabilité implicite d'une cote décimale (0.xx)."""
    try:
        v = float(odds_val)
        if v <= 1.01:
            return None
        return round(100.0 / v, 1)
    except (TypeError, ValueError):
        return None


# ─── Construction du prompt batch ──────────────────────────────────────────
def build_batch_prompt(all_matches: list, id_offset: int = 0) -> str:
    """Build a single batch prompt for a chunk of matches."""
    matches_summary = []
    for i, m in enumerate(all_matches, start=id_offset):
        home = m.get("home", "Unknown")
        away = m.get("away", "Unknown")

        preds = m.get("predictions", [])
        btts_pred = next((p for p in preds if p.get("type") == "BTTS"), {})
        over_pred = next((p for p in preds if p.get("type", "").startswith("Over")), {})

        odds = fmt_odds(m.get("odds"))
        entry = {
            "id": i,
            "match": f"{home} vs {away}",
            "ligue": m.get("league", "Unknown"),
            "forme_domicile": fmt_form(m.get("formHome")),
            "forme_exterieur": fmt_form(m.get("formAway")),
            "classement_domicile": fmt_standing(m.get("standingsHome")),
            "classement_exterieur": fmt_standing(m.get("standingsAway")),
            "xG_modele_domicile": m.get("xgHome", m.get("homeLambda", 0)),
            "xG_modele_exterieur": m.get("xgAway", m.get("awayLambda", 0)),
            "BTTS_prob_pct": round(m.get("bttsProb", 0) * 100, 1),
            "Over25_prob_pct": round(m.get("over25Prob", 0) * 100, 1),
            "fiabilite_modele": m.get("reliabilityScore", 0),
        }
        if odds:
            entry["cotes_bookmaker_reelles"] = odds
            imp = {}
            for side, key in (("domicile", "victoire_domicile"), ("nul", "nul"), ("exterieur", "victoire_exterieur"), ("over25", "over_2_5")):
                p = implied_prob(odds.get(key))
                if p is not None:
                    imp[side] = f"{p}%"
            if imp:
                entry["probabilites_implicites_des_cotes"] = imp
        matches_summary.append(entry)

    prompt = f"""# ROLE
Tu es l'analyste football de BTTSPredict. Tu rédiges pour chaque match une analyse professionnelle, solide et lisible, qui couvre les DEUX équipes. Ton style : analyste quantitatif, jamais fan.

# DONNÉES FOURNIES (pipeline BTTSPredict, déjà collectées)
Pour chaque match tu reçois : la forme des 5 derniers matchs des deux équipes (V=N victoire, N=nul, D=défaite, buts marqués/encaissés, taux BTTS, clean sheets), le classement de la ligue, les xG du modèle Poisson BTTSPredict, les probabilités BTTS et Over 2.5 du modèle, la fiabilité, et — quand le marché les publie — les COTES BOOKMAKER RÉELLES (décimales) avec leurs probabilités implicites.
Si un champ est absent ou null, il n'est pas disponible : ne l'invente pas.

Analyse les {len(all_matches)} matchs suivants :
{json.dumps(matches_summary, ensure_ascii=False, indent=2)}

# MÉTHODE (4 étapes)
1. LECTURE DES DONNÉES : appuie-toi uniquement sur les données fournies ci-dessus (forme, classement, xG, probabilités, cotes).
2. LECTURE DU MARCHÉ : les cotes servent uniquement de contexte descriptif; ne calcule aucune value, probabilité ou cote.
3. INCERTITUDE : signale brièvement les données manquantes importantes, sans bloquer l'analyse.
4. DÉCISION : verdict prudent, jamais de garantie. Aucune promesse de gain.

# CHAMPS DE SORTIE EXIGÉS PAR MATCH — TEXTE SEULEMENT
- ai_key_fact : fait concis directement présent dans les données fournies, 15 mots max.
- ai_form_summary : 2 à 3 phrases décrivant la forme observée des deux équipes. Si une donnée manque, le dire explicitement.
- ai_analysis : 3 à 5 phrases professionnelles décrivant seulement les faits et tendances du modèle présents dans les données. Pas de promesse, conjecture, donnée externe ou détail inventé.
- Traductions anglaises fidèles : ai_key_fact_en, ai_form_summary_en, ai_analysis_en.
- N'écris rien sur les absences ni les cotes : ces champs sont remplis uniquement par le code depuis les sources fournies.

# IMMUTABILITÉ DES PRONOSTICS
- Tu rédiges uniquement ces champs textuels. Ne propose ni score exact, ni gagnant, ni nouveau verdict, ni confiance, ni risque, ni cote.
- Ne retourne aucun champ numérique ou champ de pronostic. N'essaie jamais de corriger/modifier une probabilité, un score, une cote, un lambda, une fiabilité ou un nombre présent dans le payload.
- Les chiffres éventuellement cités dans une phrase doivent être recopiés fidèlement des données fournies et rester du texte explicatif; ne calcule aucune valeur nouvelle.

# FORMAT FINAL STRICT — OBJET DE RÉDACTION UNIQUEMENT
Retourne uniquement un tableau JSON valide, sans Markdown et sans texte avant ou après :
[
  {{
    "id": 0,
    "ai_key_fact": "Statistique clé, 15 mots maximum",
    "ai_form_summary": "2 à 3 phrases sur la forme des deux équipes",
    "ai_analysis": "4 à 6 phrases couvrant les deux équipes, le marché et la conclusion",
    "ai_key_fact_en": "English translation of ai_key_fact",
    "ai_form_summary_en": "English translation of ai_form_summary",
    "ai_analysis_en": "English translation of ai_analysis"
  }},
  ...
]

# RÈGLES DE SORTIE
- Écris les champs principaux en français et les champs suffixés « _en » en anglais professionnel.
- L'"id" doit correspondre exactement à l'index du match dans la liste ci-dessus.

# ANTI-HALLUCINATION OBLIGATOIRE
- Utilise exclusivement les données présentes dans la liste ci-dessus.
- Tu NE DOIS PAS inventer de statistiques, de H2H, de noms de blessés/suspendus, de compositions, de météo, de sources ou de xG.
- Pour les absents : si aucune donnée d'effectif n'est fournie, utilise la phrase standard demandée — ne devine jamais.
- Ne prétends jamais avoir consulté une source qui ne t'a pas été fournie."""

    return prompt


# ─── FALLBACK LOCAL — aucune pronostic incomplet ───────────────────────────
def local_fallback(m) -> dict:
    """Génère une analyse complète et honnête depuis les données réelles.

    Utilisé quand Gemini ne répond pas pour ce match : le pronostic reste
    complet (forme, classement, cotes, conclusion du modèle), simplement
    rédigé par des gabarits déterministes plutôt que par l'AI.
    """
    home = m.get("home", "?")
    away = m.get("away", "?")
    btts = float(m.get("bttsProb", 0) or 0)
    over = float(m.get("over25Prob", 0) or 0)
    xgh = float(m.get("xgHome", m.get("homeLambda", 0) or 0))
    xga = float(m.get("xgAway", m.get("awayLambda", 0) or 0))
    form_home = m.get("formHome") or {}
    form_away = m.get("formAway") or {}
    st_home = m.get("standingsHome") or {}
    st_away = m.get("standingsAway") or {}
    odds = m.get("odds") or {}

    # — Forme —
    phrases = []
    phrases_en = []
    if form_home.get("last5String"):
        phrases.append(
            f"{home} aborde le match avec {form_home.get('wins', 0)} victoire(s), "
            f"{form_home.get('draws', 0)} nul(s) et {form_home.get('losses', 0)} défaite(s) sur ses 5 dernières sorties "
            f"({form_home.get('goalsFor', 0)} buts marqués, {form_home.get('goalsAgainst', 0)} encaissés)."
        )
        phrases_en.append(
            f"{home} come into this match with {form_home.get('wins', 0)} win(s), "
            f"{form_home.get('draws', 0)} draw(s) and {form_home.get('losses', 0)} defeat(s) in their last 5 outings "
            f"({form_home.get('goalsFor', 0)} goals scored, {form_home.get('goalsAgainst', 0)} conceded)."
        )
    else:
        phrases.append(f"Les données de forme récente de {home} ne sont pas disponibles.")
        phrases_en.append(f"Recent form data for {home} is not available.")
    if form_away.get("last5String"):
        phrases.append(
            f"{away} affiche {form_away.get('wins', 0)} victoire(s), {form_away.get('draws', 0)} nul(s) et "
            f"{form_away.get('losses', 0)} défaite(s) sur 5, pour {form_away.get('goalsFor', 0)} buts marqués "
            f"et {form_away.get('goalsAgainst', 0)} encaissés."
        )
        phrases_en.append(
            f"{away} record {form_away.get('wins', 0)} win(s), {form_away.get('draws', 0)} draw(s) and "
            f"{form_away.get('losses', 0)} defeat(s) in 5, with {form_away.get('goalsFor', 0)} goals scored "
            f"and {form_away.get('goalsAgainst', 0)} conceded."
        )
    else:
        phrases.append(f"Les données de forme récente de {away} ne sont pas disponibles.")
        phrases_en.append(f"Recent form data for {away} is not available.")

    # — Classement —
    if st_home.get("rank") and st_away.get("rank"):
        phrases.append(
            f"Au classement, {home} est {st_home['rank']}e avec {st_home.get('points', '?')} points, "
            f"face à {away}, {st_away['rank']}e avec {st_away.get('points', '?')} points."
        )
        phrases_en.append(
            f"In the standings, {home} sit {st_home['rank']}th with {st_home.get('points', '?')} points, "
            f"against {away}, {st_away['rank']}th with {st_away.get('points', '?')} points."
        )

    # — Cotes —
    if odds.get("home") and odds.get("away"):
        fav = home if odds["home"] < odds["away"] else away
        phrases.append(
            f"Le marché place {fav} en favori (1: {odds.get('home')}, nul: {odds.get('draw')}, 2: {odds.get('away')}"
            + (f", Over 2.5: {odds['over25']}" if odds.get("over25") else "")
            + f" — cotes {odds.get('provider', 'bookmaker')})."
        )
        phrases_en.append(
            f"The market makes {fav} the favourite (1: {odds.get('home')}, draw: {odds.get('draw')}, 2: {odds.get('away')}"
            + (f", Over 2.5: {odds['over25']}" if odds.get("over25") else "")
            + f" — {odds.get('provider', 'bookmaker')} odds)."
        )

    # — Conclusion modèle —
    btts_pct = round(btts * 100, 1)
    over_pct = round(over * 100, 1)
    phrases.append(
        f"Le modèle Poisson BTTSPredict projette {xgh:.2f} buts attendus pour {home} et {xga:.2f} pour {away}, "
        f"soit BTTS à {btts_pct}% et Over 2.5 à {over_pct}%."
    )
    phrases_en.append(
        f"The BTTSPredict Poisson model projects {xgh:.2f} expected goals for {home} and {xga:.2f} for {away}, "
        f"i.e. BTTS at {btts_pct}% and Over 2.5 at {over_pct}%."
    )
    if btts >= 0.55 and over >= 0.55:
        concl = "Le scénario d'un match ouvert avec des buts des deux côtés ressort comme la tendance principale."
        concl_en = "An open game with goals at both ends stands out as the main trend."
    elif btts >= 0.55:
        concl = "La tendance principale est un match avec des buts des deux côtés, sans garantie sur le total."
        concl_en = "The main trend is a match with goals at both ends, with no guarantee on the total."
    elif over >= 0.55:
        concl = "La tendance principale est un total de buts élevé, avec une réserve sur la participation des deux équipes."
        concl_en = "The main trend is a high total of goals, with a caveat on both teams scoring."
    else:
        concl = "Le modèle reste réservé : les scénarios de buts sont incertains, prudence recommandée."
        concl_en = "The model remains cautious: goal scenarios are uncertain, prudence is recommended."
    phrases.append(concl)
    phrases_en.append(concl_en)

    analysis = " ".join(phrases)
    analysis_en = " ".join(phrases_en)

    # — Form summary —
    form_bits = []
    form_bits_en = []
    if form_home.get("last5String"):
        form_bits.append(f"{home} : série {form_home['last5String']}, {form_home.get('goalsFor', 0)} buts marqués / {form_home.get('goalsAgainst', 0)} encaissés sur 5")
        form_bits_en.append(f"{home}: streak {form_home['last5String']}, {form_home.get('goalsFor', 0)} goals scored / {form_home.get('goalsAgainst', 0)} conceded in 5")
    if form_away.get("last5String"):
        form_bits.append(f"{away} : série {form_away['last5String']}, {form_away.get('goalsFor', 0)} buts marqués / {form_away.get('goalsAgainst', 0)} encaissés sur 5")
        form_bits_en.append(f"{away}: streak {form_away['last5String']}, {form_away.get('goalsFor', 0)} goals scored / {form_away.get('goalsAgainst', 0)} conceded in 5")
    form_summary = ". ".join(form_bits) + "." if form_bits else "Forme récente indisponible pour les deux équipes."
    form_summary_en = ". ".join(form_bits_en) + "." if form_bits_en else "Recent form unavailable for both teams."

    return {
        "ai_key_fact": (
            f"{home} {form_home.get('last5String')} vs {away} {form_away.get('last5String')} — BTTS {btts_pct}%, Over 2.5 {over_pct}%"
            if (form_home.get("last5String") and form_away.get("last5String"))
            else f"Modèle Poisson : BTTS {btts_pct}%, Over 2.5 {over_pct}%"
        ),
        "ai_key_fact_en": (
            f"{home} {form_home.get('last5String')} vs {away} {form_away.get('last5String')} — BTTS {btts_pct}%, Over 2.5 {over_pct}%"
            if (form_home.get("last5String") and form_away.get("last5String"))
            else f"Poisson model: BTTS {btts_pct}%, Over 2.5 {over_pct}%"
        ),
        "ai_form_summary": form_summary,
        "ai_form_summary_en": form_summary_en,
        "ai_absences": "Absents : aucune indisponibilité officielle dans nos données — compos à confirmer avant le coup d'envoi.",
        "ai_absences_en": "Absences: no official unavailability in our data — line-ups to be confirmed before kick-off.",
        "ai_odds_insight": (
            f"Le marché ({odds.get('provider', 'bookmaker')}) cote 1: {odds.get('home')}, nul: {odds.get('draw')}, 2: {odds.get('away')}"
            + (f", Over 2.5: {odds['over25']}." if odds.get("over25") else ".")
            if odds.get("home")
            else "Cotes marché non disponibles — pronostic basé sur le modèle statistique seul."
        ),
        "ai_odds_insight_en": (
            f"The market ({odds.get('provider', 'bookmaker')}) prices 1: {odds.get('home')}, draw: {odds.get('draw')}, 2: {odds.get('away')}"
            + (f", Over 2.5: {odds['over25']}." if odds.get("over25") else ".")
            if odds.get("home")
            else "Market odds unavailable — prediction based on the statistical model only."
        ),
        "ai_analysis": analysis,
        "ai_analysis_en": analysis_en,
        "_fallback": True,
    }


# ─── Appels Gemini par chunks ──────────────────────────────────────────────
def _call_gemini_chunk(client, matches: list, id_offset: int) -> list:
    """Enrich one small chunk so the strict JSON response is not truncated."""
    prompt = build_batch_prompt(matches, id_offset=id_offset)

    if client is None:
        return []

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
                        "max_output_tokens": MAX_OUTPUT_TOKENS,
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
    enrichments = []
    for id_offset in range(0, len(all_matches), CHUNK_SIZE):
        chunk = all_matches[id_offset:id_offset + CHUNK_SIZE]
        result = _call_gemini_chunk(client, chunk, id_offset)
        enrichments.extend(result)
        if not result:
            print(f"[enrich] ⚠️ Chunk {id_offset + 1}-{id_offset + len(chunk)} returned no enrichment — local fallback will cover it")
    print(f"[enrich] Received {len(enrichments)}/{len(all_matches)} total enrichments")
    return enrichments


def apply_enrichment(match: dict, item: dict) -> bool:
    """Apply narrative fields only; all model numbers and prediction fields are immutable."""
    if item.get("id") is None:
        return False

    text_fields = (
        "ai_key_fact", "ai_analysis", "ai_form_summary",
        "ai_key_fact_en", "ai_analysis_en", "ai_form_summary_en",
    )
    values = {
        key: value.strip()
        for key in text_fields
        if isinstance((value := item.get(key)), str) and value.strip()
    }
    if not values.get("ai_analysis") and not values.get("ai_key_fact"):
        return False
    match.update(values)
    return True


def apply_local_fallback(match: dict) -> None:
    """Applique le fallback local pour garantir un pronostic complet."""
    fb = local_fallback(match)
    for key, value in fb.items():
        if key == "_fallback":
            match["ai_source"] = "local-model-v2"
            continue
        if value:
            match[key] = value
    match["ai_source"] = "local-model-v2"


def main():
    print("[enrich] Starting BTTSPredict AI enrichment (BATCH MODE v2)")

    if not PREDICTIONS_FILE.exists():
        print(f"[enrich] {PREDICTIONS_FILE} not found — skipping")
        sys.exit(0)

    with open(PREDICTIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    free_matches = data.get("free", data.get("predictions", []))
    if not isinstance(free_matches, list):
        raise ValueError("free predictions must be a list")

    total = len(free_matches)
    if total == 0:
        print("[enrich] No published free matches — no text to enrich")
        data["predictions"] = free_matches
        return

    print(f"[enrich] Found {total} free matches; VIP fixture previews are not enriched")

    client = None
    if genai is not None:
        client = get_client()

    if client is not None:
        try:
            available = [m.name for m in client.models.list()]
            print(f"[enrich] Models available for this key: {available}")
        except Exception as e:
            print(f"[enrich] Could not list models: {e}")

        all_matches = free_matches
        print(f"[enrich] Sending batch API calls for {len(all_matches)} matches ({CHUNK_SIZE}/chunk)...")
        enrichments = call_gemini_batch(client, all_matches)

        enriched_count = 0
        for item in enrichments:
            idx = item.get("id")
            if idx is None:
                continue
            try:
                idx = int(idx)
            except (ValueError, TypeError):
                continue
            if 0 <= idx < len(all_matches):
                match = all_matches[idx]
                if apply_enrichment(match, item):
                    match["ai_source"] = "gemini-v2"
                    match_name = f"{match.get('home', '?')} vs {match.get('away', '?')}"
                    print(f"  [{idx+1}] ✅ {match_name}: narrative {len(match.get('ai_analysis', ''))} chars")
                    enriched_count += 1

        print(f"[enrich] Gemini enriched {enriched_count}/{len(all_matches)} matches")
    else:
        print("[enrich] No Gemini client — applying local fallback to all matches")

    # ─── FALLBACK LOCAL : garantit 100% de pronostics complets ───
    all_matches = free_matches
    for match in all_matches:
        sourced_text = local_fallback(match)
        for key in ("ai_absences", "ai_absences_en", "ai_odds_insight", "ai_odds_insight_en"):
            match[key] = sourced_text[key]

    fallback_count = 0
    for match in all_matches:
        if not match.get("ai_analysis") or len(match.get("ai_analysis", "").strip()) < 80:
            apply_local_fallback(match)
            fallback_count += 1

    if fallback_count:
        print(f"[enrich] 🔧 Local fallback applied to {fallback_count}/{len(all_matches)} incomplete matches")

    # Rapport final
    complete = sum(1 for m in all_matches if m.get("ai_analysis") and m.get("ai_key_fact"))
    print(f"[enrich] Complete narrative enrichments: {complete}/{len(all_matches)}")

    data["free"] = free_matches
    data["predictions"] = free_matches
    temp_path = PREDICTIONS_FILE.with_suffix(PREDICTIONS_FILE.suffix + ".tmp")
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(temp_path, PREDICTIONS_FILE)

    print(f"[enrich] Saved enriched predictions to {PREDICTIONS_FILE}")
    print("[enrich] Done.")


if __name__ == "__main__":
    main()
