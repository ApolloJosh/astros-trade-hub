// Shared helpers for all pages.
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
  async function nav(active) {
    const el = document.getElementById('nav');
    const links = [['index', 'Hub'], ['builder', 'Trade Builder'], ['feed', 'Trade Feed'], ['fits', 'Astros Fits']];
    el.innerHTML = '<span class="brand">BTD <span>Trade Hub</span></span>' +
      links.map(([f, t]) => `<a href="${f}.html" class="${f === active ? 'on' : ''}">${t}</a>`).join('') +
      '<span class="upd" id="nav-upd"></span>';
    try { const m = await data('meta'); document.getElementById('nav-upd').textContent =
      'Updated ' + new Date(m.updated).toLocaleString(); } catch (e) {}
  }
  return { data, shot, logo, esc, pts, tvCls, money, badge, statLine, nav };
})();
