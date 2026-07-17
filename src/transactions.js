/**
 * MLB transaction monitor:
 *  1. Pull the official trade log since config.feedSince.
 *  2. Group into trades, attach Trade Values -> docs/data/feed.json.
 *     - Players not in our pool get auto-valued (full engine when stats exist,
 *       crude level/age fallback otherwise) and appended to players.json.
 *     - Cash considerations are detected from descriptions; reported amounts
 *       come from data-sources/cash-manual.json and count toward side totals.
 *  3. Flag traded players -> docs/data/traded.json (+ bake into players.json).
 */
const fs = require('fs');
const path = require('path');
const api = require('./mlb-api.js');
const E = require('./engine.js');
const CFG = require('../config.json');

const OUT = path.join(__dirname, '..', 'docs', 'data');
const cashPath = path.join(__dirname, '..', 'data-sources', 'cash-manual.json');
const CASH = fs.existsSync(cashPath) ? (JSON.parse(fs.readFileSync(cashPath, 'utf8')).entries || []) : [];

function groupTrades(txs) {
  const groups = new Map();
  (txs || []).forEach(t => {
    if (t.typeCode !== 'TR') return;
    const key = t.date + '|' + (t.description || '').slice(0, 140);
    if (!groups.has(key)) groups.set(key, { date: t.date, desc: t.description || '', sides: new Map(), cashHint: false });
    const g = groups.get(key);
    if (/cash/i.test(t.description || '')) g.cashHint = true;
    if (!t.person || !t.toTeam) return;
    const teamKey = t.toTeam.id;
    if (!g.sides.has(teamKey)) g.sides.set(teamKey, { teamId: t.toTeam.id, team: t.toTeam.name, gets: [] });
    g.sides.get(teamKey).gets.push({ id: t.person.id, name: t.person.fullName, from: t.fromTeam ? t.fromTeam.name : null });
  });
  return [...groups.values()].filter(g => g.sides.size >= 2);
}

function verdictFor(ratio) {
  if (ratio == null) return { label: 'Unvalued', cls: 'na' };
  if (ratio >= 0.9 && ratio <= 1.25) return { label: 'Balanced', cls: 'fair' };
  if ((ratio >= 0.6 && ratio < 0.9) || (ratio > 1.25 && ratio <= 1.6)) return { label: 'Slight edge', cls: 'edge' };
  return { label: 'Lopsided', cls: 'lop' };
}

function cashFor(g, side) {
  // Manual reported amounts first; else unreported cash hint (value 0, shown).
  let m = null;
  CASH.forEach(e => {
    if (!e.match || !e.toTeam) return;
    if (g.desc.toLowerCase().includes(String(e.match).toLowerCase()) &&
        side.team.toLowerCase().includes(String(e.toTeam).toLowerCase())) m = (m || 0) + (e.cashM || 0);
  });
  if (m != null) return { cashM: m, tv: Math.round(m * (CFG.sv.tv.cashPtsPerM || 0.5) * 10) / 10, known: true };
  return null;
}

