// Parity: engine.js must produce identical numbers to the Apps Script Code.gs.
// Loads Code.gs with stubs (offline -> fallback league baselines) and compares.
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js');

const codeGsPath = path.join(__dirname, '..', '..', 'Code.gs');
if (!fs.existsSync(codeGsPath)) {
  // In CI the Apps Script file isn't present — run engine sanity checks instead.
  const lg = E.defaultBaselines();
  const b = E.warHitter({ plateAppearances: 600, obp: 0.400, slg: 0.390, stolenBases: 20 }, 'SS', lg);
  const sane = b.war > 5 && b.war < 6.5 && E.tradeValue2(
    E.valueFromBase(b, false, 27, 2.5, 6), b, false, 27, null, false, '') > 60;
  console.log(sane ? 'ENGINE SANITY OK (Code.gs not present — parity skipped)' : 'ENGINE SANITY FAILED');
  process.exit(sane ? 0 : 1);
}
global.UrlFetchApp = { fetch() { throw new Error('offline'); } };
global.SpreadsheetApp = { getActiveSpreadsheet() { return { toast() {}, getSheetByName() { return null; } }; }, getUi() { return {}; } };
global.Utilities = { parseCsv() { return [[]]; } };
global.ScriptApp = {};
eval(fs.readFileSync(codeGsPath, 'utf8'));

let fails = 0;
const eq = (a, b, label, tol = 1e-9) => {
  const ok = (a == null && b == null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol) || a === b;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label + (ok ? '' : `  engine=${JSON.stringify(a)} codegs=${JSON.stringify(b)}`));
  if (!ok) fails++;
};

const lg = E.defaultBaselines();

// WAR proxies
const hitS = { plateAppearances: 420, obp: 0.362, slg: 0.481, stolenBases: 11 };
eq(E.warHitter(hitS, 'SS', lg).war, warHitter_(hitS, 'SS').war, 'warHitter SS');
const pitS = { inningsPitched: '112.1', era: 3.42, strikeOuts: 118, baseOnBalls: 33, homeRuns: 12, gamesPlayed: 19, gamesStarted: 19 };
eq(E.warPitcher(pitS, lg).war, warPitcher_(pitS).war, 'warPitcher SP');
const rpS = { inningsPitched: '41.0', era: 2.20, strikeOuts: 48, baseOnBalls: 14, homeRuns: 3, gamesPlayed: 40, gamesStarted: 0, saves: 14 };
eq(E.warPitcher(rpS, lg).war, warPitcher_(rpS).war, 'warPitcher closer bump');

// Projection + aging
eq(E.ageMult(24), ageMult_(24), 'ageMult young');
eq(E.ageMult(34), ageMult_(34), 'ageMult old');
const hist = [{ war: 3.4, n: 610, sp: false, season: 2025 }, { war: 2.8, n: 540, sp: false, season: 2023 }];
const base = { war: 1.4, n: 300, sp: false, hist };
eq(E.projectFull(base, false, 29), projectFull_(base, false, 29), 'projectFull with gap-weighted history');

// Full valuation
const svE = E.valueFromBase(base, false, 29, 2.5, 6.2);
const svG = valueFromBase_(base, false, 29, 2.5, 6.2);
['proj', 'projR', 'remWar', 'mkt', 'cost', 'surplus'].forEach(k => eq(svE[k], svG[k], 'valueFromBase.' + k));

// Prospect combine (hitting, two levels)
const rows = [
  { s: { plateAppearances: 60, atBats: 55, hits: 12, homeRuns: 1, rbi: 5, baseOnBalls: 4, strikeOuts: 18, stolenBases: 1, hitByPitch: 0, sacFlies: 1, totalBases: 19, obp: 0.270, slg: 0.350, gamesPlayed: 20 }, f: 1.0, wp: 0, ep: 0 },
  { s: { plateAppearances: 300, atBats: 260, hits: 85, homeRuns: 10, rbi: 45, baseOnBalls: 35, strikeOuts: 60, stolenBases: 8, hitByPitch: 2, sacFlies: 3, totalBases: 146, obp: 0.400, slg: 0.560, gamesPlayed: 70 }, f: 0.80, wp: 0.020, ep: 0.35 },
];
eq(E.combineHitting(rows, 'SS', lg).base.war, combineHitting_(rows, 'SS').base.war, 'combineHitting MLE war');

