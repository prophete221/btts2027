#!/usr/bin/env python3
"""
BTTSPredict — Analyse AI des pronostics (stats → Gemini → décision)
===================================================================

Remplace l'ancien rôle « texte cosmétique autour du Poisson ».

Flux :
  1. Lit public/predictions.json (stats empiriques déjà collectées par
     quick-update-predictions.mjs : forme, taux BTTS/Over, buts moyens, cotes).
  2. Envoie à Gemini UNIQUEMENT ces données (pas de λ Poisson).
  3. Gemini choisit marché (BTTS / OVER_25 / BOTH / ABSTAIN), sens Oui/Non,
     proba bornée, et rédige l'analyse.
  4. Le code applique garde-fous (échantillon, bornes proba, abstention).

Variable : GEMINI_API_KEY
Sans clé : fallback local basé sur les taux empiriques déjà présents.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

MODELS_TO_TRY = [
    "gemini-flash-lite-latest",
    "gemini-2.5-flash-lite",
    "gemini-flash-latest",
    "gemini-2.5-flash",
]
PREDICTIONS_FILE = Path(__file__).parent.parent / "public" / "predictions.json"
MAX_RETRIES = 2
RETRY_DELAY = 5
RATE_LIMIT_WAIT = 20
CHUNK_SIZE = 3  # plus petit = JSON plus fiable
MAX_OUTPUT_TOKENS = 8192
ENRICH_TIME_BUDGET_S = 420
PROBA_MIN = 0.48
PROBA_MAX = 0.78
MIN_SAMPLE = 4

try:
    from google import genai
except ImportError:
    print("[analyze] google-genai not installed — local fallback only")
    genai = None


def get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or genai is None:
        print("[analyze] GEMINI_API_KEY missing or SDK absent — local fallback only")
        return None
    return genai.Client(api_key=api_key)


def fmt_form(form):
    if not form:
        return None
    return {
        "last5": form.get("last5String"),
        "record": f"{form.get('wins', 0)}W-{form.get('draws', 0)}D-{form.get('losses', 0)}L",
        "goals_for": form.get("goalsFor"),
        "goals_against": form.get("goalsAgainst"),
        "btts_rate": form.get("bttsRate"),
        "over25_rate": form.get("over25Rate"),
    }


def build_match_payload(m: dict, idx: int) -> dict:
    """Paquet stats strict — aucune proba Poisson."""
    form_home = fmt_form(m.get("formHome") or (m.get("analysis") or {}).get("homeForm"))
    form_away = fmt_form(m.get("formAway") or (m.get("analysis") or {}).get("awayForm"))
    odds = m.get("odds") or {}
    return {
        "id": idx,
        "match": m.get("match") or f"{m.get('home')} vs {m.get('away')}",
        "league": m.get("league"),
        "date": m.get("date"),
        "home": m.get("home"),
        "away": m.get("away"),
        "sample_home": m.get("matchCountHome") or m.get("sampleHome"),
        "sample_away": m.get("matchCountAway") or m.get("sampleAway"),
        "data_quality": m.get("dataQuality"),
        "form_home": form_home,
        "form_away": form_away,
        "goals_avg_home": m.get("xgHome") or m.get("homeLambda"),
        "goals_avg_away": m.get("xgAway") or m.get("awayLambda"),
        "empirical_btts": m.get("bttsProb"),
        "empirical_over25": m.get("over25Prob"),
        "formBTTS": m.get("formBTTS"),
        "standings_home": m.get("standingsHome"),
        "standings_away": m.get("standingsAway"),
        "odds": {
            "provider": odds.get("provider"),
            "home": odds.get("home"),
            "draw": odds.get("draw"),
            "away": odds.get("away"),
            "over25": odds.get("over25"),
        }
        if odds
        else None,
    }


def build_batch_prompt(matches: list, id_offset: int = 0) -> str:
    payload = [build_match_payload(m, id_offset + i) for i, m in enumerate(matches)]
    return f"""Tu es analyste football pour BTTSPredict.
Tu reçois UNIQUEMENT des statistiques observées (forme, taux BTTS/Over empiriques, buts moyens, cotes éventuelles).
Il n'y a PAS de modèle Poisson. Tu dois analyser ces stats et produire un pronostic honnête.

# MATCHS
{json.dumps(payload, ensure_ascii=False, indent=2)}

