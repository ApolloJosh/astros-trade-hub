/**
 * Merge freshly released top-30 lists into the per-team ranking files.
 *   1. Put the new lists in data-sources/rankings-incoming.json, shaped as:
 *        { "astros": [{ "name": "Kevin Alvarez", "pos": "OF" }, ... 30 ],
 *          "redsox": [ ... ], ... }               (order = rank 1..N)
 *      Names-only arrays also work:  { "astros": [["Kevin Alvarez","OF"], ...] }
 *   2. Run:  npm run merge-rankings
 *
 * The new list becomes ranks 1..N. Any player who was on the OLD list but isn't
 * on the new one is kept with rank:null — still in the pool, just unranked —
 * exactly as requested. mlbids from the old file are carried onto matching new
 * names so we don't re-resolve them.
 */
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data-sources', 'rankings');
const IN = path.join(__dirname, '..', 'data-sources', 'rankings-incoming.json');
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
// Same player if names match exactly, or one is a prefix of the other (handles
// truncated vs. full names like "Avery Owusu" / "Avery Owusu-Asiedu").
const sameName = (a, b) => {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  return na.length >= 9 && nb.length >= 9 && (na.startsWith(nb) || nb.startsWith(na));
};

if (!fs.existsSync(IN)) { console.error('Missing data-sources/rankings-incoming.json'); process.exit(1); }
const incoming = JSON.parse(fs.readFileSync(IN, 'utf8'));

let teams = 0, rankedTot = 0, carriedTot = 0;
for (const [slug, listRaw] of Object.entries(incoming)) {
  if (slug.startsWith('_') || !Array.isArray(listRaw) || !listRaw.length) continue;
  const file = path.join(DIR, slug + '.json');
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { team: slug, prospects: [] };
  const oldByName = new Map((old.prospects || []).map(p => [norm(p.name), p]));

  const oldList = old.prospects || [];
  const list = listRaw.map((p, i) => {
    const name = (p.name || p[0] || '').trim();
    const pos = (p.pos || p[1] || '').trim() || undefined;
    const o = oldList.find(x => sameName(x.name, name));
    return { rank: i + 1, name, pos: pos || (o && o.pos) || undefined, mlbid: p.mlbid || (o && o.mlbid) || undefined };
  }).filter(p => p.name);

  if (slug === 'top100') {                       // no "unranked" concept — just replace
    fs.writeFileSync(file, JSON.stringify({ team: 'top100', updated: today(), prospects: list }, null, 2));
    console.log(`top100: ${list.length} ranked`);
    continue;
  }

  const newIds = new Set(list.filter(p => p.mlbid).map(p => p.mlbid));
  const carried = oldList
    .filter(p => !list.some(n => sameName(n.name, p.name)) && !(p.mlbid && newIds.has(p.mlbid)))
    .map(p => ({ rank: null, name: p.name, pos: p.pos, mlbid: p.mlbid }));

  fs.writeFileSync(file, JSON.stringify({
    team: old.team || slug, teamId: old.teamId, updated: today(),
    prospects: list.concat(carried),
  }, null, 2));
  teams++; rankedTot += list.length; carriedTot += carried.length;
  console.log(`${slug}: ${list.length} ranked, ${carried.length} carried unranked`);
}
console.log(`\nDone. ${teams} teams, ${rankedTot} ranked, ${carriedTot} preserved unranked.`);
console.log('Next: npm run build  (or trigger the Action) to re-value with the new ranks.');

function today() { return new Date().toISOString().slice(0, 10); }