// Rank / prospect surplus adjustments
eq(E.rankValue(7), rankValue_(7), 'rankValue');
const aE = E.adjustProspectValue({ war: 1, proj: 2, projR: 0.6, remWar: 3, mkt: 40, cost: 5, surplus: 35 }, 2, true);
const aG = adjustProspectValue_({ war: 1, proj: 2, projR: 0.6, remWar: 3, mkt: 40, cost: 5, surplus: 35 }, 2, true);
eq(aE.surplus, aG.surplus, 'adjustProspectValue blended surplus');

// Trade Value v2
const tvE = E.tradeValue2(svE, base, false, 29, null, false, '');
const tvG = tradeValue2_(svG, base, false, 29, null, false, '');
eq(tvE, tvG, 'tradeValue2 MLB player');
const tvIL = E.tradeValue2(svE, base, false, 29, null, false, '60-day IL (Tommy John)');
eq(tvIL, tradeValue2_(svG, base, false, 29, null, false, '60-day IL (Tommy John)'), 'tradeValue2 IL haircut');
eq(E.tradeValue2(null, null, false, 20, 1, true, ''), tradeValue2_(null, null, false, 20, 1, true, ''), 'tradeValue2 anchor-only prospect');

// Top-100 anchor is repo-only (Code.gs has no league-wide top100): sanity, not parity
const t100 = E.tradeValue2(null, null, false, 20, 25, true, '', 15);
console.log((t100 > 40 ? 'PASS  ' : 'FAIL  ') + 'top100 #15 lifts a low org rank (' + t100 + ')');
if (!(t100 > 40)) fails++;


// Graduated-prospect floor: engine.js vs Code.gs across the signal space.
[
  ['ex #3, age 21, 150 PA, elite Statcast', { ped: { top100: 3 }, scq: 88, nCareer: 150, debutAge: 20 }, 21, false],
  ['ex #3, age 22, 150 PA, no Statcast',    { ped: { top100: 3 }, nCareer: 150 }, 22, false],
  ['ex #40, age 24, 700 PA, poor Statcast', { ped: { top100: 40 }, scq: 18, nCareer: 700, debutAge: 23 }, 24, false],
  ['org-only pedigree, age 23',             { ped: { org: 4 }, scq: 55, nCareer: 300 }, 23, false],
  ['tier pedigree, age 23',                 { ped: { tier: 2 }, scq: 55, nCareer: 300 }, 23, false],
  ['past the window (1400 PA)',             { ped: { top100: 3 }, scq: 80, nCareer: 1400 }, 22, false],
  ['too old (28)',                          { ped: { top100: 3 }, scq: 80, nCareer: 200 }, 28, false],
  ['no pedigree at all',                    { ped: null, scq: 80, nCareer: 200 }, 22, false],
  ['pitcher, ex #12, age 23, 90 IP',        { ped: { top100: 12 }, scq: 70, nCareer: 90, debutAge: 21 }, 23, true],
].forEach(function (c) {
  const label = c[0], sv = c[1], age = c[2], pit = c[3];
  const base = pit ? { sp: true, n: 90 } : { sp: false, n: 150 };
  eq(E.gradFloor(sv, base, pit, age, E.CFG.sv.tv),
     gradFloor_(sv, base, pit, age), 'gradFloor: ' + label);
});
// ...and that it flows through tradeValue2 identically.
[[{ ped: { top100: 3 }, scq: 85, nCareer: 200, debutAge: 20, proj: 0.4, cost: 1, surplus: 2 }, 22],
 [{ ped: { top100: 60 }, scq: 30, nCareer: 900, debutAge: 24, proj: 0.9, cost: 2, surplus: 4 }, 25]
].forEach(function (c, i) {
  const sv = c[0], age = c[1], base = { sp: false, n: 200, war: 0.2 };
  eq(E.tradeValue2(sv, base, false, age, null, false, '', null),
     tradeValue2_(sv, base, false, age, null, false, ''), 'tradeValue2 carrying the grad floor #' + (i + 1));
});

console.log(fails ? `\n${fails} PARITY FAILURES` : '\nENGINE PARITY OK');
process.exit(fails ? 1 : 0);
