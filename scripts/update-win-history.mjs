// ═══════════════════════════════════════════════════════════════════════════════
// BTTSPredict — update-win-history V8.3 (déduplication + date réelle du match)
// ═══════════════════════════════════════════════════════════════════════════════
// Calcule 2 buckets :
//  - newStats     : pronos publiés depuis tracking-period.startDate (PUBLIC)
//  - legacyStats  : pronos publiés avant startDate (PRIVÉ, non affiché publiquement)
// Source unique de vérité : public/win-history.json
//
// DÉDUPLICATION (2026-10-23, V8.3 — bug « les matchs gagnés n'apparaissent pas ») :
//  Un même match publié plusieurs jours de suite (le jour J en « du jour » puis
//  J+1..J+5 en « à venir ») existe en PLUSIEURS COPIES dans les archives.
//  V8.2 comptait chaque copie : les compteurs gonflaient (pending/unverifiable)
//  et un match pouvait être à la fois WON dans une archive et PENDING à vie
//  dans une autre. V8.3 compte chaque match UNE SEULE FOIS :
//  - clé naturelle : date réelle du match | match | marché ;
//  - statut retenu : le premier statut vérifié (WON/LOST) rencontré dans les
//    archives, sinon classification pending/unverifiable du match ;
//  - date affichée dans l'historique : la VRAIE date du match (p.date),
//    plus la date du fichier d'archive.
//
// POLITIQUE PENDING (2026-10-20, V8.2) :
//  Une prédiction sans statut WON/LOST n'est « en attente » (pending) que si
//  son match est futur ou récent : grâce de exactement 48 h après le coup
//  d'envoi (fin de journée UTC + 48 h si l'heure est absente). Au-delà, sans
//  score vérifiable, elle devient « non vérifiable » (unverifiable) :
//  comptée à part, jamais présentée comme gagnée, perdue ou en attente,
//  exclue du compteur public « en attente », conservée dans les archives
//  (aucune archive source n'est supprimée, aucun score inventé).
//
// GARDE-FOU ANTI-RÉGRESSION (2026-09-28) :
//  Aucune écriture n'est possible sans passer par validateWinHistoryPayload() :
//   - scan récursif des champs interdits (roi / yield / avgOdds / profit /
//     coteProposee / coteCloture / bookmaker) — ils dépendaient de la cote
//     fictive 1.90 et ne doivent réapparaître qu'avec des cotes réelles ;
//   - validation de schéma (clés requises, cohérence total = won + lost,
//     cohérence rate, statuts WON|LOST, legacyStats.isPrivate) ;
//   - anti-downgrade : refuse d'écraser un fichier en schéma plus récent.
//  En cas d'échec : exit(1), message explicite, win-history.json INTACT.
//  Outils : --dry-run (valide sans écrire) / --validate <fichier> (vérifie un JSON).
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const DIR = './public/predictions-archive';
const OUT = './public/win-history.json';
const TRACKING_PERIOD_FILE = './public/tracking-period.json';
// (2026-09-28) Suppression de AVG_ODDS = 1.90 : cote fictive — aucun ROI/yield/profit
// ne doit être calculé tant que le site ne collecte pas de cotes réelles.

// ── Garde-fou : contrat de format ────────────────────────────────────────────
export const SCHEMA_VERSION = 4;

/** Délai de grâce : un match sans statut reste « en attente » 48 h après son coup d'envoi. */
export const PENDING_GRACE_HOURS = 48;
const GRACE_MS = PENDING_GRACE_HOURS * 60 * 60 * 1000;

/**
 * Fin de grâce d'un match sans statut, en ms epoch (ou null si aucune date exploitable).
 * - date + time (« HH:MM », fuseau de publication = Africa/Dakar = UTC+0 → lu comme UTC)
 *   → coup d'envoi + exactement 48 h ;
 * - date seule → règle documentée : fin de journée UTC (23:59:59.999) + 48 h.
 */
