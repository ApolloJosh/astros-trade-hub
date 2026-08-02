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
// Stated club needs, used to explain why a lopsided deal still made sense.
const needsPath = path.join(OUT, 'team-needs.json');
const NEEDS = (() => {
  try { const n = JSON.parse(fs.readFileSync(needsPath, 'utf8')); return n.teams || n; }
  catch (e) { return {}; }
})();
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
    const side = g.sides.get(teamKey);
    // The API sometimes repeats the same transaction row — never count a player twice.
    if (side.gets.some(x => x.id === t.person.id)) return;
    side.gets.push({ id: t.person.id, name: t.person.fullName, from: t.fromTeam ? t.fromTeam.name : null });
  });
  return [...groups.values()].filter(g => g.sides.size >= 2);
}

// Why a trade came out uneven on our numbers. Plenty of real trades ARE
// lopsided by surplus value and still make sense: clubs value players
// differently, they bet on development, and a team in a race will pay over the
// odds for the piece it needs. A bare "Lopsided" implies someone got fleeced,
// which is usually the wrong read — so we say what the shape of the deal was.
/**
 * Package stacking — the same rule the Trade Builder applies via PKG_W.
 *
 * Value does not aggregate linearly. A club receiving four useful prospects is
 * not getting the sum of four useful prospects: there are only so many roster
 * spots and only the best piece really moves the needle. So sort by value and
 * taper each subsequent player.
 *
 * Liabilities are exempt. A bad contract stays a full drag no matter how many
 * of them you take on — bulk doesn't make them cheaper.
 */
const PKG_W = (CFG.sv && CFG.sv.tv && CFG.sv.tv.pkgWeights) || [1, 0.74, 0.52, 0.36, 0.25, 0.17, 0.11, 0.07];
const NEED_MULT = (CFG.sv && CFG.sv.tv && CFG.sv.tv.needMult) || 1.08;

/**
 * Side value, mirroring the Trade Builder's effList().
 *
 * Two adjustments on top of raw surplus:
 *
 *  1. STACKING — sorted by value, each subsequent piece counts for less. Five
 *     decent prospects aren't a star; a roster only has so many spots.
 *
 *  2. FIT — a club acquiring an established big leaguer at the deadline is,
 *     by revealed preference, filling a hole. Nobody trades prospects in July
 *     for a player they don't need. Raw surplus value can't see that, so an
 *     acquired MLB player carries a small premium. Prospects don't: they're a
 *     bet on later, not a hole being filled now.
 *
 * Liabilities are exempt from both — a bad contract is a full drag, and no
 * one takes one on because it "fits".
 */
function stackedTotal(items) {
  const rows = items.map(x => (typeof x === 'number' ? { tv: x, prospect: false } : x))
    .filter(r => r && r.tv != null);
  const pos = rows.filter(r => r.tv > 0).sort((a, b) => b.tv - a.tv);
  const neg = rows.filter(r => r.tv <= 0);
  let t = 0;
  pos.forEach((r, i) => {
    const fit = r.prospect ? 1 : NEED_MULT;
    t += r.tv * PKG_W[Math.min(i, PKG_W.length - 1)] * fit;
  });
  neg.forEach(r => { t += r.tv; });
  return t;
}

/**
 * Ordering.
 *
 * MLB's transaction API dates trades to the day, with no clock time, so several
 * deals on deadline day are indistinguishable by date alone and drift around
 * between builds. Instead we record when OUR pipeline first saw each trade and
 * carry that forward, so the newest thing on the wire stays pinned to the top.
 * A reported trade can override it with an explicit `at` timestamp.
 */
function tradeKey(t) {
  return (t.date || '') + '|' + String(t.desc || '').slice(0, 140);
}
function readFirstSeen() {
  const m = new Map();
  try {
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'feed.json'), 'utf8'));
    (prev.trades || []).forEach(t => { if (t.firstSeen) m.set(tradeKey(t), t.firstSeen); });
  } catch (e) {}
  return m;
}

