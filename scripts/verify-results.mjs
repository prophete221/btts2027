// ═══════════════════════════════════════════════════════════════════════════════
// BTTSPredict — verify-results.mjs (V6 — date réelle du match + propagation)
// ═══════════════════════════════════════════════════════════════════════════════
//
// CORRECTION MAJEURE (2026-10-23, bug « les matchs gagnés n'apparaissent pas ») :
//  V5 interrogeait ESPN avec la date du FICHIER D'ARCHIVE. Or les archives
//  contiennent aussi les matchs « À venir » (J+1..J+5) : un match publié le
//  22/10 mais joué le 25/10 était cherché sur le 22/10 → jamais trouvé →
//  PENDING à vie → « non vérifiable », même après une victoire réelle.
//  V6 interroge ESPN avec la DATE RÉELLE DU MATCH (p.date) — et la veille,
//  car ESPN regroupe les matchs US du soir sous la date américaine
//  (ex. LAFC-LA Galaxy, coup d'envoi 01:00Z le 26/10, listé sous dates=20261025).
//
// AUTRES AMÉLIORATIONS V6 :
//  - Cache des scores par date sur tout le run : les archives successives qui
//    répètent les mêmes matchs à venir ne déclenchent qu'UN SEUL fetch par
//    (date, ligue) au lieu d'un par fichier ;
//  - Les archives sans aucun prono en attente sont ignorées (aucun fetch) ;
//  - PROPAGATION : le verdict d'un match est écrit dans TOUTES les copies du
//    même prono présentes dans la fenêtre de 90 archives (fini les doublons
//    « WON dans une archive, PENDING à vie dans les autres ») ;
//  - Checkpoint : écriture disque régulière (robuste aux timeouts).
//
// INVARIANTS CONSERVÉS :
//  - Seuls STATUS_FINAL / STATUS_FULL_TIME (ESPN) et FT/Finished (TheSportsDB)
//    alimentent les scores : un match non joué ne peut jamais être jugé ;
//  - verdict via scripts/verdict.mjs (source unique testée) ;
//  - les champs de prono ne sont jamais modifiés — uniquement status /
//    finalScore / verifiedAt (RESULT_FIELDS côté finalize-predictions).
// ═══════════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { computeVerdict } from './verdict.mjs';

const ARCHIVE_DIR = './public/predictions-archive';
const WINDOW_SIZE = 90; // comme V5 : 90 derniers jours d'archives

const LEAGUES = [
  'eng.1','eng.2','esp.1','esp.2','ger.1','ger.2','ita.1','ita.2',
  'fra.1','fra.2','ned.1','ned.2','por.1','bel.1','usa.1','usa.2',
  'bra.1','bra.2','mex.1','arg.1','chi.1','col.1','ecu.1','par.1',
  'per.1','uru.1','ven.1','sco.1','tur.1','swi.1','aut.1','den.1',
  'nor.1','swe.1','gre.1','rus.1','pol.1','cze.1','cro.1','rou.1',
  'jpn.1','kor.1','aus.1','rsa.1',
  'uefa.champions','uefa.europa','uefa.europa.conf',
  'fifa.world','fifa.wq',
];

const HIGH_BTTS = ['bundesliga','eredivisie','jupiler','swiss','mls','championship','premier','liga','serie','ligue 1'];

function normalize(s = '') {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|united|city|club|real|de|la|afc|ac|as|rc|cd|ca|cf|athletic|atletico|atl)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function fuzzyMatch(ph, pa, ah, aa) {
  const a = normalize(ph), b = normalize(pa), c = normalize(ah), d = normalize(aa);
  // Exact match
  if (a === c && b === d) return true;
  if (a === d && b === c) return true;
  // Includes match (one name contains the other)
  if (a.length > 2 && b.length > 2 && c.length > 2 && d.length > 2) {
    if ((c.includes(a) || a.includes(c)) && (d.includes(b) || b.includes(d))) return true;
    if ((d.includes(a) || a.includes(d)) && (c.includes(b) || b.includes(c))) return true;
  }
  // Token overlap match (at least 1 token in common per team)
  const tokensA = new Set(a.split(/(.{3,})/).filter(t => t.length >= 3));
  const tokensB = new Set(b.split(/(.{3,})/).filter(t => t.length >= 3));
  const tokensC = new Set(c.split(/(.{3,})/).filter(t => t.length >= 3));
  const tokensD = new Set(d.split(/(.{3,})/).filter(t => t.length >= 3));
  let homeMatch = false, awayMatch = false;
  for (const t of tokensA) if (tokensC.has(t) || tokensD.has(t)) { homeMatch = true; break; }
  for (const t of tokensB) if (tokensD.has(t) || tokensC.has(t)) { awayMatch = true; break; }
  if (homeMatch && awayMatch) return true;
  return false;
}

// ── Helpers date (ISO YYYY-MM-DD, Africa/Dakar = UTC+0 → arithmétique UTC) ──

/** Date ISO de la veille (les matchs US du soir sont groupés par ESPN sous la date US). */
export function prevDayISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Date effective d'un prono : sa vraie date de match (p.date) sinon la date d'archive. */
export function effDateOf(p, fileDateISO) {
  return /^\d{4}-\d{2}-\d{2}$/.test(p?.date || '') ? p.date : fileDateISO;
}

