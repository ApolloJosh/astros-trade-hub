// Generates small sample data files so the site renders before the first
// live pipeline run. Real data overwrites these. (Values via the real engine.)
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js');
const OUT = path.join(__dirname, '..', 'docs', 'data');
fs.mkdirSync(OUT, { recursive: true });
const lg = E.defaultBaselines();

function mk(name, teamId, team, pos, age, bt, ctrl, salM, stat, pitcher, opts = {}) {
  const base = pitcher ? E.warPitcher(stat, lg) : E.warHitter(stat, pos, lg);
  if (opts.hist) base.hist = opts.hist;
  if (opts.risk) base.risk = opts.risk;
  let sv = E.valueFromBase(base, pitcher, age, ctrl, salM);
  sv = E.adjustProspectValue(sv, opts.rank || null, !!opts.prospect);
  const tv = E.tradeValue2(sv, base, pitcher, age, opts.rank || null, !!opts.prospect, opts.il || '', opts.top100 || null);
  return {
    id: opts.id || Math.floor(Math.random() * 900000), name, team, teamId, pos,
    bt, age, ctrl, salM, salEst: !!opts.salEst, prospect: !!opts.prospect,
    orgRank: opts.rank || null, top100: opts.top100 || null, topLevel: opts.topLevel || null,
    war: E.r1(base.war), proj: E.r1(sv.proj), sur: sv.surplus != null ? E.r1(sv.surplus) : null,
    rem: sv.cost != null ? E.r1(sv.cost) : null,
    tv, traded: opts.traded || undefined,
    line: pitcher ? { ip: stat.inningsPitched, era: stat.era, whip: 1.1, k: stat.strikeOuts, g: stat.gamesPlayed, gs: stat.gamesStarted }
      : { pa: stat.plateAppearances, avg: 0.280, ops: Math.round(((stat.obp || 0.33) + (stat.slg || 0.45)) * 1000) / 1000, hr: stat.homeRuns || 10, sb: stat.stolenBases || 3, g: 80 },
    type: pitcher ? (stat.gamesStarted > 0 ? 'SP' : 'RP') : 'H',
  };
}

const players = [
  mk('Yordan Alvarez', 117, 'Astros', 'DH', 29, 'L/R', 2.5, 26, { plateAppearances: 397, obp: 0.426, slg: 0.630, stolenBases: 1, homeRuns: 29 }, false, { id: 670541 }),
  mk('Hunter Brown', 117, 'Astros', 'SP', 27, 'R/R', 2.5, 5.7, { inningsPitched: '29.1', era: 3.38, strikeOuts: 35, baseOnBalls: 17, homeRuns: 4, gamesPlayed: 6, gamesStarted: 6 }, true, { id: 686613, hist: [{ war: 4.4, n: 180, sp: true, season: 2025 }, { war: 3.6, n: 170, sp: true, season: 2024 }] }),
  mk('Kevin Alvarez', 117, 'Astros', 'OF', 18, 'L/L', 6.5, 0.8, { plateAppearances: 266, obp: 0.323, slg: 0.440, stolenBases: 10, homeRuns: 7 }, false, { id: 829037, prospect: true, rank: 1, risk: 0.22, topLevel: 'A' }),
  mk('Tarik Skubal', 116, 'Tigers', 'SP', 29, 'R/L', 0.5, 32, { inningsPitched: '65.2', era: 3.15, strikeOuts: 75, baseOnBalls: 8, homeRuns: 9, gamesPlayed: 11, gamesStarted: 11 }, true, { id: 669373, hist: [{ war: 6.2, n: 190, sp: true, season: 2025 }] }),
  mk('Riley Greene', 116, 'Tigers', 'OF', 25, 'L/L', 2.5, 5, { plateAppearances: 376, obp: 0.380, slg: 0.474, stolenBases: 2, homeRuns: 13 }, false, { id: 682985 }),
  mk('Mickey Moniak', 115, 'Rockies', 'OF', 28, 'L/L', 1.5, 2, { plateAppearances: 208, obp: 0.332, slg: 0.602, stolenBases: 1, homeRuns: 15 }, false, { id: 666160, traded: true }),
  mk('Sample Top100 Kid', 111, 'Red Sox', 'SS', 20, 'R/R', 6.5, 0.8, { plateAppearances: 300, obp: 0.380, slg: 0.520, stolenBases: 15, homeRuns: 12 }, false, { prospect: true, rank: 2, top100: 8, risk: 0.45, topLevel: 'AA', salEst: true }),
];
fs.writeFileSync(path.join(OUT, 'players.json'), JSON.stringify({ updated: new Date().toISOString(), season: E.CFG.season, sample: true, players }));

const p = (n) => players.find(x => x.name === n);
fs.writeFileSync(path.join(OUT, 'feed.json'), JSON.stringify({
  updated: new Date().toISOString(), since: E.CFG.feedSince, sample: true,
  trades: [{
    date: '2026-07-05',
    desc: 'Rockies traded OF Mickey Moniak to Astros for prospects.',
    sides: [
      { team: 'Astros', teamId: 117, players: [{ id: 666160, name: 'Mickey Moniak', pos: 'OF', tv: p('Mickey Moniak').tv }], total: p('Mickey Moniak').tv, coverage: 1 },
      { team: 'Rockies', teamId: 115, players: [{ id: 1, name: 'Sample Prospect A', pos: 'SP', tv: 31.9, prospect: true }, { id: 2, name: 'Sample Prospect B', pos: 'OF', tv: 15.2, prospect: true, crude: true }], cashM: 2.1, total: 48.2, coverage: 1 },
    ],
    ratio: Math.round(Math.max(p('Mickey Moniak').tv, 49.2) / Math.min(p('Mickey Moniak').tv, 49.2) * 100) / 100,
    verdict: { label: 'Balanced', cls: 'fair' },
  }],
}));
fs.writeFileSync(path.join(OUT, 'payroll.json'), JSON.stringify({ ...E.CFG.payrollDefaults, sample: true }));
fs.writeFileSync(path.join(OUT, 'calibration.json'), JSON.stringify({
  updated: new Date().toISOString(), sample: true, tradesAnalyzed: 1, tradesTotal: 1, marketTemp: 1.13,
  starSideMedian: 1.13, prospectPkgMedian: 0.89,
  suggestions: ['Median trade balance 1.13 — the model is pricing the market well. No knob changes suggested.'],
}));
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
  updated: new Date().toISOString(), season: E.CFG.season, sample: true,
  baselines: lg, counts: { players: players.length, fits: 0 }, marketMult: 1,
}));
console.log('Sample data written:', players.map(x => `${x.name}=${x.tv}`).join(', '));
