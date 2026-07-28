/**
 * HISTORICAL TRADE CALIBRATION — backend only, run on demand:
 *     npm run calibrate:trades          (add --months=24 to widen the window)
 *
 * Premise: if two front offices agreed to a trade, both sides believed the
 * return was fair. So across many real trades the median ratio of
 * (bigger side / smaller side) should sit near 1.0. Where our model drifts
 * from that — overall or for a given archetype (rentals, controlled bats,
 * closers, prospect packages) — that's a knob to tune.
 *
 * Each player is valued with the stats he had AT THE TIME OF THE TRADE
 * (season of the trade + prior seasons only), never today's numbers.
 * Writes reports/trade-calibration.md. Never touches the public site.
 */
const fs = require('fs');
const path = require('path');
const api = require('./mlb-api.js');
const E = require('./engine.js');
const CFG = require('../config.json');
const { groupTrades } = require('./transactions.js');
const { median } = require('./calibrate.js');

const REPORTS = path.join(__dirname, '..', 'reports');
const CACHE = path.join(__dirname, '..', 'data-sources', 'trade-calibration-cache.json');
const months = (() => { const a = process.argv.find(x => x.startsWith('--months=')); return a ? +a.split('=')[1] : 12; })();

const isPitcherPos = pos => pos === 'P' || pos === 'SP' || pos === 'RP' || pos === 'LHP' || pos === 'RHP';

// Prospect ranks (current lists, used as a proxy for rank at trade time —
// far better than treating every traded prospect as unranked).
// Keyed by MLBID where the ranking files have one, and ALSO by normalized name
// so the other 29 team lists (pasted without IDs) still resolve — no id-cache
// dependency and no extra API calls.
const RANKS = new Map(), TOP100 = new Map();
const RANKS_N = new Map(), TOP100_N = new Map();
let normName = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
try {
  const R = require('./rankings.js');
  if (typeof R.norm === 'function') normName = R.norm;
  for (const f of fs.readdirSync(R.DIR)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(R.DIR, f), 'utf8'));
    (doc.prospects || []).forEach(p => {
      const n = normName(p.name);
      if (doc.team === 'top100') {
        if (p.mlbid) TOP100.set(p.mlbid, p.rank);
        if (n && !TOP100_N.has(n)) TOP100_N.set(n, p.rank);
      } else {
        if (p.mlbid && !RANKS.has(p.mlbid)) RANKS.set(p.mlbid, p.rank);
        if (n && !RANKS_N.has(n)) RANKS_N.set(n, p.rank);
      }
    });
  }
  console.log(`Prospect ranks loaded: ${RANKS_N.size} org + ${TOP100_N.size} top-100 (by name), ${RANKS.size} by id.`);
} catch (e) { console.warn('rankings unavailable:', e.message); }
const rankFor = (id, name) => RANKS.get(id) || RANKS_N.get(normName(name)) || null;
const top100For = (id, name) => TOP100.get(id) || TOP100_N.get(normName(name)) || null;

// Real contracts from Cot's, matched by name across all 30 clubs. Service-time
// ESTIMATES were badly overvaluing expensive veterans (Correa read 61.7 with
// his $110M invisible), which inflated the heavy side of many trades.
const COTS_N = new Map();
try {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-sources', 'salaries-cots.json'), 'utf8'));
  Object.values(c.teams || {}).forEach(list => (list || []).forEach(p => {
    const k = p.key || normName(p.name);
    if (k && !COTS_N.has(k)) COTS_N.set(k, p);
  }));
  console.log(`Real contracts loaded for ${COTS_N.size} players.`);
} catch (e) { console.warn('salaries-cots.json unavailable — falling back to service-time estimates.'); }
const contractFor = name => COTS_N.get(normName(name)) || null;
// Bump when the valuation path changes so stale cached values are discarded.
const CACHE_V = 8;
let cache = {};
try {
  const c = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  if (c._v === CACHE_V) cache = c;
} catch (e) {}
cache._v = CACHE_V;