export function resolveGraceCutoff(p) {
  const d = p && typeof p === 'object' ? p.date : null;
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = p && typeof p.time === 'string' ? p.time.trim() : '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (m) {
    const hh = Math.min(23, Number(m[1]));
    const mm = Math.min(59, Number(m[2]));
    const kickoff = Date.parse(`${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
    if (!Number.isNaN(kickoff)) return kickoff + GRACE_MS;
  }
  const endOfDayUtc = Date.parse(`${d}T23:59:59.999Z`);
  if (!Number.isNaN(endOfDayUtc)) return endOfDayUtc + GRACE_MS;
  return null;
}

/**
 * Catégorie d'une prédiction sans statut WON/LOST :
 *  - 'pending'      → match futur ou récent (grâce de 48 h non écoulée) ;
 *  - 'unverifiable' → match passé de plus de 48 h sans score vérifiable,
 *                     ou date absente/inexploitable (impossible à vérifier).
 */
export function classifyUnverified(p, nowMs = Date.now()) {
  const cutoff = resolveGraceCutoff(p);
  if (cutoff === null) return 'unverifiable';
  return nowMs <= cutoff ? 'pending' : 'unverifiable';
}

/** Champs bannis du fichier public (issus de l'ancien calcul sur cote fictive). */
export const FORBIDDEN_KEYS = ['roi', 'yield', 'avgOdds', 'profit', 'coteProposee', 'coteCloture', 'bookmaker'];

const REQUIRED_TOP_KEYS = ['generatedAt', 'trackingPeriod', 'stats', 'history', 'legacyStats', 'pendingPolicy'];
const REQUIRED_STATS_KEYS = ['total', 'won', 'lost', 'pending', 'unverifiable', 'archivedTotal', 'rate', 'gold', 'standard', 'byType', 'trend14', 'period'];
const HISTORY_ENTRY_KEYS = ['date', 'match', 'league', 'market', 'tier', 'proba', 'status', 'finalScore', 'verifiedAt', 'source'];

export class WinHistoryValidationError extends Error {}

/**
 * Parcourt récursivement l'objet et retourne les chemins des clés interdites.
 * (Scan des CLÉS uniquement — les valeurs textuelles ne déclenchent rien.)
 */
export function findForbiddenKeys(node, prefix = '', out = []) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => findForbiddenKeys(item, `${prefix}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const p = prefix ? `${prefix}.${key}` : key;
      if (FORBIDDEN_KEYS.includes(key)) out.push(p);
      findForbiddenKeys(node[key], p, out);
    }
  }
  return out;
}

/**
 * Validation de schéma stricte AVANT écriture.
 * Lève WinHistoryValidationError avec la liste exhaustive des problèmes.
 */
