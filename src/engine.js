/**
 * Beyond the Diamond — valuation engine (Node port of the Apps Script Code.gs).
 * Pure functions: no network, no globals. League baselines are passed in.
 * Output-parity with Code.gs is enforced by test/parity.test.js.
 */
const path = require('path');
const CFG = require(path.join(__dirname, '..', 'config.json'));
const SV = CFG.sv;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toNum = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
const r1 = v => Math.round(v * 10) / 10;

// Innings "123.1" (= 123 1/3) -> decimal innings.
function ipNum(v) { const n = toNum(v, 0); const w = Math.floor(n); return w + (n - w) * 10 / 3; }

function interp(c, x) {
  if (x <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (x <= c[i][0]) { const t = (x - c[i - 1][0]) / (c[i][0] - c[i - 1][0]); return c[i - 1][1] + t * (c[i][1] - c[i - 1][1]); }
  }
  return c[c.length - 1][1];
}

function defaultBaselines() {
  const b = { obp: SV.lgOBP, slg: SV.lgSLG, era: SV.lgERA, fipC: SV.fipC };
  b.woba = (1.8 * b.obp + b.slg) / 3;
  return b;
}

function posAdj600(pos) {
  const p = String(pos || '').toUpperCase().trim();
  return SV.posAdj600[p] != null ? SV.posAdj600[p] : 0;
}

// ---- Current-season WAR proxies ----
function warHitter(s, pos, lg) {
  const pa = toNum(s.plateAppearances, 0), obp = toNum(s.obp, NaN), slg = toNum(s.slg, NaN);
  if (pa <= 0 || isNaN(obp) || isNaN(slg)) return null;
  const woba = (1.8 * obp + slg) / 3;
  const bat = (woba - lg.woba) / SV.wobaScale * pa;
  const bsr = SV.sbRun * toNum(s.stolenBases, 0);
  const war = (bat + bsr + (posAdj600(pos) + SV.replRuns600) * pa / 600) / SV.runsPerWin;
  return { war, n: pa, sp: false };
}
function warPitcher(s, lg) {
  const ip = ipNum(s.inningsPitched); if (ip <= 0) return null;
  const k = toNum(s.strikeOuts, 0), bb = toNum(s.baseOnBalls, 0);
  let hr = toNum(s.homeRuns, NaN); if (isNaN(hr)) hr = toNum(s.homeRunsPer9, 0) * ip / 9;
  const fip = (13 * hr + 3 * bb - 2 * k) / ip + lg.fipC;
  const era = toNum(s.era, fip);
  const ra = SV.wFip * fip + (1 - SV.wFip) * era;
  const g = toNum(s.gamesPlayed, 0), gs = toNum(s.gamesStarted, 0);
  const sp = g > 0 ? (gs / g) >= 0.5 : true;
  let war = ((lg.era + (sp ? SV.replGapSP : SV.replGapRP)) - ra) / SV.runsPerWin * ip / 9;
  if (!sp && toNum(s.saves, 0) >= SV.closerSaves) war *= SV.closerBump;
  return { war, n: ip, sp };
}

