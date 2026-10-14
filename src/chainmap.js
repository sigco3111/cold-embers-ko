// 生产链总览：把一个营地里的生产建筑按上下游排成一张图，看清东西从哪来、到哪去、卡在哪一环
import { BLD, RES, FUEL } from './data.js';
import * as Sim from './sim.js';
import { iconize } from './icons.js';
import { RICON, fmt } from './ui.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const RES_BY_NAME = Object.fromEntries(Object.entries(RES).map(([k, r]) => [r.n, k]));

// 建筑状态归成几类，决定节点颜色
export function statusKind(st) {
  if (!st) return 'idle';
  if (st === '运转中' || st === Sim.DEEP_WHY || st === '研究中') return 'ok';
  if (st === '仓库满了') return 'full';
  if (st.startsWith('缺') || st === Sim.KEEP_WHY) return 'short';
  if (st === '没有派人' || st === '没人干活') return 'idle';
  if (st.includes('采空') || st.startsWith('等')) return 'depl';
  return 'slow';
}
const RANK = { ok: 0, full: 1, slow: 2, idle: 3, depl: 4, short: 5 };
export const KIND_TXT = { ok: '运转', full: '满仓', slow: '变慢', idle: '没人', depl: '采空', short: '缺料' };

// 图：节点 = 同类建筑合在一起（外加熔炉、居民两个去处），边 = 一种物资从上游流到下游
export function chainGraph(S, cid) {
  const R = Sim.rt(S), cr = R.c[cid] || {}, flow = cr.flow || {}, camp = Sim.getCamp(S, cid);
  const nodes = new Map();
  for (const b of S.buildings) {
    if (b.camp !== cid || !BLD[b.type].out) continue;
    const br = R.b[b.id] || {};
    let n = nodes.get(b.type);
    if (!n) nodes.set(b.type, n = { id: b.type, type: b.type, n: 0, w: 0, lvl: 0, out: {}, inn: {}, ks: {}, worst: b.id, wr: -1, st: '', short: new Set(), ins: Object.keys(BLD[b.type].in || {}), outs: Object.keys(BLD[b.type].out) });
    n.n++; n.w += b.workers || 0; n.lvl = Math.max(n.lvl, b.lvl);
    for (const k in br.rate || {}) n.out[k] = (n.out[k] || 0) + br.rate[k];
    for (const k in br.inRate || {}) n.inn[k] = (n.inn[k] || 0) + br.inRate[k];
    const sk = statusKind(br.status);
    n.ks[sk] = (n.ks[sk] || 0) + 1;
    if (RANK[sk] > n.wr) { n.wr = RANK[sk]; n.worst = b.id; n.st = br.status || ''; }
    if (br.status && br.status.startsWith('缺') && RES_BY_NAME[br.status.slice(1)]) n.short.add(RES_BY_NAME[br.status.slice(1)]);
  }
  for (const n of nodes.values()) n.kind = Object.keys(RANK).find(k => RANK[k] === n.wr) || 'idle';
  // 去处：熔炉烧燃料、居民吃熟食
  const used = {};
  for (const n of nodes.values()) for (const k in n.inn) used[k] = (used[k] || 0) + n.inn[k];
  if (camp) {
    const fb = Sim.getB(S, camp.furnace), burn = {};
    for (const k in FUEL) { const v = ((flow[k] || {}).c || 0) - (used[k] || 0); if (v > 0.01) burn[k] = v; }
    const fuels = Object.keys(burn).length ? Object.keys(burn) : ['wood'];
    nodes.set('furnace', { id: 'furnace', sink: true, type: 'furnace', n: 1, lvl: fb ? fb.lvl : 1, inn: burn, out: {}, ins: fuels, outs: [], worst: camp.furnace, kind: (cr.fueled ?? 1) < 0.999 ? 'short' : 'ok', short: new Set((cr.fueled ?? 1) < 0.999 ? fuels : []), st: (cr.fueled ?? 1) < 0.999 ? '燃料不够' : '' });
    const eat = (flow.food || {}).c || 0, hungry = (cr.hunger || 0) > 0.01;
    nodes.set('people', { id: 'people', sink: true, type: 'people', n: camp.people, inn: { food: eat }, out: {}, ins: ['food'], outs: [], worst: null, kind: hungry ? 'short' : 'ok', short: new Set(hungry ? ['food'] : []), st: hungry ? '吃不饱' : '' });
  }
  // 缺上游：用到某种物资却没有建筑产出它，画一个虚线的「空位」
  const makes = k => [...nodes.values()].filter(n => !n.sink && n.outs.includes(k));
  for (const n of [...nodes.values()]) for (const k of n.ins) {
    if (makes(k).length || nodes.has('miss:' + k)) continue;
    if (n.sink && k !== 'food' && k !== 'wood') continue;
    const maker = Object.keys(BLD).find(t => BLD[t].out && BLD[t].out[k] && BLD[t].t <= S.known && t !== 'nursery');
    nodes.set('miss:' + k, { id: 'miss:' + k, ghost: true, type: maker || null, k, n: 0, inn: {}, out: {}, ins: [], outs: [k], kind: 'idle', short: new Set(), st: '' });
  }
  // 有传送带直连的上下游（按建筑类型算）
  const belted = new Set();
  for (const e of S.belts || []) { if (e.camp !== cid) continue; const a = Sim.getB(S, e.a), b = Sim.getB(S, e.b); if (a && b) belted.add(a.type + '>' + b.type + ':' + e.k); }
  const sumOut = {};
  for (const n of nodes.values()) for (const k in n.out) sumOut[k] = (sumOut[k] || 0) + n.out[k];
  const edges = [];
  for (const c of nodes.values()) for (const k of c.ins) {
    const ps = makes(k).length ? makes(k) : nodes.has('miss:' + k) ? [nodes.get('miss:' + k)] : [];
    for (const p of ps) {
      const share = p.ghost ? 0 : sumOut[k] > 0 ? (p.out[k] || 0) / sumOut[k] : 1 / ps.length;
      edges.push({ from: p.id, to: c.id, k, rate: (c.inn[k] || 0) * share, short: c.short.has(k), nosrc: !!p.ghost, belt: belted.has(p.id + '>' + c.id + ':' + k) });
      if (p.ghost && c.short.has(k)) p.kind = 'short';
    }
  }
  // 层级：没有原料的在最左（0 层），下游一层层往右；熔炉和居民在最右
  const depth = new Map();
  const dep = (n, seen) => {
    if (depth.has(n.id)) return depth.get(n.id);
    if (seen.has(n.id)) return 0;
    seen.add(n.id);
    let d = 0;
    for (const e of edges) if (e.to === n.id && e.from !== n.id) d = Math.max(d, dep(nodes.get(e.from), seen) + 1);
    depth.set(n.id, d);
    return d;
  };
  let maxD = 0;
  for (const n of nodes.values()) if (!n.sink) maxD = Math.max(maxD, dep(n, new Set()));
  for (const n of nodes.values()) n.depth = n.sink ? maxD + 1 : depth.get(n.id);
  // 只进仓库的产品（木板、钢材……给建造用）
  for (const n of nodes.values()) n.toStore = n.outs.filter(k => !edges.some(e => e.from === n.id && e.k === k));
  return { nodes: [...nodes.values()], edges, maxD: maxD + 1, flow, cr };
}

