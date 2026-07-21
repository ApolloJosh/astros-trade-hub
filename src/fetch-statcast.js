/**
 * Statcast metrics from Baseball Savant -> data-sources/statcast.json
 *
 * Savant's own percentile-rankings endpoint is slow and often times out, so we
 * pull the raw leaderboards and compute percentiles ourselves across qualified
 * players. Same result, far more reliable.
 *
 * Source: Baseball Savant (baseballsavant.mlb.com) — cite it wherever shown.
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');
const OUTF = path.join(__dirname, '..', 'data-sources', 'statcast.json');
const YEAR = CFG.season;

// [key, url, { ourName: csvColumn }, invert?] — invert = lower is better
const SOURCES = [
  ['batExp', `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter&year=${YEAR}&position=&team=&min=50&csv=true`,
    { xwoba: 'est_woba', xba: 'est_ba', xslg: 'est_slg' }],
  ['batEV', `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${YEAR}&min=50&csv=true`,
    { ev: 'avg_hit_speed', barrel: 'brl_percent', hardhit: 'ev95percent' }],
  ['batDisc', `https://baseballsavant.mlb.com/leaderboard/custom?year=${YEAR}&type=batter&min=50&selections=k_percent,bb_percent,whiff_percent,oz_swing_percent&csv=true`,
    { kpct: 'k_percent', bbpct: 'bb_percent', whiff: 'whiff_percent', chase: 'oz_swing_percent' }],
  ['speed', `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${YEAR}&position=&team=&min=10&csv=true`,
    { sprint: 'r_sprint_speed' }],
  ['pitExp', `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=${YEAR}&position=&team=&min=50&csv=true`,
    { xera: 'xera', pxba: 'est_ba', pxslg: 'est_slg' }],
  ['pitEV', `https://baseballsavant.mlb.com/leaderboard/statcast?type=pitcher&year=${YEAR}&min=50&csv=true`,
    { pev: 'avg_hit_speed', pbarrel: 'brl_percent', phardhit: 'ev95percent' }],
  ['pitDisc', `https://baseballsavant.mlb.com/leaderboard/custom?year=${YEAR}&type=pitcher&min=50&selections=k_percent,bb_percent,whiff_percent,oz_swing_percent,fastball_avg_speed,groundballs_percent&csv=true`,
    { pk: 'k_percent', pbb: 'bb_percent', pwhiff: 'whiff_percent', pchase: 'oz_swing_percent',
      velo: 'fastball_avg_speed', gb: 'groundballs_percent' }],
];
// Lower is better for these
const INVERT = new Set(['kpct', 'whiff', 'chase', 'xera', 'pxba', 'pxslg', 'pev', 'pbarrel', 'phardhit', 'pbb']);

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = l => { const out = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out.map(s => s.trim().replace(/^"|"$/g, '')); };
  const head = split(lines[0]).map(h => h.replace(/^﻿/, ''));
  return lines.slice(1).map(l => { const c = split(l), o = {};
    head.forEach((h, i) => o[h] = c[i]); return o; });
}

async function grab(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'astros-trade-hub' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseCSV(await res.text());
}

const pct = (arr, v, inv) => {
  if (v == null || isNaN(v) || arr.length < 20) return null;
  let below = 0, eq = 0;
  arr.forEach(x => { if (x < v) below++; else if (x === v) eq++; });
  const p = 100 * (below + 0.5 * eq) / arr.length;
  return Math.round(inv ? 100 - p : p);
};

(async () => {
  const vals = {};   // id -> { metric: value }
  for (const [key, url, map] of SOURCES) {
    try {
      const rows = await grab(url);
      let n = 0;
      rows.forEach(r => {
        const id = r.player_id || r.playerid || r.entity_id;
        if (!id) return;
        Object.entries(map).forEach(([our, col]) => {
          const raw = r[col];
          if (raw === undefined || raw === '') return;
          const num = parseFloat(raw);
          if (isNaN(num)) return;
          (vals[id] = vals[id] || {})[our] = num;
          n++;
        });
      });
      console.log(`  ${key}: ${rows.length} rows, ${n} values`);
    } catch (e) { console.warn(`  ! ${key} failed (${e.message}) — skipping those metrics`); }
  }

  // League distributions -> percentiles
  const byMetric = {};
  Object.values(vals).forEach(m => Object.entries(m).forEach(([k, v]) => (byMetric[k] = byMetric[k] || []).push(v)));
  const players = {};
  Object.entries(vals).forEach(([id, m]) => {
    const out = { v: {}, p: {} };
    Object.entries(m).forEach(([k, v]) => {
      out.v[k] = Math.round(v * 1000) / 1000;
      const p = pct(byMetric[k], v, INVERT.has(k));
      if (p != null) out.p[k] = p;
    });
    if (Object.keys(out.p).length) players[id] = out;
  });

  const count = Object.keys(players).length;
  if (!count) {
    console.warn('No Statcast data retrieved — keeping any previous file.');
    if (!fs.existsSync(OUTF)) fs.writeFileSync(OUTF, JSON.stringify({ players: {} }));
    return;
  }
  fs.writeFileSync(OUTF, JSON.stringify({ updated: new Date().toISOString(), season: YEAR,
    source: 'Baseball Savant', players }));
  console.log(`statcast.json: ${count} players.`);
})().catch(e => { console.error('fetch-statcast failed:', e.message); });
