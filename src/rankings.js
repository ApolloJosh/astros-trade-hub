// Prospect rankings come from checked-in JSON (no public Pipeline API).
// data-sources/rankings/<team-slug>.json: {"team":"astros","teamId":117,"updated":"...",
//   "prospects":[{"rank":1,"name":"Kevin Alvarez","mlbid":829037,"pos":"OF"}, ...]}
// data-sources/rankings/top100.json: {"updated":"...","prospects":[{"rank":1,"name":"...","mlbid":...}, ...]}
// Update any list with: npm run rankings  (paste a numbered list, get JSON).
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data-sources', 'rankings');

function loadAll() {
  const teams = {};   // teamId -> [{rank,name,mlbid,pos}]
  let top100 = {};    // mlbid or normalized name -> overall rank
  if (!fs.existsSync(DIR)) return { teams, top100 };
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
    if (f === 'top100.json') {
      (j.prospects || []).forEach(p => {
        if (p.mlbid) top100['id' + p.mlbid] = p.rank;
        top100[norm(p.name)] = p.rank;
      });
    } else if (j.teamId) {
      teams[j.teamId] = j.prospects || [];
    }
  }
  return { teams, top100 };
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

function top100Rank(top100, mlbid, name) {
  return top100['id' + mlbid] || top100[norm(name)] || null;
}

module.exports = { loadAll, norm, top100Rank, DIR };