/** Clé naturelle d'un prono — identique dans toutes les copies d'archives. */
export function predictionKey(p) {
  const type = String(p?.type || p?.market || 'btts').trim().toLowerCase();
  const date = typeof p?.date === 'string' ? p.date.trim() : '';
  const match = String(p?.match || `${p?.home || ''} vs ${p?.away || ''}`).trim();
  return `${date}|${match}|${type}`;
}

function isGoldProno(p) {
  if (p.tier === 'GOLD') return true;
  let proba = p.proba || 0;
  if (!proba && p.analysis) proba = p.analysis.bttsProb || p.analysis.over25Prob || 0;
  if (!proba && p.confidence) proba = p.confidence / 100;
  const lg = (p.league || '').toLowerCase();
  const isHigh = HIGH_BTTS.some(h => lg.includes(h));
  return proba >= 0.70 || (proba >= 0.65 && isHigh);
}

// ── Fournisseur de scores (cache par date sur tout le run) ──────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Récupère tous les scores FINIS d'une date (ESPN + TheSportsDB), avec cache. */
export function createScoreProvider({ fetchFn = fetch, sleepFn = sleep } = {}) {
  const cache = new Map(); // 'YYYYMMDD' → scores[]

  return async function getScores(dateISO) {
    const ymd = String(dateISO).replace(/-/g, '');
    if (cache.has(ymd)) return cache.get(ymd);

    const scores = [];
    for (const lg of LEAGUES) {
      try {
        const r = await fetchFn(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${ymd}`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (r.ok) {
          const j = await r.json();
          for (const ev of j.events || []) {
            const comp = ev.competitions?.[0];
            if (!comp) continue;
            const statusName = comp.status?.type?.name;
            if (!['STATUS_FINAL', 'STATUS_FULL_TIME'].includes(statusName)) continue;
            const hc = comp.competitors?.find(c => c.homeAway === 'home');
            const ac = comp.competitors?.find(c => c.homeAway === 'away');
            if (!hc || !ac) continue;
            const hs = parseInt(hc.score);
            const as = parseInt(ac.score);
            if (isNaN(hs) || isNaN(as)) continue;
            scores.push({ home: hc.team.displayName, away: ac.team.displayName, hs, as });
          }
        }
      } catch (e) {}
      await sleepFn(40);
    }

    // Fallback: TheSportsDB (couvre des ligues différentes, public, sans clé)
    try {
      const r = await fetchFn(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateISO}&s=Soccer`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (r.ok) {
        const j = await r.json();
        for (const ev of j.events || []) {
          const status = ev.strStatus || '';
          if (!/FT|Match Finished|Finished|Final/i.test(status)) continue;
          const hs = parseInt(ev.intHomeScore);
          const as = parseInt(ev.intAwayScore);
          if (isNaN(hs) || isNaN(as)) continue;
          scores.push({ home: ev.strHomeTeam, away: ev.strAwayTeam, hs, as });
        }
      }
    } catch (e) {}

    cache.set(ymd, scores);
    return scores;
  };
}

/** Cherche le score final d'un prono sur sa date réelle + la veille. */
async function findScore(p, fileDateISO, getScores) {
  const primary = effDateOf(p, fileDateISO);
  const dates = [primary, prevDayISO(primary)].filter(Boolean);
  const teams = (p.match || '').split(/\s+vs?\s+/i);
  const pHome = p.home || p.homeTeam || teams[0] || '';
  const pAway = p.away || p.awayTeam || teams[1] || '';
  for (const d of dates) {
    const scores = await getScores(d);
    for (const s of scores) {
      if (fuzzyMatch(pHome, pAway, s.home, s.away)) return s;
    }
  }
  return null;
}

// ── Traitement des archives ─────────────────────────────────────────────────

/**
 * Vérifie les pronos en attente sur leur date réelle et propage les verdicts.
 * @param {object} opts
 *   - dir          : dossier d'archives (défaut ./public/predictions-archive)
 *   - write        : écrire les fichiers modifiés (défaut true)
 *   - getScores    : fournisseur de scores injectable (tests)
 *   - windowSize   : nombre d'archives récentes traitées (défaut 90)
 * @returns {object} résumé { filesLoaded, filesNeedingFetch, verified, won, lost,
 *                        propagated, filesWritten, stillPending }
 */
export async function runVerifyResults({
  dir = ARCHIVE_DIR,
  write = true,
  getScores = createScoreProvider(),
  windowSize = WINDOW_SIZE,
  log = () => {},
} = {}) {
  if (!fs.existsSync(dir)) {
    log(`[VerifyResults] ${dir} introuvable`);
    return { filesLoaded: 0, filesNeedingFetch: 0, verified: 0, won: 0, lost: 0, propagated: 0, filesWritten: 0, stillPending: 0 };
  }

  const fileNames = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(-windowSize); // fenêtre : 90 archives les plus récentes

  // 1. Chargement de toutes les archives + registre global des pronos
  const files = []; // { name, dateISO, data, preds, dirty }
  const copies = new Map(); // key → [{ file, row }]
  for (const name of fileNames) {
    const dateISO = name.replace('.json', '');
    let data;
    try { data = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); } catch { continue; }
    let preds = data.predictions || data;
    if (!Array.isArray(preds)) continue;
    const file = { name, dateISO, data, preds, dirty: false };
    files.push(file);
    for (const p of preds) {
      const key = predictionKey(p);
      if (!copies.has(key)) copies.set(key, []);
      copies.get(key).push({ file, row: p });
    }
  }

  // 2. Vérification des pronos PENDING sur leur DATE RÉELLE
  const pendingRows = files.flatMap(f => f.preds
    .filter(p => p.status !== 'WON' && p.status !== 'LOST')
    .map(p => ({ file: f, row: p })));

  let verified = 0, won = 0, lost = 0, propagated = 0, filesWritten = 0, processed = 0;

  const applyVerdict = (row, s) => {
    const win = computeVerdict(row.type, row.prediction, s.hs, s.as) === 'WON';
    row.finalScore = `${s.hs}-${s.as}`;
    row.status = win ? 'WON' : 'LOST';
    row.verifiedAt = new Date().toISOString();
    verified++;
    if (win) won++; else lost++;
    return win;
  };

  const propagate = (key, source) => {
    const group = copies.get(key) || [];
    let changed = 0;
    for (const { row } of group) {
      if (row === source.row) continue;
      if (row.status === 'WON' || row.status === 'LOST') continue;
      row.status = source.row.status;
      row.finalScore = source.row.finalScore;
      row.verifiedAt = source.row.verifiedAt;
      propagated++;
      changed++;
    }
    return changed;
  };

  const markDirty = (file) => { file.dirty = true; };

  const flush = () => {
    if (!write) return;
    for (const file of files) {
      if (!file.dirty) continue;
      if (file.data.predictions) file.data.predictions = file.preds;
      else file.data = file.preds;
      fs.writeFileSync(path.join(dir, file.name), JSON.stringify(file.data, null, 2));
      file.dirty = false;
      filesWritten++;
    }
  };

  // Grouper les fichiers ayant au moins un prono en attente (GOLD d'abord)
  const filesNeedingFetch = files.filter(f => f.preds.some(p => p.status !== 'WON' && p.status !== 'LOST'));
  const goldFirst = (f) => f.preds.some(p => p.status !== 'WON' && p.status !== 'LOST' && isGoldProno(p)) ? 0 : 1;
  filesNeedingFetch.sort((a, b) => goldFirst(a) - goldFirst(b) || b.dateISO.localeCompare(a.dateISO));

  log(`[VerifyResults] V6 — ${files.length} archives chargées, ${filesNeedingFetch.length} avec pronos en attente (${pendingRows.length} pronos)`);

  for (const file of filesNeedingFetch) {
    for (const p of file.preds) {
      if (p.status === 'WON' || p.status === 'LOST') continue;
      const s = await findScore(p, file.dateISO, getScores);
      if (!s) {
        if (p.status !== 'PENDING') { p.status = 'PENDING'; markDirty(file); }
        continue;
      }
      const win = applyVerdict(p, s);
      markDirty(file);
      const key = predictionKey(p);
      const changed = propagate(key, { file, row: p });
      if (changed > 0) {
        // Marquer comme dirty les fichiers touchés par la propagation
        for (const { file: otherFile } of (copies.get(key) || [])) markDirty(otherFile);
        log(`[VerifyResults] ${p.match} -> ${p.finalScore} ${win ? 'WON' : 'LOST'} (propagé sur ${changed} copie(s))`);
      } else if (isGoldProno(p)) {
        log(`[VerifyResults] GOLD ${p.match} -> ${p.finalScore} ${win ? 'WON' : 'LOST'}`);
      }
    }
    processed++;
    if (processed % 10 === 0) {
      log(`[VerifyResults] Checkpoint: ${processed}/${filesNeedingFetch.length} fichiers | W=${won} L=${lost} propagés=${propagated}`);
      flush();
    }
  }

  // 3. Écriture finale
  flush();

  const stillPending = files.flatMap(f => f.preds)
    .filter(p => p.status !== 'WON' && p.status !== 'LOST').length;

  log(`[VerifyResults] ===============================================================`);
  log(`[VerifyResults] Vérifiés ${verified} W${won} L${lost} | propagés: ${propagated} | fichiers écrits: ${filesWritten} | reste en attente: ${stillPending}`);
  log(`[VerifyResults] ✅ Done — date réelle du match (p.date + veille), cache par date, propagation anti-doublons.`);

  return { filesLoaded: files.length, filesNeedingFetch: filesNeedingFetch.length, verified, won, lost, propagated, filesWritten, stillPending };
}

// Exécuté en direct uniquement (le bot GitHub) ; l'import en tant que module
// (tests vitest) n'exécute rien.
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runVerifyResults({ dir: ARCHIVE_DIR, write: true, log: console.log }).catch(err => {
    console.error('[VerifyResults] FATAL:', err);
    process.exit(1);
  });
}
