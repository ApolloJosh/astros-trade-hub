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
const RANKS = new Map(), TOP100 = new Map();
try {
  const R = require('./rankings.js');
  const IDC = require('./id-cache.js');
  let resolved = 0;
  for (const f of fs.readdirSync(R.DIR)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(R.DIR, f), 'utf8'));
    (doc.prospects || []).forEach(p => {
      // Most ranking files were pasted without MLBIDs — recover them from the
      // name->id cache the daily build maintains.
      let id = p.mlbid;
      if (!id) { const c = IDC.get(p.name); id = c && c.id; if (id) resolved++; }
      if (!id) return;
      if (doc.team === 'top100') TOP100.set(id, p.rank);
      else if (!RANKS.has(id)) RANKS.set(id, p.rank);
    });
  }
  console.log(`Prospect ranks: ${RANKS.size} org + ${TOP100.size} top-100 (${resolved} via id-cache).`);
} catch (e) { console.warn('rankings unavailable:', e.message); }
// Bump when the valuation path changes so stale cached values are discarded.
const CACHE_V = 4;
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
    const orgRank = RANKS.get(id) || null, top100 = TOP100.get(id) || null;
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

    // Contract at trade time is unknowable from this API; use the service-time
    // estimate (documented limitation — mostly affects the salary penalty).
    const est = E.estimateContract({ mlbDebutDate: per.mlbDebutDate }, season);
    let sv = E.valueFromBase(base, pitcher, age, est.control, est.salM);
    sv = E.adjustProspectValue(sv, orgRank, prospect);
    if (sv) { sv.ctrl = est.control; if (pitcher && base.sp === false && cur) sv.closerSv = E.toNum(cur.saves, 0); }
    const tv = E.tradeValue2(sv, base, pitcher, age, orgRank, prospect, '', top100);
    out = tv == null ? null : {
      tv, name: per.fullName, pos, pitcher, prospect, ranked: !!(orgRank || top100),
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
  const has = (r, f) => r.hi.vals.some(f) || r.lo.vals.some(f);
  const bucket = (label, f) => {
    const sub = rows.filter(r => has(r, f));
    return { label, n: sub.length, med: median(sub.map(r => r.ratio)) };
  };
  // Veteran-only trades are the cleanest signal (no prospect guesswork at all).
  const vetOnly = rows.filter(r => ![...r.hi.vals, ...r.lo.vals].some(v => v.prospect));
  const vetMed = median(vetOnly.map(r => r.ratio));
  const buckets = [
    bucket('Rentals (≤1.5y control)', v => v.rental),
    bucket('Controlled (≥4y)', v => v.ctrl >= 4),
    bucket('Closers (10+ SV)', v => v.closer),
    bucket('Prospects / rookies', v => v.prospect),
    bucket('MiLB-only (level-adjusted)', v => v.milb),
    bucket('Ranked prospects', v => v.ranked),
    bucket('MLB-only trades', () => true),
    bucket('Pitchers', v => v.pitcher),
    bucket('Hitters', v => !v.pitcher),
  ];
  const worst = [...rows].sort((a, b) => b.ratio - a.ratio).slice(0, 8);

  const sug = [];
  if (med != null) {
    if (med > 1.25) sug.push(`Median real trade reads ${med}x lopsided — the model systematically OVERVALUES whatever tends to land on the heavier side. Check the buckets below for which archetype.`);
    else if (med < 0.85) sug.push(`Median ${med} — model UNDERVALUES the headline side.`);
    else sug.push(`Median ${med} — model is pricing real trades well overall.`);
  }
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
    `- **Median ratio (bigger/smaller side): ${med ?? 'n/a'}**`,
    `- **Established-players-only trades (cleanest signal): median ${vetMed ?? 'n/a'} across ${vetOnly.length}**`,
    `- Trades our model calls near-fair (≤1.25x): ${rows.length ? Math.round(within / rows.length * 100) : 0}%`,
    ``,
    `## By archetype`,
    ...buckets.map(b => `- ${b.label}: n=${b.n}, median ${b.med ?? 'n/a'}`),
    ``,
    `## Most lopsided by our math (best tuning clues)`,
    ...worst.map(r => `- ${r.date} · **${r.ratio}x** — ${r.hi.team} got ${r.hi.total} (${r.hi.vals.map(v => v.name + ' ' + v.tv).join(', ')}) vs ${r.lo.team} ${r.lo.total} (${r.lo.vals.map(v => v.name + ' ' + v.tv).join(', ')})`),
    ``,
    `## Suggestions`,
    ...sug.map(s => `- ${s}`),
    ``,
    `Caveats: salaries at trade time are service-time estimates, prospect ranks as of the trade aren't applied, and players with no MLB record are skipped — so prospect-heavy deals read light here.`,
    `Knobs live in config.json under sv.tv (mirror any change in Code.gs).`,
  ].join('\n');

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'trade-calibration.md'), report + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  console.log('\n' + report);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
