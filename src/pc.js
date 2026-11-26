// 1.2 电脑版：横屏且 1000 像素以上（平板横屏也算）。
// 顶部一整条（营地铭牌、四格仪表、钉住的物资、速度开关、菜单、铃铛），左上目标牌，右上天数天气牌，
// 左下小地图（旁边北行地图 M、回到炉火 空格），底部中间号令台（1–5），右下炉火号令，
// 建造是号令台上方的一排建筑格（按 3 或 B），营地、生产、研究、北行、菜单是屏幕中间的大窗口，
// 点建筑在小地图上方弹小信息窗。鼠标停在顶栏任何一格、建筑格上出明细小卡。界面大小 90% / 100% / 125%。
// 手机上这些都不出现（CSS 里藏起来），所以这里的东西只在 body.pc 时才更新。
import { RES, BLD, BLD_KEYS, TIER_NAMES, DAY_LEN, dayCycle, CATS, SPOT_KEYS } from './data.js';
import * as Sim from './sim.js';
import { getWorld, idx, W, T_ROCK, T_ICE } from './worldgen.js';
import { iconize, ico, has12 } from './icons.js';
import { fmt, fmtTime, RICON } from './ui.js';

const PREF_Z = 'hanjin-beixing-v1-uiscale', PREF_PIN = 'hanjin-beixing-v1-pins';
export const ZOOMS = [['auto', '오토매틱', '화면 크기별'], ['90', '90%', ''], ['100', '100%', ''], ['125', '125%', '']];
// 小信息窗（左下）里开的面板；其余的面板在屏幕中间开大窗口
const INSP = new Set(['bld', 'queue', 'site', 'landmark', 'far', 'person', 'spot']);
const HUB_KEYS = ['camp', 'prod', 'build', 'research', 'north'];
const MINI = 168, MINI_R = 26; // 小地图直径（像素）、看多大一片（格，半径）
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class PC {
  constructor(g) {
    this.g = g; this.on = false; this.t = 0; this.mt = 0;
    this.mq = matchMedia('(orientation:landscape) and (min-width:1000px)');
    try { this.zp = localStorage.getItem(PREF_Z) || 'auto'; } catch (e) { this.zp = 'auto'; }
    try { const p = JSON.parse(localStorage.getItem(PREF_PIN) || 'null'); this.pins = Array.isArray(p) ? p.filter(k => RES[k]) : null; } catch (e) { this.pins = null; }
    this.tier = null; this.bOpen = false;
    this.mount();
    const re = () => this.sync();
    this.mq.addEventListener ? this.mq.addEventListener('change', re) : this.mq.addListener(re);
    addEventListener('resize', () => { if (!this.on) return; if (this.zp === 'auto') this.applyZoom(); this.fit(); });
    this.sync();
  }
  get S() { return this.g.S; }
  // ---------- 开关电脑版、界面大小 ----------
  sync() {
    const on = this.mq.matches;
    if (on !== this.on) { this.on = on; document.body.classList.toggle('pc', on); if (!on) this.closeBuild(); this.hideTip(); }
    this.applyZoom();
    const ui = this.g.ui; if (ui) { ui.sheetMode && ui.sheetMode(); ui.syncInset && ui.syncInset(); }
  }
  zoom() {
    if (!this.on) return 1;
    if (this.zp === 'auto') return innerWidth >= 2200 ? 1.25 : 1; // 1080p 100%，2K 及以上 125%
    return (+this.zp || 100) / 100;
  }
  applyZoom() { const z = this.zoom(); this.z = z; document.documentElement.style.setProperty('--uiz', String(z)); document.body.classList.toggle('pc-narrow', this.on && innerWidth / z < 1180); }
  setZoom(p) { this.zp = p; try { localStorage.setItem(PREF_Z, p); } catch (e) {} this.applyZoom(); this.g.ui.syncInset(); this.fit(); }

  // ---------- 搭架子 ----------
  mount() {
    const top = document.querySelector('#top .r1');
    // 钉住的物资、速度开关、菜单（顶栏右边）
    this.pinEl = el('div', 'pcPins', 'pcx'); top.appendChild(this.pinEl);
    this.spdEl = el('div', 'pcSpd', 'pcx');
    this.spdEl.innerHTML = [['p', '<svg class="hic" aria-hidden="true"><use href="#c-ui_pause"/></svg>', '일시정지(P)'], ['1', '1×', '1배속'], ['2', '2×', '2배속'], ['4', '4×', '4배속(F는 2배속으로 변경)']].map(([k, n, t]) => `<button data-pcs="${k}" title="${t}">${n}</button>`).join('');
    top.appendChild(this.spdEl);
    this.spdEl.addEventListener('click', e => { const b = e.target.closest('[data-pcs]'); if (!b) return; const k = b.dataset.pcs; if (k === 'p') this.g.togglePause(); else this.g.setSpeed(+k); this.spd(); });
    // 天数天气牌
    this.dayEl = el('div', 'pcDay', 'pcx u-plate'); document.body.appendChild(this.dayEl);
    this.dayEl.dataset.act = 'wx';
    // 小地图
    this.miniEl = el('div', 'pcMini', 'pcx'); this.miniEl.innerHTML = '<canvas width="336" height="336"></canvas><b class="mn">북쪽</b>';
    document.body.appendChild(this.miniEl);
    this.mcv = this.miniEl.querySelector('canvas');
    const go = e => { const r = this.mcv.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height; const c = this.mcen; if (!c) return; this.g.view.focus(c.x + (u - 0.5) * 2 * MINI_R, c.y - (v - 0.5) * 2 * MINI_R); };
    let drag = false;
    this.mcv.addEventListener('pointerdown', e => { if (e.button !== 0) return; drag = true; try { this.mcv.setPointerCapture(e.pointerId); } catch (er) {} go(e); });
    this.mcv.addEventListener('pointermove', e => { if (drag) go(e); });
    this.mcv.addEventListener('pointerup', () => { drag = false; });
    // 建造横条
    this.bEl = el('div', 'pcBuild', 'pcx u-plate'); document.body.appendChild(this.bEl);
    this.bEl.addEventListener('click', e => {
      const t = e.target.closest('[data-pct]'); if (t) { this.tier = t.dataset.pct === 'deco' ? 'deco' : +t.dataset.pct; this.buildHtml(true); return; }
      if (e.target.closest('[data-act]')) { this.hideTip(); }
    });
    // 右键点在窗口或建造横条上也算「关上」（输入框里的右键照旧）
    document.getElementById('sheet').addEventListener('contextmenu', e => { if (!this.on || e.target.closest('input,textarea,select')) return; e.preventDefault(); this.g.ui.close(); });
    this.bEl.addEventListener('contextmenu', e => { e.preventDefault(); this.closeBuild(); });
    // 明细小卡
    this.tipEl = el('div', 'pcTip', 'pcx'); document.body.appendChild(this.tipEl);
    document.addEventListener('mouseover', e => { if (!this.on) return; const t = e.target.closest('[data-tip]'); if (t !== this.tipFor) { this.tipFor = t; if (t) this.showTip(t); else this.hideTip(); } });
    document.addEventListener('mouseleave', () => this.hideTip());
  }

  // ---------- 每帧 ----------
  tick(dt) {
    if (!this.on || !this.S || this.g.titleOn) return;
    this.t += dt; this.mt += dt;
    if (this.mt > 0.25) { this.mt = 0; this.mini(); }
    if (this.t < 0.5) return; this.t = 0;
    this.pinsHtml(); this.spd(); this.day();
    if (this.bOpen) this.buildHtml();
    if (this.tipFor) { // 顶栏、建造格每半秒重画一次：换成新画出来的那一格接着跟
      if (!document.body.contains(this.tipFor)) { const k = this.tipFor.dataset.tip, n = [...document.querySelectorAll('[data-tip]')].find(e => e.dataset.tip === k); if (n) this.tipFor = n; else { this.hideTip(); return; } }
      this.showTip(this.tipFor, true);
    }
  }

  // ---------- 顶栏：钉住的物资 ----------
  // 默认是当前目标用到的：目标材料 + 造它的建筑要的原料，不够五样用木材、煤、钢材这些补
  defPins() {
    const S = this.S, out = [], add = k => { if (k && RES[k] && RES[k].t <= S.known && !out.includes(k) && k !== 'food') out.push(k); };
    const rg = Sim.rateGoals(S).find(x => !x.eternal) || Sim.rateGoals(S)[0];
    if (rg) {
      add(rg.r);
      for (const t of BLD_KEYS) { const d = BLD[t]; if (d.out && d.out[rg.r] && d.in && d.t <= S.known) Object.keys(d.in).forEach(add); }
    }
    for (const k of ['wood', 'coal', 'steel', 'plank', 'stone', 'iron', 'gear']) add(k);
    return out.slice(0, 5);
  }
  pinList() { return (this.pins && this.pins.length ? this.pins : this.defPins()).filter(k => RES[k] && RES[k].t <= this.S.known).slice(0, 5); }
  togglePin(k) {
    let p = this.pinList().slice();
    if (p.includes(k)) p = p.filter(x => x !== k); else { p.push(k); if (p.length > 5) p.shift(); }
    this.pins = p; try { localStorage.setItem(PREF_PIN, JSON.stringify(p)); } catch (e) {}
    this.pinsHtml(true);
  }
  pinsHtml(force) {
    const S = this.S, c = this.g.ui.camp(), cr = Sim.rt(S).c[c.id] || {};
    const info = this.g.ui.resInfo(c, cr, this.pinList());
    const h = info.filter(x => x.k !== 'food' || this.pinList().includes('food')).map(x => {
      const n = Math.round(x.net * 10) / 10, rate = `${n > 0 ? '+' : ''}${Math.abs(n) >= 10 ? Math.round(n) : n}/분`;
      return `<button class="pin ${x.short ? 'short' : ''} ${x.full ? 'full' : ''}" data-act="res" data-arg="${x.k}" data-tip="pin:${x.k}">${RICON[x.k]}<span><b>${fmt(x.have)}</b><small class="${n < -0.05 ? 'neg' : n > 0.05 ? 'pos' : ''}">${rate}</small></span></button>`;
    }).join('');
    if (force || h !== this.pinH) { this.pinH = h; this.pinEl.innerHTML = iconize(h); this.fit(); }
  }
  // 顶栏放不下：从最后一样开始藏，直到速度开关不再挤出去
  fit() {
    const ps = [...this.pinEl.children]; ps.forEach(p => { p.style.display = ''; });
    const lim = () => { const r = this.pinEl.parentElement.getBoundingClientRect(); return r.right - 122 * (this.z || 1); };
    for (let i = ps.length - 1; i >= 0 && this.spdEl.getBoundingClientRect().right > lim() + 1; i--) ps[i].style.display = 'none';
  }
  spd() {
    const g = this.g, cur = g.paused ? 'p' : String(g.speed);
    for (const b of this.spdEl.children) b.classList.toggle('on', b.dataset.pcs === cur);
  }

  // ---------- 右上：第几天、几点、下一场天气 ----------
  day() {
    const S = this.S, d = dayCycle(S.t), n = Math.floor(S.t / DAY_LEN) + 1;
    const mins = Math.floor(((6 / 24 + d.p) % 1) * 24 * 60), clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const w = Sim.weatherAt(S, S.t), cs = Sim.coldAt(S), z = Sim.tideAt(S);
    const wx = w.blizzard ? ['bad', `눈보라 · 및 ${fmtTime(w.until - S.t)}`] : z && z.on ? ['bad', `영동조 · 및 ${fmtTime(z.left)}`] : cs && cs.on ? ['bad', `한파 시즌 및 ${fmtTime(cs.left)}`]
      : w.warn ? ['warn', `눈보라 ${fmtTime(w.inSec)}이(가) 나중에 도착합니다`] : z && z.fc && z.inSec <= DAY_LEN ? ['warn', `영동조 ${fmtTime(z.inSec)}이(가) 나중에 도착합니다`] : cs && cs.fc ? ['warn', `한파 ${fmtTime(cs.inSec)}이(가) 나중에 도착합니다`]
      : ['', `${d.name} · 온화한 날씨`];
    const ic = d.name === '낮' ? 'sun' : d.name === '해질녘' ? 'dusk' : d.name === '밤' ? 'moon' : 'dawn';
    const h = `${ico('i', ic, 'dic')}<span><b>일 ${n} · ${clock}</b><small class="${wx[0]}">${wx[0] ? ico('i', 'snowcloud') : ''}${wx[1]}</small></span>`;
    if (h !== this.dayH) { this.dayH = h; this.dayEl.innerHTML = iconize(h); }
  }

  // ---------- 左下：小地图（北在上，镜头看到的那块画成框，点哪里镜头去哪里） ----------
  mini() {
    const S = this.S, v = this.g.view, cam = v.cam, cv = this.mcv, x = cv.getContext('2d'), k = cv.width / (MINI_R * 2);
    const cen = { x: Math.round(cam.tx), y: Math.round(cam.ty) }; this.mcen = cen;
    const w = getWorld(S.runSeed), x0 = cen.x - MINI_R, y1 = cen.y + MINI_R;
    const X = wx => (wx - x0) * k, Y = wy => (y1 - wy) * k;
    // 地形每 2 秒或镜头走远了才重画
    const tk = `${S.runSeed}:${cen.x}:${cen.y}`;
    if (tk !== this.mtk || !this.mter || performance.now() - (this.mterT || 0) > 2000) {
      this.mtk = tk; this.mterT = performance.now();
      const tc = this.mter || (this.mter = document.createElement('canvas')); tc.width = cv.width; tc.height = cv.height;
      const t = tc.getContext('2d'); t.fillStyle = '#a3adb8'; t.fillRect(0, 0, tc.width, tc.height);
      for (let yy = cen.y - MINI_R; yy <= y1; yy++) for (let xx = x0; xx < cen.x + MINI_R; xx++) {
        if (xx < 0 || xx >= W || yy < 0 || yy * W >= w.terrain.length) continue;
        const i = idx(xx, yy), tr = w.terrain[i], hg = w.height[i] || 0;
        t.fillStyle = tr === T_ROCK ? `hsl(212,9%,${52 + hg * 16}%)` : tr === T_ICE ? `hsl(200,50%,${78 + hg * 6}%)` : `hsl(205,16%,${87 + hg * 6}%)`;
        if (S.reveal && S.reveal[i] !== 1) t.fillStyle = '#8d98a4';
        t.fillRect(X(xx), Y(yy + 1), k + 0.6, k + 0.6);
        const sp = w.spot[i];
        if (sp >= 0 && S.reveal[i] === 1 && Sim.spotLeft(S, i) > 0) { t.fillStyle = SPOT_C[sp] || '#556'; t.fillRect(X(xx) + k * 0.2, Y(yy + 1) + k * 0.2, k * 0.6, k * 0.6); }
      }
    }
    x.drawImage(this.mter, 0, 0);
    for (const c of S.camps) {
      if (Math.abs(c.y - cen.y) > MINI_R + 20) continue;
      const r = Sim.heatRadius(S, c);
      x.fillStyle = 'rgba(255,150,60,.12)'; x.strokeStyle = 'rgba(255,150,60,.6)'; x.lineWidth = 2;
      x.beginPath(); x.arc(X(c.x), Y(c.y), r * k, 0, 7); x.fill(); x.stroke();
    }
    for (const b of S.buildings) {
      if (Math.abs(b.y - cen.y) > MINI_R + 4) continue;
      const s = BLD[b.type].size;
      if (b.type === 'furnace') continue;
      x.fillStyle = b.id === v.selId ? '#ffd27a' : '#8a7058';
      x.fillRect(X(b.x) + 1, Y(b.y + s) + 1, s * k - 2, s * k - 2);
    }
    for (const b of S.buildings) { // 熔炉画成发光的圆点，压在最上面
      if (b.type !== 'furnace' || Math.abs(b.y - cen.y) > MINI_R + 4) continue;
      const s = BLD[b.type].size, px = X(b.x + s / 2), py = Y(b.y + s / 2), g = x.createRadialGradient(px, py, 0, px, py, k * 2.4);
      g.addColorStop(0, '#ffd9a0'); g.addColorStop(0.45, '#ff8a2b'); g.addColorStop(1, 'rgba(255,122,26,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, k * 2.4, 0, 7); x.fill();
    }
    // 镜头看到的范围：屏幕四个角投到地面上
    const r = this.g.canvas.getBoundingClientRect(), pts = [[r.left, r.top + r.height * 0.08], [r.right, r.top + r.height * 0.08], [r.right, r.bottom], [r.left, r.bottom]].map(([a, b]) => v.pickTile(a, b));
    if (pts.every(Boolean)) {
      x.strokeStyle = 'rgba(255,248,225,.95)'; x.lineWidth = 3; x.beginPath();
      pts.forEach((p, i) => { const px = X(Math.max(cen.x - MINI_R * 3, Math.min(cen.x + MINI_R * 3, p.x))), py = Y(Math.max(cen.y - MINI_R * 3, Math.min(cen.y + MINI_R * 3, p.y))); i ? x.lineTo(px, py) : x.moveTo(px, py); });
      x.closePath(); x.stroke();
    }
  }

  // ---------- 建造横条 ----------
  toggleBuild(force) {
    const on = force ?? !this.bOpen;
    if (on) { this.g.ui.close(); this.g.cancelModes(); this.bOpen = true; document.body.classList.add('pcb-open'); this.buildHtml(true); }
    else this.closeBuild();
    this.g.ui.hubBar();
  }
  closeBuild() { if (!this.bOpen) return; this.bOpen = false; document.body.classList.remove('pcb-open'); this.hideTip(); if (this.g.ui) { this.g.ui.markBuildSeen(); this.g.ui.hubBar(); } }
  buildHtml(force) {
    const S = this.S, ui = this.g.ui, c = ui.camp();
    if (this.tier == null) { const nw = ui.newBld(); this.tier = nw.length ? Math.max(...nw.map(k => BLD[k].t)) : ui.buildTier || 1; }
    const deco = this.tier === 'deco';
    const vis = k => !BLD[k].wonder && (!(BLD[k].rule || BLD[k].tower) || Sim.unlocked(S, k) || Sim.countType(S, c.id, k));
    let list = deco ? BLD_KEYS.filter(k => BLD[k].cat === 'deco' && BLD[k].t <= S.known && vis(k)) : BLD_KEYS.filter(k => BLD[k].t === this.tier && BLD[k].cat !== 'deco' && k !== 'furnace' && vis(k));
    if (this.tier === 1) list.push('furnace');
    const seen = ui.seenB(), shown = [];
    let tabs = '';
    for (let t = 1; t <= 7; t++) tabs += `<button class="pct ${t === this.tier ? 'on' : ''} ${t > S.known ? 'lk' : ''} ${t !== this.tier && ui.newBld(t).length ? 'hasnew' : ''}" data-pct="${t}">${t > S.known ? ico('i', 'lock') : ''}${TIER_NAMES[t]}</button>`;
    const qn = (S.queue || []).filter(q => q.camp === c.id).length;
    const right = `<span class="pcsp"></span><button class="pcbx ${deco ? 'on' : ''}" data-pct="deco">${ico('i', 'palette')}장식</button><button class="pcbx" data-act="htab" data-arg="wonder">${ico('i', 'trophy')}불가사의</button><button class="pcbx" data-act="htab" data-arg="bqueue">${ico('i', 'hourglass')}대기줄${qn ? ` <b>${qn}</b>` : ''}</button><button class="pcbx" data-act="htab" data-arg="plan">${ico('i', 'compass')}기획<kbd>J</kbd></button>`;
    let cells = '';
    for (const k of list) {
      const d = BLD[k], locked = !Sim.unlocked(S, k), n = Sim.countType(S, c.id, k);
      const cost = k === 'furnace' ? Sim.buildCost(S, k, c.id, Math.round(c.y + 20)) : Sim.buildCost(S, k, c.id, c.y);
      const fresh = !locked && !seen[k], short = !locked && !Sim.canAfford(c.stock, cost);
      if (fresh) shown.push(k);
      cells += `<button class="pbc ${locked ? 'lk' : ''} ${short ? 'short' : ''}" ${locked ? '' : `data-act="place" data-arg="${k}"`} data-tip="b:${k}">${ui.pic(k, k === 'furnace' ? 2 : 1)}${fresh ? '<i class="cnew">새로운</i>' : ''}${n ? `<i class="pn">${n}</i>` : ''}${locked ? `<i class="plk">${ico('i', 'lock')}</i>` : ''}</button>`;
    }
    if (!cells) cells = `<div class="pbe">${this.tier > S.known ? `북쪽으로 정찰대를 보내 「${TIER_NAMES[this.tier]}」이(가) 있는 위도를 발견하면 잠금 해제됩니다.` : '이 유형의 제품은 아직 구축할 수 없습니다.'}</div>`;
    ui.bNewShown = [...new Set([...(ui.bNewShown || []), ...shown])];
    const h = `<div class="pbt">${tabs}${right}</div><div class="pbr">${cells}</div>`;
    if (force || h !== this.bH) { this.bH = h; this.bEl.innerHTML = iconize(h); }
  }

  // ---------- 明细小卡 ----------
  showTip(t, keep) {
    const k = t.dataset.tip, h = this.tipHtml(k, t); if (!h) { this.hideTip(); return; }
    if (h !== this.tipH) { this.tipH = h; this.tipEl.innerHTML = iconize(h); }
    const z = this.z || 1, r = t.getBoundingClientRect(), tw = this.tipEl.offsetWidth * z, th = this.tipEl.offsetHeight * z;
    const up = k.startsWith('b:');
    let x = r.left + r.width / 2 - tw / 2; x = Math.max(8, Math.min(innerWidth - tw - 8, x));
    const y = up ? r.top - th - 12 : r.bottom + 10;
    this.tipEl.style.transform = `translate(${(x / z).toFixed(1)}px,${(y / z).toFixed(1)}px)`;
    this.tipEl.classList.toggle('up', up);
    this.tipEl.style.setProperty('--ax', ((r.left + r.width / 2 - x) / z).toFixed(1) + 'px');
    if (!keep) this.tipEl.classList.add('show');
  }
  hideTip() { this.tipFor = null; this.tipEl && this.tipEl.classList.remove('show'); }
  tipHtml(key, t) {
    const S = this.S, ui = this.g.ui; if (!S) return '';
    const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    const c = ui.camp(), cr = Sim.rt(S).c[c.id] || {};
    const row = (a, b, cls = '') => `<div class="ttr ${cls}"><span>${a}</span><b>${b}</b></div>`;
    if (kind === 'pin') {
      const x = ui.resInfo(c, cr, [id]).find(y => y.k === id); if (!x) return '';
      const q = (S.queue || []).filter(q => q.camp === c.id).reduce((s, q) => s + (Sim.buildCost(S, q.type, q.camp, q.y)[id] || 0), 0);
      return `<div class="tth">${RICON[id]}<b>${RES[id].n}</b><em>${fmt(x.have)} / ${fmt(cr.cap || 0)}</em></div>${row('분당 출력', '+' + fmt(x.f.p), 'pos')}${row('분당 사용', '−' + fmt(x.f.c), 'neg')}${q ? row('건설 대기열에는 여전히 필요합니다.', fmt(q)) : ''}${x.short ? '<p class="bad">사용 불가: 이를 사용하는 건물이 대기 중입니다.</p>' : x.full ? '<p class="warn">거의 가득 참: 가득 차면 관련 건물 폐쇄</p>' : ''}<p>생산을 보려면 클릭하세요. 생산 창에 있는 압정을 클릭하면 여기에 고정된 소모품으로 교환할 수 있습니다. </p>`;
    }
    if (kind === 'vt') {
      const tt = (t.dataset.tt || '').split(' · ');
      const nm = { tmp: '체감 온도', ppl: '인구', fuel: '연료', food: '요리' }[id];
      return `<div class="tth"><b>${nm}</b><em>${t.querySelector('b') ? t.querySelector('b').innerHTML : ''}</em></div>${tt.map(s => `<div class="ttr"><span>${esc(s)}</span></div>`).join('')}`;
    }
    if (kind === 'b') {
      const d = BLD[id]; if (!d) return '';
      const locked = !Sim.unlocked(S, id), n = Sim.countType(S, c.id, id);
      const cost = id === 'furnace' ? Sim.buildCost(S, id, c.id, Math.round(c.y + 20)) : Sim.buildCost(S, id, c.id, c.y);
      const cat = CATS[d.cat] || '';
      let h = `<div class="tth">${ui.pic(id, id === 'furnace' ? 2 : 1)}<span><b>${id === 'furnace' ? '전초기지 용광로' : d.n}</b><small>${TIER_NAMES[d.t]}${typeof cat === 'string' && cat ? ' · ' + cat : ''}${n ? ` · 보유 ${n}채` : ''}</small></span></div><p>${esc(d.desc)}</p>`;
      if (locked) return h + `<p class="warn">${d.t <= S.known ? '🔒 ' + esc(Sim.stageLock(S, id)) : `「${TIER_NAMES[d.t]}」 위도를 정찰해야 합니다`}</p>`;
      const cst = Object.keys(cost).map(r => `<span class="${(c.stock[r] || 0) >= cost[r] ? '' : 'miss'}">${RICON[r]}${fmt(cost[r])}</span>`).join(' ');
      h += row('비용', cst || '재료가 필요하지 않습니다');
      if (d.out) h += row('분당', `${d.in ? Object.keys(d.in).map(r => `<span class="neg">${RICON[r]}−${d.in[r]}</span>`).join(' ') + ' → ' : ''}${Object.keys(d.out).map(r => `<span class="pos">${RICON[r]}+${d.out[r]}</span>`).join(' ')}`);
      if (d.cat === 'deco') h += row('장식', `희망 +${d.hope}`);
      if (d.w) h += row('일손', `👷 ${d.w} (${Math.max(0, Sim.idleLabor(S, c))}명 무료)`);
      h += row('토지 면적', `${d.size}×${d.size} 그리드`);
      return h + '<div class="ttf">왼쪽 클릭 및 드롭 · 행을 길게 누른 채 드래그 · 취소하려면 오른쪽 클릭</div>';
    }
    return '';
  }

  // ---------- 键盘：1–5 分区、J 规划；Esc 先收建造横条 ----------
  key(k) {
    if (!this.on) return false;
    const i = '12345'.indexOf(k);
    if (i >= 0) { this.g.ui.openHub(HUB_KEYS[i]); return true; }
    if (k === 'j') { this.closeBuild(); this.g.ui.open('plan'); return true; }
    if (k === 'escape' && this.bOpen && !this.g.place) { this.closeBuild(); return true; }
    return false;
  }
  // 右键在空处单击：关掉开着的窗口或建造横条
  rightClick() {
    if (!this.on) return false;
    if (this.g.ui.panel) { this.g.ui.close(); return true; }
    if (this.bOpen) { this.closeBuild(); return true; }
    return false;
  }
  isInsp(kind) { return INSP.has(kind); }
}

function el(tag, id, cls) { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; return e; }
// 资源点在小地图上的颜色（和北行地图一样）
const SPOT_COL = { dead: '#9a9088', fish: '#2a5a8a', ruin: '#b0a890', tree: '#3d6b4c', rock: '#8b8780', herd: '#8a5a3a', coal: '#2e2d31', ore: '#8c4f34', lime: '#e8e0c8', shale: '#5b4a66', crystal: '#7fd0f5', star: '#7a6ab0' };
const SPOT_C = SPOT_KEYS.map(k => SPOT_COL[k] || '#667');
