// Thin MLB Stats API client: pacing, retries, small helpers. Node 20 fetch.
const CFG = require('../config.json');
const BASE = 'https://statsapi.mlb.com/api/v1';

let inFlight = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url, tries = 3) {
  while (inFlight >= (CFG.concurrency || 8)) await sleep(25);
  inFlight++;
  try {
    for (let a = 1; a <= tries; a++) {
      try {
        await sleep(CFG.requestDelayMs || 60);
        const res = await fetch(url, { headers: { 'User-Agent': 'astros-trade-hub' } });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        if (a === tries) { console.warn('  ! fetch failed:', url.slice(0, 110), e.message); return null; }
        await sleep(500 * a);
      }
    }
  } finally { inFlight--; }
}

const api = {
  get,
  teams: () => get(`${BASE}/teams?sportId=1&season=${CFG.season}`),
  roster40: teamId => get(`${BASE}/teams/${teamId}/roster?rosterType=40Man&season=${CFG.season}&hydrate=person(currentAge,mlbDebutDate,batSide,pitchHand,primaryPosition)`),
  seasonStats: (id, pitcher) => get(`${BASE}/people/${id}/stats?stats=season&season=${CFG.season}&group=${pitcher ? 'pitching' : 'hitting'}`),
  seasonStatsSport: (id, pitcher, sportId) => get(`${BASE}/people/${id}/stats?stats=season&season=${CFG.season}&group=${pitcher ? 'pitching' : 'hitting'}&sportId=${sportId}`),
  careerStats: (id, pitcher) => get(`${BASE}/people/${id}/stats?stats=career&group=${pitcher ? 'pitching' : 'hitting'}`),
  yearByYear: (id, pitcher) => get(`${BASE}/people/${id}/stats?stats=yearByYear&group=${pitcher ? 'pitching' : 'hitting'}`),
  person: id => get(`${BASE}/people/${id}`),
  search: name => get(`${BASE}/people/search?names=${encodeURIComponent(name)}&sportIds=1,11,12,13,14,16&hydrate=currentTeam`),
  standings: () => get(`${BASE}/standings?leagueId=103,104&season=${CFG.season}&standingsTypes=regularSeason`),
  teamStats: group => get(`${BASE}/teams/stats?season=${CFG.season}&group=${group}&stats=season&sportId=1`),
  transactions: (start, end) => get(`${BASE}/transactions?startDate=${start}&endDate=${end}&sportId=1`),
};

// Extract the single stat object from a stats response (prefers multi-team total row).
api.statOf = d => {
  const sp = d && d.stats && d.stats[0] && d.stats[0].splits;
  if (!sp || !sp.length) return null;
  const tot = sp.find(x => !x.team);
  return (tot || sp[0]).stat;
};

// Live league baselines with config fallback.
api.leagueBaselines = async function (E) {
  const b = E.defaultBaselines();
  try {
    const h = await api.teamStats('hitting');
    const hs = (h.stats[0].splits || []).map(x => x.stat);
    if (hs.length) {
      b.obp = hs.reduce((a, r) => a + E.toNum(r.obp, 0), 0) / hs.length;
      b.slg = hs.reduce((a, r) => a + E.toNum(r.slg, 0), 0) / hs.length;
    }
    const p = await api.teamStats('pitching');
    const ps = (p.stats[0].splits || []).map(x => x.stat);
    if (ps.length) {
      b.era = ps.reduce((a, r) => a + E.toNum(r.era, 0), 0) / ps.length;
      let HR = 0, BB = 0, K = 0, IP = 0;
      ps.forEach(r => { HR += E.toNum(r.homeRuns, 0); BB += E.toNum(r.baseOnBalls, 0); K += E.toNum(r.strikeOuts, 0); IP += E.ipNum(r.inningsPitched); });
      if (IP > 0) b.fipC = b.era - (13 * HR + 3 * BB - 2 * K) / IP;
    }
  } catch (e) { console.warn('league baselines fallback:', e.message); }
  b.woba = (1.8 * b.obp + b.slg) / 3;
  return b;
};

module.exports = api;