// Minor-league line for `season`, translated to MLB equivalence the same way
// the daily pipeline does (level factors + bust risk). Without this, every
// prospect in a trade reads as a flat placeholder and skews the whole study.
async function milbBase(id, pitcher, pos, season, lg) {
  const levels = [[1, 1.0, 0, 0]].concat(CFG.prospect.levels);
  const rows = []; let topSport = null;
  for (const lv of levels) {
    const s = api.statOf(await api.seasonStatsSportYear(id, pitcher, lv[0], season));
    if (s) { rows.push({ s, f: lv[1], wp: lv[2] || 0, ep: lv[3] || 0 }); if (topSport == null) topSport = lv[0]; }
  }
  if (!rows.length) return null;
  const out = pitcher ? E.combinePitching(rows, lg) : E.combineHitting(rows, pos, lg);
  if (out && out.base) {
    const rk = CFG.sv.prospectRisk[String(topSport)];
    out.base.risk = rk != null ? rk : 0.5;
    out.topLevel = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'Rk' }[topSport] || '?';
  }
  return out;
}

// Value a player as of `season` (that season's line + earlier history only).
async function valueAt(id, season, lg) {
  const key = id + '@' + season;
  if (cache[key] !== undefined) return cache[key];
  let out = null;
  try {
    const per = ((await api.person(id)) || {}).people?.[0] || {};
    const pos = (per.primaryPosition && per.primaryPosition.abbreviation) || 'OF';
    const pitcher = isPitcherPos(pos);
    const age = (per.currentAge != null) ? per.currentAge - (CFG.season - season) : 28;

    // Career games BEFORE this season decide prospect status — a fringe rookie
    // must not be valued like an established big leaguer.
    const careerStat = api.statOf(await api.careerStats(id, pitcher));
    const careerG = careerStat ? E.toNum(careerStat.gamesPlayed, 0) : 0;

    const cur = api.statOf(await api.seasonStatsYear(id, pitcher, season));
    const yby = await api.yearByYear(id, pitcher);
    const splits = (yby && yby.stats && yby.stats[0] && yby.stats[0].splits) || [];
    const hist = splits
      .filter(s => +s.season < season && (!s.team || !s.sport || s.sport.id === 1))
      .slice(-3)
      .map(s => {
        const b = pitcher ? E.warPitcher(s.stat, lg) : E.warHitter(s.stat, pos, lg);
        return b ? { war: b.war, n: b.n, sp: b.sp, season: +s.season } : null;
      }).filter(Boolean);
    const prospect = careerG < (CFG.prospect.maxCareerG || 30);
    // No MLB line: value off his actual minor-league season (level-adjusted),
    // exactly like the live pipeline does for prospects.
    const orgRank = rankFor(id, per.fullName), top100 = top100For(id, per.fullName);
    if (!cur && prospect) {
      const c = await milbBase(id, pitcher, pos, season, lg);
      if (c && c.base) {
        let psv = E.valueFromBase(c.base, pitcher, age, 6, 0.8);
        psv = E.adjustProspectValue(psv, orgRank, true);
        if (psv) psv.ctrl = 6;
        const ptv = E.tradeValue2(psv, c.base, pitcher, age, orgRank, true, '', top100);
        if (ptv != null) {
          out = { tv: ptv, name: per.fullName, pos, pitcher, prospect: true, milb: true,
            ranked: !!(orgRank || top100), level: c.topLevel, rental: false, ctrl: 6, closer: false };
          cache[key] = out; return out;
        }
      }
    }
    if (!cur && !hist.length) { cache[key] = null; return null; }

    let base = cur ? (pitcher ? E.warPitcher(cur, lg) : E.warHitter(cur, pos, lg)) : null;
    if (base) base.hist = hist; else base = { war: 0, n: 0, sp: hist[0] && hist[0].sp, hist, histOnly: true };

    // Real contract when we have one (big-money penalties then fire properly);
    // service-time estimate only as a fallback.
    const cots = contractFor(per.fullName);
    const estOnly = E.estimateContract({ mlbDebutDate: per.mlbDebutDate }, season);
    const est = cots ? { control: cots.control, salM: cots.salaryM } : estOnly;
    let sv = E.valueFromBase(base, pitcher, age, est.control, est.salM);
    sv = E.adjustProspectValue(sv, orgRank, prospect);
    if (sv) { sv.ctrl = est.control; if (pitcher && base.sp === false && cur) sv.closerSv = E.toNum(cur.saves, 0); }
    const tv = E.tradeValue2(sv, base, pitcher, age, orgRank, prospect, '', top100);
    out = tv == null ? null : {
      tv, name: per.fullName, pos, pitcher, prospect, ranked: !!(orgRank || top100),
      realDeal: !!cots, salM: est.salM,
      rental: !prospect && est.control <= 1.5, ctrl: est.control,
      closer: pitcher && base.sp === false && E.toNum(cur && cur.saves, 0) >= 10,
      rookie: !!(per.mlbDebutDate && +String(per.mlbDebutDate).slice(0, 4) >= season - 1),
    };
  } catch (e) { out = null; }
  cache[key] = out;
  return out;
}