// ---- Prospect multi-level combine (rows: [{s, f, wp, ep}], MLB->Rookie order) ----
function combineHitting(rows, pos, lg) {
  const S = k => rows.reduce((a, r) => a + toNum(r.s[k], 0), 0);
  const pa = S('plateAppearances'), ab = S('atBats'), h = S('hits'), hr = S('homeRuns'),
    bb = S('baseOnBalls'), so = S('strikeOuts'), sb = S('stolenBases'), rbi = S('rbi'),
    hbp = S('hitByPitch'), sf = S('sacFlies'), tb = S('totalBases'), g = S('gamesPlayed');
  if (pa <= 0) return null;
  const obp = (h + bb + hbp) / Math.max(ab + bb + hbp + sf, 1), slg = tb / Math.max(ab, 1);
  const babipD = ab - so - hr + sf;
  const r3 = v => Math.round(v * 1000) / 1000;
  const display = { gamesPlayed: g, plateAppearances: pa, atBats: ab, homeRuns: hr, rbi,
    baseOnBalls: bb, strikeOuts: so, stolenBases: sb,
    avg: r3(h / Math.max(ab, 1)), obp: r3(obp), slg: r3(slg), ops: r3(obp + slg),
    babip: babipD > 0 ? r3((h - hr) / babipD) : '' };
  let wSum = 0;
  rows.forEach(r => {
    const rpa = toNum(r.s.plateAppearances, 0); if (rpa <= 0) return;
    const w = (1.8 * toNum(r.s.obp, lg.obp) + toNum(r.s.slg, lg.slg)) / 3;
    wSum += (lg.woba + (w - lg.woba) * r.f - r.wp) * rpa;
  });
  const eqWoba = wSum / pa;
  const bat = (eqWoba - lg.woba) / SV.wobaScale * pa;
  const war = (bat + SV.sbRun * sb + (posAdj600(pos) + SV.replRuns600) * pa / 600) / SV.runsPerWin;
  return { display, base: { war, n: pa, sp: false } };
}
function combinePitching(rows, lg) {
  const S = k => rows.reduce((a, r) => a + toNum(r.s[k], 0), 0);
  const ip = rows.reduce((a, r) => a + ipNum(r.s.inningsPitched), 0);
  if (ip <= 0) return null;
  const k = S('strikeOuts'), bb = S('baseOnBalls'), hits = S('hits'), hr = S('homeRuns'),
    er = S('earnedRuns'), g = S('gamesPlayed'), gs = S('gamesStarted'),
    svs = S('saves'), hld = S('holds'), bs = S('blownSaves');
  const era = 9 * er / ip;
  const r2 = v => Math.round(v * 100) / 100;
  const w = Math.floor(ip), t = Math.round((ip - w) * 3);
  const display = { gamesPlayed: g, gamesStarted: gs, blownSaves: bs, saves: svs, holds: hld,
    inningsPitched: t >= 3 ? (w + 1) : (w + t / 10), era: r2(era), whip: r2((hits + bb) / ip),
    strikeOuts: k, baseOnBalls: bb, hitsPer9Inn: r2(9 * hits / ip), homeRunsPer9: r2(9 * hr / ip) };
  let raSum = 0;
  rows.forEach(r => {
    const rip = ipNum(r.s.inningsPitched); if (rip <= 0) return;
    const rk = toNum(r.s.strikeOuts, 0), rbb = toNum(r.s.baseOnBalls, 0);
    let rhr = toNum(r.s.homeRuns, NaN); if (isNaN(rhr)) rhr = toNum(r.s.homeRunsPer9, 0) * rip / 9;
    const fip = (13 * rhr + 3 * rbb - 2 * rk) / rip + lg.fipC;
    const rera = toNum(r.s.era, fip);
    const ra = SV.wFip * fip + (1 - SV.wFip) * rera;
    raSum += (lg.era - (lg.era - ra) * r.f + r.ep) * rip;
  });
  const eqRa = raSum / ip;
  const sp = g > 0 ? (gs / g) >= 0.5 : true;
  let war = ((lg.era + (sp ? SV.replGapSP : SV.replGapRP)) - eqRa) / SV.runsPerWin * ip / 9;
  if (!sp && svs >= SV.closerSaves) war *= SV.closerBump;
  return { display, base: { war, n: ip, sp } };
}

// ---- Projection (Marcel-style) ----
function ageMult(age) {
  const m = SV.marcel, a = toNum(age, 28);
  let f = 1;
  if (a < m.peakLo) f = 1 + (m.peakLo - a) * m.growPerYr;
  else if (a > m.peakHi) f = 1 - (a - m.peakHi) * m.declinePerYr;
  return clamp(f, m.ageMultLo, m.ageMultHi);
}
function projectFull(base, pitcher, age, season) {
  const m = SV.marcel;
  let full, priorN, priorWar;
  if (!pitcher) { full = SV.hitFullPA; priorN = SV.hitPriorPA; priorWar = SV.hitPriorWar600; }
  else if (base.sp) { full = SV.spFullIP; priorN = SV.spPriorIP; priorWar = SV.spPriorWar180; }
  else { full = SV.rpFullIP; priorN = SV.rpPriorIP; priorWar = SV.rpPriorWar65; }
  let num = base.war * m.weights[0], den = base.n * m.weights[0];
  (base.hist || []).forEach(h => {
    const gap = (season || CFG.season) - (h.season || (season || CFG.season) - 1);
    const w = m.weights[gap] != null ? m.weights[gap] : m.weights[m.weights.length - 1];
    num += w * h.war; den += w * h.n;
  });
  const rate = (num + priorWar / full * priorN) / (den + priorN);
  return rate * full * ageMult(age);
}

