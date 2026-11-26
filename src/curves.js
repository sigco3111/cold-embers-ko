// 数据曲线：把营地的历史画成折线图（SVG 字符串），悬停 / 按住显示那一刻的数值
import { DAY_LEN, dayCycle } from './data.js';

// 分类色：深色面板上验证过（亮度带、色弱区分、对比度都过关），按顺序分配，不循环
export const CV_COL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const SURF = '#221d19';

export function fmtV(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
  if (a >= 1e4) return (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'K';
  if (a >= 100) return Math.round(v).toLocaleString('en-US');
  return (Math.round(v * 10) / 10).toString();
}
export const dayLabel = t => `일 ${Math.floor(t / DAY_LEN) + 1}`;
export const timeLabel = t => `${dayLabel(t)} · ${dayCycle(t).name}`;

function niceStep(span, n) {
  const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function yScale(lo, hi, fixed) {
  if (fixed) return { lo: fixed[0], hi: fixed[1], ticks: fixed[2] };
  if (hi - lo < 1e-6) { hi = lo + (Math.abs(lo) > 1 ? Math.abs(lo) * 0.2 : 1); }
  const st = niceStep(hi - lo, 3);
  const a = Math.floor(lo / st) * st, b = Math.ceil(hi / st) * st, ticks = [];
  for (let v = a; v <= b + st * 0.01; v += st) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo: a, hi: b, ticks };
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// opts: { id, w, h, ts:[t...], series:[{name, col, vals:[...]}], unit, zero:true 让 y 轴从 0 开始, fixed:[lo,hi,ticks], off:[[t0,t1]], area }
// 返回 { html, meta }；meta 存起来给悬停用
export function chartHtml(o) {
  const { w, h, ts } = o, S = o.series.filter(s => s.vals.some(v => v != null));
  const n = ts.length;
  const many = S.length >= 2, endLab = S.length <= 4;
  const padL = 38, padR = endLab ? 46 : 10, padT = 10, padB = 22;
  const iw = w - padL - padR, ih = h - padT - padB;
  let lo = Infinity, hi = -Infinity;
  for (const s of S) for (const v of s.vals) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (o.zero) lo = Math.min(0, lo);
  const Y = yScale(lo, hi, o.fixed);
  const t0 = ts[0], t1 = ts[n - 1] > t0 ? ts[n - 1] : t0 + 1;
  const X = t => padL + (t - t0) / (t1 - t0) * iw, YY = v => padT + ih - (v - Y.lo) / (Y.hi - Y.lo) * ih;
  let g = '';
  // 离线的时段：淡淡一层，顶上写「离线」
  for (const [a, b] of o.off || []) {
    if (b < t0 || a > t1) continue;
    const xa = X(Math.max(a, t0)), xb = X(Math.min(b, t1));
    if (xb - xa < 1) continue;
    g += `<rect x="${xa.toFixed(1)}" y="${padT}" width="${(xb - xa).toFixed(1)}" height="${ih}" class="cvoff"/>`;
    if (xb - xa > 30) g += `<text x="${((xa + xb) / 2).toFixed(1)}" y="${padT + 11}" class="cvofft">오프라인</text>`;
  }
  // 网格与 y 轴刻度
  for (const v of Y.ticks) { const y = YY(v).toFixed(1); g += `<line x1="${padL}" x2="${padL + iw}" y1="${y}" y2="${y}" class="cvgrid${v === 0 && Y.lo < 0 ? ' zero' : ''}"/><text x="${padL - 6}" y="${(+y + 3.5).toFixed(1)}" class="cvyt">${fmtV(v)}${o.unit && v === Y.ticks[Y.ticks.length - 1] ? o.unit : ''}</text>`; }
  // x 轴：按天标，太密就隔几天
  { const span = (t1 - t0) / DAY_LEN, every = Math.max(1, Math.ceil(span / Math.max(2, Math.floor(iw / 70))));
    const d0 = Math.ceil(t0 / DAY_LEN);
    let any = false;
    for (let d = d0; d * DAY_LEN <= t1; d++) { if (d % every) continue; const x = X(d * DAY_LEN); any = true; g += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${padT + ih}" y2="${padT + ih + 4}" class="cvgrid"/><text x="${x.toFixed(1)}" y="${h - 6}" class="cvxt">${dayLabel(d * DAY_LEN)}</text>`; }
    if (!any) g += `<text x="${padL}" y="${h - 6}" class="cvxt" text-anchor="start">${dayLabel(t0)}</text>`;
  }
  // 线：空值断开；只有一条线时下面铺一层 10% 的底色
  const ends = [];
  S.forEach((s, si) => {
    let d = '', pen = false, first = null, last = null;
    s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } const x = X(ts[i]).toFixed(1), y = YY(v).toFixed(1); d += (pen ? 'L' : 'M') + x + ' ' + y; pen = true; if (first == null) first = i; last = i; });
    if (!d) return;
    if (o.area && S.length === 1) { const base = YY(Math.max(Y.lo, Math.min(Y.hi, 0))).toFixed(1); g += `<path d="${d}L${X(ts[last]).toFixed(1)} ${base}L${X(ts[first]).toFixed(1)} ${base}Z" fill="${s.col}" opacity="0.1"/>`; }
    g += `<path d="${d}" fill="none" stroke="${s.col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    ends.push({ si, x: X(ts[last]), y: YY(s.vals[last]), v: s.vals[last], col: s.col });
  });
  for (const e of ends) g += `<circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="4" fill="${e.col}" stroke="${SURF}" stroke-width="2"/>`;
  // 线尾直接标最新的数（挤在一起的就不标，图例和悬停里有）
  if (endLab) { let lastY = -99; for (const e of [...ends].sort((a, b) => a.y - b.y)) { if (e.y - lastY < 12) continue; lastY = e.y; g += `<text x="${(e.x + 7).toFixed(1)}" y="${(e.y + 4).toFixed(1)}" class="cvend">${fmtV(e.v)}</text>`; } }
  // 悬停层：竖线 + 每条线一个点（默认藏着）
  g += `<line class="cvx" x1="0" x2="0" y1="${padT}" y2="${padT + ih}" style="display:none"/>`;
  S.forEach((s, si) => { g += `<circle class="cvdot" data-si="${si}" r="4" fill="${s.col}" stroke="${SURF}" stroke-width="2" style="display:none"/>`; });
  const legend = many ? `<div class="cvleg">${S.map(s => { const v = [...s.vals].reverse().find(x => x != null); return `<span><i style="background:${s.col}"></i>${esc(s.name)} <b>${fmtV(v)}</b></span>`; }).join('')}</div>` : '';
  const html = `<div class="cvbox"><div class="cvhd"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div>${legend}<div class="cv" data-cv="${o.id}"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${g}</svg><div class="cvtip"></div></div></div>`;
  return { html, meta: { ts, series: S, padL, padT, iw, ih, t0, t1, Y, unit: o.unit || '' } };
}

// 指针在图上：竖线吸到最近的一笔，提示框列出每条线在那一刻的数
export function chartHover(box, m, clientX) {
  const svg = box.querySelector('svg'), tip = box.querySelector('.cvtip'); if (!svg || !m) return;
  const r = svg.getBoundingClientRect(), x = clientX - r.left;
  const t = m.t0 + (x - m.padL) / m.iw * (m.t1 - m.t0);
  let best = 0, bd = Infinity;
  m.ts.forEach((tt, i) => { const d = Math.abs(tt - t); if (d < bd) { bd = d; best = i; } });
  const X = tt => m.padL + (tt - m.t0) / (m.t1 - m.t0) * m.iw, Y = v => m.padT + m.ih - (v - m.Y.lo) / (m.Y.hi - m.Y.lo) * m.ih;
  const cx = X(m.ts[best]);
  const ln = svg.querySelector('.cvx'); ln.setAttribute('x1', cx); ln.setAttribute('x2', cx); ln.style.display = '';
  const rows = [];
  m.series.forEach((s, si) => {
    const v = s.vals[best], dot = svg.querySelector(`.cvdot[data-si="${si}"]`);
    if (v == null) { if (dot) dot.style.display = 'none'; return; }
    if (dot) { dot.setAttribute('cx', cx); dot.setAttribute('cy', Y(v)); dot.style.display = ''; }
    rows.push([v, s]);
  });
  rows.sort((a, b) => b[0] - a[0]);
  tip.textContent = '';
  const hd = document.createElement('div'); hd.className = 'cvth'; hd.textContent = timeLabel(m.ts[best]); tip.appendChild(hd);
  for (const [v, s] of rows) {
    const row = document.createElement('div'); row.className = 'cvtr';
    const k = document.createElement('i'); k.style.background = s.col; row.appendChild(k);
    const b = document.createElement('b'); b.textContent = fmtV(v) + m.unit; row.appendChild(b);
    const n = document.createElement('span'); n.textContent = s.name; row.appendChild(n);
    tip.appendChild(row);
  }
  tip.style.display = 'block';
  const tw = tip.offsetWidth, bw = box.clientWidth;
  tip.style.left = Math.max(0, Math.min(bw - tw, cx + 12 + tw > bw ? cx - tw - 12 : cx + 12)) + 'px';
}
export function chartLeave(box) {
  const svg = box.querySelector('svg'); if (!svg) return;
  const ln = svg.querySelector('.cvx'); if (ln) ln.style.display = 'none';
  for (const d of svg.querySelectorAll('.cvdot')) d.style.display = 'none';
  const tip = box.querySelector('.cvtip'); if (tip) tip.style.display = 'none';
}
