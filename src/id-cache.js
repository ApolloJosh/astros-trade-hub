// Persistent name -> MLBID (+person basics) cache, committed by the Action.
// Kills the ~1,500 identical people/search + people/{id} calls every build made:
// after the first run, only brand-new names hit the API. Person meta (age, team)
// is considered fresh for 30 days; the id itself never expires.
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data-sources', 'id-cache.json');
const FRESH_DAYS = 30;

let cache = {};
try { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* first run */ }

const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

const get = name => cache[norm(name)] || null;
const fresh = e => !!(e && e.ts && (Date.now() - e.ts) < FRESH_DAYS * 864e5);
function put(name, rec) { cache[norm(name)] = Object.assign({}, cache[norm(name)], rec, { ts: Date.now() }); }
function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cache));
  console.log(`id-cache saved (${Object.keys(cache).length} names).`);
}

// Rebuild a person-like object from a cache entry (mirrors the API shape we use).
const asPerson = e => ({
  fullName: e.name, currentAge: e.age, mlbDebutDate: e.debut,
  batSide: e.bats ? { code: e.bats } : undefined,
  pitchHand: e.throws ? { code: e.throws } : undefined,
  primaryPosition: e.pos ? { abbreviation: e.pos } : undefined,
});
const fromPerson = (id, per, extra) => Object.assign({
  id, name: per.fullName, age: per.currentAge, debut: per.mlbDebutDate,
  bats: per.batSide && per.batSide.code, throws: per.pitchHand && per.pitchHand.code,
  pos: per.primaryPosition && per.primaryPosition.abbreviation,
}, extra || {});

module.exports = { get, put, save, fresh, asPerson, fromPerson, norm };
