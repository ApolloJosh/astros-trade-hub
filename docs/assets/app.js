// Shared helpers for all pages.
(function cleanURL() {
  // GitHub Pages serves pages with or without .html — show the clean form.
  if (location.protocol !== 'file:' && /\.html$/.test(location.pathname)) {
    const p = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
    history.replaceState(null, '', p + location.search + location.hash);
  } else if (location.protocol === 'file:') {
    // Local preview from disk: put .html back on internal links.
    addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('a[href]').forEach(a => {
        const h = a.getAttribute('href');
        if (/^(index|builder|feed|fan|fits)([?#]|$)/.test(h)) a.setAttribute('href', h.replace(/^(\w+)/, '$1.html'));
      });
    });
  }
})();
(function applyTheme() {  // The Wheel is the house style
  document.documentElement.dataset.theme = 'wheel';
  if (document.body) document.body.dataset.theme = 'wheel';
  else addEventListener('DOMContentLoaded', () => document.body.dataset.theme = 'wheel');
})();
window.BTD = (function () {
  // Fan Trades backend (Google Apps Script Web App /exec URL). Empty = feature hidden.
  const FAN_URL = 'https://script.google.com/macros/s/AKfycbxwOBVkYQDwKBag8srvgyK-5dFDfS8e7fysyTjWHmq2f42NU1LXiIlZEMRNIMDtmsLr/exec';
  async function data(name) {
    const r = await fetch('data/' + name + '.json?cb=' + Date.now());
    if (!r.ok) throw new Error(name + ' ' + r.status);
    return r.json();
  }
  const shot = id => id ? `https://midfield.mlbstatic.com/v1/people/${id}/spots/120` : '';
  const logo = teamId => teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pts = v => v == null ? '—' : (+v).toFixed(1);
  const tvCls = v => v == null ? 'lo' : v >= 70 ? 'hi' : v >= 30 ? 'mid' : 'lo';
  const money = n => { if (n == null || isNaN(n)) return '—'; const neg = n < 0; n = Math.abs(n);
    const s = n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1e3) + 'K'; return (neg ? '−' : '') + s; };
  function badge(p) {
    let b = '';
    if (p.traded) b += ' <span class="chip traded">TRADED</span>';
    if (p.il) b += ` <span class="chip" style="border-color:var(--bad);color:var(--bad)">${esc(p.il)}</span>`;
    if (p.top100) b += ` <span class="chip t100">MLB #${p.top100}</span>`;
    else if (p.orgRank) b += ` <span class="chip pr">Org #${p.orgRank}</span>`;
    else if (p.prospect) b += ' <span class="chip pr">PROSPECT</span>';
    return b;
  }
  function statLine(p) {
    if (!p.line) return p.prospect ? 'No 2026 stats yet' : '—';
    return p.type === 'H'
      ? `${p.line.avg ?? '—'} AVG · ${p.line.ops ?? '—'} OPS · ${p.line.hr ?? 0} HR · ${p.line.sb ?? 0} SB`
      : `${p.line.era ?? '—'} ERA · ${p.line.whip ?? '—'} WHIP · ${p.line.k ?? 0} K · ${p.line.ip ?? 0} IP`;
  }
  // Stat line as HTML: full ink for MLB stats, greyed for minor-league lines.
  function statHTML(p) {
    const milb = !!(p.prospect && p.topLevel && p.topLevel !== 'MLB');
    const lvl = milb ? ` <span class="lvl">${esc(p.topLevel)}</span>`
      : (p.prospect && p.topLevel === 'MLB' ? ' <span class="lvl mlb">MLB</span>' : '');
    return `<span class="statln ${milb ? 'milb' : 'mlb'}">${esc(statLine(p))}</span>${lvl}`;
  }
  async function nav(active) {
    const el = document.getElementById('mast') || document.getElementById('nav');
    const links = [['index', 'Hub'], ['builder', 'Trade Builder'], ['feed', 'Trade Feed'], ['fan', 'Fan Trades'], ['fits', 'Astros Fits']];
    el.innerHTML =
      '<div class="deadline-banner">🔥 Trade Deadline: Monday, August 3rd — 5:00 PM CT 🔥</div>' +
      '<div class="stripe"></div>' +
      '<div class="masthead">' +
        '<div class="mast-kicker">Beyond the Diamond Podcast</div>' +
        '<div class="mast-title">Trade <em>Hub</em></div>' +
        '<div class="mast-tag"><span class="star">★</span>&nbsp; Scout. Value. Deal. &nbsp;<span class="star">★</span></div>' +
      '</div>' +
      '<div class="tabs">' +
        links.map(([f, t]) => `<a href="${f}${location.protocol === 'file:' ? '.html' : ''}" class="${f === active ? 'on' : ''}">${t}</a>`).join('') +
        '<span class="meta"><span class="upd" id="nav-upd"></span></span></div>';
    try { const m = await data('meta'); document.getElementById('nav-upd').textContent =
      'Updated ' + new Date(m.updated).toLocaleDateString(); } catch (e) {}
  }
  // ---------- Player popup: bio + awards + splits + percentile bars ----------
  let _pool = null;
  async function pool() {
    if (_pool) return _pool;
    const d = await data('players');
    const byId = new Map(); d.players.forEach(p => byId.set(p.id, p));
    _pool = { byId, players: d.players, season: d.season };
    return _pool;
  }
  const AWARD_NAMES = { MVP: 'MVP', CY: 'Cy Young', ROY: 'Rookie of the Year', GG: 'Gold Glove', SS: 'Silver Slugger', AS: 'All-Star' };
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || 'th');
  const numv = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  function pctile(arr, v, inv) {
    if (v == null || isNaN(v) || arr.length < 10) return null;
    let below = 0, eq = 0;
    arr.forEach(x => { if (x < v) below++; else if (x === v) eq++; });
    const p = 100 * (below + 0.5 * eq) / arr.length;
    return Math.round(inv ? 100 - p : p);
  }
  function barsHTML(p, all) {
    const isH = p.type === 'H';
    const peers = all.filter(q => (isH ? q.type === 'H' : q.type !== 'H') && q.line &&
      (isH ? (q.line.pa || 0) >= 100 : numv(q.line.ip) >= 30));
    const defPeers = peers.filter(q => q.def != null);
    const M = isH
      ? [['OPS', q => numv(q.line.ops)], ['AVG', q => numv(q.line.avg)], ['HR', q => q.line.hr],
         ['SB', q => q.line.sb], ['WAR', q => q.war], ['Defense', q => q.def, false, defPeers], ['Trade Val', q => q.tv]]
      : [['ERA', q => numv(q.line.era), true], ['WHIP', q => numv(q.line.whip), true], ['K', q => q.line.k],
         ['IP', q => numv(q.line.ip)], ['WAR', q => q.war], ['Trade Val', q => q.tv]];
    const rows = M.map(([lbl, get, inv, pl]) => {
      const grp = pl || peers;
      const v = p.line || lbl === 'WAR' || lbl === 'Trade Val' || lbl === 'Defense' ? get(p) : null;
      const pc = pctile(grp.map(get).filter(x => x != null && !isNaN(x)), v, inv);
      if (pc == null) return '';
      const col = `hsl(${Math.round(220 - 2.12 * pc)},68%,44%)`;
      return `<div class="pbar"><span class="plbl">${lbl}</span><span class="pval">${v != null ? v : '—'}</span>` +
        `<span class="ptrack"><span class="pfill" style="width:${pc}%;background:${col}"></span>` +
        `<span class="pdot" style="left:max(0%,calc(${pc}% - 22px));background:${col}">${pc}</span></span></div>`;
    }).filter(Boolean).join('');
    return rows ? `<div class="pphd">League Percentiles <span class="ppnote">vs ${isH ? 'hitters, 100+ PA' : 'pitchers, 30+ IP'}</span></div>${rows}` : '';
  }
  async function splitsHTML(p, season) {
    if (!p.id || p.prospect && p.topLevel !== 'MLB') return '';
    try {
      const g = p.type === 'H' ? 'hitting' : 'pitching';
      const r = await fetch(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=statSplits&season=${season}&group=${g}&sitCodes=h,a`);
      const d = await r.json();
      const sp = d.stats && d.stats[0] && d.stats[0].splits || [];
      const home = sp.find(s => s.split && s.split.code === 'h'), road = sp.find(s => s.split && s.split.code === 'a');
      if (!home && !road) return '';
      const row = (tag, s) => {
        if (!s) return '';
        const t = s.stat || {};
        return p.type === 'H'
          ? `<div class="psplit"><b>${tag}</b><span>${t.avg || '—'} AVG</span><span>${t.ops || '—'} OPS</span><span>${t.homeRuns ?? 0} HR</span><span>${t.rbi ?? 0} RBI</span></div>`
          : `<div class="psplit"><b>${tag}</b><span>${t.era || '—'} ERA</span><span>${t.whip || '—'} WHIP</span><span>${t.strikeOuts ?? 0} K</span><span>${t.inningsPitched ?? 0} IP</span></div>`;
      };
      return `<div class="pphd">Home / Road Splits</div>${row('🏠 Home', home)}${row('✈️ Road', road)}`;
    } catch (e) { return ''; }
  }
  function ensurePop() {
    if (document.getElementById('ppop')) return;
    const d = document.createElement('div');
    d.id = 'ppop'; d.className = 'ppop'; d.style.display = 'none';
    d.innerHTML = '<div class="ppcard"><button class="pclose">×</button><div id="ppbody"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d) d.style.display = 'none'; });
    d.querySelector('.pclose').addEventListener('click', () => d.style.display = 'none');
  }
  async function openPlayer(id) {
    ensurePop();
    const pop = document.getElementById('ppop'), body = document.getElementById('ppbody');
    pop.style.display = 'flex';
    body.innerHTML = '<div class="ppload">Loading…</div>';
    let P = null, season = new Date().getFullYear();
    try { const pl = await pool(); P = pl.byId.get(+id); season = pl.season || season; } catch (e) {}
    if (!P) { body.innerHTML = '<div class="ppload">No data on file for this player.</div>'; return; }
    const owed = P.rem != null ? '~$' + (+P.rem).toFixed(1) + 'M owed' + (P.salEst ? ' (est.)' : '') : '';
    const meta = [P.pos, P.bt, P.age ? 'age ' + P.age : '', P.team, P.ctrl ? P.ctrl + 'y control' : '', owed].filter(Boolean).join(' · ');
    const awards = (P.awards || []).map(a =>
      `<span class="chip awd">🏆 ${AWARD_NAMES[a.t] || a.t}${a.place > 1 ? ' — ' + ordinal(a.place) : ''} ’${String(a.s).slice(2)}</span>`).join(' ');
    const val = (l, v, cls) => v == null ? '' : `<div class="pvbox"><span>${l}</span><b class="${cls || ''}">${v}</b></div>`;
    body.innerHTML =
      `<div class="pphead"><img src="${shot(P.id)}" onerror="this.style.visibility='hidden'">` +
      `<div><div class="ppname">${esc(P.name)}${badge(P)}</div><div class="ppmeta">${esc(meta)}</div>` +
      (awards ? `<div class="ppawards">${awards}</div>` : '') + '</div></div>' +
      `<div class="pvgrid">` +
        val('Trade Value', pts(P.tv), 'tv ' + tvCls(P.tv)) + val('WAR', P.war) + val('Proj WAR', P.proj) +
        val('Surplus', P.sur != null ? '$' + P.sur + 'M' : null) +
        val('Def (FRV)', P.def != null ? (P.def > 0 ? '+' : '') + P.def : null) +
        val('Salary', P.salM != null ? '$' + (+P.salM).toFixed(1) + 'M/yr' : null) +
        val('IL · 4 yrs', P.ilDays != null ? P.ilDays + 'd / ' + (P.ilStints || 0) + ' stints' : null) + '</div>' +
      `<div class="pphd">This Season</div><div class="ppline">${statHTML(P)}</div>` +
      `<div id="ppsplits"><div class="ppload">Loading splits…</div></div>` +
      `<div id="ppbars">${barsHTML(P, _pool.players)}</div>`;
    document.getElementById('ppsplits').innerHTML = await splitsHTML(P, season) ||
      (P.prospect ? '' : '<div class="ppnote" style="padding:4px 0">No MLB splits available.</div>');
  }
  // Capture phase so a name click opens the popup INSTEAD of triggering the
  // row's own click (e.g. adding the player to a trade in the builder).
  document.addEventListener('click', e => {
    const n = e.target.closest('.pn');
    if (n && n.dataset.pid) { e.stopPropagation(); e.preventDefault(); openPlayer(+n.dataset.pid); }
  }, true);
  return { data, shot, logo, esc, pts, tvCls, money, badge, statLine, statHTML, nav, openPlayer, pool, FAN_URL };
})();