// 摆位置：横排（电脑）每层一列，竖排（手机）每层一行、太多就折行；层内按上下游的平均位置排序，少交叉
export function layoutGraph(G, o) {
  const cols = [];
  for (const n of G.nodes) (cols[n.depth] ||= []).push(n);
  for (let d = 0; d < cols.length; d++) cols[d] ||= [];
  const ord = n => BLD[n.type] ? Object.keys(BLD).indexOf(n.type) : n.type === 'people' ? 999 : 998;
  for (const c of cols) c.sort((a, b) => ord(a) - ord(b));
  const pos = new Map();
  const idxOf = () => { pos.clear(); for (const c of cols) c.forEach((n, i) => pos.set(n.id, i / Math.max(1, c.length - 1))); };
  const bary = (n, dir) => { const l = G.edges.filter(e => (dir > 0 ? e.to === n.id : e.from === n.id)).map(e => pos.get(dir > 0 ? e.from : e.to)).filter(v => v != null); return l.length ? l.reduce((a, b) => a + b, 0) / l.length : pos.get(n.id); };
  for (let it = 0; it < 3; it++) {
    idxOf();
    for (let d = 1; d < cols.length; d++) { cols[d].sort((a, b) => bary(a, 1) - bary(b, 1)); idxOf(); }
    for (let d = cols.length - 2; d >= 0; d--) { cols[d].sort((a, b) => bary(a, -1) - bary(b, -1)); idxOf(); }
  }
  const { w, h, gx, gy, pad, horiz, per } = o;
  const out = new Map();
  let W = 0, H = 0;
  if (horiz) {
    const tall = Math.max(...cols.map(c => c.length));
    cols.forEach((c, d) => c.forEach((n, i) => { const y0 = (tall - c.length) * (h + gy) / 2; out.set(n.id, { x: pad + d * (w + gx), y: pad + y0 + i * (h + gy) }); }));
    W = pad * 2 + cols.length * (w + gx) - gx; H = pad * 2 + tall * (h + gy) - gy;
  } else {
    let y = pad;
    const rowW = per * (w + gx) - gx;
    for (const c of cols) {
      for (let r = 0; r < c.length; r += per) {
        const row = c.slice(r, r + per), x0 = pad + (rowW - (row.length * (w + gx) - gx)) / 2;
        row.forEach((n, i) => out.set(n.id, { x: x0 + i * (w + gx), y }));
        y += h + gy * 0.6;
      }
      y += gy * 0.9;
    }
    W = pad * 2 + rowW; H = y - gy * 1.5 + pad;
  }
  return { pos: out, W, H };
}

