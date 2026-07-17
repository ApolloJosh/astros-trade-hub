/**
 * League-wide data build: every 40-man roster + every team's ranked prospects,
 * valued through the calibrated engine. Also pulls the Astros Possible Fits
 * boards + Payroll from the published Google Sheet (curation stays in Sheets).
 * Writes docs/data/{players,fits,payroll,meta}.json for the static site.
 */
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
const api = require('./mlb-api.js');
const R = require('./rankings.js');
const CFG = E.CFG;

const OUT = path.join(__dirname, '..', 'docs', 'data');
const overridesPath = path.join(__dirname, '..', 'data-sources', 'salaries-manual.json');
const OVR = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};
// Cot's Contracts data (real control + salary). Precedence: manual > Cot's > estimate.
const cotsPath = path.join(__dirname, '..', 'data-sources', 'salaries-cots.json');
const COTS = fs.existsSync(cotsPath) ? JSON.parse(fs.readFileSync(cotsPath, 'utf8')) : { teams: {} };
const { norm: normName } = require('./rankings.js');
function cotsLookup(p) {
  const team = COTS.teams[String(p.teamId)];
  if (!team) return null;
  const k = normName(p.name);
  return team.find(x => x.key === k) || null;
}

const isPitcherPos = pos => ['P', 'SP', 'RP', 'TWP'].includes(String(pos || '').toUpperCase());

async function historyBases(id, pitcher, pos, lg) {
  const d = await api.yearByYear(id, pitcher);
  const sp = (d && d.stats && d.stats[0] && d.stats[0].splits) || [];
  const bySeason = {};
  sp.forEach(x => {
    const yr = parseInt(x.season, 10);
    if (!(yr < CFG.season) || yr < CFG.season - CFG.sv.marcel.histYears) return;
    (bySeason[yr] = bySeason[yr] || []).push(x);
  });
  const out = [];
  for (let yr = CFG.season - 1; yr >= CFG.season - CFG.sv.marcel.histYears; yr--) {
    const rows = bySeason[yr]; if (!rows) continue;
    const tot = rows.find(x => !x.team);
    const use = tot ? [tot] : rows;
    let war = 0, n = 0, spFlag = false;
    use.forEach(x => {
      const b = pitcher ? E.warPitcher(x.stat, lg) : E.warHitter(x.stat, pos, lg);
      if (b && isFinite(b.war)) { war += b.war; n += b.n; spFlag = b.sp; }
    });
    if (n > 0) out.push({ war, n, sp: spFlag, season: yr });
  }
  return out;
}

