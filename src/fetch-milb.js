/**
 * Minor league percentile rankings -> docs/data/milb.json
 *
 * Prospects arrive on the board as a name and an org rank and nothing else.
 * This builds a Savant-style percentile profile for them out of MLB's own
 * public stats API: pull every player at each level, compute percentiles
 * WITHIN that level, and derive a few composites.
 *
 * Why percentiles per level: a .800 OPS means something very different in
 * Rookie ball than at AAA, so ranking a player against his own level is the
 * only comparison that holds up.
 *
 * What this is NOT: these are traditional-stat percentiles. Real Statcast
 * inputs for the minors (xwOBA, exit velo, barrel rate, chase rate) live in
 * Savant's pitch-level minors feed, which is a much bigger lift — see
 * docs/data/README or the notes in fetch-statcast.js.
 *
 * Source: MLB Stats API (statsapi.mlb.com). Credit Prospect Savant for the
 * idea — this implementation shares no data or code with them.
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');

const YEAR = CFG.season;
const OUT = path.join(__dirname, '..', 'docs', 'data', 'milb.json');
const API = 'https://statsapi.mlb.com/api/v1/stats';

// sportId -> label, ordered low to high so "highest level reached" is a max()
const LEVELS = [[16, 'Rk'], [14, 'A'], [13, 'A+'], [12, 'AA'], [11, 'AAA']];
const LEVEL_RANK = new Map(LEVELS.map(([id, lbl], i) => [lbl, i]));

// Playing-time floors. Below these the rate stats are noise and would also
// distort everyone else's percentile, so they're excluded from the pool.
const MIN_PA = 50;
const MIN_IP = 20;

const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
// "82.1" means 82 innings and one out, not 82.1 innings.
const ip2out = v => {
  const n = num(v); if (n == null) return null;
  const whole = Math.floor(n);
  return whole * 3 + Math.round((n - whole) * 10);
};
const div = (a, b) => (a == null || !b ? null : a / b);

// [key, label, invert] — invert = lower raw value is better
const HIT = [
  ['ops', 'OPS', 0], ['obp', 'OBP', 0], ['slg', 'SLG', 0], ['avg', 'AVG', 0],
  ['iso', 'ISO', 0], ['hrRate', 'HR%', 0], ['bbpct', 'BB%', 0],
  ['kpct', 'K%', 1], ['sb', 'SB', 0], ['babip', 'BABIP', 0],
];
const PIT = [
  ['era', 'ERA', 1], ['whip', 'WHIP', 1], ['k9', 'K/9', 0], ['bb9', 'BB/9', 1],
  ['h9', 'H/9', 1], ['hr9', 'HR/9', 1], ['kpct', 'K%', 0], ['bbpct', 'BB%', 1],
  ['kbb', 'K/BB', 0], ['strikePct', 'Strike%', 0],
];
// Composites, mirroring how a scouting board reads: what he produced, how hard
// he hit it, how well he controlled the zone.
const COMPOSITES = {
  H: { production: ['ops', 'obp', 'avg'], power: ['slg', 'iso', 'hrRate'], discipline: ['bbpct', 'kpct'] },
  P: { run_prevention: ['era', 'whip', 'h9'], stuff: ['k9', 'kpct'], control: ['bb9', 'bbpct', 'kbb', 'strikePct'] },
};

async function pull(sportId, group) {
  const url = `${API}?stats=season&group=${group}&season=${YEAR}&sportId=${sportId}&limit=3000&playerPool=ALL`;
  const r = await fetch(url, { headers: { 'User-Agent': 'astros-trade-hub' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  return (j.stats && j.stats[0] && j.stats[0].splits) || [];
}

function hitRow(s) {
  const t = s.stat || {}, pa = num(t.plateAppearances);
  if (!pa || pa < MIN_PA) return null;
  const avg = num(t.avg), slg = num(t.slg);
  return {
    id: s.player && s.player.id, name: s.player && s.player.fullName,
    team: s.team && s.team.name, age: num(t.age), pa,
    line: `${t.avg || '—'} AVG · ${t.ops || '—'} OPS · ${t.homeRuns ?? 0} HR · ${t.stolenBases ?? 0} SB`,
    v: {
      ops: num(t.ops), obp: num(t.obp), slg, avg,
      iso: (slg != null && avg != null) ? +(slg - avg).toFixed(3) : null,
      hrRate: pct1(div(num(t.homeRuns), pa)), bbpct: pct1(div(num(t.baseOnBalls), pa)),
      kpct: pct1(div(num(t.strikeOuts), pa)), sb: num(t.stolenBases), babip: num(t.babip),
    },
  };
}
function pitRow(s) {
  const t = s.stat || {}, outs = ip2out(t.inningsPitched), bf = num(t.battersFaced);
  if (!outs || outs < MIN_IP * 3) return null;
  return {
    id: s.player && s.player.id, name: s.player && s.player.fullName,
    team: s.team && s.team.name, age: num(t.age), ip: t.inningsPitched,
    line: `${t.era || '—'} ERA · ${t.whip || '—'} WHIP · ${t.strikeOuts ?? 0} K · ${t.inningsPitched || 0} IP`,
    v: {
      era: num(t.era), whip: num(t.whip), k9: num(t.strikeoutsPer9Inn), bb9: num(t.walksPer9Inn),
      h9: num(t.hitsPer9Inn), hr9: num(t.homeRunsPer9), kbb: num(t.strikeoutWalkRatio),
      kpct: pct1(div(num(t.strikeOuts), bf)), bbpct: pct1(div(num(t.baseOnBalls), bf)),
      strikePct: pct1(num(t.strikePercentage)),
    },
  };
}
const pct1 = v => (v == null ? null : +(v * 100).toFixed(1));

// Standard "percent of the pool at or below", with ties split.
function percentile(sorted, v, invert) {
  if (v == null || !sorted.length) return null;
  let below = 0, eq = 0;
  for (const x of sorted) { if (x < v) below++; else if (x === v) eq++; }
  const p = 100 * (below + 0.5 * eq) / sorted.length;
  return Math.round(invert ? 100 - p : p);
}

function score(rows, spec, kind) {
  // Column-wise pools, built once per level so every player is ranked against
  // the same set.
  const pools = {};
  spec.forEach(([k]) => { pools[k] = rows.map(r => r.v[k]).filter(v => v != null).sort((a, b) => a - b); });
  const ages = rows.map(r => r.age).filter(v => v != null).sort((a, b) => a - b);

  rows.forEach(r => {
    r.p = {};
    spec.forEach(([k, , inv]) => { const pc = percentile(pools[k], r.v[k], inv); if (pc != null) r.p[k] = pc; });
    // Younger for the level is a real edge, so it gets its own percentile and
    // then nudges the headline score.
    r.p.age = percentile(ages, r.age, 1);
    const all = Object.entries(r.p).filter(([k]) => k !== 'age').map(([, v]) => v);
    r.agg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : null;
    r.comp = {};
    Object.entries(COMPOSITES[kind]).forEach(([name, keys]) => {
      const vals = keys.map(k => r.p[k]).filter(v => v != null);
      if (vals.length) r.comp[name] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    });
    // Age-weighted headline number: mostly performance, with a real but not
    // overwhelming thumb on the scale for being young at the level.
    r.score = (r.agg == null) ? null
      : Math.round(r.agg * 0.8 + (r.p.age == null ? 50 : r.p.age) * 0.2);
  });
  return rows;
}

(async () => {
  const players = {};
  const meta = [];
  for (const [sportId, lvl] of LEVELS) {
    for (const [group, kind, parse, spec] of [
      ['hitting', 'H', hitRow, HIT], ['pitching', 'P', pitRow, PIT],
    ]) {
      let rows;
      try { rows = (await pull(sportId, group)).map(parse).filter(Boolean); }
      catch (e) { console.warn(`  ${lvl} ${group}: ${e.message} — skipped`); continue; }
      // A player traded mid-level shows up twice; keep his larger sample.
      const best = new Map();
      rows.forEach(r => {
        const cur = best.get(r.id);
        if (!cur || (r.pa || r.ip || 0) > (cur.pa || cur.ip || 0)) best.set(r.id, r);
      });
      rows = [...best.values()];
      if (rows.length < 15) { console.warn(`  ${lvl} ${group}: only ${rows.length} — too thin, skipped`); continue; }
      score(rows, spec, kind);
      rows.forEach(r => {
        const prev = players[r.id];
        // Promoted players appear at several levels; show the highest reached.
        if (prev && LEVEL_RANK.get(prev.lvl) >= LEVEL_RANK.get(lvl)) return;
        players[r.id] = {
          lvl, kind, name: r.name, team: r.team, age: r.age,
          pa: r.pa, ip: r.ip, line: r.line,
          v: r.v, p: r.p, comp: r.comp, agg: r.agg, score: r.score,
        };
      });
      meta.push({ level: lvl, group, n: rows.length });
      console.log(`  ${lvl.padEnd(3)} ${group.padEnd(8)} ${rows.length} players ranked`);
    }
  }
  const out = {
    updated: new Date().toISOString(), season: YEAR,
    source: 'MLB Stats API — percentiles computed in-house, per level',
    minPA: MIN_PA, minIP: MIN_IP, pools: meta,
    labels: { H: HIT.map(([k, l]) => [k, l]), P: PIT.map(([k, l]) => [k, l]) },
    players,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`milb.json: ${Object.keys(players).length} players across ${meta.length} pools`);
})().catch(e => { console.error('fetch-milb failed:', e.message); process.exit(1); });
