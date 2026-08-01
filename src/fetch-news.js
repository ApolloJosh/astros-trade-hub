/**
 * League news -> docs/data/news.json
 *
 * ESPN's MLB RSS already ships a one-or-two sentence summary in <description>,
 * so there's nothing to generate: we take their own excerpt, cap it at three
 * sentences, and always link back. Headline + excerpt + link is what a feed is
 * published for; we never pull article bodies.
 *
 * STALENESS GUARD — the reason this file is careful. MLBTradeRumors' /feed
 * still returns HTTP 200 with perfectly valid RSS whose newest item is from
 * 2018. Nothing errors; you just silently publish eight-year-old rumors. So
 * every feed is checked for freshness and anything past maxAgeHours is marked
 * stale and withheld from the page rather than shown.
 */
const fs = require('fs');
const path = require('path');
const CFG = require('../config.json');

const OUT = path.join(__dirname, '..', 'docs', 'data', 'news.json');
const NEWS = CFG.news || {};
const FEEDS = NEWS.feeds || [
  { name: 'ESPN MLB', url: 'https://www.espn.com/espn/rss/mlb/news' },
];
const MAX_AGE_H = NEWS.maxAgeHours != null ? NEWS.maxAgeHours : 96;
const MAX_ITEMS = NEWS.maxItems != null ? NEWS.maxItems : 40;
const MAX_SENTENCES = NEWS.maxSentences != null ? NEWS.maxSentences : 3;
const MAX_CHARS = NEWS.maxChars != null ? NEWS.maxChars : 320;

const decode = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/&(?:mdash|ndash);/g, '—').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')          // last, so &amp;lt; can't double-decode
  .replace(/\s+/g, ' ').trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? decode(m[1]) : null;
};
// MLB.com ships artwork as a self-closing <image href="…"/>, which the tag
// matcher above can't see; others use <enclosure url="…" type="image/*">.
const imageOf = xml => {
  const img = xml.match(/<image[^>]*\shref=["']([^"']+)["']/i);
  if (img) return img[1];
  const enc = xml.match(/<enclosure[^>]*\surl=["']([^"']+)["'][^>]*type=["']image\//i);
  return enc ? enc[1] : null;
};

// ESPN truncates some titles with a trailing ellipsis; the description carries
// the real substance, so that's what gets trimmed to sentence count.
function distill(text) {
  if (!text) return '';
  const parts = text.match(/[^.!?]+[.!?]+(?:["'”]|\s|$)|[^.!?]+$/g) || [text];
  let out = parts.slice(0, MAX_SENTENCES).map(s => s.trim()).join(' ').replace(/\s+/g, ' ').trim();
  if (out.length > MAX_CHARS) {
    // Leave room for the ellipsis so the result never exceeds MAX_CHARS.
    out = out.slice(0, MAX_CHARS - 1);
    const cut = Math.max(out.lastIndexOf('. '), out.lastIndexOf(' '));
    if (cut > (MAX_CHARS - 1) * 0.6) out = out.slice(0, cut);
    out = out.replace(/[\s,;:]+$/, '') + '…';
  }
  return out;
}

const HOU = /\bastros\b|\bhouston\b/i;

async function pull(feed) {
  const r = await fetch(feed.url, { headers: { 'User-Agent': 'astros-trade-hub' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const xml = await r.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const items = [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    const link = tag(b, 'link');
    if (!title || !link) continue;
    const pub = tag(b, 'pubDate');
    const ts = pub ? Date.parse(pub) : NaN;
    // MLB.com leaves <description> off many items but repeats the standfirst
    // in <content:encoded>, so fall back to that before giving up.
    const summary = distill(tag(b, 'description') || tag(b, 'content:encoded'));
    items.push({
      title, link, source: feed.name,
      author: tag(b, 'dc:creator') || tag(b, 'creator') || null,
      date: isNaN(ts) ? null : new Date(ts).toISOString(),
      ts: isNaN(ts) ? 0 : ts,
      summary,
      image: imageOf(b) || undefined,
      astros: HOU.test(title + ' ' + summary) || undefined,
    });
  }
  return items;
}

(async () => {
  const now = Date.now();
  const all = [];
  const sources = [];
  for (const f of FEEDS) {
    let items = [];
    let err = null;
    try { items = await pull(f); }
    catch (e) { err = e.message; console.warn(`  ${f.name}: ${e.message}`); }
    const newest = items.reduce((a, b) => Math.max(a, b.ts || 0), 0);
    const ageH = newest ? (now - newest) / 3.6e6 : null;
    const stale = !newest || ageH > MAX_AGE_H;
    sources.push({ name: f.name, url: f.url, items: items.length,
      newest: newest ? new Date(newest).toISOString() : null,
      ageHours: ageH == null ? null : Math.round(ageH * 10) / 10, stale, error: err || undefined });
    if (stale) {
      console.warn(`  ${f.name}: STALE (newest ${ageH == null ? 'n/a' : Math.round(ageH) + 'h'} old, ` +
        `limit ${MAX_AGE_H}h) — withheld`);
      continue;   // never publish a frozen feed
    }
    all.push(...items);
    console.log(`  ${f.name}: ${items.length} items, newest ${Math.round(ageH)}h old`);
  }

  // Dedupe on link, newest first.
  const seen = new Set();
  const items = all.filter(i => (seen.has(i.link) ? false : seen.add(i.link)))
    .sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS)
    .map(({ ts, ...rest }) => rest);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    updated: new Date().toISOString(), maxAgeHours: MAX_AGE_H, sources, items,
  }));
  const nAstros = items.filter(i => i.astros).length;
  console.log(`news.json: ${items.length} items (${nAstros} Astros-related) from ` +
    `${sources.filter(s => !s.stale).length}/${sources.length} live feeds`);
})().catch(e => { console.error('fetch-news failed:', e.message); process.exit(1); });