async function combinedSeason(id, pitcher, pos, lg) {
  const levels = [[1, 1.0, 0, 0]].concat(CFG.prospect.levels);
  const rows = []; let topSport = null;
  for (const lv of levels) {
    const d = await api.seasonStatsSport(id, pitcher, lv[0]);
    const s = api.statOf(d);
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

async function valuePlayer(p, lg) {
  // p: {id,name,teamId,teamName,pos,age,bats,throws,debut,orgRank,top100,il}
  const pitcher = isPitcherPos(p.pos);
  const ovr = OVR[String(p.id)] || {};
  const cots = cotsLookup(p);
  const est = E.estimateContract({ mlbDebutDate: p.debut }, CFG.season);
  const control = ovr.control != null ? ovr.control : (cots ? cots.control : est.control);
  const salM = ovr.salaryM != null ? ovr.salaryM : (cots ? cots.salaryM : est.salM);
  const salSource = ovr.salaryM != null ? 'manual' : (cots ? 'cots' : 'est');

  const careerD = await api.careerStats(p.id, pitcher);
  const careerStat = api.statOf(careerD);
  const careerG = careerStat ? E.toNum(careerStat.gamesPlayed, 0) : 0;
  const prospect = careerG < CFG.prospect.maxCareerG;

  let base = null, display = null, topLevel = null;
  if (prospect) {
    const c = await combinedSeason(p.id, pitcher, p.pos, lg);
    if (c) { base = c.base; display = c.display; topLevel = c.topLevel; }
  } else {
    const s = api.statOf(await api.seasonStats(p.id, pitcher));
    const hist = await historyBases(p.id, pitcher, p.pos, lg);
    const cur = s ? (pitcher ? E.warPitcher(s, lg) : E.warHitter(s, p.pos, lg)) : null;
    if (cur) { cur.hist = hist; base = cur; display = s; }
    else if (hist.length) base = { war: 0, n: 0, sp: hist[0].sp, hist, histOnly: true };
  }

  let sv = base ? E.valueFromBase(base, pitcher, p.age, control, salM) : null;
  sv = E.adjustProspectValue(sv, p.orgRank || null, prospect);
  const tv = E.tradeValue2(sv, base, pitcher, p.age, p.orgRank || null, prospect, p.il || '', p.top100 || null);

  const line = display ? (pitcher
    ? { ip: display.inningsPitched, era: display.era, whip: display.whip, k: display.strikeOuts, sv: display.saves, g: display.gamesPlayed, gs: display.gamesStarted }
    : { pa: display.plateAppearances, avg: display.avg, ops: display.ops ?? (display.obp != null && display.slg != null ? Math.round((display.obp + display.slg) * 1000) / 1000 : null), hr: display.homeRuns, rbi: display.rbi, sb: display.stolenBases, g: display.gamesPlayed }) : null;

  return {
    id: p.id, name: p.name, team: p.teamName, teamId: p.teamId, pos: p.pos,
    bt: (p.bats || '?') + '/' + (p.throws || '?'), age: p.age,
    ctrl: control, salM: salM, salEst: salSource === 'est', salSource,
    prospect, orgRank: p.orgRank || null, top100: p.top100 || null, topLevel,
    war: base && !base.histOnly ? E.r1(base.war) : null,
    proj: sv ? E.r1(sv.proj) : null,
    sur: sv && sv.surplus != null ? E.r1(sv.surplus) : null,
    rem: sv && sv.cost != null ? E.r1(sv.cost) : null,   // salary still owed ($M, discounted)
    tv, line, type: pitcher ? (base && base.sp === false ? 'RP' : 'SP') : 'H',
  };
}

async function fetchSheetCsv(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&cb=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('sheet fetch ' + res.status);
  return parseCsv(await res.text());
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function sheetToObjects(rows) {
  const head = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r[0] && r[0].trim()).map(r => {
    const o = {}; head.forEach((h, i) => { if (h) o[h] = r[i]; }); return o;
  });
}

async function buildFits() {
  const out = [];
  for (const [key, tab] of Object.entries(CFG.fitsTabs)) {
    try {
      const objs = sheetToObjects(await fetchSheetCsv(tab));
      objs.forEach(o => out.push({ ...o, _type: key === 'hitters' ? 'H' : 'P' }));
    } catch (e) { console.warn('fits tab failed:', tab, e.message); }
  }
  return out;
}
async function buildPayroll() {
  try {
    const rows = await fetchSheetCsv(CFG.payrollTab);
    const map = {};
    rows.forEach(r => {
      const lab = String(r[0] || '').toLowerCase(), v = parseFloat(String(r[1] || '').replace(/[^0-9.\-]/g, ''));
      if (lab.includes('cbt threshold')) map.threshold = v;
      if (lab.includes('projected tax payroll')) map.taxPayroll = v;
      if (lab.includes('payor status')) map.payorStatus = (String(r[1]).match(/1st|2nd|3rd/) || ['3rd'])[0];
      if (lab.includes('projected tax bill')) map.taxBill = v;
    });
    return { ...CFG.payrollDefaults, ...map };
  } catch (e) { console.warn('payroll fallback:', e.message); return CFG.payrollDefaults; }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log('League baselines…');
  const lg = await api.leagueBaselines(E);
  console.log('  ', JSON.stringify(lg));

  const { teams: rankTeams, top100 } = R.loadAll();
  const teamsD = await api.teams();
  const teams = (teamsD.teams || []).map(t => ({ id: t.id, name: t.teamName || t.name }));
  console.log(`Teams: ${teams.length}. Rankings on file for ${Object.keys(rankTeams).length} team(s).`);

  // Traded flags from a previous transactions run (if present)
  const tradedPath = path.join(OUT, 'traded.json');
  const traded = fs.existsSync(tradedPath) ? new Set(JSON.parse(fs.readFileSync(tradedPath, 'utf8')).ids) : new Set();

  const pool = new Map();  // id -> raw player entry
  for (const t of teams) {
    const r = await api.roster40(t.id);
    (r && r.roster || []).forEach(x => {
      const per = x.person || {};
      pool.set(per.id, {
        id: per.id, name: per.fullName, teamId: t.id, teamName: t.name,
        pos: (x.position && x.position.abbreviation) || (per.primaryPosition && per.primaryPosition.abbreviation) || '?',
        age: per.currentAge, debut: per.mlbDebutDate,
        bats: per.batSide && per.batSide.code, throws: per.pitchHand && per.pitchHand.code,
      });
    });
    // ranked prospects for this team (may or may not be on the 40-man)
    for (const pr of (rankTeams[t.id] || [])) {
      let id = pr.mlbid;
      if (!id) {
        const s = await api.search(pr.name);
        const cand = (s && s.people || [])[0];
        id = cand && cand.id;
      }
      if (!id) { console.warn('  ? prospect unresolved:', t.name, pr.name); continue; }
      const existing = pool.get(id);
      if (existing) { existing.orgRank = pr.rank; }
      else {
        const per = (await api.person(id) || {}).people?.[0] || {};
        pool.set(id, {
          id, name: per.fullName || pr.name, teamId: t.id, teamName: t.name,
          pos: pr.pos || (per.primaryPosition && per.primaryPosition.abbreviation) || 'OF',
          age: per.currentAge, debut: per.mlbDebutDate,
          bats: per.batSide && per.batSide.code, throws: per.pitchHand && per.pitchHand.code,
          orgRank: pr.rank,
        });
      }
    }
    process.stdout.write(`  ${t.name}: pool ${pool.size}\n`);
  }

  // top-100 tags on pool players
  for (const p of pool.values()) {
    const r100 = R.top100Rank(top100, p.id, p.name);
    if (r100) p.top100 = r100;
  }
  // Top-100 prospects not in any roster/team-30 list yet: resolve and add,
  // so every Top 100 name is tradeable in the builder.
  const t100File = path.join(R.DIR, 'top100.json');
  if (fs.existsSync(t100File)) {
    const t100 = JSON.parse(fs.readFileSync(t100File, 'utf8')).prospects || [];
    const poolNames = new Set([...pool.values()].map(p => R.norm(p.name)));
    for (const pr of t100) {
      if (poolNames.has(R.norm(pr.name))) continue;
      const s = await api.search(pr.name);
      const cand = (s && s.people || []).find(c => c.active !== false) || (s && s.people || [])[0];
      if (!cand) { console.warn('  ? top100 unresolved:', '#' + pr.rank, pr.name); continue; }
      const org = cand.currentTeam && (cand.currentTeam.parentOrgId || cand.currentTeam.id);
      const team = teams.find(t => t.id === org);
      pool.set(cand.id, {
        id: cand.id, name: cand.fullName || pr.name,
        teamId: team ? team.id : (org || 0), teamName: team ? team.name : 'MiLB',
        pos: pr.pos || (cand.primaryPosition && cand.primaryPosition.abbreviation) || 'OF',
        age: cand.currentAge, debut: cand.mlbDebutDate,
        bats: cand.batSide && cand.batSide.code, throws: cand.pitchHand && cand.pitchHand.code,
        top100: pr.rank,
      });
    }
    console.log(`Top-100 additions -> pool ${pool.size}`);
  }

  console.log(`Valuing ${pool.size} players…`);
  const players = [];
  let done = 0;
  const entries = [...pool.values()];
  const workers = Array.from({ length: CFG.concurrency || 8 }, async () => {
    while (entries.length) {
      const p = entries.shift();
      try {
        const v = await valuePlayer(p, lg);
        v.traded = traded.has(v.id) || undefined;
        players.push(v);
      } catch (e) { console.warn('  ! value failed:', p.name, e.message); }
      if (++done % 100 === 0) console.log(`  ${done} valued`);
    }
  });
  await Promise.all(workers);
  players.sort((a, b) => (b.tv || 0) - (a.tv || 0));

  console.log('Astros fits + payroll from Sheet…');
  const fits = await buildFits();
  const payroll = await buildPayroll();

  fs.writeFileSync(path.join(OUT, 'players.json'), JSON.stringify({ updated: new Date().toISOString(), season: CFG.season, players }));
  fs.writeFileSync(path.join(OUT, 'fits.json'), JSON.stringify({ updated: new Date().toISOString(), fits }));
  fs.writeFileSync(path.join(OUT, 'payroll.json'), JSON.stringify(payroll));
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({
    updated: new Date().toISOString(), season: CFG.season, baselines: lg,
    counts: { players: players.length, fits: fits.length }, marketMult: CFG.sv.tv.marketMult,
  }));
  console.log(`DONE: ${players.length} players, ${fits.length} fits.`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { valuePlayer, parseCsv, sheetToObjects };
