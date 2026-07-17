// Helper: paste ANY prospect list and get a rankings JSON file.
// Accepts numbered lists ("1. Kevin Alvarez, OF -- Fayetteville") AND raw
// select-all copies of the MLB Pipeline table (rank / headshot line / name /
// position on separate lines).
// Usage:
//   node src/parse-rankings.js astros 117    (paste, then Ctrl-D)
//   node src/parse-rankings.js top100
const fs = require('fs');
const path = require('path');
const { DIR } = require('./rankings.js');

const slug = process.argv[2];
const teamId = process.argv[3] ? parseInt(process.argv[3], 10) : null;
if (!slug) { console.error('usage: node src/parse-rankings.js <team-slug|top100> [teamId]'); process.exit(1); }

const POS = /^(C|1B|2B|3B|SS|IF|OF|LF|CF|RF|DH|UT|RHP|LHP|SP|RP|TWP|P|SS\/3B|3B\/SS|C\/1B|[A-Z0-9]{1,3}\/[A-Z0-9]{1,3})$/;
const JUNK = /^(photo headshot|show full list|rank|player|position|team|level|eta|age|height|bats|throws|\d{4}|\d ?' ?\d|[\d/]+ lbs|[LRS])$/i;
const cleanName = s => s.replace(/^photo headshot of /i, '').replace(/\s+/g, ' ').trim();
// Allow internal capitals (JoJo, DeLauter, McKenna) and suffixes (Jr., III).
const looksLikeName = s => /^[A-ZÀ-Þ][A-Za-zÀ-ÿ'.-]+(\s+[A-Za-zÀ-ÿ'.\-]+){1,3}$/.test(s) && !JUNK.test(s);

function parse(input) {
  // Pass 1: classic numbered lines.
  const out = [];
  input.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*(\d+)[.)|\s]+\s*([A-Za-zÀ-ÿ.'\- ]+?)(?:\s*[,|–—-]\s*([A-Z0-9/]{1,6}))?\s*(?:\s[-–—(].*|\(.*)?$/);
    if (!m) return;
    const rank = parseInt(m[1], 10), name = cleanName(m[2]);
    if (rank >= 1 && rank <= 120 && looksLikeName(name)) {
      const p = { rank, name };
      if (m[3] && POS.test(m[3])) p.pos = m[3].split('/')[0].replace('RHP', 'SP').replace('LHP', 'SP');
      out.push(p);
    }
  });
  if (out.length >= 3) return out;

  // Pass 2: table copy — rank on its own line, name (or headshot line) after.
  out.length = 0;
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d{1,3}$/.test(lines[i])) continue;
    const rank = parseInt(lines[i], 10);
    if (rank < 1 || rank > 120) continue;
    let name = null, pos = null;
    for (let j = i + 1; j <= i + 5 && j < lines.length; j++) {
      if (/^\d{1,3}$/.test(lines[j])) break;             // next rank
      const cand = cleanName(lines[j]);
      if (!name && looksLikeName(cand)) { name = cand; continue; }
      if (name && !pos && POS.test(lines[j])) { pos = lines[j].split('/')[0].replace('RHP', 'SP').replace('LHP', 'SP'); break; }
    }
    if (name && !out.some(p => p.rank === rank)) {
      const p = { rank, name }; if (pos) p.pos = pos;
      out.push(p);
    }
  }
  return out;
}

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const prospects = parse(input).sort((a, b) => a.rank - b.rank);
  if (!prospects.length) { console.error('No ranked lines found — paste the numbered list or the full table text.'); process.exit(1); }
  const outObj = { team: slug, updated: new Date().toISOString().slice(0, 10), prospects };
  if (teamId) outObj.teamId = teamId;
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, slug + '.json');
  fs.writeFileSync(file, JSON.stringify(outObj, null, 2));
  console.log(`Wrote ${prospects.length} prospects -> ${file}`);
  prospects.slice(0, 5).forEach(p => console.log('  #' + p.rank, p.name, p.pos || ''));
});
