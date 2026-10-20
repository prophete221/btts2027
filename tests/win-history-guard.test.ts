/**
 * Tests du garde-fou anti-régression de scripts/update-win-history.mjs
 *
 * Garanties vérifiées :
 *  1. un payload valide (schéma v3, sans champ interdit) est accepté ;
 *  2. un ancien format (ROI / yield / avgOdds / profit / coteProposee /
 *     coteCloture / bookmaker) est REFUSÉ avec la liste des champs fautifs ;
 *  3. un refus ne modifie jamais win-history.json (exit 1 avant écriture).
 *
 * Les tests ne sont PAS couplés aux données vivantes (aucun chiffre exact
 * attendu — le bot met les données à jour plusieurs fois par jour).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

import {
  SCHEMA_VERSION,
  FORBIDDEN_KEYS,
  findForbiddenKeys,
  validateWinHistoryPayload,
  WinHistoryValidationError,
} from '../scripts/update-win-history.mjs';

const REPO_ROOT = process.cwd();
const REAL_FILE = path.join(REPO_ROOT, 'public', 'win-history.json');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'update-win-history.mjs');

let tmpDir: string;
let realFileHashBefore: string;

const sha256 = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** Payload valide minimal (structure conforme au schéma v4 — grâce 48 h). */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: '2026-09-28T21:00:00.000Z',
    pendingPolicy: { graceHours: 48 },
    trackingPeriod: {
      startDate: '2026-08-08',
      isPublicPeriod: true,
      disclaimer: 'Suivi public.',
      insufficientVolume: false,
    },
    stats: {
      total: 4, won: 3, lost: 1, pending: 9, unverifiable: 0, archivedTotal: 13, rate: 75,
      gold: { total: 2, won: 2, lost: 0, rate: 100 },
      standard: { total: 2, won: 1, lost: 1, rate: 50 },
      byType: {
        btts: { total: 3, won: 2, lost: 1, rate: 66.7 },
        over25: { total: 1, won: 1, lost: 0, rate: 100 },
      },
      trend14: [{ date: '2026-09-01', total: 2, won: 2, lost: 0, rate: 100 }],
      period: { from: '2026-08-08', to: '2026-09-01', days: 25 },
    },
    history: [
      {
        date: '2026-09-01', match: 'A vs B', league: 'Test League', market: 'btts',
        tier: 'GOLD', proba: 0.8, status: 'WON', finalScore: '2-1',
        verifiedAt: '2026-09-02T00:00:00.000Z', source: 'ESPN public',
      },
    ],
    legacyStats: {
      total: 1, won: 0, lost: 1, pending: 0, unverifiable: 4, archivedTotal: 5, rate: 0,
      gold: { total: 0, won: 0, lost: 0, rate: 0 },
      standard: { total: 1, won: 0, lost: 1, rate: 0 },
      byType: { btts: { total: 1, won: 0, lost: 1, rate: 0 }, over25: { total: 0, won: 0, lost: 0, rate: 0 } },
      trend14: [], period: { from: '2026-06-18', to: '2026-08-07', days: 51 },
      history: [{
        date: '2026-07-01', match: 'C vs D', league: 'Old League', market: 'over25',
        tier: 'STANDARD', proba: 0.6, status: 'LOST', finalScore: '0-0',
        verifiedAt: '2026-07-02T00:00:00.000Z', source: 'ESPN public',
      }],
      isPrivate: true,
      note: 'Archives antérieures.',
    },
    ...overrides,
  };
}

