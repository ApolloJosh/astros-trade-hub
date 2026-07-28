/**
 * DANA BROWN DEADLINE PROFILE + PREDICTIONS — backend only.
 *     npm run gm            (add --years=2023,2024,2025 to change the window)
 *
 * 1. Pulls every Astros trade inside each deadline window of Brown's tenure and
 *    values BOTH sides with the stats each player had at the time.
 * 2. Derives his revealed tendencies: what he pays, what he targets, whether he
 *    deals ranked prospects, rentals vs. control, buyer or seller.
 * 3. Reads the current market — who's selling, Houston's stated needs, and our
 *    live values — and writes named mock trades that fit the profile.
 *
 * Output: reports/deadline-outlook.md. Never touches the public site.
 */
const fs = require('fs');
const path = require('path');
const api = require('./mlb-api.js');
const E = require('./engine.js');
const CFG = require('../config.json');
const { groupTrades } = require('./transactions.js');
const { valueAt } = require('./calibrate-trades.js');

const REPORTS = path.join(__dirname, '..', 'reports');
const OUT = path.join(__dirname, '..', 'docs', 'data');
const HOU = CFG.astrosTeamId || 117;
const years = (() => {
  const a = process.argv.find(x => x.startsWith('--years='));
  return a ? a.split('=')[1].split(',').map(Number) : [2023, 2024, 2025];
})();
const r1 = v => Math.round(v * 10) / 10;

// ---------- 1. Brown's deadline trades ----------
async function deadlineTrades(year, lg) {
  const txs = [];
  const r = await api.transactions(`${year}-06-25`, `${year}-08-06`);
  (r && r.transactions || []).forEach(t => txs.push(t));
  const groups = groupTrades(txs).filter(g =>
    [...g.sides.values()].some(s => s.teamId === HOU));
  const out = [];
  for (const g of groups) {
    const sides = [];
    for (const s of g.sides.values()) {
      const vals = [];
      for (const pl of s.gets) {
        const v = await valueAt(pl.id, year, lg);
        vals.push({ id: pl.id, name: pl.name, tv: v ? v.tv : null,
          prospect: v ? v.prospect : null, ranked: v ? v.ranked : false,
          level: v ? v.level : null, rental: v ? v.rental : false,
          ctrl: v ? v.ctrl : null, pitcher: v ? v.pitcher : null, pos: v ? v.pos : '' });
      }
      sides.push({ team: s.team, teamId: s.teamId, vals,
        total: r1(vals.reduce((a, v) => a + (v.tv || 0), 0)) });
    }
    const hou = sides.find(s => s.teamId === HOU), other = sides.find(s => s.teamId !== HOU);
    if (!hou || !other) continue;
    out.push({ date: g.date, year, desc: g.desc, got: hou, gave: other });
  }
  return out;
}

// ---------- 2. Tendencies ----------
function profile(trades) {
  const got = trades.flatMap(t => t.got.vals), gave = trades.flatMap(t => t.gave.vals);
  const sum = l => r1(l.reduce((a, v) => a + (v.tv || 0), 0));
  const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
  const gotBig = got.filter(v => (v.tv || 0) >= 25);
  return {
    trades: trades.length,
    inValue: sum(got), outValue: sum(gave),
    netValue: r1(sum(got) - sum(gave)),
    playersIn: got.length, playersOut: gave.length,
    biggestGet: got.slice().sort((a, b) => (b.tv || 0) - (a.tv || 0))[0] || null,
    biggestGive: gave.slice().sort((a, b) => (b.tv || 0) - (a.tv || 0))[0] || null,
    avgGet: got.length ? r1(sum(got) / got.length) : 0,
    // what he PAYS with
    paidProspects: pct(gave.filter(v => v.prospect).length, gave.length),
    paidRanked: gave.filter(v => v.ranked).length,
    paidTopValue: gave.filter(v => (v.tv || 0) >= 20).length,
    // what he BUYS
    boughtPitching: pct(got.filter(v => v.pitcher).length, got.length),
    boughtRentals: pct(got.filter(v => v.rental).length, got.length),
    boughtControlled: pct(got.filter(v => (v.ctrl || 0) >= 2.5).length, got.length),
    bigGets: gotBig.length,
    buyer: sum(got) >= sum(gave),
  };
}

