/**
 * Ingest Cot's Contracts team payroll sheets (public Google Sheets) into
 * data-sources/salaries-cots.json: real control years + remaining salary for
 * every player listed. Precedence in the pipeline: salaries-manual.json >
 * Cot's > service-time estimate.
 *
 * Cot's row anatomy (per player):
 *   "Last, First" | pos | draft yr | ... | service "8.160" | ... | terms |
 *   | $2026 (full $) | $2027 ($M like "42.500") | ... | "FA" where control ends
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');
const { parseCsv } = require('./build-data.js');
const { norm } = require('./rankings.js');

const SHEETS_PATH = path.join(__dirname, '..', 'data-sources', 'cots-sheets.json');
const OUT_PATH = path.join(__dirname, '..', 'data-sources', 'salaries-cots.json');

const NAME_RE = /^[A-ZÀ-Þ][A-Za-zÀ-ÿ'. -]+,\s*[A-ZÀ-Þ]/;
const SVC_RE = /^\d{1,2}\.\d{3}$/;

function money(v) {
  const s = String(v == null ? '' : v).trim();
  // Reject blanks and non-salary markers: "FA", "A1"-"A4" (arb years), "opt".
  if (!s || /^[A-Za-z]/.test(s)) return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  if (isNaN(n) || n <= 0) return null;
  return n >= 1000 ? n / 1e6 : n;   // "$42,500,000" -> 42.5 ; "42.500" -> 42.5
}

function parseTeam(rows, season) {
  // Locate the year columns: first row containing season AND season+1 as cells.
  let yearCols = null;
  for (const r of rows) {
    const i = r.findIndex(c => String(c).trim() === String(season));
    if (i >= 0 && String(r[i + 1] || '').trim() === String(season + 1)) {
      yearCols = [i, i + 1, i + 2, i + 3, i + 4].filter(j => {
        const y = String(r[j] || '').trim();
        return y === String(season + (j - i));
      });
      break;
    }
  }
  if (!yearCols) return [];

  const players = [];
  for (const r of rows) {
    const cell0 = String(r[0] || '').trim();
    if (!NAME_RE.test(cell0)) continue;
    const [last, first] = cell0.replace(/\*+/g, '').split(',').map(s => s.trim());
    if (!first) continue;
    const name = (first + ' ' + last).replace(/\s+/g, ' ');
    const svcCell = r.slice(1, 10).map(c => String(c).trim()).find(c => SVC_RE.test(c));
    const svc = svcCell ? parseFloat(svcCell) : null;

    // Salaries across listed years until FA / blank.
    const sal = yearCols.map(j => ({ v: money(r[j]), fa: /^fa$/i.test(String(r[j] || '').trim()) }));
    let years = 0, total = 0, sawFA = false;
    for (const s of sal) {
      if (s.fa) { sawFA = true; break; }
      if (s.v == null) break;
      total += years === 0 ? 0.5 * s.v : s.v;   // half of the current season remains
      years++;
    }
    if (!years) continue;

    let control;
    if (years > 1 || sawFA) control = 0.5 + (years - 1);       // contract tells us exactly
    else if (svc != null) control = Math.min(6.5, Math.max(0.5, 5.5 - Math.floor(svc))); // arb/pre-arb via service
    else control = 0.5 + (years - 1);

    const salaryM = years > 1 ? total / control : sal[0].v;    // engine: cost ≈ salaryM × control
    players.push({ name, key: norm(name), svc, control: Math.round(control * 10) / 10,
      salaryM: Math.round(salaryM * 1000) / 1000, remM: Math.round(total * 10) / 10, exactFA: sawFA || years > 1 });
  }
  return players;
}

async function main() {
  if (!fs.existsSync(SHEETS_PATH)) { console.log('No cots-sheets.json — skipping salary fetch.'); return; }
  const sheets = JSON.parse(fs.readFileSync(SHEETS_PATH, 'utf8'));
  const out = { updated: new Date().toISOString(), season: CFG.season, teams: {} };
  for (const [teamId, sheetId] of Object.entries(sheets)) {
    if (teamId.startsWith('_')) continue;
    try {
      // Normal share IDs use gviz; published "2PACX-" IDs use the /d/e/ pub CSV.
      const url = sheetId.startsWith('2PACX')
        ? `https://docs.google.com/spreadsheets/d/e/${sheetId}/pub?output=csv&cb=${Date.now()}`
        : `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&cb=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const rows = parseCsv(await res.text());
      const players = parseTeam(rows, CFG.season);
      out.teams[teamId] = players;
      console.log(`  team ${teamId}: ${players.length} contracts parsed`);
    } catch (e) { console.warn(`  ! team ${teamId} failed:`, e.message); }
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1));
  const n = Object.values(out.teams).reduce((a, t) => a + t.length, 0);
  console.log(`DONE: ${n} contracts -> ${OUT_PATH}`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { parseTeam, money };
