/**
 * Market calibration.
 *  PUBLIC (docs/data/calibration.json): market temperature, trade counts, and
 *    the Hot Stove score (0-10 from recent trade count + value exchanged).
 *    No model-tuning language — the site is public.
 *  BACKEND: knob suggestions go to reports/model-tuning.md (committed) and the
 *    GitHub Actions run summary — never to the site.
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');
const OUT = path.join(__dirname, '..', 'docs', 'data');
const REPORTS = path.join(__dirname, '..', 'reports');

function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function hotStove(trades) {
  const hs = CFG.hotStove || { days: 14, perTrade: 0.25, valueDiv: 150, max: 10 };
  const cutoff = Date.now() - hs.days * 86400000;
  const recent = trades.filter(t => Date.parse(t.date) >= cutoff);
  let valueSum = 0;
  recent.forEach(t => {
    const totals = (t.sides || []).map(s => s.total || 0);
    valueSum += Math.min(...totals, Infinity) === Infinity ? 0 : Math.min(...totals);
  });
  const score = Math.min(hs.max, recent.length * hs.perTrade + valueSum / hs.valueDiv);
  const label = score < 2 ? 'Cold' : score < 4 ? 'Warming' : score < 6 ? 'Simmering' : score < 8 ? 'Hot' : 'Inferno';
  return { score: Math.round(score * 10) / 10, label, recentTrades: recent.length,
    recentValue: Math.round(valueSum * 10) / 10, windowDays: hs.days };
}

function main() {
  const feedPath = path.join(OUT, 'feed.json');
  if (!fs.existsSync(feedPath)) { console.log('No feed.json yet.'); return; }
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  const usable = feed.trades.filter(t => t.ratio != null);
  const med = median(usable.map(t => t.ratio));

  const starSide = [], prospectHeavy = [];
  usable.forEach(t => {
    const [a, b] = t.sides;
    const maxTv = s => Math.max(...s.players.map(p => p.tv || 0), 0);
    const star = maxTv(a) >= maxTv(b) ? a : b, other = star === a ? b : a;
    if (other.total > 0) starSide.push(star.total / other.total);
    [a, b].forEach(s => {
      const pr = s.players.filter(p => p.prospect).length;
      const o = s === a ? b : a;
      if (s.players.length >= 2 && pr / s.players.length >= 0.67 && o.total > 0) prospectHeavy.push(s.total / o.total);
    });
  });
  const starMed = median(starSide), prMed = median(prospectHeavy);

  // ---- backend-only suggestions ----
  const suggestions = [];
  if (med != null) {
    if (med > 1.3) suggestions.push(`Market trades landing ${Math.round((med - 1) * 100)}% lopsided by our values — consider LOWERING sv.tv.prospectAnchors or RAISING sv.tv.wSur (buyers' MLB pieces may be undervalued).`);
    else if (med < 0.85) suggestions.push(`Trades reverse-lopsided (median ${med}) — consider lowering sv.tv.wSur or prospect anchors.`);
    else suggestions.push(`Median trade balance ${med} — model pricing the market well. No changes suggested.`);
  }
  if (starMed != null && starMed < 0.9) suggestions.push(`Star-receiving sides "losing" by our math (median ${starMed}) — consider raising sv.tv.squashRange or lowering sv.tv.gamma.`);
  if (prMed != null && (prMed < 0.8 || prMed > 1.25)) suggestions.push(`Prospect-heavy packages exchange at ${prMed}x — adjust sv.tv.prospectAnchors ${prMed < 1 ? 'UP' : 'DOWN'}.`);

  const stove = hotStove(feed.trades);

  // PUBLIC file — clean.
  fs.writeFileSync(path.join(OUT, 'calibration.json'), JSON.stringify({
    updated: new Date().toISOString(),
    tradesAnalyzed: usable.length, tradesTotal: feed.trades.length,
    marketTemp: med, hotStove: stove,
  }, null, 1));

  // BACKEND report.
  const report = [
    `# Model tuning report — ${new Date().toISOString().slice(0, 10)}`,
    ``,
    `- Trades analyzed: ${usable.length} of ${feed.trades.length} (fully valued)`,
    `- Median balance: ${med ?? 'n/a'} (1.0 = model matches market)`,
    `- Star-side median: ${starMed ?? 'n/a'} · Prospect-package median: ${prMed ?? 'n/a'}`,
    `- Hot Stove: ${stove.score}/10 (${stove.label}) — ${stove.recentTrades} trades, ${stove.recentValue} value pts in last ${stove.windowDays}d`,
    ``,
    `## Suggestions`,
    ...suggestions.map(s => `- ${s}`),
    ``,
    `Knobs live in config.json under sv.tv (mirror any change in Code.gs).`,
  ].join('\n');
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'model-tuning.md'), report + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  console.log(report);
}

if (require.main === module) main();
module.exports = { median, hotStove };