// ---- Rest-of-contract value ----
function dollarsPerWar(w, isRP) {
  return interp(isRP ? SV.dollarsCurveRP : SV.dollarsCurve, w);
}
function valueFromBase(base, pitcher, age, control, salM) {
  const proj = projectFull(base, pitcher, age);
  const risk = (base.risk != null) ? base.risk : 1;
  let rem = toNum(control, NaN); if (isNaN(rem) || rem <= 0) rem = 0.5;
  const shares = [Math.min(0.5, rem)]; let r = rem - shares[0];
  while (r > 0.001) { const sh = Math.min(1, r); shares.push(sh); r -= sh; }
  const a0 = toNum(age, 28);
  const arbTrack = salM != null && salM <= SV.arbSalaryMax && rem > 1.01;
  let mkt = 0, cost = 0, remWar = 0;
  for (let y = 0; y < shares.length; y++) {
    let w = proj;
    for (let k = 1; k <= y; k++) {
      const ak = a0 + k;
      w += ak <= SV.ageGrowUntil ? SV.ageGrow : (ak >= SV.ageDeclineFrom ? -SV.ageDecline : 0);
    }
    w = Math.max(SV.warFloor, w) * risk;
    const pv1 = Math.pow(1 + SV.discount, y);
    const mv = w * dollarsPerWar(w, pitcher && !base.sp) * Math.pow(1 + SV.inflation, y) / pv1;
    mkt += shares[y] * mv; remWar += shares[y] * w;
    if (salM != null) {
      let sal;
      if (arbTrack) {
        const fromEnd = shares.length - 1 - y;
        const share = fromEnd === 0 ? SV.arbShares[2] : fromEnd === 1 ? SV.arbShares[1] :
          fromEnd === 2 ? SV.arbShares[0] : 0;
        sal = Math.max(share * mv, y === 0 ? salM : SV.minSalary);
      } else sal = salM;
      cost += shares[y] * sal / pv1;
    }
  }
  return { war: base.histOnly ? null : base.war, proj, projR: proj * risk, remWar, mkt,
    cost: salM != null ? cost : null, surplus: salM != null ? mkt - cost : null };
}

// ---- Prospect / rank adjustments on surplus ----
function rankValue(rank) {
  const f = SV.rankValues; let out = 0;
  for (let i = 0; i < f.length; i++) if (rank >= f[i][0]) out = f[i][1];
  return out;
}
function adjustProspectValue(sv, rank, prospect) {
  if (prospect) {
    const anchor = rank ? rankValue(rank) : null;
    if (anchor != null) {
      const statS = (sv && sv.surplus != null) ? sv.surplus : anchor;
      const blended = r1(SV.rankBlend * anchor + (1 - SV.rankBlend) * clamp(statS, 0, SV.rankCapMult * anchor));
      if (!sv) sv = { war: null, proj: null, projR: null, remWar: null, mkt: null, cost: null, surplus: null };
      sv.surplus = blended; sv.mkt = (sv.cost != null) ? r1(blended + sv.cost) : blended;
    } else if (sv && sv.surplus != null && sv.surplus > SV.unrankedProspectCap) {
      sv.surplus = SV.unrankedProspectCap;
      sv.mkt = (sv.cost != null) ? r1(sv.surplus + sv.cost) : sv.surplus;
    }
  } else if (rank) {
    const floor = r1(rankValue(rank) * 0.5);
    if (!sv) sv = { war: null, proj: null, projR: null, remWar: null, mkt: floor, cost: null, surplus: floor };
    else if (sv.surplus == null || sv.surplus < floor) {
      sv.surplus = floor; if (sv.mkt == null || sv.mkt < floor) sv.mkt = floor;
    }
  }
  return sv;
}

