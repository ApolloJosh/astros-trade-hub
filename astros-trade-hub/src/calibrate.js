/**
 * Market calibration: compare real trades (feed.json) against our values.
 * Writes docs/data/calibration.json with a market temperature and knob
 * suggestions. Deliberately does NOT auto-tune — review, then adjust
 * config.json (sv.tv.marketMult or specific knobs) and commit.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'docs', 'data');

function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function main() {
  const feedPath = path.join(OUT, 'feed.json');
  if (!fs.existsSync(feedPath)) { console.log('No feed.json yet.'); return; }
  const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
  const usable = feed.trades.filter(t => t.ratio != null);

  const ratios = usable.map(t => t.ratio);
  const med = median(ratios);

  // Which side got the star? Compare max single TV per side.
  const starSide = [];   // ratio of (side receiving the best player) / other side
  const prospectHeavy = []; // trades where one side is >=2/3 prospects: their total / other side
  usable.forEach(t => {
    const [a, b] = t.sides;
    const maxTv = s => Math.max(...s.players.map(p => p.tv || 0), 0);
    const star = maxTv(a) >= maxTv(b) ? a : b, other = star === a ? b : a;
    if (other.total > 0) starSide.push(star.total / other.total);
    [a, b].forEach((s, i) => {
      const pr = s.players.filter(p => p.prospect).length;
      const o = s === a ? b : a;
      if (s.players.length >= 2 && pr / s.players.length >= 0.67 && o.total > 0) prospectHeavy.push(s.total / o.total);
    });
  });

  const suggestions = [];
  if (med != null) {
    if (med > 1.3) suggestions.push(`Market trades are landing ${Math.round((med - 1) * 100)}% lopsided by our values — sellers are accepting less than the model expects. Consider LOWERING sv.tv.prospectAnchors or raising sv.tv.wSur (buyers' MLB pieces may be undervalued).`);
    else if (med < 0.85) suggestions.push(`Trades look reverse-lopsided (median ${med}) — the model may be overvaluing what buyers send. Consider lowering sv.tv.wSur or prospect anchors.`);
    else suggestions.push(`Median trade balance ${med} — the model is pricing the market well. No knob changes suggested.`);
  }
  const starMed = median(starSide);
  if (starMed != null && starMed < 0.9)
    suggestions.push(`Sides receiving the best player are "losing" trades by our math (median ${starMed}) — stars may deserve MORE value: raise sv.tv.squashRange or lower sv.tv.gamma.`);
  const prMed = median(prospectHeavy);
  if (prMed != null && (prMed < 0.8 || prMed > 1.25))
    suggestions.push(`Prospect-heavy packages exchange at ${prMed}x — adjust sv.tv.prospectAnchors ${prMed < 1 ? 'UP' : 'DOWN'} to match the market.`);

  const out = {
    updated: new Date().toISOString(),
    tradesAnalyzed: usable.length, tradesTotal: feed.trades.length,
    marketTemp: med,                       // 1.0 = our values match the market
    starSideMedian: starMed, prospectPkgMedian: prMed,
    suggestions,
  };
  fs.writeFileSync(path.join(OUT, 'calibration.json'), JSON.stringify(out, null, 2));
  console.log('Calibration:', JSON.stringify(out, null, 2));
}

if (require.main === module) main();
module.exports = { median };
