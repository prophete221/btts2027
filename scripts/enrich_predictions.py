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
2. LECTURE DES COTES : quand les cotes réelles sont fournies, compare le favori du marché (probabilité implicite) au modèle BTTSPredict. Si l'écart est net (≥ 10 points de pourcentage) sur BTTS ou Over 2.5, signale-le comme piste de value dans ai_odds_insight. Sinon décris simplement la lecture du marché (favori, match équilibré…).
3. INCERTITUDE : signale brièvement les données manquantes importantes, sans bloquer l'analyse.
4. DÉCISION : verdict prudent, jamais de garantie. Aucune promesse de gain.

# CHAMPS DE SORTIE EXIGÉS PAR MATCH
- ai_exact_score : score le plus probable cohérent avec les xG (ex: "2-1").
- exact_score_prob : probabilité de ce score, en %, prudente.
- ai_btts_view / ai_over25_view : ta vue BTTS / Over 2.5 en % — proche des probabilités du modèle, ajustée si la forme ou les cotes le justifient clairement.
- winner : 1, N ou 2 (basé sur forme + classement + cotes). winner_prob : XX%.
- team_over15 : "Equipe: OUI/NON" (au moins 1 but de l'équipe à domicile).
- double_chance : 1X, X2 ou 12.
- main_prediction : phrase unique prudente résumant le pronostic principal.
- risk : FAIBLE / MOYEN / ÉLEVÉ.
- ai_key_fact : la statistique la plus percutante des données fournies, 15 mots max.
- ai_form_summary : 2 à 3 phrases décrivant la FORME des deux équipes (série en cours, buts marqués/encaissés, forces/faiblesses — attaque vs défense, BTTS récent). Si la forme d'une équipe est indisponible, dis-le en une demi-phrase et analyse l'autre.
- ai_absences : 1 à 2 phrases sur les DISPONIBILITÉS/ABSENTS. Aucune donnée d'effectif ne t'est fournie : écris alors exactement une phrase du type « Absents : aucune indisponibilité officielle dans nos données — compos à confirmer avant le coup d'envoi. » Tu peux ajouter une seconde phrase de contexte (rotation, enjeu, calendrier) si les données fournies la justifient. N'invente JAMAIS de nom de blessé ou de suspendu.
- ai_odds_insight : 1 à 2 phrases de lecture des cotes réelles fournies (favori du marché, cote Over 2.5, value éventuelle vs le modèle). Si aucune cote n'est fournie : « Cotes marché non disponibles — pronostic basé sur le modèle statistique seul. »
- ai_analysis : L'ANALYSE SOLIDE, 4 à 6 phrases, qui résume tout ce qui concerne les deux équipes : forme des deux camps, classement, confrontation des styles (attaque/défense), lecture du marché si cotes fournies, puis la conclusion du modèle (BTTS / Over 2.5 / tendance). Français fluide et professionnel, sans listes, sans markdown.

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
    "ai_form_summary": "2 à 3 phrases sur la forme des deux équipes",
    "ai_absences": "1 à 2 phrases honnêtes sur les disponibilités",
    "ai_odds_insight": "1 à 2 phrases sur les cotes réelles",
    "ai_analysis": "4 à 6 phrases couvrant les deux équipes, le marché et la conclusion"
  }},
  ...
]