// ---------- 3. Current market ----------
// MLB reports games-back as "-" (leading), "-6.5" (AHEAD by 6.5) or "6.5"
// (behind). Naive parsing turned "ahead by 6.5" into "6.5 back" and filed the
// Yankees as sellers, so parse the sign explicitly.
function gamesBack(raw) {
  const v = String(raw == null ? '-' : raw).trim();
  if (v === '-' || v === '' || v === '+') return 0;      // in position
  if (v.startsWith('-')) return 0;                        // ahead of the cut
  const n = parseFloat(v.replace('+', ''));
  return isNaN(n) ? 0 : n;
}
const SELL_GB = 4;   // more than this many games out of a WC spot = seller

async function market() {
  const st = await api.standings();
  const sellers = [], buyers = [];
  ((st && st.records) || []).forEach(div => (div.teamRecords || []).forEach(t => {
    const gb = gamesBack(t.wildCardGamesBack != null ? t.wildCardGamesBack : t.gamesBack);
    const leadsDiv = String(t.divisionRank || '') === '1';
    const inWC = String(t.wildCardRank || '') !== '' && +t.wildCardRank <= 3;
    const rec = { id: t.team.id, name: t.team.name, w: t.wins, l: t.losses, gb };
    // A division leader or a club holding a wild card is never a seller.
    (!leadsDiv && !inWC && gb > SELL_GB ? sellers : buyers).push(rec);
  }));
  return { sellers, buyers };
}

// ---------- 4. Named mock trades ----------
const BLOCK = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-sources', 'trade-block.json'), 'utf8')); }
  catch (e) { console.warn('trade-block.json missing — every Astro is assumed available.'); return {}; }
})();
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
const inList = (list, name) => (list || []).some(n => norm(n) === norm(name));

