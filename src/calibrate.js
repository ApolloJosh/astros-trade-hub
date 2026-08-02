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

/**
 * Market temperature.
 *
 * The old version counted every trade in the window equally, so eight deals in
 * three days scored the same as eight spread over a fortnight — which is not
 * what a hot stove is. Each trade now decays on a half-life, so recent activity
 * dominates and the number falls away on its own once things go quiet.
 */
function hotStove(trades) {
  const hs = Object.assign(
    { days: 14, halfLifeDays: 3, perTrade: 0.9, valueDiv: 60, max: 10 },
    CFG.hotStove || {});
  const bands = hs.bands || [[2, 'Cold'], [4, 'Warming'], [6, 'Simmering'], [8, 'Hot'], [999, 'Inferno']];
  const now = Date.now();
  const cutoff = now - hs.days * 86400000;
  const recent = trades.filter(t => Date.parse(t.date) >= cutoff);

  let wTrades = 0, wValue = 0, valueSum = 0, newest = null;
  recent.forEach(t => {
    const ts = Date.parse(t.date);
    // Feed dates are day-resolution, so today's trades can look slightly future.
    const ageDays = Math.max(0, (now - ts) / 86400000);
    const w = Math.pow(0.5, ageDays / hs.halfLifeDays);
    // The smaller side is what actually changed hands; a lopsided salary dump
    // shouldn't read as a blockbuster.
    const totals = (t.sides || []).map(s => s.total || 0).filter(v => v > 0);
    const v = totals.length ? Math.min(...totals) : 0;
    wTrades += w; wValue += w * v; valueSum += v;
    if (newest == null || ts > newest) newest = ts;
  });

  const score = Math.min(hs.max, wTrades * hs.perTrade + wValue / hs.valueDiv);
  const label = (bands.find(b => score < b[0]) || bands[bands.length - 1])[1];
  return {
    score: Math.round(score * 10) / 10, label,
    recentTrades: recent.length,
    recentValue: Math.round(valueSum * 10) / 10,
    // Effective trade count after decay — the reason a burst outscores a drip.
    weightedTrades: Math.round(wTrades * 10) / 10,
    last24h: recent.filter(t => now - Date.parse(t.date) <= 86400000).length,
    last72h: recent.filter(t => now - Date.parse(t.date) <= 3 * 86400000).length,
    hoursSinceLast: newest == null ? null : Math.round((now - newest) / 36e5 * 10) / 10,
    halfLifeDays: hs.halfLifeDays, windowDays: hs.days,
  };
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