export function validateWinHistoryPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WinHistoryValidationError('payload invalide : objet JSON attendu');
  }

  for (const k of REQUIRED_TOP_KEYS) {
    if (!(k in payload)) errors.push(`clé racine manquante : ${k}`);
  }
  if ('schemaVersion' in payload && payload.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion inattendue : ${payload.schemaVersion} (attendu ${SCHEMA_VERSION})`);
  }

  const stats = payload.stats;
  if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
    for (const k of REQUIRED_STATS_KEYS) {
      if (!(k in stats)) errors.push(`stats.${k} manquant`);
    }
    if (typeof stats.total === 'number' && typeof stats.won === 'number' && typeof stats.lost === 'number') {
      if (stats.total !== stats.won + stats.lost) {
        errors.push(`incohérence stats.total : ${stats.total} ≠ won + lost (${stats.won} + ${stats.lost})`);
      }
    }
    if ('unverifiable' in stats && (typeof stats.unverifiable !== 'number' || stats.unverifiable < 0 || !Number.isInteger(stats.unverifiable))) {
      errors.push(`stats.unverifiable invalide : ${JSON.stringify(stats.unverifiable)} (entier ≥ 0 attendu)`);
    }
    const counterKeys = ['total', 'pending', 'unverifiable', 'archivedTotal'];
    if (counterKeys.every(k => typeof stats[k] === 'number')) {
      const accounted = stats.total + stats.pending + stats.unverifiable;
      if (accounted !== stats.archivedTotal) {
        errors.push(`incohérence compteurs : total + pending + unverifiable (${accounted}) ≠ archivedTotal (${stats.archivedTotal})`);
      }
    }
    if (typeof stats.total === 'number' && typeof stats.won === 'number' && typeof stats.rate === 'number') {
      // total is the verified denominator: W + L. Pending/unverifiable never
      // enter the success rate, while losses remain in its denominator.
      const expected = stats.total > 0 ? +(stats.won / stats.total * 100).toFixed(1) : 0;
      if (stats.rate !== expected) {
        errors.push(`incohérence stats.rate : ${stats.rate} ≠ won/total recalculé = ${expected}`);
      }
    }
  } else if (stats !== undefined) {
    errors.push('stats doit être un objet');
  }

  const hist = payload.history;
  if (Array.isArray(hist)) {
    hist.forEach((e, i) => {
      if (!e || typeof e !== 'object' || Array.isArray(e)) {
        errors.push(`history[${i}] invalide : objet attendu`);
        return;
      }
      for (const k of HISTORY_ENTRY_KEYS) {
        if (!(k in e)) errors.push(`history[${i}].${k} manquant`);
      }
      if ('status' in e && !['WON', 'LOST'].includes(e.status)) {
        errors.push(`history[${i}].status invalide : "${e.status}" (WON|LOST attendus — PENDING ne doit jamais être dans history)`);
      }
    });
  } else if (hist !== undefined) {
    errors.push('history doit être un tableau');
  }

  const policy = payload.pendingPolicy;
  if (policy && typeof policy === 'object' && !Array.isArray(policy)) {
    if (policy.graceHours !== PENDING_GRACE_HOURS) {
      errors.push(`pendingPolicy.graceHours invalide : ${JSON.stringify(policy.graceHours)} (${PENDING_GRACE_HOURS} attendu)`);
    }
  } else if (policy !== undefined) {
    errors.push('pendingPolicy doit être un objet');
  }

  const legacy = payload.legacyStats;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy) && legacy.isPrivate !== true) {
    errors.push('legacyStats.isPrivate doit être true');
  }

  const forbidden = findForbiddenKeys(payload);
  if (forbidden.length) {
    errors.unshift(...forbidden.map(p => `champ interdit détecté : ${p}`));
  }

  if (errors.length) {
    throw new WinHistoryValidationError(
      `format refusé — ${errors.length} problème(s) détecté(s) :\n  - ` + errors.join('\n  - ')
    );
  }
}
// ── Fin garde-fou ────────────────────────────────────────────────────────────

let TRACKING_START = '2026-08-08';
try {
  const tp = JSON.parse(fs.readFileSync(TRACKING_PERIOD_FILE, 'utf8'));
  TRACKING_START = tp.startDate || TRACKING_START;
} catch (e) {
  console.warn(`[update-win-history] tracking-period.json non trouvé, fallback ${TRACKING_START}`);
}

const TRACKING_START_TS = new Date(TRACKING_START + 'T00:00:00Z').getTime();
console.log(`[update-win-history] Nouveau suivi depuis ${TRACKING_START}`);

const HIGH_BTTS_KEYWORDS = [
  'bundesliga','eredivisie','jupiler','swiss','mls','championship',
  'premier league','liga portugal','austrian','scottish',
];

function getTier(p) {
  if (p.tier && p.tier.toUpperCase() === 'GOLD') return 'GOLD';
  let proba = p.proba || p.probability || 0;
  if (!proba && p.analysis) proba = p.analysis.bttsProb || p.analysis.over25Prob || 0;
  if (!proba && p.confidence) proba = p.confidence / 100;
  if (!proba) proba = 0.62;
  const lg = (p.league || '').toLowerCase();
  const isHigh = HIGH_BTTS_KEYWORDS.some(h => lg.includes(h));
  const market = (p.type || p.market || '').toLowerCase();
  const isBttsYes = market.includes('btts') && (p.prediction || '').toLowerCase() !== 'non';
  if (proba >= 0.75) return 'GOLD';
  if (proba >= 0.70 && isHigh && isBttsYes) return 'GOLD';
  return 'STANDARD';
}

function getType(p) {
  const t = (p.type || p.market || '').toUpperCase();
  if (t.includes('BTTS')) return 'btts';
  return 'over25';
}

// ── Déduplication V8.3 ───────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Vraie date de match d'un prono (p.date valide) sinon la date du fichier d'archive. */
function realMatchDate(p, fileDate) {
  return typeof p?.date === 'string' && ISO_DATE_RE.test(p.date.trim()) ? p.date.trim() : fileDate;
}

/** Clé de déduplication : date réelle du match | match | marché. */
function dedupeKey(p, fileDate) {
  const date = realMatchDate(p, fileDate);
  const match = String(p?.match || `${p?.home || ''} vs ${p?.away || ''}`).trim();
  const market = getType(p);
  return `${date}|${match}|${market}`;
}

/**
 * Fusionne, dans l'enregistrement représentatif (première publication),
 * le statut vérifié d'une copie ultérieure du même match.
 * Le premier statut vérifié rencontré (archives en ordre chronologique) gagne.
 */
function mergeVerifiedCopy(rec, copy) {
  const st = String(copy?.status || '').trim().toUpperCase();
  if (st !== 'WON' && st !== 'LOST') return;
  const cur = String(rec.p.status || '').trim().toUpperCase();
  if (cur === 'WON' || cur === 'LOST') {
    if (cur !== st) {
      console.warn(`[update-win-history] ⚠ statuts conflictuels entre copies pour "${rec.p.match}" (${cur} vs ${st}) — premier statut conservé (${cur})`);
    }
    return;
  }
  rec.p = { ...rec.p, status: st, finalScore: copy.finalScore ?? rec.p.finalScore, verifiedAt: copy.verifiedAt ?? rec.p.verifiedAt };
}

function emptyBucket() {
  return {
    won: 0, lost: 0, pending: 0, unverifiable: 0,
    gold: { won: 0, lost: 0 },
    std: { won: 0, lost: 0 },
    btts: { won: 0, lost: 0 },
    over25: { won: 0, lost: 0 },
    daily: {},
    all: [],
    archivedTotal: 0,
  };
}

/**
 * Compte un match DÉDUPLIQUÉ dans son bucket.
 * Un match = une entrée, quel que soit le nombre de copies archivées.
 */
function countRecord(bucket, rec, nowMs) {
  const p = rec.p;
  const tier = getTier(p);
  const type = getType(p);

  bucket.archivedTotal++;

  const status = typeof p.status === 'string' ? p.status.trim().toUpperCase() : '';
  const isWon = status === 'WON' || (!status && p.isWon === true);
  const isLost = status === 'LOST' || (!status && p.isWon === false);
  const isVerified = isWon || isLost;

  const matchDate = realMatchDate(p, rec.fileDate);

  if (isWon || isLost) {
    if (isWon) bucket.won++;
    else bucket.lost++;
    if (tier === 'GOLD') { if (isWon) bucket.gold.won++; else bucket.gold.lost++; }
    else { if (isWon) bucket.std.won++; else bucket.std.lost++; }
    if (type === 'btts') { if (isWon) bucket.btts.won++; else bucket.btts.lost++; }
    else { if (isWon) bucket.over25.won++; else bucket.over25.lost++; }

    bucket.all.push({
      date: matchDate, match: p.match || '', league: p.league || '',
      market: type, tier,
      proba: p.proba || (p.confidence ? p.confidence / 100 : 0.62),
      status: isWon ? 'WON' : 'LOST',
      finalScore: p.finalScore || p.score || '-',
      verifiedAt: p.verifiedAt || '',
      source: 'ESPN public',
      // Côté prédit (« Oui »/« Non ») : rend le verdict lisible
      // (ex. « BTTS Oui → 3-0 → LOST » signifie que le match a été 3-0
      // sans but des deux côtés — le prono était perdu, pas le match).
      ...(p.prediction ? { prediction: String(p.prediction) } : {}),
    });

    const day = bucket.daily[matchDate] || { total: 0, won: 0, lost: 0 };
    day.total += 1;
    if (isWon) day.won += 1; else day.lost += 1;
    day.rate = +((day.won / day.total) * 100).toFixed(1);
    bucket.daily[matchDate] = day;
  } else {
    // V8.2 : sans statut, le match reste « en attente » pendant sa grâce de 48 h
    // (futur ou récent) ; au-delà, sans score vérifiable, il devient « non
    // vérifiable » — compté à part, jamais gagné/perdu/en attente.
    if (classifyUnverified(p, nowMs) === 'pending') bucket.pending++;
    else bucket.unverifiable++;
  }
}

function buildStats(bucket, periodFrom, periodTo, daysCount) {
  const total = bucket.won + bucket.lost;
  const rate = total > 0 ? +(bucket.won / total * 100).toFixed(1) : 0;

  const goldTotal = bucket.gold.won + bucket.gold.lost;
  const goldRate = goldTotal > 0 ? +(bucket.gold.won / goldTotal * 100).toFixed(1) : 0;

  const stdTotal = bucket.std.won + bucket.std.lost;
  const stdRate = stdTotal > 0 ? +(bucket.std.won / stdTotal * 100).toFixed(1) : 0;

  const bttsTotal = bucket.btts.won + bucket.btts.lost;
  const bttsRate = bttsTotal > 0 ? +(bucket.btts.won / bttsTotal * 100).toFixed(1) : 0;
  const overTotal = bucket.over25.won + bucket.over25.lost;
  const overRate = overTotal > 0 ? +(bucket.over25.won / overTotal * 100).toFixed(1) : 0;

  const trend = Object.entries(bucket.daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([d, v]) => ({ date: d, ...v }));

  return {
    total, won: bucket.won, lost: bucket.lost, pending: bucket.pending,
    unverifiable: bucket.unverifiable,
    archivedTotal: bucket.archivedTotal,
    rate,
    // (2026-09-28) avgOdds / profit / roi / yield / maxDrawdown supprimés :
    // ils dépendaient de la cote fictive 1.90. Ils reviendront uniquement
    // si des cotes réelles sont collectées (ex. via Odds-API, cf. vip-combos).
    gold: {
      total: goldTotal, won: bucket.gold.won, lost: bucket.gold.lost, rate: goldRate,
    },
    standard: { total: stdTotal, won: bucket.std.won, lost: bucket.std.lost, rate: stdRate },
    byType: {
      btts: { total: bttsTotal, won: bucket.btts.won, lost: bucket.btts.lost, rate: bttsRate },
      over25: { total: overTotal, won: bucket.over25.won, lost: bucket.over25.lost, rate: overRate },
    },
    trend14: trend,
    period: { from: periodFrom, to: periodTo, days: daysCount },
  };
}

function resolveOutPath() {
  // WIN_HISTORY_OUT : surcharge pour tests/diagnostics uniquement.
  // Le chemin de production reste public/win-history.json.
  return process.env.WIN_HISTORY_OUT || OUT;
}

function run({ write, dir = DIR, now = Date.now() }) {
  if (!fs.existsSync(dir)) {
    console.warn(`[update-win-history] ${dir} introuvable`);
    return;
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const allFiles = files.slice(-90);

  // ── Collecte dédupliquée : un enregistrement par match unique ──────────────
  const seen = new Map();  // clé → enregistrement (toutes fenêtres confondues)

  let newPeriodFrom = null, newPeriodTo = null, newDaysCount = 0;
  let legacyPeriodFrom = null, legacyPeriodTo = null, legacyDaysCount = 0;

  for (const file of allFiles) {
    const fileDate = file.replace('.json', '');
    const dateTs = new Date(fileDate + 'T00:00:00Z').getTime();
    const isNew = dateTs >= TRACKING_START_TS;

    if (isNew) {
      if (!newPeriodFrom) newPeriodFrom = fileDate;
      newPeriodTo = fileDate;
      newDaysCount++;
    } else {
      if (!legacyPeriodFrom) legacyPeriodFrom = fileDate;
      legacyPeriodTo = fileDate;
      legacyDaysCount++;
    }

    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { continue; }
    let preds = data.predictions || data;
    if (!Array.isArray(preds)) continue;

    for (const p of preds) {
      const key = dedupeKey(p, fileDate);
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { fileDate, isNew, p: { ...p } });
      } else {
        // Un match publié à cheval sur la bascule de suivi (ex. publié en
        // « à venir » avant startDate puis vérifié après) reste PUBLIC :
        // l'ancien comptage par copie plaçait sa copie vérifiée dans le
        // bucket public — on conserve ce rattachement.
        if (isNew) existing.isNew = true;
        mergeVerifiedCopy(existing, p);
      }
    }
  }

  // ── Répartition par bucket (après fusion) ──────────────────────────────────
  const newRecords = [];   // au moins une copie publiée depuis TRACKING_START (public)
  const legacyRecords = []; // toutes les copies publiées avant TRACKING_START (privé)
  for (const rec of seen.values()) {
    (rec.isNew ? newRecords : legacyRecords).push(rec);
  }

  // ── Comptage (un match = une entrée) ────────────────────────────────────────
  const newBucket = emptyBucket();
  const legacyBucket = emptyBucket();
  for (const rec of newRecords) countRecord(newBucket, rec, now);
  for (const rec of legacyRecords) countRecord(legacyBucket, rec, now);

  const newStats = buildStats(newBucket, newPeriodFrom, newPeriodTo, newDaysCount);
  const legacyStats = buildStats(legacyBucket, legacyPeriodFrom, legacyPeriodTo, legacyDaysCount);

  // Historique trié par VRAIE date de match (desc), puis vérification récente
  // d'abord — « les derniers résultats » = les derniers matchs joués.
  const sortHistory = (arr) => arr.sort((a, b) =>
    String(b.date).localeCompare(String(a.date)) ||
    String(b.verifiedAt || '').localeCompare(String(a.verifiedAt || '')) ||
    String(a.match).localeCompare(String(b.match)));

  const out = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date(now).toISOString(),
    pendingPolicy: {
      graceHours: PENDING_GRACE_HOURS,
      rule: "Sans statut vérifié, un match futur ou récent reste « en attente » pendant exactement 48 h après son coup d'envoi.",
      dateOnlyRule: "Si l'heure de coup d'envoi est absente, la grâce court depuis la fin de la journée UTC du match.",
      unverifiableRule: "Au-delà de la grâce, sans score vérifiable, le match devient « non vérifiable » : il n'est ni gagné, ni perdu, ni en attente, il est exclu du compteur public « en attente » et reste conservé dans les archives pour audit.",
      dedupRule: "Chaque match n'est compté qu'une seule fois, quelle que soit la nombre de journées de publication où il est archivé.",
    },
    trackingPeriod: {
      startDate: TRACKING_START,
      isPublicPeriod: true,
      disclaimer: "Nouvelle période de suivi lancée le " + TRACKING_START + ". Les résultats sont publiés et vérifiés progressivement. Le volume actuel est encore insuffisant pour évaluer statistiquement la performance du modèle. Aucun résultat futur n'est garanti.",
      insufficientVolume: newStats.total < 30,
    },
    stats: newStats,
    history: sortHistory(newBucket.all).slice(0, 500),
    legacyStats: {
      ...legacyStats,
      history: sortHistory(legacyBucket.all).slice(0, 200),
      isPrivate: true,
      note: "Archives antérieures au nouveau suivi (avant " + TRACKING_START + "). Non affiché publiquement. Conservé pour audit technique et conformité.",
    },
  };

  // GARDE-FOU — validation stricte AVANT toute écriture.
  try {
    validateWinHistoryPayload(out);
  } catch (err) {
    console.error(`[update-win-history] ✕ ÉCRITURE REFUSÉE — ${err.message}`);
    console.error(`[update-win-history] ✕ ${resolveOutPath()} n'a PAS été modifié.`);
    process.exit(1);
  }

  // Anti-downgrade : ne jamais écraser un fichier en schéma plus récent.
  const outPath = resolveOutPath();
  if (fs.existsSync(outPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      if (existing && typeof existing === 'object' && typeof existing.schemaVersion === 'number' && existing.schemaVersion > SCHEMA_VERSION) {
        console.error(`[update-win-history] ✕ ÉCRITURE REFUSÉE — fichier existant en schéma v${existing.schemaVersion} > script v${SCHEMA_VERSION} (downgrade interdit).`);
        console.error(`[update-win-history] ✕ ${outPath} n'a PAS été modifié.`);
        process.exit(1);
      }
    } catch (e) {
      // fichier existant illisible : la validation du nouveau payload ci-dessus suffit
    }
  }

  if (!write) {
    console.log(`[update-win-history] --dry-run : schéma v${SCHEMA_VERSION} valide, AUCUNE écriture effectuée (${outPath})`);
    return out;
  }

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`[update-win-history] ─────────────────────────────────────────`);
  console.log(`[update-win-history] NEW (public) ${newStats.total} vérifiés | ${newStats.rate}% | ${newStats.archivedTotal} matchs archivés (dédupliqués) | ${newStats.pending} en attente | ${newStats.unverifiable} non vérifiables`);
  console.log(`[update-win-history]   GOLD ${newStats.gold.total} ${newStats.gold.rate}%`);
  console.log(`[update-win-history]   Period ${newPeriodFrom || '—'} → ${newPeriodTo || '—'} (${newDaysCount}j)`);
  console.log(`[update-win-history] LEGACY (privé) ${legacyStats.total} vérifiés | ${legacyStats.rate}%`);
  console.log(`[update-win-history]   Period ${legacyPeriodFrom || '—'} → ${legacyPeriodTo || '—'} (${legacyDaysCount}j)`);
  console.log(`[update-win-history] ─────────────────────────────────────────`);
  if (newStats.total < 30) {
    console.log(`[update-win-history] ⚠ Volume nouveau suivi insuffisant (${newStats.total}/30). Affichage public restreint.`);
  }
  return out;
}

// Exports pour les tests vitest (le binaire CLI reste inchangé).
export { run as runWinHistory, DIR as ARCHIVE_DIR, OUT as WIN_HISTORY_OUT };

function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--validate') {
    const file = args[1];
    if (!file) {
      console.error('usage: node scripts/update-win-history.mjs --validate <fichier.json>');
      process.exit(2);
    }
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      validateWinHistoryPayload(payload);
      console.log(`[update-win-history] ✓ ${file} : schéma v${SCHEMA_VERSION} valide, aucun champ interdit.`);
    } catch (err) {
      console.error(`[update-win-history] ✕ VALIDATION REFUSÉE — ${err.message}`);
      process.exit(1);
    }
    return;
  }

  if (args[0] === '--dry-run') {
    run({ write: false });
    return;
  }

  if (args[0] === '--help' || args[0] === '-h') {
    console.log('usage: node scripts/update-win-history.mjs [--dry-run | --validate <fichier.json>]');
    return;
  }

  run({ write: true });
}

// Exécuté en direct uniquement (le bot GitHub) ; l'import en tant que module
// (tests vitest) n'exécute rien.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) main();
