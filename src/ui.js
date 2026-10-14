// 界面：顶部状态、资源条、底部工具栏、面板、提示
import { BRIEF, RES, RES_KEYS, BLD, BLD_KEYS, CATS, TIER_NAMES, LANDMARKS, FAR_MARKS, SPECS, SPEC_MAX, EMBER_UPS, emberCost, specTrainCost, specBonus, FUEL, furnaceRadius, furnaceHeat, furnaceBurn, baseTempOfRow, tierOfRow, ETERNAL_STAGES, GATE, GATE_EVERY, STORY, SPOTS, SPOT_KEYS, dayCycle, LAWS, TECHS, TECH_BR, SITES, CHAPTERS, INFRA, RAIDERS, DAY_LEN, DIFF, DIFF_KEYS, SLOTS, FOCUS, FOCUS_KEYS, FOCUS_LVL } from './data.js';
import * as Sim from './sim.js';
import { personOf, personState, campVoices } from './people.js';
import { getWorld, idx, W, H } from './worldgen.js';
import { iconize } from './icons.js';
import { chartHtml, chartHover, chartLeave, CV_COL, fmtV, dayLabel } from './curves.js';

export const ICON = {
  furnace: '🔥', tent: '⛺', lumber: '🪓', nursery: '🌲', quarry: '⛏️', hunter: '🏹', sawmill: '🪚', kitchen: '🍲', warehouse: '📦', tower: '🗼', scout: '🚩', kennel: '🐕', workshop: '🔬', lamp: '🏮', flagpole: '🚩', infirmary: '🩺', statue: '🗽', flowerhouse: '🌷',
  coalmine: '⚫', ironmine: '🟤', smelter: '🏭', coker: '🧱', limequarry: '⬜', steelworks: '🏗️', gearworks: '⚙️', engineworks: '🚂', greenhouse: '🌱', heater: '♨️',
  shalepit: '🛢️', refinery: '⚗️', sealworks: '🔩', crystalmine: '💎', batteryworks: '🔋', alloyworks: '🧪', salvage: '🛸', partworks: '🧩', coreworks: '🤖', bay: '🦾', excavator: '🔶', forge: '⚒️',
};
export const RICON = {
  wood: '🪵', stone: '🪨', game: '🥩', plank: '🟫', food: '🍖', coal: '⚫', ore: '🟤', iron: '🔘', coke: '◼️', lime: '⬜', steel: '🔷', gear: '⚙️', engine: '🚂',
  shale: '🛢️', tar: '🖤', seal: '🔩', crystal: '💎', battery: '🔋', alloy: '🧪', star: '🌠', part: '🧩', core: '🤖', shard: '🔶', heart: '🌟', people: '👥',
};
const BUFF_TXT = b => ({ prod: `产量 ${b.v > 0 ? '+' : ''}${Math.round(b.v * 100)}%`, fuel: `燃料消耗 ${b.v > 0 ? '+' : ''}${Math.round(b.v * 100)}%`, heat: `体感 +${b.v}°`, shield: `暴风雪降温 −${Math.round(b.v * 100)}%`, def: `防御 +${Math.round(b.v * 100)}%` })[b.k] || '';
const TUT = [
  { b: 'lumber', why: '伐木场要挨着树林，预览框上会写能采到几处资源点。木材是燃料，也是建材。' },
  { b: 'tent', why: '帐篷提供床位和保温，有空床才会有人来投奔。' },
  { b: 'hunter', why: '猎人小屋放在有驯鹿的猎场旁边，打回生肉。' },
  { b: 'kitchen', why: '厨房把生肉做成熟食，大家靠它活着。' },
  { k: 'stock', why: '顶部物资栏能打开总览：每种物资进出多少、卡在哪一环都写着。' },
  { k: 'furnace', why: '点任何建筑都能看到它的状态、派人和升级。熔炉是营地的心脏，升级后供热圈会变大。' },
];
// 建筑状态 → 头顶小图标；严重的状态用红色
const RES_BY_NAME = Object.fromEntries(Object.entries(RES).map(([k, r]) => [r.n, k]));
const STATUS_BAD = st => st.startsWith('缺') || st.includes('采空') || st === '没有派人' || st === '没人干活';
const STATUS_ICON = st => st.startsWith('缺') ? (RICON[RES_BY_NAME[st.slice(1)]] || '!') : st.includes('采空') ? '⛏' : st === '没有派人' || st === '没人干活' || st === '人手不足' ? '👷' : st === '搬运工不够' ? '🛷' : st.startsWith('太冷') ? '❄' : st.startsWith('等') ? '🌱' : st === Sim.KEEP_WHY ? '🔒' : st === Sim.DEEP_WHY ? '⛏' : '!';