# RÈGLES DE SORTIE
- Écris en français.
- Probabilités en pourcentage avec le signe %. Aucune précision non justifiée.
- « main_prediction » prudente, ne jamais promettre un résultat.
- N'utilise jamais « sure bet », « gain garanti » ou « 100% sûr ».
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
    shape = {"W": "V", "D": "N", "L": "D"}
    phrases = []
    if form_home.get("last5String"):
        phrases.append(
            f"{home} aborde le match avec {form_home.get('wins', 0)} victoire(s), "
            f"{form_home.get('draws', 0)} nul(s) et {form_home.get('losses', 0)} défaite(s) sur ses 5 dernières sorties "
            f"({form_home.get('goalsFor', 0)} buts marqués, {form_home.get('goalsAgainst', 0)} encaissés)."
        )
    else:
        phrases.append(f"Les données de forme récente de {home} ne sont pas disponibles.")
    if form_away.get("last5String"):
        phrases.append(
            f"{away} affiche {form_away.get('wins', 0)} victoire(s), {form_away.get('draws', 0)} nul(s) et "
            f"{form_away.get('losses', 0)} défaite(s) sur 5, pour {form_away.get('goalsFor', 0)} buts marqués "
            f"et {form_away.get('goalsAgainst', 0)} encaissés."
        )
    else:
        phrases.append(f"Les données de forme récente de {away} ne sont pas disponibles.")

    # — Classement —
    if st_home.get("rank") and st_away.get("rank"):
        phrases.append(
            f"Au classement, {home} est {st_home['rank']}e avec {st_home.get('points', '?')} points, "
            f"face à {away}, {st_away['rank']}e avec {st_away.get('points', '?')} points."
        )

    # — Cotes —
    if odds.get("home") and odds.get("away"):
        fav = home if odds["home"] < odds["away"] else away
        phrases.append(
            f"Le marché place {fav} en favori (1: {odds.get('home')}, nul: {odds.get('draw')}, 2: {odds.get('away')}"
            + (f", Over 2.5: {odds['over25']}" if odds.get("over25") else "")
            + f" — cotes {odds.get('provider', 'bookmaker')})."
        )

    # — Conclusion modèle —
    btts_pct = round(btts * 100, 1)
    over_pct = round(over * 100, 1)
    phrases.append(
        f"Le modèle Poisson BTTSPredict projette {xgh:.2f} buts attendus pour {home} et {xga:.2f} pour {away}, "
        f"soit BTTS à {btts_pct}% et Over 2.5 à {over_pct}%."
    )
    if btts >= 0.55 and over >= 0.55:
        concl = "Le scénario d'un match ouvert avec des buts des deux côtés ressort comme la tendance principale."
    elif btts >= 0.55:
        concl = "La tendance principale est un match avec des buts des deux côtés, sans garantie sur le total."
    elif over >= 0.55:
        concl = "La tendance principale est un total de buts élevé, avec une réserve sur la participation des deux équipes."
    else:
        concl = "Le modèle reste réservé : les scénarios de buts sont incertains, prudence recommandée."
    phrases.append(concl)

    analysis = " ".join(phrases)

    # — Form summary —
    form_bits = []
    if form_home.get("last5String"):
        form_bits.append(f"{home} : série {form_home['last5String']}, {form_home.get('goalsFor', 0)} buts marqués / {form_home.get('goalsAgainst', 0)} encaissés sur 5")
    if form_away.get("last5String"):
        form_bits.append(f"{away} : série {form_away['last5String']}, {form_away.get('goalsFor', 0)} buts marqués / {form_away.get('goalsAgainst', 0)} encaissés sur 5")
    form_summary = ". ".join(form_bits) + "." if form_bits else "Forme récente indisponible pour les deux équipes."

    # — Score exact le plus probable (Poisson simple) —
    def poisson_p(lam, k):
        p = 1.0
        for i in range(1, k + 1):
            p *= lam / i
        return p * pow(2.718281828459045, -lam)
    best, best_p = "1-1", 0.0
    for gh in range(0, 5):
        for ga in range(0, 5):
            p = poisson_p(xgh, gh) * poisson_p(xga, ga)
            if p > best_p:
                best_p, best = p, f"{gh}-{ga}"
    winner = "1" if xgh > xga * 1.15 else ("2" if xga > xgh * 1.15 else "N")
    wp = max(btts, over) * 100 * 0.9
    winner_prob = f"{min(72, max(34, int(wp)))}%"

    return {
        "ai_exact_score": best,
        "exact_score_prob": f"{round(best_p * 100, 1)}%",
        "ai_btts_view": f"{btts_pct}%",
        "ai_over25_view": f"{over_pct}%",
        "winner": winner,
        "ai_winner": winner,
        "ai_winner_prob": winner_prob,
        "team_over15": f"{home}: {'OUI' if xgh >= 1.0 else 'NON'}",
        "ai_team_over15": f"{home}: {'OUI' if xgh >= 1.0 else 'NON'}",
        "double_chance": "1X" if winner == "1" else ("X2" if winner == "2" else ("12" if xgh >= 1.0 or xga >= 1.0 else "X2")),
        "ai_double_chance": "1X" if winner == "1" else ("X2" if winner == "2" else ("12" if xgh >= 1.0 or xga >= 1.0 else "X2")),
        "main_prediction": concl,
        "ai_main_prediction": concl,
        "risk": "FAIBLE" if (btts >= 0.55 and over >= 0.55) else ("MOYEN" if max(btts, over) >= 0.45 else "ÉLEVÉ"),
        "ai_risk": "FAIBLE" if (btts >= 0.55 and over >= 0.55) else ("MOYEN" if max(btts, over) >= 0.45 else "ÉLEVÉ"),
        "ai_key_fact": (
            f"{home} {form_home.get('last5String')} vs {away} {form_away.get('last5String')} — BTTS {btts_pct}%, Over 2.5 {over_pct}%"
            if (form_home.get("last5String") and form_away.get("last5String"))
            else f"Modèle Poisson : BTTS {btts_pct}%, Over 2.5 {over_pct}%"
        ),
        "ai_form_summary": form_summary,
        "ai_absences": "Absents : aucune indisponibilité officielle dans nos données — compos à confirmer avant le coup d'envoi.",
        "ai_odds_insight": (
            f"Le marché ({odds.get('provider', 'bookmaker')}) cote 1: {odds.get('home')}, nul: {odds.get('draw')}, 2: {odds.get('away')}"
            + (f", Over 2.5: {odds['over25']}." if odds.get("over25") else ".")
            if odds.get("home")
            else "Cotes marché non disponibles — pronostic basé sur le modèle statistique seul."
        ),
        "ai_analysis": analysis,
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


def validate_prob(val):
    if not val:
        return False
    try:
        num = float(str(val).replace('%', ''))
        return 0 <= num <= 100 and not (val == 'nan' or val == 'inf')
    except (ValueError, TypeError):
        return False


def apply_enrichment(match: dict, item: dict) -> bool:
    """Applique les champs AI d'un item Gemini sur un match. Retourne True si appliqué."""
    idx_ok = item.get("id") is not None
    if not idx_ok:
        return False

    ai_exact_score = (item.get("ai_exact_score") or "").strip()
    exact_score_prob = (item.get("exact_score_prob") or "").strip()
    ai_btts_view = (item.get("ai_btts_view") or "").strip()
    ai_over25_view = (item.get("ai_over25_view") or "").strip()
    ai_key_fact = (item.get("ai_key_fact") or "").strip()
    ai_analysis = (item.get("ai_analysis") or "").strip()
    ai_form_summary = (item.get("ai_form_summary") or "").strip()
    ai_absences = (item.get("ai_absences") or "").strip()
    ai_odds_insight = (item.get("ai_odds_insight") or "").strip()
    winner = (item.get("winner") or "").strip()
    winner_prob = (item.get("winner_prob") or "").strip()
    team_over15 = (item.get("team_over15") or "").strip()
    double_chance = (item.get("double_chance") or "").strip()
    main_prediction = (item.get("main_prediction") or "").strip()
    risk = (item.get("risk") or "").strip()

    # Une enrichment est considérée utilisable si elle porte au moins l'analyse
    if not ai_analysis and not ai_key_fact:
        return False

    if ai_exact_score:
        match["ai_exact_score"] = ai_exact_score
    if validate_prob(exact_score_prob):
        match["exact_score_prob"] = exact_score_prob
    if validate_prob(ai_btts_view):
        match["ai_btts_view"] = ai_btts_view
        match["ai_btts_prob"] = ai_btts_view
    if validate_prob(ai_over25_view):
        match["ai_over25_view"] = ai_over25_view
        match["ai_over25_prob"] = ai_over25_view
    if ai_key_fact:
        match["ai_key_fact"] = ai_key_fact
    if ai_analysis:
        match["ai_analysis"] = ai_analysis
    if ai_form_summary:
        match["ai_form_summary"] = ai_form_summary
    if ai_absences:
        match["ai_absences"] = ai_absences
    if ai_odds_insight:
        match["ai_odds_insight"] = ai_odds_insight
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

    free_matches = data.get("free", [])
    vip_matches = data.get("vipPreview", [])

    total = len(free_matches) + len(vip_matches)
    if total == 0:
        print("[enrich] No matches to enrich — skipping")
        sys.exit(0)

    print(f"[enrich] Found {len(free_matches)} free + {len(vip_matches)} VIP = {total} matches")

    client = None
    if genai is not None:
        client = get_client()

    if client is not None:
        try:
            available = [m.name for m in client.models.list()]
            print(f"[enrich] Models available for this key: {available}")
        except Exception as e:
            print(f"[enrich] Could not list models: {e}")

        all_matches = list(free_matches) + list(vip_matches)
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
                    print(f"  [{idx+1}] ✅ {match_name}: score={match.get('ai_exact_score')} | analysis {len(match.get('ai_analysis', ''))} chars")
                    enriched_count += 1

        print(f"[enrich] Gemini enriched {enriched_count}/{len(all_matches)} matches")
    else:
        print("[enrich] No Gemini client — applying local fallback to all matches")

    # ─── FALLBACK LOCAL : garantit 100% de pronostics complets ───
    all_matches = list(free_matches) + list(vip_matches)
    fallback_count = 0
    for match in all_matches:
        if not match.get("ai_analysis") or len(match.get("ai_analysis", "").strip()) < 80:
            apply_local_fallback(match)
            fallback_count += 1

    if fallback_count:
        print(f"[enrich] 🔧 Local fallback applied to {fallback_count}/{len(all_matches)} incomplete matches")

    # Rapport final
    complete = sum(1 for m in all_matches if m.get("ai_analysis") and m.get("ai_key_fact") and m.get("ai_exact_score"))
    print(f"[enrich] Complete pronostics: {complete}/{len(all_matches)}")

    data["predictions"] = data.get("free", [])

    with open(PREDICTIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"[enrich] Saved enriched predictions to {PREDICTIONS_FILE}")
    print("[enrich] Done.")


if __name__ == "__main__":
    main()