# TÂCHE
Pour chaque match, choisis :
- market: "BTTS" | "OVER_25" | "BOTH" | "ABSTAIN"
- selection: "Yes" | "No" | null (null si ABSTAIN)
- probability: nombre entre {PROBA_MIN} et {PROBA_MAX} (estimation calibrée, pas 90%+)
- confidence: "low" | "medium" | "high"
- primary_reasons: 2 à 4 raisons appuyées UNIQUEMENT sur les stats fournies
- risks: 1 à 2 risques
- key_fact: fait clé ≤ 20 mots tiré des données
- analysis_fr: 3 à 5 phrases pro en français
- analysis_en: traduction anglaise fidèle
- form_summary_fr / form_summary_en: forme des deux équipes

# RÈGLES STRICTES
1. N'invente AUCUNE stat, blessure, composition, H2H ou source absente du JSON.
2. Si sample_home ou sample_away < {MIN_SAMPLE}, ou data_quality LOW avec signaux contradictoires → ABSTAIN.
3. Si les taux empiriques BTTS et Over sont tous deux < 0.45 sans autre signal fort → ABSTAIN.
4. Préfère ABSTAIN plutôt qu'un Oui faible.
5. Si BOTH: selection s'applique au marché le plus solide; indique le principal dans primary_reasons[0].
6. probability doit être cohérente avec les taux empiriques (±0.15 max d'écart sauf justification dans reasons).
7. Réponds UNIQUEMENT un tableau JSON valide.

# FORMAT
[
  {{
    "id": 0,
    "market": "BTTS",
    "selection": "Yes",
    "probability": 0.62,
    "confidence": "medium",
    "primary_reasons": ["...", "..."],
    "risks": ["..."],
    "key_fact": "...",
    "analysis_fr": "...",
    "analysis_en": "...",
    "form_summary_fr": "...",
    "form_summary_en": "..."
  }}
]
"""


def clamp_proba(p) -> float | None:
    try:
        v = float(p)
    except (TypeError, ValueError):
        return None
    if v < 0.40 or v > 0.90:
        return None
    return max(PROBA_MIN, min(PROBA_MAX, round(v, 4)))


def selection_to_fr(sel) -> str | None:
    if sel is None:
        return None
    s = str(sel).strip().lower()
    if s in ("yes", "oui", "true", "1"):
        return "Oui"
    if s in ("no", "non", "false", "0"):
        return "Non"
    return None


def sample_ok(m: dict) -> bool:
    sh = m.get("matchCountHome") or 0
    sa = m.get("matchCountAway") or 0
    try:
        sh, sa = int(sh), int(sa)
    except (TypeError, ValueError):
        return True  # si absent, on laisse Gemini / empirique
    if sh == 0 and sa == 0:
        return True
    return sh >= MIN_SAMPLE and sa >= MIN_SAMPLE


def apply_analysis(match: dict, item: dict) -> bool:
    """Applique décision AI + textes, avec garde-fous."""
    if item.get("id") is None:
        return False

    market = str(item.get("market") or "ABSTAIN").upper().replace("OVER25", "OVER_25")
    selection = selection_to_fr(item.get("selection"))
    proba = clamp_proba(item.get("probability"))
    confidence = str(item.get("confidence") or "medium").lower()
    if confidence not in ("low", "medium", "high"):
        confidence = "medium"

    # Textes
    for src, dst in (
        ("key_fact", "ai_key_fact"),
        ("analysis_fr", "ai_analysis"),
        ("analysis_en", "ai_analysis_en"),
        ("form_summary_fr", "ai_form_summary"),
        ("form_summary_en", "ai_form_summary_en"),
    ):
        val = item.get(src)
        if isinstance(val, str) and val.strip():
            match[dst] = val.strip()
    if item.get("key_fact") and not match.get("ai_key_fact_en"):
        # optional en key fact
        pass
    if isinstance(item.get("analysis_en"), str):
        match["ai_analysis_en"] = item["analysis_en"].strip()

    reasons = item.get("primary_reasons") if isinstance(item.get("primary_reasons"), list) else []
    risks = item.get("risks") if isinstance(item.get("risks"), list) else []
    match["ai_reasons"] = [str(r) for r in reasons[:4] if r]
    match["ai_risks"] = [str(r) for r in risks[:3] if r]
    match["ai_confidence"] = confidence
    match["modelEngine"] = "gemini-stats-v1"

    if market == "ABSTAIN" or not sample_ok(match) or proba is None or selection is None:
        match["ai_abstain"] = True
        match["ai_market"] = "ABSTAIN"
        # conserve empirique déjà présent pour affichage soft, sans forcer un Oui marketing
        return bool(match.get("ai_analysis") or match.get("ai_key_fact"))

    match["ai_abstain"] = False
    match["ai_market"] = market

    conf_pct = int(round(proba * 100))

    def upsert_pred(typ: str, sel: str, p: float):
        preds = match.get("predictions")
        if not isinstance(preds, list):
            preds = []
            match["predictions"] = preds
        row = next((x for x in preds if str(x.get("type", "")).upper().startswith(typ[:4])), None)
        payload = {
            "type": "BTTS" if typ == "BTTS" else "Over 2.5",
            "prediction": sel,
            "confidence": conf_pct,
            "proba": p,
        }
        if typ == "BTTS":
            payload["bttsProb"] = p
        else:
            payload["over25Prob"] = p
        if row:
            row.update(payload)
        else:
            preds.append(payload)

    if market in ("BTTS", "BOTH"):
        upsert_pred("BTTS", selection, proba)
        match["bttsProb"] = proba
        if market == "BTTS" or not match.get("type"):
            match["type"] = "BTTS"
            match["prediction"] = selection
            match["proba"] = proba
            match["confidence"] = conf_pct

    if market in ("OVER_25", "BOTH"):
        # Pour BOTH on peut garder selection sur les deux ; sinon Oui/Non Over dédié
        over_sel = selection
        over_p = proba
        if market == "BOTH" and match.get("over25Prob"):
            # léger ancrage empirique over si fourni par empirique initial
            try:
                emp = float(match.get("over25Prob"))
                over_p = clamp_proba((proba + emp) / 2) or proba
            except (TypeError, ValueError):
                pass
        upsert_pred("OVER", over_sel, over_p)
        match["over25Prob"] = over_p
        if market == "OVER_25":
            match["type"] = "Over 2.5"
            match["prediction"] = over_sel
            match["proba"] = over_p
            match["confidence"] = int(round(over_p * 100))

    match["ai_source"] = "gemini-stats-v1"
    return True


def local_decision(m: dict) -> dict:
    """Fallback sans API : décision à partir des taux empiriques uniquement."""
    btts = float(m.get("bttsProb") or 0)
    over = float(m.get("over25Prob") or 0)
    home = m.get("home") or "?"
    away = m.get("away") or "?"

    if not sample_ok(m) or max(btts, over) < 0.45:
        market, sel, proba, conf = "ABSTAIN", None, None, "low"
    elif over >= btts and over >= 0.52:
        market, sel, proba, conf = "OVER_25", "Yes" if over >= 0.5 else "No", min(PROBA_MAX, max(PROBA_MIN, over)), "medium"
    elif btts >= 0.52:
        market, sel, proba, conf = "BTTS", "Yes" if btts >= 0.5 else "No", min(PROBA_MAX, max(PROBA_MIN, btts)), "medium"
    else:
        market, sel, proba, conf = "ABSTAIN", None, None, "low"

    analysis = (
        f"Analyse basée sur les taux empiriques de forme récente uniquement (sans modèle Poisson). "
        f"BTTS empirique {(btts*100):.1f}%, Over 2.5 empirique {(over*100):.1f}% pour {home} vs {away}. "
        f"Décision : {market}."
    )
    analysis_en = (
        f"Analysis based on recent empirical form rates only (no Poisson model). "
        f"Empirical BTTS {(btts*100):.1f}%, Over 2.5 {(over*100):.1f}% for {home} vs {away}. "
        f"Decision: {market}."
    )
    return {
        "id": 0,
        "market": market,
        "selection": sel,
        "probability": proba,
        "confidence": conf,
        "primary_reasons": [
            f"Empirical BTTS rate ~{(btts*100):.0f}%",
            f"Empirical Over 2.5 rate ~{(over*100):.0f}%",
        ],
        "risks": ["Sample limited to recent matches; form can shift quickly."],
        "key_fact": f"Form signals BTTS {(btts*100):.0f}% / Over {(over*100):.0f}%",
        "analysis_fr": analysis,
        "analysis_en": analysis_en,
        "form_summary_fr": analysis[:180],
        "form_summary_en": analysis_en[:180],
    }


def apply_local_fallback(match: dict) -> None:
    item = local_decision(match)
    apply_analysis(match, item)
    match["ai_source"] = "local-empirical-v1"


def _call_gemini_chunk(client, matches: list, id_offset: int) -> list:
    prompt = build_batch_prompt(matches, id_offset=id_offset)
    if client is None:
        return []

    for model_name in MODELS_TO_TRY:
        print(f"[analyze] model={model_name} chunk {id_offset+1}-{id_offset+len(matches)}")
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json",
                        "temperature": 0.25,
                        "max_output_tokens": MAX_OUTPUT_TOKENS,
                    },
                )
                result = json.loads(response.text or "")
                if isinstance(result, list) and result:
                    print(f"[analyze] ✅ {len(result)} decisions from {model_name}")
                    return result
            except json.JSONDecodeError as e:
                print(f"[analyze] JSON error attempt {attempt+1}: {e}")
            except Exception as e:
                err = str(e)
                print(f"[analyze] error attempt {attempt+1}: {err[:200]}")
                if "429" in err or "RESOURCE_EXHAUSTED" in err:
                    time.sleep(RATE_LIMIT_WAIT)
                    continue
            time.sleep(RETRY_DELAY)
    return []


def call_gemini_batch(client, matches: list) -> list:
    started = time.time()
    out = []
    for i in range(0, len(matches), CHUNK_SIZE):
        if time.time() - started > ENRICH_TIME_BUDGET_S:
            print("[analyze] time budget reached — remaining matches use local fallback")
            break
        chunk = matches[i : i + CHUNK_SIZE]
        part = _call_gemini_chunk(client, chunk, id_offset=i)
        # normalize ids to absolute index
        for item in part:
            try:
                local_id = int(item.get("id", 0))
            except (TypeError, ValueError):
                local_id = 0
            # accept either chunk-local or absolute
            if local_id < len(chunk):
                item["id"] = i + local_id
            out.append(item)
        time.sleep(1.2)
    return out


def main():
    print("[analyze] BTTSPredict Gemini stats analysis v1 (no Poisson)")

    if not PREDICTIONS_FILE.exists():
        print(f"[analyze] {PREDICTIONS_FILE} not found — skip")
        sys.exit(0)

    with open(PREDICTIONS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    free_matches = data.get("free") or data.get("predictions") or []
    if not isinstance(free_matches, list) or not free_matches:
        print("[analyze] no matches")
        return

    client = get_client()
    if client is not None:
        enrichments = call_gemini_batch(client, free_matches)
        applied = 0
        for item in enrichments:
            try:
                idx = int(item.get("id"))
            except (TypeError, ValueError):
                continue
            if 0 <= idx < len(free_matches):
                if apply_analysis(free_matches[idx], item):
                    applied += 1
                    print(f"  [{idx+1}] {free_matches[idx].get('match')} → {item.get('market')} {item.get('selection')} {item.get('probability')}")
        print(f"[analyze] Gemini applied {applied}/{len(free_matches)}")
    else:
        print("[analyze] no client — full local empirical fallback")

    fb = 0
    for match in free_matches:
        if not match.get("ai_analysis") or match.get("ai_source") is None:
            apply_local_fallback(match)
            fb += 1
        # absences / odds templates légers
        if not match.get("ai_absences"):
            match["ai_absences"] = "Aucune donnée d'effectif fournie — absences non évaluées."
            match["ai_absences_en"] = "No squad data provided — absences not assessed."
        if not match.get("ai_odds_insight"):
            odds = match.get("odds") or {}
            if odds.get("home"):
                match["ai_odds_insight"] = (
                    f"Cotes marché ({odds.get('provider') or 'book'}): "
                    f"1 {odds.get('home')} · N {odds.get('draw')} · 2 {odds.get('away')}"
                    + (f" · O2.5 {odds.get('over25')}" if odds.get("over25") else "")
                )
            else:
                match["ai_odds_insight"] = "Cotes marché indisponibles — jugement sur stats de forme uniquement."
    if fb:
        print(f"[analyze] local fallback on {fb} matches")

    data["free"] = free_matches
    data["predictions"] = free_matches
    data["analysisEngine"] = "gemini-stats-v1"
    tmp = PREDICTIONS_FILE.with_suffix(PREDICTIONS_FILE.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, PREDICTIONS_FILE)
    print(f"[analyze] saved {PREDICTIONS_FILE}")
    print("[analyze] done.")


if __name__ == "__main__":
    main()