export function fmt(n) {
  n = +n || 0;
  const a = Math.abs(n);
  // 大数字按中文习惯：1.2万、35万、1.2亿
  if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '亿';
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '万';
  if (a >= 100) return Math.round(n).toString();
  if (a >= 10) return n.toFixed(0);
  return (Math.round(n * 10) / 10).toString();
}
export function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  if (s >= 86400) return `${Math.floor(s / 86400)}天${Math.floor(s % 86400 / 3600)}小时`;
  if (s >= 3600) return `${Math.floor(s / 3600)}小时${Math.floor(s % 3600 / 60)}分`;
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${s}秒`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function costHtml(stock, cost, known = 99) {
  return Object.keys(cost).map(k => {
    const have = stock[k] || 0, ok = have >= cost[k];
    const lock = RES[k].t > known;
    return `<span class="cost ${ok ? '' : 'miss'} ${lock ? 'lock' : ''}" title="${RES[k].n}">${RICON[k]}${fmt(cost[k])}</span>`;
  }).join(' ');
}

// 研究树布局：列 = 前置深度；第一个子节点沿用父节点那一行，其余往下找空行
function techLayout(list) {
  const by = Object.fromEntries(list.map(t => [t.id, t])), depth = {};
  const dep = t => depth[t.id] ?? (depth[t.id] = (t.req || []).filter(r => by[r]).reduce((m, r) => Math.max(m, dep(by[r]) + 1), 0));
  list.forEach(dep);
  const kids = id => list.filter(t => (t.req || [])[0] === id);
  const at = {}, used = new Set();
  const put = (t, lane) => { while (used.has(lane + ':' + depth[t.id])) lane++; used.add(lane + ':' + depth[t.id]); at[t.id] = { col: depth[t.id], lane }; kids(t.id).forEach((k, i) => put(k, i ? lane + 1 : lane)); };
  list.filter(t => !(t.req || []).some(r => by[r])).forEach(t => put(t, 0));
  const vals = Object.values(at);
  return { at, cols: Math.max(...vals.map(v => v.col)) + 1, lanes: Math.max(...vals.map(v => v.lane)) + 1 };
}
// 有页签的面板
const PANEL_TABS = { camp: [['sum', '概况'], ['infra', '基建'], ['road', '旅程']] };

export class UI {
  constructor(game) {
    this.g = game;
    this.$ = id => document.getElementById(id);
    this.sheet = this.$('sheet');
    this.panel = null; // {kind, ...}
    this.buildTier = 1;
    this.sheetDown = false;
    this.sheet.addEventListener('pointerdown', () => { this.sheetDown = true; });
    window.addEventListener('pointerdown', e => { this.lastTap = { x: e.clientX, y: e.clientY, t: performance.now() }; }, true);
    this.sheet.addEventListener('scroll', () => { this.sheetScrollT = performance.now(); }, true);
    // 数据曲线：指针在图上移动 / 按住时显示那一刻的数
    const cvMove = e => { const b = e.target.closest && e.target.closest('.cv'); if (!b) { if (this.cvHot) { chartLeave(this.cvHot); this.cvHot = null; } return; } if (this.cvHot && this.cvHot !== b) chartLeave(this.cvHot); this.cvHot = b; chartHover(b, (this.cvMeta || {})[b.dataset.cv], e.clientX); };
    this.sheet.addEventListener('pointermove', cvMove);
    this.sheet.addEventListener('pointerdown', cvMove);
    this.sheet.addEventListener('pointerleave', () => { if (this.cvHot) { chartLeave(this.cvHot); this.cvHot = null; } });
    // 手机上拖动面板滚动时浏览器发的是 pointercancel、不发 pointerup：也要松开，不然面板停在旧数字上
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => { setTimeout(() => { this.sheetDown = false; }, 30); });
    document.body.addEventListener('click', e => this.onClick(e));
    document.body.addEventListener('change', e => this.onChange(e));
    this.labels = this.$('labels');
    // 点头顶的小图标直接打开那栋建筑；点营地牌子上的「仓库满」打开仓储面板
    this.$('stats').addEventListener('pointerdown', e => { if (e.target.closest('.pill.more')) { e.preventDefault(); this.resDrawer(); return; }
      if (e.target.closest('.pill.raid')) { e.preventDefault(); if (this.panel && this.panel.kind === 'raid') this.close(); else { this.g.cancelModes(); this.open('raid'); } return; }
      { const gp = e.target.closest('.pill.gang'); if (gp) { e.preventDefault(); const id = +gp.dataset.gang; if (this.panel && this.panel.kind === 'gang' && this.panel.arg === id) this.close(); else { this.g.cancelModes(); this.open('gang', id); } return; } }
      if (e.target.closest('.pill.car')) { e.preventDefault(); if (this.panel && this.panel.kind === 'caravan') this.close(); else { this.g.cancelModes(); this.open('caravan'); } return; }
      if (e.target.closest('.pill.aurgo')) { e.preventDefault(); this.surAurora(); return; }
      if (e.target.closest('.pill.wx')) { e.preventDefault(); if (this.panel && this.panel.kind === 'weather') this.close(); else { this.g.cancelModes(); this.open('weather'); } return; } if (!e.target.closest('.pill.mood')) return; e.preventDefault(); if (this.panel && this.panel.kind === 'mood') this.close(); else { this.g.cancelModes(); this.open('mood'); } });
    // 物资抽屉每 0.3 秒重画，用 pointerdown 接点击
    this.$('resdrawer').addEventListener('pointerdown', e => {
      const d = e.target.closest('[data-d]'); if (!d) return;
      e.preventDefault();
      if (d.dataset.d === 'x') this.resDrawer(false);
      else { this.resDrawer(false); this.g.cancelModes(); this.open('stock'); }
    });
    this.labels.addEventListener('pointerdown', e => {
      const bd = e.target.closest('.badge'), cf = e.target.closest('.ctfull'), st = e.target.closest('.sitetag'), qt = e.target.closest('.qtag'), ct = e.target.closest('.cartag');
      const rq = e.target.closest('.reqtag'), su = e.target.closest('.surtag');
      if (su) { e.stopPropagation(); e.preventDefault(); this.surClaim(); return; }
      if (rq) { e.stopPropagation(); this.g.cancelModes(); this.g.view.select(null); this.open('req', +rq.dataset.req); return; }
      const fm = e.target.closest('.lmtag.far');
      if (fm) { e.stopPropagation(); this.g.cancelModes(); this.g.view.select(null); this.open('far', +fm.dataset.far); }
      else if (ct) { e.stopPropagation(); this.g.cancelModes(); this.g.view.select(null); this.open('caravan'); }
      else if (qt) { e.stopPropagation(); this.g.cancelModes(); this.g.view.select(null); this.open('queue', +qt.dataset.q); }
      else if (st) { e.stopPropagation(); this.g.cancelModes(); if (st.classList.contains('wait')) this.siteModal(); else this.open('site', +st.dataset.site); }
      else if (bd) { e.stopPropagation(); const id = +bd.dataset.bid; this.g.cancelModes(); this.g.view.select(id); this.open('bld', id); }
      else if (cf) { e.stopPropagation(); const id = +cf.dataset.camp; this.S.active = id; this.open('stock'); }
    });
    this.lastHtml = '';
    this.thumbCls = new Map();
  }
  act_festgo(cid) { const c = Sim.getCamp(this.S, cid); if (!c) return; const L = this.g.view.lifeSpots(c), f = L && L.fest; const v = this.g.view; if (f) v.focus(f[0], f[1]); else v.focus(c.x, c.y); v.cam.tdist = Math.min(v.cam.tdist, 14); }
  surClaim() { const r = Sim.claimSurprise(this.S); if (!r.ok) this.toast(r.reason, 'warn'); }
  surAurora() { const r = Sim.watchAurora(this.S); if (!r.ok) this.toast(r.reason, 'warn'); else this.g.sfx('win'); this.hud(); }
  // 建筑缩略图：用 3D 模型现渲染一张，存成 CSS 类，HTML 里只放类名
  thumb(type, lvl = 1) {
    const v = this.g.view;
    const key = v.gkey(type, lvl);
    let cls = this.thumbCls.get(key);
    if (cls === undefined) {
      cls = null;
      try {
        const url = v.makeThumbs([[type, lvl]])[type];
        if (!this.thumbSheet) { const st = document.createElement('style'); document.head.appendChild(st); this.thumbSheet = st.sheet; }
        cls = 'tk' + this.thumbCls.size;
        this.thumbSheet.insertRule(`.${cls}{background-image:url(${url})}`, this.thumbSheet.cssRules.length);
      } catch (e) { console.warn('thumb', e); cls = null; }
      this.thumbCls.set(key, cls);
    }
    return cls;
  }
  ico(type, lvl = 1) { const c = this.thumb(type, lvl); return c ? `<i class="th ${c}"></i>` : ICON[type]; }
  get S() { return this.g.S; }
  camp() { return Sim.getCamp(this.S, this.S.active) || this.S.camps[0]; }

  // ---------- 提示 ----------
  // 提示：最多同时 3 条（手机 2 条），一模一样的合并成 ×N；点一下打开消息记录
  toast(msg, type = 'info', action) {
    const box = this.$('toasts'), max = innerWidth < 560 ? 2 : 3;
    const life = { info: 4200, good: 5000, warn: 6500, bad: 7500, story: 9000 }[type] || 5000;
    const key = type + '|' + msg;
    let d = [...box.children].find(x => x.dataset.k === key && !x.classList.contains('out'));
    if (d) {
      const n = (+d.dataset.n || 1) + 1; d.dataset.n = n;
      const tn = d.querySelector('.tn'); tn.textContent = '×' + n; tn.style.display = '';
    } else {
      d = document.createElement('div');
      d.className = 'toast ' + type; d.dataset.k = key; d.dataset.act = 'tb'; d.dataset.arg = 'log';
      d.innerHTML = iconize(`<span class="tm">${esc(msg)}</span><b class="tn" style="display:none"></b>${action ? `<button class="ta" data-act="${action.act}" data-arg="${action.arg ?? ''}">${esc(action.label)}</button>` : ''}<i class="tl"></i>`);
      box.appendChild(d);
    }
    // 重新计时（进度条从头走）
    const old = d.querySelector('.tl'), tl = document.createElement('i'); tl.className = 'tl'; tl.style.animationDuration = life + 'ms'; old.replaceWith(tl);
    clearTimeout(d._t); d._t = setTimeout(() => this.dropToast(d), life);
    const live = [...box.children].filter(x => !x.classList.contains('out'));
    for (let i = 0; i < live.length - max; i++) this.dropToast(live[i]);
    this.logBadge();
  }
  dropToast(d) { clearTimeout(d._t); d.classList.add('out'); setTimeout(() => d.remove(), 400); }
  // 侧边「消息」按钮上的未读数
  logBadge() {
    const S = this.S, b = this.$('logBtn'); if (!S || !b) return;
    const last = S.log[S.log.length - 1] || null;
    if (this.logSeen === undefined || (this.panel && this.panel.kind === 'log')) this.logSeen = last;
    const i = this.logSeen ? S.log.lastIndexOf(this.logSeen) : -1;
    const un = S.log.slice(i + 1), n = un.length, hot = un.some(l => l.kind === 'bad');
    const t = n > 9 ? '9+' : String(n);
    b.classList.toggle('unread', n > 0); b.classList.toggle('hot', hot);
    const el = b.querySelector('.lbn'); if (el.textContent !== t) el.textContent = t;
  }
  modal(html, buttons = [{ t: '好', a: 'close-modal' }]) {
    const m = this.$('modal');
    m.innerHTML = iconize(`<div class="mbox">${html}<div class="mbtns">${buttons.map(b => `<button class="btn ${b.cls || ''}" data-act="${b.a}" ${b.arg != null ? `data-arg="${b.arg}"` : ''}>${b.t}</button>`).join('')}</div></div>`);
    m.classList.add('show');
  }
  closeModal() { this.$('modal').classList.remove('show'); }
  // ---------- 存档位与难度 ----------
  slotLine(s) {
    if (s.empty) return '<span class="sl0">空位</span>';
    if (s.broken) return '<span class="sl0">存档坏了</span>';
    const ago = s.savedAt ? (Date.now() - s.savedAt) / 1000 : 0;
    return `<b>${esc(s.name)}</b><small>👥 ${s.people} 人 · 第 ${Math.floor((s.t || 0) / DAY_LEN) + 1} 天 · 第 ${s.runs} 次北行 · ${s.diff.ic}${s.diff.n}${s.cur ? '' : ago > 60 ? ` · ${fmtTime(ago)}前` : ' · 刚刚'}</small>`;
  }
  slotsModal() {
    const g = this.g; let rows = '';
    for (let n = 1; n <= SLOTS; n++) {
      const s = g.slotInfo(n);
      const btns = s.cur ? '<span class="slcur">正在玩</span>'
        : s.empty ? `<button class="small go" data-act="newrun" data-arg="${n}">开新的一局</button>`
        : `<button class="small go" data-act="slotuse" data-arg="${n}">读取</button><button class="small ghost" data-act="slotdel" data-arg="${n}">删除</button>`;
      rows += `<div class="slotrow ${s.cur ? 'cur' : ''}"><span class="sln">${n}</span><span class="sli">${this.slotLine(s)}</span><span class="slb">${btns}</span></div>`;
    }
    this.modal(`<h3>存档位</h3><div class="slots">${rows}</div><p class="hint">每个存档位都是独立的一局：余烬、专家、收集册分开记。换存档位会先保存现在这一局。</p>`, [{ t: '关闭', a: 'close-modal' }]);
  }
  newRunModal(slot, diff) {
    const g = this.g;
    if (slot == null) { slot = g.slot; for (let n = 1; n <= SLOTS; n++) if (g.slotInfo(n).empty) { slot = n; break; } }
    this.nr = { slot, diff: diff || (this.nr && this.nr.diff) || 'std' };
    const infos = Array.from({ length: SLOTS }, (_, i) => g.slotInfo(i + 1)), s = infos[slot - 1];
    const seg = `<div class="seg nrslots">${infos.map(x => `<button class="btn ${x.n === slot ? 'on' : ''}" data-act="nrslot" data-arg="${x.n}">存档 ${x.n}<small>${x.empty ? '空位' : esc(x.name)}</small></button>`).join('')}</div>`;
    const warn = s.empty ? '' : `<p class="nrwarn">会<b>覆盖</b>存档 ${slot} 里的「${esc(s.name)}」（👥 ${s.people} 人）：余烬、专家和收集册都会清空。</p>`;
    const cards = DIFF_KEYS.map(k => { const D = DIFF[k]; return `<button class="diffc ${k === this.nr.diff ? 'on' : ''}" data-act="nrdiff" data-arg="${k}"><b>${D.ic} ${D.n}</b><small>${D.d}</small></button>`; }).join('');
    this.modal(`<h3>新的北行</h3><div class="mlab">存在哪个存档位</div>${seg}${warn}<div class="mlab">难度<small>以后也能在菜单里改</small></div><div class="diffs">${cards}</div>`,
      [{ t: s.empty ? '开始北行' : '覆盖并开始', a: 'newrun-go', cls: s.empty ? 'go' : 'bad' }, { t: '算了', a: 'close-modal' }]);
  }
  diffModal() {
    const S = this.S, cur = S.meta.diff || 'std';
    const cards = DIFF_KEYS.map(k => { const D = DIFF[k]; return `<button class="diffc ${k === cur ? 'on' : ''}" data-act="diffset" data-arg="${k}"><b>${D.ic} ${D.n}${k === cur ? ' · 现在' : ''}</b><small>${D.d}</small></button>`; }).join('');
    this.modal(`<h3>难度</h3><div class="diffs">${cards}</div><p class="hint">改了马上生效。北迁带回的余烬按北迁那一刻的难度算。</p>`, [{ t: '关闭', a: 'close-modal' }]);
  }
  // 随机事件：一段描述 + 几个选项，每个选项写清后果
  eventModal() {
    const v = Sim.eventView(this.S); if (!v) return false;
    const m = this.$('modal');
    m.innerHTML = iconize(`<div class="mbox ev"><div class="evtag">${esc(v.camp)} · 事件</div><h2>${esc(v.title)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="ev" data-arg="${i}"` : 'disabled'}><b>${esc(o.t)}</b><small>${esc(o.d)}${o.ok ? '' : ' · 物资不够'}</small></button>`).join('')}</div></div>`);
    m.classList.add('show');
    return true;
  }

  // ---------- 手感：数字滚动、资源飞进顶栏、升级闪光 ----------
  rolled(k, v) { const r = this.roll && this.roll[k]; if (!r) return v; const e = Math.min(1, (performance.now() - r.t0) / r.dur); return r.from + (v - r.from) * (1 - Math.pow(1 - e, 3)); }
  // 每 0.3 秒比一次库存：一下子多出一大笔（奖励、带回的物资、返还）就飞图标、滚数字；花掉一大笔也滚
  watchStock(c, cr) {
    const now = performance.now(), P = this.prevStock, fl = cr.flow || {};
    this.prevStock = { camp: c.id, t: now, v: { ...c.stock } };
    if (!P || P.camp !== c.id || now - P.t > 1500 || this.g.titleOn) return;
    const ups = [];
    for (const k of RES_KEYS) {
      const a = P.v[k] || 0, b = c.stock[k] || 0, d = b - a, f = fl[k] || { p: 0, c: 0 };
      const usual = Math.max(f.p || 0, f.c || 0) / 60 * 3;
      if (Math.abs(d) < Math.max(10, usual, a * 0.02)) continue;
      (this.roll || (this.roll = {}))[k] = { from: this.rolled(k, a), t0: now, dur: Math.min(1100, 450 + Math.log2(Math.abs(d)) * 60) };
      if (d > 0) ups.push([k, d]);
    }
    if (ups.length) {
      const T = this.lastTap && now - this.lastTap.t < 1600 ? this.lastTap : null;
      const m = this.$('modal'), mb = m.classList.contains('show') && m.querySelector('.mbox');
      let from = T ? [T.x, T.y] : null;
      if (!from && mb) { const r = mb.getBoundingClientRect(); from = [r.left + r.width / 2, r.top + r.height / 2]; }
      if (!from) from = [innerWidth / 2, innerHeight * 0.45];
      ups.sort((x, y) => y[1] - x[1]).slice(0, 4).forEach(([k, d], j) => setTimeout(() => this.flyRes(from[0], from[1], k, Math.max(1, Math.min(6, Math.round(Math.log2(d / 8))))), j * 140));
    }
  }
  // 资源图标落到顶栏的哪里：电脑上是对应的物资格，不在格子里就落到「全部」；手机落到展开按钮（熟食落到熟食那格）
  resTarget(k) {
    const vis = e => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? e : null; };
    return vis(this.$('reschips').querySelector(`.res[data-k="${k}"]`)) || (k === 'food' && vis(this.$('stats').querySelector('[data-rk=food]')?.closest('.pill'))) || vis(this.$('resAll')) || vis(this.$('stats').querySelector('.pill.more'));
  }
  fxLayer() { let l = this.$('fxl'); if (!l) { l = document.createElement('div'); l.id = 'fxl'; document.body.appendChild(l); } return l; }
  flyRes(x, y, k, n, small) {
    const tg = this.resTarget(k); if (!tg || !RICON[k]) return;
    const L = this.fxLayer(), r = tg.getBoundingClientRect(), tx = r.left + Math.min(16, r.width / 2), ty = r.top + r.height / 2;
    let landed = 0;
    for (let i = 0; i < n; i++) {
      const e = document.createElement('i'); e.className = 'flyi' + (small ? ' sm' : ''); e.innerHTML = iconize(RICON[k]); L.appendChild(e);
      const ox = (Math.random() - 0.5) * 46, oy = (Math.random() - 0.5) * 30, mx = (x + ox + tx) / 2 + (Math.random() - 0.5) * 60, my = Math.min(y + oy, ty) - 40 - Math.random() * 50;
      const an = e.animate([
        { transform: `translate(${x}px,${y}px) scale(.4)`, opacity: 0 },
        { transform: `translate(${x + ox}px,${y + oy}px) scale(1.15)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${tx}px,${ty}px) scale(.6)`, opacity: 0.9 },
      ], { duration: (small ? 820 : 760) + i * 40, delay: i * 70, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'backwards' });
      an.onfinish = () => { e.remove(); if (landed++ === 0) this.bump(tg); };
    }
  }
  // 落点闪一下：叠一层光圈在上面（顶栏每 0.3 秒重画，直接给格子加动画会被冲掉）
  bump(tg) {
    const r = tg.getBoundingClientRect(); if (!r.width) return;
    const e = document.createElement('i'); e.className = 'bumpfx';
    Object.assign(e.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    this.fxLayer().appendChild(e);
    e.animate([{ opacity: 0.95, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.18,1.35)' }], { duration: 520, easing: 'ease-out' }).onfinish = () => e.remove();
  }
  // 建好 / 升级：建筑上方一圈光 + 「升到 N 级」
  watchLevels() {
    const S = this.S, L = this.lvls, now = new Map();
    for (const b of S.buildings) now.set(b.id, b.lvl);
    this.lvls = now;
    if (!L || this.lvlS !== S || this.g.titleOn) { this.lvlS = S; return; }
    let n = 0;
    for (const b of S.buildings) {
      const was = L.get(b.id);
      if (was === b.lvl || n >= 3) continue;
      n++;
      this.upFx(b, was == null ? '建成' : `升到 ${b.lvl} 级`, b.type === 'furnace' && was != null);
    }
  }
  upFx(b, txt, big) {
    const v = this.g.view, s = BLD[b.type].size, x = b.x + s / 2, y = b.y + s / 2;
    if (!v.project(x, y, 1).on) return;
    const e = document.createElement('div'); e.className = 'upfx' + (big ? ' big' : '');
    e.innerHTML = `<i></i><b>${esc(BLD[b.type].n)} · ${txt}</b>`;
    this.$('floats').appendChild(e);
    (this.fxl || (this.fxl = [])).push({ e, x, y, h: 1 + s * 0.4, t0: performance.now(), dur: big ? 1700 : 1400 });
  }
  // 每帧：滚动中的数字、跟着镜头走的升级光
  juice() {
    const now = performance.now();
    if (this.roll) for (const k in this.roll) {
      const r = this.roll[k], done = now - r.t0 >= r.dur, val = done ? null : this.rolled(k, this.camp().stock[k] || 0);
      if (done) delete this.roll[k];
      const txt = fmt(done ? this.camp().stock[k] || 0 : val);
      for (const e of document.querySelectorAll(`[data-rk="${k}"]`)) if (e.textContent !== txt) e.textContent = txt;
    }
    if (this.fxl && this.fxl.length) {
      const v = this.g.view;
      this.fxl = this.fxl.filter(f => {
        const k = (now - f.t0) / f.dur;
        if (k >= 1) { f.e.remove(); return false; }
        const p = v.project(f.x, f.y, f.h);
        f.e.style.transform = `translate(${p.x | 0}px,${p.y | 0}px)`;
        f.e.style.visibility = p.on ? '' : 'hidden';
        f.e.style.setProperty('--k', k.toFixed(3));
        return true;
      });
    }
  }

  // ---------- 产出飘字：镜头附近运转中的建筑，每隔几秒冒一个「+5 🪵」 ----------
  floats(dt) {
    const g = this.g, S = this.S, v = g.view, layer = this.$('floats');
    const F = this.flt || (this.flt = { acc: new Map(), live: [], sweep: 0 });
    if (this.floatOn === undefined) { this.floatOn = true; try { this.floatOn = localStorage.getItem('hanjin-beixing-v1-floats') !== '0'; } catch (e) {} }
    const now = window.__floatHold || performance.now(); // 测试截图时可以把时间定住
    const on = this.floatOn && !g.titleOn && v.cam.dist < 44 && !g.place && dt < 0.5;
    if (on) {
      const R = Sim.rt(S), cx = v.cam.tx, cy = v.cam.ty, near = 8 + v.cam.dist * 0.55, MAX = g.quality === 'low' ? 6 : 14;
      for (const b of S.buildings) {
        const d = BLD[b.type], br = R.b[b.id];
        if (!br || !(d.out || d.research) || b.type === 'furnace') continue;
        let a = F.acc.get(b.id);
        if (!a) { a = { t: (b.id * 0.618 % 1) * 5, v: {} }; F.acc.set(b.id, a); }
        const rate = d.research ? (br.status === '研究中' ? { rp: br.rp || 0 } : {}) : (br.rate || {});
        for (const k in rate) if (rate[k] > 0) a.v[k] = (a.v[k] || 0) + rate[k] / 60 * dt;
        a.t += dt;
        if (a.t < 5) continue;
        a.t = 0;
        const s = d.size, bx = b.x + s / 2, by = b.y + s / 2;
        if (Math.abs(bx - cx) > near || Math.abs(by - cy) > near || !v.project(bx, by, 1.1 + s * 0.45).on) { a.v = {}; continue; }
        const ks = Object.keys(a.v).filter(k => a.v[k] >= 1).sort((x, y) => (RES[y] ? RES[y].t : 9) - (RES[x] ? RES[x].t : 9)).slice(0, 2);
        if (!ks.length || F.live.length >= MAX) continue;
        const txt = ks.map(k => { const n = Math.floor(a.v[k]); a.v[k] -= n; return `<b>+${fmt(n)}</b>${k === 'rp' ? '🔬' : RICON[k]}`; }).join(' ');
        const el = document.createElement('div'); el.className = 'pfl'; el.innerHTML = iconize(`<span>${txt}</span>`); layer.appendChild(el);
        if (ks[0] !== 'rp' && now - (F.flyT || 0) > 1800) { const p = v.project(bx, by, 1.1 + s * 0.45), tg = this.$('reschips').querySelector(`.res[data-k="${ks[0]}"]`); if (p.on && tg && tg.offsetWidth) { F.flyT = now; setTimeout(() => this.flyRes(p.x, p.y - 30, ks[0], 1, true), 900); } }
        F.live.push({ el, x: bx, y: by, h: 1.1 + s * 0.45, t0: now });
      }
      if ((F.sweep += dt) > 20) { F.sweep = 0; for (const id of F.acc.keys()) if (!Sim.getB(S, id)) F.acc.delete(id); }
    }
    F.live = F.live.filter(f => {
      if (now - f.t0 > 2400 || (!on && now - f.t0 > 200)) { f.el.remove(); return false; }
      const p = v.project(f.x, f.y, f.h), k = (now - f.t0) / 2400, e = 1 - (1 - k) * (1 - k);
      f.el.style.transform = `translate(${p.x | 0}px,${(p.y + 6 - 36 * e) | 0}px) scale(${k < 0.12 ? 0.85 + k * 1.25 : 1})`;
      f.el.style.opacity = k < 0.12 ? k / 0.12 : k > 0.7 ? (1 - k) / 0.3 : 1;
      f.el.style.visibility = p.on ? '' : 'hidden';
      return true;
    });
  }

  // ---------- 开场标题画面 ----------
  showTitle(hasSave) {
    const S = this.S, el = this.$('title'), v = this.g.view, c = this.camp();
    this.g.titleDist = v.cam.tdist;
    const narrow = innerWidth < 700; v.focus(c.x, c.y - (narrow ? (hasSave ? 9 : 5) : 2), true); v.cam.tdist = v.cam.dist = hasSave ? 26 : 17;
    const chs = Sim.chapters(S), ch = chs[chs.length - 1], ppl = S.camps.reduce((a, x) => a + x.people, 0);
    const ago = S.savedAt ? (Date.now() - S.savedAt) / 1000 : 0;
    const D = Sim.diffOf(S);
    const card = hasSave ? `<div class="tsave"><b>🔥 ${esc(c.name)}</b><span>${ch ? esc(ch.ch.n) : ''}</span><small>存档 ${this.g.slot} · ${D.ic}${D.n} · 👥 ${ppl} 人 · 第 ${S.meta.runs || 1} 次北行${ago > 60 ? ` · 上次来是 ${fmtTime(ago)}前` : ''}</small></div>` : '';
    el.innerHTML = iconize(`<div class="tshade"></div><div class="tbox">
      <div class="tkick">HAN · JIN · BEI · XING</div>
      <h1 class="tname">${'寒烬北行'.split('').map((ch, i) => `<span style="animation-delay:${0.15 + i * 0.12}s">${ch}</span>`).join('')}</h1>
      <p class="ttag">世界在一个冬天里冻住了。<br>一程一程往北走，重新点燃永恒之炉。</p>
      ${card}
      <div class="tbtns">
        <button class="tbtn go" data-act="title-go">${hasSave ? '继续北行' : '开始北行'}</button>
        <button class="tbtn" data-act="help">怎么玩</button>
        ${hasSave ? '<button class="tbtn ghost" data-act="title-new">新的北行</button><button class="tbtn ghost" data-act="slots">存档位</button>' : ''}
      </div></div>
      <div class="tfoot">v11 · 低多边形冬日生存经营</div>`);
    el.classList.add('show'); document.body.classList.add('titled');
  }
  hideTitle() { const el = this.$('title'); el.classList.add('out'); document.body.classList.remove('titled'); setTimeout(() => { el.classList.remove('show', 'out'); el.innerHTML = ''; }, 700); }

  // 探险队到了地点：选一种做法
  siteModal() {
    const S = this.S, s = Sim.expPending(S); if (!s) return false;
    const v = Sim.siteView(S, s); if (!v) return false;
    if (this.panel && this.panel.kind === 'site') this.close();
    const m = this.$('modal'), K = SITES[v.p.kind];
    m.innerHTML = iconize(`<div class="mbox ev"><div class="evtag">🧭 探险队 · ${s.n} 人 · ${s.sup === 'full' ? '补给充足' : '轻装'}</div><h2>${K.ic} ${esc(v.title)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="siteopt" data-arg="${s.id}:${i}"` : 'disabled'}><b>${o.need ? '⛺ ' : ''}${esc(o.t)}</b><small>${esc(o.d)}${o.ok ? '' : ' · 要带足补给才能做'}</small></button>`).join('')}</div></div>`);
    m.classList.add('show');
    return true;
  }

  // 点亮远方地标：带回一件遗物
  relicModal(i) {
    const f = FAR_MARKS[i]; if (!f) return false;
    const m = this.$('modal'); if (m.classList.contains('show')) return false;
    const n = Object.keys(this.S.meta.relics || {}).length;
    m.innerHTML = iconize(`<div class="mbox chap"><div class="evtag">✨ 永夜冰原 · 第 ${n} / ${FAR_MARKS.length} 件遗物</div><h2>${esc(f.n)}</h2><p class="story">${esc(f.desc)}</p><div class="relic own"><div class="rli">🏺</div><div><b>遗物「${esc(f.relic.n)}」</b><span>${esc(f.relic.d)}</span><small>永久生效，北迁后也保留</small></div></div><div class="mbtns"><button class="btn go" data-act="close-modal">继续往北</button></div></div>`);
    m.classList.add('show');
    return true;
  }
  // 新的一章：开场故事 + 三个任务
  chapterModal(i) {
    const ch = CHAPTERS[i]; if (!ch) return false;
    const m = this.$('modal');
    m.innerHTML = iconize(`<div class="mbox chap"><div class="evtag">📖 新的一章 · ${esc(LANDMARKS[i].n)}</div><h2>${esc(ch.n)}</h2><p class="story">${esc(ch.story)}</p>${BRIEF[i] ? `<div class="brief"><span class="advf">老</span><div><b>老向导</b>${BRIEF[i].map(x => `<p>${esc(x)}</p>`).join('')}</div></div>` : ''}<div class="sec">这一章要做的事</div><ul class="ctl">${ch.tasks.map(t => `<li>${esc(t.t)}</li>`).join('')}</ul><div class="crw">🎁 奖励：${esc(Sim.chapterReward(this.S, i).join('，'))}</div><div class="mbtns"><button class="btn go" data-act="close-modal">出发</button></div></div>`);
    m.classList.add('show');
    return true;
  }

  // ---------- 顶部 ----------
  // 每种物资：库存、流量、是不是缺 / 满
  resInfo(c, cr, keys) {
    const flow = cr.flow || {}, cap = cr.cap || 0, S = this.S;
    const ks = keys.filter(k => k !== 'food' && RES[k].t <= S.known);
    if (RES.food) ks.splice(ks.findIndex(k => RES[k].t > 1) < 0 ? ks.length : ks.findIndex(k => RES[k].t > 1), 0, 'food');
    return ks.map(k => {
      const f = flow[k] || { p: 0, c: 0, want: 0 }, have = c.stock[k] || 0, net = f.p - f.c;
      const short = (f.want > 0.05 && f.want - f.c >= Math.max(0.05, f.want * 0.08)) || (net < -0.05 && have < -net * 5 && have < cap * 0.5);
      const full = !!cap && have >= cap * 0.98 && f.p > 0.05;
      return { k, have, f, net, short, full, fr: cap ? Math.min(1, have / cap) : 0, act: f.p > 0.01 || f.c > 0.01 };
    });
  }
  // 顶栏常驻哪几种：缺的 > 满的 > 眼下最高两层在用的 > 木石板 > 其他在流动的；每 4 秒才重排一次，免得跳来跳去
  resPick(ri, cid) {
    const bar = this.$('resbar');
    if (!this.resbarRO && window.ResizeObserver) { this.resbarRO = new ResizeObserver(es => { this.resbarW = es[0].contentRect.width; }); this.resbarRO.observe(bar); this.resbarW = bar.clientWidth; }
    const w = (this.resbarRO ? this.resbarW : bar.clientWidth) || innerWidth;
    const K = Math.max(3, Math.min(8, Math.floor((w - 74) / 76)));
    const list = ri.filter(r => r.k !== 'food');
    const topT = Math.max(1, ...list.filter(r => r.f.p > 0.01).map(r => RES[r.k].t));
    const score = r => { const t = RES[r.k].t; return r.short ? 1000 + t : r.full ? 500 + t : r.act && t >= topT - 1 ? 100 + t * 10 : ['wood', 'stone', 'plank'].includes(r.k) ? 50 : r.act ? 20 + t : t; };
    const now = performance.now(), P = this.resSel;
    const must = list.filter(r => r.short || r.full).map(r => r.k);
    const stale = !P || P.cid !== cid || P.K !== K || now - P.at > 4000 || must.some(k => !P.keys.includes(k)) || P.keys.some(k => !list.find(r => r.k === k));
    if (stale) {
      const keys = list.slice().sort((a, b) => score(b) - score(a)).slice(0, K).map(r => r.k);
      this.resSel = { cid, K, at: now, keys };
    }
    const keep = new Set(this.resSel.keys);
    return list.filter(r => keep.has(r.k));
  }
  resDrawer(open) {
    open = open ?? !this.resOpen;
    if (!!this.resOpen === open) return;
    this.resOpen = open;
    this.$('top').classList.toggle('open', open);
    this.hud();
  }
  renderDrawer(c, cr, ri) {
    const el = this.$('resdrawer'), S = this.S, cap = cr.cap || 0;
    el.classList.toggle('show', !!this.resOpen);
    if (!this.resOpen) { el.dataset.h = ''; return; }
    const bar = this.$('resbar'), r1 = this.$('top').querySelector('.r1'), anchor = bar.offsetHeight ? bar : r1;
    el.style.top = (anchor.offsetTop + anchor.offsetHeight + 5) + 'px';
    const nS = ri.filter(r => r.short && r.k !== 'food').length, nF = ri.filter(r => r.full).length;
    let h = `<div class="rdh"><b>物资</b><small>${esc(c.name)} · 每种上限 ${fmt(cap)}${nS ? ` · <span style="color:#ffb7a3">${nS} 种在缺</span>` : ''}${nF ? ` · <span style="color:var(--warn)">${nF} 种满了</span>` : ''}</small><span class="rdo" data-d="stock">总览 ›</span><span class="rdx" data-d="x">✕</span></div>`;
    let t = 0;
    for (const r of ri) {
      const tt = RES[r.k].t;
      if (tt !== t) { h += (t ? '</div>' : '') + `<div class="rdt">${TIER_NAMES[tt]}</div><div class="rdg">`; t = tt; }
      const nc = r.net < -0.05 ? 'neg' : r.net > 0.05 ? 'pos' : '';
      h += `<div class="rdc ${r.short ? 'short' : r.full ? 'full' : ''}" data-d="stock" style="--f:${(r.fr * 100).toFixed(1)}%" title="${RES[r.k].n}：产 ${fmt(r.f.p)} · 用 ${fmt(r.f.c)} / 分钟"><span class="rdi">${RICON[r.k]}</span><span class="rdn"><span>${RES[r.k].n}</span>${r.short ? '<em class="rdtag">缺</em>' : r.full ? '<em class="rdtag">满</em>' : ''}</span><span class="rdv"><b>${fmt(r.have)}</b><small class="${nc}">${r.act ? (r.net >= 0 ? '+' : '') + fmt(r.net) : '—'}</small></span><i></i></div>`;
    }
    if (t) h += '</div>';
    h += `<div class="rdf">数字右边是每分钟的净变化。红框是缺料，黄框是满仓。点任意一格打开物资总览，看卡在哪一环。</div>`;
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = iconize(h); }
  }
  hud() {
    const S = this.S, c = this.camp(), cr = Sim.rt(S).c[c.id] || {};
    this.watchStock(c, cr);
    this.watchLevels();
    const fuelMin = cr.burnPerMin ? cr.fuelUnits / cr.burnPerMin : 0;
    const w = Sim.weatherAt(S, S.t);
    let weather = '';
    const odTag = cr.stall ? '<em class="odt cool">停炉</em>' : cr.od ? '<em class="odt">超载</em>' : '';
    if (w.blizzard) weather = `<span class="pill wx bad" title="点开看备战情况和超载熔炉">❄<span class="lg"> 暴风雪中</span> ${fmtTime(w.until - S.t)}${odTag}</span>`;
    else if (w.warn) weather = `<span class="pill wx warn" title="点开看备战情况和超载熔炉">❄<span class="lg"> 暴风雪</span> ${fmtTime(w.inSec)}<span class="lg"> 后</span>${odTag}</span>`;
    else if (w.next <= Sim.FORECAST) weather = `<span class="pill wx fc" title="气象预报：${fmtTime(w.next)} 后有暴风雪（点开看备战情况）">❄<small>${fmtTime(w.next)}</small>${odTag}</span>`;
    else if (odTag) weather = `<span class="pill wx" title="熔炉超载中（点开看炉温）">🔥${odTag}</span>`;
    // 冰风暴、极寒夜、冰湖开裂：进行中，或者比暴风雪先到的预报
    { const e = Sim.wxeAt(S, S.t);
      if (e.ev && (e.on || (e.inSec <= Sim.FORECAST && !w.blizzard && !w.warn && !(w.next <= Sim.FORECAST && w.next < e.inSec)))) {
        const E = Sim.WXE[e.ev.kind], prep = Sim.wxePrepped(S, c, e.ev), need = Sim.wxeMatters(S, c, e.ev) && !prep;
        const tip = `${E.n}：${E.d}${need ? `（还没「${E.prep}」，点开准备）` : prep ? '（已经准备好了）' : ''}`;
        weather += e.on ? `<span class="pill wx ev bad" title="${esc(tip)}">${E.ic}<span class="lg"> ${E.n}</span> ${fmtTime(e.left)}</span>`
          : `<span class="pill wx ev ${e.inSec <= Sim.WXE_WARN ? 'warn' : 'fc'} ${need ? 'need' : ''}" title="${esc(`气象预报：${fmtTime(e.inSec)} 后有${tip}`)}">${E.ic}<small>${fmtTime(e.inSec)}</small></span>`;
      } }
    for (const d of Sim.gangDemands(S)) weather += `<span class="pill gang ${d.st.dem.fight ? 'bad' : 'warn'}" data-gang="${d.g.id}" title="${esc(`「${Sim.gangName(d.g)}」${d.st.dem.fight ? '要打过来了' : '在索贡，点开答复'}`)}">🏴<span class="lg">${d.st.dem.fight ? ' 要打来了' : ' 索贡'}</span><small>${fmtTime(d.left)}</small></span>`;
    if (S.car) { const left = S.car.orders.filter(o => !o.done).length; if (left) weather += `<span class="pill car" title="雪橇商队在「${esc(Sim.getCamp(S, S.car.camp)?.name || '')}」外扎营，还有 ${left} 张订单（点开看）">🛷${left}<small>${fmtTime(S.car.until - S.t)}</small></span>`; }
    else {
      // 极光夜、冰雾：只是好看，开始时提一句
      const sky = Sim.skyAt(S, S.t), was = this.skyWas || (this.skyWas = { a: sky.aurora > 0.2, i: sky.icefog > 0.2 });
      if (sky.aurora > 0.3 && S.aurOpen == null) weather += `<span class="pill sky aur" title="极光夜：只是好看，不影响产出">🌌<small>极光</small></span>`;
      else if (sky.icefog > 0.3) weather += `<span class="pill sky ice" title="冰雾：远处看不太清，不影响产出">🌫️<small>冰雾</small></span>`;
      if (sky.icefog > 0.2 && !was.i) Sim.logMsg(S, '🌫️ 起冰雾了，空气里闪着细小的冰晶。远处看不太清，不影响干活。');
      was.a = sky.aurora > 0.2; was.i = sky.icefog > 0.2;
    }
    this.$('aurBtn').classList.toggle('on', S.aurOpen != null);
    this.$('menuBtn').classList.toggle('dot', !!(S.meta.book && S.meta.book.fresh && S.meta.book.fresh.length));
    if (S.aurOpen != null) weather += `<span class="pill core aurgo" title="极光夜：大家一起看一会儿，所有营地希望 +4、余烬 +1">🌌<small>一起看</small></span>`;
    const nr = Sim.nextRaid(S);
    let raid = '';
    if (nr && nr.in <= Sim.RAID_PREP) {
      const rc = Sim.getCamp(S, nr.camp), p = Sim.raidPrep(S, nr);
      const str = Sim.raidStrength(S, rc, nr), def = Sim.raidDefense(S, rc, nr);
      const tags = p ? [p.fire && '🔥', p.mil && '⚔', p.hide && '📦'].filter(Boolean).join('') : '';
      raid = `<span class="pill raid ${def >= str ? 'warn' : 'bad'}" title="点开备战：火墙、民兵、收拢物资">🐺 ${fmtTime(nr.in)}<span class="lg"> 后袭击${S.camps.length > 1 ? '「' + esc(rc.name) + '」' : ''} 防御${def}/强度${str}</span>${tags ? `<em class="odt">${tags}</em>` : ''}</span>`;
    }
    const bl = Sim.activeBuffs(S, c);
    const buffs = bl.length ? `<span class="pill buff ${bl.some(b => b.v < 0 && b.k !== 'fuel' || b.k === 'fuel' && b.v > 0) ? 'warn' : ''}" title="${bl.map(b => `${esc(b.n || '')}：${BUFF_TXT(b)}，还剩 ${fmtTime(b.until - S.t)}`).join('\n')}">✨${bl.length > 1 ? bl.length : ''}<small>${fmtTime(Math.min(...bl.map(b => b.until)) - S.t)}</small></span>` : '';
    const dc = dayCycle(S.t), nextName = { 白天: '黄昏', 黄昏: '入夜', 夜晚: '黎明', 黎明: '天亮' }[dc.name];
    const tod = `<span class="pill tod" title="${dc.name}：${fmtTime(dc.left)} 后${nextName}（昼夜只改变光线，不影响产出）">${dc.icon}<small>${fmtTime(dc.left)}</small></span>`;
    const hp = Math.round(c.hope ?? 50), dc2 = Math.round(c.disc ?? 10), mt = cr.mood || { hT: hp, dT: dc2 };
    const arr = (v, t) => t > v + 1 ? '▲' : t < v - 1 ? '▼' : '';
    const moodPill = `<span class="pill mood ${dc2 >= 70 ? 'bad' : hp <= 25 || dc2 >= 55 ? 'warn' : ''}" title="希望 ${hp}${arr(hp, mt.hT)} · 不满 ${dc2}${arr(dc2, mt.dT)}（点开看人心和律令）"><span class="mh"><em>望</em><i><i style="width:${hp}%"></i></i><b>${hp}<small>${arr(hp, mt.hT)}</small></b></span><span class="md"><em>怨</em><i><i style="width:${dc2}%"></i></i><b>${dc2}<small>${arr(dc2, mt.dT)}</small></b></span></span>`;
    const temp = Math.round(cr.tH ?? c.temp);
    const foodNet = cr.foodNet || 0;

    this.$('campName').textContent = c.name + (S.camps.length > 1 ? ' ▾' : '');
    // 手机上只留一行：温度、人口、熟食、燃料 + 要紧的警告；其余点 ▾ 展开
    const fuelShort = fuelMin > 6000 ? '充足' : fuelMin >= 60 ? `${Math.floor(fuelMin / 60)}时` : `${Math.floor(fuelMin)}分`;
    const urgent = h => h.replace(/class="pill ([^"]*)"/g, (m, cl) => /\b(bad|warn)\b/.test(cl) ? `class="pill core ${cl}"` : m);
    this.$('stats').innerHTML = iconize(`
      <span class="pill core gauge ${temp < 0 ? 'bad' : temp < 10 ? 'cold' : 'warm'}" style="--g:${Math.max(0.04, Math.min(1, (temp + 30) / 90)).toFixed(2)}" title="住在屋里的体感温度"><i></i><b>${temp}°</b></span>
      <span class="pill core${c.wait > 0 ? ' wait' : ''}" title="人口 / 床位${c.wait > 0 ? ` · ${c.wait} 人在等床位` : ''}">👥${c.people}${c.bots ? '+' + c.bots + '🤖' : ''}<small class="lg">/${cr.housing || 0}</small>${c.wait > 0 ? `<small class="wt">+${c.wait}</small>` : ''}</span>
      <span class="pill core ${foodNet < 0 ? 'bad' : ''}" title="熟食库存 · 每分钟净变化">🍖<span data-rk="food">${fmt(this.rolled('food', c.stock.food))}</span> <small>${foodNet >= 0 ? '+' : ''}${fmt(foodNet)}</small></span>
      <span class="pill core ${fuelMin < 30 ? 'bad' : ''}" title="燃料还能烧多久">🔥<span class="lg">${fuelMin > 6000 ? '充足' : fmtTime(fuelMin * 60)}</span><span class="sh">${fuelShort}</span><span class="fb"><i style="--f:${Math.min(1, fuelMin / 240).toFixed(2)}"></i></span></span>
      ${urgent(moodPill)}${tod}${buffs}${urgent(weather)}${urgent(raid)}<span class="pill core more" title="展开更多">${this.resOpen ? '▴' : '▾'}</span>`);
    // 资源条：只常驻几种（缺的、满的、眼下这一层在用的），其余收进「全部」抽屉
    const keys = RES_KEYS.filter(k => (c.stock[k] || 0) >= 1 || (RES[k].t <= S.known && RES[k].t <= 1 && k !== 'food'));
    const cap = cr.cap || 0;
    const fl = cr.flow || {}, rkeys = RES_KEYS.filter(k => RES[k].t <= S.known && ((c.stock[k] || 0) >= 1 || RES[k].t <= 1 || (fl[k] && (fl[k].p > 0.01 || fl[k].want > 0.01))));
    const ri = this.resInfo(c, cr, rkeys), alerts = ri.filter(r => r.k !== 'food' && (r.short || r.full));
    const sel = this.resPick(ri, c.id);
    const chips = sel.map(r => `<span data-k="${r.k}" class="res ${r.short ? 'short' : r.full ? 'full' : ''}" style="--f:${r.fr.toFixed(2)}" title="${RES[r.k].n} ${fmt(r.have)}/${fmt(cap)} · 每分钟 ${r.net >= 0 ? '+' : ''}${fmt(r.net)}${r.short ? '（缺）' : r.full ? '（满了）' : ''}">${RICON[r.k]}<b data-rk="${r.k}">${fmt(this.rolled(r.k, r.have))}</b></span>`).join('');
    const rc = this.$('reschips'); if (rc.dataset.h !== chips) { rc.dataset.h = chips; rc.innerHTML = iconize(chips); }
    const ab = this.$('resAll'), aCls = alerts.some(r => r.short) ? 'ra rab' : alerts.length ? 'ra' : '';
    const aHtml = `全部<b>${ri.length}</b><i>▾</i>`;
    if (ab.dataset.h !== aHtml) { ab.dataset.h = aHtml; ab.innerHTML = aHtml; }
    ab.className = (this.resOpen ? 'open ' : '') + aCls;
    ab.title = alerts.length ? `${alerts.filter(r => r.short).map(r => RES[r.k].n + '缺').concat(alerts.filter(r => r.full).map(r => RES[r.k].n + '满了')).join('，')}（点开看全部物资）` : '展开全部物资';
    const mo = this.$('stats').querySelector('.pill.more'); if (mo && aCls) mo.className += ' ' + aCls;
    this.renderDrawer(c, cr, ri);
    this.logBadge();
    this.syncInset();
    // 有建筑在产的物资快满了：提醒一次（同一种物资 10 分钟内不重复）
    if (!c.trade && cap && performance.now() - (this.fullWarnAt || -1e9) > 120000) {
      const now = performance.now(), fw = this.fullWarn || (this.fullWarn = {});
      for (const k of keys) {
        const f = (cr.flow || {})[k];
        if (!f || f.p - f.c <= 0.05 || (c.stock[k] || 0) < cap * 0.9 || !S.buildings.some(b => b.camp === c.id && BLD[b.type].out && BLD[b.type].out[k])) continue;
        const key = c.id + k;
        if (fw[key] && now - fw[key] < 600000) continue;
        fw[key] = now; this.fullWarnAt = now;
        this.toast(`${RICON[k]}${RES[k].n}快满了（上限 ${fmt(cap)}），满了相关建筑会停工。可以升级仓库，或开启「满仓自动兑换」。`, 'warn', { act: 'tb', arg: 'stock', label: '去处理' });
        break;
      }
    }
    const goal = nextGoal(S), chs = Sim.chapters(S), cur = chs[chs.length - 1], gift = chs.some(c => c.done && !c.got);
    const ge = this.$('goal'), gk = goal + '|' + (cur ? cur.i + ':' + cur.tasks.filter(t => t.ok).length : '') + '|' + gift;
    if (ge.dataset.t !== gk) {
      ge.dataset.t = gk; ge.dataset.act = 'chapter';
      ge.innerHTML = iconize(cur ? `<b>${cur.ch.n.split(' · ')[0]}</b>${goal ? esc(goal) : esc(cur.ch.n.split(' · ')[1])}${gift ? '<i class="gift">🎁 领奖励</i>' : `<i class="gprog">${cur.tasks.filter(t => t.ok).length}/3</i>`}<i class="gplan" data-act="plan">规划</i>` : goal ? `<b>目标</b>${esc(goal)}<i class="gplan" data-act="plan">规划</i>` : '');
      ge.classList.toggle('gift', gift);
      ge.style.display = ge.innerHTML ? '' : 'none';
    }
    // 老向导：一次只说一句；新手引导还没走完时先不出来
    if (!this.advT || performance.now() - this.advT > 1500) {
      this.advT = performance.now();
      const ae = this.$('advisor'), a = S.meta.tut ? Sim.advisor(S) : null, ak = a ? a.text : '';
      if (ae.dataset.t !== ak) {
        ae.dataset.t = ak; this.adv = a;
        ae.innerHTML = a ? `<span class="advf">老</span><span class="advt">${esc(a.text)}</span>` : '';
        ae.className = a ? `pri${a.pri}` : '';
        ae.style.display = a ? '' : 'none';
        if (a) { ae.classList.remove('pop'); void ae.offsetWidth; ae.classList.add('pop'); }
      }
    }
    // 提示条贴在顶栏下面：顶栏尺寸变了才量（每次重画顶栏后马上量，会逼浏览器重新排版）
    if (!this.topRO && window.ResizeObserver) { const top = this.$('top'); this.topRO = new ResizeObserver(() => { this.$('toasts').style.top = (top.getBoundingClientRect().bottom + 6) + 'px'; }); this.topRO.observe(top); }
    else if (!this.topRO) this.$('toasts').style.top = (this.$('top').getBoundingClientRect().bottom + 6) + 'px';
    // 北迁按钮提示
    { const T = S.tech, ct = T && T.cur && TECHS.find(t => t.id === T.cur), tb = this.$('tbResearch');
      tb.style.setProperty('--p', ct ? Math.min(1, T.prog / ct.pts).toFixed(3) : 0); tb.classList.toggle('busy', !!ct);
      tb.classList.toggle('dot', !ct && S.buildings.some(b => b.type === 'workshop') && TECHS.some(t => Sim.techCheck(S, t.id).ok)); }
    this.$('tbMigrate').classList.toggle('dot', S.meta.embers > 0 && Object.keys(EMBER_UPS).some(k => S.meta.embers >= emberCost(k, Sim.up(S, k))));
    this.$('tbBuild').classList.toggle('dot', this.newBld().length > 0);
    this.$('tbSpecs').classList.toggle('dot', Object.keys(S.meta.specs).some(id => !S.specAt[id]));
    this.$('tbScout').classList.toggle('dot', Object.keys(S.poiFound).length > 0 || !!Sim.expPending(S));
  }

  // 建筑头顶的状态图标
  mkTalk() { const l = document.createElement('div'); l.id = 'talkl'; const e = document.createElement('div'); e.style.display = 'none'; l.appendChild(e); document.body.appendChild(l); return (this.talkEl = e); }
  badges() {
    const S = this.S, R = Sim.rt(S), v = this.g.view;
    let html = '';
    const cx = v.cam.tx, cy = v.cam.ty, near = 12 + v.cam.dist * 0.7, close = v.cam.dist < 26;
    const W0 = window.innerWidth, H0 = window.innerHeight, mx = W0 * (document.body.classList.contains('sheet-open') && W0 > 700 ? 0.36 : 0.5), my = H0 * 0.5;
    // 头顶提示：严重的（缺料、没人、采空）一直显示小图标；轻的只在拉近时显示；仓库满了不再逐栋显示，合并到营地牌子上
    const list = [], full = new Map();
    for (const b of S.buildings) {
      const br = R.b[b.id]; if (!br || !br.status || br.status === '运转中') continue;
      if (br.status === '仓库满了') { full.set(b.camp, (full.get(b.camp) || 0) + 1); continue; }
      const s = BLD[b.type].size;
      if (Math.abs(b.x + s / 2 - cx) > near || Math.abs(b.y + s / 2 - cy) > near) continue;
      const bad = STATUS_BAD(br.status);
      if (!bad && v.cam.dist >= 20) continue;
      const p = v.project(b.x + s / 2, b.y + s / 2, 2.0);
      if (!p.on) continue;
      list.push({ b, st: br.status, bad, p, d: Math.hypot(p.x - mx, p.y - my) });
    }
    list.sort((a, b) => a.d - b.d);
    list.slice(0, 50).forEach((it, k) => {
      const txt = close && k < 4 && it.d < 260 ? esc(it.st) : '';
      html += `<div class="badge ${it.bad ? 'bad' : ''} ${txt ? '' : 'only'}" data-bid="${it.b.id}" title="${esc(BLD[it.b.type].n)}：${esc(it.st)}" style="transform:translate(${it.p.x | 0}px,${it.p.y | 0}px)"><i>${STATUS_ICON(it.st)}</i>${txt}</div>`;
    });
    this.fullByCamp = full;
    // 产线星级：拉近时挂在建筑头上
    if (close) {
      let n = 0;
      for (const b of S.buildings) {
        if (n >= 40) break;
        const st = BLD[b.type].out ? Sim.bStar(S, b) : 0; if (!st) continue;
        const s = BLD[b.type].size; if (Math.abs(b.x + s / 2 - cx) > near || Math.abs(b.y + s / 2 - cy) > near) continue;
        const p = v.project(b.x + s / 2, b.y + s / 2, 2.6); if (!p.on) continue;
        html += `<div class="startag s${st}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${'★'.repeat(st)}</div>`; n++;
      }
    }
    // 头顶说话：每隔几秒，镜头中间附近随机一个人说一句（饿了、冷了会抱怨）
    if (v.cam.dist < 30 && v.figInfo) {
      const now = performance.now();
      if (!this.talk || now > this.talk.until + 2500) {
        const cand = [];
        v.figInfo.forEach((f, i) => { if (f && (f.k === 'w' || f.k === 'f')) { const p = v.project(v.figPts[i * 2], v.figPts[i * 2 + 1], 0.9); if (p.on && Math.hypot(p.x - mx, p.y - my) < Math.min(W0, H0) * 0.32) cand.push([f, v.figPts[i * 2], v.figPts[i * 2 + 1]]); } });
        if (cand.length) {
          const [f, x, y] = cand[Math.floor(Math.random() * cand.length)], p = personOf(f);
          const ps = personState(S, f, p, R, { feast: Sim.activeBuffs(S, Sim.getCamp(S, f.camp) || this.camp()).some(b => b.k === 'prod' && b.v > 0), night: v.nf > 0.5, aurora: v.aur > 0.4, icefog: v.ice > 0.4 });
          this.talk = { x, y, text: ps.quote, name: p.name, until: now + 4200, sad: ps.mood === '很低落' || ps.hungry || ps.sick };
        } else this.talk = { until: now };
      }
    }
    // 说话气泡单独一层：标签层每 0.05 秒整层重画，气泡放在里面的话淡入动画会被不停重播
    { const T = this.talk, te = this.talkEl || this.mkTalk(), now = performance.now();
      const p = T && T.text && now < T.until && v.cam.dist < 30 ? v.project(T.x, T.y, 0.95) : null;
      if (p && p.on && !this.g.titleOn) {
        const key = T.name + '|' + T.until;
        if (te.dataset.k !== key) { te.dataset.k = key; te.innerHTML = `<div class="talk ${T.sad ? 'sad' : ''}"><small>${esc(T.name)}</small>${esc(T.text)}</div>`; }
        te.style.transform = `translate(${p.x | 0}px,${p.y | 0}px)`; te.style.display = '';
      } else if (te.style.display !== 'none') { te.style.display = 'none'; te.dataset.k = ''; }
    }
    // 排队等材料的蓝图：拉近时显示还缺什么
    for (const q of S.queue || []) {
      const s = BLD[q.type].size; if (Math.abs(q.x + s / 2 - cx) > near || Math.abs(q.y + s / 2 - cy) > near) continue;
      const p = v.project(q.x + s / 2, q.y + s / 2, 1.2); if (!p.on) continue;
      const c = Sim.getCamp(S, q.camp); if (!c) continue;
      const cost = Sim.queueCost(S, q), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
      html += `<div class="qtag" data-q="${q.id}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">⏳${close && miss.length ? ' 缺' + miss.slice(0, 2).map(k => RICON[k] + fmt(cost[k] - (c.stock[k] || 0))).join(' ') : ''}</div>`;
    }
    // 商队营地：订单数和剩余时间
    if (S.car && Math.abs(S.car.x + 1.5 - cx) <= near && Math.abs(S.car.y + 1.5 - cy) <= near) {
      const p = v.project(S.car.x + 1.5, S.car.y + 1.5, 2.3), left = S.car.orders.filter(o => !o.done).length;
      if (p.on) html += `<div class="cartag ${left ? '' : 'done'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">🛷 商队${left ? `<b>${left}</b>张订单` : ' 货已交齐'}${close ? `<small>${fmtTime(S.car.until - S.t)}</small>` : ''}</div>`;
    }
    // 提委托的人：头上一个「！」，做到了变成「✓」
    for (const q of v.reqPts || []) {
      if (Math.abs(q.x - cx) > near || Math.abs(q.y - cy) > near) continue;
      const p = v.project(q.x, q.y, 0.95); if (!p.on) continue;
      const r = (S.reqs || []).find(x => x.id === q.id); if (!r) continue;
      const done = Sim.reqProgress(S, r).done;
      html += `<div class="reqtag ${done ? 'done' : ''}" data-req="${r.id}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${done ? '✓' : '!'}${close ? `<small>${esc(this.reqWho(r).name)}</small>` : ''}</div>`;
    }
    // 在线小惊喜：走失的驯鹿、流星坑（极光夜的「一起看」在顶栏）
    if (S.sur && Math.abs(S.sur.x - cx) <= near && Math.abs(S.sur.y - cy) <= near && !(S.sur.kind === 'meteor' && v.meteorFx)) {
      const u = S.sur, p = v.project(u.x + 0.5, u.y + 0.5, u.kind === 'deer' ? 1.7 : 1.1);
      if (p.on) html += `<div class="surtag ${u.kind}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${u.kind === 'deer' ? '🦌 走失的驯鹿' : '☄ 流星坑'}${close ? `<small>点一下${u.kind === 'deer' ? '领回来' : '挖开'} · ${fmtTime(u.until - S.t)}</small>` : ''}</div>`;
    }
    // 营地名
    for (const c of S.camps) {
      const p = v.project(c.x, c.y, 3.8 + 0.08 * Math.min(25, Sim.getB(S, c.furnace).lvl));
      const nf = full.get(c.id) || 0;
      const F = Sim.focusOf(c);
      const role = c.depot ? '<em class="ctrole dep">补给站</em>' : S.camps.length > 1 && Sim.isMain(S, c) ? '<em class="ctrole">主营地</em>' : '';
      if (p.on) html += `<div class="camptag" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${role}${F ? `<i class="fch xs" style="background:${F.col}" title="${F.n}营地">${F.ch}</i>` : ''}${esc(c.name)} <small>${Sim.getB(S, c.furnace).lvl}级</small>${nf ? `<b class="ctfull" data-camp="${c.id}" title="${nf} 栋建筑因为仓库满了停工">📦满 ${nf}</b>` : ''}</div>`;
    }
    // 发现的幸存者、地标
    const w = getWorld(S.runSeed);
    for (const p0 of w.sites || []) {
      if (!S.reveal[idx(p0.x, p0.y)] || Math.abs(p0.y - v.cam.ty) > 40) continue;
      const st = Sim.siteState(S, p0);
      if (st === 'done') continue;
      const p = v.project(p0.x + 0.5, p0.y + 0.5, 1.9);
      if (!p.on) continue;
      const K = SITES[p0.kind];
      html += `<div class="sitetag ${st}" data-site="${p0.id}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${st === 'wait' ? '❗ 探险队等你决定' : st === 'going' ? `🧭 ${K.n} · 探险队在路上` : st === 'back' ? `🧭 ${K.n} · 返程中` : `${K.ic} ${K.n}`}</div>`;
    }
    for (const id in S.poiFound) {
      const p0 = w.pois.find(p => p.id === +id); if (!p0) continue;
      const p = v.project(p0.x + 0.5, p0.y + 0.5, 1.6);
      if (p.on) html += `<div class="poitag" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">🆘 ${p0.n}人</div>`;
    }
    for (const i of S.discovered) {
      if (i === 0) continue;
      const l = LANDMARKS[i];
      // 营地就扎在地标旁边时，营地名已经是地标名了，不再重复挂一块牌子
      if (S.camps.some(c => Math.abs(c.x - l.x) + Math.abs(c.y - l.row) < 9)) continue;
      const p = v.project(l.x + 0.5, l.row + 0.5, i === 6 ? 9 : 3.5);
      if (p.on) html += `<div class="lmtag ${S.founded.includes(i) ? 'done' : ''}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${S.founded.includes(i) ? '🏁' : '📍'} ${l.n}</div>`;
    }
    // 远方地标：发现了挂牌子，点亮了换成遗物图标
    const wf = getWorld(S.runSeed).far || [];
    for (const i of (S.far && S.far.seen) || []) {
      const fp = wf[i]; if (!fp || S.camps.some(c => Math.abs(c.x - fp.x) + Math.abs(c.y - fp.y) < 9)) continue;
      const p = v.project(fp.x + 0.5, fp.y + 0.5, 5); const lit = Sim.farState(S, i) === 'lit';
      if (p.on) html += `<div class="lmtag far ${lit ? 'done' : ''}" data-far="${i}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${lit ? '✨' : '📍'} ${FAR_MARKS[i].n}</div>`;
    }
    if (this.g.scoutTarget) {
      const t = this.g.scoutTarget;
      const p = v.project(t.x + 0.5, t.y + 0.5, 0.5);
      if (p.on) html += `<div class="poitag target" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">🚩 目标</div>`;
    }
    if (this.g.place && this.g.place.type === 'bp') {
      const P = this.g.place, pl = P.bpPlan;
      const p = v.project(P.x + P.bp.w / 2, P.y + P.bp.h / 2, 3);
      if (pl && p.on) html += `<div class="ghosttag ${pl.ok ? 'ok' : pl.q ? 'soft' : 'bad'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${esc(RES[P.bp.r].n)}线 ${P.bp.items.length} 栋<br>${[pl.ok && `✓ 马上建 ${pl.ok}`, pl.q && `排队 ${pl.q}`, pl.bad && `${pl.bad} 处放不下`].filter(Boolean).join(' · ')}</div>`;
    } else if (this.g.place && this.g.place.plan) {
      // 拖出来的一排：标签放在这一排中间，写合计
      const P = this.g.place, pl = P.plan, s = BLD[P.type].size, L = pl.plan, m = L[L.length - 1];
      const p = v.project((P.x + m.x) / 2 + s / 2, (P.y + m.y) / 2 + s / 2, 2.6);
      const t = `一排 ${L.length} 栋<br>${[pl.ok && `✓ 马上建 ${pl.ok}`, pl.q && `排队 ${pl.q}`, pl.bad && `${pl.bad} 处不能建`].filter(Boolean).join(' · ')}`;
      if (p.on) html += `<div class="ghosttag ${pl.ok ? 'ok' : pl.q ? 'soft' : 'bad'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${t}</div>`;
    } else if (this.g.place && this.g.place.check) {
      const P = this.g.place, ck = P.check, s = BLD[P.type].size;
      const p = v.project(P.x + s / 2, P.y + s / 2, 2.6);
      let t = ck.ok ? (ck.clears ? `✓ 可以建（清掉 ${ck.clears} 处树木/碎石）` : '✓ 可以建') : esc(ck.reason);
      if (ck.camp >= 0 && P.type !== 'furnace') {
        t += `<br>到仓库 ${ck.dist.toFixed(1)} 格`;
        if (BLD[P.type].gather) t += ` · 资源点 ${ck.spots}`;
        if (ck.syn) t += ` · 联动 +${Math.round(ck.syn * Sim.SYN_PER * 100)}%`;
      }
      if (p.on) html += `<div class="ghosttag ${ck.ok ? 'ok' : ck.soft ? 'soft' : 'bad'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${t}</div>`;
    }
    if (html !== this.labelsHtml) { this.labelsHtml = html; this.labels.innerHTML = iconize(html); } // 镜头没动时内容一样，不用重建（手机上每秒 20 次重建很费）
    this.tutorial();
  }

  // 点老向导：跳到他说的那件事
  advisorGo() {
    const a = this.adv, S = this.S, g = this.g; if (!a) return;
    g.cancelModes();
    const furnace = cid => { const c = Sim.getCamp(S, cid) || Sim.mainCamp(S), f = Sim.getB(S, c.furnace); S.active = c.id; g.view.focus(f.x + 1.5, f.y + 1.5); g.view.select(f.id); this.open('bld', f.id); };
    if (a.act === 'plan') { this.close(); g.chainmap.plan(a.arg); }
    else if (a.act === 'raid') this.open('raid');
    else if (a.act === 'scout') this.open('scout');
    else if (a.act === 'migrate' || a.act === 'arrive') this.open('migrate');
    else if (a.act === 'furnace' || a.kind === 'fuel' || a.kind === 'cold') furnace(a.camp);
    else if (a.kind === 'food') { if (a.camp) S.active = a.camp; this.open('stock'); }
    else this.open('chapter');
  }

  // ---------- 新手引导：前几步用光圈指着该点的地方 ----------
  tutorial() {
    const S = this.S, g = this.g;
    if (this.tutS !== S) { this.tutS = S; this.tutSeen = {}; if (!S.meta.tut && (S.meta.runs > 1 || S.buildings.length > 12)) S.meta.tut = true; }
    const box = this.coach || (this.coach = this.mkCoach());
    const hide = () => { box.wrap.style.display = 'none'; box.ring.style.display = 'none'; };
    if (S.meta.tut || this.g.titleOn || this.$('modal').classList.contains('show')) return hide();
    const c = this.camp();
    const steps = TUT.filter(t => !(t.b ? Sim.countType(S, c.id, t.b) > 0 : this.tutSeen[t.k]));
    if (!steps.length) { S.meta.tut = true; hide(); this.toast('新手引导完成。接下来跟着左上角的目标走，北方还有很长的路。', 'good'); return; }
    const st = steps[0], i = TUT.indexOf(st) + 1, touch = matchMedia('(pointer:coarse)').matches;
    let el = null, pt = null, msg = '';
    if (st.b) {
      const P = g.place;
      if (P && P.type === st.b) {
        const s = BLD[st.b].size; pt = g.view.project(P.x + s / 2, P.y + s / 2, 0.6);
        msg = touch ? '点一下地面把预览挪过去，再点一次同一处（或按 ✓）就建好了。绿色框表示能建。' : '在地面上点一下就建好了。绿色框表示能建，红色表示不行。';
      } else if (P) { el = this.$('placeNo'); msg = '先取消正在摆放的建筑。'; }
      else if (this.panel && this.panel.kind === 'build') {
        if (this.buildTier !== 1) { el = this.sheet.querySelector('.tab[data-arg="1"]'); msg = '切回「篝火」这一层。'; }
        else { el = this.sheet.querySelector(`.card[data-arg="${st.b}"]`); msg = `选「${BLD[st.b].n}」。`; if (el && this.tutScroll !== st.b) { this.tutScroll = st.b; el.scrollIntoView({ block: 'nearest' }); } }
      } else { el = document.querySelector('#toolbar button[data-arg=build]'); msg = '点「建造」。'; }
      msg = `<b>建${BLD[st.b].n}</b>${st.why}<br>👉 ${msg}`;
    } else if (st.k === 'stock') {
      const phone = !this.$('resbar').offsetHeight;
      if (this.resOpen) { el = this.$('resdrawer').querySelector('.rdo'); msg = `<b>看物资</b>${st.why}<br>👉 点「总览」。`; }
      else if (phone) { el = this.$('stats').querySelector('.pill.more'); msg = `<b>看物资</b>${st.why}<br>👉 点右上角的 ▾ 展开物资。`; }
      else { el = this.$('reschips'); msg = `<b>看物资</b>${st.why}<br>👉 点顶部的物资栏。`; }
    }
    else {
      const f = Sim.getB(S, c.furnace);
      if (this.panel && this.panel.kind === 'bld') { el = this.sheet.querySelector('[data-act=upgrade]'); msg = '👉 材料够了就点「升级」。'; }
      else { pt = g.view.project(f.x + 1.5, f.y + 1.5, 2.2); msg = '👉 点一下熔炉。'; }
      msg = `<b>看看熔炉</b>${st.why}<br>${msg}`;
    }
    box.wrap.style.display = '';
    const html = `<div class="cstep">新手引导 ${i}/${TUT.length}</div><div class="cmsg">${msg}</div><button class="small ghost" data-act="tutskip">跳过引导</button>`;
    if (html !== box.last) { box.last = html; box.wrap.innerHTML = iconize(html); }
    box.wrap.classList.toggle('top', document.body.classList.contains('sheet-open') && innerWidth < 760 || document.body.classList.contains('placing') && innerWidth < 760);
    let r = null;
    if (el) { const b = el.getBoundingClientRect(); if (b.width && b.bottom > 0 && b.top < innerHeight) r = { x: b.left - 5, y: b.top - 5, w: b.width + 10, h: b.height + 10 }; }
    else if (pt && pt.on) r = { x: pt.x - 34, y: pt.y - 34, w: 68, h: 68, round: true };
    if (!r) { box.ring.style.display = 'none'; return; }
    Object.assign(box.ring.style, { display: '', transform: `translate(${r.x | 0}px,${r.y | 0}px)`, width: (r.w | 0) + 'px', height: (r.h | 0) + 'px', borderRadius: r.round ? '50%' : '8px' });
  }
  mkCoach() {
    const wrap = document.createElement('div'); wrap.id = 'coach';
    const ring = document.createElement('div'); ring.id = 'coachRing'; ring.innerHTML = '<i></i>';
    document.body.append(wrap, ring);
    return { wrap, ring, last: '' };
  }

  // ---------- 面板 ----------
  open(kind, arg) { if (this.resOpen) this.resDrawer(false); if (this.panel && this.panel.kind === 'build') this.markBuildSeen(); if (kind === 'build' && (!this.panel || this.panel.kind !== 'build')) { const nw = this.newBld(); if (nw.length) this.buildTier = Math.max(...nw.map(k => BLD[k].t)); } if (kind === 'log') { this.logOpenSeen = this.logSeen; this.logSeen = this.S.log[this.S.log.length - 1] || null; } if (this.tutSeen) { if (kind === 'stock') this.tutSeen.stock = true; if (kind === 'bld' && Sim.getB(this.S, arg)?.type === 'furnace') this.tutSeen.furnace = true; } this.panel = { kind, arg }; this.lastHtml = ''; this.renderPanel(true); clearTimeout(this.outT); if (this.sheet.classList.contains('out')) this.sheet.classList.remove('out', 'show'); void this.sheet.offsetWidth; this.sheet.classList.add('show'); document.body.classList.add('sheet-open'); this.sheet.scrollTop = 0;
    if (kind === 'build') { const on = this.sheet.querySelector('.tabs .tab.on'), tb = on && on.parentElement; if (tb) tb.scrollLeft = Math.max(0, on.offsetLeft - tb.offsetLeft - (tb.clientWidth - on.offsetWidth) / 2); }
    this.syncInset();
    const b = kind === 'bld' ? Sim.getB(this.S, arg) : null;
    if (b) { const s = BLD[b.type].size; this.keepVisible(b.x + s / 2, b.y + s / 2); }
    else if (kind === 'site') { const st = getWorld(this.S.runSeed).sites.find(x => x.id === arg); if (st) this.keepVisible(st.x + 0.5, st.y + 0.5); }
  }
  close() {
    if (this.panel && this.panel.kind === 'build') this.markBuildSeen();
    const was = this.panel; this.panel = null; this.g.view.select(null);
    document.body.classList.remove('sheet-open');
    // 收起时滑出去再藏（期间又打开别的面板就作罢）
    if (was && this.sheet.classList.contains('show')) { this.sheet.classList.add('out'); clearTimeout(this.outT); this.outT = setTimeout(() => { if (!this.panel) this.sheet.classList.remove('show'); this.sheet.classList.remove('out'); }, 160); }
    else this.sheet.classList.remove('show');
    this.syncInset();
  }
  // 面板挡住的那块不算画面：PC 右侧面板把画面中心往左挪，手机底部面板把它往上挪
  pcSheet() { return matchMedia('(orientation:landscape) and (min-width:761px)').matches; }
  syncInset() {
    const open = !!this.panel && this.sheet.classList.contains('show');
    let x = 0, y = 0;
    if (open) { if (this.pcSheet()) x = (this.sheet.offsetWidth + 20) / 2; else y = Math.max(0, Math.min(this.sheet.offsetHeight, innerHeight * 0.6) - 80) / 2; }
    this.g.view.setInset(x, y);
  }
  // 打开某个东西的面板时，它要是会被面板挡住，就把镜头移过去
  keepVisible(wx, wy) {
    const v = this.g.view, p = v.project(wx, wy, 0.6), c = v.inset || [0, 0], t = v.insetT || [0, 0];
    if (!p.on) { v.focus(wx, wy); return; }
    const nx = p.x - (t[0] - c[0]), ny = p.y - (t[1] - c[1]);
    if (this.pcSheet()) { if (nx > innerWidth - this.sheet.offsetWidth - 70 || nx < 40) v.focus(wx, wy); }
    else if (ny > innerHeight - this.sheet.offsetHeight - 50 || ny < 150) v.focus(wx, wy);
  }
  tabOf(kind, tabs) { const t = (this.tabs || (this.tabs = {}))[kind]; return tabs && !tabs.some(x => x[0] === t) ? tabs[0][0] : t; }
  renderPanel(force) {
    if (!this.panel) return;
    if (this.sheetDown && !force) return;
    if (!force && performance.now() - (this.sheetScrollT || 0) < 450) return;
    const f = this['p_' + this.panel.kind];
    if (!f) return;
    const tk = this.panel.kind, tabs = PANEL_TABS[tk];
    const tb = tabs ? `<div class="ptabs">${tabs.map(([k, n]) => `<button class="${this.tabOf(tk, tabs) === k ? 'on' : ''}" data-act="ptab" data-arg="${k}">${n}</button>`).join('')}</div>` : '';
    const html = `<div class="phead ${tb ? 'tabbed' : ''}"><b>${f.call(this, 'title')}</b><button class="x" data-act="close">✕</button>${tb}</div><div class="pbody">${f.call(this, 'body')}</div>`;
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    const st = this.sheet.scrollTop, sx = {};
    for (const e of this.sheet.querySelectorAll('[data-sx]')) sx[e.dataset.sx] = e.scrollLeft;
    this.sheet.innerHTML = iconize(html);
    this.sheet.scrollTop = st;
    for (const e of this.sheet.querySelectorAll('[data-sx]')) if (sx[e.dataset.sx]) e.scrollLeft = sx[e.dataset.sx];
  }

  // 建造面板里没看过的建筑（新解锁的纬度带）挂「新」；老存档第一次打开时把已解锁的都算看过
  seenB() {
    const S = this.S, m = S.meta;
    if (!m.seenB) { m.seenB = {}; for (const k of BLD_KEYS) if (BLD[k].t <= S.known) m.seenB[k] = 1; }
    return m.seenB;
  }
  newBld(t) { const S = this.S, seen = this.seenB(); return BLD_KEYS.filter(k => BLD[k].t <= S.known && (t == null || BLD[k].t === t) && !seen[k]); }
  markBuildSeen() { const seen = this.seenB(); for (const k of this.bNewShown || []) seen[k] = 1; this.bNewShown = null; }
  p_build(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '建造';
    let tabs = '<div class="tabs" data-sx="btabs">';
    for (let t = 1; t <= 7; t++) tabs += `<button class="tab ${t === this.buildTier ? 'on' : ''} ${t > S.known ? 'locked' : ''} ${t !== this.buildTier && this.newBld(t).length ? 'hasnew' : ''}" data-act="btier" data-arg="${t}">${t > S.known ? '🔒' : ''}${TIER_NAMES[t]}</button>`;
    tabs += '</div>';
    const list = BLD_KEYS.filter(k => BLD[k].t === this.buildTier && k !== 'furnace');
    if (this.buildTier === 1) list.push('furnace');
    const seen = this.seenB(), shown = [];
    let cards = '';
    for (const k of list) {
      const d = BLD[k];
      const locked = d.t > S.known;
      const cost = k === 'furnace' ? Sim.buildCost(S, k, c.id, Math.round(c.y + 20)) : Sim.buildCost(S, k, c.id, c.y);
      const n = Sim.countType(S, c.id, k);
      const fresh = !locked && !seen[k], short = !locked && !Sim.canAfford(c.stock, cost);
      if (fresh) shown.push(k);
      cards += `<div class="card ${locked ? 'locked' : ''} ${short ? 'short' : ''}" data-act="${locked ? '' : 'place'}" data-arg="${k}">
        <div class="ci pic">${this.ico(k, k === 'furnace' ? 2 : 1)}${fresh ? '<i class="cnew">新</i>' : ''}${n ? `<i class="chave">${n}</i>` : ''}</div>
        <div class="cb"><div class="cn">${k === 'furnace' ? '前哨熔炉<small class="cnx">（新营地）</small>' : d.n}${n ? ` <small class="chas">已有 ${n}</small>` : ''}</div>
        <div class="cd">${esc(d.desc)}</div>
        <div class="cc">${locked ? `需要侦察到「${TIER_NAMES[d.t]}」纬度` : costHtml(c.stock, cost)}${k === 'furnace' ? ' <small class="cnx">（越往北越贵）</small>' : ''}</div>
        ${d.out ? `<div class="cio">${d.in ? Object.keys(d.in).map(r => RICON[r] + d.in[r]).join(' ') + ' → ' : ''}${Object.keys(d.out).map(r => RICON[r] + d.out[r]).join(' ')}<small>/分 · ${d.w}人</small></div>` : ''}
        ${d.cat === 'deco' ? `<div class="cio">✨ 装饰 · 希望 +${d.hope}${d.w ? `<small> · ${d.w}人照看</small>` : ''}</div>` : ''}
        </div></div>`;
    }
    this.bNewShown = shown;
    const hint = this.buildTier > S.known ? `<div class="hint">往北派侦察队，看到「${TIER_NAMES[this.buildTier]}」所在的纬度后解锁。</div>` : '';
    return tabs + hint + `<div class="cards" data-sx="bcards">${cards}</div>`;
  }

  // 建造队列里的一栋：还缺什么、排第几
  // 超载熔炉：炉温条 + 开关（熔炉面板和暴风雪预报里都有）
  panelCamp() { const b = this.panel && this.panel.kind === 'bld' ? Sim.getB(this.S, this.panel.arg) : null; return b ? Sim.getCamp(this.S, b.camp) : this.camp(); }
  odBlock(c, cr, fb) {
    const ovh = Math.round(c.ovh || 0), cool = c.odCool > 0, act = !cool && (!!c.od || (c.odAuto !== false && !!c.odA)); // 用营地上的开关，点了马上变（暂停时也是）
    const boost = Math.round(Sim.odBoost(fb.lvl) * (1 + Sim.specOf(this.S, fb) * 0.5));
    const state = cool ? `<b class="bad">停炉降温 ${fmtTime(c.odCool)}</b>` : act ? `<b class="hot">正在超载 +${Math.round(cr.odHeat || boost)}°</b>` : ovh > 0 ? '炉温回落中' : '平稳';
    let h = `<div class="odbox ${act ? 'on' : ''} ${cool ? 'cool' : ''}"><div class="odh"><span>🔥 超载熔炉</span><span>${state}</span></div>`;
    h += `<div class="odg"><span>炉温</span><div class="bar ${ovh >= 85 ? 'red' : ovh >= 60 ? 'hot' : ''}"><i style="width:${ovh}%"></i><u style="left:85%"></u></div><b>${ovh}%</b></div>`;
    h += `<div class="odd">燃料烧两倍，供热再加 ${boost}°。炉温烧满会被迫停炉 ${Sim.OD_STALL / 60} 分钟，那时只剩三成热量。</div>`;
    h += `<div class="odbtn">${cool ? `<button class="btn" disabled>炉膛降温中</button>` : act && c.od ? `<button class="btn" data-act="od" data-arg="0">停止超载</button>` : act ? `<button class="btn" data-act="od" data-arg="0">先歇一歇</button>` : `<button class="btn go" data-act="od" data-arg="1">🔥 立即超载</button>`}`;
    h += `<button class="tgl ${c.odAuto !== false ? 'on' : ''}" data-act="odauto"><span class="ti">❄</span><span class="tt">暴风雪时自动超载<small>炉温到 85% 自动歇一歇</small></span><i class="sw"></i></button></div></div>`;
    return h;
  }
  // 暴风雪预报：什么时候来、多冷、燃料熟食撑不撑得住
  wxPlan(c, cr) {
    const S = this.S, w = Sim.weatherAt(S, S.t), sl = w.slot, on = !!w.blizzard;
    const inSec = on ? 0 : sl.start - S.t, dur = sl.end - (on ? S.t : sl.start), T = inSec + dur;
    const fb = Sim.getB(S, c.furnace), drop = Sim.slotDrop(S, c, sl);
    const boost = Sim.odBoost(fb.lvl) * (1 + Sim.specOf(S, fb) * 0.5);
    const base = (cr.tH ?? c.temp) + (cr.drop || 0) - (cr.odHeat || 0); // 屋里体感，去掉眼下的暴风雪和超载
    const auto = c.odAuto !== false;
    const share = dur <= 1530 ? 1 : (1530 + (dur - 1530) * 0.55) / dur; // 自动超载大约开着的比例
    const tB = base - drop, tOD = tB + boost * (auto || cr.od ? 1 : 0);
    // 燃料：熔炉以外的进出照旧，熔炉按正常烧法算，暴风雪里自动超载的部分多烧一倍
    const fl = cr.flow || {}, fu = cr.fuelUnits || 0, bb = cr.baseBurn || cr.burnPerMin || 0;
    let net = 0; for (const f in FUEL) { const x = fl[f]; if (x) net += (x.p - x.c) * FUEL[f]; }
    net += (cr.burnPerMin || 0) * (cr.fueled ?? 1);
    const fuelEnd = fu + (net - bb) * T / 60 - (auto ? bb * (Sim.OD_FUEL - 1) * share * dur / 60 : 0);
    const foodEnd = (c.stock.food || 0) + (cr.foodNet || 0) * T / 60;
    return { on, inSec, dur, drop, base, tB, tOD, auto, fuelEnd, fuelNeed: bb * T / 60, foodEnd, until: w.until };
  }
  // 冰风暴、极寒夜、冰湖开裂：说明、对这座营地的影响、提前准备
  wxeCard(c, cr) {
    const S = this.S, e = Sim.wxeAt(S, S.t);
    if (!e.ev || (!e.on && e.inSec > Sim.FORECAST)) return `<div class="row sub"><span></span><span>一小时内没有冰风暴、极寒夜或冰湖开裂的预报。</span></div>`;
    const ev = e.ev, E = Sim.WXE[ev.kind], prep = Sim.wxePrepped(S, c, ev), matters = Sim.wxeMatters(S, c, ev);
    let h = `<div class="wxhero ev ${e.on ? 'on' : e.inSec <= Sim.WXE_WARN ? 'near' : ''}"><div class="wxi">${E.ic}</div><div><b>${E.n}${e.on ? `中，还剩 ${fmtTime(e.left)}` : ` · 约 ${fmtTime(e.inSec)} 后`}</b><small>${e.on ? '' : `持续约 ${Math.round((ev.end - ev.start) / 60)} 分钟 · `}${esc(E.d)}</small></div></div>`;
    const fx = [];
    if (ev.kind === 'ice') {
      const hs = S.buildings.filter(b => b.camp === c.id && b.type === 'heater').length;
      fx.push(['户外采集', `伐木、采石、打猎、挖矿 −${Math.round((1 - Sim.WXE_ICE_GATHER) * 100)}%`]);
      fx.push(['暖炉 / 暖气管', !matters ? '这座营地没有，不受影响' : prep ? '✔ 裹好了保温毡，照常供热' : `<b class="bad">会冻住</b>：${hs ? `${hs} 座暖炉` : ''}${hs && c.pipe ? '和' : ''}${c.pipe ? `${c.pipe} 级暖气管` : ''}停止供热`]);
    } else if (ev.kind === 'cold') {
      fx.push(['熔炉', `多烧 ${Math.round((Sim.WXE_FUEL - 1) * 100)}% 燃料，眼下每分钟约 ${fmt((cr.baseBurn || cr.burnPerMin || 0) * (e.on ? 1 : Sim.WXE_FUEL))}`]);
      fx.push(['屋里', `${prep ? '✔ 门窗缝封好了，降温减半 · ' : ''}燃料够也会冷几度，烧不够冷得更多`]);
    } else {
      fx.push(['运输线 / 侦察队', `慢 ${Math.round((1 - Sim.WXE_SLOW) * 100)}%`]);
      fx.push(['营地搬运', !matters ? '附近没有冰湖，不受影响' : prep ? '✔ 铺好了木板便道，照常' : `<b class="bad">慢 ${Math.round((1 - Sim.WXE_CRACK) * 100)}%</b>（附近有冰湖，要绕路）`]);
    }
    for (const [a, b] of fx) h += `<div class="row"><span>${a}</span><span>${b}</span></div>`;
    if (matters && !prep) {
      const cost = Sim.wxePrepCost(S, c, ev), can = Sim.canAfford(c.stock, cost);
      h += `<div class="wxprep"><div><b>${E.prep}</b><small>${E.prepD}（只管这一场）</small></div><span class="wxpc">${costHtml(c.stock, cost)}</span><button class="btn ${can ? 'go' : ''}" data-act="wxprep" data-arg="${c.id}" ${can ? '' : 'disabled'}>准备</button></div>`;
    } else if (matters && prep) h += `<div class="row sub"><span></span><span>✔ 「${esc(c.name)}」已经${E.prep}。</span></div>`;
    return h;
  }
  p_weather(part) {
    const S = this.S, c = this.camp(), cr = Sim.rt(S).c[c.id] || {}, P = this.wxPlan(c, cr);
    if (part === 'title') return `${P.on ? '暴风雪中' : '天气预报'} <small>${esc(c.name)}</small>`;
    const e = Sim.wxeAt(S, S.t), evFirst = e.ev && (e.on || (!P.on && e.inSec < P.inSec && e.inSec <= Sim.FORECAST));
    const evh = `<div class="sec">${e.on ? '眼下的天气' : '其他天气'}</div>` + this.wxeCard(c, cr);
    return (evFirst ? evh + '<div class="sec">暴风雪</div>' : '') + this.p_weatherBliz(c, cr, P) + (evFirst ? '' : evh);
  }
  p_weatherBliz(c, cr, P) {
    const S = this.S;
    const fb = Sim.getB(S, c.furnace);
    const tc = t => t >= 2 ? 'ok' : t >= -8 ? 'warn' : 'bad';
    const big = P.on ? `暴风雪中，还剩 ${fmtTime(P.dur)}` : `约 ${fmtTime(P.inSec)} 后来袭`;
    let h = `<div class="wxhero ${P.on ? 'on' : P.inSec <= 600 ? 'near' : ''}"><div class="wxi">❄</div><div><b>${big}</b><small>${P.on ? '' : `持续约 ${Math.round(P.dur / 60)} 分钟 · `}气温骤降 ${Math.round(P.drop)}°</small></div></div>`;
    h += `<div class="sec">撑不撑得住</div>`;
    const tl = P.tOD !== P.tB ? `<b class="${tc(P.tB)}">${Math.round(P.tB)}°</b> → 超载后 <b class="${tc(P.tOD)}">${Math.round(P.tOD)}°</b>` : `<b class="${tc(P.tB)}">${Math.round(P.tB)}°</b>`;
    h += `<div class="row"><span>屋里体感</span><span>平时 ${Math.round(P.base)}° · 暴风雪时 ${tl}</span></div>`;
    const tv = Math.max(P.tOD, P.tB);
    h += `<div class="row sub"><span></span><span>${tv >= 2 ? '✔ 扛得住，没人会冻病' : tv >= -8 ? '⚠ 会有人冻病，病人不能干活' : '✖ 很危险，会冻病一大片，甚至冻死人'}</span></div>`;
    h += `<div class="row"><span>燃料</span><span>${P.fuelEnd >= 0 ? `<b class="ok">✔ 够</b> 雪停时还剩约 ${fmt(P.fuelEnd)}` : `<b class="bad">✖ 不够</b> 还差约 ${fmt(-P.fuelEnd)}`}</span></div>`;
    h += `<div class="row"><span>熟食</span><span>${P.foodEnd >= 0 ? `<b class="ok">✔ 够</b> 雪停时还剩约 ${fmt(P.foodEnd)}` : `<b class="bad">✖ 不够</b> 还差约 ${fmt(-P.foodEnd)}`}</span></div>`;
    const tips = [];
    if (tv < 2) {
      tips.push('升级帐篷：每级保温 +2°');
      if (BLD.heater.t <= S.known) tips.push('造暖炉：烧煤给周围加温');
      if (!P.auto && !cr.od) tips.push('打开下面的「暴风雪时自动超载」');
    }
    if (P.fuelEnd < 0) tips.push('多派人去伐木、挖煤，或者把优先烧的燃料换成热值高的');
    if (P.foodEnd < 0) tips.push('多派人去猎屋和厨房，先把熟食囤起来');
    if (tips.length) h += `<div class="wxtips">${tips.map(t => `<div>· ${t}</div>`).join('')}</div>`;
    h += this.odBlock(c, cr, fb);
    h += `<div class="row sub"><span></span><span>预报按眼下的产量估算，仅供参考。</span></div>`;
    return h;
  }
  p_far(part) {
    const S = this.S, i = this.panel.arg, f = FAR_MARKS[i], p = (getWorld(S.runSeed).far || [])[i];
    if (!f || !p) { this.close(); return ''; }
    const st = Sim.farState(S, i), own = !!(S.meta.relics && S.meta.relics[i]);
    if (part === 'title') return `${f.n} <small>永夜冰原 · 第 ${f.row} 行</small>`;
    let h = `<div class="farhero ${st}"><div class="cari">${st === 'lit' ? '✨' : '📍'}</div><div><b>${st === 'lit' ? '已经点亮' : st === 'seen' ? '已发现，还没点亮' : '还没发现'}</b><small>${esc(f.desc)}</small></div></div>`;
    h += `<div class="relic ${own ? 'own' : ''}"><div class="rli">🏺</div><div><b>遗物「${esc(f.relic.n)}」</b><span>${esc(f.relic.d)}</span><small>${own ? '✔ 已经带回，永久生效，北迁后也保留' : `在它旁边 ${14} 格内点起前哨熔炉就能带回，永久生效`}</small></div></div>`;
    if (st !== 'lit') {
      const near = S.camps.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.y - p.y)), 1e9);
      h += `<div class="row"><span>离最近的营地</span><span>${Math.round(near)} 格</span></div>`;
      h += `<div class="row sub"><span>那里的气温</span><span>${baseTempOfRow(p.y)}°（要熔炉等级够高才扛得住）</span></div>`;
    }
    h += `<button class="btn wide" data-act="farmap" data-arg="${i}">📍 在地图上看</button>`;
    // 全部远方地标的进度
    h += `<div class="sec">永夜冰原 · 远方地标</div><div class="farlist">${FAR_MARKS.map((x, k) => { const s2 = Sim.farState(S, k), o2 = !!(S.meta.relics && S.meta.relics[k]); return `<div class="fli ${s2} ${k === i ? 'cur' : ''}" ${s2 !== 'none' ? `data-act="far" data-arg="${k}"` : ''}><b>${s2 === 'none' ? '？？？' : esc(x.n)}</b><small>${s2 === 'none' ? `大约在第 ${x.row} 行` : o2 ? `🏺 ${esc(x.relic.d)}` : '还没带回遗物'}</small><i>${s2 === 'lit' ? '✨' : s2 === 'seen' ? '📍' : '·'}</i></div>`; }).join('')}</div>`;
    return h;
  }
  p_raid(part) {
    const S = this.S, nr = Sim.nextRaid(S);
    const on = nr && nr.in <= Sim.RAID_PREP;
    if (part === 'title') return on ? '袭击预警' : '营地防御';
    const auto = `<button class="tgl ${S.rAuto !== false ? 'on' : ''}" data-act="rauto" style="width:100%;margin-top:8px"><span class="ti">🛡</span><span class="tt">没顾上时自动备战<small>袭击前 5 分钟还守不住的话，守夜人自己点火墙、叫民兵</small></span><i class="sw"></i></button>`;
    if (!on) return `<div class="rdhero"><div class="cari">🛡</div><div><b>${nr ? `下一次袭击大约 ${fmtTime(nr.in)} 后` : '眼下没有袭击'}</b><small>侦察兵会提前 ${Sim.RAID_PREP / 60} 分钟发现袭击者，那时可以备战。</small></div></div>` + auto;
    const c = Sim.getCamp(S, nr.camp), p = Sim.raidPrep(S, nr) || {};
    const str = Sim.raidStrength(S, c, nr), d0 = Sim.campDefense(S, c), def = Sim.raidDefense(S, c, nr);
    const name = RAIDERS[tierOfRow(c.y)];
    let h = `<div class="rdhero ${def >= str ? '' : 'bad'}"><div class="cari">🐺</div><div><b>${name}约 ${fmtTime(nr.in)} 后袭击「${esc(c.name)}」</b><small>强度 ${str} · 防御 ${def}${def !== d0 ? `（箭塔和人手 ${d0}）` : ''}</small></div></div>`;
    const lose = Math.round(30 * Math.max(0, 1 - def / str) * (p.hide ? 0.5 : 1));
    h += `<div class="row"><span>结果预估</span><span>${def >= str ? '<b class="ok">✔ 守得住</b>，还能收获一批生肉' : `<b class="bad">✖ 守不住</b>，会被抢走约 ${lose}% 物资，可能有人遇难`}</span></div>`;
    const card = (k, ic, n, eff, cost) => {
      const done = p[k];
      return `<div class="ord prep ${done ? 'done' : ''}"><div class="ordk">${ic} ${n}</div><div class="prd">${eff}</div><div class="prc">${cost}</div>${done ? `<div class="ordok">✔ ${done === 2 ? '守夜人已经安排了' : '已安排'}</div>` : `<button class="btn go wide" data-act="prep" data-arg="${k}">${{ fire: '点燃火墙', mil: '召集民兵', hide: '收拢物资' }[k]}</button>`}</div>`;
    };
    const fc = Sim.prepCost(S, c, 'fire'), mc = Sim.prepCost(S, c, 'mil');
    h += card('fire', '🔥', '点燃火墙', `防御 +${Sim.prepGain(S, c, nr, 'fire')}：营地外围一圈火，野兽和掠夺者不敢硬冲`, `烧掉 ${fmt(fc)} 单位燃料<small>库存 ${fmt(Sim.fuelUnitsOf(c.stock))}</small>`);
    h += card('mil', '⚔', '召集民兵', `防御 +${Sim.prepGain(S, c, nr, 'mil')}：能拿得动家伙的人都上墙头`, `熟食 ${fmt(mc)}，袭击前产量 −20%<small>库存 ${fmt(c.stock.food || 0)}</small>`);
    h += card('hide', '📦', '收拢物资', '守不住时只丢一半物资，遇难的人也少一半', '袭击前产量 −10%（搬运工都去搬东西了）');
    return h + auto;
  }
  // 掠夺者营地：他们是谁、离哪座营地近、眼下的索贡怎么答复
  p_gang(part) {
    const S = this.S, g = Sim.gangOf(S, this.panel.arg), st = g && (S.gangs || {})[g.id];
    if (!g || !st) { this.close(); return ''; }
    const nm = Sim.gangName(g);
    if (part === 'title') return `${esc(nm)} <small>掠夺者营地 · 纬度 ${g.y}</small>`;
    const c = (st.dem && Sim.getCamp(S, st.dem.camp)) || Sim.gangTarget(S, g);
    const str = Sim.gangStr(S, g), def = c ? Sim.campDefense(S, c) : 0;
    let h = `<div class="rdhero ${st.gone ? '' : st.dem ? 'bad' : ''}"><div class="cari">🏴</div><div><b>${st.gone ? '已经散伙了' : st.dem ? `索贡中：${fmtTime(st.dem.until - S.t)} 内答复` : c ? `盯着「${esc(c.name)}」` : '离咱们的营地还远'}</b><small>${st.gone ? '营地里只剩烧黑的帐篷架子。' : `强度 ${str}${c ? ` · 「${esc(c.name)}」防御 ${def}` : ''} · 已经打退 ${st.wins || 0}/${Sim.GANG_WINS} 次`}</small></div></div>`;
    if (st.gone) return h + `<button class="btn wide" data-act="gangmap" data-arg="${g.id}">🏴 在地图上看</button>`;
    h += `<div class="row"><span>来往</span><span>纳贡 ${st.paid || 0} 次 · 买卖 ${st.trades || 0} 次 · 打退 ${st.wins || 0} 次</span></div>`;
    if (!st.dem) {
      h += `<div class="row sub"><span></span><span>${c ? `下一次大约 ${fmtTime(Math.max(0, st.next - S.t))} 后来索贡。` : `营地离它 ${Sim.GANG_R} 格以内才会被盯上。`}</span></div>`;
      h += `<div class="hint">他们来索贡时有三条路：交一份贡打发走；多给些吃的和燃料，换回他们抢来的货；或者把人赶回去，等他们打过来。打赢两次，这伙人就散了。</div>`;
      return h + `<button class="btn wide" data-act="gangmap" data-arg="${g.id}">🏴 在地图上看</button>`;
    }
    const tb = Sim.gangTribute(S, g, c), T = Sim.gangTrade(S, g, c), fight = !!st.dem.fight;
    const lose = Math.round(25 * Math.max(0, 1 - def / str));
    const card = (k, ic, n, eff, cost, can, btn) => `<div class="ord prep ${fight && k !== 'fight' ? 'dim' : ''} ${fight && k === 'fight' ? 'done' : ''}"><div class="ordk">${ic} ${n}</div><div class="prd">${eff}</div>${cost ? `<div class="prc">${cost}</div>` : ''}${fight && k === 'fight' ? `<div class="ordok">✔ 已经决定了，${fmtTime(st.dem.until - S.t)} 后开打</div>` : fight ? '' : `<button class="btn ${can ? 'go' : ''} wide" data-act="ganggo" data-arg="${g.id}:${k}" ${can ? '' : 'disabled'}>${btn}</button>`}</div>`;
    h += card('tribute', '🎁', '纳贡', '交一份贡，这回他们就走。下回还来。', costHtml(c.stock, tb), Sim.canAfford(c.stock, tb), '交贡');
    h += card('trade', '⚖', '做买卖', `多给些吃的和燃料，换回他们抢来的货：${Object.keys(T.get).map(k => `${RICON[k]}<b>${fmt(T.get[k])}</b>`).join(' ')}。来往越多给得越多。`, costHtml(c.stock, T.give) + (Sim.canAfford(c.stock, T.give) && Sim.gangTradeBlock(S, g, c) ? `<div class="prw">${Sim.gangTradeBlock(S, g, c)}</div>` : ''), Sim.canAfford(c.stock, T.give) && !Sim.gangTradeBlock(S, g, c), '成交');
    h += card('fight', '⚔', '顶回去', `${def >= str ? '<b class="ok">✔ 守得住</b>（防御 ' + def + ' 对 ' + str + '）：缴获一批货，他们会弱一些' : `<b class="bad">✖ 守不住</b>（防御 ${def} 对 ${str}）：会被抢走约 ${lose}% 物资，可能有人遇难`}。多建箭塔能加防御。`, '', true, '赶他们走');
    h += `<div class="row sub"><span></span><span>到时候没人答复：守得住就顶回去，守不住就先交贡（交不起就凑一部分）。</span></div>`;
    return h;
  }
  p_caravan(part) {
    const S = this.S, C = S.car;
    if (!C) { if (part === 'title') return '雪橇商队'; const n = Sim.nextCaravan(S); return `<div class="carhero"><div class="cari">🛷</div><div><b>商队已经走了</b><small>${n ? `下一支大约 ${fmtTime(n.in)} 后到` : ''}</small></div></div>`; }
    const c = Sim.getCamp(S, C.camp);
    if (part === 'title') return `雪橇商队 <small>${esc(c.name)}外</small>`;
    let h = `<div class="carhero"><div class="cari">🛷</div><div><b>在营地外扎营，还会待 ${fmtTime(C.until - S.t)}</b><small>拿营地的货换他们带来的东西。走了以后订单就作废。</small></div></div>`;
    C.orders.forEach((o, i) => {
      const have = c.stock[o.ask] || 0, why = Sim.orderBlock(S, i);
      const give = o.kind === 'goods' ? `${RICON[o.give]}<b>${fmt(o.gn)}</b> ${RES[o.give].n}` : o.kind === 'ember' ? `🔥<b>${o.gn}</b> 余烬<small>北迁后也留着</small>` : `👥<b>${o.gn}</b> 人<small>流浪者住下，要有空床位</small>`;
      h += `<div class="ord ${o.done ? 'done' : ''}"><div class="ordk">${['稀缺物资', '余烬', '人手'][['goods', 'ember', 'people'].indexOf(o.kind)]}</div>`;
      h += `<div class="ordr"><span class="ordl">要</span><span>${RICON[o.ask]}<b>${fmt(o.n)}</b> ${RES[o.ask].n}<small class="${have >= o.n ? 'ok' : 'bad'}">库存 ${fmt(have)}</small></span></div>`;
      h += `<div class="ordr"><span class="ordl">换</span><span>${give}</span></div>`;
      h += o.done ? `<div class="ordok">✔ 已交货</div>` : `<button class="btn ${why ? '' : 'go'} wide" data-act="deliver" data-arg="${i}" ${why ? 'disabled' : ''}>${why ? esc(why) : '交货'}</button>`;
      h += `</div>`;
    });
    h += `<button class="tgl ${S.carAuto !== false ? 'on' : ''}" data-act="carauto" style="width:100%;margin-top:8px"><span class="ti">🛷</span><span class="tt">没顾上时自动交货<small>商队临走前 10 分钟，库存够两倍的订单自动成交</small></span><i class="sw"></i></button>`;
    return h;
  }
  p_queue(part) {
    const S = this.S, q = Sim.queued(S, this.panel.arg);
    if (!q) { this.close(); return ''; }
    const d = BLD[q.type], c = Sim.getCamp(S, q.camp) || this.camp(), cost = Sim.queueCost(S, q);
    if (part === 'title') return `排队中：${d.n} <small>${esc(c.name)}</small>`;
    const mine = S.queue.filter(x => x.camp === q.camp), n = mine.indexOf(q) + 1;
    const miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
    const tc = this.thumb(q.type, 1);
    let h = `<div class="bhero"><div class="hpic">${tc ? `<i class="th ${tc}"></i>` : ICON[q.type]}</div><div><div class="status warn">等材料</div><div class="desc">${esc(d.desc)}</div></div></div>`;
    h += `<div class="row"><span>需要</span><span>${costHtml(c.stock, cost, S.known)}</span></div>`;
    h += `<div class="row"><span>还缺</span><span>${miss.length ? miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') : '齐了，马上开工'}</span></div>`;
    h += `<div class="row sub"><span>队列</span><span>「${esc(c.name)}」第 ${n} / ${mine.length} 个 · 材料到齐按顺序自动开工</span></div>`;
    h += `<button class="btn wide ghost" data-act="unqueue" data-arg="${q.id}">取消排队</button>`;
    return h;
  }

  p_bld(part) {
    const S = this.S, b = Sim.getB(S, this.panel.arg);
    if (!b) { this.close(); return ''; }
    const d = BLD[b.type], c = Sim.getCamp(S, b.camp), R = Sim.rt(S), br = R.b[b.id] || {}, cr = R.c[c.id] || {};
    if (part === 'title') return `${d.n} <small>${b.lvl} 级 · ${esc(c.name)}</small>`;
    let h = '';
    const tc = this.thumb(b.type, b.lvl);
    h += `<div class="bhero"><div class="hpic">${tc ? `<i class="th ${tc}"></i>` : ICON[b.type]}</div><div>`;
    if (br.status) h += `<div class="status ${br.status === '运转中' || br.status === '研究中' ? 'ok' : 'bad'}">${esc(br.status)}</div>`;
    h += `<div class="desc">${esc(d.desc)}</div></div></div>`;
    if (b.type === 'workshop') { const T = S.tech || {}, ct = T.cur && TECHS.find(t => t.id === T.cur); h += `<button class="mlink" data-act="tb" data-arg="research"><span>🔬</span><span>${ct ? `正在研究「${ct.n}」 ${Math.floor(T.prog / ct.pts * 100)}%` : '挑一项研究'}<small>这座工程站每分钟 ${fmt(br.rp || 0)} 点</small></span><i>›</i></button>`; }
    const mx = Sim.bMax(S, b);
    if (mx) {
      h += `<div class="row"><span>${b.type === 'warehouse' ? '搬运工' : '工人'}</span><span class="stepper"><button data-act="w-" data-arg="${b.id}">−</button><b>${b.workers}/${mx}</b><button data-act="w+" data-arg="${b.id}">＋</button><button class="small" data-act="wmax" data-arg="${b.id}">满</button></span></div>`;
      h += `<div class="row sub"><span>营地空闲人手</span><span>${Sim.idleLabor(S, c)}</span></div>`;
      const same = b.type !== 'furnace' ? Sim.sameType(S, b) : [];
      if (same.length > 1) { const sf = Sim.staffOf(S, b); h += `<div class="row sub bulkr"><span>同类 ${same.length} 栋</span><span>共 ${sf.w}/${sf.mx} 人<button class="bulkb" data-act="bulkw" data-arg="${b.id}" ${sf.w >= sf.mx ? 'disabled' : ''}>${sf.w >= sf.mx ? '都满了' : '都派满'}</button></span></div>`; }
    }
    if (d.out) {
      const rate = br.rate || {};
      h += `<div class="row"><span>产出</span><span>${Object.keys(d.out).map(k => `${RICON[k]}${fmt(rate[k] || 0)}`).join(' ')}<small>/分</small></span></div>`;
      if (d.in) h += `<div class="row"><span>消耗</span><span>${Object.keys(d.in).map(k => `${RICON[k]}${fmt((br.inRate || {})[k] || 0)}`).join(' ')}<small>/分</small></span></div>`;
      { const B = Sim.prodBonus(S, b, c), pc = x => Math.round(x * 100);
        h += `<div class="row sub"><span>等级、加成</span><span>${b.lvl} 级 ×${Sim.levelMul(b.lvl).toFixed(2)} · 加成 ${B.sum >= 0 ? '+' : ''}${pc(B.sum)}%${B.parts.length ? `<small>（${B.parts.map(p => `${p[0]} ${p[1] >= 0 ? '+' : ''}${pc(p[1])}`).join(' · ')}）</small>` : ''}</span></div>`; }
      h += `<div class="row sub"><span>到最近仓库</span><span>${(br.dist || 0).toFixed(1)} 格 · 占用搬运工 ${fmt(br.haul || 0)}</span></div>`;
      const syn = R.adj.get(b.id) || 0;
      if (d.syn) h += `<div class="row sub"><span>相邻联动</span><span>${syn ? '+' + Math.round(syn * Sim.SYN_PER * 100) + '%' : '无'} <small>（贴着${d.syn.map(t => BLD[t].n).join('/')}）</small></span></div>`;
      if (d.gather) {
        const sp = R.gatherSpots.get(b.id) || [];
        let left = 0, alive = 0, young = 0, grow = 0; const tended = Sim.tendedSpots(S);
        for (const s of sp) { const l = Sim.harvestLeft(S, s.i); left += l; if (l > 0) alive++; if (Sim.isSapling(S, s.i)) young++; if (Sim.spotLeft(S, s.i) < Sim.spotMax(S, s.i)) grow += Sim.regrowRate(S, s.i, tended); }
        h += `<div class="row sub"><span>附近资源点</span><span>${alive} 处可采 · 剩 ${fmt(left)}</span></div>`;
        if (b.deep) h += `<div class="row sub"><span>⛏ 深井</span><span>采空后仍按 ${Math.round(Sim.DEEP_RATE * 100)}% 产量一直挖${br.deep ? '（正在深处挖）' : ''}</span></div>`;
        else if (Sim.deepable(b.type)) {
          const fr = Sim.gatherLeftFrac(S, b), dc = Sim.deepCost(S, b), why = Sim.deepBlock(S, b);
          if (fr <= 0.25) h += `<div class="deepbox"><div><b>⛏ 挖深井</b><small>地表的矿快采完了。挖成深井后，采空也能按 ${Math.round(Sim.DEEP_RATE * 100)}% 的产量一直挖下去；也可以去侦察营派勘探队找新矿脉。</small><span>${costHtml(c.stock, dc)}</span></div><button class="small ${why ? '' : 'go'}" data-act="deep" data-arg="${b.id}">挖深井</button></div>`;
        }
        if (young || grow > 0.05) h += `<div class="row sub"><span>${d.gather[0] === 'tree' ? '补种' : d.gather[0] === 'herd' ? '留种' : '恢复'}</span><span>${young ? `${young} 处${d.gather[0] === 'tree' ? '树苗' : '幼崽'}在长 · ` : ''}+${fmt(grow)}/分</span></div>`;
      }
    }
    // 生产链：原料从哪来、产品去哪（地图上同时画出流向连线）
    { const ch = Sim.chainOf(S, b);
      const grp = l => { const m = new Map(); for (const x of l) { const k = x.b.type; m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([t, n]) => `${BLD[t].n}${n > 1 ? '×' + n : ''}`).join('、'); };
      const maker = r => { const t = Object.keys(BLD).find(t => BLD[t].out && BLD[t].out[r]); return t ? BLD[t].n : RES[r].n; };
      if (ch.ins.length) h += `<div class="row chain"><span>⬇ ${b.type === 'furnace' || b.type === 'heater' ? '燃料' : '原料'}来自</span><span>${ch.up.length ? grp(ch.up) : ''}${ch.missing.length ? ` <b class="warn">缺${[...new Set(ch.missing.map(maker))].join('、')}</b>` : ''}</span></div>`;
      if (ch.outs.length) h += `<div class="row chain"><span>⬆ 产品送往</span><span>${ch.down.length ? grp(ch.down) : ch.outs.includes('food') ? '全营地的人吃' : '仓库（用来建造和升级）'}</span></div>`;
      if (ch.ins.length || ch.outs.length) h += `<div class="row chain"><span></span><span><button class="small" data-act="chainmap">🔗 看整条生产链</button></span></div>`;
    }
    // 传送带：和挨着的上下游直接连起来
    if (S.known >= Sim.BELT[1].tier && (d.in || d.out) && b.type !== 'furnace') {
      const mine = Sim.beltsOf(S, b.id), opts = mine.length >= Sim.BELT_PER ? [] : Sim.beltOptions(S, b.id);
      if (mine.length || opts.length) {
        h += `<div class="sec">传送带 <small>直接供料：少用搬运工，下游快一点</small></div>`;
        for (const e of mine) {
          const o = Sim.getB(S, e.a === b.id ? e.b : e.a); if (!o) continue;
          const up = e.lvl < 2 ? Sim.beltUpBlock(S, e) : null, upCost = e.lvl < 2 ? Sim.beltCost(S, Sim.beltEnds(Sim.getB(S, e.a), Sim.getB(S, e.b)).len, 2) : null;
          h += `<div class="row belt"><span>${RICON[e.k]} ${e.a === b.id ? '送往' : '来自'} ${BLD[o.type].n}<br><small>${Sim.BELT[e.lvl].n} · 省 ${Math.round(Sim.BELT[e.lvl].cut * 100)}% 搬运${e.b === b.id ? ` · 这里 +${Math.round(Sim.BELT[e.lvl].bonus * 100)}%` : ''}</small></span><span class="bbtn">${e.lvl < 2 && S.known >= Sim.BELT[2].tier ? `<button class="small ${up ? '' : 'go'}" data-act="beltup" data-arg="${e.id}" title="${esc(up || '')}">升级轨道 ${costHtml(c.stock, upCost)}</button>` : ''}<button class="small" data-act="beltrm" data-arg="${e.id}">拆</button></span></div>`;
        }
        for (const o of opts.slice(0, 4 - Math.min(2, mine.length))) {
          const ck = o.ck;
          h += `<div class="row belt"><span>${RICON[o.k]} ${o.dir === 'out' ? '送往' : '来自'} ${BLD[o.other.type].n}<br><small>${o.len < 0.5 ? '紧挨着' : `隔 ${o.len.toFixed(1)} 格`}${ck.ok || ck.soft ? '' : ` · <b class="warn">${esc(ck.reason)}</b>`}</small></span><span class="bbtn">${ck.ok || ck.soft ? `<button class="small ${ck.ok ? 'go' : ''}" data-act="belt" data-arg="${o.a}:${o.b}:${o.k}">连上 ${costHtml(c.stock, ck.cost)}</button>` : ''}</span></div>`;
        }
      }
    }
    if (b.type === 'furnace') {
      const ring = Sim.heatRadius(S, c);
      h += `<div class="row"><span>温度</span><span>${Math.round(cr.temp)}°C <small>= 纬度 ${baseTempOfRow(c.y)}° + 熔炉 ${Math.round(cr.heat)}°${cr.drop ? ` − 暴风雪 ${Math.round(cr.drop)}°` : ''}</small></span></div>`;
      h += `<div class="row sub"><span>屋里</span><span>${Math.round(cr.tH)}°C（帐篷保温 +${Math.round(cr.ins || 0)}°）</span></div>`;
      h += `<div class="row"><span>燃料</span><span>${fmt(cr.burnPerMin)} 单位/分${cr.od ? ' <small>（超载×2）</small>' : ''} · 库存 ${fmt(cr.fuelUnits)}</span></div>`;
      h += this.odBlock(c, cr, b);
      { const F = Sim.focusOf(c); h += `<button class="mlink" data-act="tb" data-arg="camp"><span>${F ? `<i class="fch sm" style="background:${F.col}">${F.ch}</i>` : '🧭'}</span><span>${F ? `${F.n}营地` : '营地专精'}<small>${F ? F.d : b.lvl >= FOCUS_LVL ? '还没定方向：矿业、农垦、工坊或要塞，在营地面板里选' : `熔炉 ${FOCUS_LVL} 级后可以选营地专精`}</small></span><i>›</i></button>`; }
      h += this.festCard(c);
      { const w = Sim.weatherAt(S, S.t); h += `<button class="mlink" data-act="wx"><span>❄</span><span>${w.blizzard ? `暴风雪中，还剩 ${fmtTime(w.until - S.t)}` : `下一场暴风雪：${fmtTime(w.next ?? w.inSec)} 后`}<small>看降温、燃料和熟食够不够撑过去</small></span><i>›</i></button>`; }
      h += `<div class="row sub"><span>热值</span><span>${Object.keys(FUEL).map(f => `${RICON[f]}=${FUEL[f]}`).join(' ')}</span></div>`;
      h += `<div class="row"><span>优先烧</span><span><select data-act="fuel" data-arg="${c.id}">${['auto', ...Object.keys(FUEL)].map(f => `<option value="${f}" ${c.fuelPref === f ? 'selected' : ''}>${f === 'auto' ? '自动（先烧好的）' : RES[f].n}</option>`).join('')}</select></span></div>`;
      h += `<div class="row"><span>供热半径</span><span>${ring} 格 → 升级后 ${ring + furnaceRadius(b.lvl + 1) - furnaceRadius(b.lvl)} 格${c.pipe ? `<small>（含蒸汽管道 +${c.pipe}）</small>` : ''}</span></div>`;
      h += `<div class="row sub"><span>搬运工</span><span>${fmt(cr.haulers)} 人 · 需要 ${fmt(cr.demand)}${cr.hf < 1 ? ' <b class="warn">不够</b>' : ''}</span></div>`;
      h += `<div class="row sub"><span>防御</span><span>${Sim.campDefense(S, c)}</span></div>`;
      h += `<button class="mlink" data-act="camptab" data-arg="infra"><span>${INFRA.pipe.ic}</span><span>营地基建：${INFRA.road.lv[c.road || 0].n} · ${INFRA.pipe.lv[c.pipe || 0].n}<small>修路让搬运更快，修蒸汽管道让供热圈更大</small></span><i>›</i></button>`;
    }
    if (b.type === 'tent') h += `<div class="row"><span>床位</span><span>${Sim.housingOf(b)} 人 · 保温 +${Sim.insulOf(b)}°</span></div>`;
    if (b.type === 'warehouse') h += `<div class="row"><span>仓储</span><span>每种物资上限 ${fmt(cr.cap)}</span></div>`;
    if (b.type === 'tower') h += `<div class="row"><span>威力</span><span>${Math.round(Sim.towerPower(b.lvl))}</span></div>`;
    if (b.type === 'heater') h += `<div class="row"><span>加温</span><span>+${Math.round(BLD.heater.heat * (1 + 0.5 * (b.lvl - 1)))}° · 烧煤 ${fmt(BLD.heater.burn * b.lvl)}/分</span></div>`;
    if (b.type === 'bay') h += `<div class="row"><span>自动机</span><span>${c.bots}/${cr.botCap || 0} 台（库存核心会自动装入）</span></div>`;
    if (b.type === 'kennel') {
      const n = Sim.kennelDogs(b.lvl), br = Sim.rt(S).b[b.id] || {}, all = Sim.dogsOf(S, c.id);
      h += `<div class="row"><span>雪橇犬</span><span>${Math.round(br.dogs || 0)}/${n} 只能拉雪橇 · ${b.workers ? `吃生肉 ${fmt(n * BLD.kennel.feed)}/分${(br.fed ?? 1) < 0.95 ? ' <b class="warn">没喂饱</b>' : ''}` : '没人看：狗放出去自己找吃的了'}</span></div>`;
      h += `<div class="row sub"><span>全营地</span><span>${Math.round(all)} 只 → 侦察队 +${Math.round(Sim.dogScout(S, c.id) * 100)}%${S.lines.some(l => l.a === c.id || l.b === c.id) ? ` · 运输线运量 +${Math.round(Math.max(...S.lines.filter(l => l.a === c.id || l.b === c.id).map(l => Sim.dogLine(S, l))) * 100)}%` : ' · 有了运输线也会更快'}</span></div>`;
      h += `<div class="hint">每只喂饱的狗让侦察队快 5%（最多 +60%），让连着这座营地的运输线多运 3%（最多 +45%）。</div>`;
    }
    if (b.type === 'infirmary') {
      const ward = Sim.wardOf(S, c), br = Sim.rt(S).b[b.id] || {}, nb = Sim.wardBeds(b.lvl), sickN = cr.sick || 0;
      h += `<div class="row"><span>病床</span><span>${Math.round(br.pts || 0)}/${nb} 张有人${(br.staff ?? 0) < 0.99 ? ` <b class="warn">人手不够，只能照看 ${Math.floor(nb * (br.staff || 0))} 张</b>` : ''}</span></div>`;
      h += `<div class="row sub"><span>全营地</span><span>病人 ${sickN} 人${cr.treated ? `，${Math.round(cr.treated)} 人在病床上` : ''} · 新病倒的人 −${Math.round(Sim.WARD_GUARD * ward.guard * 100)}%${ward.care > 1.001 ? ` · 医生让康复快 ${Math.round((ward.care - 1) * 100)}%` : ''}</span></div>`;
      h += `<div class="hint">病床上的人就算外面冷、口粮紧也会好起来，而且好得更快；住进医务所的病人，大家也没那么揪心。${S.meta.specs.he ? '把何大夫安排到这里，好得更快。' : '医务所开张、有人守着，过一阵会有位老大夫来投奔。'}</div>`;
    }
    if (d.cat === 'deco') {
      const one = Sim.decoOne(b), dh = Sim.decoHope(S, c), mx2 = Sim.bMax(S, b), sf = mx2 ? Math.min(1, b.workers / mx2) : 1;
      h += `<div class="row"><span>希望</span><span>这栋 +${fmt(one * sf)}${sf < 1 ? ` <b class="warn">要 ${mx2} 人照看才有 +${fmt(one)}</b>` : ''}</span></div>`;
      h += `<div class="row sub"><span>全营地装饰</span><span>合计 +${fmt(dh.v)} 希望（上限 ${Sim.DECO_CAP}，越多加得越少）</span></div>`;
      h += `<div class="hint">装饰不产东西，只让人心里亮一点：放在大家来回走的路边、熔炉旁边都行。升级一级多 25%。</div>`;
    }
    if (b.type === 'scout') {
      const sl = Sim.scoutSlots(S, c.id);
      h += `<div class="row"><span>侦察队</span><span>${sl.used}/${sl.n} 队在外 · 最远 ${Sim.scoutRange(S, c.id)} 格</span></div>`;
      h += `<button class="btn wide" data-act="scoutpick">🚩 派侦察队（在地图上点目标）</button>`;
    }
    // 专家
    const sid = Sim.specIn(S, b.id);
    const fits = SPECS.filter(sp => S.meta.specs[sp.id] && sp.aff.includes(b.type));
    if (sid || fits.length || Object.keys(S.meta.specs).length) {
      const sp = sid && SPECS.find(s => s.id === sid);
      h += `<div class="row"><span>专家</span><span>${sp ? `${sp.n} <small>${S.meta.specs[sid].lvl}级 +${Math.round(Sim.specOf(S, b) * 100)}%</small> <button class="small" data-act="unspec" data-arg="${sid}">请走</button>` : `<select data-act="spec" data-arg="${b.id}"><option value="">— 安排专家 —</option>${SPECS.filter(s => S.meta.specs[s.id]).map(s => `<option value="${s.id}">${s.n}（${s.role}）${s.aff.includes(b.type) ? ' ★对口' : ''}${S.specAt[s.id] ? ' · 在别处' : ''}</option>`).join('')}</select>`}</span></div>`;
    }
    // 升级
    const cost = Sim.upgradeCost(S, b);
    const g = Sim.gateTier(b.type, b.lvl);
    h += `<div class="upbox"><div class="sec">升级</div>`;
    { const nb = { ...b, lvl: b.lvl + 1 }, fx = [];
      if (d.out) fx.push(`产量 ×${Sim.levelMul(b.lvl).toFixed(2)}→×${Sim.levelMul(b.lvl + 1).toFixed(2)}`);
      const m2 = Sim.maxWorkers(b.type, b.lvl + 1); if (m2 > mx) fx.push(`岗位 ${mx}→${m2}`);
      if (b.type === 'furnace') fx.push(`供热 +5°`, `半径 ${furnaceRadius(b.lvl)}→${furnaceRadius(b.lvl + 1)}`, '耗燃料 +17%');
      if (b.type === 'tent') fx.push(`床位 ${Sim.housingOf(b)}→${Sim.housingOf(nb)}`, `保温 +${Sim.insulOf(b)}→+${Sim.insulOf(nb)}°`);
      if (b.type === 'tower') fx.push(`威力 ${Math.round(Sim.towerPower(b.lvl))}→${Math.round(Sim.towerPower(b.lvl + 1))}`);
      if (b.type === 'heater') fx.push('加温 +50%');
      if (b.type === 'scout') fx.push('走得更远 +8 格');
      if (b.type === 'kennel') fx.push(`狗 ${Sim.kennelDogs(b.lvl)}→${Sim.kennelDogs(b.lvl + 1)} 只`);
      if (b.type === 'infirmary') fx.push(`病床 ${Sim.wardBeds(b.lvl)}→${Sim.wardBeds(b.lvl + 1)} 张`);
      if (d.cat === 'deco') fx.push(`希望 +${fmt(Sim.decoOne(b))}→+${fmt(Sim.decoOne(nb))}`);
      if (fx.length) h += `<div class="row sub"><span>效果</span><span>${fx.join(' · ')}</span></div>`; }
    { const same = b.type !== 'furnace' ? Sim.sameType(S, b) : [];
      if (same.length > 1) {
        const lv = same.map(x => x.lvl), lo = Math.min(...lv), hi = Math.max(...lv), qn = same.filter(x => x.qup).length;
        h += `<div class="row sub bulkr"><span>同类 ${same.length} 栋</span><span>${lo === hi ? `都是 ${lo} 级` : `${lo}～${hi} 级`}${qn ? ` · ${qn} 栋排队中` : ''}<button class="bulkb" data-act="bulkup" data-arg="${b.id}">⬆ 每栋升一级</button></span></div>`;
      } }
    if (g > d.t) h += `<div class="row sub"><span>门槛</span><span>${b.lvl} 级以上要用「${TIER_NAMES[g]}」层的${RES[GATE[g]].n}${RES[GATE[g]].t > S.known ? '（还没解锁）' : ''}</span></div>`;
    else { const nextGate = (Math.floor(b.lvl / GATE_EVERY) + 1) * GATE_EVERY; if (d.t < 7) h += `<div class="row sub"><span>门槛</span><span>${nextGate} 级起需要「${TIER_NAMES[d.t + 1]}」层的${RES[GATE[d.t + 1]].n}</span></div>`; }
    h += `</div>`;
    if (b.type !== 'furnace') h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">拆除（返还一半基础材料）</button>`;
    // 升级按钮钉在面板底部，往下翻也一直看得到
    { const can = Sim.canAfford(c.stock, cost), locked = Object.keys(cost).some(k => RES[k].t > S.known);
      const btn = can ? `<button class="btn go" data-act="upgrade" data-arg="${b.id}">⬆ 升级</button>`
        : locked ? `<button class="btn" data-act="upgrade" data-arg="${b.id}">⬆ 升级</button>`
        : `<button class="btn qup ${b.qup ? 'on' : ''}" data-act="qup" data-arg="${b.id}" title="${b.qup ? '已排队：材料到齐自动升级（点一下取消）' : '材料到齐后自动升级'}">${b.qup ? '⏳ 已排队' : '⏳ 排队升级'}</button>`;
      h += `<div class="pfoot"><span class="pfc"><small>升到 ${b.lvl + 1} 级${b.qup && !can ? ' · 材料到了自动升' : ''}</small><span>${costHtml(c.stock, cost, S.known)}</span></span>${btn}</div>`; }
    return h;
  }

  // ---------- 物资总览：每种物资的进出、卡在哪一环 ----------
  reqWho(r) { return personOf({ k: 'r', i: r.id, camp: r.camp }); }
  // 人物委托：谁、想要什么、做到哪了、给什么
  p_req(part) {
    const S = this.S, L = S.reqs || [];
    if (part === 'title') return `委托 <small>营地里的人提的小心愿</small>`;
    if (!L.length) return `<div class="empty">现在没有人提要求。玩的时候，营地里的人隔一阵会来找你帮个忙。</div>`;
    const sel = this.panel.arg;
    let h = '';
    for (const r of [...L].sort((a, b) => (b.id === sel) - (a.id === sel))) {
      const p = this.reqWho(r), pr = Sim.reqProgress(S, r), c = Sim.getCamp(S, r.camp), rw = r.rw || {};
      const rwTxt = [...Object.keys(rw.res || {}).map(k => `${RICON[k]}${fmt(rw.res[k])}`), rw.embers ? `余烬 +${rw.embers}` : '', rw.hope ? `希望 +${rw.hope}` : '', rw.disc ? `不满 ${rw.disc}` : ''].filter(Boolean).join(' · ');
      const quote = { build: `营地里要是有座${BLD[r.type]?.n}就好了。`, upgrade: `${BLD[r.type]?.n}再好一点，我们干活就不用这么拼了。`, stock: `攒一批${RES[r.k]?.n}吧，我想给大家准备点东西。`, beds: `窝棚里太挤了，能不能让大家都有张床？` }[r.kind];
      const go = r.kind === 'build' ? `<button class="small" data-act="place" data-arg="${r.type}">去建</button>` : r.kind === 'upgrade' ? `<button class="small" data-act="reqgo" data-arg="${r.bid}">看看这栋</button>` : r.kind === 'beds' ? `<button class="small" data-act="place" data-arg="tent">建帐篷</button>` : '';
      h += `<div class="reqcard ${pr.done ? 'done' : ''} ${r.id === sel ? 'sel' : ''}"><div class="rqhead"><span class="rqav">${esc(p.name.slice(0, 1))}</span><span><b>${esc(p.name)}</b><small>${p.age} 岁 · ${esc(p.trait)} · ${esc(c ? c.name : '')}</small></span><small class="rqt">${fmtTime(Math.max(0, r.until - S.t))}</small></div>
        <div class="rqq">「${esc(quote)}」</div>
        <div class="rqgoal"><b>${esc(Sim.reqTitle(S, r))}</b><span class="rqbar"><i style="width:${(pr.cur / pr.need * 100).toFixed(0)}%"></i></span><small>${fmt(pr.cur)} / ${fmt(pr.need)}</small></div>
        <div class="rqrw"><span>回报：${rwTxt}</span><span class="rqbtn">${pr.done ? `<button class="small go" data-act="reqok" data-arg="${r.id}">${r.kind === 'stock' ? '交给' + (p.name.length > 2 ? p.name.slice(1) : p.name) : '告诉' + (p.name.length > 2 ? p.name.slice(1) : p.name)}</button>` : go}<button class="small ghost" data-act="reqno" data-arg="${r.id}" title="不用管它，过一阵会有别的">算了</button></span></div></div>`;
    }
    h += `<div class="note">委托只在你玩的时候出现，一次最多两个；一小时内没做到，对方会有点失望（希望 −2）。</div>`;
    return h;
  }
  p_stock(part) {
    const S = this.S, c = this.camp(), R = Sim.rt(S), cr = R.c[c.id] || {}, flow = cr.flow || {}, cap = cr.cap || 0;
    if (part === 'title') return `物资 <small>${esc(c.name)} · 每种上限 ${fmt(cap)}</small>`;
    const bs = S.buildings.filter(b => b.camp === c.id);
    const full = [], miss = {}, idle = [], depl = [];
    for (const b of bs) {
      const st = (R.b[b.id] || {}).status; if (!st) continue;
      if (st === '仓库满了') full.push(b);
      else if (st.startsWith('缺')) (miss[st.slice(1)] ||= []).push(b);
      else if (st === '没有派人' || st === '没人干活') idle.push(b);
      else if (st.includes('采空')) depl.push(b);
    }
    const maker = k => Object.keys(BLD).filter(t => BLD[t].out && BLD[t].out[k] && BLD[t].t <= S.known);
    const btn = (t, label) => `<button class="small go" data-act="place" data-arg="${t}">${label || '建' + BLD[t].n}</button>`;
    const issues = [];
    // 缺料：用它的建筑想要的比实际拿到的多
    for (const k of RES_KEYS) {
      const f = flow[k]; if (!f || f.want <= 0.05) continue;
      const gap = f.want - f.c; if (gap < Math.max(0.05, f.want * 0.08)) continue;
      const who = miss[RES[k].n] || [];
      const mk = maker(k);
      const sev = gap / f.want;
      const whoTxt = k === 'food' ? '大家吃不饱' : who.length ? `${[...new Set(who.map(b => BLD[b.type].n))].join('、')}在等` : FUEL[k] && cr.fueled < 1 ? '熔炉燃料不够' : '用它的建筑在等';
      issues.push({ sev: 1 + sev - RES[k].t * 0.001 + (RES[k].raw ? 0.0005 : 0), html: `<div class="issue bad"><span class="ii">${RICON[k]}</span><span class="it"><b>缺${RES[k].n}</b>：${whoTxt}，只够 ${Math.round((1 - sev) * 100)}%<small>每分钟要 ${fmt(f.want)}，产出 ${fmt(f.p)}</small></span><span class="ia">${mk.length ? btn(mk[0]) : ''}</span></div>` });
    }
    if (cr.hf != null && cr.hf < 0.85) issues.push({ sev: 1.5, html: `<div class="issue bad"><span class="ii">🛷</span><span class="it"><b>搬运工不够</b>：要 ${fmt(cr.demand)} 人，只有 ${fmt(cr.haulers)}<small>仓库里的岗位就是搬运工，离得远的建筑更费人</small></span><span class="ia">${btn('warehouse')}</span></div>` });
    if (full.length) {
      const ks = [...new Set(full.flatMap(b => Object.keys(BLD[b.type].out || {})))].filter(k => (c.stock[k] || 0) >= cap * 0.97);
      issues.push({ sev: 1.2, html: `<div class="issue warn"><span class="ii">📦</span><span class="it"><b>${ks.map(k => RICON[k] + RES[k].n).join('、') || '仓库'}满了</b>：${full.length} 栋建筑停工<small>升级或多建仓库能放更多；也可以打开下面的「满仓自动兑换」</small></span><span class="ia">${btn('warehouse', '建仓库')}</span></div>` });
    }
    if (idle.length) issues.push({ sev: 1.1, html: `<div class="issue warn"><span class="ii">👷</span><span class="it"><b>${idle.length} 栋建筑没人干活</b><small>${c.auto === false ? '自动派人已关闭' : '空闲人手不够：多建帐篷、备足熟食，会有人来投奔'}</small></span><span class="ia">${c.auto === false ? `<button class="small go" data-act="auto" data-arg="${c.id}">开自动派人</button>` : btn('tent')}</span></div>` });
    if (c.wait > 0) issues.push({ sev: 1.15, html: `<div class="issue warn"><span class="ii">⛺</span><span class="it"><b>${c.wait} 人在等床位</b><small>床位满了，新来的人先在窝棚里等着，不干活。多盖或升级帐篷，他们会自己住进来</small></span><span class="ia">${btn('tent', '建帐篷')}</span></div>` });
    if (depl.length) { const wood = depl.some(b => b.type === 'lumber'); issues.push({ sev: 1, html: `<div class="issue"><span class="ii">⛏</span><span class="it"><b>${depl.length} 栋采集建筑附近采空了</b><small>${wood ? '附近没树了可以建育林场，自己种树；' : ''}矿场、采石场可以挖深井一直挖下去，侦察营也能派勘探队找新矿脉</small></span>${wood ? `<span class="ia">${btn('nursery')}</span>` : ''}</div>` }); }
    if ((c.disc ?? 0) >= 60) issues.push({ sev: 1.3, html: `<div class="issue ${(c.disc ?? 0) >= Sim.LEAVE_AT ? 'bad' : 'warn'}"><span class="ii">💢</span><span class="it"><b>不满 ${Math.round(c.disc)}</b>：干活变慢${(c.disc ?? 0) >= Sim.LEAVE_AT ? '，有人在离开' : ''}<small>看看是什么让大家不满，也可以签署安抚人心的律令</small></span><span class="ia"><button class="small go" data-act="tb" data-arg="mood">人心</button></span></div>` });
    issues.sort((a, b) => b.sev - a.sev);
    let h = `<div class="chrow"><button class="btn chbtn" data-act="chainmap">🔗 生产链总览 <small>上下游一张图</small></button><button class="btn chbtn" data-act="curve">📈 数据曲线 <small>储量和产量</small></button></div><div class="sec">卡在哪</div>`;
    h += issues.length ? issues.slice(0, 6).map(i => i.html).join('') : `<div class="issue ok"><span class="ii">✓</span><span class="it"><b>生产很顺畅</b><small>没有缺料、停工或缺人</small></span></div>`;
    // 物资表
    h += `<div class="sec">库存与流量 <small>每分钟</small></div><div class="stab">`;
    let tier = 0;
    for (const k of RES_KEYS) {
      const f = flow[k] || { p: 0, c: 0 }, have = c.stock[k] || 0;
      if (RES[k].t > S.known || (have < 1 && !f.p && !f.c)) continue;
      if (RES[k].t !== tier) { tier = RES[k].t; h += `<div class="stier">${TIER_NAMES[tier]}</div>`; }
      const net = f.p - f.c, fr = cap ? Math.min(1, have / cap) : 0;
      h += `<div class="srow" data-act="curve" data-arg="${k}" title="产出 ${fmt(f.p)} / 消耗 ${fmt(f.c)} · 点一下看曲线"><span class="si">${RICON[k]}</span><span class="sn">${RES[k].n}</span><span class="sb ${fr > 0.97 ? 'full' : fr > 0.85 ? 'hi' : ''}"><i style="width:${(fr * 100).toFixed(1)}%"></i><b>${fmt(have)}</b></span><span class="sf ${net < -0.05 ? 'neg' : net > 0.05 ? 'pos' : ''}"><b>${net >= 0 ? '+' : ''}${fmt(net)}</b><small>产${fmt(f.p)} 用${fmt(f.c)}</small></span></div>`;
    }
    h += `</div>`;
    // 加工留料
    const kp = c.keep !== false;
    h += `<div class="sec">加工留料</div>`;
    h += `<div class="row"><span>${kp ? '已开启' : '已关闭'}<br><small>锯木厂不会把木材全锯成木板，炼钢厂不会把铁锭用完：木材、铁锭这些基础建材，仓库里留 ${fmt(Math.min(Sim.KEEP_MAX, cap * Sim.KEEP_FRAC))} 给建造。</small></span><span style="flex:none"><button class="small ${kp ? 'go' : ''}" data-act="keep" data-arg="${c.id}">${kp ? '关闭' : '开启'}</button></span></div>`;
    // 满仓兑换
    h += `<div class="sec">满仓自动兑换</div>`;
    h += `<div class="row"><span>${c.trade ? '已开启' : '已关闭'}<br><small>开启后仓库满了也不停工，多出来的按三成价值换成营地最缺的同级或更低级物资。</small></span><span style="flex:none"><button class="small ${c.trade ? 'go' : ''}" data-act="trade" data-arg="${c.id}">${c.trade ? '关闭' : '开启'}</button></span></div>`;
    const tl = Object.entries(cr.trade || {}).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]);
    if (tl.length) h += `<div class="row sub"><span>正在兑换</span><span>${tl.slice(0, 4).map(([q, v]) => { const [a, b] = q.split('>'); return `${RICON[a]}→${RICON[b]} ${fmt(v)}/分`; }).join(' · ')}</span></div>`;
    return h;
  }

  // ---------- 一个人 ----------
  p_person(part) {
    const S = this.S, info = this.panel.arg, R = Sim.rt(S), p = personOf(info);
    if (part === 'title') return `${p.name} <small>${p.age} 岁 · 来自${p.from}</small>`;
    const sc = info.k === 's' ? S.scouts.find(x => x.id === info.sid) : null;
    const ps = personState(S, info, p, R, { scoutTemp: sc ? baseTempOfRow(sc.y) : undefined, feast: Sim.activeBuffs(S, Sim.getCamp(S, info.camp) || this.camp()).some(b => b.k === 'prod' && b.v > 0), night: this.g.view.nf > 0.5, aurora: this.g.view.aur > 0.4, icefog: this.g.view.ice > 0.4 });
    const warm = ps.t >= 10 ? '暖和' : ps.t >= 0 ? '有点冷' : '冻得发抖';
    let h = `<div class="pquote">「${esc(ps.quote)}」</div>`;
    h += `<div class="row"><span>在做什么</span><span>${esc(ps.role)}</span></div>`;
    h += `<div class="row"><span>住处</span><span>${info.k === 's' ? '在野外' : ps.housed ? '住帐篷' : '<b class="warn">没有床位，睡在外面</b>'}</span></div>`;
    h += `<div class="row"><span>冷暖</span><span class="${ps.t < 0 ? 'neg' : ''}">${warm} · 体感 ${ps.t}°</span></div>`;
    h += `<div class="row"><span>吃饭</span><span>${ps.hungry ? '<b class="warn">饿着肚子</b>' : '吃得饱'}</span></div>`;
    h += `<div class="row"><span>身体</span><span>${ps.sick ? '<b class="warn">在发烧，硬撑着</b>' : '没病没灾'}</span></div>`;
    h += `<div class="row"><span>心情</span><span>${ps.mood}</span></div>`;
    h += `<div class="row sub"><span>性格</span><span>${p.trait}</span></div>`;
    if (info.b != null && Sim.getB(S, info.b)) h += `<button class="btn wide" data-act="openbld" data-arg="${info.b}">查看${BLD[Sim.getB(S, info.b).type].n}</button>`;
    h += `<div class="hint">营地里的人会冷会饿：体感低于 2° 或者吃不饱，就会有人病倒；病人不能干活，暖和、吃饱以后才会慢慢好起来。</div>`;
    return h;
  }

  // ---------- 消息记录 ----------
  p_log(part) {
    const S = this.S, f = this.logF || 'all';
    if (part === 'title') return `消息 <small>最近 ${S.log.length} 条</small>`;
    const si = this.logOpenSeen ? S.log.lastIndexOf(this.logOpenSeen) : S.log.length - 1;
    const ago = dt => dt < 60 ? '刚刚' : dt < 3600 ? `${Math.floor(dt / 60)} 分钟前` : dt < 86400 ? `${Math.floor(dt / 3600)} 小时前` : `${Math.floor(dt / 86400)} 天前`;
    const pick = l => f === 'all' || (f === 'hot' ? l.kind === 'bad' || l.kind === 'warn' : l.kind === 'story' || l.kind === 'good');
    let h = `<div class="lfil">${[['all', '全部'], ['hot', '要紧的'], ['story', '故事与收获']].map(([k, n]) => `<button class="${f === k ? 'on' : ''}" data-act="logf" data-arg="${k}">${n}</button>`).join('')}</div>`;
    // 连续相同的合并；按「今天 / 昨天 / 更早」分段（游戏里的天）
    const rows = [];
    for (let j = S.log.length - 1; j >= 0; j--) {
      const l = S.log[j];
      if (!pick(l)) continue;
      const last = rows[rows.length - 1];
      if (last && last.msg === l.msg && last.kind === l.kind) { last.n++; continue; }
      rows.push({ ...l, n: 1, isNew: j > si });
    }
    if (!rows.length) return h + `<div class="hint">这里还没有消息。</div>`;
    let day = null;
    h += '<div class="lrows">';
    for (const r of rows) {
      const dd = Math.floor((S.t - r.t) / 86400), dn = dd <= 0 ? '今天' : dd === 1 ? '昨天' : `${dd} 天前`;
      if (dn !== day) { day = dn; h += `</div><div class="lday">${dn}</div><div class="lrows">`; }
      h += `<div class="lrow ${r.kind}${r.isNew ? ' new' : ''}"><span class="lm">${esc(r.msg)}${r.n > 1 ? `<b class="tn">×${r.n}</b>` : ''}</span><small>${ago(S.t - r.t)}</small></div>`;
    }
    return h + '</div>';
  }

  p_camp(part) {
    const S = this.S;
    if (part === 'title') return `营地 <small>${esc(this.camp().name)}</small>`;
    const tab = this.tabOf('camp', PANEL_TABS.camp);
    let h = '';
    if (tab === 'infra') {
      const c0 = this.camp();
      h += this.infraHtml(c0);
      h += `<button class="mlink" data-act="tb" data-arg="stock"><span>📦</span><span>物资总览<small>每种物资进出多少、卡在哪一环</small></span><i>›</i></button>`;
      h += `<button class="mlink" data-act="tb" data-arg="lines"><span>🛷</span><span>运输线<small>营地之间用雪橇或铁路互通物资</small></span><i>›</i></button>`;
      return h;
    }
    if (tab === 'road') {
      h += `<div class="sec">旅程</div><div class="journey">`;
      LANDMARKS.forEach((l, i) => {
        const st = S.founded.includes(i) ? 'done' : S.discovered.includes(i) ? 'seen' : '';
        h += `<div class="jstep ${st}" data-act="${S.discovered.includes(i) ? 'lmgo' : ''}" data-arg="${i}"><span>${st === 'done' ? '🏁' : st === 'seen' ? '📍' : '❔'}</span>${i <= Math.max(S.known, ...S.discovered) || st ? l.n : '？？？'}</div>`;
      });
      h += `</div>`;
      h += `<button class="mlink" data-act="chapter"><span>📖</span><span>北行纪事<small>每到一个地标开启新的一章</small></span><i>›</i></button>`;
      h += `<button class="mlink" data-act="tb" data-arg="log"><span>📜</span><span>消息记录<small>最近发生的事都在这里</small></span><i>›</i></button>`;
      return h;
    }
    for (const c of S.camps) {
      const cr = Sim.rt(S).c[c.id] || {};
      const f = Sim.getB(S, c.furnace);
      h += `<div class="card ${c.id === S.active ? 'on' : ''}" data-act="campgo" data-arg="${c.id}"><div class="ci">🔥</div><div class="cb">
        <div class="cn">${esc(c.name)} <small>熔炉 ${f.lvl} 级 · 纬度 ${Math.round(c.y)}</small></div>
        <div class="cd">👥${c.people}/${cr.housing || 0} · 🌡${Math.round(cr.tH ?? 0)}° · 🍖${fmt(c.stock.food)}（${(cr.foodNet || 0) >= 0 ? '+' : ''}${fmt(cr.foodNet)}/分）· 🔥${cr.burnPerMin ? fmtTime(cr.fuelUnits / cr.burnPerMin * 60) : '—'} · 搬运 ${fmt(cr.haulers)}/${fmt(cr.demand)} · 防御 ${Sim.campDefense(S, c)}</div></div></div>`;
    }
    const c0 = this.camp(), cr0 = Sim.rt(S).c[c0.id] || {};
    h += this.focusHtml(c0);
    h += `<div class="sec">居民 <small>${esc(c0.name)}</small></div>`;
    h += `<div class="folk"><span><b>${c0.people}</b>人</span><span><b>${Math.min(c0.people, cr0.housing || 0)}</b>住帐篷</span><span class="${c0.people > (cr0.housing || 0) ? 'bad' : ''}"><b>${Math.max(0, c0.people - (cr0.housing || 0))}</b>露宿</span>${c0.wait > 0 ? `<span class="bad"><b>${c0.wait}</b>等床位</span>` : ''}<span class="${cr0.sick ? 'bad' : ''}"><b>${cr0.sick || 0}</b>生病</span><span class="${(cr0.hunger || 0) > 0.05 ? 'bad' : ''}"><b>${(cr0.hunger || 0) > 0.05 ? Math.round(cr0.hunger * 100) + '%' : '0'}</b>挨饿</span></div>`;
    h += `<div class="voices">${campVoices(S, c0, Sim.rt(S)).map(q => `<div>「${esc(q)}」</div>`).join('')}</div>`;
    { const nl = LAWS.filter(l => Sim.lawOn(S, l.id)).length; h += `<button class="mlink" data-act="tb" data-arg="mood"><span>🕯️</span><span>人心：希望 ${Math.round(c0.hope ?? 50)} · 不满 ${Math.round(c0.disc ?? 10)}<small>${nl ? `生效中的律令 ${nl} 条` : '还没有签署律令'}，点开看为什么、改律令</small></span><i>›</i></button>`; }
    h += `<div class="hint">在地图上点一个小人，可以看看这个人是谁、在干什么、过得怎么样。</div>`;
    h += `<div class="row"><span>自动派人<br><small>新来的人自动去缺人的建筑（吃饭、取暖优先）。手动减过人的建筑不会被塞人。</small></span><span style="flex:none"><button style="white-space:nowrap" class="small ${c0.auto === false ? '' : 'go'}" data-act="auto" data-arg="${c0.id}">${c0.auto === false ? '已关闭' : '已开启'}</button></span></div>`;
    return h;
  }

  // 营地专精：四个方向的卡片，强一样、弱一样
  focusHtml(c) {
    const S = this.S, f = Sim.getB(S, c.furnace), left = Sim.focusLeft(S, c);
    let h = `<div class="sec">营地专精 <small>${esc(c.name)}</small></div>`;
    if (f.lvl < FOCUS_LVL) return h + `<div class="hint">熔炉升到 ${FOCUS_LVL} 级后，可以给这座营地定一个方向：矿业、农垦、工坊或要塞。</div>`;
    h += `<div class="focus">${FOCUS_KEYS.map(k => { const D = FOCUS[k], on = c.focus === k, why = Sim.focusBlock(S, c, k);
      return `<button class="fcard ${on ? 'on' : ''} ${why && !on ? 'wait' : ''}" ${!on && !why ? `data-act="focus" data-arg="${c.id}:${k}"` : ''}><i class="fch" style="background:${D.col}">${D.ch}</i><span><b>${D.n}${on ? '<em>现在</em>' : ''}</b><small>${D.d}</small><small class="fbad">${D.bad}</small></span></button>`; }).join('')}</div>`;
    h += `<div class="hint">${!c.focus ? '选一个方向：强一样、弱一样。之后每次更换要隔 30 分钟。' : left > 0 ? `换专精还要等 ${Math.ceil(left / 60)} 分钟。` : '想换方向随时可以换，换完 30 分钟内不能再换。'}</div>`;
    return h;
  }
  // 营地基建：道路和蒸汽管道
  infraHtml(c) {
    const S = this.S;
    let h = `<div class="sec">营地基建 <small>${esc(c.name)}</small></div><div class="infra">`;
    for (const k of ['road', 'pipe']) {
      const I = INFRA[k], lv = c[k] || 0, cur = I.lv[lv], nx = I.lv[lv + 1];
      const lock = nx && Object.keys(nx.cost).find(r => RES[r].t > S.known);
      h += `<div class="ifc"><div class="ifh"><span class="ti">${I.ic}</span><div><b>${I.n} <small>${lv}/${I.lv.length - 1} · ${cur.n}</small></b><small>${lv ? cur.d : I.what}</small></div></div><div class="ipips">${I.lv.slice(1).map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>`;
      if (!nx) h += `<div class="ifn">已经修到最好了</div>`;
      else h += `<div class="ifn">下一级「${nx.n}」：${nx.d}</div><div class="ifa"><span class="tcost">${costHtml(c.stock, nx.cost, S.known)}</span>${lock ? `<span class="tlock">要先到「${RES[lock].n}」的纬度</span>` : `<button class="small go" data-act="infra" data-arg="${c.id}:${k}">修建</button>`}</div>`;
      h += `</div>`;
    }
    return h + `</div>`;
  }

  p_mood(part) {
    const S = this.S, c = this.camp(), cr = Sim.rt(S).c[c.id] || {};
    if (part === 'title') return `人心${S.camps.length > 1 ? ` <small>${esc(c.name)}</small>` : ''}`;
    const hp = c.hope ?? 50, dc = c.disc ?? 10, m = cr.mood || Sim.moodFactors(S, c, cr);
    const trend = (v, t) => t > v + 1 ? `<small class="up">▲ 正往 ${Math.round(t)} 涨</small>` : t < v - 1 ? `<small class="dn">▼ 正往 ${Math.round(t)} 落</small>` : '<small>稳住了</small>';
    const pct = x => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100)) + '%';
    const mul = Sim.moodMul(c) - 1;
    let h = `<div class="mood2">
      <div class="mg hope"><div class="mgh"><span>希望</span><b>${Math.round(hp)}</b>${trend(hp, m.hT)}</div><div class="mbar"><i style="width:${hp}%"></i><em style="left:${m.hT}%" title="会慢慢走到这里"></em></div></div>
      <div class="mg disc"><div class="mgh"><span>不满</span><b>${Math.round(dc)}</b>${trend(dc, m.dT)}</div><div class="mbar"><i style="width:${dc}%"></i><em style="left:${m.dT}%"></em><u style="left:${Sim.LEAVE_AT}%" title="超过这里会有人离开"></u></div></div>
    </div>`;
    h += `<div class="mnow"><span>干活效率 <b class="${mul < -0.005 ? 'neg' : ''}">${pct(mul)}</b></span><span>投奔速度 <b>×${(0.7 + 0.6 * hp / 100).toFixed(2)}</b></span>${dc >= Sim.LEAVE_AT ? '<span><b class="neg">有人在离开</b></span>' : ''}</div>`;
    h += `<button class="btn wide ghost cvlink" data-act="curve">📈 看人口、心情和温度的曲线</button>`;
    h += `<div class="hint">希望和不满会慢慢走向箭头标的位置。希望越高干活越卖力、来投奔的人越多；不满超过 60 干活变慢，超过 ${Sim.LEAVE_AT} 会有人趁夜离开。</div>`;
    // 为什么
    const rows = new Map();
    for (const [n, v] of m.hope) rows.set(n, { h: v, d: 0 });
    for (const [n, v] of m.disc) { const r = rows.get(n) || { h: 0, d: 0 }; r.d = v; rows.set(n, r); }
    const sg = (v, bad) => v ? `<b class="${bad ? 'neg' : 'pos'}">${v > 0 ? '+' : '−'}${Math.abs(Math.round(v))}</b>` : '<i>·</i>';
    h += `<div class="sec">为什么</div><div class="mfac"><div class="mfh"><span></span><span>希望</span><span>不满</span></div><div class="mfb"><span>起点</span><span>50</span><span>10</span></div>`;
    for (const [n, r] of rows) h += `<div><span>${esc(n)}</span><span>${sg(r.h, r.h < 0)}</span><span>${sg(r.d, r.d > 0)}</span></div>`;
    h += `</div>`;
    h += this.festCard(c);
    // 律令
    h += `<div class="sec">营地律令 <small>对所有营地生效</small></div><div class="laws">`;
    for (const l of LAWS) {
      const on = Sim.lawOn(S, l.id), wait = Sim.lawWait(S, l.id);
      h += `<div class="law ${on ? 'on' : ''}"><div class="lh"><span class="li">${l.ic}</span><b>${l.n}</b>${on ? '<span class="lon">生效中</span>' : ''}
        <button class="small ${wait > 0 ? '' : on ? '' : 'go'}" data-act="law" data-arg="${l.id}" ${wait > 0 ? 'disabled' : ''}>${wait > 0 ? fmtTime(wait) + ' 后可改' : on ? '废除' : '签署'}</button></div>
        <div class="ld">${l.d}</div><div class="lfx"><span class="g">${l.good}</span><span class="b">${l.bad}</span></div></div>`;
    }
    h += `</div><div class="hint">改过的律令 3 分钟内不能再改；废除律令会让不满 +4。</div>`;
    return h;
  }

  p_research(part) {
    const S = this.S, c = this.camp(), R = Sim.rt(S), T = S.tech || { done: {}, cur: null, prog: 0 };
    if (part === 'title') return `研究 <small>已完成 ${Object.keys(T.done).length}/${TECHS.length}</small>`;
    const shops = S.buildings.filter(b => b.type === 'workshop'), rate = R.rpRate || 0;
    let potential = 0; for (const b of shops) potential += (R.b[b.id] || {}).rp || 0;
    let h = '';
    const ct = T.cur && TECHS.find(t => t.id === T.cur);
    if (ct) {
      const left = ct.pts - T.prog;
      h += `<div class="tcur"><div class="tch"><span class="ti">${ct.ic}</span><div><b>${ct.n}</b><small>${ct.d}</small></div></div>
        <div class="mbar"><i style="width:${Math.min(100, T.prog / ct.pts * 100).toFixed(1)}%"></i></div>
        <div class="tcm"><span>${fmt(T.prog)} / ${ct.pts} 点 · ${rate > 0 ? `还要 ${fmtTime(left / rate * 60)}` : '<b class="neg">停住了：工程站里没人干活</b>'}</span><button class="small" data-act="techstop">停止（退回材料）</button></div></div>`;
    } else h += `<div class="tcur idle"><b>现在没有在研究。</b><small>从下面挑一项开始；开始时先付材料，攒够研究点数就完成。</small></div>`;
    if (!shops.length) h += `<div class="issue warn"><span class="ii">🔬</span><span class="it"><b>还没有工程站</b><small>研究点数由工程站里的工程师产出</small></span><span class="ia"><button class="small go" data-act="place" data-arg="workshop">建工程站</button></span></div>`;
    else h += `<div class="row sub"><span>工程站</span><span>${shops.length} 座 · 每分钟 ${fmt(ct ? rate : potential)} 点${!ct ? '（开始研究后才派人）' : ''}</span></div>`;
    if (T.bank > 0.5) h += `<div class="row sub"><span>📜 探险带回的图纸</span><span>${fmt(T.bank)} 点 · 下一项研究开始时直接算进去</span></div>`;
    // 研究树：每条分支从左往右按前置关系排开，点一个节点在下面展开详情
    const sel = TECHS.find(t => t.id === this.techSel) || ct || TECHS.find(t => Sim.techCheck(S, t.id).ok) || TECHS.find(t => !Sim.techCheck(S, t.id).done) || TECHS[0];
    for (let br = 0; br < TECH_BR.length; br++) {
      const list = TECHS.filter(x => x.br === br), lay = techLayout(list);
      const nDone = list.filter(t => T.done[t.id]).length;
      h += `<div class="sec">${TECH_BR[br]} <small>${nDone}/${list.length}</small></div>`;
      const LH = 86, hgt = lay.lanes * LH, X = n => ((n.col + 0.5) / lay.cols * 100).toFixed(2), Y = n => n.lane * LH + 30;
      let lines = '';
      for (const t of list) for (const r of t.req || []) {
        const a = lay.at[r], b = lay.at[t.id]; if (!a) continue;
        const x1 = +X(a), y1 = Y(a), x2 = +X(b), y2 = Y(b), xm = (x1 + x2) / 2;
        lines += `<path class="${T.done[t.id] ? 'done' : T.done[r] ? 'open' : ''}" d="M${x1} ${y1}C${xm} ${y1} ${xm} ${y2} ${x2} ${y2}"/>`;
      }
      h += `<div class="ttree" style="height:${hgt}px"><svg viewBox="0 0 100 ${hgt}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
      for (const t of list) {
        const n = lay.at[t.id], ck = Sim.techCheck(S, t.id);
        const cls = ck.done ? 'done' : ck.cur ? 'cur' : ck.lock ? 'lock' : ck.ok ? 'ok' : 'soft';
        const pr = ck.cur ? Math.min(1, T.prog / t.pts) : 0;
        h += `<button class="tnode ${cls}${sel === t ? ' sel' : ''}" data-act="techsel" data-arg="${t.id}" style="left:${X(n)}%;top:${Y(n) - 25}px;--p:${pr.toFixed(3)}"><span class="tn0">${t.ic}</span>${ck.done ? '<em class="tbadge">✓</em>' : ck.lock ? '<em class="tbadge lk">🔒</em>' : ''}<span class="tnl">${t.n}</span></button>`;
      }
      h += `</div>`;
      if (sel.br === br) {
        const ck = Sim.techCheck(S, sel.id);
        const act = ck.done ? '<span class="tdone">✓ 已完成</span>' : ck.cur ? '<span class="tdone cur">研究中</span>' : ck.lock ? `<span class="tlock">${esc(ck.reason)}</span>` : `<button class="btn ${ck.ok ? 'go' : ''}" data-act="tech" data-arg="${sel.id}">开始研究</button>`;
        h += `<div class="tdet ${ck.done ? 'done' : ck.lock ? 'lock' : ''}" style="--ax:${X(lay.at[sel.id])}%"><div class="tdh"><span class="ti">${sel.ic}</span><div><b>${sel.n}</b><small>${sel.d}</small></div></div>`;
        if (!ck.done) h += `<div class="tcost">${costHtml(c.stock, sel.cost, S.known)} <span class="cost">🔬${sel.pts}</span></div>`;
        if (!ck.ok && !ck.done && !ck.cur && !ck.lock && ck.reason) h += `<small class="neg">${esc(ck.reason)}</small>`;
        h += `<div class="tda">${act}</div></div>`;
      }
    }
    h += `<div class="hint">研究对所有营地都生效；北迁到下一程时研究会清零。</div>`;
    return h;
  }

  p_scout(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '侦察与救援';
    const sl = Sim.scoutSlots(S, c.id);
    let h = '';
    if (!sl.n) h += `<div class="hint">「${esc(c.name)}」还没有侦察营。在「建造 → 篝火」里建一座。</div>`;
    else {
      h += `<div class="row"><span>侦察队</span><span>${sl.used}/${sl.n} 在外 · 最远 ${Sim.scoutRange(S, c.id)} 格 · 每队 3 人</span></div>`;
      const t = this.g.scoutTarget;
      if (t) {
        const cost = Sim.scoutCost(S, c.id, t.x, t.y);
        const d = Math.hypot(t.x + 0.5 - c.x, t.y + 0.5 - c.y);
        h += `<div class="row"><span>目标</span><span>${Math.round(d)} 格外 · 那里约 ${baseTempOfRow(t.y)}°C</span></div><div class="row"><span>补给</span><span>${costHtml(c.stock, cost)}</span></div>`;
        h += `<button class="btn wide go" data-act="scoutgo">出发</button><button class="btn wide ghost" data-act="scoutcancel">取消</button>`;
      } else h += `<button class="btn wide" data-act="scoutpick">🚩 在地图上点一个目标</button>`;
    }
    if (sl.n) {
      // 勘探新矿脉
      const why = Sim.surveyBlock(S, c), going = S.scouts.some(s => s.camp === c.id && s.kind === 'survey');
      h += `<div class="sec">勘探矿脉</div>`;
      h += `<div class="row"><span>⛏ 在「${esc(c.name)}」供热圈里找埋得深的新矿<br><small>每次找到两处，优先找营地最缺的矿；已勘探 ${c.surveys || 0} 次，越勘越贵</small></span><span style="flex:none">${going ? '勘探队在路上' : `<button class="small ${why ? '' : 'go'}" data-act="survey" data-arg="${c.id}" ${why && !why.startsWith('缺') ? 'disabled' : ''}>出发</button>`}</span></div>`;
      if (!going) h += `<div class="row sub"><span>补给</span><span>${costHtml(c.stock, Sim.surveyCost(S, c))}</span></div>${why && !why.startsWith('缺') ? `<div class="row sub"><span></span><span class="warn">${esc(why)}</span></div>` : ''}`;
    }
    const w = getWorld(S.runSeed);
    const found = Object.keys(S.poiFound).map(id => w.pois.find(p => p.id === +id)).filter(Boolean);
    if (found.length) {
      h += `<div class="sec">待救援的幸存者</div>`;
      for (const p of found) {
        const going = S.scouts.some(s => s.poi === p.id);
        const cost = Sim.scoutCost(S, c.id, p.x, p.y, 'rescue');
        h += `<div class="row"><span>🆘 ${p.n} 人 · ${Math.round(Math.hypot(p.x - c.x, p.y - c.y))} 格外</span><span>${going ? '救援队已出发' : `${costHtml(c.stock, cost)} <button class="small" data-act="rescue" data-arg="${p.id}">派 4 人去救</button>`}</span></div>`;
      }
    }
    const sites = (w.sites || []).filter(p => S.reveal[idx(p.x, p.y)] && Sim.siteState(S, p) !== 'done').sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    if (sites.length) {
      h += `<div class="sec">雾里的地点</div>`;
      for (const p of sites.slice(0, 6)) {
        const st = Sim.siteState(S, p), K = SITES[p.kind];
        h += `<div class="row"><span>${K.ic} ${K.n} · ${Math.round(Math.hypot(p.x - c.x, p.y - c.y))} 格外</span><span>${st === 'seen' ? `<button class="small" data-act="site-open" data-arg="${p.id}">派探险队</button>` : st === 'wait' ? `<button class="small go" data-act="site-decide">等你决定</button>` : '探险队在路上'}</span></div>`;
      }
    }
    if (S.scouts.length) {
      h += `<div class="sec">在外的队伍</div>`;
      for (const s of S.scouts) h += `<div class="row sub"><span>${s.kind === 'rescue' ? '🆘 救援队' : s.kind === 'exp' ? '🧭 探险队' : s.kind === 'survey' ? '⛏ 勘探队' : '🚩 侦察队'} · ${esc(Sim.getCamp(S, s.camp).name)} · ${s.n} 人</span><span>${s.phase === 'wait' ? `<button class="small go" data-act="site-decide">等你决定</button>` : s.phase === 'out' ? '前往目标' : '返程中'} <button class="small" data-act="lookat" data-arg="${s.x},${s.y}">看看</button></span></div>`;
    }
    h += `<div class="hint">侦察队会揭开迷雾、带回遗迹里的物资，还会遇到幸存者和专家。迷雾里还藏着仓库、列车、观测站这样的地点，派探险队去才能搜。越往北越冷，有人可能回不来；升级侦察营能走得更远、更耐寒。</div>`;
    return h;
  }

  p_lines(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '运输线';
    let h = '';
    if (S.camps.length < 2) return `<div class="hint">先用「前哨熔炉」在别处建第二个营地，然后在这里用雪橇队把两个营地的库存连起来。</div>`;
    const others = S.camps.filter(o => o.id !== c.id && !S.lines.some(l => (l.a === c.id && l.b === o.id) || (l.b === c.id && l.a === o.id)));
    for (const o of others) {
      const cost = Sim.lineCost(S, c.id, o.id);
      h += `<div class="row"><span>开通 ${esc(c.name)} ⇄ ${esc(o.name)}</span><span>${costHtml(c.stock, cost)} <button class="small" data-act="addline" data-arg="${o.id}">开通雪橇线</button></span></div>`;
    }
    const resOpts = sel => `<option value="">（空）</option><option value="people" ${sel === 'people' ? 'selected' : ''}>👥 移民</option>` + RES_KEYS.filter(k => RES[k].t <= S.known).map(k => `<option value="${k}" ${sel === k ? 'selected' : ''}>${RICON[k]} ${RES[k].n}</option>`).join('');
    for (const l of S.lines) {
      const a = Sim.getCamp(S, l.a), b = Sim.getCamp(S, l.b);
      const up = { ...Sim.lineUpCost(S, l) }; const toRail = up.rail; delete up.rail;
      const flow = (Sim.rt(S).b['L' + l.id] || {}).flow || 0;
      h += `<div class="linebox"><div class="row"><b>${l.rail ? '🚂 铁路' : '🛷 雪橇线'} ${l.lvl} 级</b><span>${esc(a.name)} ⇄ ${esc(b.name)} · 运力 ${fmt(Sim.lineCap(S, l))}/分 · 实际 ${fmt(flow)}/分</span></div>`;
      for (let i = 0; i < 4; i++) {
        const r = l.routes[i] || {};
        h += `<div class="route"><select data-act="route-res" data-arg="${l.id}:${i}">${resOpts(r.res)}</select>
          <button class="small" data-act="route-dir" data-arg="${l.id}:${i}">${r.from === 'b' ? esc(b.name) + ' → ' + esc(a.name) : esc(a.name) + ' → ' + esc(b.name)}</button>
          ${r.res && r.res !== 'people' ? `<label>留 <input type="number" min="0" step="50" value="${r.keep ?? 50}" data-act="route-keep" data-arg="${l.id}:${i}"></label>` : ''}</div>`;
      }
      h += `<div class="row"><span>${toRail ? '改建铁路' : '升级'}</span><span>${costHtml(a.stock, up, S.known)} <button class="small" data-act="lineup" data-arg="${l.id}">${toRail ? '改建' : '升级'}</button></span></div></div>`;
    }
    h += `<div class="hint">每个营地的库存是分开的。线路按设定把物资从一边运到另一边，“留”表示出发地至少保留多少。升级要花出发营地（左边）的材料；到「油与铁路」层后可以改建铁路。</div>`;
    return h;
  }

  p_specs(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '专家';
    const have = SPECS.filter(s => S.meta.specs[s.id]);
    let h = '';
    if (!have.length) h += `<div class="hint">还没有专家。专家散落在北方，派侦察队去找吧。他们会一直跟着你，北迁时也会一起走。</div>`;
    for (const sp of have) {
      const m = S.meta.specs[sp.id];
      const at = S.specAt[sp.id] && Sim.getB(S, S.specAt[sp.id]);
      const cost = specTrainCost(m.lvl);
      h += `<div class="card"><div class="ci">🧑‍🔧</div><div class="cb"><div class="cn">${sp.n} <small>${sp.role} · ${m.lvl} 级</small></div>
        <div class="cd">${esc(sp.story)}<br>对口：${sp.aff.map(t => BLD[t].n).join('、')}（+${Math.round(specBonus(m.lvl, true) * 100)}%，别处 +${Math.round(specBonus(m.lvl, false) * 100)}%）</div>
        <div class="cc">${at ? `在「${BLD[at.type].n}」(${esc(Sim.getCamp(S, at.camp).name)}) <button class="small" data-act="spot" data-arg="${at.id}">看看</button> <button class="small" data-act="unspec" data-arg="${sp.id}">请走</button>` : `<button class="small" data-act="autospec" data-arg="${sp.id}">安排到对口建筑</button>`}
        · ${m.lvl >= SPEC_MAX ? '已经练到顶了' : `培养 ${costHtml(c.stock, cost, S.known)} <button class="small" data-act="train" data-arg="${sp.id}">培养</button>`}</div></div></div>`;
    }
    const missing = SPECS.filter(s => s.row != null && !S.meta.specs[s.id]).length;
    if (missing) h += `<div class="hint">还有 ${missing} 位专家在北方等着被发现。</div>`;
    if (!S.meta.specs.he) h += `<div class="hint">听说有位老大夫在找落脚的地方：盖一座医务所、派人守着，过一阵 TA 也许会来。</div>`;
    return h;
  }

  // 篝火庆典的卡片：熔炉面板和人心面板里都有
  festCard(c) {
    const S = this.S;
    if (c.fest) return `<div class="festcard on"><div class="fhd"><span class="fci">🔥</span><b>篝火庆典进行中</b><em>还剩 ${fmtTime(c.fest.until - S.t)}</em></div><div class="fcd">大家围着篝火跳舞，干活的人少了一半。散场后希望 +15、不满 −10，之后 ${Sim.FEST_AFTER / 60} 分钟产量 +15%。</div><button class="btn wide" data-act="festgo" data-arg="${c.id}">去看看</button></div>`;
    const why = Sim.festBlock(S, c), cost = Sim.festCost(S, c);
    return `<div class="festcard"><div class="fhd"><span class="fci">🔥</span><b>篝火庆典</b><em>${costHtml(c.stock, cost)}</em></div><div class="fcd">在营地边点起一堆大篝火，让大家放下手里的活跳一场舞（${Sim.FEST_LEN / 60} 分钟，期间产量减半）。散场后希望 +15、不满 −10，之后 ${Sim.FEST_AFTER / 60} 分钟产量 +15%。每 ${Sim.FEST_CD / 60} 分钟能办一场。</div>
      ${why ? `<div class="fcw">${esc(why)}</div>` : ''}<button class="btn wide ${why ? '' : 'go'}" data-act="fest" data-arg="${c.id}" ${why ? 'disabled' : ''}>🎉 办一场庆典</button></div>`;
  }
  // 收集册：建筑、物资、地标、人物、风物五栏，外加成就。跨轮保留
  // ---------- 数据曲线：人口、心情、温度，物资的储量和产量 ----------
  cvState() { return this.cv || (this.cv = { tab: 'camp', range: 'd1', sel: null, cid: null }); }
  cvSelect(k) {
    const st = this.cvState(); this.cvDefault();
    if (st.sel.some(e => e.k === k)) return;
    if (st.sel.length >= CV_COL.length) st.sel.shift();
    const used = st.sel.map(e => e.c); st.sel.push({ k, c: CV_COL.findIndex((_, i) => !used.includes(i)) });
  }
  // 默认看：熟食、木材，再加两种产得最多的
  cvDefault() {
    const st = this.cvState(); if (st.sel) return;
    const c = Sim.getCamp(this.S, st.cid) || this.camp(), fl = (Sim.rt(this.S).c[c.id] || {}).flow || {};
    const ks = ['food', 'wood'].filter(k => RES[k]);
    for (const k of RES_KEYS.filter(k => !ks.includes(k) && fl[k] && fl[k].p > 0).sort((a, b) => fl[b].p * RES[b].t - fl[a].p * RES[a].t)) { if (ks.length >= 4) break; ks.push(k); }
    st.sel = ks.map((k, i) => ({ k, c: i }));
  }
  p_curve(part) {
    const S = this.S, st = this.cvState();
    const c = Sim.getCamp(S, st.cid) || this.camp();
    if (part === 'title') return `数据曲线 <small>${esc(c.name)}</small>`;
    this.cvDefault();
    let h = '';
    if (S.camps.length > 1) h += `<div class="cvchips">${S.camps.map(x => `<button class="chip ${x.id === c.id ? 'on' : ''}" data-act="cvcamp" data-arg="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
    h += `<div class="seg cvseg">${[['camp', '营地'], ['res', '物资']].map(([k, n]) => `<button class="btn ${st.tab === k ? 'on' : ''}" data-act="cvtab" data-arg="${k}">${n}</button>`).join('')}</div>`;
    h += `<div class="cvrange">${[['d1', '最近 1 天'], ['d4', '最近 4 天'], ['all', '整局']].map(([k, n]) => `<button class="${st.range === k ? 'on' : ''}" data-act="cvrange" data-arg="${k}">${n}</button>`).join('')}</div>`;
    const H = c.hist || {};
    let T = st.range === 'all' && H.c && H.c.n >= 2 ? H.c : H.f;
    if (!T || T.n < 2) return h + `<div class="empty">刚开始记录：每 30 秒记一笔，过一两分钟再来看。</div>`;
    const i0 = st.range === 'd1' && T === H.f ? Math.max(0, T.n - Math.round(DAY_LEN / T.dt)) : 0;
    const ts = Array.from({ length: T.n - i0 }, (_, j) => T.t0 + (i0 + j + 0.5) * T.dt);
    const col = k => (T.v[k] ? T.v[k].slice(i0) : ts.map(() => null));
    const w = Math.max(250, Math.min(560, (this.sheet.clientWidth || 380) - 30)), meta = this.cvMeta = {};
    const chart = o => { const r = chartHtml({ w, h: 150, ts, off: H.off, ...o }); meta[o.id] = r.meta; return r.html; };
    const table = (cols) => {
      // 按天看数字：每天天亮那一笔（最多 8 天）
      const rows = []; let lastD = -1;
      for (let i = ts.length - 1; i >= 0 && rows.length < 8; i--) { const d = Math.floor(ts[i] / DAY_LEN); if (d !== lastD) { lastD = d; rows.push(i); } }
      return `<details class="cvtbl"><summary>按天看数字</summary><table><tr><th></th>${cols.map(x => `<th>${esc(x.name)}</th>`).join('')}</tr>${rows.map(i => `<tr><td>${dayLabel(ts[i])}</td>${cols.map(x => `<td>${fmtV(x.vals[i])}${x.unit || ''}</td>`).join('')}</tr>`).join('')}</table></details>`;
    };
    if (st.tab === 'camp') {
      const pop = col('pop'), wait = col('wait'), hope = col('hope'), disc = col('disc'), tin = col('tin'), tout = col('tout');
      const ps = [{ name: '人口', col: CV_COL[0], vals: pop }]; if (wait.some(v => v > 0)) ps.push({ name: '等床位', col: CV_COL[1], vals: wait });
      h += chart({ id: 'pop', title: '人口', sub: wait.some(v => v > 0) ? '住进帐篷的人，和在窝棚里等床位的人' : '住在营地里的人', series: ps, zero: true, area: true });
      h += chart({ id: 'mood', title: '心情', sub: `不满超过 ${Sim.LEAVE_AT} 会有人离开`, series: [{ name: '希望', col: CV_COL[0], vals: hope }, { name: '不满', col: CV_COL[1], vals: disc }], fixed: [0, 100, [0, 50, 100]] });
      h += chart({ id: 'temp', title: '温度', sub: '屋里是帐篷里的体感，室外含暴风雪降温', series: [{ name: '屋里', col: CV_COL[0], vals: tin }, { name: '室外', col: CV_COL[1], vals: tout }], unit: '°' });
      h += table([{ name: '人口', vals: pop }, { name: '希望', vals: hope }, { name: '不满', vals: disc }, { name: '屋里', vals: tin, unit: '°' }]);
    } else {
      const have = RES_KEYS.filter(k => T.v['s:' + k] || T.v['p:' + k]);
      st.sel = st.sel.filter(e => have.includes(e.k) || RES[e.k].t <= S.known);
      h += `<div class="cvres">${have.map(k => { const e = st.sel.find(x => x.k === k); return `<button class="${e ? 'on' : ''}" data-act="cvres" data-arg="${k}" title="${RES[k].n}">${RICON[k]}<span>${RES[k].n}</span>${e ? `<i style="background:${CV_COL[e.c]}"></i>` : ''}</button>`; }).join('')}</div>`;
      if (!st.sel.length) return h + `<div class="empty">点上面的物资，看它的储量和产量变化（最多同时 ${CV_COL.length} 种）。</div>`;
      const sel = st.sel.filter(e => have.includes(e.k));
      const ss = sel.map(e => ({ name: RES[e.k].n, col: CV_COL[e.c], vals: col('s:' + e.k) })), pp = sel.map(e => ({ name: RES[e.k].n, col: CV_COL[e.c], vals: col('p:' + e.k).map(v => v ?? 0) }));
      h += chart({ id: 'stock', title: '库存', sub: `仓库上限 ${fmt((Sim.rt(S).c[c.id] || {}).cap || 0)}`, series: ss, zero: true, area: true });
      h += chart({ id: 'prod', title: '每分钟产量', sub: '这一段时间里平均每分钟产出多少', series: pp, zero: true, area: true });
      h += table(ss);
    }
    if ((H.off || []).length) h += `<div class="hint">浅色那段是离线时间：离线时物资按离开多久打折入库（前 1 小时 40%，到 4 小时 20%，到 12 小时 10%）。</div>`;
    return h;
  }

  p_book(part) {
    const S = this.S;
    if (part === 'title') return '收集册';
    const B = Sim.bookOf(S), N = Sim.bookCount(S), tab = this.bookTab || 'a';
    // 这一栏里新进册的，看过就清掉「新」，但这次打开期间还标着
    const shown = this.bookShown || (this.bookShown = {});
    const fr = B.fresh.filter(f => f.startsWith(tab + ':')).map(f => f.slice(2));
    if (fr.length) { (shown[tab] ||= new Set()); fr.forEach(x => shown[tab].add(x)); Sim.bookSeen(S, tab); }
    const isNew = id => shown[tab] && shown[tab].has(id) ? '<i class="bknew">新</i>' : '';
    const TABS = [['a', '🏆 成就'], ['b', '建筑'], ['r', '物资'], ['l', '地标'], ['p', '人物'], ['s', '风物']];
    let h = `<div class="bkhead"><div class="bkt"><b>${N.got}</b><small>/${N.all}</small> 收集<span>·</span><b>${N.cats.a[0]}</b><small>/${N.cats.a[1]}</small> 成就</div><div class="bkbar"><i style="width:${(N.got / N.all * 100).toFixed(1)}%"></i></div><div class="bksub">北迁后也会保留。达成成就有余烬。</div></div>`;
    h += '<div class="tabs bktabs" data-sx="bktabs">' + TABS.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''} ${k !== tab && B.fresh.some(f => f.startsWith(k + ':')) ? 'hasnew' : ''}" data-act="booktab" data-arg="${k}">${n}<small>${N.cats[k][0]}/${N.cats[k][1]}</small></button>`).join('') + '</div>';
    const pick = this.bookPick && this.bookPick.startsWith(tab + ':') ? this.bookPick.slice(2) : null;
    if (tab === 'a') {
      const list = Sim.ACH.map(a => ({ a, done: B.a[a.id], cur: Math.min(a.need, a.cur(S, B) || 0) }));
      list.sort((x, y) => (!!y.done - !!x.done) || (y.cur / y.a.need - x.cur / x.a.need));
      for (const { a, done, cur } of list) {
        h += `<div class="bkach ${done ? 'on' : ''}"><span class="bai">${done ? '🏆' : '🔒'}</span><span class="bab"><b>${a.n}${isNew(a.id)}</b><small>${a.d}</small>
          ${done ? `<em>第 ${done} 次北行达成</em>` : a.need > 1 ? `<i class="bap"><i style="width:${(cur / a.need * 100).toFixed(0)}%"></i></i><em>${a.id === 'nodeath' ? `${fmtTime(cur * 60)} / 3 小时` : `${cur} / ${a.need}`}</em>` : ''}</span><span class="barw">🔥${a.rw}</span></div>`;
      }
      return h;
    }
    const cell = (id, have, pic, name, sub) => `<button class="bkc ${have ? '' : 'off'} ${pick === id ? 'pk' : ''}" data-act="bookpick" data-arg="${tab}:${id}"><span class="bkp">${pic}</span><b>${have ? name : '？？？'}</b><small>${sub}</small>${have ? isNew(id) : ''}</button>`;
    const card = (have, ic, name, sub, desc, id) => `<div class="bkcard ${have ? '' : 'off'}"><span class="bki">${ic}</span><span class="bkb"><b>${have ? name : '？？？'}${have ? isNew(id) : ''}</b><small>${sub}</small>${desc ? `<p>${esc(desc)}</p>` : ''}</span></div>`;
    let detail = '';
    if (tab === 'b') {
      if (pick && BLD[pick]) { const d = BLD[pick], have = B.b[pick]; detail = `<div class="bkdet"><span class="bkp">${this.ico(pick, pick === 'furnace' ? 2 : 1)}</span><span><b>${have ? d.n : '？？？'}</b><small>${TIER_NAMES[d.t]} · ${have ? `第 ${have} 次北行收入` : '还没建过'}</small><p>${have ? esc(d.desc) : `到「${TIER_NAMES[d.t]}」一带解锁后建一座就能收进来。`}</p></span></div>`; }
      h += detail + '<div class="bkgrid">';
      for (let t = 1; t <= 7; t++) for (const k of BLD_KEYS.filter(k => BLD[k].t === t)) h += cell(k, B.b[k], this.ico(k, k === 'furnace' ? 2 : 1), BLD[k].n, TIER_NAMES[t]);
      return h + '</div>';
    }
    if (tab === 'r') {
      if (pick && RES[pick]) { const d = RES[pick], have = B.r[pick]; detail = `<div class="bkdet"><span class="bkp big">${RICON[pick]}</span><span><b>${have ? d.n : '？？？'}</b><small>${TIER_NAMES[d.t]} · ${d.raw ? '从地里采' : '要加工'}</small><p>${have ? `第 ${have} 次北行第一次拿到。这一程累计产出 ${fmt(S.stats.prod[pick] || 0)}。` : `「${TIER_NAMES[d.t]}」一带的物资。`}</p></span></div>`; }
      h += detail + '<div class="bkgrid res">';
      for (const k of RES_KEYS) h += cell(k, B.r[k], RICON[k], RES[k].n, TIER_NAMES[RES[k].t]);
      return h + '</div>';
    }
    if (tab === 'l') {
      LANDMARKS.forEach((l, i) => { const id = 'L' + i; h += card(B.l[id], '🚩', l.n, `纬度 ${l.row}${B.l[id] ? ` · 第 ${B.l[id]} 次北行到达` : ''}`, B.l[id] ? l.desc : '', id); });
      FAR_MARKS.forEach((f, i) => { const id = 'F' + i; h += card(B.l[id], '🗿', f.n, `远方 · 纬度 ${f.row}${B.l[id] ? ` · 遗物「${f.relic.n}」` : ''}`, B.l[id] ? f.desc : '', id); });
      return h;
    }
    if (tab === 'p') {
      for (const sp of SPECS) h += card(B.p[sp.id], '🧑‍🔧', sp.n, `${sp.role}${B.p[sp.id] ? '' : sp.row == null ? ' · 盖好医务所后会来投奔' : ` · 纬度 ${sp.row} 一带`}`, B.p[sp.id] ? sp.story : '', sp.id);
      return h;
    }
    if (tab === 's') {
      for (const x of Sim.SIGHTS) h += card(B.s[x.id], x.ic, x.n, B.s[x.id] ? `第 ${B.s[x.id]} 次北行见到` : `线索：${x.how}`, B.s[x.id] ? x.d : '', x.id);
      return h;
    }
    return h;
  }

  p_migrate(part) {
    const S = this.S;
    if (part === 'title') return '北迁与余烬';
    const gain = Sim.emberGain(S);
    let h = `<div class="story">${esc(STORY.migrate)}</div>`;
    h += `<div class="row"><span>手上的余烬</span><b>🔥 ${S.meta.embers}</b></div>`;
    h += `<div class="row"><span>现在北迁能带走</span><b>+${gain}</b></div>`;
    h += `<div class="row sub"><span></span><span>来自：每座熔炉的等级、本轮新到达的地标、总产量${S.t < 1800 ? '（本轮不满 30 分钟，没有余烬）' : ''}</span></div>`;
    h += `<div class="sec">从哪里出发</div><div class="sites">`;
    for (const i of S.meta.sites) h += `<button class="site ${this.site === i ? 'on' : ''}" data-act="site" data-arg="${i}">${LANDMARKS[i].n}<small>${i === 0 ? '最暖' : '纬度 ' + LANDMARKS[i].row}</small></button>`;
    h += `</div><div class="hint">越往北起点越冷、越难，但离永恒之炉越近。建筑、物资和解锁都会重置；余烬强化和专家会保留。</div>`;
    h += `<button class="btn wide go" data-act="migrate">向北出发</button>`;
    h += `<div class="sec">余烬强化（永久）</div>`;
    for (const k in EMBER_UPS) {
      const u = EMBER_UPS[k], lv = Sim.up(S, k), cost = emberCost(k, lv);
      h += `<div class="row"><span><b>${u.n}</b> ${lv}/${u.max}<br><small>${u.d}</small></span><span>${lv >= u.max ? '已满' : `<button class="small ${S.meta.embers >= cost ? 'go' : ''}" data-act="ember" data-arg="${k}">🔥${cost}</button>`}</span></div>`;
    }
    return h;
  }

  p_menu(part) {
    const S = this.S;
    if (part === 'title') return '菜单';
    const g = this.g, st = S.stats;
    // 旅程卡：第几次北行、这一程走到哪了、一路上的数字
    const top = LANDMARKS[LANDMARKS.length - 1].row, far = Math.round(Math.max(...S.camps.map(c => c.y)));
    const known = Math.max(S.known, ...S.discovered);
    const next = LANDMARKS.findIndex((l, i) => !S.founded.includes(i) && l.row > far);
    const people = S.camps.reduce((a, c) => a + c.people, 0);
    let h = `<div class="mjour">
      <div class="mjh"><div><div class="mjt">第 ${S.meta.runs} 次北行</div><small>这一程走了 ${fmtTime(S.t)}${S.meta.graduated ? ' · 🌟 已点燃永恒之炉' : ''}</small></div>
        <div class="mje" title="余烬：北迁时带到下一程的永久加成"><b>🔥${fmt(S.meta.embers)}</b><small>余烬</small></div></div>
      <div class="route"><i class="rl"><i style="width:${Math.min(100, far / top * 100).toFixed(1)}%"></i></i>
        ${LANDMARKS.map((l, i) => { const cls = S.founded.includes(i) ? 'on' : S.discovered.includes(i) ? 'seen' : ''; return `<span class="rn ${cls} ${i === next ? 'next' : ''} ${i % 2 ? 'up' : ''}" style="left:${(l.row / top * 100).toFixed(1)}%"><em></em><small>${i <= known || cls ? l.n : '？'}</small></span>`; }).join('')}</div>
      <div class="mnext">${next >= 0 ? `下一站：<b>${LANDMARKS[next].n}</b>（纬度 ${LANDMARKS[next].row}，现在最北到 ${far}）` : '所有地标都走到了。'}</div>
      <div class="mstats">
        <span><b>${people}</b>人口</span><span><b>${S.camps.length}</b>座营地</span><span><b>${S.buildings.length}</b>栋建筑</span>
        <span><b>${st.arrivals}</b>人投奔</span><span class="${st.deaths ? 'neg' : ''}"><b>${st.deaths}</b>人遇难</span><span><b>${st.raidsWon}/${st.raids}</b>守住袭营</span>
      </div>
    </div>`;
    { const N = Sim.bookCount(S), nf = Sim.bookOf(S).fresh.length;
      h += `<button class="mlink book" data-act="book"><span>🏆</span><span>收集册${nf ? `<b class="mnew">${nf} 新</b>` : ''}<small>收集 ${N.got}/${N.all} · 成就 ${N.cats.a[0]}/${N.cats.a[1]}（北迁后也保留）</small></span><i>›</i></button>`; }
    h += `<button class="mlink" data-act="curve"><span>📈</span><span>数据曲线<small>人口、心情、温度，物资的储量和产量怎么变的</small></span><i>›</i></button>`;
    h += `<button class="mlink" data-act="photo"><span>📷</span><span>拍照模式<small>藏起界面，换时辰、滤镜和镜头角度，拍一张营地的照片（H）</small></span><i>›</i></button>`;
    h += `<button class="mlink" data-act="help"><span>📖</span><span>怎么玩<small>建筑、生产线、寒冷和北行的规则</small></span><i>›</i></button>`;
    // 声音与画面
    const tg = (k, on, ic, n, d) => `<button class="tgl ${on ? 'on' : ''}" data-act="snd" data-arg="${k}"><span class="ti">${ic}</span><span class="tt">${n}<small>${d}</small></span><i class="sw"></i></button>`;
    h += `<div class="sec">声音与画面</div><div class="tgls">${tg('sfx', g.audio.sfxOn, '🔊', '音效', '风声、炉火、敲打')}${tg('music', g.audio.musicOn, '🎵', '音乐', '低沉的旋律和铃声')}<button class="tgl ${this.floatOn !== false ? 'on' : ''}" data-act="floats"><span class="ti">✨</span><span class="tt">产出飘字<small>建筑上方冒出「+5 🪵」</small></span><i class="sw"></i></button><button class="tgl ${S.meta.hintOff ? '' : 'on'}" data-act="hintsw"><span class="ti">📜</span><span class="tt">新玩法提示<small>某样玩法第一次用得上时说一句</small></span><i class="sw"></i></button></div>`;
    h += `<div class="mlab">画质<small>卡顿时会自动降一档</small></div>`;
    h += `<div class="seg">${[['low', '流畅', '无阴影'], ['high', '标准', '推荐'], ['ultra', '极致', '细节更多']].map(([k, n, d]) => `<button class="btn ${g.quality === k ? 'on' : ''}" data-act="quality" data-arg="${k}">${n}<small>${d}</small></button>`).join('')}</div>`;
    // 存档
    const ago = S.savedAt ? Math.max(0, (Date.now() - S.savedAt) / 1000) : null;
    h += `<div class="sec">存档</div>
      <div class="msave"><span class="msi">💾</span><span>自动保存在这台设备上${ago != null ? `<em>${ago < 60 ? '刚刚' : ago < 3600 ? Math.floor(ago / 60) + ' 分钟前' : ago < 86400 ? Math.floor(ago / 3600) + ' 小时前' : Math.floor(ago / 86400) + ' 天前'}存过</em>` : ''}<small>关掉页面后营地照常运转，暴风雪和袭营也照常结算；但离线时物资按离开多久打折入库：前 1 小时 40%，1 到 4 小时 20%，4 到 12 小时 10%，超过 12 小时不再算；三星产线多拿一半，离线入库最多填到仓库的八成。</small></span></div>
      <div class="row2"><button class="btn" data-act="export">📤 导出存档码</button><button class="btn" data-act="import">📥 导入存档码</button></div>
      <div class="hint">换设备时，在旧设备导出存档码，到新设备上导入。</div>
      <div class="row"><span>存档位 <b>${g.slot}</b> / ${SLOTS}<br><small>三个存档位，各是一局</small></span><span style="flex:none"><button class="small" data-act="slots">换存档位</button></span></div>
      <div class="row"><span>难度 <b>${Sim.diffOf(S).ic}${Sim.diffOf(S).n}</b><br><small>随时可以改</small></span><span style="flex:none"><button class="small" data-act="diff">改难度</button></span></div>
      <div class="mdanger"><button class="btn ghost" data-act="wipe">删除这个存档，从头开始</button></div>
      <div class="mfoot">寒烬北行 · 第十一版</div>`;
    return h;
  }

  p_spot(part) {
    const S = this.S, i = this.panel.arg, w = getWorld(S.runSeed);
    const k = SPOT_KEYS[w.spot[i]], sp = SPOTS[k];
    if (part === 'title') return `${RICON[sp.res]} ${sp.n}`;
    const left = Sim.spotLeft(S, i), mx = Sim.spotMax(S, i), grow = !!Sim.REGROW[k];
    let g = '';
    if (grow) {
      const rate = Sim.regrowRate(S, i, Sim.tendedSpots(S)), tend = rate > Sim.REGROW[k] * 1.5, sap = Sim.isSapling(S, i);
      g = `<div class="row sub"><span>恢复</span><span>${left >= mx ? '长满了' : `+${fmt(rate)}/分${tend ? (k === 'tree' ? ' · 伐木场在补种' : ' · 猎人在留种') : ''}`}</span></div>`;
      if (sap) g += `<div class="row sub"><span>${k === 'tree' ? '树苗' : '幼崽'}</span><span>长到三成（${fmt(mx * Sim.SAP_RIPE)}）才能${k === 'tree' ? '砍' : '打'}，大约 ${Math.max(1, Math.ceil((mx * Sim.SAP_RIPE - left) / Math.max(0.01, rate)))} 分钟</span></div>`;
    }
    return `<div class="row"><span>剩余储量</span><span>${fmt(left)} / ${fmt(mx)} ${RES[sp.res].n}</span></div><div class="bar"><i style="width:${(left / mx * 100).toFixed(1)}%"></i></div>${g}
      <div class="hint">${grow ? (k === 'tree' ? '树砍光了会长回来。附近有伐木场会补种，长得快四倍。' : '猎物打光了会回来。附近有猎人小屋会留种，回来得快三倍。') : '矿藏采完就没有了，到时候得去更远的地方。'}在附近（${BLD[Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(k))].reach} 格内）建「${BLD[Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(k))].n}」来采集。</div>`;
  }

  p_chapter(part) {
    const S = this.S, chs = Sim.chapters(S);
    if (part === 'title') return `北行纪事 <small>第 ${chs.length}/${CHAPTERS.length} 章</small>`;
    let h = '';
    chs.slice().reverse().forEach((c, n) => {
      const open = n === 0 || (c.done && !c.got) || this.panel.arg === c.i;
      const nOk = c.tasks.filter(t => t.ok).length;
      if (!open) { h += `<div class="chrow" data-act="chapter" data-arg="${c.i}"><b>${esc(c.ch.n)}</b><span>${c.got ? '✓ 已完成' : `${nOk}/3`}</span></div>`; return; }
      h += `<div class="chcard ${c.got ? 'got' : c.done ? 'ready' : ''}"><div class="chh"><small>📍 ${esc(LANDMARKS[c.i].n)}</small><b>${esc(c.ch.n)}</b></div><p class="story">${esc(c.got ? c.ch.end : c.ch.story)}</p><div class="ctasks">`;
      for (const t of c.tasks) {
        const pr = t.low ? (t.ok ? 1 : Math.max(0, Math.min(1, (100 - t.cur) / (100 - t.n)))) : Math.min(1, t.cur / t.n);
        h += `<div class="ctask ${t.ok ? 'ok' : ''}"><span class="ck">${t.ok ? '✓' : ''}</span><div><span>${esc(t.t)}</span>${t.ok ? '' : `<div class="mbar"><i style="width:${(pr * 100).toFixed(1)}%"></i></div><small>${t.low ? `现在最高 ${fmt(t.cur)}` : `${fmt(t.cur)} / ${fmt(t.n)}`}</small>`}</div></div>`;
      }
      h += `</div><div class="crw">🎁 ${esc(Sim.chapterReward(S, c.i).join('，'))}</div>`;
      if (c.got) h += `<div class="cgot">✓ 奖励已领取</div>`;
      else if (c.done) h += `<button class="btn wide go" data-act="chapclaim" data-arg="${c.i}">领取奖励（发到「${esc(this.camp().name)}」）</button>`;
      h += `</div>`;
    });
    const nx = LANDMARKS.findIndex((l, i) => i > Math.max(...S.founded));
    if (nx > 0) h += `<div class="chrow next"><b>${esc(CHAPTERS[nx].n)}</b><span>在「${esc(LANDMARKS[nx].n)}」建起熔炉后开始</span></div>`;
    h += `<div class="hint">每到一个新地标就开始新的一章。任务一旦做到就算完成；北迁到下一程时章节会重新开始。</div>`;
    return h;
  }

  p_site(part) {
    const S = this.S, c = this.camp(), p = (getWorld(S.runSeed).sites || []).find(q => q.id === this.panel.arg);
    if (!p) return '';
    const K = SITES[p.kind];
    if (part === 'title') return `${K.ic} ${K.n}`;
    const st = Sim.siteState(S, p), d = Math.hypot(p.x + 0.5 - c.x, p.y + 0.5 - c.y);
    let h = `<div class="story">${esc(K.desc)}</div>`;
    h += `<div class="row"><span>位置</span><span>离「${esc(c.name)}」${Math.round(d)} 格 · 那里约 ${baseTempOfRow(p.y)}°C</span></div>`;
    const prev = Sim.siteView(S, { poi: p.id, sup: 'full' });
    const optList = `<div class="sopts">${prev.opts.map(o => `<div><b>${o.need ? '⛺ ' : ''}${esc(o.t)}</b><small>${esc(o.d)}</small></div>`).join('')}</div>`;
    if (st === 'done') return h + `<div class="row"><span>状态</span><span>已经探索过了</span></div>`;
    if (st === 'wait') return h + `<div class="row"><span>状态</span><span>探险队到了，在等你决定</span></div><button class="btn wide go" data-act="site-decide">去决定</button>`;
    if (st === 'going' || st === 'back') return h + `<div class="row"><span>状态</span><span>${st === 'going' ? '探险队正在路上' : '探险队在回来的路上'}</span></div>`;
    h += `<div class="sec">到了以后可以</div>${optList}`;
    const sl = Sim.scoutSlots(S, c.id), range = Sim.scoutRange(S, c.id) + 10;
    if (!sl.n) h += `<div class="issue warn"><span class="ii">🧭</span><span class="it"><b>「${esc(c.name)}」还没有侦察营</b><small>探险队从侦察营出发</small></span><span class="ia"><button class="small go" data-act="place" data-arg="scout">建侦察营</button></span></div>`;
    else if (d > range) h += `<div class="issue warn"><span class="ii">📏</span><span class="it"><b>太远了</b><small>从「${esc(c.name)}」最远能走 ${range} 格；升级侦察营，或者从更近的营地出发</small></span></div>`;
    else {
      h += `<div class="sec">派 4 人的探险队</div><div class="sups">`;
      for (const [sup, t, dsc] of [['light', '轻装', '补给少，路上更容易有人冻伤失踪'], ['full', '带足补给', '几乎不会出事，到了能做带 ⛺ 的选择']]) {
        const cost = Sim.expCost(S, c.id, p, sup), r = Sim.expRisk(S, c.id, p, sup);
        h += `<div class="sup"><b>${sup === 'full' ? '⛺ ' : '🎒 '}${t}</b><small>${dsc}</small><div class="tcost">${costHtml(c.stock, cost)}</div><small class="${r > 0.2 ? 'neg' : ''}">${r < 0.01 ? '路上几乎不会出事' : `约 ${Math.round(r * 100)}% 会少一个人`}</small><button class="small ${sup === 'full' ? 'go' : ''}" data-act="exp-go" data-arg="${p.id}:${sup}">出发</button></div>`;
      }
      h += `</div><div class="row sub"><span>侦察队名额</span><span>${sl.used}/${sl.n} 在外</span></div>`;
    }
    h += `<div class="hint">探险队到了以后会停下来等你决定怎么做，带回来的东西进出发营地的仓库。</div>`;
    return h;
  }

  p_landmark(part) {
    const S = this.S, i = this.panel.arg, l = LANDMARKS[i];
    if (part === 'title') return `📍 ${l.n}`;
    let h = `<div class="story">${esc(l.desc)}</div>`;
    h += `<div class="row"><span>状态</span><span>${S.founded.includes(i) ? '已在旁边点起熔炉（以后可以从这里出发）' : '在 14 格内建一座前哨熔炉就算抵达'}</span></div>`;
    { const ch = Sim.chapters(S).find(x => x.i === i); h += `<button class="mlink" data-act="chapter" data-arg="${i}"><span>📖</span><span>${esc(CHAPTERS[i].n)}<small>${ch ? (ch.got ? '这一章已经完成' : `任务 ${ch.tasks.filter(t => t.ok).length}/3${ch.done ? ' · 可以领奖励了' : ''}`) : '在这里建起熔炉后开始这一章'}</small></span><i>›</i></button>`; }
    if (i === 6) {
      const ec = Sim.eternalCamp(S);
      const st = S.eternal.stage;
      h += `<div class="sec">重新点燃永恒之炉</div>`;
      for (let k = 0; k < ETERNAL_STAGES.length; k++) h += `<div class="row"><span>第 ${k + 1} 层炉膛</span><span>${k < st ? '✅ 已点亮' : k === st ? `${S.eternal.have}/${ETERNAL_STAGES[k]} 🌟` : `需要 ${ETERNAL_STAGES[k]} 🌟`}</span></div>`;
      if (st < ETERNAL_STAGES.length) h += ec ? `<button class="btn wide go" data-act="eternal">投入永恒炉件（「${esc(ec.name)}」有 ${fmt(ec.stock.heart || 0)} 个）</button>` : `<div class="hint">先在旁边建一座前哨熔炉。</div>`;
      else h += `<div class="story">${esc(STORY.ending)}</div>`;
    }
    return h;
  }

  // ---------- 点击 ----------
  onClick(e) {
    const tst = e.target.closest('.toast'); if (tst) this.dropToast(tst);
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, arg = el.dataset.arg;
    if (!act) return;
    const S = this.S, g = this.g;
    const res = r => { if (r && r.ok === false && r.reason) this.toast(r.reason, 'warn'); return r; };
    switch (act) {
      case 'close': this.close(); break;
      case 'resall': this.resDrawer(); break;
      case 'bigmap': g.bigmap.toggle(); break;
      case 'chainmap': g.chainmap.toggle(); break;
      case 'plan': g.cancelModes(); this.close(); g.chainmap.plan(arg || null); break;
      case 'advisor': this.advisorGo(); break;
      case 'pause': g.togglePause(); break;
      case 'qup': Sim.toggleQueueUp(S, +arg); this.renderPanel(true); break;
      case 'unqueue': Sim.unqueue(S, +arg); this.close(); this.toast('已取消排队。', 'info'); break;
      case 'od': { const c = this.panelCamp(), r = Sim.setOverdrive(S, c.id, arg === '1'); if (!r.ok) this.toast(r.reason, 'warn'); else if (arg === '1') { g.sfx && g.sfx('build'); this.toast('熔炉超载了：燃料烧两倍，热量大涨。盯着炉温，别烧过头。', 'info'); } this.renderPanel(true); break; }
      case 'odauto': { const c = this.panelCamp(); Sim.setOdAuto(S, c.id, c.odAuto === false); this.renderPanel(true); break; }
      case 'wx': g.cancelModes(); this.open('weather'); break;
      case 'car': g.cancelModes(); if (S.car) this.open('caravan'); else this.toast('商队已经走了。', 'info'); break;
      case 'deliver': { const r = Sim.deliverOrder(S, +arg); if (r.ok) { g.sfx('up'); this.toast(`成交！换来 ${r.got}。`, 'good'); } else this.toast(r.reason, 'warn'); this.renderPanel(true); break; }
      case 'carauto': Sim.setCarAuto(S, S.carAuto === false); this.renderPanel(true); break;
      case 'raidp': g.cancelModes(); this.open('raid'); break;
      case 'far': g.cancelModes(); this.open('far', +arg); break;
      case 'farmap': { const p = (getWorld(S.runSeed).far || [])[+arg]; if (p) { this.close(); g.view.focus(p.x + 0.5, p.y + 0.5); } break; }
      case 'prep': { const r = Sim.doPrep(S, arg); if (r.ok) { g.sfx(arg === 'fire' ? 'build' : 'tap'); this.toast({ fire: '火墙点起来了，营地外围一圈火光。', mil: '民兵拿起家伙上了墙头。', hide: '大家把物资往地窖里搬。' }[arg], 'good'); } else this.toast(r.reason, 'warn'); this.renderPanel(true); break; }
      case 'rauto': Sim.setRaidAuto(S, S.rAuto === false); this.renderPanel(true); break;
      case 'speed': g.setSpeed(g.nextSpeed()); break;
      case 'ptab': (this.tabs || (this.tabs = {}))[this.panel.kind] = arg; this.renderPanel(true); this.sheet.scrollTop = 0; break;
      case 'camptab': (this.tabs || (this.tabs = {})).camp = arg; g.cancelModes(); this.open('camp'); break;
      case 'logf': this.logF = arg; this.renderPanel(true); this.sheet.scrollTop = 0; break;
      case 'close-modal': this.closeModal(); break;
      case 'tb': if (this.panel && this.panel.kind === arg) this.close(); else { g.cancelModes(); this.open(arg); } break;
      case 'techsel': this.techSel = arg; this.renderPanel(true); break;
      case 'tech': { const r = Sim.startTech(S, arg); if (!r.ok && r.reason) this.toast(r.reason, 'warn'); this.renderPanel(true); break; }
      case 'techstop': Sim.cancelTech(S); this.renderPanel(true); break;
      case 'law': { const r = Sim.toggleLaw(S, arg); if (!r.ok && r.reason) this.toast(r.reason, 'warn'); this.renderPanel(true); break; }
      case 'btier': this.markBuildSeen(); this.buildTier = +arg; this.lastHtml = ''; this.renderPanel(true); { const cs = this.sheet.querySelector('.cards'); if (cs) cs.scrollLeft = 0; } break;
      case 'place': this.seenB()[arg] = 1; this.close(); g.startPlace(arg); break;
      case 'w-': { const b = Sim.getB(S, +arg); Sim.setWorkers(S, b.id, b.workers - 1); break; }
      case 'w+': { const b = Sim.getB(S, +arg); Sim.setWorkers(S, b.id, b.workers + 1); break; }
      case 'wmax': { const b = Sim.getB(S, +arg); Sim.setWorkers(S, b.id, 99); break; }
      case 'curve': { const st = this.cvState(); st.cid = this.camp().id; if (arg) { st.tab = 'res'; this.cvSelect(arg); } this.g.cancelModes(); this.open('curve'); break; }
      case 'photo': this.g.photo.open(); break;
      case 'focus': { const [cid, k] = arg.split(':'), c = Sim.getCamp(S, +cid), D = FOCUS[k];
        this.modal(`<h3><i class="fch" style="background:${D.col}">${D.ch}</i> ${c.focus ? '改成' : '定为'}${D.n}营地？</h3><p>${D.d}</p><p class="nrwarn">代价：${D.bad}。</p><p class="hint">定下来以后 30 分钟内不能再换。</p>`, [{ t: '就这么定', a: 'focus-yes', arg, cls: 'go' }, { t: '再想想', a: 'close-modal' }]); break; }
      case 'focus-yes': { const [cid, k] = arg.split(':'), r = Sim.setFocus(S, +cid, k); this.closeModal(); if (!r.ok) this.toast(r.reason, 'warn'); else g.sfx('win'); this.renderPanel(true); break; }
      case 'cvtab': this.cvState().tab = arg; this.renderPanel(true); break;
      case 'cvrange': this.cvState().range = arg; this.renderPanel(true); break;
      case 'cvcamp': this.cvState().cid = +arg; this.renderPanel(true); break;
      case 'cvres': { const st = this.cvState(); this.cvDefault(); const i = st.sel.findIndex(e => e.k === arg); if (i >= 0) st.sel.splice(i, 1); else { if (st.sel.length >= CV_COL.length) this.toast(`最多同时看 ${CV_COL.length} 种，先去掉了最早选的「${RES[st.sel[0].k].n}」。`, 'info'); this.cvSelect(arg); } this.renderPanel(true); break; }
      case 'bulkw': {
        const b = Sim.getB(S, +arg); if (!b) break;
        const r = Sim.bulkStaff(S, b.id), n = BLD[b.type].n;
        if (r.add) g.sfx('tap');
        this.toast(r.short ? `${r.add ? `给 ${r.n} 栋${n}添了 ${r.add} 个人，` : ''}还差 ${r.short} 人：空闲人手不够了，多建帐篷吸引新人，或在别的建筑减人。` : `${r.n} 栋${n}都派满了${r.add ? `（添了 ${r.add} 人）` : ''}。`, r.short ? 'warn' : 'good');
        this.renderPanel(true); break;
      }
      case 'bulkup': {
        const b = Sim.getB(S, +arg); if (!b) break;
        const r = Sim.bulkUpgrade(S, b.id), n = BLD[b.type].n;
        if (r.up) g.sfx('up');
        const msg = [r.up && `${r.up} 栋${n}各升了一级`, r.q && `${r.q} 栋材料不够，已排队（材料到齐自动升）`, r.locked && `${r.locked} 栋要用还没解锁的材料`].filter(Boolean).join('，');
        this.toast((msg || '没有能升的') + '。', r.up ? 'good' : r.q ? 'info' : 'warn');
        this.renderPanel(true); break;
      }
      case 'upgrade': if (res(Sim.upgrade(S, +arg)).ok) { g.sfx('up'); } break;
      case 'demolish': this.modal(`<p>确定拆除这座建筑？返还一半基础材料。</p>`, [{ t: '拆除', a: 'demolish-yes', arg, cls: 'bad' }, { t: '算了', a: 'close-modal' }]); break;
      case 'demolish-yes': Sim.demolish(S, +arg); this.closeModal(); this.close(); break;
      case 'unspec': Sim.assignSpec(S, arg, null); break;
      case 'autospec': {
        const sp = SPECS.find(s => s.id === arg);
        const b = S.buildings.filter(b => sp.aff.includes(b.type) && !Sim.specIn(S, b.id)).sort((a, b) => (b.camp === S.active) - (a.camp === S.active) || b.lvl - a.lvl)[0];
        if (b) { Sim.assignSpec(S, arg, b.id); this.toast(`${sp.n} 去了「${BLD[b.type].n}」。`, 'good'); } else this.toast(`没有空着的对口建筑（${sp.aff.map(t => BLD[t].n).join('、')}）。`, 'warn');
        break;
      }
      case 'train': res(Sim.trainSpec(S, arg)); break;
      case 'spot': { const b = Sim.getB(S, +arg); if (b) { g.view.focus(b.x + 1, b.y + 1); this.open('bld', b.id); g.view.select(b.id); } break; }
      case 'campgo': { S.active = +arg; const c = this.camp(); g.view.focus(c.x, c.y); break; }
      case 'campBtn': if (S.camps.length > 1) { const i = S.camps.findIndex(c => c.id === S.active); S.active = S.camps[(i + 1) % S.camps.length].id; const c = this.camp(); g.view.focus(c.x, c.y); this.toast(`切换到「${c.name}」`); } else this.open('camp'); break;
      case 'lmgo': { const l = LANDMARKS[+arg]; g.view.focus(l.x, l.row); this.open('landmark', +arg); break; }
      case 'auto': { const c = Sim.getCamp(S, +arg); c.auto = c.auto === false; break; }
      case 'ev': { const msg = Sim.resolveEvent(S, +arg); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } break; }
      case 'openbld': { const id = +arg; g.view.select(id); this.open('bld', id); break; }
      case 'tutskip': S.meta.tut = true; this.tutorial(); this.toast('已跳过新手引导。「菜单 → 怎么玩」里能看到玩法说明。', 'info'); break;
      case 'survey': { const r = Sim.startSurvey(S, +arg); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast(`勘探队出发了，去找${SPOTS[r.kind].n}。`, 'good'); g.sfx && g.sfx('tap'); } break; }
      case 'req': this.open('req', +arg); break;
      case 'reqok': { const r = Sim.claimReq(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else this.toast('谢谢你！' + (r.rw.embers ? ` 余烬 +${r.rw.embers}` : ''), 'good'); break; }
      case 'reqno': Sim.dropReq(S, +arg); break;
      case 'aurora': this.surAurora(); break;
      case 'fest': { const r = Sim.startFest(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else { this.close(); this.act_festgo(+arg); } break; }
      case 'festgo': this.close(); this.act_festgo(+arg); break;
      case 'gang': g.cancelModes(); this.open('gang', +arg); break;
      case 'ganggo': { const [id, how] = arg.split(':'); const r = Sim.gangAnswer(S, +id, how); if (!r.ok) this.toast(r.reason, 'warn'); else g.sfx(how === 'fight' ? 'horn' : 'up'); this.renderPanel(true); this.hud(); break; }
      case 'gangmap': { const gg = Sim.gangOf(S, +arg); if (gg) { this.close(); g.view.focus(gg.x + 0.5, gg.y + 0.5); } break; }
      case 'wxprep': { const r = Sim.wxePrep(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else g.sfx('build'); this.renderPanel(true); this.hud(); break; }
      case 'book': this.bookShown = {}; if (arg) this.bookTab = arg; this.bookPick = null; this.open('book'); break;
      case 'booktab': this.bookTab = arg; this.bookPick = null; this.renderPanel(true); this.sheet.scrollTop = 0; break;
      case 'bookpick': this.bookPick = this.bookPick === arg ? null : arg; this.renderPanel(true); break;
      case 'surgo': { const u = S.sur; if (!u) { this.toast('已经不见了', 'warn'); break; } if (S.active !== u.camp) S.active = u.camp; g.view.focus(u.x + 0.5, u.y + 0.5); break; }
      case 'sur': this.surClaim(); break;
      case 'reqgo': { const b = Sim.getB(S, +arg); if (b) { const s = BLD[b.type].size; g.view.focus(b.x + s / 2, b.y + s / 2); g.view.select(b.id); this.open('bld', b.id); } break; }
      case 'belt': { const [x, y, k] = arg.split(':'); const r = Sim.addBelt(S, +x, +y, k); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast('传送带接上了。', 'good'); g.sfx('build'); } break; }
      case 'beltup': { const r = Sim.upBelt(S, +arg); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast('换成蒸汽轨道了。', 'good'); g.sfx('build'); } break; }
      case 'beltrm': { Sim.removeBelt(S, +arg); this.toast('传送带拆了，退回一半材料。'); break; }
      case 'deep': { const r = Sim.digDeep(S, +arg); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast('深井挖好了：采空后还能按三成五的产量一直挖。', 'good'); g.view.syncBuildings && g.view.syncBuildings(); } break; }
      case 'keep': { const c = Sim.getCamp(S, +arg); c.keep = c.keep === false; this.toast(c.keep ? '加工留料已开启：加工厂会给建造留两成原料。' : '加工留料已关闭：加工厂会把原料全部用掉。', 'info'); break; }
      case 'trade': { const c = Sim.getCamp(S, +arg); c.trade = !c.trade; this.toast(c.trade ? '满仓自动兑换已开启：多出来的物资会换成最缺的东西。' : '满仓自动兑换已关闭。', 'info'); break; }
      case 'scoutpick': g.startScoutPick(); break;
      case 'scoutgo': { const t = g.scoutTarget; if (t && res(Sim.sendScout(S, S.active, t.x, t.y)).ok) { g.scoutTarget = null; this.toast('侦察队出发了。', 'good'); } break; }
      case 'scoutcancel': g.scoutTarget = null; g.mode = null; break;
      case 'siteopt': { const [sid, i] = String(arg).split(':').map(Number); const msg = Sim.resolveSite(S, sid, i); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } if (this.panel && this.panel.kind === 'site') this.close(); break; }
      case 'site-decide': this.siteModal(); break;
      case 'title-go': g.leaveTitle(); break;
      case 'hintsw': S.meta.hintOff = !S.meta.hintOff; if (S.meta.hintOff) g.hints.hide(); this.renderPanel(true); break;
      case 'floats': this.floatOn = this.floatOn === false; try { localStorage.setItem('hanjin-beixing-v1-floats', this.floatOn ? '1' : '0'); } catch (e) {} this.renderPanel(true); break;
      case 'title-new': this.newRunModal(); break;
      case 'slots': this.slotsModal(); break;
      case 'slotuse': g.useSlot(+arg); break;
      case 'slotdel': { const s = g.slotInfo(+arg); this.modal(`<p>删除存档 ${arg} 里的「${esc(s.name || '')}」？这一局的所有进度（包括余烬、专家和收集册）都会消失。</p>`, [{ t: '删除', a: 'slotdel-yes', arg, cls: 'bad' }, { t: '算了', a: 'slots' }]); break; }
      case 'slotdel-yes': g.deleteSlot(+arg); this.slotsModal(); this.toast(`存档 ${arg} 已删除。`, 'info'); break;
      case 'newrun': this.newRunModal(+arg); break;
      case 'nrslot': this.newRunModal(+arg); break;
      case 'nrdiff': this.newRunModal(this.nr.slot, arg); break;
      case 'newrun-go': { const { slot, diff } = this.nr; if (slot === g.slot) g.wipe(diff); else g.useSlot(slot, diff); break; }
      case 'diff': this.diffModal(); break;
      case 'diffset': { S.meta.diff = arg; this.diffModal(); this.toast(`难度改成「${DIFF[arg].n}」。`, 'info'); this.renderPanel(true); break; }
      case 'infra': { const [cid, k] = String(arg).split(':'); if (res(Sim.upgradeInfra(S, +cid, k)).ok) { g.sfx('build'); } this.renderPanel(true); break; }
      case 'chapter': this.g.cancelModes && this.g.cancelModes(); this.open('chapter', arg != null ? +arg : undefined); break;
      case 'chapclaim': { const msg = Sim.claimChapter(S, +arg); if (msg) { this.toast('🎁 ' + msg, 'story'); g.sfx('win'); } this.renderPanel(true); break; }
      case 'site-open': { const p = (getWorld(S.runSeed).sites || []).find(q => q.id === +arg); if (p) { g.view.focus(p.x + 0.5, p.y + 0.5); this.open('site', p.id); } break; }
      case 'exp-go': { const [sid, sup] = String(arg).split(':'); if (res(Sim.sendExpedition(S, S.active, +sid, sup)).ok) { this.toast('探险队出发了。', 'good'); g.sfx('tap'); } break; }
      case 'rescue': { const p = getWorld(S.runSeed).pois.find(p => p.id === +arg); if (res(Sim.sendScout(S, S.active, p.x, p.y, 'rescue', p.id)).ok) this.toast('救援队出发了。', 'good'); break; }
      case 'lookat': { const [x, y] = arg.split(',').map(Number); g.view.focus(x, y); break; }
      case 'addline': res(Sim.addLine(S, S.active, +arg)); break;
      case 'lineup': res(Sim.upgradeLine(S, +arg)); break;
      case 'route-dir': {
        const [lid, i] = arg.split(':').map(Number); const l = S.lines.find(x => x.id === lid);
        const r = l.routes[i] || (l.routes[i] = { res: '', from: 'a' }); r.from = r.from === 'b' ? 'a' : 'b'; break;
      }
      case 'site': this.site = +arg; this.renderPanel(true); break;
      case 'migrate': {
        const site = this.site ?? Math.max(...S.meta.sites);
        this.modal(`<p>${esc(STORY.migrate)}</p><p>带走 <b>🔥${Sim.emberGain(S)}</b> 点余烬，从「${LANDMARKS[site].n}」重新出发。当前营地的建筑和物资都会留在原地。</p>`, [{ t: '出发', a: 'migrate-yes', arg: site, cls: 'go' }, { t: '再等等', a: 'close-modal' }]);
        break;
      }
      case 'migrate-yes': this.closeModal(); this.close(); g.migrate(+arg); break;
      case 'ember': res(Sim.buyEmber(S, arg)); break;
      case 'eternal': res(Sim.deliverEternal(S)); break;
      case 'help': this.modal(HELP); break;
      case 'export': g.exportCode(); break;
      case 'import': this.modal(`<p>粘贴存档码：</p><textarea id="importBox" rows="5"></textarea>`, [{ t: '导入', a: 'import-yes', cls: 'go' }, { t: '取消', a: 'close-modal' }]); break;
      case 'import-yes': g.importCode(document.getElementById('importBox').value); break;
      case 'copy': { const t = document.getElementById('exportBox'); t.select(); const manual = () => { try { document.execCommand('copy'); } catch (e) {} this.toast('已选中，如未复制请长按手动复制', 'warn'); }; try { navigator.clipboard.writeText(t.value).then(() => this.toast('已复制', 'good'), manual); } catch (e) { manual(); } break; }
      case 'snd': g.audio.unlock(); g.audio.toggle(arg); this.renderPanel(true); break;
      case 'quality': g.setQuality(arg); this.renderPanel(true); break;
      case 'wipe': this.newRunModal(g.slot); break;
      case 'wipe-yes': g.wipe(); break;
      case 'start': this.closeModal(); break;
      case 'placeok': g.confirmPlace(); break;
      case 'placeno': g.cancelModes(); break;
      case 'ending': this.closeModal(); break;
    }
    this.renderPanel(true);
    this.hud();
  }
  onChange(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const S = this.S, act = el.dataset.act, arg = el.dataset.arg;
    if (act === 'fuel') { Sim.getCamp(S, +arg).fuelPref = el.value; }
    if (act === 'spec') { if (el.value) Sim.assignSpec(S, el.value, +arg); }
    if (act === 'route-res' || act === 'route-keep') {
      const [lid, i] = arg.split(':').map(Number); const l = S.lines.find(x => x.id === lid);
      const r = l.routes[i] || (l.routes[i] = { res: '', from: 'a' });
      if (act === 'route-res') r.res = el.value; else r.keep = Math.max(0, +el.value || 0);
      l.routes = l.routes.map(x => x || { res: '', from: 'a' });
    }
    this.renderPanel(true);
  }
}