// ---- Trade Value v2 (1-150, calibrated) ----
function tradeValue2(sv, base, pitcher, age, rank, prospect, il, top100) {
  const t = SV.tv;
  let statTV = null;
  if (sv && sv.proj != null) {
    const isRP = pitcher && (!base || !base.sp);
    const full = !pitcher ? SV.hitFullPA : (base && base.sp ? SV.spFullIP : SV.rpFullIP);
    const ann = (base && base.n > 0) ? base.war * full / base.n : sv.proj;
    let proj = Math.max(sv.proj, 0);
    if (/60-day|tommy john/i.test(String(il || ''))) proj *= t.ilQualityMult;
    const annC = Math.min(Math.max(ann, 0), t.annCapMult * proj + t.annCapAdd);
    const aw = isRP ? t.annWRP : t.annW;
    const q = aw * annC + (1 - aw) * proj;
    const top = isRP ? t.topRP : (pitcher ? t.topP : t.topH);
    const qRel = clamp(q / top, 0, 1);
    const ageF = Math.max(t.ageFloor, 1 - t.ageK * Math.max(0, toNum(age, 28) - t.ageFrom));
    const quality = 100 * Math.pow(qRel, t.gamma) * ageF;
    const quantity = Math.min(t.wSur * Math.max(0, sv.surplus || 0), t.surCap);
    let penalty = t.kPen * Math.max(0, sv.cost || 0) * Math.pow(1 - qRel, 2);
    // Big money owed to aging players carries injury/decline risk the surplus
    // math can't see — a long expensive deal on a 31yo is NOT a clean asset.
    penalty += (t.kAgeMoney || 0) * Math.max(0, sv.cost || 0) *
      clamp((toNum(age, 28) - (t.ageMoneyFrom || 29)) / (t.ageMoneySpan || 6), 0, 1);
    let raw = (quality + quantity - penalty + t.floor) * (t.marketMult || 1);
    if (raw > t.squashStart) raw = t.squashStart + t.squashRange * Math.tanh((raw - t.squashStart) / t.squashRange);
    statTV = clamp(raw, 1, t.max);
  }
  if (prospect) {
    let anchor = null;
    if (rank) { anchor = t.prospectAnchors[0][1]; t.prospectAnchors.forEach(x => { if (rank >= x[0]) anchor = x[1]; }); }
    if (top100) {
      const a100 = interp(t.top100Anchors, top100);
      anchor = anchor == null ? a100 : Math.max(anchor, a100);
    }
    if (anchor != null) {
      const s = (statTV == null) ? anchor : Math.min(statTV, t.prospectCapMult * anchor);
      return r1(clamp(t.prospectBlend * anchor + (1 - t.prospectBlend) * s, 1, t.max));
    }
    return statTV == null ? null : r1(Math.min(statTV, t.unrankedProspectCap));
  }
  return statTV == null ? null : r1(statTV);
}

// ---- Salary/control estimation for league-wide players (no public salary API) ----
// Overrides in data-sources/salaries-manual.json take precedence.
function estimateContract(person, season) {
  const debut = person.mlbDebutDate ? parseInt(String(person.mlbDebutDate).slice(0, 4), 10) : null;
  const svc = debut ? Math.max(0, (season || CFG.season) - debut) : 0;
  const control = clamp(6.5 - Math.min(svc, 6), 0.5, 6.5);
  const salM = svc < 3 ? SV.minSalary : (svc < 6 ? 2.0 : null); // null = unknown veteran $
  return { control, salM, estimated: true };
}

module.exports = {
  CFG, SV, clamp, toNum, r1, ipNum, interp, defaultBaselines, posAdj600,
  warHitter, warPitcher, combineHitting, combinePitching,
  ageMult, projectFull, dollarsPerWar, valueFromBase,
  rankValue, adjustProspectValue, tradeValue2, estimateContract,
};
