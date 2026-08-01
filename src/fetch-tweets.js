/**
 * Reporters Feed -> docs/data/reporters.json
 *
 * Source: an rss.app bridge over the "@ApolloJosh1/MLB Reporters" X List.
 *
 * Why a bridge rather than X directly: X stopped rendering embedded timelines
 * for logged-out visitors — widgets.js loads, the iframe appears, and it never
 * resolves. That's true of profile AND list timelines, and oEmbed only returns
 * real content for a single tweet, not a timeline. The bridge turns the list
 * into ordinary RSS, which we can fetch server-side at build time.
 *
 * Each item carries the tweet as an oEmbed-style <blockquote> in its
 * description. We keep the <p> (text plus links), drop everything else —
 * including the platform.twitter.com <script> tag, so nothing from X executes
 * on our page and there's no third-party tracker.
 *
 * Adding a reporter is a change to the X List, not to this repo.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data-sources', 'reporter-tweets.json');
const OUT = path.join(__dirname, '..', 'docs', 'data', 'reporters.json');

const decodeText = s => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&(?:mdash|ndash);/g, '—').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

const cdata = s => String(s || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? cdata(m[1]) : null;
};

// Keep links and line breaks; strip anything that could execute or restyle.
function sanitize(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?(?!a\b|br\b|b\b|i\b|em\b|strong\b)[a-z][^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:style|class|data-[\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<a\b/gi, '<a target="_blank" rel="noopener"')
    .trim();
}

// The blockquote holds the tweet text in <p>, then a "— @handle <a>date</a>"
// trailer we render ourselves. Take the <p> only.
function bodyOf(descr) {
  const p = descr.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return sanitize(p ? p[1] : descr.replace(/<blockquote[^>]*>|<\/blockquote>/gi, ''));
}

const STATUS = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/;

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No reporter-tweets.json — skipping.'); return; }
  const cfg = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const reporters = cfg.reporters || {};
  const MAX = cfg.maxItems || 60;
  const MAX_AGE_H = cfg.maxAgeHours != null ? cfg.maxAgeHours : 72;

  if (!cfg.feed) { console.log('No feed url configured — skipping.'); return; }

  let xml;
  try {
    const r = await fetch(cfg.feed, { headers: { 'User-Agent': 'astros-trade-hub' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    xml = await r.text();
  } catch (e) {
    console.error(`  feed fetch failed: ${e.message} — leaving previous reporters.json in place`);
    return;   // never blank the tab because of one bad fetch
  }

  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const seen = new Set();
  const items = [];
  for (const b of blocks) {
    const link = tag(b, 'link');
    if (!link) continue;
    const m = link.match(STATUS);
    const id = m ? m[2] : null;
    const handle = m ? m[1] : String(tag(b, 'dc:creator') || '').replace(/^@/, '');
    if (!handle || (id && seen.has(id))) continue;
    if (id) seen.add(id);

    const pub = tag(b, 'pubDate');
    const ts = pub ? Date.parse(pub) : NaN;
    const descr = tag(b, 'description') || '';
    const html = bodyOf(descr);
    const text = decodeText(html);
    if (!text) continue;

    const img = b.match(/<media:content[^>]*\surl=["']([^"']+)["']/i);
    const key = handle.toLowerCase();
    const rep = reporters[key];
    items.push({
      id: id || handle + ts, handle, key,
      author: rep ? rep.name : '@' + handle,
      listed: !!rep || undefined,
      url: link, html, text,
      date: isNaN(ts) ? null : new Date(ts).toISOString(),
      ts: isNaN(ts) ? 0 : ts,
      image: img ? img[1] : undefined,
    });
  }

  items.sort((a, b) => b.ts - a.ts);
  const newest = items.length ? items[0].ts : 0;
  const ageH = newest ? (Date.now() - newest) / 3.6e6 : null;
  const stale = !newest || ageH > MAX_AGE_H;

  const out = {
    updated: new Date().toISOString(),
    feed: cfg.feed, maxAgeHours: MAX_AGE_H,
    newest: newest ? new Date(newest).toISOString() : null,
    ageHours: ageH == null ? null : Math.round(ageH * 10) / 10,
    stale: stale || undefined,
    reporters,
    tweets: items.slice(0, MAX).map(({ ts, ...rest }) => rest),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  const byRep = items.reduce((a, i) => { a[i.key] = (a[i.key] || 0) + 1; return a; }, {});
  console.log(`reporters.json: ${out.tweets.length} tweets, newest ` +
    `${ageH == null ? 'n/a' : Math.round(ageH * 10) / 10 + 'h'} old${stale ? ' — STALE' : ''}`);
  console.log('  ' + Object.entries(byRep).sort((a, b) => b[1] - a[1])
    .map(([h, n]) => `@${h}:${n}`).join(' '));
})().catch(e => { console.error('fetch-tweets failed:', e.message); process.exit(1); });