// 新手引导：给出下一步建议
export function nextGoal(S) {
  const has = t => S.buildings.some(b => b.type === t);
  const c0 = S.camps[0];
  const steps = [
    [() => !has('lumber'), '建一座伐木场（白圈里要有针叶林）'],
    [() => !has('tent'), '建帐篷，让大家住进屋里保暖'],
    [() => !has('hunter'), '在猎物出没的地方旁建猎人小屋'],
    [() => !has('kitchen'), '建厨房，把生肉做成熟食'],
    [() => !has('sawmill'), '建锯木厂，做升级要用的木板'],
    [() => Sim.getB(S, c0.furnace).lvl < 2, '点熔炉，把它升到 2 级（供热圈会变大）'],
    [() => !has('warehouse'), '在生产区中间建仓库，搬运工从这里出发'],
    [() => !has('tower'), '建一两座箭塔，防备雪狼'],
    [() => !has('scout'), '建侦察营，准备往北探路'],
  ];
  if (S.site === 0 && Sim.journeyOf(S).stage === 0) for (const [cond, txt] of steps) if (cond()) return txt;
  const J = Sim.journeyOf(S);
  if (J.trip) return J.trip.phase === 'arrive' ? `车队到了「${Sim.stopOf(S, J.trip.to).n}」：放下新熔炉` : `车队在路上，往「${Sim.stopOf(S, J.trip.to).n}」去（${Math.round(J.trip.d / J.trip.len * 100)}%）`;
  // 这一章的产能目标
  const g = Sim.rateGoals(S).find(x => !x.eternal) || Sim.rateGoals(S)[0];
  if (g) {
    const r = Sim.prodRate(S, g.r), h = Sim.holdOf(S, g.id), fr = v => v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    if (r >= g.n - 1e-9) return `${RES[g.r].n} ${fr(r)}/${g.n} 每分钟 · 稳住 ${Math.floor(h.p / 60)}:${String(Math.floor(h.p % 60)).padStart(2, '0')}/3:00`;
    return `${RES[g.r].n}产量 ${fr(r)}/${g.n} 每分钟${g.eternal ? `（第 ${S.eternal.stage + 1}/3 层）` : ''}`;
  }
  // 这一章别的任务
  const chs = Sim.chapters(S), cur = chs.find(c => c.i === J.stage);
  if (cur) { const t = cur.tasks.find(x => !x.ok); if (t) return t.t + (t.n > 1 && !t.low ? `（${typeof t.cur === 'number' ? Math.min(t.cur, t.n) : t.cur}/${t.n}）` : ''); }
  // 北迁门槛
  const gt = Sim.departGate(S);
  if (gt) { const m = gt.items.find(i => !i.ok); return m ? `北迁准备 ${gt.n}/4：${m.t}` : `北迁准备好了：往「${gt.next.n}」出发`; }
  return '';
}

