// Latest Beyond the Diamond stream -> docs/data/youtube.json
//
// Priority: a pinned video always wins, then a stream that's live right now,
// then the most recent past live stream, then the newest upload of any kind.
// YouTube exposes a channel's live streams as a pseudo-playlist (UULV + the
// channel id minus its UC prefix), so this needs no API key or quota.
// Failure is non-fatal: an existing file is kept so the front page never
// loses its embed because YouTube had a bad minute.
const fs = require('fs');
const path = require('path');

const CFGF = path.join(__dirname, '..', 'data-sources', 'youtube.json');
const OUTF = path.join(__dirname, '..', 'docs', 'data', 'youtube.json');
const CFG = (() => {
  try { return JSON.parse(fs.readFileSync(CFGF, 'utf8')); } catch (e) { return {}; }
})();

const ID_RE = /^[\w-]{11}$/;
// Accepts a bare id or any YouTube URL shape (watch, youtu.be, /live/, /embed/).
function videoId(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  if (ID_RE.test(v)) return v;
  const m = v.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function text(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'astros-trade-hub', 'Accept-Language': 'en-US' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) { last = e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
  }
  throw last;
}

const unesc = s => String(s || '').replace(/&(amp|lt|gt|quot|#39|apos);/g,
  m => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" }[m]));

// Newest entry from a YouTube RSS feed.
function parseFeed(xml) {
  const out = [];
  String(xml || '').split('<entry>').slice(1).forEach(e => {
    const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    const published = (e.match(/<published>(.*?)<\/published>/) || [])[1];
    if (id) out.push({ id, title: unesc(title || '').trim(), published: published || null });
  });
  return out.sort((a, b) => String(b.published || '').localeCompare(String(a.published || '')));
}

// Is the channel on air right now? The live page embeds the video id and a
// live flag; both have to be present to count.
function parseLive(html) {
  const h = String(html || '');
  const on = /"isLiveNow"\s*:\s*true/.test(h) || /"isLive"\s*:\s*true/.test(h) ||
    /"liveBroadcastContent"\s*:\s*"live"/.test(h) || /hlsManifestUrl/.test(h);
  if (!on) return null;
  const id = (h.match(/"videoId"\s*:\s*"([\w-]{11})"/) || [])[1];
  if (!id) return null;
  const title = (h.match(/<meta\s+name="title"\s+content="([^"]*)"/) ||
    h.match(/"title"\s*:\s*"([^"]{3,160})"/) || [])[1];
  return { id, title: unesc(title || 'Live now').trim(), published: null, live: true };
}

async function resolve(chan, fetchText) {
  const pin = videoId(CFG.pin);
  if (pin) return { video: { id: pin, title: CFG.pinTitle || '', published: null, live: !!CFG.pinLive }, source: 'pinned' };

  // live right now
  try {
    const live = parseLive(await fetchText(`https://www.youtube.com/channel/${chan}/live`));
    if (live) return { video: live, source: 'live' };
  } catch (e) { /* not live, or YouTube said no — keep going */ }

  // most recent past live stream
  const livePl = 'UULV' + chan.replace(/^UC/, '');
  try {
    const v = parseFeed(await fetchText(`https://www.youtube.com/feeds/videos.xml?playlist_id=${livePl}`))[0];
    if (v) return { video: { ...v, live: false }, source: 'live-archive' };
  } catch (e) { /* channel may have no live tab */ }

  // newest upload of any kind
  const v = parseFeed(await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${chan}`))[0];
  if (v) return { video: { ...v, live: false }, source: 'uploads' };
  throw new Error('no videos found');
}

async function main() {
  const chan = CFG.channelId;
  if (!chan) { console.warn('youtube: no channelId configured — skipped.'); return; }
  const handle = CFG.handle ? String(CFG.handle).replace(/^@/, '') : null;
  try {
    const { video, source } = await resolve(chan, text);
    fs.mkdirSync(path.dirname(OUTF), { recursive: true });
    fs.writeFileSync(OUTF, JSON.stringify({
      updated: new Date().toISOString(),
      channelId: chan,
      channelUrl: handle ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${chan}`,
      video, source,
    }) + '\n');
    console.log(`youtube.json: ${source} — ${video.title || video.id}${video.live ? ' (LIVE)' : ''}`);
  } catch (e) {
    console.warn('fetch-youtube failed — keeping previous file:', e.message);
    if (!fs.existsSync(OUTF)) {
      fs.mkdirSync(path.dirname(OUTF), { recursive: true });
      fs.writeFileSync(OUTF, JSON.stringify({
        channelId: chan,
        channelUrl: handle ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${chan}`,
        video: null,
      }) + '\n');
    }
  }
}

module.exports = { videoId, parseFeed, parseLive, resolve };
if (require.main === module) main();