async function main() {
  const end = new Date();
  const start = new Date(end.getTime() - months * 30.5 * 864e5);
  const iso = d => d.toISOString().slice(0, 10);
  console.log(`Pulling trades ${iso(start)} -> ${iso(end)}…`);

  // month-sized windows keep responses manageable
  const txs = [];
  for (let d = new Date(start); d < end; d.setMonth(d.getMonth() + 1)) {
    const s = new Date(d), e2 = new Date(d); e2.setMonth(e2.getMonth() + 1);
    const r = await api.transactions(iso(s), iso(e2 > end ? end : e2));
    (r && r.transactions || []).forEach(t => txs.push(t));
  }
  const trades = groupTrades(txs);
  console.log(`  ${trades.length} trades found. Valuing both sides at time of trade…`);

  const lg = E.defaultBaselines();
  const rows = [];
  let done = 0;
  for (const g of trades) {
    const season = +String(g.date).slice(0, 4);
    const sides = [];
    let complete = true;
    for (const s of g.sides.values()) {
      const vals = [];
      for (const pl of s.gets) {
        const v = await valueAt(pl.id, season, lg);
        if (!v) { complete = false; break; }
        vals.push(v);
      }
      if (!complete) break;
      sides.push({ team: s.team, vals, total: Math.round(vals.reduce((a, v) => a + v.tv, 0) * 10) / 10 });
    }
    if (!complete || sides.length !== 2 || sides.some(s => !s.total)) continue;
    sides.sort((a, b) => b.total - a.total);
    rows.push({ date: g.date, desc: g.desc, hi: sides[0], lo: sides[1], ratio: Math.round(sides[0].total / sides[1].total * 100) / 100 });
    if (++done % 10 === 0) { console.log(`  ${done} valued`); fs.writeFileSync(CACHE, JSON.stringify(cache)); }
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));

  const all = rows.map(r => r.ratio);
  const med = median(all);
  const within = all.filter(r => r <= 1.25).length;
  // Veteran-only trades (no prospect guesswork at all).
  const vetOnly = rows.filter(r => ![...r.hi.vals, ...r.lo.vals].some(v => v.prospect));
  const vetMed = median(vetOnly.map(r => r.ratio));

  // THE key metric. "Real trades are balanced" is only true for talent-for-
  // talent swaps: salary dumps and depth/DFA-shuffle trades are genuinely
  // lopsided in talent, with money doing the balancing. Requiring a real piece
  // on BOTH sides isolates the deals that actually should come out even.
  const best = s => Math.max(...s.vals.map(v => v.tv), 0);
  const t4t = rows.filter(r => best(r.hi) >= 25 && best(r.lo) >= 25);
  const t4tMed = median(t4t.map(r => r.ratio));
  const t4tFair = t4t.filter(r => r.ratio <= 1.5).length;

  // Classify each trade ONCE, by its headliner (highest-valued player in the
  // deal). Overlapping buckets made every archetype read the same number.
  const headliner = r => [...r.hi.vals, ...r.lo.vals].reduce((a, v) => v.tv > a.tv ? v : a);
  const kindOf = r => {
    const h = headliner(r);
    if (h.prospect) return 'Prospect headliner';
    if (h.closer) return 'Closer headliner';
    if (h.rental) return 'Rental headliner';
    if (h.ctrl >= 4) return 'Controlled headliner (≥4y)';
    return 'Mid-control headliner';
  };
  const kinds = {};
  rows.forEach(r => { const k = kindOf(r); (kinds[k] = kinds[k] || []).push(r.ratio); });
  const buckets = Object.entries(kinds).map(([label, v]) => ({ label, n: v.length, med: median(v) }))
    .sort((a, b) => b.n - a.n);

  // The single best eyeball test: who are we saying is most valuable?
  const everyone = [];
  rows.forEach(r => [...r.hi.vals, ...r.lo.vals].forEach(v => everyone.push(v)));
  const topVals = [...everyone].sort((a, b) => b.tv - a.tv).slice(0, 15);
  const worst = [...rows].sort((a, b) => b.ratio - a.ratio).slice(0, 8);

  const sug = [];
  if (t4tMed != null) {
    if (t4tMed > 1.6) sug.push(`Talent-for-talent median ${t4tMed} — the SPREAD between good and mediocre players is too wide. Lower sv.tv.gamma (flattens the curve) and/or raise sv.tv.floor.`);
    else if (t4tMed < 1.1) sug.push(`Talent-for-talent median ${t4tMed} — spread may be too narrow; raise sv.tv.gamma.`);
    else sug.push(`Talent-for-talent median ${t4tMed} — the model is pricing real swaps well. This is the number that matters.`);
  } else sug.push('Not enough talent-for-talent trades in the window — widen with --months=24.');
  if (med != null) sug.push(`All-trades median ${med} is expected to run high: salary dumps and depth swaps are lopsided in talent by design.`);
  buckets.forEach(b => {
    if (b.n >= 4 && b.med != null && (b.med > 1.35 || b.med < 0.75)) {
      sug.push(`${b.label}: median ${b.med} across ${b.n} trades — ${b.med > 1 ? 'likely OVERvalued' : 'likely UNDERvalued'} by the model.`);
    }
  });

  const report = [
    `# Historical trade calibration — ${iso(end)}`,
    ``,
    `Window: last ${months} months · ${trades.length} trades found · ${rows.length} fully valued at time of trade.`,
    `Assumption: real trades are roughly balanced, so a healthy median is ~1.0-1.2.`,
    ``,
    `- **TALENT-FOR-TALENT (real piece both sides — the deals that SHOULD be even):**`,
    `  **median ${t4tMed ?? 'n/a'} across ${t4t.length} trades · ${t4t.length ? Math.round(t4tFair / t4t.length * 100) : 0}% within 1.5x**`,
    `- Established-players-only: median ${vetMed ?? 'n/a'} across ${vetOnly.length}`,
    `- All trades (includes salary dumps & depth swaps, which are genuinely lopsided): median ${med ?? 'n/a'}`,
    `- Trades our model calls near-fair (≤1.25x): ${rows.length ? Math.round(within / rows.length * 100) : 0}%`,
    ``,
    `## By archetype (each trade counted once, by its headliner)`,
    ...buckets.map(b => `- ${b.label}: n=${b.n}, median ${b.med ?? 'n/a'}`),
    ``,
    `## Highest values we assigned — do these pass the eye test?`,
    ...topVals.map(v => `- ${v.name} — **${v.tv}** (${v.pos}${v.prospect ? ', prospect' + (v.level ? ' ' + v.level : '') : ''}${v.closer ? ', closer' : ''}${v.rental ? ', rental' : ''}${v.salM != null ? ', $' + (+v.salM).toFixed(1) + 'M/yr' + (v.realDeal ? '' : ' est') : ''})`),
    ``,
    `## Most lopsided by our math (best tuning clues)`,
    ...worst.map(r => `- ${r.date} · **${r.ratio}x** — ${r.hi.team} got ${r.hi.total} (${r.hi.vals.map(v => v.name + ' ' + v.tv).join(', ')}) vs ${r.lo.team} ${r.lo.total} (${r.lo.vals.map(v => v.name + ' ' + v.tv).join(', ')})`),
    ``,
    `## Suggestions`,
    ...sug.map(s => `- ${s}`),
    ``,
    `Caveats: salaries at trade time are service-time estimates (so big-contract penalties don't fire — Correa reads far higher here than on the site), prospect ranks are current-day not as-of-trade, and minor leaguers are valued from their MiLB line.`,
    `Prospect rank lookups available: ${RANKS_N.size} org + ${TOP100_N.size} top-100 (matched by name).`,
    `Knobs live in config.json under sv.tv (mirror any change in Code.gs).`,
  ].join('\n');

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'trade-calibration.md'), report + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  console.log('\n' + report);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
// Reused by the GM-profile tool so both value players identically.
module.exports = { valueAt, milbBase };
