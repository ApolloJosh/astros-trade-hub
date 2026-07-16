/**
 * MLB transaction monitor:
 *  1. Pull the official trade log since config.feedSince.
 *  2. Group into trades, attach our Trade Values -> docs/data/feed.json
 *     (every trade as a value equation with a balance verdict).
 *  3. Flag traded players -> docs/data/traded.json (site excludes them;
 *     next build-data run bakes the flag into players.json).
 */
const fs = require('fs');
const path = require('path');
const api = require('./mlb-api.js');
const CFG = require('../config.json');

const OUT = path.join(__dirname, '..', 'docs', 'data');

function groupTrades(txs) {
  // One trade = same date + same description; sides keyed by receiving team.
  const groups = new Map();
  (txs || []).forEach(t => {
    if (t.typeCode !== 'TR' || !t.person || !t.toTeam) return;
    const key = t.date + '|' + (t.description || '').slice(0, 140);
    if (!groups.has(key)) groups.set(key, { date: t.date, desc: t.description || '', sides: new Map() });
    const g = groups.get(key);
    const teamKey = t.toTeam.id;
    if (!g.sides.has(teamKey)) g.sides.set(teamKey, { teamId: t.toTeam.id, team: t.toTeam.name, gets: [] });
    g.sides.get(teamKey).gets.push({
      id: t.person.id, name: t.person.fullName,
      from: t.fromTeam ? t.fromTeam.name : null,
    });
  });
  return [...groups.values()].filter(g => g.sides.size >= 2);
}

function verdictFor(ratio) {
  if (ratio == null) return { label: 'Unvalued', cls: 'na' };
  if (ratio >= 0.9 && ratio <= 1.25) return { label: 'Balanced', cls: 'fair' };
  if (ratio >= 0.6 && ratio < 0.9) return { label: 'Slight edge', cls: 'edge' };
  if (ratio > 1.25 && ratio <= 1.6) return { label: 'Slight edge', cls: 'edge' };
  return { label: 'Lopsided', cls: 'lop' };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const playersPath = path.join(OUT, 'players.json');
  const byId = new Map();
  if (fs.existsSync(playersPath)) {
    JSON.parse(fs.readFileSync(playersPath, 'utf8')).players.forEach(p => byId.set(p.id, p));
  } else console.warn('players.json missing — feed will be unvalued until build-data runs.');

  const end = new Date().toISOString().slice(0, 10);
  console.log(`Transactions ${CFG.feedSince} -> ${end}…`);
  const d = await api.transactions(CFG.feedSince, end);
  const trades = groupTrades(d && d.transactions);
  console.log(`  ${trades.length} trades found.`);

  const tradedIds = new Set();
  const feed = trades.map(g => {
    const sides = [...g.sides.values()].map(s => {
      let total = 0, valued = 0;
      const players = s.gets.map(p => {
        const v = byId.get(p.id);
        tradedIds.add(p.id);
        if (v && v.tv != null) { total += v.tv; valued++; }
        return { id: p.id, name: p.name, pos: v ? v.pos : '', tv: v ? v.tv : null,
          prospect: v ? !!v.prospect : undefined, top100: v ? v.top100 : undefined };
      });
      return { team: s.team, teamId: s.teamId, players, total: Math.round(total * 10) / 10,
        coverage: players.length ? valued / players.length : 0 };
    }).sort((a, b) => b.total - a.total);
    const fullCover = sides.every(s => s.coverage >= 0.99) && sides.every(s => s.players.length);
    const ratio = fullCover && sides[1].total > 0 ? sides[0].total / sides[1].total : null;
    return { date: g.date, desc: g.desc, sides,
      ratio: ratio != null ? Math.round(ratio * 100) / 100 : null,
      verdict: verdictFor(ratio) };
  }).sort((a, b) => b.date.localeCompare(a.date));

  fs.writeFileSync(path.join(OUT, 'feed.json'), JSON.stringify({ updated: new Date().toISOString(), since: CFG.feedSince, trades: feed }));
  fs.writeFileSync(path.join(OUT, 'traded.json'), JSON.stringify({ updated: new Date().toISOString(), ids: [...tradedIds] }));

  // Bake flags into players.json immediately (don't wait for next full build)
  if (byId.size) {
    let flagged = 0;
    byId.forEach(p => { if (tradedIds.has(p.id) && !p.traded) { p.traded = true; flagged++; } });
    const doc = JSON.parse(fs.readFileSync(playersPath, 'utf8'));
    doc.players = [...byId.values()].sort((a, b) => (b.tv || 0) - (a.tv || 0));
    fs.writeFileSync(playersPath, JSON.stringify(doc));
    console.log(`  flagged ${flagged} newly traded players.`);
  }
  console.log(`DONE: feed ${feed.length} trades, ${tradedIds.size} players flagged TRADED.`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { groupTrades, verdictFor };