function mocks(players, prof, sellers, needs) {
  const sellerNames = new Set(sellers.map(s => s.name));
  const OF_POS = ['LF', 'CF', 'RF', 'OF'];
  const fits = p => {
    if (!needs.length) return 0.5;
    let sc = 0;
    if (needs.includes('OF') && OF_POS.includes(p.pos)) sc += 2;
    if (needs.includes('LHH') && p.type === 'H' && String(p.bt || '').startsWith('L')) sc += 2;
    if (needs.includes('RP') && p.type === 'RP') sc += 2;
    if (needs.includes('SP') && p.type === 'SP') sc += 1.5;
    if (needs.includes(p.pos)) sc += 2;
    return sc;
  };

  // TARGETS: real major-league help only. Brown has never bought another club's
  // farmhands at the deadline — every one of his adds was an MLB contributor.
  // And a seller moves players it is about to LOSE: rentals and short-control
  // veterans. Nobody sells a 21-year-old with 5.5 years of control.
  const SELLABLE_CTRL = 3.0;
  const targets = players
    .filter(p => p.teamId !== HOU && p.tv != null && !p.traded && !p.unt &&
      !p.prospect && sellerNames.has(p.team) &&
      (p.topLevel == null || p.topLevel === 'MLB') &&
      (p.ctrl == null || p.ctrl <= SELLABLE_CTRL))
    .map(p => ({ p, fit: fits(p) }))
    .filter(x => x.fit > 0 && x.p.tv >= 10)
    .sort((a, b) => (b.fit - a.fit) || (b.p.tv - a.p.tv))
    .slice(0, 8);

  // CURRENCY: the trade block decides. Protected names are never offered;
  // listed-available names are preferred; otherwise mid-tier prospects only.
  const hou = players.filter(p => p.teamId === HOU && p.tv != null && !p.traded);
  const chips = hou
    .filter(p => !p.unt && !inList(BLOCK.protected, p.name))
    .map(p => ({
      p,
      pref: inList(BLOCK.available, p.name) ? 2
        : (BLOCK.conditional && Object.keys(BLOCK.conditional).some(n => norm(n) === norm(p.name))) ? 0
        : 1,
    }))
    .filter(c => c.pref > 0 || true)
    .sort((a, b) => (b.pref - a.pref) || ((b.p.tv || 0) - (a.p.tv || 0)));

  const used = new Set();
  return targets.map(({ p, fit }) => {
    const want = p.tv, pkg = [];
    let acc = 0;
    // build from the preferred pool first, largest piece that still fits
    // A seller wants youth and control back — never an older player with less
    // team control than the man they're giving up.
    const sellerWants = c => {
      const x = c.p;
      if (x.prospect) return true;
      const younger = (x.age ?? 99) <= (p.age ?? 0);
      const moreCtrl = (x.ctrl ?? 0) >= (p.ctrl ?? 0);
      return younger || moreCtrl;
    };
    const pool = chips.filter(sellerWants);
    for (const c of pool) {
      if (pkg.length >= 3 || acc >= want - 5) break;
      if (used.has(c.p.name)) continue;
      if (acc + (c.p.tv || 0) <= want + 9) { pkg.push(c); acc = r1(acc + (c.p.tv || 0)); }
    }
    if (acc < want - 12) {
      const gap = want - acc;
      const best = pool.filter(c => !pkg.includes(c) && !used.has(c.p.name))
        .sort((a, b) => Math.abs((a.p.tv || 0) - gap) - Math.abs((b.p.tv || 0) - gap))[0];
      if (best) { pkg.push(best); acc = r1(acc + (best.p.tv || 0)); }
    }
    pkg.forEach(c => used.add(c.p.name));   // don't sell the same player twice
    const caveats = pkg.filter(c => BLOCK.conditional && Object.keys(BLOCK.conditional).find(n => norm(n) === norm(c.p.name)))
      .map(c => { const k = Object.keys(BLOCK.conditional).find(n => norm(n) === norm(c.p.name)); return `${k}: ${BLOCK.conditional[k]}`; });
    return { target: p, fit, pkg: pkg.map(c => c.p), give: acc, gap: r1(acc - want), caveats };
  }).filter(m => m.pkg.length);
}

// Contract-for-contract swaps: Houston's big money out, a needed bat back.
function swaps(players, sellers, needs) {
  const sellerNames = new Set(sellers.map(s => s.name));
  const OF_POS = ['LF', 'CF', 'RF', 'OF'];
  const ours = players.filter(p => p.teamId === HOU && inList(BLOCK.bigMoney, p.name) && p.tv != null);
  const theirs = players.filter(p => p.teamId !== HOU && !p.prospect && p.tv != null && !p.traded &&
    (p.rem || 0) >= 12 && sellerNames.has(p.team) &&
    (OF_POS.includes(p.pos) || (needs.includes('LHH') && String(p.bt || '').startsWith('L'))));
  const out = [];
  ours.forEach(o => {
    const m = theirs
      .map(t => ({ t, d: Math.abs((t.tv || 0) - (o.tv || 0)) }))
      .sort((a, b) => a.d - b.d)[0];
    if (m) out.push({ ours: o, theirs: m.t, gap: r1((m.t.tv || 0) - (o.tv || 0)) });
  });
  return out.slice(0, 3);
}

// ---------- 5. Public payload ----------
// The site gets the trades and the values; the tuning notes stay in the report.
const slim = p => p && {
  id: p.id || null, name: p.name, team: p.team || null, teamId: p.teamId || null,
  pos: p.pos || '', bt: p.bt || null, type: p.type || null,
  age: p.age ?? null, ctrl: p.ctrl ?? null, rem: p.rem ?? null, tv: p.tv ?? null,
  prospect: !!p.prospect, orgRank: p.orgRank || null, top100: p.top100 || null,
  level: p.level || p.topLevel || null,
};

