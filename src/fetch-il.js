// IL history from the MLB transaction log -> data-sources/il-history.json
// Per player per season: number of IL stints + days missed (placement to
// activation, retroactive dates honored, open stints run to today/season end).
// Past seasons never change, so they're fetched once and cached; only the
// current season is rebuilt each run.
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');
const OUTF = path.join(__dirname, '..', 'data-sources', 'il-history.json');
const YEARS = 4;   // current + 3 back (matches sv.tv.dur.w)

const PLACED = /\bplaced\b.*\bon the (?:\d+-day )?injured list/i;
const ACTIVATED = /\b(?:activated|reinstated|returned)\b.*\bfrom the (?:\d+-day )?injured list/i;

async function fetchWindow(start, end) {
  const url = `https://statsapi.mlb.com/api/v1/transactions?startDate=${start}&endDate=${end}&sportId=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'astros-trade-hub' } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + start);
  return (await res.json()).transactions || [];
}

async function buildSeason(year, today) {
  const isCur = year === CFG.season;
  const endAll = isCur ? today : `${year}-10-05`;
  const seasonClose = isCur ? today : `${year}-09-28`;
  // ~2-month windows keep responses a sane size
  const windows = [];
  let d = new Date(`${year}-02-15`);
  while (d.toISOString().slice(0, 10) < endAll) {
    const s = d.toISOString().slice(0, 10);
    d = new Date(d.getTime() + 61 * 864e5);
    let e = d.toISOString().slice(0, 10);
    if (e > endAll) e = endAll;
    windows.push([s, e]);
  }
  const seen = new Set();
  const txs = [];
  for (const [s, e] of windows) {
    (await fetchWindow(s, e)).forEach(t => {
      const k = t.id + '|' + (t.person && t.person.id);
      if (t.typeCode === 'SC' && t.person && !seen.has(k)) { seen.add(k); txs.push(t); }
    });
  }
  txs.sort((a, b) => String(a.effectiveDate || a.date).localeCompare(String(b.effectiveDate || b.date)));
  const open = new Map();   // pid -> start date
  const out = {};           // pid -> {st, d}
  const days = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5));
  const close = (pid, when) => {
    const start = open.get(pid);
    if (start == null) return;
    open.delete(pid);
    const rec = out[pid] || (out[pid] = { st: 0, d: 0 });
    rec.st++; rec.d += days(start, when);
  };
  txs.forEach(t => {
    const pid = t.person.id, when = t.effectiveDate || t.date, desc = t.description || '';
    if (PLACED.test(desc)) { if (!open.has(pid)) open.set(pid, when); }
    else if (ACTIVATED.test(desc)) close(pid, when);
    // "transferred ... to the 60-day injured list" keeps the stint open
  });
  open.forEach((_, pid) => close(pid, seasonClose));
  return out;
}

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let doc = { seasons: {} };
  try { doc = JSON.parse(fs.readFileSync(OUTF, 'utf8')); } catch (e) {}
  doc.seasons = doc.seasons || {};
  try {
    for (let i = 0; i < YEARS; i++) {
      const y = CFG.season - i;
      if (i > 0 && doc.seasons[y] && Object.keys(doc.seasons[y]).length) continue; // past = cached
      doc.seasons[y] = await buildSeason(y, today);
      console.log(`  ${y}: ${Object.keys(doc.seasons[y]).length} players with IL time.`);
    }
    doc.updated = new Date().toISOString();
    fs.writeFileSync(OUTF, JSON.stringify(doc));
    console.log('il-history.json saved.');
  } catch (e) {
    console.warn('fetch-il failed — keeping previous file:', e.message);
    if (!fs.existsSync(OUTF)) fs.writeFileSync(OUTF, JSON.stringify({ seasons: {} }));
  }
})();