export const HELP = `<h3>怎么玩</h3>
<p><b>目标：</b>一程一程往北走，最终重新点燃传说中的永恒之炉。</p>
<p><b>熔炉</b>是营地的心脏。只有熔炉周围橙色圈里（供热区）能盖房子。升级熔炉让圈变大、营地更暖。熔炉要一直烧燃料：木材，之后是煤、焦煤块、晶体电池。</p>
<p><b>采集与加工：</b>采集建筑要建在资源点旁边（白圈范围内），矿藏会被采光；树林和猎场砍光了会长回来，伐木场、猎人小屋附近的长得快好几倍；附近没树了就建「育林场」自己种。加工建筑把原料做成更高级的材料；锯木厂、炼钢厂默认会给建造留一些木材和铁锭（「物资」面板里可以关）。相邻的上下游建筑会互相加成。</p>
<p><b>小人：</b>每座建筑要派工人；仓库里的人是搬运工，他们在仓库/熔炉和建筑之间来回搬货。离仓库越远，越费搬运工——把仓库建在生产区中间。</p>
<p><b>升级门槛：</b>建筑每升 5 级，就要用下一层的材料。下一层的原料只在更北的地方有，所以要不断往北走。</p>
<p><b>往北：</b>建侦察营，派侦察队揭开迷雾，找资源、幸存者、专家和地标。在远处建「前哨熔炉」开新营地，用运输线把营地连起来。在地标旁点起熔炉，就能在以后从那里出发。</p>
<p><b>人心：</b>每个营地有「希望」和「不满」。吃不饱、太冷、有人死去会让人失望；住得好、有进展会让人振奋。希望高干活更快、来投奔的人更多；不满太高会有人离开。在「人心」面板里签署营地律令，每条都有好处也有代价。</p>
<p><b>研究：</b>建工程站，派工程师攒研究点数，解锁三条分支的 17 项改良。探险带回的图纸可以直接抵研究点数。</p>
<p><b>探索：</b>迷雾里藏着废弃仓库、冻住的列车、观测站这样的地点。侦察队揭开后，从侦察营派 4 人的探险队去；带足补给更安全，到了还能做更多选择。</p>
<p><b>章节：</b>每到一个新地标就开始新的一章，有自己的故事和三个任务，做完可以领奖励。点左上角的目标栏查看。</p>
<p><b>营地基建：</b>在「营地」面板修路（搬运更快）和蒸汽管道（供热圈更大、更暖）。</p>
<p><b>危险：</b>暴风雪提前一小时就有预报（点顶上的 ❄ 看撑不撑得住），记得囤燃料和熟食，熔炉还能超载顶一阵；雪狼和掠夺者会来袭，多建箭塔；侦察兵会提前 15 分钟发现它们，可以点火墙、召集民兵。人可能会冻死饿死，但营地永远不会全灭。</p>
<p><b>生产链：</b>按 C 看整条生产链哪里卡住，按 G 看数据曲线。加工建筑挨着上下游时可以接传送带（之后升级成蒸汽轨道），直接供料、少用搬运工。矿快挖空时可以打深井，侦察营也能勘探新矿脉。</p>
<p><b>营地生活：</b>人多了以后可以在熔炉面板办篝火庆典；路灯、旗杆、雕像、花窖这些装饰能加希望；有人生病就建医务所。营地里的人偶尔会托你办点事（委托），做完有谢礼。熔炉到 5 级可以给营地选专精。犬舍养的雪橇犬让侦察队和运输线跑得更快。</p>
<p><b>天气与掠夺者：</b>除了暴风雪，还有冰风暴（暖炉和管道会冻住）、极寒夜（多烧燃料）、冰湖开裂（绕路），都会提前预报，点顶上的天气图标花点材料准备。北边有掠夺者营地，侦察到以后它们会来索贡：交贡、做买卖，或者靠箭塔顶回去，打退两次他们就走了。</p>
<p><b>收集册：</b>建过的建筑、见过的物资和风物、达成的成就都记在收集册里（K），成就给余烬，北迁后也保留。</p>
<p><b>北迁：</b>卡住时可以“北迁”：带上余烬（永久强化）和专家，从已到达的地标重新开始。</p>
<p><b>操作：</b>拖动地图平移，双指缩放/旋转（电脑：滚轮缩放，右键或 Q/E 旋转）。建造时拖动预览，到合适位置再点 ✓；电脑上按住左键拖一下能一次摆一排，手机上先点「一排」。同类建筑的面板里能一键全升级、全派满。H 是拍照模式，M 是北行地图。菜单里有三个存档位，难度随时可以改。</p>`;