function payload(all, prof, mkt, needs, preds, swapList) {
  return {
    updated: new Date().toISOString(),
    years,
    profile: {
      trades: prof.trades, inValue: prof.inValue, outValue: prof.outValue,
      netValue: prof.netValue, buyer: prof.buyer,
      playersIn: prof.playersIn, playersOut: prof.playersOut, avgGet: prof.avgGet,
      biggestGet: slim(prof.biggestGet), biggestGive: slim(prof.biggestGive),
      paidProspects: prof.paidProspects, paidRanked: prof.paidRanked, paidTopValue: prof.paidTopValue,
      boughtPitching: prof.boughtPitching, boughtRentals: prof.boughtRentals,
      boughtControlled: prof.boughtControlled, bigGets: prof.bigGets,
    },
    history: all.map(t => ({
      date: t.date, year: t.year,
      partner: t.gave.team, partnerId: t.gave.teamId,
      got: { total: t.got.total, players: t.got.vals.map(slim) },
      gave: { total: t.gave.total, players: t.gave.vals.map(slim) },
    })).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    market: { sellerCount: mkt.sellers.length, sellers: mkt.sellers.map(s => s.name) },
    needs,
    protected: BLOCK.protected || [],
    predictions: preds.map(m => ({
      target: slim(m.target),
      pkg: m.pkg.map(slim),
      give: m.give, want: m.target.tv, gap: m.gap, caveats: m.caveats,
    })),
    swaps: swapList.map(sw => ({ ours: slim(sw.ours), theirs: slim(sw.theirs), gap: sw.gap })),
  };
}

