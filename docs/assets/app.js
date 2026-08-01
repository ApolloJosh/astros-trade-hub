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
  // Fan Trades feed (JSONP + fetch race — same channel as the Fan Trades page).
  // fanData() gives the whole response: live trades plus `tally`, the lifetime
  // most-traded-for counts the backend keeps after old trades are pruned.
  let _fan = null;
  function fanData() {
    if (_fan) return _fan;
    _fan = rawFan().then(d => ({ trades: (d && d.trades) || [], tally: (d && d.tally) || [] }))
      .catch(() => ({ trades: [], tally: [] }));
    return _fan;
  }
  // Merged "most traded for" counts: pruned history + everything still live.
  // Returns [{id, name, pos, team, n}] sorted by count. Pure, so a page that
  // already has the API response can merge without asking for it twice.
  function mergeWanted(trades, tally) {
    trades = trades || []; tally = tally || [];
    const m = new Map();
    const bump = (p, n) => {
      if (!p || !p.id) return;
      const w = m.get(p.id) || { id: p.id, name: p.name || '', pos: p.pos || '', team: p.team || '', n: 0 };
      if (!w.name && p.name) w.name = p.name;
      if (!w.pos && p.pos) w.pos = p.pos;
      if (!w.team && p.team) w.team = p.team;
      w.n += n; m.set(p.id, w);
    };
    tally.forEach(p => bump(p, +p.n || 0));
    trades.forEach(t => (t.get || []).forEach(p => bump(p, 1)));
    return [...m.values()].filter(p => p.n > 0).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  }
  const fanWanted = () => fanData().then(d => mergeWanted(d.trades, d.tally));
  function rawFan() {
    if (!FAN_URL) return Promise.resolve({ trades: [], tally: [] });
    const jsonp = () => new Promise((resolve, reject) => {
      const cb = 'btd_' + Math.random().toString(36).slice(2);
      const s = document.createElement('script');
      const t = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
      function cleanup() { clearTimeout(t); delete window[cb]; s.remove(); }
      window[cb] = d => { cleanup(); resolve(d); };
      s.onerror = () => { cleanup(); reject(new Error('script error')); };
      s.src = FAN_URL + '?action=list&callback=' + cb + '&cb=' + Date.now();
      document.head.appendChild(s);
    });
    const fx = async () => (await fetch(FAN_URL + '?action=list&cb=' + Date.now())).json();
    return Promise.any([jsonp(), fx()]).catch(() => ({ trades: [], tally: [] }));
  }
  const fanTrades = () => fanData().then(d => d.trades);
  const shot = id => id ? `https://midfield.mlbstatic.com/v1/people/${id}/spots/120` : '';
  const logo = teamId => teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pts = v => v == null ? '—' : (+v).toFixed(1);
  // Baseball number conventions: rate stats keep 3 decimals and drop the
  // leading zero (.650, not .65); ERA/WHIP take 2; WAR takes 1.
  const r3 = v => { if (v == null || v === '' || isNaN(+v)) return '—';
    const s = Math.abs(+v).toFixed(3); return (+v < 0 ? '-' : '') + (Math.abs(+v) < 1 ? s.slice(1) : s); };
  const r2 = v => (v == null || v === '' || isNaN(+v)) ? '—' : (+v).toFixed(2);
  const r1 = v => (v == null || v === '' || isNaN(+v)) ? '—' : (+v).toFixed(1);
  const tvCls = v => v == null ? 'lo' : v >= 70 ? 'hi' : v >= 30 ? 'mid' : 'lo';
  const money = n => { if (n == null || isNaN(n)) return '—'; const neg = n < 0; n = Math.abs(n);
    const s = n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1e3) + 'K'; return (neg ? '−' : '') + s; };
  function badge(p) {
    let b = '';
    if (p.traded) b += ' <span class="chip traded">TRADED</span>';
    if (p.unt) b += ' <span class="chip" style="border-color:#8a1c1c;color:#8a1c1c">🔒 UNTOUCHABLE</span>';
    if (p.il) b += ` <span class="chip" style="border-color:var(--bad);color:var(--bad)">${esc(p.il)}</span>`;
    if (p.top100) b += ` <span class="chip t100">MLB #${p.top100}</span>`;
    else if (p.orgRank) b += ` <span class="chip pr">Org #${p.orgRank}</span>`;
    else if (p.prospect) b += ' <span class="chip pr">PROSPECT</span>';
    return b;
  }
  function statLine(p) {
    if (!p.line) return p.prospect ? 'No 2026 stats yet' : '—';
    return p.type === 'H'
      ? `${r3(p.line.avg)} AVG · ${r3(p.line.ops)} OPS · ${p.line.hr ?? 0} HR · ${p.line.sb ?? 0} SB`
      : `${r2(p.line.era)} ERA · ${r2(p.line.whip)} WHIP · ${p.line.k ?? 0} K · ${p.line.ip ?? 0} IP`;
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
  // Statcast percentile bars, styled like Baseball Savant: blue = poor,
  // grey = average, red = elite, with the percentile in the bubble.
  const SAVANT_H = [
    ['Batting Run Value', 'bat_rv', null], ['xwOBA', 'xwoba', 3], ['xBA', 'xba', 3], ['xSLG', 'xslg', 3],
    ['Avg Exit Velo', 'ev', 1], ['Barrel %', 'barrel', 1], ['Hard-Hit %', 'hardhit', 1],
    ['Chase %', 'chase', 1], ['Whiff %', 'whiff', 1], ['K %', 'kpct', 1], ['BB %', 'bbpct', 1],
    ['Fielding Run Value', 'frv', 0], ['Sprint Speed', 'sprint', 1],
  ];
  const SAVANT_P = [
    ['xERA', 'xera', 2], ['xBA', 'pxba', 3], ['Fastball Velo', 'velo', 1], ['Avg Exit Velo', 'pev', 1],
    ['Chase %', 'pchase', 1], ['Whiff %', 'pwhiff', 1], ['K %', 'pk', 1], ['BB %', 'pbb', 1],
    ['Barrel %', 'pbarrel', 1], ['Hard-Hit %', 'phardhit', 1], ['GB %', 'gb', 1],
  ];
  // Savant's diverging scale: deep blue (0) -> light grey (50) -> deep red (100)
  function savantColor(pc) {
    const stops = [[0, [50, 84, 168]], [25, [126, 155, 203]], [50, [186, 194, 202]], [75, [214, 122, 106]], [100, [196, 40, 40]]];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (pc >= stops[i][0] && pc <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    const t = b[0] === a[0] ? 0 : (pc - a[0]) / (b[0] - a[0]);
    const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function fmtStat(v, dec) {
    if (v == null || isNaN(v)) return '—';
    if (dec === 3) return r3(v);
    if (dec === 2) return r2(v);
    if (dec === 0) return String(Math.round(v));
    return r1(v);
  }
  function barsHTML(p, all) {
    const isH = p.type === 'H';
    const sc = p.sc || { v: {}, p: {} };
    const rows = [];
    // Run values come from our own data (Savant's are on the same scale)
    const extras = { frv: p.def, bat_rv: null };
    (isH ? SAVANT_H : SAVANT_P).forEach(([label, key, dec]) => {
      let val = sc.v[key], pc = sc.p[key];
      if (key === 'frv' && p.def != null) { val = p.def; pc = pctile(all.filter(q => q.def != null).map(q => q.def), p.def); }
      if (key === 'bat_rv') return;
      if (pc == null || val == null) return;
      const col = savantColor(pc);
      rows.push(`<div class="sbar"><span class="slbl">${label}</span>` +
        `<span class="strack"><span class="sfill" style="width:${pc}%;background:${col}"></span>` +
        `<span class="sdot" style="left:calc(${pc}% - 11px);background:${col}">${pc}</span></span>` +
        `<span class="sval">${fmtStat(val, dec)}</span></div>`);
    });
    if (!rows.length) return '';
    return `<div class="pphd">${isH ? 'Batting' : 'Pitching'} percentiles <span class="ppnote">vs qualified ${isH ? 'hitters' : 'pitchers'}</span></div>` +
      `<div class="sscale"><span style="color:#3254a8">POOR</span><span>AVERAGE</span><span style="color:#c42828">GREAT</span></div>` +
      rows.join('') +
      `<div class="ppnote" style="margin-top:8px">Statcast data via <a href="https://baseballsavant.mlb.com" target="_blank" rel="noopener">Baseball Savant</a></div>`;
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
  // ---------- Minor league percentiles (prospects) ----------
  // milb.json is only needed once a popup is opened, and only for prospects,
  // so it loads lazily and a miss is cached as `false` rather than retried.
  let _milb;
  async function milbData() {
    if (_milb !== undefined) return _milb;
    try { _milb = await data('milb'); } catch (e) { _milb = false; }
    return _milb;
  }
  async function milbHTML(P) {
    const d = await milbData();
    const m = d && d.players && d.players[P.id];
    if (!m) return '';
    const labels = new Map((d.labels && d.labels[m.kind]) || []);
    const pool = (d.pools || []).find(x => x.level === m.lvl &&
      x.group === (m.kind === 'H' ? 'hitting' : 'pitching'));
    const rows = Object.entries(m.p || {}).filter(([k]) => k !== 'age').map(([k, pc]) => {
      const col = savantColor(pc), v = m.v[k];
      return `<div class="sbar"><span class="slbl">${esc(labels.get(k) || k)}</span>` +
        `<span class="strack"><span class="sfill" style="width:${pc}%;background:${col}"></span>` +
        `<span class="sdot" style="left:calc(${pc}% - 11px);background:${col}">${pc}</span></span>` +
        `<span class="sval">${v == null ? '—' : v}</span></div>`;
    });
    if (!rows.length) return '';
    const box = (l, v) => v == null ? '' : `<div class="pvbox"><span>${esc(l)}</span><b>${v}</b></div>`;
    const comps = Object.entries(m.comp || {}).map(([k, v]) => box(k.replace(/_/g, ' '), v)).join('');
    return `<div class="pphd">Minor league percentiles ` +
      `<span class="ppnote">${esc(m.lvl)}${pool ? ' · vs ' + pool.n + ' qualified' : ''}</span></div>` +
      `<div class="pvgrid">${box('Prospect score', m.score)}${box('Agg', m.agg)}` +
      `${box('Young for level', m.p && m.p.age)}${comps}</div>` +
      (m.line ? `<div class="ppline" style="margin:8px 0">${esc(m.line)}</div>` : '') +
      `<div class="sscale"><span style="color:#3254a8">POOR</span><span>AVERAGE</span><span style="color:#c42828">GREAT</span></div>` +
      rows.join('') +
      `<div class="ppnote" style="margin-top:8px">Ranked against ${esc(m.lvl)} only. Computed from the ` +
      `<a href="https://statsapi.mlb.com" target="_blank" rel="noopener">MLB Stats API</a>. ` +
      `Inspired by <a href="https://prospectsavant.com" target="_blank" rel="noopener">Prospect Savant</a>.</div>`;
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
      `<div id="ppmilb"></div>` +
      `<div id="ppsplits"><div class="ppload">Loading splits…</div></div>` +
      `<div id="ppbars">${barsHTML(P, _pool.players)}</div>`;
    // Prospects get minor league percentiles where the big leaguers get Statcast.
    milbHTML(P).then(h => { const el = document.getElementById('ppmilb'); if (el) el.innerHTML = h; }).catch(() => {});
    document.getElementById('ppsplits').innerHTML = await splitsHTML(P, season) ||
      (P.prospect ? '' : '<div class="ppnote" style="padding:4px 0">No MLB splits available.</div>');
  }
  // Capture phase so a name click opens the popup INSTEAD of triggering the
  // row's own click (e.g. adding the player to a trade in the builder).
  document.addEventListener('click', e => {
    const n = e.target.closest('.pn');
    if (n && n.dataset.pid) { e.stopPropagation(); e.preventDefault(); openPlayer(+n.dataset.pid); }
  }, true);
  return { data, shot, logo, esc, pts, r1, r2, r3, tvCls, money, badge, statLine, statHTML, nav, openPlayer, pool, barsHTML, savantColor, fanTrades, fanData, fanWanted, mergeWanted, FAN_URL };
})();