function reasonsFor(sides, teamNeeds) {
  const R = [];
  const heavy = sides[0], light = sides[sides.length - 1];
  const all = s => (s && s.players) || [];
  // Absorbing a negative-value contract to land the player they wanted.
  const absorbed = all(heavy).filter(p => p.tv != null && p.tv < 0);
  if (absorbed.length) {
    R.push(`taking on ${absorbed.length > 1 ? 'bad contracts' : `${absorbed[0].name}'s contract`} to get the player they wanted`);
  }
  // A rental: almost no surplus left, but a pennant race doesn't care.
  const rentals = all(light).concat(all(heavy)).filter(p => p.ctrl != null && p.ctrl <= 1 && p.tv != null && p.tv > 0 && !p.prospect);
  if (rentals.length) R.push(`renting ${rentals[0].name} for the stretch run`);
  // Prospect-heavy return = a bet on development, not on this season.
  const pros = all(light).filter(p => p.prospect);
  if (pros.length && pros.length === all(light).length && all(light).length) {
    R.push('betting on prospects who have not proven it yet');
  }
  // Filling a stated need is worth a premium the model does not price.
  const need = teamNeeds && teamNeeds[heavy.team];
  if (need && need.length) {
    const got = all(heavy).map(p => String(p.pos || ''));
    const hit = need.find(n => got.some(pos =>
      n === pos || (n === 'OF' && /LF|CF|RF|OF/.test(pos)) || (n === 'SP' && /^S?P$/.test(pos)) ||
      (n === 'RP' && /^R?P$/.test(pos)) || (n === 'BAT' && pos && !/P$/.test(pos))));
    if (hit) R.push(`fills a stated need at ${hit}`);
  }
  return R;
}

/**
 * Reported-but-not-yet-official trades.
 *
 * MLB's transaction log is the source of truth for the feed, but it lags the
 * reporting by hours — on deadline day that's the whole story missing. These
 * are hand-entered from data-sources/reported-trades.json, valued with the same
 * engine, and flagged so nobody mistakes them for filed transactions.
 *
 * They remove themselves two ways: when an official trade shows up sharing any
 * player (the deal went through, so the real record wins), or once they pass
 * staleDays without ever being confirmed.
 */
const reportedPath = path.join(__dirname, '..', 'data-sources', 'reported-trades.json');
const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

function buildReported(byId, teamIdByName, cfgOverride) {
  let cfg = cfgOverride;
  if (!cfg) {
    try { cfg = JSON.parse(fs.readFileSync(reportedPath, 'utf8')); }
    catch (e) { return []; }
  }
  const list = (cfg && cfg.trades) || [];
  if (!list.length) {
    // Easy mistake: filling in a documentation key instead of the live array.
    Object.keys(cfg || {}).forEach(k => {
      const v = cfg[k];
      if (k !== 'trades' && v && (Array.isArray(v.sides) || (Array.isArray(v) && v[0] && v[0].sides))) {
        console.warn(`  reported-trades.json: found a trade under "${k}" — only the "trades" array is read. Move it there.`);
      }
    });
    return [];
  }

  const byName = new Map();
  byId.forEach(p => { const k = norm(p.name); if (k && !byName.has(k)) byName.set(k, p); });

  const staleMs = (cfg.staleDays != null ? cfg.staleDays : 4) * 86400000;
  const out = [];
  list.forEach((t, i) => {
    if (!t || !Array.isArray(t.sides) || t.sides.length < 2) {
      console.warn(`  reported[${i}]: needs at least two sides — skipped`); return;
    }
    if (t.date && Date.now() - Date.parse(t.date) > staleMs) {
      console.warn(`  reported[${i}] (${t.date}): older than staleDays and never confirmed — dropped`); return;
    }
    const sides = [];
    let missing = 0;
    for (const s of t.sides) {
      const players = [];
      const tvs = [];
      let valued = 0;
      (s.gets || []).forEach(nm => {
        const p = byName.get(norm(nm));
        if (!p) { missing++; console.warn(`  reported[${i}]: no player named "${nm}" in the pool`);
          players.push({ id: null, name: String(nm), pos: '', tv: null }); return; }
        if (p.tv != null) { tvs.push({ tv: p.tv, prospect: !!p.prospect }); valued++; }
        players.push({ id: p.id, name: p.name, pos: p.pos, tv: p.tv, age: p.age, bt: p.bt,
          ctrl: p.ctrl, prospect: p.prospect || undefined, orgRank: p.orgRank, top100: p.top100 });
      });
      // Same package stacking the official feed and the builder use.
      sides.push({ team: s.team, teamId: teamIdByName.get(norm(s.team)) || null, players,
        coverage: players.length ? valued / players.length : 0,
        total: Math.round(stackedTotal(tvs) * 10) / 10,
        rawTotal: Math.round(tvs.reduce((a, b) => a + b.tv, 0) * 10) / 10 });
    }
    // Every side needs at least one player we can actually value. A typo that
    // resolves nothing would otherwise publish an empty card mid-broadcast.
    const thin = sides.filter(s => !s.players.some(p => p.id));
    if (thin.length) {
      console.warn(`  reported[${i}]: no known players on the ${thin.map(s => s.team).join(' / ')} side — skipped`);
      return;
    }
    sides.sort((a, b) => b.total - a.total);
    const fullCover = sides.every(x => x.coverage >= 0.99 && x.players.length);
    const ratio = fullCover && sides[1].total > 0
      ? Math.round(sides[0].total / sides[1].total * 100) / 100 : null;
    const desc = sides.map(s => `${s.team} receive ${s.players.map(p => p.name).join(', ')}`).join('; ');
    out.push({
      date: t.date || new Date().toISOString().slice(0, 10),
      // "at": "2026-08-02T19:40:00Z" pins it to the minute the scoop landed.
      at: t.at || undefined,
      desc: t.note || desc, sides, ratio,
      verdict: verdictFor(ratio, false, sides, NEEDS),
      reported: true, source: t.source || null,
      unresolved: missing || undefined,
    });
  });
  return out;
}

// A reported trade is confirmed the moment an official one shares any player.
function dropConfirmed(official, reported) {
  if (!reported.length) return reported;
  const officialIds = new Set();
  official.forEach(t => (t.sides || []).forEach(s =>
    (s.players || []).forEach(p => { if (p.id) officialIds.add(p.id); })));
  return reported.filter(t => {
    const ids = [];
    (t.sides || []).forEach(s => (s.players || []).forEach(p => { if (p.id) ids.push(p.id); }));
    const hit = ids.find(id => officialIds.has(id));
    if (hit) console.log(`  reported "${t.desc.slice(0, 60)}" is now official — dropped`);
    return !hit;
  });
}

function verdictFor(ratio, dump, sides, teamNeeds) {
  const why = sides ? reasonsFor(sides, teamNeeds) : [];
  const tag = (label, cls) => {
    const v = { label, cls };
    if (why.length) { v.why = why; v.detail = `${label} — ${why.join('; ')}`; }
    return v;
  };
  // One side taking on negative value = a salary dump, not a talent swap.
  if (dump) return tag('Salary dump', 'edge');
  if (ratio == null) return { label: 'Unvalued', cls: 'na' };
  if (ratio >= 0.9 && ratio <= 1.25) return tag('Balanced', 'fair');
  if ((ratio >= 0.6 && ratio < 0.9) || (ratio > 1.25 && ratio <= 1.6)) return tag('Slight edge', 'edge');
  return tag('Lopsided', 'lop');
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
  // Cached values are only valid for the model that produced them. Any change
  // to the valuation knobs invalidates them, otherwise old numbers (every
  // prospect stuck at the old cap) survive forever.
  const modelSig = JSON.stringify(CFG.sv.tv).length + ':' +
    [CFG.sv.tv.unrankedProspectCap, CFG.sv.tv.min, CFG.sv.tv.mlbFloor, CFG.sv.tv.floor,
     JSON.stringify(CFG.sv.tv.unrankedCapByLevel)].join('|');
  if (fs.existsSync(autoPath)) {
    try {
      const doc2 = JSON.parse(fs.readFileSync(autoPath, 'utf8'));
      if (doc2.modelSig === modelSig) {
        (doc2.players || []).forEach(p => {
          autoOut.set(p.id, p);
          if (!byId.has(p.id)) byId.set(p.id, p);
        });
      } else console.log('Model changed — re-valuing auto-added players from scratch.');
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
      let valued = 0;
      const tvs = [];
      const players = [];
      for (const pl of s.gets) {
        tradedIds.add(pl.id);
        let v = byId.get(pl.id);
        if (!v) {
          v = await autoValue(pl.id, pl.name, pl.from ? { id: 0, name: pl.from } : null, lg);
          if (v) { byId.set(v.id, v); autoOut.set(v.id, v); console.log(`  + auto-valued ${v.name} (tv ${v.tv}${v.crude ? ', crude' : ''})`); }
        }
        if (v && v.tv != null) { tvs.push({ tv: v.tv, prospect: !!v.prospect }); valued++; }
        // Baseball facts, not projected salary. "Owed" only means something for
        // real guaranteed money, so it's flagged separately below.
        const bigDeal = v && v.salSource === 'cots' && (v.rem || 0) >= (CFG.feedOwedMin || 15) && !v.prospect;
        players.push({ id: pl.id, name: pl.name, pos: v ? v.pos : '', tv: v ? v.tv : null,
          age: v ? v.age : undefined, bt: v ? v.bt : undefined,
          level: v && v.prospect ? v.topLevel : undefined,
          orgRank: v ? v.orgRank : undefined, top100: v ? v.top100 : undefined,
          ctrl: v ? v.ctrl : undefined,   // lets the verdict spot a rental
          il: v ? v.il : undefined,
          owed: bigDeal ? v.rem : undefined,
          prospect: v ? !!v.prospect : undefined, crude: v && v.crude || undefined });
      }
      const side = { team: s.team, teamId: s.teamId, players, coverage: players.length ? valued / players.length : 0 };
      const cash = cashFor(g, side);
      // Stack the players, then add cash — cash isn't a roster spot, so it
      // takes no package discount.
      let total = stackedTotal(tvs);
      const rawTotal = tvs.reduce((a, b) => a + b.tv, 0);
      if (cash) { side.cashM = cash.cashM; total += cash.tv; }
      side.total = Math.round(total * 10) / 10;
      // Kept for the calibration report: how much the stacking rule moved it.
      side.rawTotal = Math.round((rawTotal + (cash ? cash.tv : 0)) * 10) / 10;
      sides.push(side);
    }
    sides.sort((a, b) => b.total - a.total);
    const fullCover = sides.every(x => x.coverage >= 0.99 && x.players.length);
    const dump = fullCover && sides.some(x => x.total <= 0);
    const ratio = fullCover && sides[1].total > 0 ? Math.round(sides[0].total / sides[1].total * 100) / 100 : null;
    feed.push({ date: g.date, desc: g.desc, sides, ratio, dump: dump || undefined,
      verdict: verdictFor(ratio, dump, sides, NEEDS),
      cashUnknown: g.cashHint && !sides.some(x => x.cashM != null) || undefined });
  }
  // Hand-entered scoops, minus any the official log has since confirmed.
  const teamIdByName = new Map();
  byId.forEach(p => {
    if (!p.team || !p.teamId) return;
    const k = norm(p.team); if (!teamIdByName.has(k)) teamIdByName.set(k, p.teamId);
    const short = norm(String(p.team).split(' ').pop());
    if (short && !teamIdByName.has(short)) teamIdByName.set(short, p.teamId);
  });
  const reported = dropConfirmed(feed, buildReported(byId, teamIdByName));
  if (reported.length) console.log(`  + ${reported.length} reported (unofficial) trade(s)`);
  feed.push(...reported);

  // Stamp each trade with when we first saw it, reusing the previous run's
  // value so ordering is stable rather than reshuffling on every build.
  const seen = readFirstSeen();
  const nowIso = new Date().toISOString();
  feed.forEach(t => {
    const k = tradeKey(t);
    // `at` lets a reported scoop carry the minute it actually broke.
    const stamp = t.at || seen.get(k) || nowIso;
    t.firstSeen = stamp;
    if (!seen.has(k)) seen.set(k, stamp);
  });
  // Newest first by first-seen; date breaks ties (notably the first run after
  // this shipped, when everything shares a timestamp).
  feed.sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)) ||
    b.date.localeCompare(a.date) ||
    ((a.reported ? 1 : 0) - (b.reported ? 1 : 0)));   // official first within a tie

  fs.writeFileSync(path.join(OUT, 'feed.json'), JSON.stringify({ updated: new Date().toISOString(), since: CFG.feedSince, trades: feed }));
  fs.writeFileSync(autoPath, JSON.stringify({ updated: new Date().toISOString(), modelSig, players: [...autoOut.values()] }));
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
module.exports = { groupTrades, verdictFor, cashFor, buildReported, dropConfirmed, norm };