// Auto-value a player the pool doesn't know (full engine; crude fallback).
async function autoValue(id, name, fromTeam, lg) {
  try {
    const per = ((await api.person(id)) || {}).people?.[0] || {};
    const p = {
      id, name: per.fullName || name,
      teamId: fromTeam ? fromTeam.id : 0, teamName: fromTeam ? fromTeam.name : '?',
      pos: (per.primaryPosition && per.primaryPosition.abbreviation) || 'OF',
      age: per.currentAge, debut: per.mlbDebutDate,
      bats: per.batSide && per.batSide.code, throws: per.pitchHand && per.pitchHand.code,
    };
    const { valuePlayer } = require('./build-data.js');
    const v = await valuePlayer(p, lg);
    if (v.tv == null) {
      // Crude fallback: level + age (no usable stats anywhere).
      const cf = CFG.sv.tv.crudeFallback || {};
      let tv = cf[v.topLevel || 'A'] ?? 3;
      if ((p.age || 30) <= 23) tv += cf.youngBonusU23 || 0;
      v.tv = Math.round(tv * 10) / 10;
      v.crude = true;
    }
    v.autoAdded = true;
    return v;
  } catch (e) { console.warn('  ! autoValue failed:', name, e.message); return null; }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const playersPath = path.join(OUT, 'players.json');
  const byId = new Map();
  let doc = null;
  if (fs.existsSync(playersPath)) {
    doc = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    doc.players.forEach(p => byId.set(p.id, p));
  } else console.warn('players.json missing — feed will be unvalued until build-data runs.');

  // Auto-valued players from previous runs (players.json is rebuilt daily and
  // drops them, so without this every past trade re-triggers API lookups).
  const autoPath = path.join(OUT, 'auto-players.json');
  const autoOut = new Map();
  if (fs.existsSync(autoPath)) {
    try {
      (JSON.parse(fs.readFileSync(autoPath, 'utf8')).players || []).forEach(p => {
        autoOut.set(p.id, p);
        if (!byId.has(p.id)) byId.set(p.id, p);
      });
    } catch (e) { /* rebuild from scratch */ }
  }

  const end = new Date().toISOString().slice(0, 10);
  console.log(`Transactions ${CFG.feedSince} -> ${end}…`);
  const d = await api.transactions(CFG.feedSince, end);
  const trades = groupTrades(d && d.transactions);
  console.log(`  ${trades.length} trades found.`);

  const lg = E.defaultBaselines();
  const tradedIds = new Set();
  const feed = [];
  for (const g of trades) {
    const sides = [];
    for (const s of g.sides.values()) {
      let total = 0, valued = 0;
      const players = [];
      for (const pl of s.gets) {
        tradedIds.add(pl.id);
        let v = byId.get(pl.id);
        if (!v) {
          v = await autoValue(pl.id, pl.name, pl.from ? { id: 0, name: pl.from } : null, lg);
          if (v) { byId.set(v.id, v); autoOut.set(v.id, v); console.log(`  + auto-valued ${v.name} (tv ${v.tv}${v.crude ? ', crude' : ''})`); }
        }
        if (v && v.tv != null) { total += v.tv; valued++; }
        players.push({ id: pl.id, name: pl.name, pos: v ? v.pos : '', tv: v ? v.tv : null,
          rem: v ? v.rem : null, prospect: v ? !!v.prospect : undefined,
          top100: v ? v.top100 : undefined, crude: v && v.crude || undefined });
      }
      const side = { team: s.team, teamId: s.teamId, players, coverage: players.length ? valued / players.length : 0 };
      const cash = cashFor(g, side);
      if (cash) { side.cashM = cash.cashM; total += cash.tv; }
      side.total = Math.round(total * 10) / 10;
      sides.push(side);
    }
    sides.sort((a, b) => b.total - a.total);
    const fullCover = sides.every(x => x.coverage >= 0.99 && x.players.length);
    const ratio = fullCover && sides[1].total > 0 ? Math.round(sides[0].total / sides[1].total * 100) / 100 : null;
    feed.push({ date: g.date, desc: g.desc, sides, ratio, verdict: verdictFor(ratio),
      cashUnknown: g.cashHint && !sides.some(x => x.cashM != null) || undefined });
  }
  feed.sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(path.join(OUT, 'feed.json'), JSON.stringify({ updated: new Date().toISOString(), since: CFG.feedSince, trades: feed }));
  fs.writeFileSync(autoPath, JSON.stringify({ updated: new Date().toISOString(), players: [...autoOut.values()] }));
  fs.writeFileSync(path.join(OUT, 'traded.json'), JSON.stringify({ updated: new Date().toISOString(), ids: [...tradedIds] }));

  if (doc) {
    let flagged = 0;
    byId.forEach(p => { if (tradedIds.has(p.id) && !p.traded) { p.traded = true; flagged++; } });
    doc.players = [...byId.values()].sort((a, b) => (b.tv || 0) - (a.tv || 0));
    fs.writeFileSync(playersPath, JSON.stringify(doc));
    console.log(`  flagged ${flagged} newly traded; pool now ${doc.players.length}.`);
  }
  console.log(`DONE: feed ${feed.length} trades.`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { groupTrades, verdictFor, cashFor };
