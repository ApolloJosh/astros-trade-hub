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
async function market() {
  const st = await api.standings();
  const sellers = [], buyers = [];
  ((st && st.records) || []).forEach(div => (div.teamRecords || []).forEach(t => {
    const gb = parseFloat(String(t.wildCardGamesBack ?? t.gamesBack ?? '0').replace('-', '0')) || 0;
    const rec = { id: t.team.id, name: t.team.name, w: t.wins, l: t.losses, gb };
    // more than 6 back of a wild card at the deadline = seller
    (gb > 6 ? sellers : buyers).push(rec);
  }));
  return { sellers, buyers };
}

// ---------- 4. Named mock trades ----------
function mocks(players, prof, sellers, needs) {
  const sellerNames = new Set(sellers.map(s => s.name));
  const hou = players.filter(p => p.teamId === HOU && p.tv != null && !p.traded);
  const OF_POS = ['LF', 'CF', 'RF', 'OF'];
  const fits = p => {
    if (!needs.length) return 0;
    let sc = 0;
    if (needs.includes('OF') && OF_POS.includes(p.pos)) sc += 2;
    if (needs.includes('LHH') && p.type === 'H' && String(p.bt || '').startsWith('L')) sc += 2;
    if (needs.includes('RP') && p.type === 'RP') sc += 2;
    if (needs.includes('SP') && p.type === 'SP') sc += 1.5;
    if (needs.includes(p.pos)) sc += 2;
    return sc;
  };
  // Targets: on a seller, fills a need, and inside the value band Brown works in
  const band = [Math.max(8, prof.avgGet * 0.5), Math.max(45, (prof.biggestGet?.tv || 40) * 1.35)];
  const targets = players
    .filter(p => p.teamId !== HOU && p.tv != null && !p.traded && sellerNames.has(p.team))
    .map(p => ({ p, fit: fits(p) }))
    .filter(x => x.fit > 0 && x.p.tv >= band[0] && x.p.tv <= band[1])
    .sort((a, b) => (b.fit - a.fit) || (b.p.tv - a.p.tv))
    .slice(0, 6);

  // Currency: prospects first (that's how he pays), never the untouchables
  const chips = hou.filter(p => !p.unt && (p.prospect || (p.age || 30) <= 25))
    .sort((a, b) => (b.tv || 0) - (a.tv || 0));

  return targets.map(({ p, fit }) => {
    const want = p.tv, pkg = [];
    let acc = 0;
    for (const c of chips) {
      if (pkg.length >= 3 || acc >= want - 6) break;
      if (pkg.includes(c)) continue;
      if (acc + c.tv <= want + 10) { pkg.push(c); acc = r1(acc + c.tv); }
    }
    // top up with the closest single chip if we're still light
    if (acc < want - 12) {
      const gap = want - acc;
      const best = chips.filter(c => !pkg.includes(c))
        .sort((a, b) => Math.abs(a.tv - gap) - Math.abs(b.tv - gap))[0];
      if (best) { pkg.push(best); acc = r1(acc + best.tv); }
    }
    return { target: p, fit, pkg, give: acc, gap: r1(acc - want) };
  }).filter(m => m.pkg.length);
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
  L.push(`Sellers (>6 back of a wild card): **${mkt.sellers.length}** — ${mkt.sellers.slice(0, 12).map(s => s.name.replace(/^.* /, '')).join(', ')}${mkt.sellers.length > 12 ? '…' : ''}`);
  L.push(`Houston's stated needs: **${needs.length ? needs.join(', ') : 'none on file'}**`);
  L.push('');
  L.push('## Predicted moves');
  L.push('Built from his revealed tendencies (value band, prospect currency, need fit) against sellers only.');
  L.push('');
  if (!preds.length) L.push('_No matches — run the daily build first so player values and needs are present._');
  preds.forEach((m, i) => {
    L.push(`### ${i + 1}. ${m.target.name} — ${m.target.team} (${m.target.pos}, value ${m.target.tv})`);
    L.push(`Astros send: ${m.pkg.map(p => `**${p.name}** ${p.tv}${p.orgRank ? ' (Org #' + p.orgRank + ')' : ''}`).join(' + ')} — total **${m.give}**`);
    L.push(`Balance: ${m.gap > 0 ? '+' : ''}${m.gap} ${Math.abs(m.gap) <= 12 ? '(inside the fair band)' : '(needs adjusting)'}`);
    L.push('');
  });
  L.push('---');
  L.push('_Values are model estimates at time of trade. Prospect ranks are current-day. Backend only._');

  const report = L.join('\n');
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'deadline-outlook.md'), report + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  console.log('\n' + report);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
