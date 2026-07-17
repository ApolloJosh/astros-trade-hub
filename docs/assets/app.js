// Shared helpers for all pages.
(function applyTheme() {  // before first paint
  const t = localStorage.getItem('btdTheme') || 'wheel';
  document.documentElement.dataset.theme = t;
  if (document.body) document.body.dataset.theme = t;
  else addEventListener('DOMContentLoaded', () => document.body.dataset.theme = t);
})();
window.BTD = (function () {
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
    const links = [['index', 'Hub'], ['builder', 'Trade Builder'], ['feed', 'Trade Feed'], ['fits', 'Astros Fits']];
    const themes = [['wheel', 'The Wheel'], ['btd', 'BTD Classic'], ['savant', 'Dark Savant'], ['space', 'Space City']];
    const cur = localStorage.getItem('btdTheme') || 'wheel';
    el.innerHTML =
      '<div class="stripe"></div>' +
      '<div class="masthead">' +
        '<div class="mast-kicker">Beyond the Diamond Podcast</div>' +
        '<div class="mast-title">Trade <em>Hub</em></div>' +
        '<div class="mast-tag"><span class="star">★</span>&nbsp; Scout. Value. Deal. &nbsp;<span class="star">★</span></div>' +
      '</div>' +
      '<div class="tabs">' +
        links.map(([f, t]) => `<a href="${f}.html" class="${f === active ? 'on' : ''}">${t}</a>`).join('') +
        '<span class="meta"><span class="upd" id="nav-upd"></span>' +
        '<select class="theme" id="themeSel" title="Theme">' +
        themes.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>🎨 ${t}</option>`).join('') +
      '</select></span></div>';
    document.getElementById('themeSel').addEventListener('change', e => {
      localStorage.setItem('btdTheme', e.target.value);
      document.documentElement.dataset.theme = e.target.value;
      document.body.dataset.theme = e.target.value;
    });
    try { const m = await data('meta'); document.getElementById('nav-upd').textContent =
      'Updated ' + new Date(m.updated).toLocaleDateString(); } catch (e) {}
  }
  return { data, shot, logo, esc, pts, tvCls, money, badge, statLine, statHTML, nav };
})();
