// Helper: paste a numbered prospect list (MLB Pipeline / Callis article format),
// get a rankings JSON file. Usage:
//   node src/parse-rankings.js astros 117    (then paste, Ctrl-D when done)
//   node src/parse-rankings.js top100        (for the overall Top 100)
// Accepts lines like: "1. Kevin Alvarez, OF -- Fayetteville (Single-A)" or "12 | Miguel Ullola | RHP".
const fs = require('fs');
const path = require('path');
const { DIR } = require('./rankings.js');

const slug = process.argv[2];
const teamId = process.argv[3] ? parseInt(process.argv[3], 10) : null;
if (!slug) { console.error('usage: node src/parse-rankings.js <team-slug|top100> [teamId]'); process.exit(1); }

let input = '';
process.stdin.on('data', d => input += d);
process.stdin.on('end', () => {
  const prospects = [];
  input.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*(\d+)[.)|\s]+\s*([A-Za-zÀ-ÿ.'\- ]+?)(?:\s*[,|–—-]\s*([A-Z0-9/]{1,4}))?\s*(?:[-–—(].*)?$/);
    if (!m) return;
    const rank = parseInt(m[1], 10);
    const name = m[2].trim().replace(/\s+/g, ' ');
    if (!name || rank < 1 || rank > 120) return;
    const p = { rank, name };
    if (m[3]) p.pos = m[3].replace('RHP', 'SP').replace('LHP', 'SP');
    prospects.push(p);
  });
  if (!prospects.length) { console.error('No ranked lines found.'); process.exit(1); }
  const out = { team: slug, updated: new Date().toISOString().slice(0, 10), prospects };
  if (teamId) out.teamId = teamId;
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, slug + '.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log('Wrote ' + prospects.length + ' prospects -> ' + file);
});
