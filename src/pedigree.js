// Prospect pedigree that survives graduation.
//
// Ranking lists only carry prospect-ELIGIBLE players, so the day a top prospect
// graduates his pedigree vanishes from the data — exactly when the model needs
// it to tell "struggling former #3 overall" from "struggling org filler".
// This keeps a permanent best-ever record, updated on every build.
//
// data-sources/pedigree.json
//   manual  : your overrides, for players who graduated before tracking began.
//             Value is a grade ("elite" | "strong" | "solid" | "fringe") or an
//             object like { top100: 3 } if you know the actual rank.
//   players : auto-captured, keyed by normalized name. Never downgraded.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data-sources', 'pedigree.json');
// Grades map onto the same scale as a published top-100 rank, so a graded
// player and a captured one flow through identical anchor math.
const GRADES = { elite: 5, strong: 20, solid: 50, fringe: 90 };

const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { manual: {}, players: {} }; }
}

// Best (lowest) rank wins; null never overwrites a real number.
const better = (a, b) => (a == null) ? b : (b == null) ? a : Math.min(a, b);

/**
 * Fold today's ranking lists into the permanent record.
 * @param {Array} ranked  [{name, top100, org, tier, season}]
 */
function capture(ranked, season) {
  const db = load();
  db.players = db.players || {};
  (ranked || []).forEach(r => {
    const k = norm(r.name);
    if (!k) return;
    const cur = db.players[k] || { name: r.name };
    cur.name = cur.name || r.name;
    cur.top100 = better(cur.top100, r.top100 != null ? +r.top100 : null);
    cur.org = better(cur.org, r.org != null ? +r.org : null);
    cur.tier = better(cur.tier, r.tier != null ? +r.tier : null);
    if (cur.first == null) cur.first = season;
    cur.last = season;
    db.players[k] = cur;
  });
  db.updated = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2) + '\n');
  return db;
}

/**
 * What we know about a player's pedigree, manual overrides winning.
 * Returns null when he was never a ranked prospect — the common case, and the
 * reason ordinary struggling players get no protection at all.
 */
function lookup(db, name) {
  if (!db) return null;
  const k = norm(name);
  let out = null;
  const auto = (db.players || {})[k];
  if (auto && (auto.top100 != null || auto.org != null || auto.tier != null)) {
    out = { top100: auto.top100 ?? null, org: auto.org ?? null, tier: auto.tier ?? null, src: 'auto' };
  }
  const man = Object.keys(db.manual || {}).find(n => norm(n) === k);
  if (man) {
    const v = db.manual[man];
    const m = (typeof v === 'string')
      ? { top100: GRADES[String(v).toLowerCase()] ?? null }
      : (v || {});
    out = {
      top100: m.top100 != null ? +m.top100 : (out && out.top100),
      org: m.org != null ? +m.org : (out && out.org) || null,
      tier: m.tier != null ? +m.tier : (out && out.tier) || null,
      src: 'manual',
    };
    if (out.top100 == null) out.top100 = null;
  }
  return (out && (out.top100 != null || out.org != null || out.tier != null)) ? out : null;
}

module.exports = { load, capture, lookup, norm, GRADES, FILE };
