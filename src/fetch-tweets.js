/**
 * Reporters Feed -> docs/data/reporters.json
 *
 * X killed embedded PROFILE timelines for logged-out visitors — widgets.js
 * loads, the iframe appears, and it never resolves. Pulling recent tweets
 * automatically now needs the paid X API. What still works, free and official,
 * is the oEmbed endpoint for a SPECIFIC tweet:
 *
 *   https://publish.twitter.com/oembed?url=<tweet>&omit_script=1
 *
 * With omit_script=1 that returns a self-contained <blockquote> holding the
 * tweet text, author, date and permalink — no X JavaScript on our page, which
 * also means no third-party tracker and nothing to break at showtime.
 *
 * So: tweet URLs are curated in data-sources/reporter-tweets.json, and this
 * resolves each one at build time and caches the markup. Cached entries are
 * reused, so a rebuild costs one request per NEW url, not per url.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data-sources', 'reporter-tweets.json');
const OUT = path.join(__dirname, '..', 'docs', 'data', 'reporters.json');
const OEMBED = 'https://publish.twitter.com/oembed';

// Accept x.com and twitter.com; capture handle + numeric status id.
const TWEET_RE = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/;

function parse(url) {
  const m = String(url || '').trim().match(TWEET_RE);
  return m ? { handle: m[1], id: m[2] } : null;
}

async function oembed(handle, id) {
  // Always ask twitter.com — x.com URLs 404 against oEmbed in some regions.
  const u = `${OEMBED}?url=${encodeURIComponent(`https://twitter.com/${handle}/status/${id}`)}` +
    `&omit_script=1&dnt=true&maxwidth=550&hide_thread=false`;
  const r = await fetch(u, { headers: { 'User-Agent': 'astros-trade-hub' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || !j.html) throw new Error('no html');
  return j;
}

// The blockquote carries markup we don't control, so keep only what we render:
// links, line breaks and basic inline tags. Nothing can execute.
function sanitize(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}
// Plain text fallback for the card preview and for search.
function textOf(html) {
  return sanitize(html).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&(?:mdash|ndash);/g, '—').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')   // last, so &amp;lt; doesn't double-decode
    .replace(/\s+/g, ' ').trim();
}

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No reporter-tweets.json — skipping.'); return; }
  const cfg = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const reporters = cfg.reporters || {};
  const allow = new Set(Object.keys(reporters).map(h => h.toLowerCase()));

  // Reuse anything already resolved so rebuilds don't re-hit the endpoint.
  let cache = {};
  try { cache = (JSON.parse(fs.readFileSync(OUT, 'utf8')).tweets || [])
    .reduce((a, t) => { a[t.id] = t; return a; }, {}); } catch (e) {}

  const seen = new Set(), items = [];
  let fetched = 0, skipped = 0, failed = 0;

  for (const raw of (cfg.tweets || [])) {
    const p = parse(raw);
    if (!p) { console.warn(`  skip (not a tweet url): ${String(raw).slice(0, 60)}`); skipped++; continue; }
    if (!allow.has(p.handle.toLowerCase())) {
      console.warn(`  skip (@${p.handle} not in reporters list)`); skipped++; continue;
    }
    if (seen.has(p.id)) continue;
    seen.add(p.id);

    if (cache[p.id]) { items.push(cache[p.id]); continue; }
    try {
      const j = await oembed(p.handle, p.id);
      const html = sanitize(j.html);
      items.push({ id: p.id, handle: p.handle, author: j.author_name || p.handle,
        url: j.url || `https://twitter.com/${p.handle}/status/${p.id}`,
        html, text: textOf(j.html) });
      fetched++;
      await new Promise(r => setTimeout(r, 250));   // be polite
    } catch (e) {
      console.warn(`  failed ${p.handle}/${p.id}: ${e.message}`);
      failed++;
    }
  }

  // Tweet ids are snowflakes — numerically ordered by time, so sorting on the
  // id puts newest first no matter what order they were pasted in.
  items.sort((a, b) => (a.id.length - b.id.length) || b.id.localeCompare(a.id));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    updated: new Date().toISOString(), reporters, tweets: items,
  }));
  console.log(`reporters.json: ${items.length} tweets (${fetched} newly fetched, ` +
    `${items.length - fetched} cached, ${skipped} skipped, ${failed} failed)`);
})().catch(e => { console.error('fetch-tweets failed:', e.message); process.exit(1); });
