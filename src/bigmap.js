// 北行大地图：整条北行路线的俯视图（地形、迷雾、营地、地标、雾里的地点），点哪里镜头就飞到哪里
import { LANDMARKS, FAR_MARKS, BAND_START, TIER_NAMES, SITES, SPOT_KEYS, BLD, baseTempOfRow, SPINE_ROW, NORTH_RULES } from './data.js';
import * as Sim from './sim.js';
import { getWorld, idx, W, H, T_ROCK, T_ICE } from './worldgen.js';
import { iconize } from './icons.js';
import { northRec } from './ui.js';

const SPOT_COL = { dead: '#9a9088', fish: '#2a5a8a', ruin: '#b0a890', tree: '#3d6b4c', rock: '#8b8780', herd: '#8a5a3a', coal: '#2e2d31', ore: '#8c4f34', lime: '#e8e0c8', shale: '#5b4a66', crystal: '#7fd0f5', star: '#7a62b8', shard: '#ff8a2b', starfall: '#e070ff' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class BigMap {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('bigmap');
    this.open = false;
    this.el.addEventListener('pointerdown', e => {
      if (e.target === this.el) { e.preventDefault(); this.hide(); return; }
      const inner = e.target.closest('.bmin');
      if (!inner) return;
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.el.addEventListener('pointerup', e => {
      const d = this.down; this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return; // 拖动是在滚地图
      const mk = e.target.closest('[data-mx]'), inner = this.el.querySelector('.bmin');
      if (!inner) return;
      let x, y;
      if (mk) { x = +mk.dataset.mx; y = +mk.dataset.my; if (mk.dataset.camp) this.g.S.active = +mk.dataset.camp; }
      else { const r = inner.getBoundingClientRect(); x = (e.clientX - r.left) / this.k; y = this.maxRow - (e.clientY - r.top) / this.k; }
      this.g.view.focus(Math.max(0, Math.min(W, x)), Math.max(0, y));
      this.hide();
      if (mk && mk.dataset.gang) this.g.ui.open('gang', +mk.dataset.gang);
    });
    this.el.addEventListener('click', e => { if (e.target.closest('[data-act=mapclose]')) this.hide(); });
  }
  toggle() { if (this.open) this.hide(); else this.show(); }
  show() {
    const g = this.g, S = g.S;
    g.cancelModes(); g.ui.close(); g.ui.resDrawer(false);
    this.open = true;
    this.el.classList.add('show');
    this.el.innerHTML = iconize(`<div class="bmbox"><div class="phead"><b>北行地图 <small>${northRec(S) ? `🧭 ${northRec(S)} · ` : ''}点一处，镜头就飞过去</small></b><button class="x" data-act="mapclose">✕</button></div>
      <div class="bmscroll"><div class="bmin"><canvas></canvas><div class="bmmk"></div></div></div>
      <div class="bmleg"><span>🔥 营地</span>${S.camps.some(c => c.depot) ? "<span>📦 补给站</span>" : ""}${(Sim.journeyOf(S).ruins || []).length ? "<span>🏚 熄火的老营地</span>" : ""}<span><i class="rt"></i>探好的路</span><span>📍 发现的地标</span><span>❔ 未知</span><span>🧭 雾里的地点</span><span>🆘 幸存者</span>${S.gangs && Object.keys(S.gangs).length ? "<span>🏴 掠夺者</span>" : ""}<span><i class="vw"></i>镜头</span></div></div>`);
    this.render(true);
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (this.open) this.render(false); }, 1000);
  }
  hide() {
    if (!this.open) return;
    this.open = false; clearInterval(this.timer);
    this.el.classList.remove('show');
    setTimeout(() => { if (!this.open) this.el.innerHTML = ''; }, 250);
  }
  render(first) {
    const S = this.g.S, w = getWorld(S.runSeed), view = this.g.view;
    const sc = this.el.querySelector('.bmscroll'), inner = this.el.querySelector('.bmin'), cv = inner.querySelector('canvas');
    // 显示到最北边揭开的那一行再往上一截，至少能看到下一个地标
    let top = 0;
    for (let y = H - 1; y >= 0 && !top; y--) for (let x = 0; x < W; x++) if (S.reveal[idx(x, y)] === 1) { top = y; break; }
    const J = Sim.journeyOf(S), nxs = Sim.stopOf(S, J.stage + 1);
    const maxRow = Math.min(H - 1, Math.max(top + 30, nxs ? Math.ceil(nxs.y) + 12 : 0, 120));
    // 画布最高三万像素左右（浏览器的上限），北境走得很远时格子画小一点
    const k = Math.max(3, Math.min((sc.clientWidth - 2) / W, 30000 / (maxRow + 1)));
    this.k = k; this.maxRow = maxRow;
    const cw = Math.round(W * k), ch = Math.round((maxRow + 1) * k);
    inner.style.width = cw + 'px'; inner.style.height = ch + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1, 30000 / ch);
    if (cv.width !== cw * dpr || cv.height !== ch * dpr) { cv.width = cw * dpr; cv.height = ch * dpr; cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const Y = row => (maxRow - row) * k;
    // 地形（不会变，画一次存起来）；世界之脊以北的北境底色更暗，一眼看出已经走出了老地图
    const tk = `${S.runSeed}:${maxRow}:${k}:${dpr}`;
    if (this.terrKey !== tk) {
      this.terrKey = tk;
      const tc = this.terrCv || (this.terrCv = document.createElement('canvas'));
      tc.width = cw * dpr; tc.height = ch * dpr;
      const tx = tc.getContext('2d'); tx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let y = 0; y <= maxRow; y++) {
        const nf = Math.max(0, Math.min(1, (y - SPINE_ROW - 20) / 40));
        for (let x = 0; x < W; x++) {
          const i = idx(x, y), t = w.terrain[i], hgt = w.height[i];
          let col;
          if (t === T_ROCK) { const l = 34 + hgt * 22 - nf * 8; col = `hsl(${212 + nf * 14},${9 + nf * 6}%,${l}%)`; }
          else if (t === T_ICE) col = `hsl(${200 + nf * 12},${58 - nf * 18}%,${74 + hgt * 8 - nf * 16}%)`;
          else { const cold = Math.min(1, y / 340); col = `hsl(${205 - cold * 10 + nf * 22},${16 + cold * 18 - nf * 10}%,${86 + hgt * 8 - cold * 4 - nf * 17}%)`; }
          tx.fillStyle = col; tx.fillRect(x * k, Y(y) - k, k + 0.6, k + 0.6);
        }
      }
    }
    ctx.drawImage(this.terrCv, 0, 0, cw, ch);
    // 资源点（只画揭开的、没采空的）
    for (let y = 0; y <= maxRow; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y), sp = w.spot[i];
      if (sp < 0 || S.reveal[i] !== 1 || Sim.spotLeft(S, i) <= 0) continue;
      const key = SPOT_KEYS[sp], cx = (x + 0.5) * k, cy = Y(y) - k / 2;
      ctx.fillStyle = SPOT_COL[key] || '#888';
      if (key === 'tree') { ctx.beginPath(); ctx.moveTo(cx, cy - k * 0.5); ctx.lineTo(cx + k * 0.42, cy + k * 0.4); ctx.lineTo(cx - k * 0.42, cy + k * 0.4); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(cx, cy, k * 0.32, 0, 7); ctx.fill(); }
    }
    // 营地：供热圈、建筑
    for (const c of S.camps) {
      const r = Sim.heatRadius(S, c);
      ctx.fillStyle = 'rgba(255,150,60,.13)'; ctx.strokeStyle = 'rgba(255,150,60,.55)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(c.x * k, Y(c.y), r * k, 0, 7); ctx.fill(); ctx.stroke();
    }
    for (const b of S.buildings) {
      const s = BLD[b.type].size;
      ctx.fillStyle = b.type === 'furnace' ? '#ff8a2b' : '#7a5232';
      ctx.fillRect(b.x * k + 0.5, Y(b.y + s) + 0.5, s * k - 1, s * k - 1);
    }
    // 北迁走过的路：一条浅色的车辙；探好的下一程：一串金点；车队在路上就画它走的那条
    const path = (P, w, col, dash) => { if (!P || P.length < 2) return; ctx.lineWidth = w; ctx.strokeStyle = col; ctx.setLineDash(dash || []); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p[0] * k, Y(p[1])) : ctx.moveTo(p[0] * k, Y(p[1]))); ctx.stroke(); };
    for (const l of J.legs || []) { path(l.path, Math.max(3, k * 0.9), 'rgba(70,58,46,.55)'); path(l.path, Math.max(1.2, k * 0.3), 'rgba(236,226,206,.95)'); }
    if (J.trip) { path(J.trip.path, Math.max(2, k * 0.5), 'rgba(255,186,90,.95)', [k * 0.9, k * 0.7]); }
    else { const ri = Sim.routeInfo(S); if (ri.ok) path(ri.path, Math.max(2, k * 0.45), 'rgba(255,196,96,.9)', [1, k * 1.1]); }
    ctx.setLineDash([]);
    // 运输线
    ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    for (const l of S.lines || []) {
      const a = Sim.getCamp(S, l.a), b = Sim.getCamp(S, l.b); if (!a || !b) continue;
      ctx.strokeStyle = l.rail ? '#c8964e' : 'rgba(110,80,50,.85)';
      ctx.beginPath(); ctx.moveTo(a.x * k, Y(a.y)); ctx.lineTo(b.x * k, Y(b.y)); ctx.stroke();
    }
    ctx.setLineDash([]);
    // 迷雾：低分辨率画一层再放大，边缘是软的
    const fc = this.fog || (this.fog = document.createElement('canvas'));
    fc.width = W; fc.height = maxRow + 1;
    const fx = fc.getContext('2d'), img = fx.createImageData(W, maxRow + 1);
    for (let y = 0; y <= maxRow; y++) for (let x = 0; x < W; x++) {
      const o = ((maxRow - y) * W + x) * 4, rev = S.reveal[idx(x, y)] === 1;
      const n = ((Math.sin(x * 1.7 + y * 0.9) + Math.sin(x * 0.43 - y * 0.61 + 2) + Math.sin(y * 0.27 + 1)) * 2.2) | 0;
      img.data[o] = 26 + n; img.data[o + 1] = 35 + n; img.data[o + 2] = 49 + n; img.data[o + 3] = rev ? 0 : 252;
    }
    fx.putImageData(img, 0, 0);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.filter = `blur(${Math.max(1, k * 0.45)}px)`;
    ctx.drawImage(fc, 0, -k * 0.5, cw, ch); ctx.restore();
    // 烽火塔：点亮的塔之间连一道光，塔的位置一团暖光
    { const L = Sim.towerList(S);
      if (L.length) {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (L.length > 1) for (const [lw, col] of [[Math.max(7, k * 1.8), 'rgba(255,170,70,.22)'], [Math.max(2, k * 0.42), 'rgba(255,228,160,.95)']]) { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); L.forEach((t, i) => i ? ctx.lineTo(t.x * k, Y(t.y)) : ctx.moveTo(t.x * k, Y(t.y))); ctx.stroke(); }
        for (const t of L) { const r = k * (t.type === 'skyfire' ? 4.5 : 3), g = ctx.createRadialGradient(t.x * k, Y(t.y), 0, t.x * k, Y(t.y), r); g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.35, 'rgba(255,190,90,.8)'); g.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x * k, Y(t.y), r, 0, 7); ctx.fill(); }
        ctx.restore();
      } }
    // 纬度带
    ctx.font = `600 ${Math.max(10, k * 1.25)}px "Noto Serif SC",serif`; ctx.textBaseline = 'bottom';
    const bands = BAND_START.map((row, t) => [row, t]).slice(2);
    if (maxRow > SPINE_ROW + 40) bands.push([SPINE_ROW + 40, -1]);
    for (const [row, t] of bands) {
      if (row > maxRow) break;
      ctx.strokeStyle = 'rgba(200,150,78,.55)'; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(0, Y(row)); ctx.lineTo(cw, Y(row)); ctx.stroke(); ctx.setLineDash([]);
      const txt = t < 0 ? `北境 · 世界之脊以北 · ${Math.round(baseTempOfRow(row))}°` : `${TIER_NAMES[t]}带 · ${Math.round(baseTempOfRow(row))}°`;
      ctx.fillStyle = 'rgba(20,16,12,.7)'; const tw = ctx.measureText(txt).width; ctx.fillRect(4, Y(row) - k * 1.7, tw + 10, k * 1.6);
      ctx.fillStyle = '#f2cf8f'; ctx.fillText(txt, 9, Y(row) - k * 0.25);
    }
    // 镜头看到的范围
    const cvs = view.canvas, r = cvs.getBoundingClientRect();
    const corners = [[0, 0], [r.width, 0], [r.width, r.height], [0, r.height]].map(([px, py]) => view.pickTile(r.left + px, r.top + py)).filter(Boolean);
    if (corners.length === 4) {
      ctx.strokeStyle = 'rgba(255,240,210,.95)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 4;
      ctx.beginPath(); corners.forEach((p, i) => { const X = Math.max(-2, Math.min(W + 2, p.x)) * k, YY = Y(Math.max(-2, p.y)); i ? ctx.lineTo(X, YY) : ctx.moveTo(X, YY); }); ctx.closePath(); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 标记（HTML，方便点和显示图标）
    const mk = [];
    const add = (x, y, cls, html, extra = '') => mk.push(`<div class="bmk ${cls}" data-mx="${x}" data-my="${y}" ${extra} style="left:${(x * k).toFixed(1)}px;top:${Y(y).toFixed(1)}px">${html}</div>`);
    const taken = (x, y) => S.camps.some(c => Math.abs(c.x - x) + Math.abs(c.y - y) < 7) || (J.ruins || []).some(r => Math.abs(r.x - x) + Math.abs(r.y - y) < 7);
    LANDMARKS.forEach((l, i) => {
      const st = S.founded.includes(i) ? 'done' : S.discovered.includes(i) ? 'seen' : 'unk';
      if (l.row > maxRow || taken(l.x, l.row)) return;
      add(l.x + 0.5, l.row + 0.5, 'lm ' + st, `<i>${st === 'done' ? '🏁' : st === 'seen' ? '📍' : '❔'}</i><span>${st === 'unk' && i > S.known ? '？？？' : esc(l.n)}</span>`);
    });
    (w.far || []).forEach((p, i) => {
      const st = Sim.farState(S, i); if (st === 'none' || p.y > maxRow || taken(p.x, p.y)) return;
      add(p.x + 0.5, p.y + 0.5, 'lm ' + (st === 'lit' ? 'done' : 'seen'), `<i>${st === 'lit' ? '✨' : '📍'}</i><span>${esc(FAR_MARKS[i].n)}</span>`);
    });
    for (const p of w.north || []) {
      const k2 = Sim.SPINE + p.k, done = J.stage >= k2, nx = J.stage + 1 === k2;
      if (p.y > maxRow || taken(p.x, p.y) || (!done && !nx && S.reveal[idx(p.x, p.y)] !== 1)) continue;
      add(p.x + 0.5, p.y + 0.5, 'lm ' + (done ? 'done' : 'seen'), `<i>${done ? '🏁' : '📍'}</i><span>北境第 ${p.k} 站·${esc(p.name)} ${NORTH_RULES[p.rule].ic}</span>`);
    }
    for (const t of Sim.towerList(S)) add(t.x, t.y, 'lm done tw', `<i>🔥</i><span>${Sim.towerName(t.n)}</span>`);
    for (const s of w.sites) {
      if (s.y > maxRow || S.reveal[idx(s.x, s.y)] !== 1 || (S.siteDone || {})[s.id]) continue;
      add(s.x + 0.5, s.y + 0.5, 'site', `<i>🧭</i><span>${esc(SITES[s.kind].n)}</span>`);
    }
    for (const gg of w.gangs || []) {
      const st = (S.gangs || {})[gg.id];
      if (!st || gg.y > maxRow) continue;
      add(gg.x + 0.5, gg.y + 0.5, 'gang' + (st.gone ? ' gone' : st.dem ? ' dem' : ''), `<i>🏴</i><span>${esc(Sim.gangName(gg))}</span>`, `data-gang="${gg.id}"`);
    }
    for (const p of w.pois) {
      if (p.kind !== 'survivors' || p.y > maxRow || S.reveal[idx(p.x, p.y)] !== 1 || S.poiDone[p.id]) continue;
      add(p.x + 0.5, p.y + 0.5, 'poi', `<i>🆘</i>`);
    }
    for (const sc2 of S.scouts) add(sc2.x, sc2.y, 'scout', `<i>${sc2.kind === 'exp' ? '🧭' : sc2.kind === 'rescue' ? '🆘' : sc2.kind === 'survey' ? '⛏' : '🚩'}</i>`);
    for (const r of J.ruins || []) if (r.y <= maxRow) add(r.x, r.y, 'ruin', `<i>🏚</i><span>${esc(r.n)}</span>`, `data-tip="熄了火的老营地"`);
    for (const c of S.camps) {
      const main = Sim.isMain(S, c);
      add(c.x, c.y, 'camp' + (c.id === S.active ? ' on' : '') + (main ? ' main' : c.depot ? ' depot' : ''), `<i>${main || !c.depot ? '🔥' : '📦'}</i><span>${main ? '<b>主营地</b> ' : c.depot ? '<b>补给站</b> ' : ''}${esc(c.name)}</span>`, `data-camp="${c.id}"`);
    }
    if (J.trip) { const p = Sim.tripPos(J.trip); add(p.x, p.y, 'trip', `<i>🛷</i><span>车队 · 往「${esc(Sim.stopOf(S, J.trip.to).n)}」</span>`); }
    const html = iconize(mk.join(''));
    const box = inner.querySelector('.bmmk'); if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
    if (first) {
      const c = Sim.getCamp(S, S.active) || S.camps[0];
      sc.scrollTop = Math.max(0, Y(c ? c.y : 0) - sc.clientHeight * 0.55);
    }
  }
}