/** Ancien format (pré-Phase 3) : tous les champs bannis, comme le V8 les produisait. */
function oldFormatPayload() {
  const p = validPayload() as Record<string, any>;
  p.schemaVersion = undefined;
  p.stats.roi = 23.7;
  p.stats.yield = 23.7;
  p.stats.avgOdds = 1.9;
  p.stats.profit = 20.4;
  p.stats.gold.profit = 15.1;
  p.stats.gold.roi = 30.3;
  p.history[0].coteProposee = 1.9;
  p.history[0].coteCloture = 2.05;
  p.history[0].bookmaker = 'Linebet';
  p.history[0].profit = 0.9;
  return p;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-history-guard-'));
  realFileHashBefore = sha256(REAL_FILE);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('findForbiddenKeys', () => {
  it('détecte les 7 champs interdits où qu\'ils soient (racine, stats, gold, history, legacy)', () => {
    const p = oldFormatPayload();
    (p as any).legacyStats.avgOdds = 1.9;
    const found = findForbiddenKeys(p);
    for (const expected of [
      'stats.roi', 'stats.yield', 'stats.avgOdds', 'stats.profit',
      'stats.gold.profit', 'stats.gold.roi',
      'history[0].coteProposee', 'history[0].coteCloture', 'history[0].bookmaker', 'history[0].profit',
      'legacyStats.avgOdds',
    ]) {
      expect(found).toContain(expected);
    }
  });

  it('ne détecte rien sur un payload propre (les valeurs texte ne comptent pas)', () => {
    expect(findForbiddenKeys(validPayload())).toEqual([]);
  });
});

describe('validateWinHistoryPayload', () => {
  it('1. accepte un payload valide', () => {
    expect(() => validateWinHistoryPayload(validPayload())).not.toThrow();
  });

  it('2. refuse l\'ancien format en listant chaque champ interdit', () => {
    let message = '';
    try {
      validateWinHistoryPayload(oldFormatPayload());
    } catch (err) {
      message = (err as Error).message;
      expect(err).toBeInstanceOf(WinHistoryValidationError);
    }
    expect(message).not.toBe('');
    for (const fragment of [
      'stats.roi', 'stats.yield', 'stats.avgOdds', 'stats.profit',
      'stats.gold.profit', 'stats.gold.roi',
      'history[0].coteProposee', 'history[0].coteCloture', 'history[0].bookmaker', 'history[0].profit',
    ]) {
      expect(message).toContain(fragment);
    }
  });

  it('détecte chaque champ interdit individuellement, à tous les niveaux', () => {
    for (const key of FORBIDDEN_KEYS) {
      const p = validPayload() as Record<string, any>;
      p.history[0][key] = 1.9;
      expect(() => validateWinHistoryPayload(p)).toThrowError(WinHistoryValidationError);
      expect(() => validateWinHistoryPayload(p)).toThrowError(key);
    }
  });

  it('valide le vrai public/win-history.json (fichier de production)', () => {
    const real = JSON.parse(fs.readFileSync(REAL_FILE, 'utf8'));
    expect(findForbiddenKeys(real)).toEqual([]);
    expect(() => validateWinHistoryPayload(real)).not.toThrow();
  });

  it('refuse une incohérence total ≠ won + lost', () => {
    const p = validPayload() as Record<string, any>;
    p.stats.total = 99;
    expect(() => validateWinHistoryPayload(p)).toThrowError(/total/);
  });

  it('refuse un rate incohérent avec won/total', () => {
    const p = validPayload() as Record<string, any>;
    p.stats.rate = 12.3;
    expect(() => validateWinHistoryPayload(p)).toThrowError(/rate/);
  });

  it('refuse un statut invalide dans history (PENDING n\'appartient pas à history)', () => {
    const p = validPayload() as Record<string, any>;
    p.history[0].status = 'PENDING';
    expect(() => validateWinHistoryPayload(p)).toThrowError(/PENDING/);
  });

  it('refuse une clé racine manquante', () => {
    const p = validPayload() as Record<string, any>;
    delete p.trackingPeriod;
    expect(() => validateWinHistoryPayload(p)).toThrowError(/trackingPeriod/);
  });
});

describe('intégration CLI (processus enfant)', () => {
  it('--validate accepte le vrai win-history.json', () => {
    const out = execSync(`node ${JSON.stringify(SCRIPT)} --validate ${JSON.stringify(REAL_FILE)}`, {
      cwd: REPO_ROOT, stdio: 'pipe',
    }).toString();
    expect(out).toContain('valide');
  });

  it('--validate refuse un ancien format avec exit 1 et message explicite', () => {
    const oldFile = path.join(tmpDir, 'old-format.json');
    fs.writeFileSync(oldFile, JSON.stringify(oldFormatPayload()));
    let status = 0;
    let stderr = '';
    try {
      execSync(`node ${JSON.stringify(SCRIPT)} --validate ${JSON.stringify(oldFile)}`, { cwd: REPO_ROOT, stdio: 'pipe' });
    } catch (e: any) {
      status = e.status;
      stderr = (e.stderr || '').toString();
    }
    expect(status).toBe(1);
    expect(stderr).toContain('VALIDATION REFUSÉE');
    expect(stderr).toContain('stats.roi');
    expect(stderr).toContain('bookmaker');
  });

  it('1. un run valide est accepté et écrit un fichier sans champ interdit', () => {
    const target = path.join(tmpDir, 'valid-output.json');
    execSync(`node ${JSON.stringify(SCRIPT)}`, {
      cwd: REPO_ROOT, stdio: 'pipe',
      env: { ...process.env, WIN_HISTORY_OUT: target },
    });
    expect(fs.existsSync(target)).toBe(true);
    const written = JSON.parse(fs.readFileSync(target, 'utf8'));
    expect(written.schemaVersion).toBe(SCHEMA_VERSION);
    expect(findForbiddenKeys(written)).toEqual([]);
    expect(typeof written.stats.total).toBe('number');
    expect(Array.isArray(written.history)).toBe(true);
  });

  it('2+3. un script régressé est bloqué : exit 1 et fichier cible inchangé', () => {
    // Simule une régression future : une copie du script réintroduit "roi"
    const regressed = fs.readFileSync(SCRIPT, 'utf8').replace(
      'archivedTotal: bucket.archivedTotal,',
      'archivedTotal: bucket.archivedTotal,\n    roi: 12.5,'
    );
    expect(regressed).not.toBe(fs.readFileSync(SCRIPT, 'utf8')); // le patch a bien pris
    const regressedPath = path.join(tmpDir, 'update-win-history-regressed.mjs');
    fs.writeFileSync(regressedPath, regressed);

    // Copie de travail = copie exacte du vrai fichier de production
    const targetCopy = path.join(tmpDir, 'win-history-copy.json');
    fs.copyFileSync(REAL_FILE, targetCopy);
    const copyHashBefore = sha256(targetCopy);

    let status = 0;
    let stderr = '';
    try {
      execSync(`node ${JSON.stringify(regressedPath)}`, {
        cwd: REPO_ROOT, stdio: 'pipe',
        env: { ...process.env, WIN_HISTORY_OUT: targetCopy },
      });
    } catch (e: any) {
      status = e.status;
      stderr = (e.stderr || '').toString();
    }

    expect(status).toBe(1);
    expect(stderr).toContain('ÉCRITURE REFUSÉE');
    expect(stderr).toContain('roi');
    expect(stderr).toContain("n'a PAS été modifié");
    // Le fichier cible reste intact octet par octet
    expect(sha256(targetCopy)).toBe(copyHashBefore);
  });

  it('le vrai win-history.json n\'a jamais été touché par les tests', () => {
    expect(sha256(REAL_FILE)).toBe(realFileHashBefore);
  });
});
