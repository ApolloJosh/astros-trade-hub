// Statcast Fielding Run Value (Baseball Savant) -> data-sources/defense.json
// FRV is one run-based number covering range, arm, DPs, and catcher framing/
// blocking/throwing — so catchers and fielders land on the same scale.
// Keyed by MLBID; current season + previous season. Failure is non-fatal
// (an existing file is kept, otherwise an empty one is written).
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');
const OUTF = path.join(__dirname, '..', 'data-sources', 'defense.json');

async function grab(year) {
  const url = `https://baseballsavant.mlb.com/leaderboard/fielding-run-value?minInnings=1&seasonStart=${year}&seasonEnd=${year}&type=fielder&csv=true`;
  const res = await fetch(url, { headers: { 'User-Agent': 'astros-trade-hub' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const text = await res.text();
  const map = {};
  text.split(/\r?\n/).slice(1).forEach(l => {
    const m = l.match(/^"(.*?)",(\d+),(-?[\d.]+)/);
    if (m) map[m[2]] = Math.round(parseFloat(m[3]) * 10) / 10;
  });
  if (!Object.keys(map).length) throw new Error('no rows parsed for ' + year);
  return map;
}

(async () => {
  try {
    const cur = await grab(CFG.season);
    const prev = await grab(CFG.season - 1);
    const players = {};
    new Set([...Object.keys(cur), ...Object.keys(prev)]).forEach(id => {
      players[id] = [cur[id] ?? 0, prev[id] ?? 0];   // [current FRV, last season FRV]
    });
    fs.writeFileSync(OUTF, JSON.stringify({ updated: new Date().toISOString(), seasons: [CFG.season, CFG.season - 1], players }));
    console.log(`defense.json: ${Object.keys(players).length} fielders (${CFG.season} + ${CFG.season - 1}).`);
  } catch (e) {
    console.warn('fetch-defense failed — keeping previous file:', e.message);
    if (!fs.existsSync(OUTF)) fs.writeFileSync(OUTF, JSON.stringify({ players: {} }));
  }
})();