async function main() {
  const lg = E.defaultBaselines();
  console.log(`Pulling Astros deadline trades for ${years.join(', ')}…`);
  let all = [];
  for (const y of years) {
    const t = await deadlineTrades(y, lg);
    console.log(`  ${y}: ${t.length} trades`);
    all = all.concat(t);
  }
  const prof = profile(all);

  console.log('Reading the market…');
  const mkt = await market().catch(() => ({ sellers: [], buyers: [] }));
  let players = [];
  try { players = JSON.parse(fs.readFileSync(path.join(OUT, 'players.json'), 'utf8')).players || []; }
  catch (e) { console.warn('players.json missing — predictions will be empty.'); }
  let needs = [];
  try {
    const nd = JSON.parse(fs.readFileSync(path.join(OUT, 'team-needs.json'), 'utf8'));
    needs = (nd.teams || {})['Houston Astros'] || [];
  } catch (e) {}
  const preds = mocks(players, prof, mkt.sellers, needs);
  const swapList = swaps(players, mkt.sellers, needs);

  // ---------- report ----------
  const L = [];
  L.push(`# Astros deadline outlook — ${new Date().toISOString().slice(0, 10)}`);
  L.push('');
  L.push('## Dana Brown at the deadline');
  L.push(`Windows examined: ${years.join(', ')} (June 25 – Aug 6). **${prof.trades} trades.**`);
  L.push('');
  L.push(`- Value acquired **${prof.inValue}** · value surrendered **${prof.outValue}** · net **${prof.netValue > 0 ? '+' : ''}${prof.netValue}** → he has been a **${prof.buyer ? 'BUYER' : 'SELLER'}**`);
  L.push(`- Players in **${prof.playersIn}**, out **${prof.playersOut}** (avg piece acquired ${prof.avgGet})`);
  if (prof.biggestGet) L.push(`- Biggest add: **${prof.biggestGet.name}** (${prof.biggestGet.tv})`);
  if (prof.biggestGive) L.push(`- Biggest cost: **${prof.biggestGive.name}** (${prof.biggestGive.tv})`);
  L.push(`- Pays with prospects **${prof.paidProspects}%** of the time; surrendered **${prof.paidRanked}** ranked prospects and **${prof.paidTopValue}** pieces worth 20+`);
  L.push(`- Buys pitching **${prof.boughtPitching}%** · rentals **${prof.boughtRentals}%** · 2.5+ yrs of control **${prof.boughtControlled}%**`);
  L.push(`- Deals with a 25+ value headliner: **${prof.bigGets}**`);
  L.push('');
  L.push('### Every deadline trade');
  if (!all.length) L.push('_None found in the window._');
  all.forEach(t => {
    const f = v => `${v.name} ${v.tv == null ? '?' : v.tv}${v.prospect ? ' (prospect' + (v.level ? ' ' + v.level : '') + ')' : ''}`;
    L.push(`- **${t.date}** vs ${t.gave.team} — got ${t.got.vals.map(f).join(', ')} (**${t.got.total}**) · gave ${t.gave.vals.map(f).join(', ')} (**${t.gave.total}**)`);
  });
  L.push('');
  L.push('## The market right now');
  L.push(`Sellers (>${SELL_GB} out of a wild card, excluding division leaders): **${mkt.sellers.length}** — ${mkt.sellers.slice(0, 12).map(s => s.name.replace(/^.* /, '')).join(', ')}${mkt.sellers.length > 12 ? '…' : ''}`);
  L.push(`Houston's stated needs: **${needs.length ? needs.join(', ') : 'none on file'}**`);
  L.push('');
  L.push('## Predicted moves');
  L.push('Built from his revealed tendencies (value band, prospect currency, need fit) against sellers only.');
  L.push('');
  L.push(`Protected (never offered): ${(BLOCK.protected || []).join(', ') || 'none set'}`);
  L.push('');
  if (!preds.length) L.push('_No matches — run the daily build first so player values and needs are present._');
  preds.forEach((m, i) => {
    const t = m.target;
    L.push(`### ${i + 1}. ${t.name} — ${t.team} (${t.pos}${t.bt ? ', ' + t.bt : ''}, age ${t.age ?? '?'}, value ${t.tv})`);
    L.push(`${t.ctrl ? t.ctrl + 'y control' : ''}${t.rem != null ? ' · ~$' + t.rem + 'M owed' : ''}`);
    L.push(`Astros send: ${m.pkg.map(p => `**${p.name}** ${p.tv}${p.orgRank ? ' (Org #' + p.orgRank + ')' : ''}`).join(' + ')} — total **${m.give}**`);
    L.push(`Balance: ${m.gap > 0 ? '+' : ''}${m.gap} ${Math.abs(m.gap) <= 12 ? '(inside the fair band)' : '(needs adjusting)'}`);
    m.caveats.forEach(c => L.push(`> ${c}`));
    L.push('');
  });
  if (swapList.length) {
    L.push('## Contract-for-contract swaps');
    L.push('Money out, need filled — the Walker-for-Gurriel shape.');
    L.push('');
    swapList.forEach(sw => {
      L.push(`- **${sw.ours.name}** (${sw.ours.tv}${sw.ours.rem != null ? ', ~$' + sw.ours.rem + 'M owed' : ''}) ⇄ **${sw.theirs.name}** — ${sw.theirs.team} (${sw.theirs.pos}, ${sw.theirs.tv}${sw.theirs.rem != null ? ', ~$' + sw.theirs.rem + 'M owed' : ''}) · gap ${sw.gap > 0 ? '+' : ''}${sw.gap}`);
    });
    L.push('');
  }
  L.push('---');
  L.push('_Values are model estimates at time of trade. Prospect ranks are current-day. Backend only._');

  // publish to the site
  try {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'dana-brown.json'),
      JSON.stringify(payload(all, prof, mkt, needs, preds, swapList)) + '\n');
    console.log(`Wrote docs/data/dana-brown.json (${all.length} past trades, ${preds.length} predictions)`);
  } catch (e) { console.warn('could not write dana-brown.json:', e.message); }

  const report = L.join('\n');
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'deadline-outlook.md'), report + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  console.log('\n' + report);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