export class ChainMap {
  constructor(game) {
    this.g = game;
    this.el = document.getElementById('chainmap');
    this.open = false;
    this.el.addEventListener('pointerdown', e => { if (e.target === this.el) { e.preventDefault(); this.hide(); } });
    this.el.addEventListener('click', e => {
      if (e.target.closest('[data-act=chainclose]')) { this.hide(); return; }
      const cb = e.target.closest('[data-chcamp]');
      if (cb) { this.g.S.active = +cb.dataset.chcamp; this.sig = ''; this.render(); return; }
      if (e.target.closest('[data-act=place]')) { this.hide(); return; } // 交给 UI 的放置
      const nd = e.target.closest('[data-bid]');
      if (nd) {
        const id = +nd.dataset.bid, b = Sim.getB(this.g.S, id);
        this.hide();
        if (b) { const s = BLD[b.type].size; this.g.view.focus(b.x + s / 2, b.y + s / 2); this.g.view.select(id); this.g.ui.open('bld', id); }
        return;
      }
      if (e.target.closest('[data-chpeople]')) { this.hide(); this.g.ui.open('stock'); }
    });
  }
  toggle() { if (this.open) this.hide(); else this.show(); }
  show() {
    const g = this.g;
    g.cancelModes(); g.ui.close(); g.ui.resDrawer(false);
    if (g.bigmap && g.bigmap.open) g.bigmap.hide();
    this.open = true; this.sig = '';
    this.el.classList.add('show');
    this.render();
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (this.open) this.render(); }, 1000);
  }
  hide() {
    if (!this.open) return;
    this.open = false; clearInterval(this.timer);
    this.el.classList.remove('show');
    setTimeout(() => { if (!this.open) { this.el.innerHTML = ''; this.sig = ''; } }, 250);
  }
  nodeHtml(n, p, o) {
    const ui = this.g.ui, S = this.g.S;
    const st = `left:${p.x}px;top:${p.y}px;width:${o.w}px;height:${o.h}px`;
    if (n.ghost) {
      const t = n.type;
      return `<div class="cmn ghost ${n.kind}" data-nid="${n.id}" style="${st}"><span class="cmi">${RICON[n.k]}</span><span class="cmt"><b>没有${RES[n.k].n}来源</b><span class="cms">${n.kind === 'short' ? '已经断供' : `库存还有 ${fmt(S.camps.find(c => c.id === S.active)?.stock[n.k] || 0)}`}</span>${t ? `<button class="small ${n.kind === 'short' ? 'go' : ''}" data-act="place" data-arg="${t}">建${BLD[t].n}</button>` : ''}</span></div>`;
    }
    let ico, name, sub = '';
    if (n.type === 'people') { ico = RICON.people; name = '居民'; sub = `${n.n} 人`; }
    else if (n.type === 'furnace') { ico = ui.ico('furnace', n.lvl); name = '熔炉'; sub = `${n.lvl} 级`; }
    else { ico = ui.ico(n.type, n.lvl); name = BLD[n.type].n; sub = n.n > 1 ? `×${n.n}` : ''; }
    const dots = n.sink ? '' : `<span class="cmd">${Object.keys(RANK).filter(k => n.ks[k]).map(k => `<i class="${k}" title="${KIND_TXT[k]}">${n.ks[k]}</i>`).join('')}</span>`;
    return `<div class="cmn ${n.kind}" data-nid="${n.id}" ${n.worst ? `data-bid="${n.worst}"` : n.type === 'people' ? 'data-chpeople="1"' : ''} style="${st}">
      <span class="cmi">${ico}</span><span class="cmt"><b>${esc(name)} <small>${sub}</small></b><span class="cmr" data-r="${n.id}"></span><span class="cms" data-s="${n.id}"></span></span>${dots}</div>`;
  }
  // 节点文字和连线粗细每秒刷新；节点有增减才整张重画
  render() {
    const S = this.g.S, camp = Sim.getCamp(S, S.active) || S.camps[0];
    const G = chainGraph(S, camp.id);
    const horiz = innerWidth >= innerHeight * 1.05 && innerWidth > 640;
    const o = horiz ? { w: 168, h: 66, gx: 74, gy: 16, pad: 18, horiz } : { w: Math.min(110, (Math.min(innerWidth, 560) - 44) / 3 - 10), h: 92, gx: 10, gy: 34, pad: 12, horiz, per: 3 };
    const sig = camp.id + '|' + horiz + '|' + G.nodes.map(n => n.id + ':' + n.depth + ':' + (n.n > 1 ? 'm' : 's') + (n.lvl || 0)).join(',') + '|' + G.edges.map(e => e.from + '>' + e.to + e.k).join(',');
    if (sig !== this.sig) {
      this.sig = sig;
      const L = layoutGraph(G, o);
      this.L = L; this.o = o;
      const camps = S.camps.length > 1 ? `<div class="cmcamps">${S.camps.map(c => `<button class="small ${c.id === camp.id ? 'go' : ''}" data-chcamp="${c.id}">${esc(c.name)}</button>`).join('')}</div>` : '';
      let svg = `<svg class="cmsvg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}">`;
      const chips = [], seen = new Map();
      G.edges.forEach((e, i) => {
        const a = L.pos.get(e.from), b = L.pos.get(e.to);
        let x1, y1, x2, y2, d;
        if (horiz) { x1 = a.x + o.w; y1 = a.y + o.h / 2; x2 = b.x; y2 = b.y + o.h / 2; const m = Math.max(30, (x2 - x1) / 2); d = `M${x1},${y1} C${x1 + m},${y1} ${x2 - m},${y2} ${x2},${y2}`; }
        else { x1 = a.x + o.w / 2; y1 = a.y + o.h; x2 = b.x + o.w / 2; y2 = b.y; const m = Math.max(24, (y2 - y1) / 2); d = `M${x1},${y1} C${x1},${y1 + m} ${x2},${y2 - m} ${x2},${y2}`; }
        svg += `<path class="cme" data-e="${i}" d="${d}" style="--c:${RES[e.k].c}"/>`;
        // 每个上游每种产品一个小标签，贴在出口处
        const ck = e.from + '>' + e.k;
        if (!seen.has(ck)) {
          const src = G.nodes.find(n => n.id === e.from), j = Math.max(0, src.outs.indexOf(e.k)), m = src.outs.length;
          const cx = horiz ? x1 + 20 : x1 + (j - (m - 1) / 2) * 44, cy = horiz ? y1 + (j - (m - 1) / 2) * 22 : y1 + 13;
          seen.set(ck, 1);
          chips.push(`<span class="cmc" data-ec="${esc(ck)}" style="left:${cx}px;top:${cy}px">${RICON[e.k]}<em></em></span>`);
        }
      });
      svg += `</svg>`;
      const html = `<div class="cmbox"><div class="phead"><b>生产链 <small>${esc(camp.name)} · 点建筑看详情</small></b><button class="x" data-act="chainclose">✕</button></div>
        ${camps}<div class="cmsum" data-sum="1"></div>
        <div class="cmscroll"><div class="cmin" style="width:${L.W}px;height:${L.H}px">${svg}${G.nodes.map(n => this.nodeHtml(n, L.pos.get(n.id), o)).join('')}${chips.join('')}</div></div>
        <div class="bmleg"><span><i class="lg ok"></i>运转</span><span><i class="lg slow"></i>变慢 / 满仓</span><span><i class="lg short"></i>缺料 / 采空</span><span><i class="lg idle"></i>没人</span><span><i class="lgl b"></i>传送带</span><span><i class="lgl"></i>红虚线 = 供不上</span><span><i class="lgl g"></i>灰虚线 = 没有来源、在用库存</span></div></div>`;
      const sc = this.el.querySelector('.cmscroll'), keep = sc ? [sc.scrollLeft, sc.scrollTop] : null;
      this.el.innerHTML = iconize(html);
      if (keep) { const s2 = this.el.querySelector('.cmscroll'); s2.scrollLeft = keep[0]; s2.scrollTop = keep[1]; }
    }
    this.update(G, camp);
  }
  update(G, camp) {
    const el = this.el, cr = G.cr;
    for (const n of G.nodes) {
      const r = el.querySelector(`[data-r="${CSS.escape(n.id)}"]`), s = el.querySelector(`[data-s="${CSS.escape(n.id)}"]`), box = el.querySelector(`[data-nid="${CSS.escape(n.id)}"]`);
      if (box) box.className = `cmn ${n.ghost ? 'ghost ' : ''}${n.kind}`;
      if (r) {
        let t;
        if (n.type === 'people') t = `${RICON.food} 吃 ${fmt(n.inn.food || 0)}/分`;
        else if (n.type === 'furnace') t = `🔥 烧 ${fmt(cr.burnPerMin || 0)} 燃料/分`;
        else t = n.outs.map(k => `${RICON[k]} ${fmt(n.out[k] || 0)}/分`).join(' ');
        r.innerHTML = iconize(t);
      }
      if (s) {
        const msg = n.st && n.kind !== 'ok' ? n.st : n.toStore && n.toStore.length && !n.sink ? `→ 仓库（建造用）` : '';
        s.textContent = msg; s.className = `cms ${n.kind}`;
      }
    }
    let maxR = 0.01;
    for (const e of G.edges) maxR = Math.max(maxR, e.rate);
    const agg = new Map();
    G.edges.forEach((e, i) => {
      const p = el.querySelector(`[data-e="${i}"]`);
      if (p) { p.style.strokeWidth = (1.5 + 5 * Math.sqrt(e.rate / maxR)).toFixed(2); p.classList.toggle('belt', !!e.belt); p.classList.toggle('short', !!e.short); p.classList.toggle('nosrc', !e.short && !!e.nosrc); p.classList.toggle('still', e.rate < 0.01 && !e.short && !e.nosrc); }
      const ck = e.from + '>' + e.k, a = agg.get(ck) || { r: 0, short: false, nosrc: false };
      a.r += e.rate; a.short ||= e.short; a.nosrc ||= e.nosrc; agg.set(ck, a);
    });
    for (const [ck, a] of agg) {
      const c = el.querySelector(`[data-ec="${CSS.escape(ck)}"]`); if (!c) continue;
      c.classList.toggle('short', a.short); c.classList.toggle('nosrc', !a.short && a.nosrc);
      c.querySelector('em').textContent = a.short && a.r < 0.01 ? '缺' : a.nosrc ? '用库存' : a.r >= 0.01 ? fmt(a.r) : '';
    }
    // 一句话：最缺的东西
    const f = G.flow;
    let worst = null, ws = 0;
    for (const k in f) { const q = f[k]; if (!q || q.want <= 0.05) continue; const gap = (q.want - q.c) / q.want; if (gap > 0.08 && gap > ws) { ws = gap; worst = k; } }
    const cnt = {}; for (const n of G.nodes) if (!n.sink && !n.ghost) for (const k in n.ks) cnt[k] = (cnt[k] || 0) + n.ks[k];
    const sum = el.querySelector('[data-sum]');
    if (sum) sum.innerHTML = iconize(`${Object.keys(RANK).filter(k => cnt[k]).map(k => `<span class="cmk ${k}">${KIND_TXT[k]} ${cnt[k]}</span>`).join('')}${worst ? `<span class="cmw">最卡：${RICON[worst]}${RES[worst].n}，只够 ${Math.round((1 - ws) * 100)}%</span>` : `<span class="cmw okk">没有缺料</span>`}`);
  }
}
