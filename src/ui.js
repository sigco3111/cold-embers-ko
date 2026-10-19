// 界面：顶部状态、资源条、底部工具栏、面板、提示
import { BRIEF, RES, RES_KEYS, BLD, BLD_KEYS, CATS, TIER_NAMES, LANDMARKS, FAR_MARKS, SPECS, SPEC_MAX, EMBER_UPS, emberCost, specTrainCost, specBonus, FUEL, furnaceRadius, furnaceHeat, furnaceBurn, baseTempOfRow, tierOfRow, ETERNAL_STAGES, GATE, GATE_EVERY, STORY, SPOTS, SPOT_KEYS, dayCycle, LAWS, TECHS, TECH_BR, SITES, CHAPTERS, INFRA, RAIDERS, DAY_LEN, DIFF, DIFF_KEYS, SLOTS, FOCUS, FOCUS_KEYS, FOCUS_LVL, NORTH_RULES, TOWER_FX, TITLES, FLAMES, FLAGS, FRAMES, NDECO, ALT_SWITCH, CAMP_SPEC, CSPEC_FX, CSPEC_FX2, BOT, BOT_MODELS, CMDS, QY, FORK, FORK_BONUS, WONDERS, WONDER_KEYS, WONDER_PH, TOWN } from './data.js';
import * as Sim from './sim.js';
import { personOf, personState, campVoices } from './people.js';
import { getWorld, idx, W, H } from './worldgen.js';
import { iconize, ico, has12 } from './icons.js';
import { chartHtml, chartHover, chartLeave, CV_COL, fmtV, dayLabel } from './curves.js';
import { drawFlag, drawFrame } from './cosmetic.js';
import { albumList, AlbumView, ALBUM_MAX } from './album.js';
import { VERSION_NAME, changelogHtml } from './changelog.js';
import { BK_WHY } from './backup.js';
import { THEMES } from './theme.js';
import { ZOOMS } from './pc.js';

export const ICON = {
  furnace: '🔥', tent: '⛺', lumber: '🪓', nursery: '🌲', quarry: '⛏️', hunter: '🏹', sawmill: '🪚', kitchen: '🍲', warehouse: '📦', tower: '🗼', scout: '🚩', sledshed: '🛷', kennel: '🐕', workshop: '🔬', lamp: '🏮', flagpole: '🚩', infirmary: '🩺', statue: '🗽', flowerhouse: '🌷',
  coalmine: '⚫', ironmine: '🟤', smelter: '🏭', coker: '🧱', limequarry: '⬜', steelworks: '🏗️', gearworks: '⚙️', engineworks: '🚂', greenhouse: '🌱', heater: '♨️',
  shalepit: '🛢️', refinery: '⚗️', sealworks: '🔩', crystalmine: '💎', batteryworks: '🔋', alloyworks: '🧪', salvage: '🛸', partworks: '🧩', coreworks: '🤖', bay: '🦾', excavator: '🔶', forge: '⚒️',
  beacon: '🔦', colossus: '🧌', starpit: '🔮', guildpost: '🏪', gbench: '🪑', glamp: '🏮', gsled: '🛷', gbell: '🔔', ggate: '⛩️', gfount: '⛲', wolfrug: '🐺', wcolossus: '🗿', wvault: '🧊', wbeacon: '🗼', waurora: '🌌', wterminal: '🚉', wstarforge: '✨',
};
export const RICON = {
  wood: '🪵', stone: '🪨', game: '🥩', plank: '🟫', food: '🍖', coal: '⚫', ore: '🟤', iron: '🔘', coke: '◼️', lime: '⬜', steel: '🔷', gear: '⚙️', engine: '🚂',
  shale: '🛢️', tar: '🖤', seal: '🔩', crystal: '💎', battery: '🔋', alloy: '🧪', star: '🌠', part: '🧩', core: '🤖', shard: '🔶', heart: '🌟', starcore: '🔮', people: '👥',
};
const BUFF_TXT = b => ({ prod: `产量 ${b.v > 0 ? '+' : ''}${Math.round(b.v * 100)}%`, fuel: `燃料消耗 ${b.v > 0 ? '+' : ''}${Math.round(b.v * 100)}%`, heat: `体感 +${b.v}°`, shield: `暴风雪降温 −${Math.round(b.v * 100)}%`, def: `防御 +${Math.round(b.v * 100)}%` })[b.k] || '';
const TUT = [
  { b: 'lumber', why: '伐木场要挨着树林，预览框上会写能采到几处资源点。木材是燃料，也是建材。' },
  { b: 'tent', why: '帐篷提供床位和保温，有空床才会有人来投奔。' },
  { b: 'hunter', why: '猎人小屋放在有驯鹿的猎场旁边，打回生肉。' },
  { b: 'kitchen', why: '厨房把生肉做成熟食，大家靠它活着。' },
  { k: 'stock', why: '底部的「生产」里是物资总览：每种物资有多少、进出多少、卡在哪一环都写着。' },
  { k: 'furnace', why: '点任何建筑都能看到它的状态、派人和升级。熔炉是营地的心脏，升级后供热圈会变大。' },
  { k: 'goal', why: '顶上是这一章的目标，三个任务做完能领奖励。「木板产量 6/分钟」这种任务，点旁边的「规划」，会算出还差几座建筑、几个人。底下那一行小条是老向导，一次说一句下一步做什么，点他的头像看全文。' },
];
// 建筑状态 → 头顶小图标；严重的状态用红色
const RES_BY_NAME = Object.fromEntries(Object.entries(RES).map(([k, r]) => [r.n, k]));
const STATUS_BAD = st => st.startsWith('缺') || st.includes('采空') || st === '没有派人' || st === '没人干活';
const STATUS_ICON = st => st.startsWith('缺') ? (RICON[RES_BY_NAME[st.slice(1)]] || '!') : st.includes('采空') ? '⛏' : st === '没有派人' || st === '没人干活' || st === '人手不足' ? '👷' : st === '搬运工不够' ? '🛷' : st.startsWith('太冷') ? '❄' : st.startsWith('等') ? '🌱' : st === Sim.KEEP_WHY ? '🔒' : st === Sim.FUEL_KEEP_WHY ? '🔥' : st === Sim.DEEP_WHY ? '⛏' : '!';

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
// 游戏分钟：90 → 1 小时 30 分
export const fmtMin = m => { m = Math.max(1, Math.round(m)); return m >= 60 ? `${Math.floor(m / 60)} 小时${m % 60 ? ` ${m % 60} 分钟` : ''}` : `${m} 分钟`; };
// 北境的位置和最远纪录：「北境第 N 站 · 最远 M 站」（还没进北境时只说最远）
export function northRec(S) { const N = Sim.northN(Sim.journeyOf(S).stage), M = Math.max(N, S.meta.northMax || 0); return N ? `北境第 ${N} 站 · 最远 ${M} 站` : M ? `北境最远走到第 ${M} 站` : ''; }
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
// 研究树的一列（一条分支）：按纬度、再按前置的深度从上往下排；每条分支是两条链，左链的连线走左边，右链走右边
function techLayout(list) {
  const by = Object.fromEntries(list.map(t => [t.id, t])), depth = {}, side = {};
  const dep = t => depth[t.id] ?? (depth[t.id] = (t.req || []).filter(r => by[r]).reduce((m, r) => Math.max(m, dep(by[r]) + 1), 0));
  list.forEach(dep);
  let roots = 0;
  for (const t of list) {
    const p = (t.req || []).find(r => by[r]);
    if (!p) { side[t.id] = roots++ % 2; continue; }
    const first = list.find(x => (x.req || []).includes(p));
    side[t.id] = first === t ? side[p] : 1 - side[p];
  }
  const ord = [...list].sort((a, b) => a.t - b.t || depth[a.id] - depth[b.id] || list.indexOf(a) - list.indexOf(b));
  const at = {}; ord.forEach((t, i) => { at[t.id] = { row: i, side: side[t.id] }; });
  return { at, rows: ord.length };
}
// 底部五个分区（加上菜单、提醒）：每个分区几张页签，一张页签就是一种面板；def 是第一次打开时停在哪张
const HUBS = {
  camp: { n: '营地', tabs: [['camp', '概况'], ['folk', '人手'], ['mood', '人心'], ['law', '律令']] },
  prod: { n: '生产', tabs: [['stock', '物资'], ['plines', '产线'], ['lines', '物流'], ['guild', '商会']] },
  build: { n: '建造', tabs: [['build', '建筑'], ['bqueue', '队列'], ['plan', '规划'], ['wonder', '奇观']] },
  research: { n: '研究', tabs: [['research', '研究']] },
  north: { n: '北行', def: 'migrate', tabs: [['scout', '地图与侦察'], ['migrate', '北迁'], ['towers', '烽火塔'], ['specs', '专家与余烬']] },
  menu: { n: '菜单', tabs: [['menu', '设置'], ['msave', '存档'], ['mcoll', '收藏'], ['mhelp', '帮助']] },
  bell: { n: '提醒', tabs: [['alerts', '提醒'], ['log', '消息']] },
};
const KIND_HUB = {}; for (const h in HUBS) for (const [k] of HUBS[h].tabs) KIND_HUB[k] = h;
// 一行消息：小灯的颜色和没带符号时配的图标
const TK_LAMP = { good: 'g', warn: 'y', bad: 'r' }, TK_IC = { info: 'point', good: 'check', warn: 'warn', bad: 'warn', story: 'scroll' };
// 老向导每种话配的图标（c- 开头的是界面图标，别的是 i- 小图标）
const GD_IC = { food: 'c-vt_food', fuel: 'c-vt_fuel', cold: 'c-vt_temp', raid: 'wolf', road: 'sled', trip: 'flag', ore: 'pick', haul: 'crate', hold: 'hourglass', line: 'factory', pop: 'c-vt_people', land: 'map', go: 'sled', route: 'compass', flvl: 'fire', car: 'sled', next: 'compass', alt: 'flask', netjam: 'road', netnone: 'crate', netwait: 'sled', depot: 'tent' };
// 老向导的小勋章（章节开场、提醒里）
const GMED = '<span class="gmd"><svg class="gpf" aria-hidden="true"><use href="#c-spec_guide"/></svg></span>';
const gdIc = (k, cls) => { const n = GD_IC[k] || 'point'; return n.startsWith('c-') ? ico('c', n.slice(2), cls) : ico('i', n, cls); };
// 新玩法提示「去看看」落在哪个底部入口：那个入口上亮一个暖色小点，点进去就灭
const HINT_HUB = { build: 'build', camp: 'camp', migrate: 'north', stock: 'prod', mood: 'camp', netview: 'prod', chainmap: 'prod' };
// 顶栏四格的线条图标
const VT_IC = {
  tmp: '<path d="M10 14.5V5a2 2 0 014 0v9.5a4 4 0 11-4 0z"/><path d="M12 9v7"/>',
  ppl: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-4 3.4-6.5 7-6.5s6.4 2.5 7 6.5"/>',
  fuel: '<path d="M12 3c.8 4 6 5.5 6 11.5a6 6 0 01-12 0c0-3 1.8-4.3 2.3-6.5 1.4 1.2 2 2.6 2 4.2C11.6 10 12.6 7 12 3z"/>',
  food: '<path d="M4 11h16a8 8 0 01-16 0z"/><path d="M9.5 7.5c0-1.5 1-2 1-3.5M14 7.5c0-1.5 1-2 1-3.5"/>',
};
const VT_N = { tmp: '温度', ppl: '人口', fuel: '燃料', food: '熟食' };

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
    // 顶栏四格：搭一次，之后只改里面的字
    // 1.2：温度格带一支温度计，燃料格带一块小表盘
    this.$('vitals').innerHTML = ['tmp', 'ppl', 'fuel', 'food'].map(k => `<button class="vt hpl ${k}" data-act="vt" data-arg="${k}" aria-label="${VT_N[k]}"><svg class="hic vic" aria-hidden="true"><use href="#c-vt_${{ tmp: 'temp', ppl: 'people', fuel: 'fuel', food: 'food' }[k]}"/></svg>${k === 'tmp' ? '<span class="thermo"><i></i></span>' : k === 'fuel' ? '<span class="gauge"><i></i></span>' : ''}<span class="vtx"><span class="vv"><svg class="svg" viewBox="0 0 24 24" aria-hidden="true">${VT_IC[k]}</svg><b></b></span><span class="vl"></span></span>${k === 'fuel' ? '<span class="vf"><i></i></span>' : ''}</button>`).join('');
    this.vt = Object.fromEntries(['tmp', 'ppl', 'fuel', 'food'].map(k => { const e = this.$('vitals').querySelector('.vt.' + k); return [k, { e, b: e.querySelector('b'), l: e.querySelector('.vl'), f: e.querySelector('.vf i') }]; }));
    // 老向导的小条每 1.2 秒可能重画，用 pointerdown 接点击；卡开着时点别处就收起
    this.$('note').addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-n]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      this.guideTap(b.dataset.n);
    });
    window.addEventListener('pointerdown', e => { if (this.gOpen && !e.target.closest('#note')) { this.gOpen = false; this.guideCard(); } }, true);
    // 速度键：点一下换倍速，按住半秒暂停
    { const sb = this.$('speedBtn'); let t = null;
      const clear = () => { clearTimeout(t); t = null; sb.classList.remove('hold'); };
      sb.addEventListener('pointerdown', () => { this.speedLong = false; sb.classList.add('hold'); t = setTimeout(() => { t = null; sb.classList.remove('hold'); this.speedLong = true; this.g.togglePause(true); this.toast('已暂停。点速度键或画面中间的条继续。', 'info'); }, 550); });
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) sb.addEventListener(ev, clear);
      sb.addEventListener('contextmenu', e => e.preventDefault()); }
    // 顶栏多高：提示、侧边键、暂停条都贴着它下沿
    if (window.ResizeObserver) new ResizeObserver(() => this.topSync()).observe(this.$('top'));
    else setTimeout(() => this.topSync(), 300);
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
  // 建筑图标：1.2 起用新画的图（各级同一张），没有新图才用 3D 缩略图，再没有用旧 emoji
  pic(type, lvl = 1) {
    if (has12('b', type)) return `<i class="th i2b">${ico('b', type)}</i>`;
    const c = this.thumb(type, lvl); return c ? `<i class="th ${c}"></i>` : iconize(ICON[type] || '');
  }
  ico(type, lvl = 1) { return this.pic(type, lvl); }
  rIco(t) { return has12('r', t.id) ? ico('r', t.id) : t.ic; }        // 研究
  cIco(k, fb) { return has12('c', k) ? ico('c', k) : fb; }           // 指令、律令、专精、城镇、专家……
  qyIco(id, fb) { return this.cIco('qy_' + id, fb); }                // 奇遇
  fIco(k, D) { return has12('c', 'focus_' + k) ? `<i class="fch f2">${ico('c', 'focus_' + k)}</i>` : `<i class="fch" style="background:${D.col}">${D.ch}</i>`; } // 专精
  get S() { return this.g.S; }
  camp() { return Sim.getCamp(this.S, this.S.active) || this.S.camps[0]; }

  // ---------- 提示 ----------
  // 消息：目标条下面一行一条（手机 2 条、电脑 3 条），一模一样的合并成 ×N；左边一盏小灯（绿是好事、黄是注意、红是坏事），
  // 太长的省略，4–9 秒后收起；全部记在铃铛的消息里，点一下打开
  toast(msg, type = 'info', action) {
    const box = this.$('toasts'), max = document.body.classList.contains('pc') ? 3 : 2;
    const life = { info: 4200, good: 5000, warn: 6500, bad: 7500, story: 9000 }[type] || 5000;
    const key = type + '|' + msg;
    let d = [...box.children].find(x => x.dataset.k === key && !x.classList.contains('out'));
    if (d) {
      const n = (+d.dataset.n || 1) + 1; d.dataset.n = n;
      const tn = d.querySelector('.tn'); tn.textContent = '×' + n; tn.style.display = '';
    } else {
      // 开头的符号挪到小灯后面当图标，没有就按种类配一个
      const m = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u.exec(msg), mi = m && iconize(m[1]);
      const ic = mi && mi.includes('<svg') ? mi : ico('i', TK_IC[type] || 'point'), txt = m ? msg.slice(m[0].length) : msg;
      d = document.createElement('div');
      d.className = 'tk ' + type; d.dataset.k = key; d.dataset.act = 'tb'; d.dataset.arg = 'log'; d.title = msg;
      d.innerHTML = `<i class="u-lamp ${TK_LAMP[type] || 'w'}"></i>${ic}<span class="tm">${iconize(esc(txt))}</span><b class="tn" style="display:none"></b>${action ? `<button class="btn sm" data-act="${action.act}" data-arg="${action.arg ?? ''}">${esc(action.label)}</button>` : ''}`;
      box.appendChild(d);
    }
    clearTimeout(d._t); d._t = setTimeout(() => this.dropToast(d), life);
    const live = [...box.children].filter(x => !x.classList.contains('out'));
    for (let i = 0; i < live.length - max; i++) this.dropToast(live[i]);
    this.logBadge();
  }
  dropToast(d) { clearTimeout(d._t); d.classList.add('out'); setTimeout(() => d.remove(), 400); }
  // 提醒铃：数字是眼下要处理的事；没有要处理的、但有没看过的消息时亮一个小点
  logBadge() {
    const S = this.S, b = this.$('bellBtn'); if (!S || !b) return;
    const last = S.log[S.log.length - 1] || null;
    if (this.logSeen === undefined || (this.panel && this.panel.kind === 'log')) this.logSeen = last;
    const i = this.logSeen ? S.log.lastIndexOf(this.logSeen) : -1;
    const un = S.log.length - 1 - i;
    const A = (this.alertsNow || []).filter(a => a.lvl !== 'info'), n = A.length, t = n > 9 ? '9+' : String(n);
    b.classList.toggle('n', n > 0); b.classList.toggle('hot', A.some(a => a.lvl === 'bad')); b.classList.toggle('dot', un > 0);
    const el = b.querySelector('.bn'); if (el.textContent !== t) el.textContent = t;
    const lab = n ? `提醒，${n} 件事` : un ? `提醒，${un} 条新消息` : '提醒'; if (b.getAttribute('aria-label') !== lab) b.setAttribute('aria-label', lab);
  }
  // 顶栏下沿：写进 --topB，提示、侧边键、暂停条和左边那列都按它摆
  topSync() { const r = this.$('top').getBoundingClientRect(); const v = Math.round(r.bottom) + 'px'; if (this.topB !== v) { this.topB = v; document.documentElement.style.setProperty('--topB', v); } }
  modal(html, buttons = [{ t: '好', a: 'close-modal' }]) {
    const m = this.$('modal'); this.bkOpen = false;
    m.innerHTML = iconize(`<div class="mbox">${html}<div class="mbtns">${buttons.map(b => `<button class="btn ${b.cls || ''}" data-act="${b.a}" ${b.arg != null ? `data-arg="${b.arg}"` : ''}>${b.t}</button>`).join('')}</div></div>`);
    m.classList.add('show');
  }
  closeModal() { this.$('modal').classList.remove('show'); this.bkOpen = false; }
  // 终章：天火塔点亮以后的故事和「这一路」（点亮那一刻记下的数）
  skyEndModal() {
    const S = this.S, E = S.tower && S.tower.end; if (!E) return false;
    const s = E.sum, rows = [
      ['🧭', '走过的站', `${s.stops} 站（世界之脊往北 ${s.north} 站）`], ['🔥', '点亮的熔炉', `${s.furnaces} 座`], ['🗼', '点亮的塔', `${s.towers} 座`],
      ['👥', '现在的人', `${fmt(s.people)} 人`], ['🤝', '一路投奔来的人', `${fmt(s.arrivals)} 人`], ['🕯', '没能走到的人', `${fmt(s.deaths)} 人`],
      ['🐺', '守住的袭营', `${s.raidsWon} 次`], ['🌨', '熬过的暴风雪', `${s.blizzards} 场`], ['⏳', '这一程走了', `${fmtTime(s.t)}（第 ${s.runs} 次北行）`]];
    this.modal(`<div class="evtag">终章 · 天火</div><h2>🔥 天火点亮了</h2><p class="story">${esc(STORY.skyEnd)}</p>
      <div class="sec">这一路</div><div class="skysum">${rows.map(([i, a, b]) => `<div><span>${i} ${a}</span><b>${b}</b></div>`).join('')}</div>
      <div class="crw">🎁 解锁：称号「点燃天火的人」、金色炉火、天火纪念碑（菜单 → 收藏 → 装扮）</div>
      <p class="hint">往北的路还没完：后面的站不再有塔，目标照样一站比一站高。最远纪录接着往上记。</p>`, [{ t: '继续往北', a: 'skyend', cls: 'go' }]);
    this.$('modal').querySelector('.mbox').classList.add('skyend');
    return true;
  }
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
      const btns = s.cur ? `<span class="slcur">正在玩</span><button class="small ghost" data-act="slotdel" data-arg="${n}">删除</button>`
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
    const warn = s.empty ? '' : `<p class="nrwarn">会<b>覆盖</b>存档 ${slot} 里的「${esc(s.name)}」（👥 ${s.people} 人）：余烬、专家和收集册都会清空。覆盖之前会自动存一份备份，点错了可以到「菜单 → 存档 → 自动备份」里找回来。</p>`;
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

  // 路上的事：跟随机事件一样的弹窗；第一项是默认，一分钟没人选就按它办
  roadModal() {
    const v = Sim.roadView(this.S); if (!v) return false;
    const T = Sim.journeyOf(this.S).trip, m = this.$('modal'), hs = (this.S.meta.hints ||= {}), first = !hs.road || hs.road === T.t0;
    hs.road = hs.road || T.t0; // 同一趟里重新打开也还显示；下一趟就不说了
    m.innerHTML = iconize(`<div class="mbox ev"><div class="evtag">车队 · 往「${esc(Sim.stopOf(this.S, T.to).n)}」的路上</div><h2>${esc(v.title)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="road" data-arg="${i}"` : 'disabled'}><b>${esc(o.t)}${o.def ? '<em class="evdef">默认</em>' : ''}</b><small>${esc(o.d)}${o.ok ? '' : ' · 车上没带够'}</small></button>`).join('')}</div><p class="hint">车队停下来等你拿主意。${v.left} 秒内不选，就按「默认」办。</p>${first ? '<p class="hint wnfirst">✨ 第一次碰上路上的事：车上带的货能多给一条路。搭桥要木板，扎营要燃料，丢给狼群要生肉；灰掉的选项就是车上没带够。</p>' : ''}</div>`);
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
  // 资源图标落到哪里：熟食落到顶栏的熟食格，别的落到底部的「生产」（物资都在那里）
  resTarget(k) {
    const vis = e => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? e : null; };
    return (k === 'food' && vis(this.vt.food.e)) || vis(this.$('tbProd'));
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
        if (ks[0] !== 'rp' && now - (F.flyT || 0) > 1800) { const p = v.project(bx, by, 1.1 + s * 0.45), tg = ks[0] === 'food' ? this.vt.food.e : null; if (p.on && tg && tg.offsetWidth) { F.flyT = now; setTimeout(() => this.flyRes(p.x, p.y - 30, ks[0], 1, true), 900); } }
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
      <div class="tfoot">${VERSION_NAME} · 低多边形冬日生存经营</div>`);
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

  // 1.1 站点奇遇：一段一段地选；选完显示结果（有下文就说多久以后）
  qyModal(res) {
    const S = this.S, m = this.$('modal');
    if (res) {
      m.innerHTML = iconize(`<div class="mbox ev qy"><div class="evtag">北境 · 奇遇</div><h2>${this.qyIco(res.id, res.ic)} ${esc(res.n)}</h2><p class="story">${esc(res.msg)}</p>${res.next ? `<p class="hint">${res.wait > 5 ? `过 ${fmtTime(res.wait)} 还有下文${res.away ? `，派出去的 ${res.away} 个人那时回来` : ''}。` : '马上还有下文。'}</p>` : '<p class="hint">这件奇遇走完了，记进了收集册。</p>'}<div class="mbtns"><button class="btn go" data-act="${res.next && res.wait <= 5 ? 'qyopen' : 'close-modal'}">${res.next && res.wait <= 5 ? '接着看' : '知道了'}</button></div></div>`);
      m.classList.add('show'); return true;
    }
    const v = Sim.qyView(S); if (!v) return false;
    m.innerHTML = iconize(`<div class="mbox ev qy"><div class="evtag">北境 · 奇遇 · ${esc(v.camp)}${v.st ? ' · 下文' : ''}</div><h2>${this.qyIco(v.id, v.ic)} ${esc(v.n)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="qyopt" data-arg="${i}"` : 'disabled'}><b>${o.g ? '🧭 ' : ''}${esc(o.t)}</b><small>${esc(o.d)}${o.ok ? '' : ` · ${esc(o.why)}`}</small></button>`).join('')}</div><div class="mbtns"><button class="btn ghost" data-act="close-modal">稍后再说</button></div></div>`);
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
    const ch = Sim.chapterDef(this.S, i); if (!ch) return false;
    const m = this.$('modal'), rl = ch.rule && NORTH_RULES[ch.rule];
    const brief = rl ? [`${rl.ic} ${rl.tip}`] : BRIEF[i];
    m.innerHTML = iconize(`<div class="mbox chap"><div class="evtag">📖 新的一章 · ${esc(Sim.stopOf(this.S, i).n)}</div><h2>${esc(ch.n)}</h2><p class="story">${esc(ch.story)}</p>${brief ? `<div class="brief">${GMED}<div><b>老向导</b>${brief.map(x => `<p>${esc(x)}</p>`).join('')}</div></div>` : ''}<div class="sec">这一章要做的事</div><ul class="ctl">${ch.tasks.map(t => `<li>${esc(t.t)}</li>`).join('')}</ul><div class="crw">🎁 奖励：${esc(Sim.chapterReward(this.S, i).join('，'))}</div><div class="mbtns"><button class="btn go" data-act="close-modal">出发</button></div></div>`);
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
  // 眼下要留意的事：天气、袭营、掠夺者、商队、极光、人心、仓库……一条一条排好（提醒面板、铃上的数字、便签都从这里拿）
  // lvl：bad 要紧 / warn 留意 / good 好事 / info 只是说一声（不算进铃上的数字）；urgent 的可以占便签
  alertList(c, cr) {
    const S = this.S, A = [], fc = Sim.forecastOf(S);
    const w = Sim.weatherAt(S, S.t), od = cr.stall ? '熔炉停炉了' : cr.od ? '熔炉超载中' : '';
    if (w.blizzard) A.push({ k: 'bliz', ic: '❄', lvl: 'bad', urgent: true, t: '暴风雪中', cnt: fmtTime(w.until - S.t), d: `还要 ${fmtTime(w.until - S.t)} 才停。${od ? od + '，' : ''}盯着燃料和炉温。`, act: 'wx', btn: '看备战' });
    else if (w.warn) A.push({ k: 'bliz', ic: '❄', lvl: 'warn', urgent: true, t: '暴风雪要来了', cnt: fmtTime(w.inSec), d: `${fmtTime(w.inSec)} 后到。多备燃料，必要时让熔炉超载。${od ? od + '。' : ''}`, act: 'wx', btn: '看备战' });
    else if (w.next <= fc) A.push({ k: 'blizfc', ic: '❄', lvl: 'info', t: '气象预报：暴风雪', cnt: fmtTime(w.next), d: `${fmtTime(w.next)} 后有暴风雪。${od ? od + '。' : ''}`, act: 'wx', btn: '看看' });
    else if (od) A.push({ k: 'od', ic: '🔥', lvl: cr.stall ? 'bad' : 'warn', t: od, d: '点开看炉温，别烧过头。', act: 'wx', btn: '看炉温' });
    { const cs = Sim.coldAt(S);
      if (cs && cs.on) A.push({ k: 'cold', ic: '🌨', lvl: 'bad', urgent: true, t: '寒潮中', cnt: fmtTime(cs.left), d: `还要 ${fmtTime(cs.left)}。熔炉烧 ${Sim.coldFuel(S)} 倍燃料，户外采集只剩 ${Math.round(Sim.coldGather(S) * 100)}%，气温低 ${Sim.COLD.drop}°。挺过去没人冻伤有奖励。`, act: 'wx', btn: '看看' });
      else if (cs && cs.fc) A.push({ k: 'cold', ic: '🌨', lvl: cs.inSec <= 300 ? 'warn' : 'info', urgent: cs.inSec <= 300, t: '寒潮要来了', cnt: fmtTime(cs.inSec), d: `${fmtTime(cs.inSec)} 后到，持续一整天。物流网在给每座营地补燃料${Sim.coldBliz(S, cs) ? '；这次还和暴风雪撞在一起' : ''}。`, act: 'wx', btn: '看看' }); }
    { const z = Sim.tideAt(S);
      if (z && z.on) {
        const bv = Sim.beastView(S, z), bin = bv && !bv.done ? bv.in : null;
        A.push({ k: 'tide', ic: '🌌', lvl: 'bad', urgent: true, t: `永冬潮第 ${z.n} 波`, cnt: fmtTime(z.left), d: bin != null && bin <= 600 ? `霜巨兽 ${fmtTime(Math.max(0, bin))} 后冲「${bv.name}」：强度 ${bv.str}，防御 ${bv.def}${bv.def >= bv.str ? '，守得住' : '，守不住'}。` : `还要 ${fmtTime(z.left)}。气温低 ${z.drop}°，熔炉烧 ${Sim.TIDE.fuel} 倍燃料。${bv && bv.done ? (bv.won ? '霜巨兽已经被打退了。' : '霜巨兽闯进来过，冻住的建筑过一阵会化开。') : '最后一夜霜巨兽会来。'}`, act: 'wx', btn: '看看' });
      } else if (z && z.fc) A.push({ k: 'tide', ic: '🌌', lvl: z.inSec <= 600 ? 'warn' : 'info', urgent: z.inSec <= 600, t: `永冬潮第 ${z.n} 波要来了`, cnt: fmtTime(z.inSec), d: `${fmtTime(z.inSec)} 后到，持续一天半，气温再降 ${z.drop}°。物流网在给每座营地备燃料。`, act: 'wx', btn: '看看' }); }
    for (const x of S.camps) { const o = x.pk && x.pk.out; if (o && !x.pk.on && S.t - o.t < 600) A.push({ k: 'peak' + x.id, ic: '🔥', lvl: 'warn', t: `「${x.name}」的炉火鼎盛熄了`, d: `${o.why}。补回三星水准，金色的火会再烧起来。`, act: o.r ? 'plan' : 'towngo', arg: o.r || x.id, btn: o.r ? '看产线' : '看营地' }); }
    { const e = Sim.wxeAt(S, S.t);
      if (e.ev && (e.on || e.inSec <= fc)) {
        const E = Sim.WXE[e.ev.kind], prep = Sim.wxePrepped(S, c, e.ev), need = Sim.wxeMatters(S, c, e.ev) && !prep;
        if (e.on) A.push({ k: 'wxe', ic: E.ic, lvl: 'bad', urgent: true, t: E.n, cnt: fmtTime(e.left), d: `${E.d}还有 ${fmtTime(e.left)}。`, act: 'wx', btn: '看看' });
        else A.push({ k: 'wxe', ic: E.ic, lvl: need && e.inSec <= Sim.WXE_WARN ? 'warn' : 'info', urgent: need && e.inSec <= Sim.WXE_WARN, t: `${E.n}要来了`, cnt: fmtTime(e.inSec), d: `${E.d}${need ? `还没「${E.prep}」，花点材料提前准备。` : prep ? '已经准备好了。' : ''}`, act: 'wx', btn: need ? '去准备' : '看看' });
      } }
    const nr = Sim.nextRaid(S);
    if (nr && nr.in <= Sim.RAID_PREP) {
      const rc = Sim.getCamp(S, nr.camp), p = Sim.raidPrep(S, nr), str = Sim.raidStrength(S, rc, nr), def = Sim.raidDefense(S, rc, nr);
      const tags = p ? [p.fire && '火墙', p.mil && '民兵', p.hide && '收拢物资'].filter(Boolean).join('、') : '';
      A.push({ k: 'raid', ic: '🐺', lvl: def >= str ? 'warn' : 'bad', urgent: true, t: `袭击${S.camps.length > 1 ? '「' + rc.name + '」' : '营地'}`, cnt: fmtTime(nr.in), d: `${fmtTime(nr.in)} 后到。防御 ${def}，对方强度 ${str}${tags ? `，已经备了${tags}` : '，还没备战'}。`, act: 'raidp', btn: '去备战' });
    }
    for (const d of Sim.gangDemands(S)) A.push({ k: 'gang' + d.g.id, ic: '🏴', lvl: d.st.dem.fight ? 'bad' : 'warn', urgent: true, t: `「${Sim.gangName(d.g)}」${d.st.dem.fight ? '要打过来了' : '来索贡'}`, cnt: fmtTime(d.left), d: d.st.dem.fight ? '靠箭塔和民兵顶回去，或者趁早交贡。' : '交贡、做买卖，或者靠箭塔顶回去。到时候没人答复，守得住就打，守不住就交贡。', act: 'gang', arg: d.g.id, btn: '去答复' });
    if (S.car) { const left = S.car.orders.filter(o => !o.done).length; if (left) A.push({ k: 'car', ic: '🛷', lvl: 'good', t: '雪橇商队扎营了', cnt: fmtTime(S.car.until - S.t), d: `在「${Sim.getCamp(S, S.car.camp)?.name || ''}」外面，还有 ${left} 张订单。`, act: 'car', btn: '看订单' }); }
    if (S.aurOpen != null) A.push({ k: 'aur', ic: '🌌', lvl: 'good', t: '极光夜', d: '大家一起看一会儿：所有营地希望 +4、余烬 +1。', act: 'aurora', btn: '一起看' });
    { const qv = Sim.qyView(S); if (qv) A.push({ k: 'qy', ic: qv.ic, lvl: 'good', t: `奇遇：${qv.n}`, d: qv.st ? '有了下文，等你拿主意。' : '北境的这一站碰上了一件事，等你拿主意。', act: 'qyopen', btn: '去看看' }); }
    for (const c of S.camps) { const nx = Sim.townNext(c); if (nx && !Sim.townBlock(S, c)) A.push({ k: 'town' + c.id, ic: '🎆', lvl: 'good', t: `「${c.name}」可以升成${nx.n}了`, d: nx.d, act: 'towngo', arg: c.id, btn: '去看看' }); }
    { const F = Sim.forkOf(S); if (F && F.pick == null) A.push({ k: 'fork', ic: '🧭', lvl: 'info', t: '下一站有几条路可选', d: '地貌、碰上的事和好处都不一样。出发前选一条，不选就走第一条。', act: 'tb', arg: 'migrate', btn: '去选路' }); }
    { const chs = Sim.chapters(S); if (chs.some(x => x.done && !x.got)) A.push({ k: 'gift', ic: '🎁', lvl: 'good', t: '章节奖励可以领了', d: '这一章的任务做完了。', act: 'chapter', btn: '领奖励' }); }
    { const hp = Math.round(c.hope ?? 50), ds = Math.round(c.disc ?? 10);
      if (ds >= 70 || hp <= 25 || ds >= 55) A.push({ k: 'mood', ic: '🕯️', lvl: ds >= 70 ? 'bad' : 'warn', t: ds >= 55 ? `「${c.name}」不满 ${ds}` : `「${c.name}」希望只剩 ${hp}`, d: ds >= Sim.LEAVE_AT ? '有人在趁夜离开。看看是什么在拖累大家。' : '干活会变慢。看看是什么在拖累大家，改一改律令。', act: 'tb', arg: 'mood', btn: '看人心' }); }
    if (!c.trade) {
      const ri = this.resInfo(c, cr, RES_KEYS.filter(k => RES[k].t <= S.known && (c.stock[k] || 0) >= 1));
      const sh = ri.filter(r => r.short && r.k !== 'food'), fu = ri.filter(r => r.full);
      if (sh.length || fu.length) A.push({ k: 'store', ic: '📦', lvl: 'warn', t: [sh.length && `${sh.slice(0, 2).map(r => RES[r.k].n).join('、')}${sh.length > 2 ? '等' : ''}在缺`, fu.length && `${fu.slice(0, 2).map(r => RES[r.k].n).join('、')}${fu.length > 2 ? '等' : ''}满了`].filter(Boolean).join('，'), d: fu.length ? '满了相关建筑会停工：升级仓库，或开「满仓自动兑换」。' : '看看卡在哪一环。', act: 'tb', arg: 'stock', btn: '看物资' });
    }
    for (const b of Sim.activeBuffs(S, c)) A.push({ k: 'buff' + b.n, ic: '✨', lvl: 'info', t: b.n || '加成', cnt: fmtTime(b.until - S.t), d: `${BUFF_TXT(b)}，还剩 ${fmtTime(b.until - S.t)}。` });
    { const rl = NORTH_RULES[Sim.campRule(S, c)]; if (rl) A.push({ k: 'rule', ic: rl.ic, lvl: 'info', t: `这一站的地貌：${rl.n}`, d: `好处是${rl.good}；坏处是${rl.bad}。只管这一站的主营地。` }); }
    { const sky = Sim.skyAt(S, S.t); if (sky.icefog > 0.3) A.push({ k: 'fog', ic: '🌫️', lvl: 'info', t: '冰雾', d: '远处看不太清，不影响干活。' }); else if (sky.aurora > 0.3 && S.aurOpen == null) A.push({ k: 'aurs', ic: '🌌', lvl: 'info', t: '极光', d: '只是好看，不影响产出。' }); }
    { const dc = dayCycle(S.t), nx = { 白天: '黄昏', 黄昏: '入夜', 夜晚: '黎明', 黎明: '天亮' }[dc.name]; A.push({ k: 'tod', ic: dc.icon, lvl: 'info', t: dc.name, cnt: fmtTime(dc.left), d: `${fmtTime(dc.left)} 后${nx}。昼夜只改变光线，不影响产出。` }); }
    return A;
  }
  // 顶栏四格：温度（有暴风雪时写在下面）、人口（下面是希望或不满）、燃料够烧多久、熟食
  vitals(c, cr, fuelMin, fuelEta) {
    const S = this.S, V = this.vt, set = (k, b, l, cls) => { const v = V[k]; if (v.bh !== b) { v.bh = b; v.b.innerHTML = b; } if (v.lh !== l) { v.lh = l; v.l.innerHTML = l; } const cn = `vt hpl ${k} ${cls}`; if (v.e.className !== cn) v.e.className = cn; };
    const temp = Math.round(cr.tH ?? c.temp), w = Sim.weatherAt(S, S.t);
    const cs = Sim.coldAt(S), z = Sim.tideAt(S), ton = z && z.on, tfc = z && !z.on && z.fc && z.inSec <= DAY_LEN;
    const con = cs && cs.on || ton, cfc = cs && !cs.on && cs.fc || tfc;
    const wl = w.blizzard ? `风雪 ${fmtTime(w.until - S.t)}` : ton ? `永冬 ${fmtTime(z.left)}` : cs && cs.on ? `寒潮 ${fmtTime(cs.left)}` : w.warn ? `${fmtTime(w.inSec)}来雪` : tfc ? `${fmtTime(z.inSec)}永冬` : cs && !cs.on && cs.fc ? `${fmtTime(cs.inSec)}寒潮` : '体感';
    // 要紧的事让对应那一格亮一圈：受冻、风雪、寒潮、永冬潮、怪天气正在来是红圈，快到了是黄圈；燃料、熟食不到 10 分钟，缺床或不满太高也亮红圈
    const U = (this.alertsNow || []).filter(u => u.urgent && /^(bliz|cold|tide|wxe)$/.test(u.k)), frz = cr.tH != null && cr.tH < -8 && c.people > 3;
    const ring = (on, w) => on ? ' alarm' : w ? ' alarm-w' : '';
    set('tmp', `${temp}°`, wl, (temp < 0 || w.blizzard || con ? 'bad' : w.warn || cfc ? 'warn' : '') + (temp < 10 ? ' cold' : ' warm') + ring(frz || U.some(u => u.lvl === 'bad'), U.length));
    const hp = Math.round(c.hope ?? 50), ds = Math.round(c.disc ?? 10), mt = cr.mood || { hT: hp, dT: ds }, arr = (v, t) => t > v + 1 ? '▲' : t < v - 1 ? '▼' : '';
    const pl = c.wait > 0 && ds < 55 ? `<span class="neg">缺 ${c.wait} 床</span>` : ds >= 55 ? `不满 ${ds}${arr(ds, mt.dT)}` : `希望 ${hp}${arr(hp, mt.hT)}`;
    set('ppl', `${c.people}<small>/${cr.housing || 0}</small>`, pl, (ds >= 70 ? 'bad' : ds >= 55 || hp <= 25 ? 'warn' : '') + ring(c.wait > 0 || ds >= 70));
    const ok = fuelEta === Infinity && fuelMin < 6000, show = Math.min(6001, fuelEta === Infinity ? fuelMin : fuelEta);
    const fv = fuelMin > 6000 ? '充足' : ok ? '够烧' : show >= 60 ? `${Math.floor(show / 60)}时${show < 600 && Math.floor(show % 60) ? Math.floor(show % 60) + '分' : ''}` : `${Math.max(0, Math.floor(show))}分`;
    set('fuel', fv, fuelMin > 6000 || ok ? '燃料' : '还能烧', (fuelEta < 30 ? 'bad' : fuelEta < 90 ? 'warn' : '') + ring(fuelEta < 10));
    V.fuel.f.style.setProperty('--f', Math.min(1, fuelMin / 240).toFixed(2)); V.fuel.e.style.setProperty('--f', Math.min(1, fuelMin / 240).toFixed(2));
    V.tmp.e.style.setProperty('--h', Math.max(0.06, Math.min(1, (temp + 30) / 90)).toFixed(2));
    const fn = cr.foodNet || 0, fm = fn < 0 ? (c.stock.food || 0) / -fn : Infinity;
    set('food', fmt(this.rolled('food', c.stock.food)), `<span class="${fn < -0.05 ? 'neg' : fn > 0.05 ? 'pos' : ''}">${fn >= 0 ? '+' : ''}${fmt(fn)}/分</span>`, (fm < 10 ? 'bad' : fm < 30 ? 'warn' : '') + ring(fm < 10));
    V.tmp.e.dataset.tt = `住在屋里的体感温度${w.blizzard ? ' · 暴风雪还有 ' + fmtTime(w.until - S.t) : w.warn ? ' · 暴风雪 ' + fmtTime(w.inSec) + ' 后到' : ''}（点开熔炉）`;
    V.ppl.e.dataset.tt = `人口 / 床位 · 希望 ${hp} · 不满 ${ds}${c.wait > 0 ? ` · ${c.wait} 人在等床位` : ''}${c.bots ? ` · 自动机 ${c.bots} 台` : ''}`;
    V.fuel.e.dataset.tt = ok ? `燃料进得比烧得快（库存够烧 ${fmtTime(fuelMin * 60)}）` : `燃料还能烧 ${fmtTime(show * 60)}`;
    V.food.e.dataset.tt = '熟食库存 · 每分钟净变化';
    { const pc = document.body.classList.contains('pc'); for (const k in V) { const e = V[k].e; e.dataset.tip = 'vt:' + k; const t = pc ? '' : e.dataset.tt; if (e.title !== t) e.title = t; } }
  }
  // 顶部目标：章节牌子 + 这一步做什么 + 进度条；旁边的小按钮是规划 / 跟着看 / 拿主意
  goalSync() {
    const S = this.S, goal = nextGoal(S), chs = Sim.chapters(S), cur = chs[chs.length - 1], gift = chs.some(x => x.done && !x.got);
    const tr = Sim.journeyOf(S).trip, ge = this.$('goal');
    const rg = !tr && (Sim.rateGoals(S).find(x => !x.eternal) || Sim.rateGoals(S)[0]);
    let p = cur ? cur.tasks.filter(t => t.ok).length / Math.max(1, cur.tasks.length) : 0, right = cur ? `${cur.tasks.filter(t => t.ok).length}/${cur.tasks.length}` : '';
    if (tr && tr.phase === 'go') { p = tr.d / tr.len; right = `${Math.round(p * 100)}%`; }
    else if (rg && goal.startsWith(RES[rg.r].n)) { const r = Sim.prodRate(S, rg.r); p = Math.min(1, r / rg.n); }
    const chip = tr && tr.road ? '<i class="gplan" data-act="roadopen">拿主意</i>' : tr && tr.phase === 'go' ? `<i class="gplan" data-act="followtrip">${this.g.view.followTrip ? '不跟了' : '跟着看'}</i>` : '<i class="gplan" data-act="plan">规划<kbd class="pk">J</kbd></i>';
    const tag = cur ? cur.ch.n.split(' · ')[0] : '目标';
    let title = goal || (cur ? cur.ch.n.split(' · ')[1] : ''), hold = '';
    { const i = title.indexOf(' · 稳住 '); if (i > 0) { hold = title.slice(i + 3).replace('/', ' / '); title = title.slice(0, i); } } // 稳住的计时放到进度管右边
    const key = [tag, title, hold, right, gift, chip, (p * 50 | 0)].join('|');
    if (ge.dataset.t === key) return;
    ge.dataset.t = key; ge.dataset.act = 'chapter';
    ge.innerHTML = iconize(title ? `<div class="gh"><span class="gtag">${esc(tag)}</span><span class="gt">${esc(title)}</span>${gift ? '<i class="gift">🎁 领奖励</i>' : right ? `<span class="gr">${right}</span>` : ''}${chip}</div><div class="gb2"><div class="gbar"><i style="--p:${p.toFixed(3)}"></i></div>${hold ? `<span class="ghold">${hold}</span>` : ''}</div>` : '');
    ge.classList.toggle('gift', gift);
    ge.style.visibility = title ? '' : 'hidden';
    ge.title = '点开看这一章的任务';
  }
  // ---------- 老向导 ----------
  // 底下一行小条：头像 + 一句短话 + 一个按钮。他要说的排成一摞（他的下一句、攒下的新玩法），点头像或小条在上方展开一张卡，一次一条，左右翻。
  // 头像角上的数字是没看过的条数；「稍后」：同一件事 3 分钟内不再贴出来
  advBtn(a) { return { plan: '去规划', raid: '去备战', scout: '去侦察', arrive: '去放熔炉', migrate: '去北迁', place: '去建', spot: '去看看', roadopen: '拿主意', campgo: '去看看', netview: '看物流', netroad: '去升级' }[a.act] || (a.kind === 'trip' ? '跟着看' : a.kind === 'fuel' || a.kind === 'cold' ? '去熔炉' : a.kind === 'food' ? '看物资' : '去看看'); }
  // 断燃料、断吃的、冻伤这几样急事刚冒出来时，发一条红灯消息带一个按钮（暴风雪、寒潮、袭营这些游戏里本来就会发一条带按钮的消息）；同一件事 3 分钟内不重发
  urgentTicks() {
    const a = this.adv, now = performance.now(), at = this.urgAt || (this.urgAt = {});
    const key = a && a.pri === 0 && /^(fuel|food|cold)$/.test(a.kind) ? `${a.kind}|${a.camp ?? ''}` : null;
    if (key && key !== this.urgWas && now - (at[key] || -1e9) >= 180000 && !this.g.titleOn) {
      at[key] = now;
      this.toast(a.short || a.text, 'bad', { act: 'advisor', label: this.advBtn(a) });
    }
    this.urgWas = key;
  }
  // 换了存档就从头来（老向导这一摞、看过的、稍后的都清掉）
  guideFor() { const S = this.S; if (this.gS !== S) { this.gS = S; this.gHints = []; this.gRead = new Set(); this.gZz = {}; this.gOpen = false; } }
  guideHints() { this.guideFor(); return this.gHints; }
  guideAdd(h) { this.guideHints().push({ ...h, at: performance.now(), hub: h.a && (HINT_HUB[h.a.arg] || HINT_HUB[h.a.act]) }); this.noteT = 0; }
  guideHubDot(hub) { return this.guideHints().some(x => x.hub === hub && !x.hubSeen); }
  guideList() {
    const S = this.S, a = this.adv, L = [], now = performance.now(), zz = this.gZz || (this.gZz = {});
    if (a) {
      L.push({ key: `v:${a.kind || ''}|${a.act || ''}|${a.arg ?? ''}`, adv: true, urgent: a.pri === 0, ic: gdIc(a.kind, 'gi'), short: a.short || a.text, text: a.text, btn: this.advBtn(a), go: () => this.advisorGo() });
    }
    for (const h of this.guideHints()) L.push({ key: 'h:' + h.id, hint: h, ic: iconize(h.ic).includes('<svg') ? iconize(h.ic).replace('class="', 'class="gi ') : ico('i', 'sparkle', 'gi'), title: h.n, short: h.n, text: h.d, btn: h.a ? '去看看' : '', at: h.at, go: h.a ? () => this.actDo(h.a.act, h.a.arg) : null });
    return L.filter(x => !(zz[x.key] > now));
  }
  // 小条上说哪一条：急事 > 刚来的、还没看的新玩法（贴 30 秒）> 老向导的下一句 > 新玩法
  guideTop(L) {
    const rd = this.gRead, now = performance.now();
    return L.find(x => x.urgent) || L.find(x => x.hint && !rd.has(x.key) && now - x.at < 30000) || L.find(x => x.adv) || L[0] || null;
  }
  noteSync() {
    if (this.noteT && performance.now() - this.noteT < 1200) return;
    this.noteT = performance.now();
    const S = this.S, el = this.$('note');
    this.guideFor();
    if (!el.firstChild) this.guideBuild(el);
    this.adv = S.meta.tut ? Sim.advisor(S) : null;
    const L = this.gList = this.guideList(), top = this.gTop = this.guideTop(L);
    const zzAny = Object.values(this.gZz).some(t => t > performance.now());
    el.classList.toggle('show', !!(top || zzAny));
    el.classList.toggle('only', !top); // 都按了「稍后」：只剩头像，点一下全部拿回来
    if (!L.length) this.gOpen = false;
    const un = L.filter(x => !this.gRead.has(x.key)).length, E = this.gEl;
    E.badge.textContent = un > 9 ? '9+' : un; E.badge.style.display = un ? '' : 'none';
    if (top) {
      const k = top.key + '|' + top.short + '|' + top.btn;
      if (E.slip.dataset.k !== k) {
        const fresh = (E.slip.dataset.k || '').split('|')[0] !== top.key;
        E.slip.dataset.k = k;
        E.tag.style.display = top.hint ? '' : 'none';
        E.txt.innerHTML = iconize(esc(top.short));
        E.go.textContent = top.btn; E.go.style.display = top.btn ? '' : 'none';
        if (fresh) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
      }
      el.classList.toggle('urgent', !!top.urgent);
    }
    this.guideCard();
  }
  // 头像、小条、展开卡只搭一次，之后只换里面的字（小条每 1.2 秒可能刷新，按钮用 pointerdown 接）
  guideBuild(el) {
    el.innerHTML = `<div class="ncard" role="dialog" aria-label="老向导"><div class="nch"><b>老向导</b><span class="u-tag ntg">新玩法</span><span class="npg"><button class="btn sm" data-n="prev" aria-label="上一条">‹</button><i></i><button class="btn sm" data-n="next" aria-label="下一条">›</button></span></div>
<div class="ncb"><span class="nci"></span><div><b class="nct"></b><p></p></div></div><div class="ncf"><button class="btn sm" data-n="ok"></button><button class="btn go sm" data-n="cgo"></button></div></div>
<button class="gmed" data-n="card" aria-label="老向导，点开看全文"><span class="pf"><svg class="gpf" aria-hidden="true"><use href="#c-spec_guide"/></svg></span><b class="u-badge"></b></button>
<div class="nslip" data-n="card"><span class="u-tag ntg">新玩法</span><span class="nt"></span><button class="btn go sm" data-n="go"></button></div>`;
    const q = s => el.querySelector(s), card = q('.ncard');
    this.gEl = { card, badge: q('.gmed .u-badge'), slip: q('.nslip'), tag: q('.nslip .ntg'), txt: q('.nslip .nt'), go: q('.nslip [data-n=go]'),
      ctag: q('.nch .ntg'), pg: q('.npg'), pgi: q('.npg i'), ci: q('.nci'), ct: q('.nct'), cp: q('.ncb p'), ok: q('[data-n=ok]'), cgo: q('[data-n=cgo]') };
  }
  guideCard() {
    const E = this.gEl, L = this.gList || [], open = this.gOpen && L.length > 0;
    E.card.classList.toggle('show', open);
    if (!open) return;
    let i = L.findIndex(x => x.key === this.gKey); if (i < 0) i = Math.min(L.length - 1, Math.max(0, this.gIdx || 0));
    const it = L[i]; this.gKey = it.key; this.gIdx = i; this.gRead.add(it.key);
    const k = [it.key, it.text, it.btn, i, L.length].join('|');
    if (E.card.dataset.k === k) return;
    E.card.dataset.k = k;
    E.ctag.style.display = it.hint ? '' : 'none';
    E.pg.style.display = L.length > 1 ? '' : 'none'; E.pgi.textContent = `${i + 1} / ${L.length}`;
    E.ci.innerHTML = it.ic; E.ct.textContent = it.title || ''; E.ct.style.display = it.title ? '' : 'none';
    E.cp.innerHTML = iconize(esc(it.text));
    E.ok.textContent = it.hint ? '知道了' : '稍后';
    E.cgo.textContent = it.btn; E.cgo.style.display = it.btn ? '' : 'none';
  }
  guideTap(n) {
    const L = this.gList || [], cur = () => L.find(x => x.key === this.gKey);
    if (n === 'card') {
      if (!this.gTop) { this.gZz = {}; this.gOpen = true; } // 只剩头像：把按过「稍后」的都拿回来
      else { this.gOpen = !this.gOpen; if (this.gOpen) this.gKey = this.gTop.key; }
    } else if (n === 'go') { const t = this.gTop; if (t && t.go) { this.gRead.add(t.key); this.guideDone(t); t.go(); } this.gOpen = false; }
    else if (n === 'prev' || n === 'next') { const i = L.findIndex(x => x.key === this.gKey), j = (i + (n === 'next' ? 1 : -1) + L.length) % L.length; this.gKey = L[j] && L[j].key; }
    else if (n === 'ok') { const it = cur(); if (it) { if (it.hint) this.guideDone(it); else this.gZz[it.key] = performance.now() + 180000; } if (L.length <= 1) this.gOpen = false; }
    else if (n === 'cgo') { const it = cur(); if (it && it.go) { this.guideDone(it); it.go(); } this.gOpen = false; }
    this.noteT = 0; this.noteSync();
  }
  // 新玩法点过「知道了」或「去看看」就从这一摞里拿掉
  guideDone(it) { if (!it.hint) return; const H = this.guideHints(), i = H.indexOf(it.hint); if (i >= 0) H.splice(i, 1); }
  hud() {
    const S = this.S, c = this.camp(), cr = Sim.rt(S).c[c.id] || {};
    this.cmdBar(c);
    this.watchStock(c, cr);
    this.watchLevels();
    const fuelMin = cr.burnPerMin ? cr.fuelUnits / cr.burnPerMin : 0, fuelEta = Sim.fuelLeft(cr); // 库存够烧多久；算上进账还能撑多久（跟得上就是 Infinity）
    // 冰雾：只是好看，开始时提一句
    { const sky = Sim.skyAt(S, S.t), was = this.skyWas || (this.skyWas = { i: sky.icefog > 0.2 });
      if (sky.icefog > 0.2 && !was.i) Sim.logMsg(S, '🌫️ 起冰雾了，空气里闪着细小的冰晶。远处看不太清，不影响干活。');
      was.i = sky.icefog > 0.2; }
    const cn = this.$('campName'), ct = c.name; if (cn.firstChild.textContent !== ct) cn.firstChild.textContent = ct;
    { const fb = Sim.getB(S, c.furnace), m = Sim.mainCamp(S), sub = `<span class="ck">${c.depot ? '补给站' : m && m.id === c.id ? '主营地' : '营地'}${fb ? ' · ' : ''}</span>${fb ? fb.lvl + ' 级' : ''}`, se = cn.querySelector('.csub'); if (se && se.dataset.h !== sub) { se.dataset.h = sub; se.innerHTML = sub; } }
    cn.classList.toggle('one', S.camps.length < 2); cn.title = S.camps.length > 1 ? '点一下换到下一座营地' : '营地概况';
    this.vitals(c, cr, fuelMin, fuelEta);
    this.$('menuBtn').classList.toggle('dot', !!(S.meta.book && S.meta.book.fresh && S.meta.book.fresh.length));
    const A = this.alertsNow = this.alertList(c, cr);
    this.logBadge();
    this.syncInset();
    // 有建筑在产的物资快满了：提醒一次（同一种物资 30 分钟内不重复，两条之间至少隔 3 分钟）
    const cap = cr.cap || 0;
    if (!c.trade && cap && performance.now() - (this.fullWarnAt || -1e9) > 180000) {
      const now = performance.now(), fw = this.fullWarn || (this.fullWarn = {});
      for (const k of RES_KEYS) {
        const f = (cr.flow || {})[k];
        if (!f || f.p - f.c <= 0.05 || (c.stock[k] || 0) < cap * 0.9 || !S.buildings.some(b => b.camp === c.id && BLD[b.type].out && BLD[b.type].out[k])) continue;
        const key = c.id + k;
        if (fw[key] && now - fw[key] < 1800000) continue;
        fw[key] = now; this.fullWarnAt = now;
        this.toast(`${RICON[k]}${RES[k].n}快满了（上限 ${fmt(cap)}），满了相关建筑会停工。可以升级仓库，或开启「满仓自动兑换」。`, 'warn', { act: 'tb', arg: 'stock', label: '去处理' });
        break;
      }
    }
    this.goalSync();
    this.noteSync();
    this.urgentTicks();
    // 底部分区上的小点
    { const T = S.tech, ct = T && T.cur && Sim.techDef(S, T.cur), tb = this.$('tbResearch');
      tb.style.setProperty('--p', ct ? Math.min(1, T.prog / ct.pts).toFixed(3) : 0); tb.classList.toggle('busy', !!ct);
      tb.classList.toggle('dot', !ct && S.buildings.some(b => b.type === 'workshop') && (TECHS.some(t => Sim.techCheck(S, t.id).ok) || Sim.techCheck(S, 'endless').ok)); }
    this.$('tbBuild').classList.toggle('dot', this.newBld().length > 0 || this.guideHubDot('build'));
    this.$('tbNorth').classList.toggle('dot', ['migrate', 'specs', 'scout'].some(k => this.tabDot(k)) || this.guideHubDot('north'));
    this.$('tbCamp').classList.toggle('dot', this.tabDot('camp') || this.guideHubDot('camp'));
    this.$('tbProd').classList.toggle('dot', this.guideHubDot('prod'));
  }
  // 熔炉号令：右下角一排圆按钮，外圈是冷却/生效的进度；点一下弹出说明和「发令」
  cmdBar(c) {
    const S = this.S, el = this.$('cmdbar'); if (!el) return;
    const ids = Object.keys(CMDS).filter(id => Sim.cmdOk(S, id));
    let h = '';
    for (const id of ids) {
      const d = CMDS[id], on = Sim.cmdOn(S, id, d.net ? null : c), left = Sim.cmdLeft(S, id), cd = Sim.cmdCd(S, id);
      const st = on ? 'on' : left > 0 ? 'away' : cd > 0 ? 'cd' : 'ready', p = on ? left / d.len : cd > 0 ? 1 - cd / d.cd : 1;
      const tx = on ? fmtTime(left) : cd > 0 ? fmtTime(cd) : '';
      h += `<button class="cmdb ${st}${this.cmdSel === id ? ' sel' : ''}" data-act="cmdsel" data-arg="${id}" style="--p:${p.toFixed(3)}" title="${d.n}" aria-label="${d.n}"><span>${this.cIco('cmd_' + id, d.ic)}</span>${tx ? `<i>${tx}</i>` : '<i class="rdy">可用</i>'}<em class="cl">${d.n}</em></button>`;
    }
    if (h) h = `<div class="cmdh"><b>熔炉号令</b><small>短时间爆发</small></div>` + h;
    if (this.cmdSel && ids.includes(this.cmdSel)) {
      const id = this.cmdSel, d = CMDS[id], ck = Sim.cmdCheck(S, id), left = Sim.cmdLeft(S, id), other = left > 0 && !d.net && (S.cmd[id].camp !== c.id);
      const len = d.len >= 120 ? `${d.len / 60} 分钟` : `${d.len} 秒`;
      h += `<div class="cmdpop"><b>${this.cIco('cmd_' + id, d.ic)} ${d.n}</b><small>${d.d}</small><small class="cm">${d.net ? '整个物流网' : `只管「${esc(c.name)}」`} · 持续 ${len} · 冷却 ${d.cd / 60} 分钟</small>${other ? `<small class="cm warn">正在「${esc(Sim.getCamp(S, S.cmd[id].camp).name)}」生效</small>` : ''}<div class="cpb"><button class="small" data-act="cmdsel" data-arg="">收起</button><button class="small ${ck.ok ? 'go' : ''}" data-act="cmdfire" data-arg="${id}" ${ck.ok ? '' : 'disabled'}>${ck.ok ? '📯 发令' : ck.on ? '生效中' : ck.cd ? fmtTime(ck.cd) + ' 后可发' : esc(ck.reason)}</button></div></div>`;
    }
    if (h !== this.cmdH) { this.cmdH = h; el.innerHTML = iconize(h); }
    document.body.classList.toggle('cmd-on', ids.length > 0);
  }
  // 自动机仓：几台、哪一型、核心、拆回核心
  bayHtml(b, c) {
    const S = this.S, cap = Sim.bayCap(S, b), md = Sim.botModel(S, b), cr = Sim.rt(S).c[c.id] || {}, pow = Sim.botPow(S), n = b.bots || 0;
    let h = `<div class="row"><span>自动机</span><span><b>${n}</b>/${cap} 台 · ${BOT_MODELS[md].n}${b.want != null && b.want < cap ? ` · 空着 ${cap - b.want} 个位子` : ''}</span></div>`;
    h += `<div class="row sub"><span>自动机核心</span><span>库存 ${fmt(c.stock.core || 0)} 个 · 有空位就自动装（一个核心 2 台）</span></div>`;
    h += `<div class="sec">型号 <small>这个仓里的自动机改成哪一型</small></div><div class="achips">`;
    for (const m in BOT_MODELS) {
      const d = BOT_MODELS[m], okm = Sim.botModelOk(S, m);
      h += `<button class="achip ${m === md ? 'on' : ''}" data-act="baymod" data-arg="${b.id}:${m}" ${okm && m !== md ? '' : 'disabled'}><b>${d.ic} ${d.n}</b><small>${okm ? (m === 'labor' ? `什么活都能干，一台顶 ${pow} 个人` : m === 'haul' ? `只搬东西：一台顶 ${fmt(BOT.haul * pow / BOT.pow)} 个搬运工` : '只干采集：产量 +30%') : `研究「${TECHS.find(t => t.id === d.tech).n}」后可选`}</small></button>`;
    }
    h += `</div>`;
    const cb = Sim.campBots(S, c);
    h += `<div class="row sub"><span>全营地</span><span>劳工 ${cb.l} · 搬运 ${cb.h} · 采掘 ${cb.m} 台</span></div>`;
    if (md === 'mine' && (cr.mineIdle || 0) >= 1) h += `<div class="hint warn">采掘型有 ${Math.floor(cr.mineIdle)} 个人手的活没处干：营地里的采集岗位不够。多建采集建筑，或者把这个仓改成劳工型。</div>`;
    if (Sim.techDone(S, 'corerec')) {
      h += `<div class="row"><span>核心回收</span><span style="flex:none;display:flex;gap:6px">${n >= 2 ? `<button class="small" data-act="bayscrap" data-arg="${b.id}:2">拆 2 台</button><button class="small" data-act="bayscrap" data-arg="${b.id}:${n}">全拆</button>` : ''}${b.want != null ? `<button class="small go" data-act="bayfill" data-arg="${b.id}">重新装满</button>` : ''}</span></div><div class="hint">拆下来的自动机两台退一个核心；拆过以后这个仓不再自动装，点「重新装满」恢复。</div>`;
    }
    return h;
  }
  // 页签上的小点：这一页有事等你
  tabDot(k) {
    const S = this.S;
    if (k === 'migrate') { const g = Sim.departGate(S); return !!(g && g.ok && !Sim.journeyOf(S).trip); }
    if (k === 'specs') return Object.keys(S.meta.specs).some(id => !S.specAt[id]) || (S.meta.embers > 0 && Object.keys(EMBER_UPS).some(k => S.meta.embers >= emberCost(k, Sim.up(S, k)) && Sim.up(S, k) < EMBER_UPS[k].max));
    if (k === 'scout') return Object.keys(S.poiFound).length > 0 || !!Sim.expPending(S);
    if (k === 'camp') { const c = this.camp(); return !c.depot && !c.focus && (Sim.getB(S, c.furnace) || {}).lvl >= FOCUS_LVL; }
    if (k === 'build') return this.newBld().length > 0;
    return false;
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
      const br = R.b[b.id]; if (!br || !br.status || br.status === '运转中' || br.status === '塔身在长') continue;
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
    // 营地名（主营地名字下面挂着称号）
    const ttl = Sim.titleOf(S), mainId = Sim.journeyOf(S).main;
    for (const c of S.camps) {
      const p = v.project(c.x, c.y, 3.8 + 0.08 * Math.min(25, Sim.getB(S, c.furnace).lvl));
      const nf = full.get(c.id) || 0;
      const F = Sim.focusOf(c);
      const role = c.depot ? '<em class="ctrole dep">补给站</em>' : S.camps.length > 1 && Sim.isMain(S, c) ? '<em class="ctrole">主营地</em>' : '';
      if (p.on) html += `<div class="camptag" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${role}${F ? `<i class="fch xs" style="background:${F.col}" title="${F.n}营地">${F.ch}</i>` : ''}${esc(c.name)}<small> · ${Sim.getB(S, c.furnace).lvl} 级</small>${ttl && (c.id === mainId || S.camps.length === 1) ? `<i class="cttl">${esc(ttl)}</i>` : ''}${nf ? `<b class="ctfull" data-camp="${c.id}" title="${nf} 栋建筑因为仓库满了停工">📦满 ${nf}</b>` : ''}</div>`;
    }
    // 熄火的营地留下的废墟
    for (const r of Sim.journeyOf(S).ruins || []) {
      if (Math.abs(r.y - v.cam.ty) > 30) continue;
      const p = v.project(r.x, r.y, 2.2);
      if (p.on) html += `<div class="camptag ruin" style="transform:translate(${p.x | 0}px,${p.y | 0}px)"><em>废墟</em>${esc(r.n)}</div>`;
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
      let t = ck.ok ? (P.move ? '✓ 挪到这里' : ck.clears ? `✓ 可以建（清掉 ${ck.clears} 处树木/碎石）` : '✓ 可以建') : esc(ck.reason);
      if (ck.blocks && ck.blocks.length) t += `<br><b class="gwarn">⚠ 会挡住旁边的${ck.blocks.join('、')}</b>`;
      const pv = P.prev, fr = v => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10), phone = innerWidth < 700;
      if (pv && P.move) { if (Math.abs(pv.after - pv.now) > 0.05) t += `<br><span class="gline">这座 ${fr(pv.now)} → <b>${fr(pv.after)}</b> ${RES[pv.r].n}/分</span>`; }
      else if (pv) {
        const hit = pv.target != null && pv.after >= pv.target - 1e-6;
        const short = pv.ins.filter(x => x.need > x.spare + 0.05), stuck = pv.add < 0.05 && pv.full > 0;
        if (stuck) t += `<br><span class="gwarn">${short.length ? `缺${short.map(x => RES[x.k].n).join('、')}，建了也不会多产，先补上游` : pv.w && !pv.idle ? '没有空闲的人，建了也没人干活' : `${RES[pv.r].n}暂时不会多产`}</span>`;
        else t += `<br><span class="gline ${hit ? 'hit' : ''}">${pv.named ? `${RES[pv.r].n}线 ${fr(pv.before)} → <b>${fr(pv.after)}</b>/分${pv.target != null ? `（目标 ${fr(pv.target)}）` : ''}` : `${RES[pv.r].n} +${fr(pv.add)}/分`}</span>`;
        if (!phone) {
          if (short.length) t += `<br><span class="gwarn">会多要${short.map(x => `${RES[x.k].n} ${fr(x.need)}/分（现在余 ${fr(x.spare)}）`).join('、')}</span>`;
          else if (pv.ins.length) t += `<br><span class="gok">原料够</span>`;
          if (pv.w) t += `<br><span class="${pv.idle < pv.w ? 'gwarn' : 'gok'}">要 ${pv.w} 人，空闲 ${pv.idle} 人</span>`;
        }
      }
      if (ck.camp >= 0 && P.type !== 'furnace') {
        t += `<br>到仓库 ${ck.dist.toFixed(1)} 格`;
        if (BLD[P.type].gather) t += ` · 资源点 ${ck.spots}`;
        if (ck.syn) t += ` · 联动 +${Math.round(ck.syn * Sim.SYN_PER * 100)}%`;
      }
      if (p.on) html += `<div class="ghosttag ${ck.ok && !(ck.blocks && ck.blocks.length) ? 'ok' : ck.ok || ck.soft ? 'soft' : 'bad'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${t}</div>`;
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
    else if (a.act === 'arrive') g.startArrive();
    else if (a.act === 'migrate') this.open('migrate');
    else if (a.act === 'place' || a.act === 'spot') this.actDo(a.act, a.arg);
    else if (a.act === 'roadopen') this.roadModal();
    else if (a.act === 'netview') { this.netPg = 'all'; this.netFocus = a.arg; this.open('lines'); }
    else if (a.act === 'netroad') { this.netPg = 'road'; this.open('lines'); }
    else if (a.act === 'campgo') { S.active = a.arg; const c = this.camp(); g.view.focus(c.x, c.y); this.open('camp'); }
    else if (a.kind === 'trip') { this.close(); g.view.followTrip = true; }
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
    document.body.classList.toggle('coach-on', !S.meta.tut);
    if (S.meta.tut || this.g.titleOn || this.$('modal').classList.contains('show')) return hide();
    const c = this.camp();
    const steps = TUT.filter(t => !(t.b ? Sim.countType(S, c.id, t.b) > 0 : this.tutSeen[t.k]));
    if (!steps.length) { S.meta.tut = true; hide(); this.toast('新手引导完成。底下那一行小条是老向导，会一句一句提醒下一步，点他的头像看全文；「菜单 → 帮助」里有完整的说明。', 'good'); return; }
    const st = steps[0], i = TUT.indexOf(st) + 1, touch = matchMedia('(pointer:coarse)').matches;
    let el = null, pt = null, msg = '';
    if (st.b) {
      const P = g.place;
      if (P && P.type === st.b) {
        const s = BLD[st.b].size; pt = g.view.project(P.x + s / 2, P.y + s / 2, 0.6);
        msg = touch ? '点一下地面把预览挪过去，再点一次同一处（或按 ✓）就建好了。绿色框表示能建。' : '在地面上点一下就建好了。绿色框表示能建，红色表示不行。';
      } else if (P) { el = this.$('placeNo'); msg = '先取消正在摆放的建筑。'; }
      else if (g.pc && g.pc.bOpen) { // 电脑版：建造是底部横条
        if (g.pc.tier !== 1) { el = document.querySelector('#pcBuild .pct[data-pct="1"]'); msg = '切回「篝火」这一层。'; }
        else { el = document.querySelector(`#pcBuild .pbc[data-arg="${st.b}"]`); msg = `选「${BLD[st.b].n}」。`; }
      }
      else if (this.panel && this.panel.kind === 'build') {
        if (this.buildTier !== 1) { el = this.sheet.querySelector('.tab[data-arg="1"]'); msg = '切回「篝火」这一层。'; }
        else { el = this.sheet.querySelector(`.card[data-arg="${st.b}"]`); msg = `选「${BLD[st.b].n}」。`; if (el && this.tutScroll !== st.b) { this.tutScroll = st.b; el.scrollIntoView({ block: 'nearest' }); } }
      } else { el = document.querySelector('#toolbar button[data-arg=build]'); msg = '点「建造」。'; }
      msg = `<b>建${BLD[st.b].n}</b>${st.why}<br>👉 ${msg}`;
    } else if (st.k === 'stock') { el = this.$('tbProd'); msg = `<b>看物资</b>${st.why}<br>👉 点底部的「生产」。`; }
    else if (st.k === 'goal') { el = this.$('goal'); msg = `<b>看目标</b>${st.why}<br>👉 点顶上的目标栏。`; }
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
  // 打开一个面板。属于某个分区的面板（物资、产线……）顶上带分区的页签；从别的面板里点进来的带一个「‹ 返回」
  open(kind, arg) {
    const prev = this.panel, sameHub = prev && KIND_HUB[kind] && KIND_HUB[prev.kind] === KIND_HUB[kind];
    if (prev && prev.kind === 'build') this.markBuildSeen();
    if (kind === 'build' && (!prev || prev.kind !== 'build')) { const nw = this.newBld(); if (nw.length) this.buildTier = Math.max(...nw.map(k => BLD[k].t)); }
    if (kind === 'log') { this.logOpenSeen = this.logSeen; this.logSeen = this.S.log[this.S.log.length - 1] || null; }
    if (this.tutSeen) { if (kind === 'stock') this.tutSeen.stock = true; if (kind === 'bld' && Sim.getB(this.S, arg)?.type === 'furnace') this.tutSeen.furnace = true; if (kind === 'chapter') this.tutSeen.goal = true; }
    if (KIND_HUB[kind]) (this.hubLast || (this.hubLast = {}))[KIND_HUB[kind]] = kind;
    if (KIND_HUB[kind]) for (const h of this.guideHints()) if (h.hub === KIND_HUB[kind]) h.hubSeen = true;
    // 返回：从一个面板里点开另一个不同分区的面板时记下来；换页签、从地图上点开都不记
    this.back = this.fromSheet && prev && !sameHub && prev.kind !== kind ? { kind: prev.kind, arg: prev.arg } : sameHub ? this.back : null;
    this.fromSheet = false;
    if (this.g.pc && this.g.pc.bOpen) this.g.pc.closeBuild(); // 电脑版：开窗口时收起建造横条
    this.panel = { kind, arg }; this.sheetMode(); this.lastHtml = ''; this.renderPanel(true);
    clearTimeout(this.outT); if (this.sheet.classList.contains('out')) this.sheet.classList.remove('out', 'show');
    void this.sheet.offsetWidth; this.sheet.classList.add('show'); document.body.classList.add('sheet-open'); this.sheet.scrollTop = 0;
    this.hubBar();
    if (kind === 'build') { const on = this.sheet.querySelector('.tabs .tab.on'), tb = on && on.parentElement; if (tb) tb.scrollLeft = Math.max(0, on.offsetLeft - tb.offsetLeft - (tb.clientWidth - on.offsetWidth) / 2); }
    this.syncInset();
    const b = kind === 'bld' ? Sim.getB(this.S, arg) : null;
    if (b) { const s = BLD[b.type].size; this.keepVisible(b.x + s / 2, b.y + s / 2); }
    else if (kind === 'site') { const st = getWorld(this.S.runSeed).sites.find(x => x.id === arg); if (st) this.keepVisible(st.x + 0.5, st.y + 0.5); }
  }
  close() {
    if (this.panel && this.panel.kind === 'build') this.markBuildSeen();
    const was = this.panel; this.panel = null; this.g.view.select(null);
    document.body.classList.remove('sheet-open', 'big-open');
    // 收起时滑出去再藏（期间又打开别的面板就作罢）
    if (was && this.sheet.classList.contains('show')) { this.sheet.classList.add('out'); clearTimeout(this.outT); this.outT = setTimeout(() => { if (!this.panel) this.sheet.classList.remove('show'); this.sheet.classList.remove('out'); }, 160); }
    else this.sheet.classList.remove('show');
    this.back = null; this.hubBar();
    this.syncInset();
  }
  // 底部分区：现在开着的那个亮起来
  hubBar() { const h = this.panel && KIND_HUB[this.panel.kind] || (this.g.pc && this.g.pc.bOpen ? 'build' : null); for (const b of this.$('toolbar').children) b.classList.toggle('on', !!h && b.dataset.arg === h); }
  hubTabs(h) { return HUBS[h].tabs.filter(([k]) => this['p_' + k]); }
  // 点底部的分区：开着的就收起；没开就打开上次看的那一页
  openHub(h) {
    if (h === 'build' && this.g.pc && this.g.pc.on) { this.g.pc.toggleBuild(); return; } // 电脑版：建造是底部横条
    if (this.panel && KIND_HUB[this.panel.kind] === h) { this.close(); return; }
    this.g.cancelModes();
    const tabs = this.hubTabs(h), last = (this.hubLast || {})[h];
    this.back = null; this.fromSheet = false;
    this.open(tabs.some(t => t[0] === last) ? last : HUBS[h].def || tabs[0][0]);
  }
  // 面板挡住的那块不算画面：PC 右侧面板把画面中心往左挪，手机底部面板把它往上挪
  pcSheet() { return matchMedia('(orientation:landscape) and (min-width:761px)').matches && !(this.g.pc && this.g.pc.on); }
  // 电脑版：大多数面板在屏幕中间开大窗口，点地图上的东西开的在左下小信息窗
  sheetMode() {
    const pc = !!(this.g.pc && this.g.pc.on), k = this.panel && this.panel.kind, insp = pc && !!k && this.g.pc.isInsp(k), big = pc && !!k && !insp;
    this.sheet.classList.toggle('big', big); this.sheet.classList.toggle('insp', insp);
    document.body.classList.toggle('big-open', big);
  }
  syncInset() {
    const open = !!this.panel && this.sheet.classList.contains('show');
    let x = 0, y = 0;
    if (open && !(this.g.pc && this.g.pc.on)) { if (this.pcSheet()) x = (this.sheet.offsetWidth + 20) / 2; else y = Math.max(0, Math.min(this.sheet.offsetHeight, innerHeight * 0.6) - 80) / 2; }
    this.g.view.setInset(x, y);
  }
  // 打开某个东西的面板时，它要是会被面板挡住，就把镜头移过去
  keepVisible(wx, wy) {
    const v = this.g.view, p = v.project(wx, wy, 0.6), c = v.inset || [0, 0], t = v.insetT || [0, 0];
    if (!p.on) { v.focus(wx, wy); return; }
    const nx = p.x - (t[0] - c[0]), ny = p.y - (t[1] - c[1]);
    if (this.g.pc && this.g.pc.on) { if (nx < 430 && ny > innerHeight - 560 || nx > innerWidth - 40 || ny < 80 || ny > innerHeight - 40) v.focus(wx, wy); }
    else if (this.pcSheet()) { if (nx > innerWidth - this.sheet.offsetWidth - 70 || nx < 40) v.focus(wx, wy); }
    else if (ny > innerHeight - this.sheet.offsetHeight - 50 || ny < 150) v.focus(wx, wy);
  }
  renderPanel(force) {
    if (!this.panel) return;
    if (this.sheetDown && !force) return;
    if (!force && performance.now() - (this.sheetScrollT || 0) < 450) return;
    const f = this['p_' + this.panel.kind];
    if (!f) return;
    const tk = this.panel.kind, hub = KIND_HUB[tk], tabs = hub && this.hubTabs(hub);
    const tb = tabs && tabs.length > 1 ? `<div class="ptabs">${tabs.map(([k, n]) => `<button class="${k === tk ? 'on' : ''}" data-act="htab" data-arg="${k}">${n}${k !== tk && this.tabDot(k) ? '<i class="tdot"></i>' : ''}</button>`).join('')}</div>` : '';
    const bk = this.back ? '<button class="bk" data-act="back" title="返回" aria-label="返回">‹</button>' : '';
    const ff = this['pf_' + tk], ft = ff ? ff.call(this) : ''; // 面板底部固定的主按钮（有就放）
    const ttl = f.call(this, 'title'); if (!this.panel || this.panel.kind !== tk) return; // 面板自己关掉了（排队的建筑刚开工、目标没了）
    const body = f.call(this, 'body'); if (!this.panel || this.panel.kind !== tk) return;
    const html = `<div class="phead ${tb ? 'tabbed' : ''}">${bk}<b>${ttl}</b><span class="pesc">按 <kbd>Esc</kbd> 或右键关上</span><button class="x" data-act="close">✕</button>${tb}</div><div class="pbody">${body}</div>${ft ? `<div class="pfbar">${ft}</div>` : ''}`;
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
  newBld(t) { const S = this.S, seen = this.seenB(); return BLD_KEYS.filter(k => Sim.unlocked(S, k) && (t == null || BLD[k].t === t) && !seen[k]); }
  markBuildSeen() { const seen = this.seenB(); for (const k of this.bNewShown || []) seen[k] = 1; this.bNewShown = null; }
  p_build(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '建造';
    let tabs = '<div class="tabs" data-sx="btabs">';
    for (let t = 1; t <= 7; t++) tabs += `<button class="tab ${t === this.buildTier ? 'on' : ''} ${t > S.known ? 'locked' : ''} ${t !== this.buildTier && this.newBld(t).length ? 'hasnew' : ''}" data-act="btier" data-arg="${t}">${t > S.known ? '🔒' : ''}${TIER_NAMES[t]}</button>`;
    tabs += '</div>';
    const list = BLD_KEYS.filter(k => BLD[k].t === this.buildTier && k !== 'furnace' && !BLD[k].wonder && (!(BLD[k].rule || BLD[k].tower) || Sim.unlocked(S, k) || Sim.countType(S, c.id, k))); // 北境地貌的建筑只在那种站里出现
    if (this.buildTier === 1) list.push('furnace');
    const seen = this.seenB(), shown = [];
    let cards = '';
    for (const k of list) {
      const d = BLD[k];
      const locked = !Sim.unlocked(S, k), far = locked && d.t <= S.known;
      const cost = k === 'furnace' ? Sim.buildCost(S, k, c.id, Math.round(c.y + 20)) : Sim.buildCost(S, k, c.id, c.y);
      const n = Sim.countType(S, c.id, k);
      const fresh = !locked && !seen[k], short = !locked && !Sim.canAfford(c.stock, cost);
      if (fresh) shown.push(k);
      cards += `<div class="card ${locked ? 'locked' : ''} ${short ? 'short' : ''}" data-act="${locked ? '' : 'place'}" data-arg="${k}">
        <div class="ci pic">${this.ico(k, k === 'furnace' ? 2 : 1)}${fresh ? '<i class="cnew">新</i>' : ''}${n ? `<i class="chave">${n}</i>` : ''}</div>
        <div class="cb"><div class="cn">${k === 'furnace' ? '前哨熔炉<small class="cnx">（新营地）</small>' : d.n}${n ? ` <small class="chas">已有 ${n}</small>` : ''}${(Sim.campSpecOf(c) || { b: [] }).b.includes(k) ? `<i class="spec-tag">特产 +${this.specPct()}%</i>` : ''}</div>
        <div class="cd">${esc(d.desc)}</div>
        <div class="cc">${far ? `🔒 ${esc(Sim.stageLock(S, k))}` : locked ? `需要侦察到「${TIER_NAMES[d.t]}」纬度` : costHtml(c.stock, cost)}${k === 'furnace' ? ' <small class="cnx">（越往北越贵）</small>' : ''}</div>
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
    if (!e.ev || (!e.on && e.inSec > Sim.forecastOf(S))) return `<div class="row sub"><span></span><span>${Sim.forecastOf(S) > 3600 ? "两小时" : "一小时"}内没有冰风暴、极寒夜或冰湖开裂的预报。</span></div>`;
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
      fx.push(['物流网的路 / 侦察队', `慢 ${Math.round((1 - Sim.WXE_SLOW) * 100)}%`]);
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
    const cs = Sim.coldAt(S), cold = cs && (cs.on || cs.fc);
    const z = Sim.tideAt(S), tide = z && (z.on || z.fc);
    if (part === 'title') return `${P.on ? '暴风雪中' : z && z.on ? '永冬潮中' : cs && cs.on ? '寒潮中' : '天气预报'} <small>${esc(c.name)}</small>`;
    const e = Sim.wxeAt(S, S.t), evFirst = e.ev && (e.on || (!P.on && e.inSec < P.inSec && e.inSec <= Sim.forecastOf(S)));
    const evh = `<div class="sec">${e.on ? '眼下的天气' : '其他天气'}</div>` + this.wxeCard(c, cr);
    const ch = cs ? `<div class="sec">寒潮季</div>` + this.coldCard(c, cr, cs) : '';
    const th = z ? `<div class="sec">永冬潮</div>` + this.tideCard(c, cr, z) : '';
    return (tide ? th : '') + (cold ? ch : '') + (evFirst ? evh + '<div class="sec">暴风雪</div>' : '') + this.p_weatherBliz(c, cr, P) + (evFirst ? '' : evh) + (cold ? '' : ch) + (tide ? '' : th);
  }
  // 1.1 永冬潮：第几波、多久到、多冷、燃料够不够、霜巨兽打不打得过、挺过去有什么
  tideCard(c, cr, z) {
    const S = this.S, T = Sim.TIDE, C = Sim.tideOf(S) || {};
    if (!z.on && !z.fc) return `<div class="row sub"><span>第 ${z.n} 波</span><span>大约 ${fmtTime(z.inSec)} 后（提前 ${Math.round(Sim.tideLead(S) / DAY_LEN)} 天报）</span></div>` + (C.end ? `<div class="row sub"><span>上一波</span><span>第 ${C.end} 波${(S.meta.tideBest || 0) >= C.end ? '挺过去了' : '没挺住'}</span></div>` : '');
    const m = T.fuel, burn = cr.burnPerMin || 0, cold = Sim.coldNow(S), base = z.on ? burn / Math.max(m, cold ? Sim.coldFuel(S) : 1) : burn, need = base * m * (z.on ? z.left : T.len) / 60, have = cr.fuelUnits || 0;
    const tIn = Math.round((cr.tH ?? c.temp) - (z.on ? 0 : z.drop)), tc = tIn >= 2 ? 'ok' : tIn >= -8 ? 'warn' : 'bad';
    let h = `<div class="wxhero tide ${z.on ? 'on' : z.inSec <= 600 ? 'near' : ''}"><div class="wxi">🌌</div><div><b>${z.on ? `永冬潮第 ${z.n} 波，还剩 ${fmtTime(z.left)}` : `第 ${z.n} 波约 ${fmtTime(z.inSec)} 后到`}</b><small>持续一天半 · 气温 −${z.drop}° · 熔炉烧 ${m} 倍燃料 · 户外采集 ${Math.round(Sim.tideGather(S) * 100)}%${Sim.techDone(S, 'botshell') ? '（自动机不受影响）' : ''}</small></div></div>`;
    h += `<div class="row nw"><span>屋里体感</span><span>${z.on ? '现在' : '潮里约'} <b class="${tc}">${tIn}°</b>${tIn >= 2 ? '，没人会冻着' : '，会有人冻伤：升级帐篷、造暖炉，或者让熔炉超载'}</span></div>`;
    h += `<div class="row nw"><span>燃料</span><span>${z.on ? '剩下这段' : '这一波'}要烧约 ${fmt(need)} · 现在有 ${fmt(have)} ${have >= need ? '<b class="ok">✔ 够</b>' : '<b class="bad">✖ 不够</b>'}${z.on ? '' : '<small>（物流网在帮每座营地补）</small>'}</span></div>`;
    const bv = Sim.beastView(S, z);
    if (bv) h += `<div class="row nw"><span>霜巨兽</span><span>${bv.done ? (bv.won ? '<b class="ok">✔ 打退了</b>' : '<b class="bad">闯进来过</b>，冻住的建筑过一阵会化开') : `${bv.in > 0 ? fmtTime(bv.in) + '后' : '马上'}冲「${esc(bv.name)}」 · 强度 ${bv.str} · 防御 ${bv.def} ${bv.def >= bv.str ? '<b class="ok">✔ 守得住</b>' : Sim.colossusReady && Sim.colossusReady(S) && Sim.wonderOn(S, 'wcolossus') ? '<b class="warn">靠蒸汽巨像吓走</b>' : '<b class="bad">✖ 守不住</b>'}`}<br><small>守不住：几座建筑冻住 ${T.frz / 60} 分钟，几个人冻伤病倒，不会死人</small></span></div>`;
    const best = S.meta.tideBest || 0;
    h += `<div class="row sub nw"><span>挺过去</span><span>没人冻伤、霜巨兽没闯进来：余烬 +${T.embers * z.n}，每座营地希望 +${T.hope}${best < 5 ? '<br>挺过第 5 波：专属炉火「霜白」和称号「永冬守火人」' : best < 10 ? '<br>挺过第 10 波：专属炉火「永冬」和称号「十潮不灭」' : ''}</span></div>`;
    return h;
  }
  // 1.1 寒潮：多久到、这一天要烧多少燃料、屋里会不会冻着、挺过去有什么
  coldCard(c, cr, cs) {
    const S = this.S, m = Sim.coldFuel(S), C = Sim.COLD;
    if (!cs.on && !cs.fc) return `<div class="row sub"><span>下一次寒潮</span><span>大约 ${fmtTime(cs.inSec)} 后（提前 ${Math.round(Sim.coldLead(S) / DAY_LEN)} 天报）</span></div>`;
    const burn = cr.burnPerMin || 0, base = cs.on ? burn / m : burn, need = base * m * (cs.on ? cs.left : C.len) / 60, have = cr.fuelUnits || 0;
    const tIn = Math.round((cr.tH ?? c.temp) - (cs.on ? 0 : C.drop)), tc = tIn >= 2 ? 'ok' : tIn >= -8 ? 'warn' : 'bad';
    let h = `<div class="wxhero ${cs.on ? 'on' : cs.inSec <= 300 ? 'near' : ''}"><div class="wxi">🌨</div><div><b>${cs.on ? `寒潮中，还剩 ${fmtTime(cs.left)}` : `约 ${fmtTime(cs.inSec)} 后寒潮来袭`}</b><small>持续一整天 · 熔炉烧 ${m} 倍燃料 · 户外采集 ${Math.round(Sim.coldGather(S) * 100)}% · 气温 −${C.drop}°${Sim.coldBliz(S, cs) ? ' · 和暴风雪撞在一起' : ''}</small></div></div>`;
    h += `<div class="row"><span>屋里体感</span><span>${cs.on ? '现在' : '寒潮里约'} <b class="${tc}">${tIn}°</b>${tIn >= 2 ? '，没人会冻着' : '，会有人冻伤：升级帐篷、造暖炉，或者让熔炉超载'}</span></div>`;
    h += `<div class="row"><span>燃料</span><span>${cs.on ? '剩下这段' : '这一天'}要烧约 ${fmt(need)} · 现在有 ${fmt(have)} ${have >= need ? '<b class="ok">✔ 够</b>' : '<b class="bad">✖ 不够</b>'}${cs.on ? '' : '<small>（物流网在帮每座营地补）</small>'}</span></div>`;
    h += `<div class="row sub"><span>挺过去</span><span>哪座营地没人冻伤，那里希望 +${C.hope}；全都没人冻伤，再给余烬 +${C.embers}</span></div>`;
    return h;
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
    const pic = this.pic(q.type, 1);
    let h = `<div class="bhero"><div class="hpic">${pic}</div><div><div class="status warn">等材料</div><div class="desc">${esc(d.desc)}</div></div></div>`;
    h += `<div class="row"><span>需要</span><span>${costHtml(c.stock, cost, S.known)}</span></div>`;
    h += `<div class="row"><span>还缺</span><span>${miss.length ? miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') : '齐了，马上开工'}</span></div>`;
    for (const k of miss) { const w = this.netWait(c, k); if (w) h += `<div class="row sub"><span>${RICON[k]}${RES[k].n}</span><span>${w}</span></div>`; }
    h += `<div class="row sub"><span>队列</span><span>「${esc(c.name)}」第 ${n} / ${mine.length} 个 · 材料到齐按顺序自动开工</span></div>`;
    h += `<button class="btn wide ghost" data-act="unqueue" data-arg="${q.id}">取消排队</button>`;
    return h;
  }

  // 雪橇棚：车队有几辆车、这一程还差多少、排队造车
  shedHtml(b, c) {
    const S = this.S, J = Sim.journeyOf(S), V = Sim.VEH, P = Sim.tripPlan(S);
    let h = `<div class="sec">车队</div>`;
    h += `<div class="row"><span>现有</span><span>🛷 雪橇 ${J.fleet.sled || 0} 架${J.fleet.tractor || J.stage >= V.tractor.from ? ` · 蒸汽拖车 ${J.fleet.tractor || 0} 台` : ''}${J.fleet.icebreaker || J.stage >= V.icebreaker.from ? ` · 破冰车 ${J.fleet.icebreaker || 0} 台` : ''}</span></div>`;
    const big = J.stage >= V.icebreaker.from ? 'icebreaker' : J.stage >= V.tractor.from ? 'tractor' : null;
    if (P.to) h += `<div class="row sub"><span>往「${esc(P.to.n)}」</span><span>${P.roomOk ? `装得下：${P.people} 人和货共 ${fmt(P.load)} 份，车上能装 ${fmt(P.cap)}` : `还差 ${fmt(P.lack)} 份地方，大约 ${Math.ceil(P.lack / V.sled.cap)} 架雪橇${big ? `或 ${Math.ceil(P.lack / V[big].cap)} 台${V[big].n}` : ''}`}</span></div>`;
    const sp = Sim.vehSpeed(S, b);
    const vq = b.vq || [];
    if (vq.length) {
      const q = vq[0];
      h += `<div class="row vq"><span>${sp > 0 ? '在造' : '停着'} · ${Sim.vehName(q.v)}</span><span>${sp > 0 ? `还要 ${fmtTime((1 - q.p) * V[q.v].secs / sp)}` : '先派人'} <button class="small" data-act="vehx" data-arg="${b.id}:0">撤</button></span></div>`;
      h += `<div class="bar"><i style="width:${(q.p * 100).toFixed(0)}%"></i></div>`;
      for (const v of Sim.VEH_KEYS) {
        let n = 0, last = -1; vq.forEach((x, i) => { if (i && x.v === v) { n++; last = i; } });
        if (n) h += `<div class="row sub vq"><span>排队 · ${Sim.vehName(v)} ×${n}</span><span><button class="small" data-act="vehx" data-arg="${b.id}:${last}">撤 1 ${v === 'sled' ? '架' : '台'}</button></span></div>`;
      }
    }
    for (const v of Sim.VEH_KEYS) {
      const why = Sim.vehBlock(S, b, v), locked = V[v].from && J.stage < V[v].from;
      h += `<div class="row"><span>${Sim.vehName(v)}<small>装 ${V[v].cap} 份（${V[v].cap / Sim.PERSON_LOAD} 个人）· ${v === 'sled' ? '路上烧木柴' : v === 'tractor' ? '路上烧煤，没有雪橇时快一半' : '路上烧电池，冰面和裂谷直接开过去'}</small></span><span>${locked ? `<small>${esc(why)}</small>` : `${costHtml(c.stock, V[v].cost, S.known)} <button class="small ${why ? '' : 'go'}" data-act="veh" data-arg="${b.id}:${v}:1">造 1 ${v === 'sled' ? '架' : '台'}</button>${v === 'sled' ? ` <button class="small" data-act="veh" data-arg="${b.id}:${v}:5">造 5 架</button>` : ''}`}</span></div>`;
    }
    return h;
  }
  // 1.1 熟练工：名字旁边的小星（亮几颗是几级）
  skillStars(b) { if (!Sim.skillable(b)) return ''; const l = Sim.skillLvl(b); return l ? ` <i class="skst" title="熟练 ${l} 级">${'✦'.repeat(l)}<span>${'✦'.repeat(Sim.SKILL_MAX - l)}</span></i>` : ''; }
  skillRow(b) {
    if (!Sim.skillable(b)) return '';
    const S = this.S, l = Sim.skillLvl(b), nx = Sim.skillNext(S, b), pend = b.wDrop != null ? Math.max(0, Math.ceil(Sim.SKILL_GRACE - (S.t - b.wDrop))) : 0;
    return `<div class="row sub"><span>熟练工</span><span>${l ? `${l} 级 · 产量 +${Math.round(l * Sim.SKILL_PER * 100)}%` : '还是生手'}${nx ? `<small>（满员再干 ${fmtTime(nx.min * 60)} 升 ${nx.lvl} 级）</small>` : '<small>（练到顶了）</small>'}${pend && (b.xp || 0) > 0 ? `<br><b class="warn">人手少了：${pend} 秒内补回来，熟练度不会掉</b>` : ''}</span></div>`;
  }
  // 1.1 替代配方：两套配方并排，点哪套换哪套（换一次停工 20 秒）
  altHtml(b) {
    const S = this.S, alt = Sim.altDef(b.type), ok = Sim.altOk(S, b.type), sw = b.altT > S.t;
    const rc = D => `${Object.keys(D.in).map(k => RICON[k] + fmt(D.in[k])).join(' ')} → ${Object.keys(D.out).map(k => RICON[k] + fmt(D.out[k])).join(' ')}`;
    const opt = (on, D) => `<button class="achip ${!!b.alt === on ? 'on' : ''}" data-act="altset" data-arg="${b.id}:${on ? 1 : 0}" ${(on && !ok) || sw ? 'disabled' : ''}><b>${on ? '替代配方' : '原配方'}</b><small>${rc(D)}</small></button>`;
    const sub = sw ? `正在换，还要 ${Math.ceil(b.altT - S.t)} 秒` : ok ? `换一次停工 ${ALT_SWITCH} 秒` : `研究「${Sim.ALT_TECH[Sim.altTech(b.type)]}」后能换`;
    return `<div class="sec">配方 <small>${sub}</small></div><div class="achips">${opt(false, BLD[b.type])}${opt(true, alt)}</div>`;
  }
  p_bld(part) {
    const S = this.S, b = Sim.getB(S, this.panel.arg);
    if (!b) { this.close(); return ''; }
    const d = Sim.bdef(b), c = Sim.getCamp(S, b.camp), R = Sim.rt(S), br = R.b[b.id] || {}, cr = R.c[c.id] || {};
    if (part === 'title') return d.wonder ? `${d.n} <small>奇观 · ${esc(c.name)}</small>` : d.tower ? `${Sim.towerName(b.tn)} <small>${esc(c.name)}</small>` : `${d.n}${this.skillStars(b)} <small>${b.lvl} 级 · ${esc(c.name)}</small>`;
    let h = '';
    const pic = this.pic(b.type, d.wonder ? 4 : b.lvl);
    h += `<div class="bhero"><div class="hpic">${pic}</div><div>`;
    if (br.status) h += `<div class="status ${(['运转中', '研究中', '塔身在长', '塔身建好了，等点火', '建成了'].includes(br.status) || WONDER_PH.some(P => br.status === P.n + '中')) ? 'ok' : 'bad'}">${esc(br.status)}</div>`;
    h += `<div class="desc">${esc(d.desc)}</div></div></div>`;
    if (c.depot && b.type === 'furnace') h += this.depotHtml(c);
    else if (Sim.depotAuto(c)) h += `<button class="mlink" data-act="tb" data-arg="camp"><span>🏚️</span><span>「${esc(c.name)}」是补给站<small>自己运转，不升级。要改先在营地面板里「临时接手」</small></span><i>›</i></button>`;
    if (d.tower) return h + this.towerHtml(b, c, br);
    if (d.wonder) return h + this.wonderHtml(b, c, br);
    if (b.type === 'workshop') { const T = S.tech || {}, ct = T.cur && Sim.techDef(S, T.cur); h += `<button class="mlink" data-act="tb" data-arg="research"><span>🔬</span><span>${ct ? `正在研究「${ct.n}」 ${Math.floor(T.prog / ct.pts * 100)}%` : '挑一项研究'}<small>这座工程站每分钟 ${fmt(br.rp || 0)} 点</small></span><i>›</i></button>`; }
    const mx = Sim.bMax(S, b);
    if (mx) {
      h += `<div class="row"><span>${b.type === 'warehouse' ? '搬运工' : '工人'}</span><span class="stepper"><button data-act="w-" data-arg="${b.id}">−</button><b>${b.workers}/${mx}</b><button data-act="w+" data-arg="${b.id}">＋</button><button class="small" data-act="wmax" data-arg="${b.id}">满</button></span></div>`;
      h += `<div class="row sub"><span>营地空闲人手</span><span>${Sim.idleLabor(S, c)}</span></div>`;
      const same = b.type !== 'furnace' ? Sim.sameType(S, b) : [];
      if (same.length > 1) { const sf = Sim.staffOf(S, b); h += `<div class="row sub bulkr"><span>同类 ${same.length} 栋</span><span>共 ${sf.w}/${sf.mx} 人<button class="bulkb" data-act="bulkw" data-arg="${b.id}" ${sf.w >= sf.mx ? 'disabled' : ''}>${sf.w >= sf.mx ? '都满了' : '都派满'}</button></span></div>`; }
    }
    h += this.skillRow(b);
    if (!d.out && Sim.campSpecFx(S, b, c) > 0) h += `<div class="row sub"><span>营地特产</span><span>${b.type === 'workshop' ? '研究' : b.type === 'tower' ? '威力' : '热量'} +${this.specPct()}%<small>（「${esc(c.name)}」的特产）</small></span></div>`;
    if (d.out) {
      const rate = br.rate || {};
      h += `<div class="row"><span>产出</span><span>${Object.keys(d.out).map(k => `${RICON[k]}${fmt(rate[k] || 0)}`).join(' ')}<small>/分</small></span></div>`;
      if (d.in) h += `<div class="row"><span>消耗</span><span>${Object.keys(d.in).map(k => `${RICON[k]}${fmt((br.inRate || {})[k] || 0)}`).join(' ')}<small>/分</small></span></div>`;
      if (Sim.altDef(b.type)) h += this.altHtml(b);
      { const B = Sim.prodBonus(S, b, c), pc = x => Math.round(x * 100);
        h += `<div class="row sub"><span>等级、加成</span><span>${b.lvl} 级 ×${Sim.levelMul(b.lvl).toFixed(2)} · 加成 ${B.sum >= 0 ? '+' : ''}${pc(B.sum)}%${B.parts.length ? `<small>（${B.parts.map(p => `${p[0]} ${p[1] >= 0 ? '+' : ''}${pc(p[1])}`).join(' · ')}）</small>` : ''}</span></div>`; }
      h += `<div class="row sub"><span>到最近仓库</span><span>${(br.dist || 0).toFixed(1)} 格 · 占用搬运工 ${fmt(br.haul || 0)}</span></div>`;
      const syn = R.adj.get(b.id) || 0;
      if (d.syn) h += `<div class="row sub"><span>相邻联动</span><span>${syn ? '+' + Math.round(syn * Sim.SYN_PER * 100) + '%' : '无'} <small>（贴着${d.syn.map(t => BLD[t].n).join('/')}）</small></span></div>`;
      if (d.gather) {
        const sp = R.gatherSpots.get(b.id) || [];
        let left = 0, alive = 0, young = 0, grow = 0; const tended = Sim.tendedSpots(S);
        for (const s of sp) { const l = Sim.harvestLeft(S, s.i); left += l; if (l > 0) alive++; if (Sim.isSapling(S, s.i)) young++; if (Sim.spotLeft(S, s.i) < Sim.spotMax(S, s.i)) grow += Sim.regrowRate(S, s.i, tended); }
        const eta = Sim.gatherEta(S, b);
        h += `<div class="row sub"><span>附近资源点</span><span>${alive} 处可采 · 剩 ${fmt(left)}${eta != null && eta > 0 && !b.deep ? ` · <b class="${eta < 20 ? 'warn' : ''}">按现在的速度还能挖约 ${fmtMin(eta)}</b>` : ''}</span></div>`;
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
    if (b.type === 'tent') h += `<div class="row"><span>床位</span><span>${Sim.housingOf(b, S)} 人 · 保温 +${Sim.insulOf(b)}°</span></div>`;
    if (b.type === 'warehouse') h += `<div class="row"><span>仓储</span><span>每种物资上限 ${fmt(cr.cap)}</span></div>`;
    if (b.type === 'tower') h += `<div class="row"><span>威力</span><span>${Math.round(Sim.towerPower(b.lvl))}</span></div>`;
    if (b.type === 'sledshed') h += this.shedHtml(b, c);
    if (b.type === 'heater') h += `<div class="row"><span>加温</span><span>+${Math.round(BLD.heater.heat * (1 + 0.5 * (b.lvl - 1)))}° · 烧煤 ${fmt(BLD.heater.burn * b.lvl)}/分</span></div>`;
    if (b.type === 'bay') h += this.bayHtml(b, c);
    if (b.type === 'kennel') {
      const n = Sim.kennelDogs(b.lvl), br = Sim.rt(S).b[b.id] || {}, all = Sim.dogsOf(S, c.id);
      h += `<div class="row"><span>雪橇犬</span><span>${Math.round(br.dogs || 0)}/${n} 只能拉雪橇 · ${b.workers ? `吃生肉 ${fmt(n * BLD.kennel.feed)}/分${(br.fed ?? 1) < 0.95 ? ' <b class="warn">没喂饱</b>' : ''}` : '没人看：狗放出去自己找吃的了'}</span></div>`;
      h += `<div class="row sub"><span>全营地</span><span>${Math.round(all)} 只 → 侦察队 +${Math.round(Sim.dogScout(S, c.id) * 100)}%${Sim.roadsAt(S, c.id).length ? ` · 连着的路运力 +${Math.round(Math.max(...Sim.roadsAt(S, c.id).map(r => Sim.roadDogs(S, r))) * 100)}%` : ' · 修了路也会运得更多'}</span></div>`;
      h += `<div class="hint">每只喂饱的狗让侦察队快 5%（最多 +60%），让连着这座营地的路多运 3%（最多 +45%，铁路减半）。</div>`;
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
      if (b.type === 'tent') fx.push(`床位 ${Sim.housingOf(b, S)}→${Sim.housingOf(nb, S)}`, `保温 +${Sim.insulOf(b)}→+${Sim.insulOf(nb)}°`);
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
    if (b.type !== 'furnace' && !Sim.moveBlock(S, b)) h += `<button class="btn wide" data-act="movebld" data-arg="${b.id}">↔ 挪位置 <small>不花材料，等级和工人都留着</small></button>`;
    if (b.type !== 'furnace') h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">拆除（返还一半基础材料）</button>`;
    // 升级按钮钉在面板底部，往下翻也一直看得到
    { const can = Sim.canAfford(c.stock, cost), locked = Object.keys(cost).some(k => RES[k].t > S.known);
      const btn = can ? `<button class="btn go" data-act="upgrade" data-arg="${b.id}">⬆ 升级</button>`
        : locked ? `<button class="btn" data-act="upgrade" data-arg="${b.id}">⬆ 升级</button>`
        : `<button class="btn qup ${b.qup ? 'on' : ''}" data-act="qup" data-arg="${b.id}" title="${b.qup ? '已排队：材料到齐自动升级（点一下取消）' : '材料到齐后自动升级'}">${b.qup ? '⏳ 已排队' : '⏳ 排队升级'}</button>`;
      h += `<div class="pfoot"><span class="pfc"><small>升到 ${b.lvl + 1} 级${b.qup && !can ? ' · 材料到了自动升' : ''}</small><span>${costHtml(c.stock, cost, S.known)}</span></span>${btn}</div>`; }
    return h;
  }

  // 烽火塔：地基 → 塔身（几种高级材料一起喂）→ 点火
  towerHtml(b, c, br) {
    const S = this.S, sp = Sim.towerSpec(S, b.tn), T = b.tw, st = T.lit ? 3 : T.p >= sp.dur ? 2 : 1;
    let h = `<div class="twsteps">${['地基', '塔身', '点火'].map((n, i) => `<span class="${i < st ? 'ok' : i === st ? 'on' : ''}">${i < st ? '✓' : i + 1} ${n}</span>`).join('<i>›</i>')}</div>`;
    const mm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (!T.lit) {
      h += `<div class="row"><span>塔身</span><span>${mm(T.p)} / ${mm(sp.dur)} <small>（游戏时间）</small></span></div><div class="mbar tw"><i style="width:${(T.p / sp.dur * 100).toFixed(1)}%"></i></div>`;
      if (T.p < sp.dur) {
        for (const k of sp.kinds) { const short = br.status === '缺' + RES[k].n, have = c.stock[k] || 0, pr = Sim.prodRate(S, k);
          h += `<div class="row sub"><span>${RICON[k]} ${RES[k].n}</span><span>每分钟 ${fmt(sp.rate)} · 库存 ${fmt(have)} · 现在产 ${fmt(pr)}/分${short ? ' <b class="warn">缺货，塔身停着</b>' : pr < sp.rate ? ' <b class="warn">产得比塔吃得慢</b>' : ''}</span></div>`; }
        h += `<div class="row sub"><span>搬运</span><span>${(br.dist || 0).toFixed(1)} 格 · 占用搬运工 ${fmt(br.haul || 0)}</span></div>`;
        h += `<div class="hint">几种材料都够量时塔身才往上长，缺一种就停，但不会倒退。塔是真的把货用掉，产线要有余量；章节的产能目标照算毛产量，喂进塔里的也算。</div>`;
        h += `<div class="row sub"><span>点火要</span><span>${costHtml(c.stock, sp.fuel, S.known)}</span></div>`;
      } else {
        const ck = Sim.towerIgniteCheck(S, b);
        h += `<div class="hint">塔身砌好了。交齐燃料就能点火，光柱会一直亮着。</div>`;
        h += `<div class="pfoot"><span class="pfc"><small>点火要</small><span>${costHtml(c.stock, sp.fuel, S.known)}</span></span><button class="btn go" data-act="ignite" data-arg="${b.id}" ${ck.ok ? '' : 'disabled'}>🔥 点火</button></div>`;
      }
    } else {
      h += `<div class="row"><span>已经点亮</span><span>${fmtTime(S.t - (T.litT || S.t))}前</span></div>`;
      h += `<div class="row sub"><span>效果</span><span>「${esc(c.name)}」希望 +${TOWER_FX.hope} · 暖圈 +${TOWER_FX.warm} 格（只管这座营地）</span></div>`;
      h += `<div class="hint">塔顶的光柱一直亮着，营地留守还是熄火都不影响。往南望，能看见前一座塔的光。</div>`;
    }
    h += `<div class="row sub"><span>北境的塔</span><span>已点亮 ${Sim.towersLit(S)} / ${Sim.TOWER_N} 座</span></div>`;
    if (!Sim.moveBlock(S, b)) h += `<button class="btn wide" data-act="movebld" data-arg="${b.id}">↔ 挪位置 <small>塔身开始长之前还能挪</small></button>`;
    if (!T.lit && !T.p) h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">拆掉地基（返还一半材料）</button>`;
    return h;
  }

  // 1.1 奇观工地：三期进度、这一期每种料吃多少、缺什么
  wonderHtml(b, c, br) {
    const S = this.S, W = WONDERS[b.type], wd = b.wd || { ph: 0, p: 0 }, done = Sim.wonderDone(b);
    let h = `<div class="twsteps">${WONDER_PH.map((P, i) => `<span class="${i < wd.ph ? 'ok' : i === wd.ph ? 'on' : ''}">${i < wd.ph ? '✓' : i + 1} ${P.n}</span>`).join('<i>›</i>')}</div>`;
    h += `<div class="row nw"><span>效果</span><span>${esc(W.d)}<br><small>建成后这一程一直有效，所有营地都算</small></span></div>`;
    if (!done) {
      const sp = Sim.wonderSpec(b.type, wd.ph), mul = Sim.feedMul(S, c), left = 1 - wd.p / sp.dur;
      h += `<div class="row"><span>${sp.n}</span><span>${Math.floor(wd.p / sp.dur * 100)}% <small>· 全部 ${Math.floor(Sim.wonderProg(b) * 100)}%${mul > 1 ? ` · 施工 ×${fmt(mul)}` : ''}</small></span></div><div class="mbar tw"><i style="width:${(wd.p / sp.dur * 100).toFixed(1)}%"></i></div>`;
      for (const k of sp.kinds) {
        const short = br.status === '缺' + RES[k].n, have = c.stock[k] || 0, pr = Sim.prodRate(S, k), r = sp.rate[k] * mul;
        h += `<div class="row sub"><span>${RICON[k]} ${RES[k].n}</span><span>还要 ${fmt(sp.amt[k] * left)} · 每分钟 ${fmt(r)} · 库存 ${fmt(have)} · 现在产 ${fmt(pr)}/分${short ? ' <b class="warn">缺货，工地停着</b>' : pr < r && have < sp.amt[k] * left ? ' <b class="warn">产得比工地吃得慢</b>' : ''}</span></div>`;
      }
      h += `<div class="row sub"><span>搬运</span><span>${(br.dist || 0).toFixed(1)} 格 · 占用搬运工 ${fmt(br.haul || 0)}</span></div>`;
      const nx = WONDER_PH.map((P, i) => i > wd.ph ? `${P.n}：${Object.entries(W.ph[i]).map(([k, v]) => `${RICON[k]}${fmt(v)}`).join(' ')}` : '').filter(Boolean);
      if (nx.length) h += `<div class="row sub"><span>后面</span><span>${nx.join('<br>')}</span></div>`;
      h += `<div class="hint">几种料都够量时工地才往前走，缺一种就停，但不会倒退。物流网会把这一期要的料往这儿送；城的施工快 25%，号令「万众一心」快 3 倍。</div>`;
    } else {
      const w = Sim.wonderList(S).find(x => x.w === b.type);
      h += `<div class="row"><span>落成</span><span>${w ? fmtTime(S.t - w.t) + '前' : ''}</span></div>`;
      if (b.type === 'wcolossus') h += `<div class="row sub"><span>今天</span><span>${Sim.colossusReady(S) ? '还能吓退一次袭营' : '已经出过手了，明天再来'}</span></div>`;
      h += `<div class="hint">营地熄火走了，奇观照样立在这儿，效果一直都在。</div>`;
    }
    if (!Sim.moveBlock(S, b)) h += `<button class="btn wide" data-act="movebld" data-arg="${b.id}">↔ 挪位置 <small>开工之前还能挪</small></button>`;
    if (!wd.ph && !wd.p) h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">拆掉工地（返还一半材料）</button>`;
    return h;
  }
  // 建造 › 奇观：六种奇观，有没有图纸、在哪儿建的、建到哪了
  p_wonder(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return `奇观 <small>每种一程一座 · 一座营地最多一座</small>`;
    let h = `<div class="hint">奇观分三期施工，搬运工一点点往工地送料；建成以后这一程一直有效，所有营地都算，营地熄火了也不丢。图纸来自研究「奇观图纸·一 / 二」，北境的分岔和奇遇也会送。</div>`;
    const here = Sim.wonderIn(S, c.id);
    let cards = '';
    for (const k of WONDER_KEYS) {
      const W = WONDERS[k], built = Sim.wonderList(S).find(x => x.w === k), b = S.buildings.find(x => x.type === k), have = Sim.bpHave(S, k);
      const where = id => esc((Sim.getCamp(S, id) || { name: '已熄火的营地' }).name);
      const st = built ? `✓ 已落成 · ${where(built.camp)}` : b ? `施工中 ${Math.floor(Sim.wonderProg(b) * 100)}% · ${where(b.camp)}` : have ? (here ? `这座营地已经有${BLD[here.type].n}了，换一座营地建` : '有图纸，可以选址') : `还没有图纸（${W.tech === 'wonder1' ? '奇观图纸·一' : '奇观图纸·二'}）`;
      const act = b ? `data-act="openbld" data-arg="${b.id}"` : !built && have && !here ? `data-act="place" data-arg="${k}"` : '';
      const tot = {}; for (const P of W.ph) for (const r in P) tot[r] = (tot[r] || 0) + P[r];
      cards += `<div class="card ${!have && !built ? 'locked' : ''} ${built ? 'on' : ''}" ${act}>
        <div class="ci pic">${this.ico(k, 4)}</div>
        <div class="cb"><div class="cn">${W.n}</div><div class="cd">${esc(W.d)}</div>
        <div class="cc">${esc(st)}</div>
        ${!built ? `<div class="cio"><small>三期共要 </small>${Object.keys(tot).sort((a, b) => RES[a].t - RES[b].t).map(r => RICON[r] + fmt(tot[r])).join(' ')}</div>` : ''}</div></div>`;
    }
    return h + `<div class="cards">${cards}</div>`;
  }
  // 营地 › 概况：炉火鼎盛。这座营地的产线全稳在三星，产量 +25%，炉火变金色
  peakHtml(c) {
    const S = this.S, V = Sim.peakView(S, c);
    if (!V.lines.length) return '';
    const n3 = V.lines.filter(l => l.star >= 3 && (l.on || l.slow < Sim.PEAK.grace)).length;
    let h = `<div class="sec">炉火鼎盛 <small>${V.on ? '<b class="ok">烧着</b>' : `${n3}/${V.lines.length} 条稳在三星`}</small></div>`;
    h += `<div class="hint">${V.on ? `这座营地的产线全稳在三星：营地产量 +${Sim.PEAK.prod * 100}%，炉火烧成金色。哪条线掉出三星水准（速度低于目标超过 ${Sim.PEAK.grace} 秒），鼎盛就熄。` : `这座营地用到的产线（连上游）全都三星、速度都在目标以上${V.lines.length < V.need ? `，而且至少 ${V.need} 条` : ''}，就会炉火鼎盛：营地产量 +${Sim.PEAK.prod * 100}%，炉火变成金色。`}</div>`;
    h += `<div class="pklines">${V.lines.map(l => { const ok = l.star >= 3 && (l.on || l.slow < Sim.PEAK.grace); return `<button class="pkl ${ok ? 'ok' : l.star >= 3 ? 'slow' : ''}" data-act="plan" data-arg="${l.r}">${RICON[l.r]} ${RES[l.r].n}<i>${'★'.repeat(l.star)}${'☆'.repeat(3 - l.star)}</i>${l.star >= 3 && !l.on ? '<small>速度不够</small>' : ''}</button>`; }).join('')}</div>`;
    return h;
  }
  // 营地 › 概况：城镇。人够、希望够就能升一级（升了不会降）
  townHtml(c) {
    const S = this.S, t = Sim.townOf(c), nx = Sim.townNext(c), why = Sim.townBlock(S, c);
    if (c.depot) return '';
    let h = `<div class="sec">城镇 <small>现在是${TOWN[t].n}</small></div>`;
    if (!t && !Sim.techDone(S, 'townplan')) return h + `<div class="hint">研究「城镇规划」以后，营地住满 ${TOWN[1].pop} 人、希望 ${TOWN[1].need} 以上就能升成镇：帐篷换成木屋，门口点起路灯，床位 +20%。</div>`;
    h += `<div class="twsteps">${TOWN.map((T, i) => `<span class="${i <= t ? 'ok' : i === t + 1 ? 'on' : ''}">${this.cIco('town_' + i, i <= t ? '✓ ' : '')}${T.n}</span>`).join('<i>›</i>')}</div>`;
    for (let i = 1; i <= t; i++) h += `<div class="row sub"><span>${TOWN[i].n}</span><span>${TOWN[i].d}</span></div>`;
    if (nx) {
      h += `<div class="row"><span>升成${nx.n}<br><small>${nx.d}</small></span><span>👥 ${c.people} / ${nx.pop}<br>希望 ${Math.round(c.hope ?? 50)} / ${nx.need}</span></div>`;
      h += `<button class="btn wide tl ${why ? '' : 'go'}" data-act="townup" data-arg="${c.id}" ${why ? 'disabled' : ''}>升成${nx.n}${why ? `<small>${esc(why)}</small>` : '<small>办一场典礼，大家停工 30 秒看烟花</small>'}</button>`;
    } else h += `<div class="hint">已经是大城了。每天会送来一份市政礼包。</div>`;
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
    const auto = Sim.depotAuto(c);
    const btn = (t, label) => auto ? '' : `<button class="small go" data-act="place" data-arg="${t}">${label || '建' + BLD[t].n}</button>`;
    const issues = [];
    // 补给站自己运转：这里的「卡在哪」只是看看，要动手先临时接手
    if (auto) issues.push({ sev: 9, html: `<div class="issue"><span class="ii">📦</span><span class="it"><b>「${esc(c.name)}」是补给站</b><small>它自己派人、自己生产，不盖新房。下面缺的东西要补，先临时接手</small></span><span class="ia"><button class="small" data-act="dtake" data-arg="${c.id}:1">临时接手</button></span></div>` });
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
    // 库存：一格一种，按层分组；红框缺、黄框满，点一格看曲线
    const ri = this.resInfo(c, cr, RES_KEYS.filter(k => RES[k].t <= S.known && ((c.stock[k] || 0) >= 1 || (flow[k] && (flow[k].p > 0.01 || flow[k].c > 0.01 || flow[k].want > 0.01)) || RES[k].t <= 1)));
    // 卡住的排最上面；顺畅就只在库存下面写一行
    const real = issues.filter(i => i.sev < 9);
    let h = real.length ? `<div class="sec">卡住了 · ${real.length}</div>` + issues.slice(0, 6).map(i => i.html).join('') : issues.map(i => i.html).join('');
    const pins = this.g.pc && this.g.pc.on ? this.g.pc.pinList() : null; // 电脑版：每格右上角一枚图钉，钉住的显示在顶栏
    h += `<div class="sec">库存 <small>数字下面是每分钟净变化${pins ? ' · 点图钉钉到顶栏（最多 5 样）' : ''}</small></div>`; let tier = 0;
    for (const r of ri) {
      const tt = RES[r.k].t;
      if (tt !== tier) { h += (tier ? '</div>' : '') + `<div class="stier">${TIER_NAMES[tt]}</div><div class="rgrid">`; tier = tt; }
      const nc = r.net < -0.05 ? 'neg' : r.net > 0.05 ? 'pos' : '';
      h += `<button class="rgc ${r.short ? 'short' : r.full ? 'full' : ''}" data-act="curve" data-arg="${r.k}" style="--f:${(r.fr * 100).toFixed(1)}%" title="${RES[r.k].n}：产 ${fmt(r.f.p)} · 用 ${fmt(r.f.c)} / 分钟（点一下看曲线）">${pins ? `<span class="rpin ${pins.includes(r.k) ? 'on' : ''}" data-act="pin" data-arg="${r.k}" title="${pins.includes(r.k) ? '从顶栏取下' : '钉到顶栏'}">${ico('i', 'pin')}</span>` : ''}<span class="ri">${RICON[r.k]}</span><span class="rn">${RES[r.k].n}${r.short ? '<em>缺</em>' : r.full ? '<em>满</em>' : ''}</span><b>${fmt(r.have)}</b><small class="${nc}">${r.act ? (r.net >= 0 ? '+' : '') + fmt(r.net) : '—'}</small><i></i></button>`;
    }
    if (tier) h += '</div>';
    if (!real.length) h += `<div class="issue ok"><span class="ii">✓</span><span class="it"><b>生产很顺畅</b><small>没有缺料、停工或缺人</small></span></div>`;
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

  pf_stock() { return '<button class="btn" data-act="curve">📈 数据曲线</button><button class="btn go" data-act="chainmap">🔗 生产链总览</button>'; }

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

  // 营地 › 概况：各营地一张卡、补给站、专精、基建
  p_camp(part) {
    const S = this.S;
    if (part === 'title') return `营地 <small>${esc(this.camp().name)}</small>`;
    let h = '';
    if (this.camp().depot) h += this.depotHtml(this.camp()); // 补给站：先说它自己的事，手机上不用往下翻
    h += this.netRow(this.camp());
    for (const c of S.camps) {
      const cr = Sim.rt(S).c[c.id] || {};
      const f = Sim.getB(S, c.furnace);
      h += `<div class="card ${c.id === S.active ? 'on' : ''}" data-act="campgo" data-arg="${c.id}"><div class="ci">🔥</div><div class="cb">
        <div class="cn">${esc(c.name)} <small>熔炉 ${f.lvl} 级 · 纬度 ${Math.round(c.y)}</small>${Sim.campSpecOf(c) ? `<i class="spec-tag">特产·${Sim.campSpecOf(c).n}</i>` : ''}${c.town ? `<i class="spec-tag">${TOWN[Sim.townOf(c)].n}</i>` : ''}</div>
        <div class="cd">👥${c.people}/${cr.housing || 0} · 🌡${Math.round(cr.tH ?? 0)}° · 🍖${fmt(c.stock.food)}（${(cr.foodNet || 0) >= 0 ? '+' : ''}${fmt(cr.foodNet)}/分）· 🔥${cr.burnPerMin ? fmtTime(cr.fuelUnits / cr.burnPerMin * 60) : '—'} · 搬运 ${fmt(cr.haulers)}/${fmt(cr.demand)} · 防御 ${Sim.campDefense(S, c)}</div></div></div>`;
    }
    const c0 = this.camp();
    h += this.specHtml(c0);
    h += this.townHtml(c0);
    h += this.peakHtml(c0);
    if (!c0.depot) h += this.focusHtml(c0);
    h += this.infraHtml(c0);
    return h;
  }
  // 1.1 营地特产：哪几种建筑在这座营地里更出活，为什么是它
  specPct() { return Math.round((Sim.techDone(this.S, 'specpro') ? CSPEC_FX2 : CSPEC_FX) * 100); }
  specHtml(c) {
    const sp = Sim.campSpecOf(c); if (!sp) return '';
    const v = this.specPct(), what = t => (t === 'workshop' ? '研究' : t === 'tower' ? '威力' : t === 'heater' ? '热量' : '产量');
    const why = NORTH_RULES[c.spec] ? `${NORTH_RULES[c.spec].n}的地貌` : SPOTS[c.spec] ? `暖圈里${SPOTS[c.spec].n}比别处多` : '';
    let h = `<div class="sec">营地特产 <small>建营地时就定了，不会变</small></div>`;
    h += `<div class="row"><span>${esc(sp.n)}<br><small>${why}</small></span><span>${sp.b.map(t => `${BLD[t].n} ${what(t)} +${v}%`).join('<br>')}</span></div>`;
    return h;
  }
  // 营地 › 人手：住的、病的、饿的；哪类建筑缺几个人，一键派满
  p_folk(part) {
    const S = this.S, c0 = this.camp(), cr0 = Sim.rt(S).c[c0.id] || {}, R = Sim.rt(S);
    if (part === 'title') return `人手 <small>${esc(c0.name)}</small>`;
    const bay0 = c0.bots ? S.buildings.find(b => b.camp === c0.id && b.type === 'bay') : null;
    const botRow = c0.bots ? `<div class="row"><span>自动机 ${c0.bots} 台<br><small>劳工 ${c0.bots - (c0.botH || 0) - (c0.botM || 0)} · 搬运 ${c0.botH || 0} · 采掘 ${c0.botM || 0}。一台顶 ${Sim.botPow(S)} 个人，不吃饭、不怕冷。</small></span>${bay0 ? `<span style="flex:none"><button style="white-space:nowrap" class="small" data-act="openbld" data-arg="${bay0.id}">换型号</button></span>` : ''}</div>` : '';
    let h = `<div class="folk"><span><b>${c0.people}</b>人</span><span><b>${Math.max(0, Sim.idleLabor(S, c0))}</b>空闲</span><span><b>${Math.min(c0.people, cr0.housing || 0)}</b>住帐篷</span><span class="${c0.people > (cr0.housing || 0) ? 'bad' : ''}"><b>${Math.max(0, c0.people - (cr0.housing || 0))}</b>露宿</span>${c0.wait > 0 ? `<span class="bad"><b>${c0.wait}</b>等床位</span>` : ''}${cr0.sick ? `<span class="bad"><b>${cr0.sick}</b>生病</span>` : ''}${(cr0.hunger || 0) > 0.05 ? `<span class="bad"><b>${Math.round(cr0.hunger * 100)}%</b>挨饿</span>` : ''}</div>`;
    h += botRow;
    h += `<div class="row"><span>自动派人<br><small>新来的人自动去缺人的建筑（吃饭、取暖优先）。手动减过人的建筑不会被塞人。</small></span><span style="flex:none"><button style="white-space:nowrap" class="small ${c0.auto === false ? '' : 'go'}" data-act="auto" data-arg="${c0.id}">${c0.auto === false ? '已关闭' : '已开启'}</button></span></div>`;
    // 按建筑种类：几座、几个人 / 最多几个人、有几座停着
    const by = new Map();
    for (const b of S.buildings) {
      if (b.camp !== c0.id || !Sim.bMax(S, b)) continue;
      const g = by.get(b.type) || { b, n: 0, w: 0, mx: 0, bad: 0 }; g.n++; g.w += b.workers; g.mx += Sim.bMax(S, b);
      const st = (R.b[b.id] || {}).status || ''; if (STATUS_BAD(st)) g.bad++;
      by.set(b.type, g);
    }
    const rows = [...by.values()].sort((a, b) => (b.mx - b.w) - (a.mx - a.w) || BLD[a.b.type].t - BLD[b.b.type].t);
    if (rows.length) {
      h += `<div class="sec">各类建筑的人手 <small>缺人的排前面</small></div><div class="wtab">`;
      for (const g of rows) {
        const d = BLD[g.b.type], miss = g.mx - g.w;
        h += `<div class="wrow ${miss > 0 ? 'short' : ''}"><span class="wn">${this.ico(g.b.type, g.b.lvl)}<span><b>${d.n}</b><small>${g.n} 座${g.bad ? ` · <em>${g.bad} 座停着</em>` : ''}</small></span></span><span class="ww"><b>${g.w}</b>/${g.mx}</span><span class="wb">${miss > 0 ? `<button class="small go" data-act="bulkw" data-arg="${g.b.id}">派满</button>` : '<small>满员</small>'}</span></div>`;
      }
      h += `</div>`;
    }
    h += `<div class="sec">大家在说</div><div class="voices">${campVoices(S, c0, Sim.rt(S)).map(q => `<div>「${esc(q)}」</div>`).join('')}</div>`;
    h += `<div class="hint">在地图上点一个小人，可以看看这个人是谁、在干什么、过得怎么样。</div>`;
    return h;
  }

  // 补给站：留守的人、撑不撑得住、往北送什么、临时接手、熄火
  depotHtml(c) {
    const S = this.S, cr = Sim.rt(S).c[c.id] || {};
    let h = `<div class="sec">补给站 <small>${esc(c.name)}</small></div>`;
    h += `<div class="hint">${c.manual ? '你正在临时接手：可以盖房、升级了。管完交回去，它会自己转。' : '这座营地自己派人、自己生产，不盖新房、不升级；熔炉只按留守的人数烧火，省燃料。多出来的货交给物流网，哪个营地缺就送哪。'}</div>`;
    const fm = cr.burnPerMin ? cr.fuelUnits / cr.burnPerMin : 0, why = Sim.depotTrouble(S, c);
    h += `<div class="row"><span>留守</span><span>${c.people} 人${c.people < Sim.DEPOT_MIN ? `（不到 ${Sim.DEPOT_MIN} 人）` : ''}</span></div>`;
    h += `<div class="row sub"><span>撑不撑得住</span><span class="${why ? 'bad' : ''}">${why ? '⚠ ' + why : `燃料够 ${fm ? fmtTime(fm * 60) : '—'} · 熟食 ${fmt(c.stock.food)}`}</span></div>`;
    const emb = Sim.douseEmbers(S, Sim.getB(S, c.furnace).lvl);
    h += `<div class="drow"><button class="btn ${c.manual ? 'go' : ''}" data-act="dtake" data-arg="${c.id}:${c.manual ? 0 : 1}">${c.manual ? '交回去自己转' : '临时接手'}</button><button class="btn bad" data-act="ddouse" data-arg="${c.id}">熄火换 ${emb} 余烬</button></div>`;
    return h;
  }
  // 营地专精：四个方向的卡片，强一样、弱一样
  focusHtml(c) {
    const S = this.S, f = Sim.getB(S, c.furnace), left = Sim.focusLeft(S, c);
    let h = `<div class="sec">营地专精 <small>${esc(c.name)}</small></div>`;
    if (f.lvl < FOCUS_LVL) return h + `<div class="hint">熔炉升到 ${FOCUS_LVL} 级后，可以给这座营地定一个方向：矿业、农垦、工坊或要塞。</div>`;
    h += `<div class="focus">${FOCUS_KEYS.map(k => { const D = FOCUS[k], on = c.focus === k, why = Sim.focusBlock(S, c, k);
      return `<button class="fcard ${on ? 'on' : ''} ${why && !on ? 'wait' : ''}" ${!on && !why ? `data-act="focus" data-arg="${c.id}:${k}"` : ''}>${this.fIco(k, D)}<span><b>${D.n}${on ? '<em>现在</em>' : ''}</b><small>${D.d}</small><small class="fbad">${D.bad}</small></span></button>`; }).join('')}</div>`;
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
    { const nl = LAWS.filter(l => Sim.lawOn(S, l.id)).length; h += `<button class="mlink" data-act="htab" data-arg="law"><span>📜</span><span>律令${nl ? `：生效中 ${nl} 条` : '：还没有签署'}<small>律令能改变希望和不满，代价写在每一条下面</small></span><i>›</i></button>`; }
    return h;
  }
  // 营地 › 律令：对所有营地生效
  p_law(part) {
    const S = this.S;
    if (part === 'title') return '律令 <small>对所有营地生效</small>';
    let h = `<div class="laws">`;
    for (const l of LAWS) {
      const on = Sim.lawOn(S, l.id), wait = Sim.lawWait(S, l.id);
      h += `<div class="law ${on ? 'on' : ''}"><div class="lh"><span class="li">${this.cIco('law_' + l.id, l.ic)}</span><b>${l.n}</b>${on ? '<span class="lon">生效中</span>' : ''}
        <button class="small ${wait > 0 ? '' : on ? '' : 'go'}" data-act="law" data-arg="${l.id}" ${wait > 0 ? 'disabled' : ''}>${wait > 0 ? fmtTime(wait) + ' 后可改' : on ? '废除' : '签署'}</button></div>
        <div class="ld">${l.d}</div><div class="lfx"><span class="g">${l.good}</span><span class="b">${l.bad}</span></div></div>`;
    }
    h += `</div><div class="hint">改过的律令 3 分钟内不能再改；废除律令会让不满 +4。</div>`;
    return h;
  }

  p_research(part) {
    const S = this.S, R = Sim.rt(S), T = S.tech || { done: {}, cur: null, prog: 0 }, nd = TECHS.filter(t => T.done[t.id]).length, EL = Sim.endlessLvl(S);
    if (part === 'title') return `研究 <small>已完成 ${nd}/${TECHS.length}${EL ? ` · 无尽 ${EL} 级` : ''}</small>`;
    if (this.g.pc && this.g.pc.on) return this.researchPC();
    const shops = S.buildings.filter(b => b.type === 'workshop'), rate = R.rpRate || 0;
    let potential = 0; for (const b of shops) potential += (R.b[b.id] || {}).rp || 0;
    let h = '';
    const ct = T.cur && Sim.techDef(S, T.cur);
    if (ct) {
      const left = ct.pts - T.prog;
      h += `<div class="tcur"><div class="tch"><span class="ti">${this.rIco(ct)}</span><div><b>${ct.n}</b><small>${ct.d}</small></div></div>
        <div class="mbar"><i style="width:${Math.min(100, T.prog / ct.pts * 100).toFixed(1)}%"></i></div>
        <div class="tcm"><span>${fmt(T.prog)} / ${ct.pts} 点 · ${rate > 0 ? `还要 ${fmtTime(left / rate * 60)}` : '<b class="neg">停住了：工程站里没人干活</b>'}</span><button class="small" data-act="techstop">停止（退回材料）</button></div></div>`;
    } else h += `<div class="tcur idle"><b>现在没有在研究。</b><small>点下面的一项看详情，开始时先付材料，攒够研究点数就完成。</small></div>`;
    if (!shops.length) h += `<div class="issue warn"><span class="ii">🔬</span><span class="it"><b>还没有工程站</b><small>研究点数由工程站里的工程师产出</small></span><span class="ia"><button class="small go" data-act="place" data-arg="workshop">建工程站</button></span></div>`;
    else h += `<div class="row sub"><span>工程站</span><span>${shops.length} 座 · 每分钟 ${fmt(ct ? rate : potential)} 点${!ct ? '（开始研究后才派人）' : ''}</span></div>`;
    if (T.bank > 0.5) h += `<div class="row sub"><span>📜 探险带回的图纸</span><span>${fmt(T.bank)} 点 · 下一项研究开始时直接算进去</span></div>`;
    // 无尽研究
    const all = Sim.allTechDone(S);
    h += `<button class="rend ${all ? 'on' : ''} ${this.techSel === 'endless' ? 'sel' : ''}" data-act="techsel" data-arg="endless"><span class="ti">♾️</span><span><b>无尽研究${EL ? ` · 已 ${EL} 级` : ''}</b><small>${all ? `每一级所有生产 +2%，没有上限（现在 +${Math.round(EL * 2)}%）` : `五条分支全部研究完以后开放（还差 ${TECHS.length - nd} 项）`}</small></span><i>›</i></button>`;
    // 研究树：五列，每列一条分支，从上往下按纬度排；连线连到前置
    const cols = TECH_BR.map((n, br) => { const list = TECHS.filter(x => x.br === br); return { n, br, list, lay: techLayout(list), gate: Sim.techGateWhy(S, br) }; });
    const RH = 84, H = Math.max(...cols.map(c => c.lay.rows)) * RH + 6, sel = this.techSelOf();
    h += `<div class="rhd">${cols.map(c => `<span class="${c.gate ? 'lk' : ''}"><b>${c.n}</b><small>${c.gate ? '🔒 未开放' : `${c.list.filter(t => T.done[t.id]).length}/${c.list.length}`}</small></span>`).join('')}</div>`;
    let lines = '', nodes = '';
    cols.forEach((c, ci) => {
      // 两条链左右错开一点：左链的节点偏左、右链偏右，同一条链上下直接连线，从另一条链分出来的画一道弯
      const cx = (ci + 0.5) * 20, X = n => cx + (n.side ? 3 : -3), Y = n => n.row * RH + 22;
      for (const t of c.list) for (const r of t.req || []) {
        const a = c.lay.at[r], b = c.lay.at[t.id]; if (!a) continue;
        const x0 = X(a), x1 = X(b), y0 = Y(a) + 45, y1 = Y(b) - 19;
        lines += `<path class="${T.done[t.id] ? 'done' : T.done[r] ? 'open' : ''}" d="${x0 === x1 ? `M${x0} ${y0}L${x1} ${y1}` : `M${x0} ${y0}C${x0} ${y0 + 34} ${x1} ${y1 - 34} ${x1} ${y1}`}"/>`;
      }
      for (const t of c.list) {
        const n = c.lay.at[t.id], ck = Sim.techCheck(S, t.id);
        const cls = ck.done ? 'done' : ck.cur ? 'cur' : ck.lock ? 'lock' : ck.ok ? 'ok' : 'soft';
        const pr = ck.cur ? Math.min(1, T.prog / t.pts) : 0;
        nodes += `<button class="tnode rn ${cls}${sel === t ? ' sel' : ''}${c.gate ? ' gate' : ''}" data-act="techsel" data-arg="${t.id}" style="left:${X(n).toFixed(2)}%;top:${Y(n) - 20}px;--p:${pr.toFixed(3)}"><span class="tn0">${this.rIco(t)}</span>${ck.done ? '<em class="tbadge">✓</em>' : ck.lock ? '<em class="tbadge lk">🔒</em>' : ''}${t.star ? '<em class="tstar">★</em>' : ''}<span class="tnl">${t.n}</span></button>`;
      }
    });
    h += `<div class="ttree rtree" style="height:${H}px"><svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}</div>`;
    h += `<div class="hint">★ 是解锁新东西的研究。研究对所有营地都生效，北迁以后也一直有效。</div>`;
    return h;
  }
  techSelOf() {
    const S = this.S, T = S.tech || { done: {}, cur: null };
    if (this.techSel === 'endless') return Sim.techDef(S, 'endless');
    return TECHS.find(t => t.id === this.techSel) || (T.cur && T.cur !== 'endless' && TECHS.find(t => t.id === T.cur)) || TECHS.find(t => Sim.techCheck(S, t.id).ok) || TECHS.find(t => !Sim.techCheck(S, t.id).done && !Sim.techCheck(S, t.id).gate) || (Sim.allTechDone(S) ? Sim.techDef(S, 'endless') : TECHS[0]);
  }
  // 电脑版的研究窗口：左边五条分支各一行（按纬度从左往右），右边是选中那一项的详情和按钮
  researchPC() {
    const S = this.S, R = Sim.rt(S), T = S.tech || { done: {}, cur: null, prog: 0 }, c = this.camp();
    const shops = S.buildings.filter(b => b.type === 'workshop'), rate = R.rpRate || 0;
    let potential = 0; for (const b of shops) potential += (R.b[b.id] || {}).rp || 0;
    const ct = T.cur && Sim.techDef(S, T.cur), sel = this.techSelOf();
    let L = `<div class="rph"><span>${shops.length ? `${shops.length} 座工程站 · 每分钟 ${fmt(ct ? rate : potential)} 点${ct ? '' : '（开始研究后才派人）'}` : '还没有工程站'}</span><span class="rleg"><i class="lg done"></i>已完成<i class="lg ok"></i>可以研究<i class="lg lk"></i>还没开放</span></div>`;
    if (ct) L += `<div class="rpcur"><span class="ti">${this.rIco(ct)}</span><b>正在研究：${ct.n}</b><div class="u-tube"><i style="width:${Math.min(100, T.prog / ct.pts * 100).toFixed(1)}%"></i></div><small>${rate > 0 ? `还要 ${fmtTime((ct.pts - T.prog) / rate * 60)}` : '<b class="neg">停住了：工程站里没人干活</b>'}</small><button class="small" data-act="techstop">停止（退回材料）</button></div>`;
    if (!shops.length) L += `<div class="issue warn"><span class="ii">🔬</span><span class="it"><b>还没有工程站</b><small>研究点数由工程站里的工程师产出</small></span><span class="ia"><button class="small go" data-act="place" data-arg="workshop">建工程站</button></span></div>`;
    if (T.bank > 0.5) L += `<div class="row sub"><span>📜 探险带回的图纸</span><span>${fmt(T.bank)} 点 · 下一项研究开始时直接算进去</span></div>`;
    TECH_BR.forEach((n, br) => {
      const list = TECHS.filter(x => x.br === br), lay = techLayout(list), gate = Sim.techGateWhy(S, br);
      const ord = [...list].sort((a, b) => lay.at[a.id].row - lay.at[b.id].row);
      L += `<div class="rrow ${gate ? 'gate' : ''}"><div class="rbr"><b>${n}</b><small>${gate ? esc(gate.replace(/^侦察到「(.+)」纬度后开放$/, '$1纬度开放')) : `${list.filter(x => T.done[x.id]).length}/${list.length}`}</small></div><div class="rnodes">`;
      for (const x of ord) {
        const ck = Sim.techCheck(S, x.id), cls = ck.done ? 'done' : ck.cur ? 'cur' : ck.lock ? 'lock' : ck.ok ? 'ok' : 'soft';
        L += `<button class="rpn ${cls}${sel === x ? ' sel' : ''}" data-act="techsel" data-arg="${x.id}" title="${esc(x.n)}"><span class="rpi">${this.rIco(x)}${ck.done ? `<em class="rpb ok">${ico('i', 'check')}</em>` : ck.cur ? `<em class="rpb cur">${ico('i', 'hourglass')}</em>` : ck.lock ? `<em class="rpb lk">${ico('i', 'lock')}</em>` : ''}${x.star ? '<em class="rps">★</em>' : ''}</span><span class="rpl">${x.n}</span></button>`;
      }
      L += '</div></div>';
    });
    const all = Sim.allTechDone(S), EL = Sim.endlessLvl(S);
    L += `<button class="rend ${all ? 'on' : ''} ${this.techSel === 'endless' ? 'sel' : ''}" data-act="techsel" data-arg="endless"><span class="ti">♾️</span><span><b>无尽研究${EL ? ` · 已 ${EL} 级` : ''}</b><small>${all ? `每一级所有生产 +2%，没有上限（现在 +${Math.round(EL * 2)}%）` : `五条分支全部研究完以后开放，还差 ${TECHS.length - TECHS.filter(x => T.done[x.id]).length} 项`}</small></span><i>›</i></button>`;
    // 右边：选中的那一项
    const t = sel, ck = Sim.techCheck(S, t.id), cls = ck.done ? 'done' : ck.cur ? 'cur' : ck.lock ? 'lock' : ck.ok ? 'ok' : 'soft';
    const tags = [t.br >= 0 ? TECH_BR[t.br] : '', TIER_NAMES[t.t] || '', t.star ? '★ 解锁新东西' : ''].filter(Boolean).map(s => `<span class="u-tag">${s}</span>`).join('');
    const reqs = (t.req || []).map(r => { const q = TECHS.find(x => x.id === r); return q ? `<span class="${T.done[r] ? 'pos' : 'neg'}">${this.rIco(q)}${q.n}${T.done[r] ? ' ✓' : ''}</span>` : ''; }).join(' ');
    let D = `<div class="rpd ${cls}"><span class="rpbig">${this.rIco(t)}</span><b class="rpn2">${t.n}</b>${tags ? `<div class="rptags">${tags}</div>` : ''}<p>${t.d}</p>`;
    if (!ck.done) {
      D += `<div class="rpkv"><span>材料</span><span>${costHtml(c.stock, t.cost, S.known) || '不要材料'}</span></div>`;
      D += `<div class="rpkv"><span>研究点</span><span><b>🔬 ${t.pts}</b>${rate || potential ? ` <small>约 ${fmtTime(t.pts / (rate || potential) * 60)}</small>` : ''}</span></div>`;
    }
    if (reqs) D += `<div class="rpkv"><span>前置</span><span>${reqs}</span></div>`;
    D += '<div class="rpsp"></div>';
    if (ck.done) D += '<div class="tdone">✓ 已完成</div>';
    else if (ck.cur) D += `<div class="tdone cur">研究中 · ${Math.round(T.prog / t.pts * 100)}%</div><button class="btn wide" data-act="techstop">停止（退回材料）</button>`;
    else if (!ck.lock) D += `<button class="btn wide ${ck.ok ? 'go' : ''}" data-act="tech" data-arg="${t.id}" ${ck.ok || ck.soft ? '' : 'disabled'}>开始研究</button>`;
    if (ck.lock || (ck.soft && !ck.ok) || ck.busy) D += `<small class="rpwhy ${ck.lock ? 'tlock' : 'neg'}">${esc(ck.reason)}</small>`;
    D += '</div>';
    return `<div class="rpc"><div class="rpl0">${L}</div>${D}</div>`;
  }
  // 研究面板底部：选中那一项的详情和开始按钮
  pf_research() {
    if (this.g.pc && this.g.pc.on) return ''; // 电脑版：详情在窗口右边
    const S = this.S, c = this.camp(), t = this.techSelOf(), ck = Sim.techCheck(S, t.id);
    const act = ck.done ? '<span class="tdone">✓ 已完成</span>' : ck.cur ? '<span class="tdone cur">研究中</span>' : ck.lock ? '' : `<button class="btn ${ck.ok ? 'go' : ''}" data-act="tech" data-arg="${t.id}" ${ck.ok || ck.soft ? '' : 'disabled'}>开始研究</button>`;
    const tag = t.br >= 0 ? `${TECH_BR[t.br]} · ${TIER_NAMES[t.t] || ''}` : '';
    return `<div class="rdet ${ck.done ? 'done' : ck.lock ? 'lock' : ''}"><div class="tdh"><span class="ti">${this.rIco(t)}</span><b>${t.n}</b>${t.star ? '<i class="tstar2">★ 解锁</i>' : ''}${tag ? `<small class="rmeta">${tag}</small>` : ''}</div><small class="rd">${t.d}</small>
      ${ck.done ? '' : `<div class="rfoot"><span class="tcost">${costHtml(c.stock, t.cost, S.known)} <span class="cost">🔬${t.pts}</span></span>${act}</div>`}${ck.lock || (ck.soft && !ck.ok) || ck.busy ? `<small class="${ck.lock ? 'tlock' : 'neg'}">${esc(ck.reason)}</small>` : ''}</div>`;
  }


  // 北行 › 地图与侦察
  p_scout(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '地图与侦察';
    const sl = Sim.scoutSlots(S, c.id);
    let h = `<button class="mlink" data-act="bigmap"><span>🗺️</span><span>北行地图<small>${esc(northRec(S) || '一路的地标、营地和还没探的地方')}<span class="kh">（M）</span></small></span><i>›</i></button>`;
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
      if (!going && Sim.surveyCheap(S, c)) h += `<div class="row sub"><span>💡</span><span style="color:var(--good)">这次去找快挖完的${SPOTS[Sim.surveyNext(S, c)].n}，按第一次的价钱</span></div>`;
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

  // 物流：所有营地连成一张路网，缺什么自动从有余的营地运过来。三页：总览（每个营地运来、送出、还缺）、道路、送货
  netGood(k, n) { return k === '@fuel' ? `🔥燃料${n != null ? ' ' + fmt(n) + ' 份' : ''}` : `${RICON[k]}${RES[k].n}${n != null ? ' ' + fmt(n) : ''}`; }
  netNames(ids) { return [...ids].map(id => `「${esc((Sim.getCamp(this.S, id) || {}).name || '?')}」`).join(''); }
  // 一样货现在怎么样了：正从哪运来、多久到；整张网都没有；路满了在排队
  netWait(c, k) {
    const S = this.S, v = Sim.netView(S, c.id), i = v.inc[k], sh = v.short[k];
    if (i) return `正从${this.netNames(i.from)}运来，约 ${fmtTime(Math.max(1, i.eta))}`;
    if (S.camps.length < 2) return '';
    if (sh && sh.none) return '整张网都没有多余的';
    if (sh && sh.jam) return '路满了，在排队';
    return '等物流网调货';
  }
  netRole(c) { const m = Sim.mainCamp(this.S); return m && m.id === c.id ? '主营地' : c.depot ? '补给站' : '前哨'; }
  p_lines(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return `物流 <small>${S.camps.length} 座营地 · ${Sim.roads(S).filter(Sim.roadOn).length} 条路</small>`;
    if (S.camps.length < 2) return `<div class="hint">现在只有一座营地。用「前哨熔炉」在别处点起第二座营地，会自动修一条雪橇道连过来；以后哪个营地缺什么，物流网会从有余的营地运过去。</div>`;
    const pg = this.netPg || 'all';
    let h = `<div class="tabs" data-sx="ntabs">${[['all', '总览'], ['road', '道路'], ['send', '送货']].map(([k, n]) => `<button class="tab ${k === pg ? 'on' : ''}" data-act="netpg" data-arg="${k}">${n}</button>`).join('')}</div>`;
    if (pg === 'road') return h + this.netRoads(c);
    if (pg === 'send') return h + this.netSend(c);
    // 总览：每座营地一张卡，正在看的、出问题的放前面
    const m = Sim.mainCamp(S), on = this.netFocus || c.id;
    const L = S.camps.slice().sort((a, b) => (b.id === on) - (a.id === on) || (b.id === (m && m.id)) - (a.id === (m && m.id)) || b.y - a.y);
    const nShips = Sim.ships(S).length;
    h += `<div class="hint">每 10 秒，每座营地算一次缺什么、多什么；多的装上雪橇，顺着路送到缺的营地，路上能经过别的营地转运。路上现在有 ${nShips} 车货。</div>`;
    for (const x of L) {
      const v = Sim.netView(S, x.id), inc = Object.entries(v.inc), out = Object.entries(v.out), sh = Object.entries(v.short).sort((a, b) => a[1].tier - b[1].tier);
      h += `<div class="ncard ${x.id === on ? 'on' : ''}"><div class="nh"><b>${esc(x.name)}</b><small>${this.netRole(x)}</small>${x.id !== S.active ? `<button class="small ghost" data-act="campgo" data-arg="${x.id}">去这里</button>` : ''}</div>`;
      if (inc.length) h += `<div class="nl"><span>运来</span><span>${inc.map(([k, i]) => `${this.netGood(k, i.n)} <small>约 ${fmtTime(Math.max(1, i.eta))} · 从${this.netNames(i.from)}</small>`).join('<br>')}</span></div>`;
      if (out.length) h += `<div class="nl"><span>送出</span><span>${out.map(([k, o]) => `${this.netGood(k, o.n)} <small>到${this.netNames(o.to)}</small>`).join('<br>')}</span></div>`;
      if (sh.length) h += `<div class="nl"><span>还缺</span><span>${sh.map(([k, q]) => `<i class="${q.tier > 5 ? '' : q.none ? 'bad' : q.jam ? 'warn' : ''}">${this.netGood(k, q.n)} <small>${esc(q.why)} · ${q.none ? (q.tier > 5 ? '别的营地也没有多的，有了再送' : '整张网都没有多余的') : q.jam ? '路满了，在排队' : '等下一车'}</small></i>`).join('<br>')}</span></div>`;
      if (!inc.length && !out.length && !sh.length) h += `<div class="nl"><span></span><span><small>不缺什么，也没有要往外送的</small></span></div>`;
      h += '</div>';
    }
    return h;
  }
  // 1.1 北方商会：卖货 / 订单 / 买（装饰图纸、余烬、救急物资）
  p_guild(part) {
    const S = this.S, G = Sim.guildOf(S), on = Sim.guildOn(S), m = Sim.guildCamp(S, S.active);
    const sv = v => `🪙${fmt(v)}`;
    if (part === 'title') return `北方商会 <small>${on ? `银币 ${fmt(G.silver)}` : '还没有驿站'}</small>`;
    if (!on) return `<div class="hint">在任何一座营地盖一座「商会驿站」（煤与铁纬度，木板 120、铁锭 40），北方商会的车队就会每天来一趟：卖货换银币、接订单，用银币买装饰图纸和余烬；缺建材时还能高价买一点救急。</div>${Sim.unlocked(S, 'guildpost') ? '<button class="btn wide go" data-act="place" data-arg="guildpost">去盖商会驿站</button>' : `<div class="hint">要先侦察到「${TIER_NAMES[2]}」纬度。</div>`}`;
    const pg = this.gPg || 'sell', posts = Sim.guildPosts(S), cids = [...new Set(posts.map(b => b.camp))];
    const day = Sim.guildDay(S), left = (day + 1) * DAY_LEN - S.t;
    let h = `<div class="ghero"><div><b>${sv(G.silver)}</b><small>银币 · 算在主营地，跟着北迁走</small></div><div><small>在「${esc(m.name)}」交易 · 车队 ${fmtTime(left)} 后换新的价钱和订单</small></div></div>`;
    if (cids.length > 1) h += `<div class="dchips">${cids.map(id => `<button class="dchip ${id === m.id ? 'on' : ''}" data-act="campgo" data-arg="${id}">${esc(Sim.getCamp(S, id).name)}</button>`).join('')}</div>`;
    h += `<div class="tabs">${[['sell', '卖货'], ['order', `订单 ${G.orders.length}`], ['buy', '买']].map(([k, n]) => `<button class="tab ${k === pg ? 'on' : ''}" data-act="gpg" data-arg="${k}">${n}</button>`).join('')}</div>`;
    const pct = k => { const f = Sim.floatOf(S, k); return `<i class="${f >= 1.15 ? 'pos' : f <= 0.85 ? 'neg' : ''}">${Math.round(f * 100)}%</i>`; };
    if (pg === 'sell') {
      const ks = RES_KEYS.filter(k => Sim.tradable(S, k) && (m.stock[k] || 0) >= 1).sort((a, b) => Sim.sellValue(S, b, m.stock[b]) - Sim.sellValue(S, a, m.stock[a]));
      h += `<div class="hint">每天的价钱上下浮动；同一天卖得越多越便宜，第二天恢复。卖的是「${esc(m.name)}」仓库里的货。</div>`;
      if (!ks.length) h += `<div class="hint">「${esc(m.name)}」的仓库是空的。</div>`;
      for (const k of ks) {
        const have = Math.floor(m.stock[k]), q = [50, 200].filter(n => n < have * 0.9), half = Math.floor(have / 2);
        h += `<div class="grow"><span class="gk">${RICON[k]}<span><b>${RES[k].n}</b><small>有 ${fmt(have)} · 现价 ${sv(Sim.sellPrice(S, k))}/个 ${pct(k)}</small></span></span><span class="gb">${q.map(n => `<button class="small" data-act="gsell" data-arg="${k}:${n}">卖 ${n}<small>${sv(Sim.sellValue(S, k, n))}</small></button>`).join('')}${half >= 1 ? `<button class="small" data-act="gsell" data-arg="${k}:${half}">卖一半<small>${sv(Sim.sellValue(S, k, half))}</small></button>` : ''}</span></div>`;
      }
    } else if (pg === 'order') {
      h += `<div class="hint">每天 ${Sim.orderMax(S)} 张订单：限时把一批货交到驿站，给银币和余烬。交的是「${esc(m.name)}」仓库里的货，不够可以让物流网先运过来。</div>`;
      if (!G.orders.length) h += `<div class="hint">今天的订单都交完了，明天车队还会带新的来。</div>`;
      for (const o of G.orders) {
        const have = m.stock[o.k] || 0, ok = have >= o.n, tl = o.until - S.t;
        h += `<div class="gord ${ok ? 'ok' : ''}"><div class="gk">${RICON[o.k]}<span><b>送 ${fmt(o.n)} ${RES[o.k].n}</b><small>还剩 ${fmtTime(tl)} · 奖励 ${sv(o.silver)} + 余烬 ${o.emb}</small></span></div><div class="gbar"><i style="width:${Math.min(100, have / o.n * 100).toFixed(0)}%"></i></div><div class="gb"><small>「${esc(m.name)}」有 ${fmt(have)}/${fmt(o.n)}</small><button class="small ${ok ? 'go' : ''}" data-act="gdeliv" data-arg="${o.id}" ${ok ? '' : 'disabled'}>交货</button></div></div>`;
      }
    } else {
      h += `<div class="sec">装饰图纸 <small>买一次一直有效，再花材料盖</small></div><div class="gdeco">`;
      for (const t of Sim.SHOP_DECOS) {
        const d = BLD[t], have = Sim.shopHave(S, t);
        h += `<div class="gdc ${have ? 'have' : ''}">${this.ico(t, 1)}<b>${d.n}</b><small>希望 +${d.hope}</small>${have ? '<small class="ok">已有图纸</small>' : `<button class="small ${G.silver >= d.shop ? 'go' : ''}" data-act="gdeco" data-arg="${t}" ${G.silver >= d.shop ? '' : 'disabled'}>${sv(d.shop)}</button>`}</div>`;
      }
      h += `</div>`;
      const ep = Sim.emberPrice(S), el = Sim.emberLeft(S);
      h += `<div class="sec">余烬 <small>今天还能买 ${el}</small></div><div class="grow"><span class="gk">🔥<span><b>余烬</b><small>${sv(ep)}/个 · 越往北越贵</small></span></span><span class="gb">${[1, 5, el].filter((n, i, a) => n >= 1 && a.indexOf(n) === i).map(n => `<button class="small" data-act="gemb" data-arg="${n}" ${G.silver >= ep * n && el >= n ? '' : 'disabled'}>买 ${n}<small>${sv(ep * n)}</small></button>`).join('')}</span></div>`;
      h += `<div class="sec">救急物资 <small>三倍价钱，每天限量，送到「${esc(m.name)}」</small></div>`;
      const bk = RES_KEYS.filter(k => Sim.tradable(S, k) && !RES[k].raw || ['wood', 'stone', 'coal'].includes(k)).filter(k => Sim.tradable(S, k) && k !== 'food' && k !== 'game');
      for (const k of bk) {
        const p = Sim.buyPrice(S, k), bl = Sim.buyLeft(S, k), q = [Math.min(50, bl), bl].filter((n, i, a) => n >= 1 && a.indexOf(n) === i);
        h += `<div class="grow"><span class="gk">${RICON[k]}<span><b>${RES[k].n}</b><small>${sv(p)}/个 · 今天还剩 ${fmt(bl)}</small></span></span><span class="gb">${q.map(n => `<button class="small" data-act="gbuy" data-arg="${k}:${n}" ${G.silver >= p * Math.min(n, 1) ? '' : 'disabled'}>买 ${n}<small>${sv(p * n)}</small></button>`).join('')}${!q.length ? '<small>今天卖完了</small>' : ''}</span></div>`;
      }
    }
    return h;
  }
  // 道路：每条路的运力、实际在运多少、路上几车；升级、改铁路；再修一条
  netRoads(c) {
    const S = this.S, R = Sim.roads(S).slice().sort((a, b) => ((b.a === c.id || b.b === c.id) - (a.a === c.id || a.b === c.id)) || a.id - b.id);
    let h = '';
    for (const r of R) {
      const a = Sim.getCamp(S, r.a), b = Sim.getCamp(S, r.b); if (!a || !b) continue;
      const v = Sim.netRoadView(S, r), building = r.pend && r.pend.what === 'build';
      h += `<div class="ncard ${v.jam ? 'jam' : ''}"><div class="nh"><b>${building ? '雪橇道（在修）' : `${Sim.roadKindName(r)} ${r.lvl} 级`}</b><small>「${esc(a.name)}」⇄「${esc(b.name)}」</small></div>`;
      if (!building) {
        h += `<div class="nl"><span>运力</span><span>在运 ${fmt(v.flow)} / ${fmt(v.cap)} 件/分 · 路上 ${v.ships} 车 · 单程约 ${fmtTime(Sim.roadTime(S, r))}</span></div>`;
        h += `<div class="bar"><i style="width:${Math.min(100, v.flow / Math.max(1, v.cap) * 100).toFixed(0)}%"></i></div>`;
      }
      if (v.jam) { const ks = [...new Set(v.jam.map(j => j.k))]; h += `<div class="nl warn"><span>满了</span><span>${ks.map(k => this.netGood(k)).join('、')}在排队。升一级能多运一半。</span></div>`; }
      if (r.pend) {
        const by = Sim.getCamp(S, r.pend.by) || a, miss = Object.keys(r.pend.cost).filter(k => (by.stock[k] || 0) < r.pend.cost[k]);
        h += `<div class="nl"><span>等料</span><span>${r.pend.what === 'build' ? '修路' : r.pend.what === 'rail' ? '改铁路' : '升级'}排在「${esc(by.name)}」的建造队列里${miss.length ? `：还缺 ${miss.map(k => `${RICON[k]}${fmt(r.pend.cost[k] - (by.stock[k] || 0))}`).join(' ')}，${this.netWait(by, miss[0])}` : '，料齐了马上开工'} <button class="small ghost" data-act="roadx" data-arg="${r.id}">取消</button></span></div>`;
      } else {
        const uc = Sim.roadUpCost(S, r), pay = r.a === c.id || r.b === c.id ? c : a;
        if (uc) h += `<div class="nl"><span>升到 ${r.lvl + 1} 级</span><span>${costHtml(pay.stock, uc, S.known)} <button class="small" data-act="roadup" data-arg="${r.id}">升级</button></span></div>`;
        if (Sim.railOk(S, r)) h += `<div class="nl"><span>改成铁路</span><span>${costHtml(pay.stock, Sim.RAIL_COST, S.known)} <button class="small go" data-act="roadrail" data-arg="${r.id}">改建</button></span></div>`;
        else if (r.kind !== 'rail' && S.known >= 4) h += `<div class="nl"><span></span><span><small>升到 3 级以后能改成铁路（每分钟 ${Sim.ROAD.rail.cap} 件，跑得快一倍多）</small></span></div>`;
      }
      h += '</div>';
    }
    const others = S.camps.filter(o => o.id !== c.id && !Sim.roadBetween(S, c.id, o.id));
    if (others.length) {
      h += `<div class="sec">再修一条路 <small>从「${esc(c.name)}」出发</small></div>`;
      for (const o of others) h += `<div class="row"><span>到「${esc(o.name)}」<small>${this.netRole(o)} · 直线 ${Math.round(Math.hypot(o.x - c.x, o.y - c.y))} 格</small></span><span>${costHtml(c.stock, Sim.roadCost(S, c.id, o.id), S.known)} <button class="small" data-act="roadadd" data-arg="${o.id}">修路</button></span></div>`;
    }
    h += `<div class="hint">雪橇道每分钟 ${Sim.ROAD.sled.cap} 件，北行主干道 ${Sim.ROAD.trunk.cap} 件，铁路 ${Sim.ROAD.rail.cap} 件，每升一级多 50%；一条路上的货共用运力。路远只是到得慢，不会少运。修路、升级先花你正在看的营地的料，不够用另一头的；两头都不够就排队，物流网把料运过去。</div>`;
    return h;
  }
  // 送货：从正在看的营地送一批、长期供货、不外送
  netSend(c) {
    const S = this.S, others = S.camps.filter(o => o.id !== c.id);
    if (!others.some(o => o.id === this.netTo)) this.netTo = (others.find(o => o.id === (Sim.mainCamp(S) || {}).id) || others[0]).id;
    const sp = Sim.campSpare(S, c, {}, true), spA = Sim.campSpare(S, c, {}, false);
    const ks = RES_KEYS.filter(k => RES[k].t <= S.known && (sp[k] || 0) >= 1).sort((a, b) => (sp[b] || 0) - (sp[a] || 0));
    if (!ks.includes(this.netK)) this.netK = ks[0];
    let h = `<div class="sec">从「${esc(c.name)}」送到</div><div class="dchips">${others.map(o => `<button class="dchip ${o.id === this.netTo ? 'on' : ''}" data-act="nto" data-arg="${o.id}">${esc(o.name)}<small>${this.netRole(o)}</small></button>`).join('')}</div>`;
    h += `<div class="sec">送什么 <small>能拿出来的（留够半小时的燃料和口粮）</small></div>`;
    h += ks.length ? `<div class="dchips">${ks.slice(0, 18).map(k => `<button class="dchip ${k === this.netK ? 'on' : ''}" data-act="nk" data-arg="${k}">${RICON[k]}${RES[k].n}<small>${fmt(sp[k])}</small></button>`).join('')}</div>` : '<div class="hint">这里没有能拿出来的货。</div>';
    if (this.netK) {
      const k = this.netK, all = Math.floor(spA[k] || 0);
      h += `<div class="drow"><button class="btn" data-act="nsend" data-arg="100">送 100</button><button class="btn" data-act="nsend" data-arg="500">送 500</button><button class="btn go" data-act="nsend" data-arg="all" ${all < 1 ? 'disabled' : ''}>多余的全送${all >= 1 ? ` (${fmt(all)})` : ''}</button></div>`;
      h += `<div class="drow"><span class="dl">长期供货</span><button class="btn" data-act="nfeed" data-arg="10">每分钟 10</button><button class="btn" data-act="nfeed" data-arg="30">每分钟 30</button><button class="btn" data-act="nfeed" data-arg="60">每分钟 60</button></div>`;
      h += `<div class="hint">送一批排在保命的燃料口粮后面最先走，可以动用「留料给建造」的料。长期供货每分钟送这么多，直到你停掉，一个营地最多 ${Sim.FEED_MAX} 条。</div>`;
    }
    const B = Sim.sends(S).filter(b => b.from === c.id || b.to === c.id);
    if (B.length) {
      h += `<div class="sec">正在送的</div>`;
      for (const b of B) h += `<div class="row"><span>${this.netGood(b.k, b.n)} <small>「${esc((Sim.getCamp(S, b.from) || {}).name)}」→「${esc((Sim.getCamp(S, b.to) || {}).name)}」</small></span><span>到了 ${fmt(b.arr || 0)} · 路上 ${fmt(b.n - b.left - (b.arr || 0))}${b.left >= 1 ? ` · 还没装 ${fmt(b.left)}` : ''} <button class="small ghost" data-act="nsendx" data-arg="${b.id}">取消</button></span></div>`;
    }
    const F = Sim.feeds(S).filter(f => f.from === c.id || f.to === c.id);
    if (F.length) {
      h += `<div class="sec">长期供货 <small>${Sim.feeds(S).filter(f => f.from === c.id).length}/${Sim.FEED_MAX}</small></div>`;
      for (const f of F) h += `<div class="row"><span>${f.k === 'people' ? '👥移民' : this.netGood(f.k)} <small>「${esc((Sim.getCamp(S, f.from) || {}).name)}」→「${esc((Sim.getCamp(S, f.to) || {}).name)}」</small></span><span>每分钟 ${fmt(f.rate)}${f.k === 'people' ? ' 人' : ''} <button class="small ghost" data-act="nfeedx" data-arg="${f.id}">停</button></span></div>`;
    }
    const hk = RES_KEYS.filter(k => RES[k].t <= S.known && ((c.stock[k] || 0) >= 1 || (c.hold && c.hold[k])));
    h += `<div class="sec">不外送 <small>点亮的货只留给「${esc(c.name)}」自己用</small></div><div class="dchips">${hk.map(k => `<button class="dchip ${c.hold && c.hold[k] ? 'on' : ''}" data-act="nhold" data-arg="${k}">${RICON[k]}${RES[k].n}</button>`).join('')}</div>`;
    return h;
  }
  // 营地面板里的一行：这里正在运来什么、还缺什么
  netRow(c) {
    const S = this.S; if (S.camps.length < 2) return '';
    const v = Sim.netView(S, c.id), inc = Object.entries(v.inc), sh = Object.entries(v.short).sort((a, b) => a[1].tier - b[1].tier);
    let h = `<div class="sec">物流 <small>${Sim.roadsAt(S, c.id).length} 条路连着这里</small></div>`;
    h += `<div class="row"><span>运来</span><span>${inc.length ? inc.slice(0, 3).map(([k, i]) => `${this.netGood(k, i.n)} <small>约 ${fmtTime(Math.max(1, i.eta))}</small>`).join(' · ') + (inc.length > 3 ? ` 等 ${inc.length} 样` : '') : '<small>没有在路上的货</small>'}</span></div>`;
    if (sh.length) h += `<div class="row sub"><span>还缺</span><span>${sh.slice(0, 3).map(([k, q]) => `<i class="${q.tier > 5 ? '' : q.none ? 'bad' : q.jam ? 'warn' : ''}">${this.netGood(k, q.n)}</i>`).join(' · ')}</span></div>`;
    h += `<div class="drow"><button class="btn" data-act="netview" data-arg="${c.id}">看物流</button><button class="btn" data-act="netsend">送货</button></div>`;
    return h;
  }

  // 北行 › 专家与余烬：专家跟着你一路走；余烬强化是永久的
  p_specs(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return `专家与余烬 <small>🔥 ${Math.floor(S.meta.embers)}</small>`;
    const have = SPECS.filter(s => S.meta.specs[s.id]);
    let h = `<div class="sec">专家 <small>${have.length}/${SPECS.length}</small></div>`;
    if (!have.length) h += `<div class="hint">还没有专家。专家散落在北方，派侦察队去找吧。他们会一直跟着你，北迁时也会一起走。</div>`;
    for (const sp of have) {
      const m = S.meta.specs[sp.id];
      const at = S.specAt[sp.id] && Sim.getB(S, S.specAt[sp.id]);
      const cost = specTrainCost(m.lvl);
      h += `<div class="card"><div class="ci">${this.cIco('spec_' + sp.id, '🧑‍🔧')}</div><div class="cb"><div class="cn">${sp.n} <small>${sp.role} · ${m.lvl} 级</small></div>
        <div class="cd">${esc(sp.story)}<br>对口：${sp.aff.map(t => BLD[t].n).join('、')}（+${Math.round(specBonus(m.lvl, true) * 100)}%，别处 +${Math.round(specBonus(m.lvl, false) * 100)}%）</div>
        <div class="cc">${at ? `在「${BLD[at.type].n}」(${esc(Sim.getCamp(S, at.camp).name)}) <button class="small" data-act="spot" data-arg="${at.id}">看看</button> <button class="small" data-act="unspec" data-arg="${sp.id}">请走</button>` : `<button class="small" data-act="autospec" data-arg="${sp.id}">安排到对口建筑</button>`}
        · ${m.lvl >= SPEC_MAX ? '已经练到顶了' : `培养 ${costHtml(c.stock, cost, S.known)} <button class="small" data-act="train" data-arg="${sp.id}">培养</button>`}</div></div></div>`;
    }
    const missing = SPECS.filter(s => s.row != null && !S.meta.specs[s.id]).length;
    if (missing) h += `<div class="hint">还有 ${missing} 位专家在北方等着被发现。</div>`;
    if (!S.meta.specs.he) h += `<div class="hint">听说有位老大夫在找落脚的地方：盖一座医务所、派人守着，过一阵 TA 也许会来。</div>`;
    h += `<div class="sec">余烬强化 <small>永久的，一路叠上去</small></div>` + this.emberHtml();
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

  // ---------- 成就页：按类别排，进度条和奖励；新的二十个只换装扮，老的达成有余烬 ----------
  achHtml(isNew = () => '') {
    const S = this.S, B = Sim.bookOf(S), all = Sim.ACH.length, got = Sim.ACH.filter(a => B.a[a.id]).length;
    let h = `<div class="achtop"><span><b>${got}</b><small>/${all}</small> 个成就</span><button class="btn sm" data-act="dress">🎨 装扮</button></div>`;
    for (const cat of Sim.ACH_CATS) {
      const L = Sim.ACH.filter(a => Sim.achCat(a) === cat).map(a => ({ a, done: B.a[a.id], cur: Math.min(a.need, a.cur(S, B) || 0) }));
      if (cat === '旅程') L.sort((x, y) => (!!y.done - !!x.done) || (y.cur / y.a.need - x.cur / x.a.need));
      h += `<div class="sec achsec">${cat === '隐藏' ? '❔ 隐藏' : cat}${cat === '旅程' ? '<small>以前的成就，达成有余烬</small>' : ''}<em>${L.filter(x => x.done).length}/${L.length}</em></div>`;
      for (const { a, done, cur } of L) {
        const hid = a.hid && !done;
        const rw = a.gift ? Sim.giftList(a).map(([k, v]) => `<i class="achg${done ? ' on' : ''}">${Sim.GIFT_ICON[k]} ${hid ? '？？？' : `${Sim.GIFT_LABEL[k]}「${esc(Sim.giftName(k, v))}」`}</i>`).join('') : `<i class="achg${done ? ' on' : ''}">🔥 余烬 ${a.rw}</i>`;
        h += `<div class="bkach ${done ? 'on' : ''}"><span class="bai">${done ? '🏆' : hid ? '❔' : '🔒'}</span><span class="bab"><b>${hid ? '？？？' : a.n}${isNew(a.id)}</b><small>${hid ? '隐藏成就：做到了才知道是什么' : a.d}</small>
          ${done ? `<em>第 ${done} 次北行达成</em>` : !hid && a.need > 1 ? `<i class="bap"><i style="width:${(cur / a.need * 100).toFixed(0)}%"></i></i><em>${a.id === 'nodeath' ? `${fmtTime(cur * 60)} / 3 小时` : `${cur} / ${a.need}`}</em>` : ''}<span class="achgs">${rw}</span></span></div>`;
      }
    }
    return h;
  }
  p_ach(part) {
    if (part === 'title') return '成就';
    const S = this.S, B = Sim.bookOf(S);
    const fr = B.fresh.filter(f => f.startsWith('a:')).map(f => f.slice(2)), shown = this.achShown || (this.achShown = new Set());
    if (fr.length) { fr.forEach(x => shown.add(x)); Sim.bookSeen(S, 'a'); }
    return this.achHtml(id => shown.has(id) ? '<i class="bknew">新</i>' : '');
  }
  // ---------- 装扮：成就送的称号、炉火颜色、旗子、相框、北境装饰 ----------
  p_dress(part) {
    if (part === 'title') return '装扮';
    const S = this.S, cur = Sim.titleOf(S), B = Sim.bookOf(S);
    const lockTxt = (k, id) => { const a = Sim.giftFrom(k, id); return a ? `成就「${a.hid && !B.a[a.id] ? '？？？' : a.n}」` : ''; };
    let h = `<div class="hint">装扮只是好看，不改数值。做到成就就能解锁，北迁以后也留着。</div>`;
    // 称号
    h += `<div class="sec">🎖 称号<small>显示在主营地名字下面，也印在照片角上</small></div><div class="dgrid">`;
    h += `<button class="dpick ${!cur ? 'on' : ''}" data-act="settitle" data-arg="none"><b>不显示</b></button>`;
    for (const id in TITLES) { const have = Sim.cosHave(S, 'title', id); h += `<button class="dpick ${have ? '' : 'off'} ${have && cur === TITLES[id] ? 'on' : ''}" ${have ? `data-act="settitle" data-arg="${id}"` : 'disabled'}><b>${have ? TITLES[id] : '？？？'}</b>${have ? '' : `<small>${lockTxt('title', id)}</small>`}</button>`; }
    h += '</div>';
    // 炉火颜色：全部营地一起换，营地多的话还能单独给某一座换
    const sw = (id, on, act, arg) => { const f = FLAMES[id], have = Sim.cosHave(S, 'flame', id), c = f.c || ['#fff2b8', '#ffc040', '#ff6a18'];
      return `<button class="dsw2 ${on ? 'on' : ''} ${have ? '' : 'off'}" style="background:radial-gradient(circle at 50% 62%,${c[0]} 0 22%,${c[1]} 45%,${c[2]} 80%)" title="${have ? f.n : `${f.n}：${lockTxt('flame', id)}解锁`}" ${have ? `data-act="${act}" data-arg="${arg}"` : 'disabled'}></button>`; };
    const all = (Sim.cosOf(S).flame && Sim.cosHave(S, 'flame', Sim.cosOf(S).flame)) ? Sim.cosOf(S).flame : 'def';
    h += `<div class="sec">🔥 炉火颜色<small>熔炉的火苗和火光换个颜色</small></div><div class="dgrid">`;
    for (const id in FLAMES) { const f = FLAMES[id], have = Sim.cosHave(S, 'flame', id), c = f.c || ['#fff2b8', '#ffc040', '#ff6a18'];
      h += `<button class="dpick ${have ? '' : 'off'} ${have && all === id ? 'on' : ''}" ${have ? `data-act="setflame" data-arg="all:${id}"` : 'disabled'}><i class="dsw" style="background:radial-gradient(circle at 50% 62%,${c[0]} 0 22%,${c[1]} 45%,${c[2]} 80%)"></i><b>${have ? f.n : '？？？'}</b>${have ? '' : `<small>${lockTxt('flame', id)}</small>`}</button>`; }
    h += '</div>';
    if (S.camps.length > 1 && Object.keys(FLAMES).filter(id => Sim.cosHave(S, 'flame', id)).length > 1) {
      h += `<div class="mlab">单独给某座营地换<small>不选就跟上面一样</small></div>`;
      for (const c of S.camps) { const fo = Sim.flameOf(S, c); h += `<div class="dcamp"><span>${esc(c.name)}</span><div class="dsws">${Object.keys(FLAMES).filter(id => Sim.cosHave(S, 'flame', id)).map(id => sw(id, fo === id, 'setflame', c.id + ':' + id)).join('')}</div></div>`; }
    }
    // 旗子
    const fl = Sim.flagOf(S);
    h += `<div class="sec">🚩 营旗图案<small>挂在旗杆和北迁车队的领头车上</small></div><div class="dgrid">`;
    for (const id in FLAGS) { const have = Sim.cosHave(S, 'flag', id);
      h += `<button class="dpick ${have ? '' : 'off'} ${have && fl === id ? 'on' : ''}" ${have ? `data-act="setflag" data-arg="${id}"` : 'disabled'}><img src="${this.cosPrev('flag', id)}" alt=""><b>${have ? FLAGS[id].n : '？？？'}</b>${have ? '' : `<small>${lockTxt('flag', id)}</small>`}</button>`; }
    h += '</div>';
    // 相框
    const fr = Sim.frameOf(S);
    h += `<div class="sec">🖼 相框<small>拍照时默认套上的框，拍照工具条里也能换</small></div><div class="dgrid">`;
    for (const id in FRAMES) { const have = Sim.cosHave(S, 'frame', id);
      h += `<button class="dpick ${have ? '' : 'off'} ${have && fr === id ? 'on' : ''}" ${have ? `data-act="setframe" data-arg="${id}"` : 'disabled'}><img src="${this.cosPrev('frame', id)}" alt=""><b>${have ? FRAMES[id].n : '？？？'}</b>${have ? '' : `<small>${lockTxt('frame', id)}</small>`}</button>`; }
    h += '</div>';
    // 北境装饰
    h += `<div class="sec">🗿 北境装饰<small>解锁后在「建造 → 装饰」里，也加希望</small></div>`;
    for (const k of NDECO) { const d = BLD[k], have = Sim.cosHave(S, 'deco', k);
      h += `<div class="ndeco"><b>${have ? d.n : '？？？'}</b><small>${have ? `希望 +${d.hope} · ${Object.entries(d.cost).map(([r, v]) => `${RICON[r] || ''}${v}`).join(' ')}` : lockTxt('deco', k) + '解锁'}</small>${have ? `<button class="btn" data-act="place" data-arg="${k}">去建造</button>` : ''}</div>`; }
    return h;
  }
  // ---------- 相册：新的在前，点开看大图 ----------
  p_album(part) {
    if (part === 'title') return '相册';
    if (!this.album) { this.loadAlbum(); return '<div class="hint">正在翻相册…</div>'; }
    const L = this.album;
    let h = `<div class="hint">抵达新一站、点亮烽火塔、第一次三星产线、点燃天火时会自动拍一张；拍照模式里也能「收进相册」。照片存在这台设备的浏览器里，最多 ${ALBUM_MAX} 张，满了先挤掉最早的自动照片。</div>`;
    if (!L.length) return h + '<div class="empty">相册还是空的。先去拍一张吧。</div><button class="btn go" data-act="photo">📷 拍照模式</button>';
    h += `<div class="mlab">${L.length} 张<small>${L.filter(r => r.auto).length} 张自动拍的</small></div><div class="algrid">`;
    for (const r of L) { const d = new Date(r.t); h += `<button class="alcell" data-act="albumview" data-arg="${r.id}"><img src="${this.albumUrl(r)}" alt=""><small>${esc(r.cap || '')}<i>${d.getMonth() + 1}/${d.getDate()}</i></small></button>`; }
    return h + '</div>';
  }
  albumUrl(r) { const M = this.albumUrls || (this.albumUrls = new Map()); if (!M.has(r.id)) { try { M.set(r.id, URL.createObjectURL(r.blob)); } catch (e) { M.set(r.id, ''); } } return M.get(r.id); }
  async loadAlbum() {
    if (this.albumLoading) return; this.albumLoading = true;
    try { this.album = await albumList(); } catch (e) { this.album = []; }
    this.albumLoading = false;
    if (this.panel && (this.panel.kind === 'album' || this.panel.kind === 'mcoll')) { this.lastHtml = ''; this.renderPanel(true); }
  }
  // ---------- 自动备份 ----------
  agoText(at) { const s = Math.max(0, (Date.now() - at) / 1000); return s < 60 ? '刚刚' : s < 3600 ? Math.floor(s / 60) + ' 分钟前' : s < 86400 ? Math.floor(s / 3600) + ' 小时前' : Math.floor(s / 86400) + ' 天前'; }
  bkLine(r) { const i = r.info || {}; return `${esc(i.name || '？')} · 👥 ${fmt(i.people || 0)} 人 · 第 ${Math.floor((i.t || 0) / DAY_LEN) + 1} 天${(i.runs || 1) > 1 ? ` · 第 ${i.runs} 次北行` : ''}`; }
  bkRow() {
    if (!this.bks) { this.loadBackups(); return '<div class="row"><span>自动备份<br><small>正在清点…</small></span></div>'; }
    const L = this.bks;
    return `<div class="row"><span>自动备份 <b>${L.length}</b> 份<br><small>${L.length ? `最近一份 ${this.agoText(L[0].at)} · ` : ''}玩着每 10 分钟一份；北迁、导入、重开之前也先备份</small></span><span style="flex:none"><button class="small" data-act="backups" ${L.length ? '' : 'disabled'}>查看备份</button></span></div>`;
  }
  async loadBackups() {
    if (this.bksLoading) return; this.bksLoading = true;
    try { this.bks = await this.g.bk.list(this.g.slot); } catch (e) { this.bks = []; }
    this.bksLoading = false;
    if (this.panel && this.panel.kind === 'msave') { this.lastHtml = ''; this.renderPanel(true); }
    if (this.bkOpen) this.backupsModal();
  }
  bkDirty() { this.bks = null; if ((this.panel && this.panel.kind === 'msave') || this.bkOpen) this.loadBackups(); }
  backupsModal() {
    if (!this.bks) { this.modal('<h2>自动备份</h2><div class="hint">正在清点…</div>', [{ t: '关闭', a: 'close-modal' }]); this.bkOpen = true; this.loadBackups(); return; }
    const L = this.bks;
    const rows = L.map(r => { const [ic, n] = BK_WHY[r.why] || BK_WHY.auto, d = new Date(r.at);
      return `<div class="bkrow"><span class="bki">${ic}</span><span class="bkt"><b>${this.agoText(r.at)}</b><em>${n} · ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</em><small>${this.bkLine(r)}</small></span><button class="small" data-act="bkload" data-arg="${r.id}">恢复</button></div>`; }).join('');
    this.modal(`<h2>自动备份</h2><p class="hint">存档位 ${this.g.slot} 的旧进度，存在这台设备上。恢复以后从那一刻接着玩，现在的进度会先另存一份，反悔了还能换回来。</p>
      <div class="bklist">${rows || '<div class="hint">还没有备份。玩上 10 分钟就有第一份。</div>'}</div>
      <p class="hint">定时备份会留下几分钟前、半小时前、几小时前和一天前的进度；北迁出发前、导入存档码前、重开前、删除前这些时刻的备份留最近 4 份。</p>`, [{ t: '关闭', a: 'close-modal' }]);
    this.$('modal').querySelector('.mbox').classList.add('bkbox'); this.bkOpen = true;
  }
  albumDirty() { this.album = null; if (this.panel && (this.panel.kind === 'album' || this.panel.kind === 'mcoll')) this.loadAlbum(); }
  // 装扮页的小样：旗面、相框各画一张小图，画一次就记住
  cosPrev(kind, id) {
    const C = this._cosPrev || (this._cosPrev = {}), k = kind + id;
    if (C[k]) return C[k];
    const c = document.createElement('canvas'), x = c.getContext('2d');
    if (kind === 'flag') { c.width = 128; c.height = 80; if (id === 'def') { x.fillStyle = '#b8402e'; x.fillRect(0, 0, 128, 80); x.fillStyle = '#c85a3a'; x.fillRect(43, 0, 42, 80); x.fillStyle = '#f0d090'; x.fillRect(60, 34, 40, 10); } else drawFlag(x, id, 128, 80); }
    else {
      c.width = 192; c.height = 120;
      const g = x.createLinearGradient(0, 0, 0, 120); g.addColorStop(0, '#8fa6bf'); g.addColorStop(0.55, '#dfe7ef'); g.addColorStop(1, '#f4f6f8'); x.fillStyle = g; x.fillRect(0, 0, 192, 120);
      x.fillStyle = '#5b4a3a'; x.beginPath(); x.moveTo(70, 92); x.lineTo(96, 52); x.lineTo(122, 92); x.closePath(); x.fill();
      x.fillStyle = '#ff9a3a'; x.beginPath(); x.arc(96, 84, 6, 0, 7); x.fill();
      drawFrame(x, id, 192, 120, 1.8);
    }
    try { return (C[k] = c.toDataURL('image/png')); } catch (e) { return ''; }
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
    if (tab === 'a') return h + this.achHtml(isNew);
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
      for (const sp of SPECS) h += card(B.p[sp.id], this.cIco('spec_' + sp.id, '🧑‍🔧'), sp.n, `${sp.role}${B.p[sp.id] ? '' : sp.row == null ? ' · 盖好医务所后会来投奔' : ` · 纬度 ${sp.row} 一带`}`, B.p[sp.id] ? sp.story : '', sp.id);
      return h;
    }
    if (tab === 's') {
      for (const x of Sim.SIGHTS) h += card(B.s[x.id], x.ic, x.n, B.s[x.id] ? `第 ${B.s[x.id]} 次北行见到` : `线索：${x.how}`, B.s[x.id] ? x.d : '', x.id);
      return h;
    }
    return h;
  }

  p_migrate(part) {
    const S = this.S, J = Sim.journeyOf(S);
    if (part === 'title') return J.trip ? '车队在路上' : '北迁';
    let h = '';
    if (J.trip) return h + this.tripHtml(J.trip);
    const g = Sim.departGate(S);
    if (!g) return h + `<div class="story">${esc(STORY.trueEnd || '')}</div><div class="hint">一路走到了世界之脊。再往北是无尽的冰原，想走多远都行。</div>`;
    const P = g.plan, V = Sim.VEH, main = Sim.mainCamp(S);
    const rl = Sim.ruleOf(g.next);
    h += `<div class="mighero"><div class="mgto">下一站 · <b>${esc(g.next.n)}</b></div><small>${g.route.ok ? `路长约 ${Math.round(g.route.len)} 格，车队要走 ${Math.max(1, Math.round(P.secs / 60))} 分钟左右` : '路还没探通'}${g.next.far ? '' : ` · 纬度 ${Math.round(g.next.y)}`}</small>${rl ? `<div class="mgrule"><b>${rl.ic} 地貌：${esc(rl.n)}</b><span class="good">好：${esc(rl.good)}</span><span class="bad">坏：${esc(rl.bad)}</span></div>` : ''}</div>`;
    h += this.forkHtml(J);
    // 四条门槛
    h += `<div class="sec">出发前要做到 <small class="mgn">${g.n}/4</small></div>`;
    const go = { route: '去探路', chap: '看章节', flvl: '去熔炉', car: '去雪橇棚' };
    for (const it of g.items) h += `<div class="row mgate ${it.ok ? 'ok' : ''}"><span><b class="mgt"><i class="mgk">${it.ok ? '✓' : ''}</i>${esc(it.t)}</b><small>${esc(it.sub)}</small></span>${it.ok ? '' : `<button class="small" data-act="gatego" data-arg="${it.id}">${go[it.id]}</button>`}</div>`;
    // 车队装载
    h += `<div class="sec">车队</div>`;
    const mc = P.camps.find(c => c.main);
    h += `<div class="row"><span>上路的人<small>${mc && mc.mode === 'douse' ? `主营地熄火：留 ${mc.stay} 人守火，车队到了跟上` : `主营地留 ${mc ? mc.stay : 0} 人守成补给站（至少 ${Sim.DEPOT_MIN} 人）`}</small></span><span class="stepper">${mc && mc.mode !== 'douse' ? `<button data-act="mstay" data-arg="5">−</button>` : ''}<b>👥${P.people}</b>${mc && mc.mode !== 'douse' ? `<button data-act="mstay" data-arg="-5">＋</button>` : ''}</span></div>`;
    if (P.specs.length) h += `<div class="row sub"><span>专家</span><span>${P.specs.length} 位一起走</span></div>`;
    const fl = J.fleet, vs = Sim.VEH_KEYS.filter(v => (fl[v] || 0) || (v === 'sled')).map(v => `${Sim.vehName(v)} ${P.veh[v] || 0}/${fl[v] || 0}`).join(' · ');
    h += `<div class="row"><span>车<small>${vs}（用上的/有的）</small></span><span>${fmt(P.load)} / ${fmt(P.cap)} 份</span></div>`;
    h += `<div class="bar ${P.roomOk ? '' : 'over'}"><i style="width:${Math.min(100, P.load / Math.max(1, P.cap) * 100).toFixed(0)}%"></i></div>`;
    if (!P.roomOk) h += `<div class="row sub"><span></span><span class="miss">还差 ${fmt(P.lack)} 份地方：在雪橇棚多造几辆车，或者少带点货</span></div>`;
    // 货：每样都能加减，点炉的材料和路上的口粮燃料另算
    h += `<div class="sec">带上的货 <button class="small ghost" data-act="mgoodreset">按推荐的带</button></div>`;
    const keys = Object.keys(P.goods).filter(k => P.goods[k] > 0);
    for (const k of keys) {
      const n = P.goods[k], st = Math.max(10, Math.pow(10, Math.floor(Math.log10(Math.max(10, n)))) / 2), have = Math.floor(main.stock[k] || 0), need = P.need[k] || 0;
      h += `<div class="row mgood"><span>${RICON[k]} ${RES[k].n}<small>库里 ${fmt(have)}${need > have ? ' · <b class="miss">不够</b>' : ''}</small></span><span class="stepper"><button data-act="mgood" data-arg="${k}:${-st}">−</button><b>${fmt(n)}</b><button data-act="mgood" data-arg="${k}:${st}">＋</button></span></div>`;
    }
    const extra = RES_KEYS.filter(k => !keys.includes(k) && (main.stock[k] || 0) >= 10 && RES[k].t <= S.known);
    if (extra.length) h += `<div class="row sub"><span>再带一样</span><span><select data-act="mgoodadd"><option value="">挑一样…</option>${extra.map(k => `<option value="${k}">${RES[k].n}（库里 ${fmt(main.stock[k])}）</option>`).join('')}</select></span></div>`;
    const sup = Object.keys(P.supplies).map(k => `${RICON[k]}${fmt(P.supplies[k])}`).join(' '), kit = Object.keys(P.kit).map(k => `${RICON[k]}${fmt(P.kit[k])}`).join(' ');
    h += `<div class="row sub"><span>路上吃的烧的</span><span>${sup}（自动算）</span></div>`;
    h += `<div class="row sub"><span>点新熔炉</span><span>${kit}（自动算）</span></div>`;
    if (P.short.length) h += `<div class="row sub"><span></span><span class="miss">主营地库里不够：${esc(P.short.join('，'))}</span></div>`;
    h += `<div class="hint">路上的事有的要用车上的货：搭桥要木板（冰原裂谷要钢材），扎营要燃料，丢给狼群要生肉。多带一点，到时候就多一条路。</div>`;
    // 后面的营地：留守还是熄火
    h += `<div class="sec">后面的营地</div>`;
    for (const c of P.camps) {
      const em = Sim.douseEmbers(S, c.lvl);
      h += `<div class="mcamp"><div class="row"><span><b>${esc(c.name)}${c.main ? '<i class="tagm">主营地</i>' : ''}</b><small>👥${c.people} · 熔炉 ${c.lvl} 级</small></span></div>
        <div class="seg"><button class="btn ${c.mode !== 'douse' ? 'on' : ''}" data-act="mmode" data-arg="${c.id}:keep">留守<small>${c.main ? `留 ${Math.max(Sim.DEPOT_MIN, c.stay)} 人` : '变成补给站'}，货交给物流网</small></button><button class="btn ${c.mode === 'douse' ? 'on' : ''}" data-act="mmode" data-arg="${c.id}:douse">熄火<small>换 🔥${em}，人跟上来</small></button></div></div>`;
    }
    // 路上的天气：极光观测站以后看得到
    if (J.stage >= 9 && g.route.ok) {
      const wx = Sim.tripWeather(S, P.secs);
      h += `<div class="row sub"><span>路上的天气</span><span>${wx ? `<b class="miss">出发后约 ${Math.max(1, Math.round(wx.at / 60))} 分钟碰上暴风雪</b>，车队得停下来拿主意` : '这一路没有暴风雪'}</span></div>`;
    }
    if (g.route.ok) h += `<button class="btn wide ghost" data-act="routeprev">在地图上看路线</button>`;
    h += `<button class="btn wide ${g.ok ? 'go' : ''}" data-act="depart" ${g.ok ? '' : 'disabled'}>${g.ok ? `出发去「${esc(g.next.n)}」` : `还差 ${4 - g.n} 条才能出发`}</button>`;
    return h;
  }
  // 1.1 分岔北境：去下一站的几条路；这一站的奇遇
  forkHtml(J) {
    const S = this.S, N = Sim.northN(J.stage); if (!N) return '';
    let h = '';
    const F = Sim.forkOf(S);
    if (F) {
      const n = Sim.forkN(S);
      h += `<div class="sec">选一条路 <small class="mgn">侦察兵带回 ${n} 条${n < 3 ? ' · 研究「三岔侦察」多一条' : ''}</small></div><div class="fkl">`;
      F.opts.slice(0, n).forEach((o, i) => {
        const rl = NORTH_RULES[o.rule], on = F.pick === i, q = QY[o.qy];
        h += `<div class="fko ${on ? 'on' : ''}"><div class="fkh"><b>${rl.ic} ${esc(rl.n)}${o.rich ? `<small>${esc(RES[SPOTS[o.rich].res].n)}</small>` : ''}</b><i class="fkd d${o.d}">${FORK.dn[o.d]}</i></div>`
          + `<div class="fkr"><span class="good">好：${esc(rl.good)}</span><span class="bad">坏：${esc(rl.bad)}</span></div>`
          + `<div class="fkg"><span>特产<b>${esc(Sim.forkSpec(o))}</b></span><span>奇遇<b>${this.qyIco(o.qy, q.ic)} ${esc(q.n)}</b></span><span>好处<b>${esc(Sim.bonusTxt(o.bonus, o.d))}</b></span><span>目标<b>×${FORK.diff[o.d]}</b></span></div>`
          + (on ? '<div class="fkon">✓ 走这条</div>' : `<button class="small" data-act="forkpick" data-arg="${i}">选这条${F.pick == null && i === 0 ? '（不选就走它）' : ''}</button>`) + '</div>';
      });
      h += `</div><div class="hint">下一站的位置不变，选了哪条，那一片地就照它重新生成。难走的路目标高一成半，奖励 ×${FORK.rew[2]}；好走的目标低一成，奖励 ×${FORK.rew[0]}。出发前都能改。</div>`;
    } else if (N) {
      h += `<div class="row sub"><span>🧭 下一站的路</span><span>${N <= Sim.TOWER_N ? '点亮这一站的烽火塔以后，侦察兵会带回几条路来选' : '这一章做完以后，侦察兵会带回几条路来选'}</span></div>`;
    }
    const q = Sim.qyOf(S);
    if (q) {
      const Q = QY[q.id], w = Sim.qyWait(S);
      h += `<div class="row"><span>${this.qyIco(q.id, Q.ic)} 这一站的奇遇<small>${esc(Q.n)}</small></span>${q.done ? `<span>${q.miss ? '错过了' : '走完了'}</span>` : w ? `<span>${q.away ? `${q.away} 人在外面，` : ''}${fmtTime(w.left)} 后${q.st ? '有下文' : '出现'}</span>` : '<button class="small go" data-act="qyopen">拿主意</button>'}</div>`;
    }
    return h;
  }
  // 车队在路上：进度、路上的事、跟着看；到了以后去放熔炉
  tripHtml(T) {
    const S = this.S, st = Sim.stopOf(S, T.to), left = T.phase === 'arrive' ? 0 : (T.len - T.d) / Math.max(1e-6, T.speed) + (T.hold || 0);
    let h = `<div class="mighero"><div class="mgto">往「<b>${esc(st.n)}</b>」</div><small>${T.phase === 'arrive' ? '车队到了' : `走了 ${Math.round(T.d / T.len * 100)}% · 还要 ${fmtTime(left)} 左右`}</small></div>`;
    h += `<div class="bar"><i style="width:${(T.d / T.len * 100).toFixed(0)}%"></i></div>`;
    const vs = Sim.VEH_KEYS.filter(v => T.veh[v]).map(v => `${Sim.vehName(v)} ${T.veh[v]}`).join(' · ');
    h += `<div class="row"><span>车上</span><span>👥${T.people}${T.specs.length ? ` · 专家 ${T.specs.length}` : ''} · ${vs}</span></div>`;
    if (T.sick) h += `<div class="row sub"><span></span><span>${T.sick} 人冻伤，到了先养病</span></div>`;
    if (T.phase === 'arrive') {
      h += `<div class="hint">在「${esc(st.n)}」附近挑一块平地放下新熔炉，车上的人和货就是新主营地的开局。${Math.max(0, Math.ceil(Sim.ARRIVE_AUTO - (S.t - T.at)))} 秒内没选，就放在推荐的位置。</div>`;
      return h + `<button class="btn wide go" data-act="arrive">去放熔炉</button>`;
    }
    if (T.road) h += `<button class="btn wide go" data-act="roadopen">车队停下了：${esc(Sim.roadView(S).title)} · 拿主意</button>`;
    else if (T.hold > 0) h += `<div class="row sub"><span></span><span>车队扎营等着，还要 ${Math.ceil(T.hold)} 秒</span></div>`;
    if ((T.done || []).length) h += `<div class="sec">路上的事</div>` + T.done.map(([id, i]) => `<div class="row sub"><span>${esc(Sim.roadName(id))}</span><span>${i === 0 ? '按稳妥的办' : '选了另一条路'}</span></div>`).join('');
    h += `<div class="hint">车队在路上时，后面的营地照常运转。关掉页面车队也照样走，路上的事一分钟没人管就按稳妥的办。</div>`;
    h += `<button class="btn wide ${this.g.view.followTrip ? '' : 'go'}" data-act="followtrip">${this.g.view.followTrip ? '不跟了' : '跟着车队看'}</button>`;
    return h;
  }
  // 余烬强化：永久的，跟着一路叠上去；通关以后可以开新的北行
  emberHtml() {
    const S = this.S;
    let h = `<div class="row"><span>手上的余烬</span><b>🔥 ${Math.floor(S.meta.embers)}</b></div>`;
    h += `<div class="hint">余烬从这些地方来：熄火的营地（熔炉每级 2 点）、第一次到达地标、做完章节、成就、路上的事、商队订单和营地委托。</div>`;
    for (const k in EMBER_UPS) {
      const u = EMBER_UPS[k], lv = Sim.up(S, k), cost = emberCost(k, lv);
      h += `<div class="row"><span><b>${u.n}</b> ${lv}/${u.max}<br><small>${u.d}</small></span><span>${lv >= u.max ? '已满' : `<button class="small ${S.meta.embers >= cost ? 'go' : ''}" data-act="ember" data-arg="${k}">🔥${cost}</button>`}</span></div>`;
    }
    if (S.meta.graduated) h += `<div class="sec">新的北行</div><div class="hint">永恒之炉已经点燃。可以从灰烬营地重新出发：余烬强化、专家、收集册和遗物都带着走，还能换更难的难度。</div><button class="btn wide" data-act="newjourney">开始新的北行</button>`;
    return h;
  }

  // 菜单 › 设置：声音、画面、提示、难度
  p_menu(part) {
    const S = this.S;
    if (part === 'title') return '设置';
    const g = this.g;
    const tg = (k, on, ic, n, d) => `<button class="tgl ${on ? 'on' : ''}" data-act="snd" data-arg="${k}"><span class="ti">${ic}</span><span class="tt">${n}<small>${d}</small></span><i class="sw"></i></button>`;
    let h = `<div class="sec">声音与画面</div><div class="tgls">${tg('sfx', g.audio.sfxOn, '🔊', '音效', '风声、炉火、敲打')}${tg('music', g.audio.musicOn, '🎵', '音乐', '低沉的旋律和铃声')}<button class="tgl ${this.floatOn !== false ? 'on' : ''}" data-act="floats"><span class="ti">✨</span><span class="tt">产出飘字<small>建筑上方冒出「+5 🪵」</small></span><i class="sw"></i></button><button class="tgl ${S.meta.hintOff ? '' : 'on'}" data-act="hintsw"><span class="ti">📜</span><span class="tt">新玩法提示<small>某样玩法第一次用得上时说一句</small></span><i class="sw"></i></button><button class="tgl ${g.sugOn ? 'on' : ''}" data-act="sugsw"><span class="ti">⭐</span><span class="tt">推荐位置<small>摆放建筑时地上标出 3 处好位置</small></span><i class="sw"></i></button></div>`;
    h += `<div class="mlab">界面配色<small>跟着天气：暴风雪和寒潮时冷，平时暖</small></div>`;
    h += `<div class="seg">${THEMES.map(([k, n, d]) => `<button class="btn ${g.theme.pref === k ? 'on' : ''}" data-act="theme" data-arg="${k}">${n}<small>${d}</small></button>`).join('')}</div>`;
    if (g.pc && g.pc.on) { // 电脑版才有：界面大小
      h += `<div class="mlab">界面大小<small>自动：1080p 是 100%，2K 及以上 125%</small></div>`;
      h += `<div class="seg">${ZOOMS.map(([k, n, d]) => `<button class="btn ${g.pc.zp === k ? 'on' : ''}" data-act="uiscale" data-arg="${k}">${n}${d ? `<small>${d}</small>` : ''}</button>`).join('')}</div>`;
    }
    h += `<div class="mlab">画质<small>卡顿时会自动降一档</small></div>`;
    h += `<div class="seg">${[['low', '流畅', '无阴影'], ['high', '标准', '推荐'], ['ultra', '极致', '细节更多']].map(([k, n, d]) => `<button class="btn ${g.quality === k ? 'on' : ''}" data-act="quality" data-arg="${k}">${n}<small>${d}</small></button>`).join('')}</div>`;
    h += `<div class="sec">玩法</div><div class="row"><span>难度 <b>${Sim.diffOf(S).ic}${Sim.diffOf(S).n}</b><br><small>随时可以改</small></span><span style="flex:none"><button class="small" data-act="diff">改难度</button></span></div>`;
    h += `<div class="mfoot">寒烬北行 · ${VERSION_NAME}</div>`;
    return h;
  }
  // 菜单 › 存档：自动保存、存档码、备份、存档位
  p_msave(part) {
    const S = this.S, g = this.g;
    if (part === 'title') return `存档 <small>存档位 ${g.slot} / ${SLOTS}</small>`;
    const ago = S.savedAt ? Math.max(0, (Date.now() - S.savedAt) / 1000) : null;
    return `<div class="msave"><span class="msi">💾</span><span>自动保存在这台设备上${ago != null ? `<em>${ago < 60 ? '刚刚' : ago < 3600 ? Math.floor(ago / 60) + ' 分钟前' : ago < 86400 ? Math.floor(ago / 3600) + ' 小时前' : Math.floor(ago / 86400) + ' 天前'}存过</em>` : ''}<small>关掉页面后营地照常运转，暴风雪和袭营也照常结算；但离线时物资按离开多久打折入库：前 1 小时 40%，1 到 4 小时 20%，4 到 12 小时 10%，超过 12 小时不再算；三星产线多拿一半，离线入库最多填到仓库的八成。</small></span></div>
      <div class="row2"><button class="btn" data-act="export">📤 导出存档码</button><button class="btn" data-act="import">📥 导入存档码</button></div>
      <div class="hint">换设备时，在旧设备导出存档码，到新设备上导入。</div>
      ${this.bkRow()}
      <div class="row"><span>存档位 <b>${g.slot}</b> / ${SLOTS}<br><small>三个存档位，各是一局</small></span><span style="flex:none"><button class="small" data-act="slots">换存档位</button></span></div>
      <div class="mdanger"><button class="btn ghost" data-act="wipe">删除这个存档，从头开始</button></div>`;
  }
  // 菜单 › 收藏：收集册、成就、装扮、相册、拍照、曲线
  p_mcoll(part) {
    const S = this.S;
    if (part === 'title') return '收藏';
    let h = '';
    { const N = Sim.bookCount(S), nf = Sim.bookOf(S).fresh.length;
      h += `<button class="mlink book" data-act="book"><span>🏆</span><span>收集册${nf ? `<b class="mnew">${nf} 新</b>` : ''}<small>收集 ${N.got}/${N.all} · 成就 ${N.cats.a[0]}/${N.cats.a[1]}（北迁后也保留）</small></span><i>›</i></button>`; }
    if (Sim.skyEnded(S)) h += `<button class="mlink" data-act="skyreplay"><span>🔥</span><span>再看一遍天火<small>十道光柱一路往南连回永恒之炉，再看看「这一路」</small></span><i>›</i></button>`;
    { const B = Sim.bookOf(S), got = Sim.ACH.filter(x => B.a[x.id]).length, nf = B.fresh.filter(f => f.startsWith('a:')).length;
      h += `<div class="mrow2"><button class="mlink" data-act="ach"><span>🏆</span><span>成就${nf ? `<b class="mnew">${nf} 新</b>` : ''}<small>${got}/${Sim.ACH.length} · 按类别看进度和奖励</small></span><i>›</i></button><button class="mlink" data-act="dress"><span>🎨</span><span>装扮<small>称号、炉火、旗子、相框</small></span><i>›</i></button></div>`; }
    if (!this.album) this.loadAlbum();
    h += `<div class="mrow2"><button class="mlink" data-act="photo"><span>📷</span><span>拍照模式<small>藏起界面，换时辰、滤镜、相框，拍一张<span class="kh">（H）</span></small></span><i>›</i></button><button class="mlink" data-act="album"><span>📔</span><span>相册<small>${this.album ? `${this.album.length} 张 · ` : ''}一路上自动拍的和你收进来的</small></span><i>›</i></button></div>`;
    h += `<button class="mlink" data-act="curve"><span>📈</span><span>数据曲线<small>人口、心情、温度，物资的储量和产量怎么变的<span class="kh">（G）</span></small></span><i>›</i></button>`;
    return h;
  }
  // 菜单 › 帮助：玩法说明、更新日志、按键
  p_mhelp(part) {
    if (part === 'title') return `帮助 <small>${VERSION_NAME}</small>`;
    const keys = [['1 – 5', '营地 · 生产 · 建造 · 研究 · 北行'], ['Esc / 右键', '关上窗口'], ['J', '规划'], ['空格', '回到炉火'], ['B', '建造'], ['M', '北行地图'], ['C', '生产链'], ['G', '数据曲线'], ['K', '收集册'], ['H', '拍照'], ['P', '暂停'], ['F', '换倍速'], ['+ / −', '拉近 / 拉远'], ['Q / E', '转镜头'], ['WASD', '移动镜头']];
    return `<button class="mlink" data-act="changelog"><span>📜</span><span>更新日志<small>${VERSION_NAME} · 每一版加了什么</small></span><i>›</i></button>
      <div class="helpin">${HELP}</div>
      <div class="sec">电脑上的按键</div><div class="keys">${keys.map(([k, n]) => `<span><kbd>${k}</kbd>${n}</span>`).join('')}</div>
      <div class="hint">手机上：双指捏合拉近拉远、转动镜头；按住速度键暂停。</div>`;
  }
  // 北行 › 烽火塔：这一路走到哪了、北境的塔、地标和北行纪事
  p_towers(part) {
    const S = this.S, st = S.stats;
    if (part === 'title') return `烽火塔 <small>已点亮 ${Sim.towersLit(S)} / ${Sim.TOWER_N}</small>`;
    const top = LANDMARKS[LANDMARKS.length - 1].row, far = Math.round(Math.max(...S.camps.map(c => c.y)));
    const known = Math.max(S.known, ...S.discovered);
    const next = LANDMARKS.findIndex((l, i) => !S.founded.includes(i) && l.row > far);
    const people = S.camps.reduce((a, c) => a + c.people, 0);
    let h = `<div class="mjour">
      <div class="mjh"><div><div class="mjt">第 ${S.meta.runs} 次北行</div><small>这一程走了 ${fmtTime(S.t)}${Sim.skyEnded(S) ? ' · 🔥 已点燃天火' : S.meta.graduated ? ' · 🌟 已点燃永恒之炉' : ''}</small></div>
        <div class="mje" title="余烬：北迁时带到下一程的永久加成"><b>🔥${fmt(S.meta.embers)}</b><small>余烬</small></div></div>
      <div class="route"><i class="rl"><i style="width:${Math.min(100, far / top * 100).toFixed(1)}%"></i></i>
        ${LANDMARKS.map((l, i) => { const cls = S.founded.includes(i) ? 'on' : S.discovered.includes(i) ? 'seen' : ''; return `<span class="rn ${cls} ${i === next ? 'next' : ''} ${i % 2 ? 'up' : ''}" style="left:${(l.row / top * 100).toFixed(1)}%"><em></em><small>${i <= known || cls ? l.n : '？'}</small></span>`; }).join('')}</div>
      <div class="mnext">${Sim.northN(Sim.journeyOf(S).stage) ? `🧭 <b>${esc(northRec(S))}</b> · 下一站：${esc(Sim.stopOf(S, Sim.journeyOf(S).stage + 1).n)}` : next >= 0 ? `下一站：<b>${LANDMARKS[next].n}</b>（纬度 ${LANDMARKS[next].row}，现在最北到 ${far}）${S.meta.northMax ? `<br><small>🧭 ${esc(northRec(S))}</small>` : ''}` : `所有地标都走到了。${S.meta.northMax ? ` 🧭 ${esc(northRec(S))}` : ' 翻过世界之脊就是北境。'}`}</div>
      <div class="mstats">
        <span><b>${people}</b>人口</span><span><b>${S.camps.length}</b>座营地</span><span><b>${S.buildings.length}</b>栋建筑</span>
        <span><b>${st.arrivals}</b>人投奔</span><span class="${st.deaths ? 'neg' : ''}"><b>${st.deaths}</b>人遇难</span><span><b>${st.raidsWon}/${st.raids}</b>守住袭营</span>
      </div>
    </div>`;
    // 十座塔
    const N = Sim.northN(Sim.journeyOf(S).stage), lit = Sim.towerList(S);
    h += `<div class="sec">北境的塔 <small>前十站每站一座，第十站是天火塔</small></div><div class="twlist">`;
    for (let n = 1; n <= Sim.TOWER_N; n++) {
      const L = lit.find(t => t.n === n), b = !L && S.buildings.find(x => x.tn === n && BLD[x.type].tower);
      let stx = '', cls = '';
      if (L) { stx = '已点亮'; cls = 'lit'; }
      else if (b) { const sp = Sim.towerSpec(S, n); stx = b.tw.p >= sp.dur ? '塔身砌好了，等点火' : `塔身 ${Math.floor(b.tw.p / sp.dur * 100)}%`; cls = 'on'; }
      else if (N === n) { stx = '这一站：立地基'; cls = 'here'; }
      else stx = n < N ? '没有立' : `北境第 ${n} 站`;
      h += `<div class="twr ${cls}" ${b ? `data-act="spot" data-arg="${b.id}"` : ''}><i>${n === Sim.TOWER_N ? '☀' : n}</i><span><b>${Sim.towerName(n)}</b><small>${stx}</small></span>${b ? '<em>›</em>' : ''}</div>`;
    }
    h += `</div><div class="hint">每座点亮的塔让那座营地希望 +${TOWER_FX.hope}、暖圈 +${TOWER_FX.warm} 格；点着第十站的天火塔就是最终结局。</div>`;
    h += `<div class="sec">一路的地标</div><div class="journey">`;
    LANDMARKS.forEach((l, i) => {
      const st2 = S.founded.includes(i) ? 'done' : S.discovered.includes(i) ? 'seen' : '';
      h += `<div class="jstep ${st2}" data-act="${S.discovered.includes(i) ? 'lmgo' : ''}" data-arg="${i}"><span>${st2 === 'done' ? '🏁' : st2 === 'seen' ? '📍' : '❔'}</span>${i <= known || st2 ? l.n : '？？？'}</div>`;
    });
    h += `</div><button class="mlink" data-act="chapter"><span>📖</span><span>北行纪事<small>每到一站开启新的一章</small></span><i>›</i></button>`;
    return h;
  }
  // 生产 › 产线：主线和支线，各自的速度、星级和下一颗星
  pf_plines() { return '<button class="btn" data-act="chainmap">🔗 生产链图</button><button class="btn go" data-act="pladd">＋ 立支线</button>'; }
  p_plines(part) {
    const S = this.S, L = Sim.plinesOf(S);
    if (part === 'title') return `产线 <small>主线 + 支线 ${Sim.sideCount(S)}/${Sim.sideMax(S)}</small>`;
    const fr = v => v >= 10 ? Math.round(v) : Math.round(v * 10) / 10, mm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    let h = '';
    if (!L.length) return h + `<div class="hint">还没有产线。每一章的产能目标会自动立成主线；也可以自己挑一种材料立支线，稳住目标速度就升星。</div>`;
    for (const l of L) {
      const r = Sim.prodRate(S, l.r), pct = Math.min(1, r / Math.max(0.01, l.n)), nx = l.star < 3 ? Sim.STAR_T[l.star] - l.st : 0;
      h += `<div class="plrow ${l.on ? 'up' : ''}" data-act="plan" data-arg="${l.r}"><span class="pli">${RICON[l.r]}</span><span class="plt"><b>${RES[l.r].n}${l.main ? '<em>主线</em>' : ''}<i class="stars">${'★'.repeat(l.star)}${'☆'.repeat(3 - l.star)}</i></b>
        <span class="plbar"><i style="width:${(pct * 100).toFixed(1)}%"></i></span>
        <small>${fr(r)} / ${fr(l.n)} 每分钟 · ${l.star >= 3 ? '已经三星' : `再稳住 ${mm(nx)} 升${l.star + 1}星${l.on ? '' : '（掉下来了，暂停）'}`}</small></span><em>›</em></div>`;
    }
    h += `<div class="hint">速度在目标以上稳住 10 分钟升一星（产量 +15%），30 分钟二星（每座少要 1 个工人），90 分钟三星（产量再 +30%）。点一条线打开规划器，看整条链每一环差多少。</div>`;
    return h;
  }
  // 建造 › 规划：每条线最卡的那一环还差几座，直接建
  p_plan(part) {
    const S = this.S, L = Sim.plinesOf(S);
    if (part === 'title') return '规划 <small>只指方向，建在哪你来定</small>';
    const fr = v => v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    let h = '';
    if (!L.length) return `<div class="hint">这一章还没有产能目标。先按顶上的目标走；有了「每分钟产多少」的目标，这里会算出每一环还差几座。</div><button class="btn wide" data-act="plan">打开规划器</button>`;
    for (const l of L) {
      const P = Sim.planLine(S, l.r, l.n), x = P.worst;
      h += `<div class="pcard"><div class="pch">${RICON[l.r]}<b>${RES[l.r].n}${l.main ? '主线' : '支线'}</b><small>${fr(P.rate)} / ${fr(l.n)} 每分钟</small><button class="small" data-act="plan" data-arg="${l.r}">规划器 ›</button></div>`;
      if (!x) { h += `<div class="pcok">✓ 每一环都跟得上</div></div>`; continue; }
      const t = x.type, per = x.count && x.prod > 0 ? x.prod / x.count : x.one, nb = t ? Math.max(1, Math.ceil(x.gap / Math.max(0.1, per))) : 0;
      const short = Object.keys(x.stat).filter(k => k.startsWith('缺')).map(k => k.slice(1));
      h += `<div class="pcw"><span>${RICON[x.k]}</span><span><b>最卡：${RES[x.k].n}</b><small>现在 ${fr(x.prod)} / 要 ${fr(x.need)} 每分钟${t ? ` · ${BLD[t].n} ×${x.count}` : ''}</small>${x.count && short.length ? `<small class="warn">是上游的${short.join('、')}不够：先补上游</small>` : t && x.gap >= 0.05 ? `<small>还差约 <b>${nb}</b> 座${BLD[t].n}</small>` : ''}</span>${t && Sim.unlocked(S, t) && x.gap >= 0.05 ? `<button class="small go" data-act="place" data-arg="${t}">建一座</button>` : t && !Sim.unlocked(S, t) ? `<small class="bad">${BLD[t].n}还没解锁</small>` : ''}</div></div>`;
    }
    { const main = Sim.mainCamp(S); h += `<div class="hint">主营地人口 ${main.people}/${Sim.popCap(S, main)}，空闲 ${Math.max(0, Sim.idleLabor(S, main))} 人；供热圈空地约 ${Sim.freeLand(S, main)} 块。</div>`; }
    return h;
  }
  // 建造 › 队列：等材料的建筑和升级，材料到齐按顺序自动开工
  p_bqueue(part) {
    const S = this.S, c = this.camp();
    const Q = (S.queue || []).filter(q => q.camp === c.id), U = S.buildings.filter(b => b.camp === c.id && b.qup);
    if (part === 'title') return `队列 <small>${esc(c.name)} · ${Q.length + U.length} 项</small>`;
    if (!Q.length && !U.length) return `<div class="hint">没有在等材料的建筑。摆建筑时材料不够也能先摆下（蓝图），材料一到自动开工；建筑面板里的「材料到齐自动升」也排在这里。</div>`;
    let h = '';
    if (Q.length) h += `<div class="sec">等材料的新建筑 <small>${Q.length}/${Sim.QUEUE_MAX}</small></div>`;
    Q.forEach((q, i) => {
      const cost = Sim.queueCost(S, q), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
      h += `<div class="qrow"><span class="qn">${i + 1}</span>${this.ico(q.type, 1)}<span class="qt"><b>${BLD[q.type].n}</b><small>${miss.length ? '等材料：' + miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') + (this.netWait(c, miss[0]) ? `，${RES[miss[0]].n}${this.netWait(c, miss[0])}` : '') : '齐了，马上开工'}</small></span><button class="small" data-act="lookat" data-arg="${q.x + BLD[q.type].size / 2},${q.y + BLD[q.type].size / 2}">看看</button><button class="small ghost" data-act="unqueue" data-arg="${q.id}">取消</button></div>`;
    });
    if (U.length) h += `<div class="sec">等材料的升级</div>`;
    for (const b of U) {
      const cost = Sim.upgradeCost(S, b), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
      h += `<div class="qrow"><span class="qn">↑</span>${this.ico(b.type, b.lvl)}<span class="qt"><b>${BLD[b.type].n} ${b.lvl}→${b.lvl + 1} 级</b><small>${miss.length ? '等材料：' + miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') + (this.netWait(c, miss[0]) ? `，${RES[miss[0]].n}${this.netWait(c, miss[0])}` : '') : '齐了，马上升'}</small></span><button class="small" data-act="openbld" data-arg="${b.id}">看看</button><button class="small ghost" data-act="qup" data-arg="${b.id}">取消</button></div>`;
    }
    return h;
  }
  // 提醒：眼下要留意的事一条一张卡；消息在旁边的页签
  p_alerts(part) {
    const S = this.S, A = this.alertsNow || [];
    if (part === 'title') return `提醒 <small>${esc(this.camp().name)}</small>`;
    const act = A.filter(a => a.lvl !== 'info'), info = A.filter(a => a.lvl === 'info');
    let h = '';
    if (!act.length) h += `<div class="hint">眼下没有要处理的事。</div>`;
    for (const a of act) h += this.alertCard(a);
    if (this.adv) h += this.alertCard({ ic: GMED, lvl: 'tip', t: '老向导', d: this.adv.text, act: 'advisor', btn: this.advBtn(this.adv) });
    if (info.length) h += `<div class="sec">这会儿</div>` + info.map(a => this.alertCard(a)).join('');
    const nl = S.log.length; h += `<button class="mlink" data-act="htab" data-arg="log"><span>📜</span><span>消息记录<small>最近 ${nl} 条：发生过的事都在这里</small></span><i>›</i></button>`;
    return h;
  }
  alertCard(a) {
    return `<div class="alc ${a.lvl}"><span class="ali">${a.ic}</span><span class="alt"><b>${esc(a.t)}${a.cnt ? `<small>${a.cnt}</small>` : ''}</b><small>${esc(a.d)}</small></span>${a.act ? `<button class="small ${a.lvl === 'bad' ? 'go' : ''}" data-act="${a.act}" data-arg="${a.arg ?? ''}">${esc(a.btn || '去看看')}</button>` : ''}</div>`;
  }

  p_spot(part) {
    const S = this.S, i = this.panel.arg, w = getWorld(S.runSeed);
    const k = SPOT_KEYS[w.spot[i]], sp = SPOTS[k];
    if (k === 'ruin') {
      // 古城废墟：不是矿，点一下派人拆
      if (part === 'title') return '🏛 古城废墟';
      const ck = Sim.ruinBlock(S, i), n = (ck.tiles || []).length, loot = Sim.ruinLoot(n), cost = Sim.ruinCost(n);
      if (!n) return '<div class="hint">这里的废墟已经拆掉了。</div>';
      return `<div class="row"><span>占地</span><span>${n} 格断墙</span></div>
        <div class="row"><span>拆了能得</span><span>${RICON.part} 古代构件 ${loot.part} · ${RICON.steel} 钢材 ${loot.steel}</span></div>
        <div class="row sub"><span>派人去拆</span><span>${RICON.food} 熟食 ${cost.food}（大家干活要吃饭）</span></div>
        <button class="go" data-act="ruin" data-arg="${i}" ${ck.why ? 'disabled' : ''}>拆掉这处废墟</button>${ck.why ? `<div class="hint warn">${esc(ck.why)}</div>` : ''}
        <div class="hint">古城遗址的断墙占着暖圈里的地，拆了就空出来能盖房，还能拆出古代构件和钢材。</div>`;
    }
    if (part === 'title') return `${RICON[sp.res]} ${sp.n}`;
    const left = Sim.spotLeft(S, i), mx = Sim.spotMax(S, i), grow = !!Sim.REGROW[k];
    const GW = { tree: ['树苗', '砍', '伐木场在补种'], herd: ['幼崽', '打', '猎人在留种'], dead: ['新的枯木', '砍', '伐木场在照看'], fish: ['鱼苗', '钓', '冰钓屋在照看'] }[k] || ['新的', '采', '有人照看'];
    let g = '';
    if (grow) {
      const rate = Sim.regrowRate(S, i, Sim.tendedSpots(S)), tend = rate > Sim.REGROW[k] * 1.5, sap = Sim.isSapling(S, i);
      g = `<div class="row sub"><span>恢复</span><span>${left >= mx ? '长满了' : `+${fmt(rate)}/分${tend ? ' · ' + GW[2] : ''}`}</span></div>`;
      if (sap) g += `<div class="row sub"><span>${GW[0]}</span><span>长到三成（${fmt(mx * Sim.SAP_RIPE)}）才能${GW[1]}，大约 ${Math.max(1, Math.ceil((mx * Sim.SAP_RIPE - left) / Math.max(0.01, rate)))} 分钟</span></div>`;
    }
    if (!grow && left > 0) {
      const by = Sim.minerOf(S, i);
      const eta = by ? Sim.gatherEta(S, by) : null;
      g += by ? `<div class="row sub"><span>正在挖</span><span>${BLD[by.type].n}${eta != null && eta > 0 ? ` · 这一片按现在的速度还能挖约 ${fmtMin(eta)}` : ''}</span></div>` : `<div class="row sub"><span>还没人挖</span><span>在旁边建${BLD[Sim.gatherTypeFor(k)].n}</span></div>`;
    }
    const gt = BLD[Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(k))];
    const why = { tree: '树砍光了会长回来。附近有伐木场会补种，长得快四倍。', herd: '猎物打光了会回来。附近有猎人小屋会留种，回来得快三倍。', dead: '冻土上没有活树，只有枯木堆。砍完过一阵风雪又刮出来一堆；附近有伐木场照看，刮出来得快三倍。', fish: '冰洞里的鱼钓光了会慢慢回来；附近有冰钓屋照看，回来得快三倍。钓上来的鱼直接当饭吃。' }[k] || '矿藏采完就没有了，到时候得去更远的地方。';
    return `<div class="row"><span>剩余储量</span><span>${fmt(left)} / ${fmt(mx)} ${RES[sp.res].n}</span></div><div class="bar"><i style="width:${(left / mx * 100).toFixed(1)}%"></i></div>${g}
      <div class="hint">${why}在附近（${gt.reach} 格内）建「${gt.n}」来采集。</div>`;
  }

  p_chapter(part) {
    const S = this.S, chs = Sim.chapters(S);
    if (part === 'title') { const N = Sim.northN(Sim.journeyOf(S).stage); return N ? `北行纪事 <small>${esc(northRec(S))}</small>` : `北行纪事 <small>第 ${Math.min(CHAPTERS.length, Sim.journeyOf(S).stage + 1)}/${CHAPTERS.length} 章</small>`; }
    let h = '';
    chs.slice().reverse().forEach((c, n) => {
      const open = n === 0 || (c.done && !c.got) || this.panel.arg === c.i;
      const nOk = c.tasks.filter(t => t.ok).length;
      if (!open) { h += `<div class="chrow" data-act="chapter" data-arg="${c.i}"><b>${esc(c.ch.n)}</b><span>${c.got ? '✓ 已完成' : `${nOk}/${c.tasks.length}`}</span></div>`; return; }
      const rl = c.ch.rule && NORTH_RULES[c.ch.rule];
      h += `<div class="chcard ${c.got ? 'got' : c.done ? 'ready' : ''}"><div class="chh"><small>📍 ${esc(Sim.stopOf(S, c.i).n)}${rl ? ` · ${rl.ic} ${esc(rl.n)}` : ''}</small><b>${esc(c.ch.n)}</b></div><p class="story">${esc(c.got ? c.ch.end : c.ch.story)}</p><div class="ctasks">`;
      for (const t of c.tasks) {
        const pr = t.low ? (t.ok ? 1 : Math.max(0, Math.min(1, (100 - t.cur) / (100 - t.n)))) : Math.min(1, t.cur / t.n);
        h += `<div class="ctask ${t.ok ? 'ok' : ''}"><span class="ck">${t.ok ? '✓' : ''}</span><div><span>${esc(t.t)}</span>${t.ok ? '' : `<div class="mbar"><i style="width:${(pr * 100).toFixed(1)}%"></i></div><small>${t.low ? `现在最高 ${fmt(t.cur)}` : `${fmt(t.cur)} / ${fmt(t.n)}`}</small>`}</div></div>`;
      }
      h += `</div><div class="crw">🎁 ${esc(Sim.chapterReward(S, c.i).join('，'))}</div>`;
      if (c.got) h += `<div class="cgot">✓ 奖励已领取</div>`;
      else if (c.done) h += `<button class="btn wide go" data-act="chapclaim" data-arg="${c.i}">领取奖励（发到「${esc(this.camp().name)}」）</button>`;
      h += `</div>`;
    });
    const nx = LANDMARKS.findIndex((l, i) => i > Math.max(...S.founded)), J = Sim.journeyOf(S);
    if (nx > 0 && !Sim.northN(J.stage)) h += `<div class="chrow next"><b>${esc(CHAPTERS[nx].n)}</b><span>在「${esc(LANDMARKS[nx].n)}」建起熔炉后开始</span></div>`;
    if (J.stage >= Sim.SPINE) { const st = Sim.stopOf(S, J.stage + 1), rl = st && NORTH_RULES[st.rule]; if (st) h += `<div class="chrow next"><b>${esc(st.n)}</b><span>${rl ? `${rl.ic} ${esc(rl.n)} · ` : ''}车队到了就开始</span></div>`; }
    h += `<div class="hint">${Sim.northN(J.stage) ? '北境每一站是一章：两条产能目标、一件这站地貌的事，前十站还有一座烽火塔。' : '每到一个新地标就开始新的一章。'}任务一旦做到就算完成；北迁到下一程时章节会重新开始。</div>`;
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

  // 不点按钮也能走一遍按钮的动作（老向导、提示里用）
  actDo(act, arg) { const el = { dataset: { act, arg: arg == null ? undefined : String(arg) } }; this.onClick({ target: { closest: q => q === '[data-act]' ? el : null } }); }
  // ---------- 点击 ----------
  onClick(e) {
    const tst = e.target.closest('.tk'); if (tst) this.dropToast(tst);
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act, arg = el.dataset.arg;
    if (!act) return;
    this.fromSheet = !!(el.closest && el.closest('#sheet')); // 从面板里点开别的面板：带「返回」
    const S = this.S, g = this.g;
    const res = r => { if (r && r.ok === false && r.reason) this.toast(r.reason, 'warn'); return r; };
    switch (act) {
      case 'close': this.close(); break;
      case 'bigmap': g.bigmap.toggle(); break;
      case 'chainmap': g.chainmap.toggle(); break;
      case 'plan': g.cancelModes(); this.close(); if (this.tutSeen) this.tutSeen.goal = true; g.chainmap.plan(arg || null); break;
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
      case 'speed': if (this.speedLong) { this.speedLong = false; break; } if (g.paused) g.togglePause(false); else g.setSpeed(g.nextSpeed()); break;
      case 'hub': this.openHub(arg); break;
      case 'htab': this.fromSheet = false; this.open(arg); break;
      case 'back': { const b = this.back; this.back = null; this.fromSheet = false; if (b) this.open(b.kind, b.arg); break; }
      case 'bell': if (this.panel && KIND_HUB[this.panel.kind] === 'bell') this.close(); else { g.cancelModes(); this.open((this.alertsNow || []).some(a => a.lvl !== 'info') || this.adv ? 'alerts' : 'log'); } break;
      case 'vt': { const c = this.camp(); g.cancelModes();
        if (arg === 'tmp' || arg === 'fuel') { if (this.panel && this.panel.kind === 'bld' && this.panel.arg === c.furnace) this.close(); else this.actDo('reqgo', c.furnace); }
        else if (arg === 'ppl') { const k = (c.disc ?? 10) >= 55 || (c.hope ?? 50) <= 25 ? 'mood' : 'folk'; if (this.panel && KIND_HUB[this.panel.kind] === 'camp') this.close(); else this.open(k); }
        else if (this.panel && this.panel.kind === 'stock') this.close(); else this.open('stock');
        break; }
      case 'pladd': g.cancelModes(); this.close(); g.chainmap.plan(); g.chainmap.adding = true; g.chainmap.render(); break;
      case 'camptab': g.cancelModes(); this.open(arg === 'road' ? 'towers' : 'camp'); break;
      case 'logf': this.logF = arg; this.renderPanel(true); this.sheet.scrollTop = 0; break;
      case 'close-modal': this.closeModal(); break;
      case 'wn-north': this.closeModal(); this.open('migrate'); break;
      case 'wn-theme': g.theme.set(arg); this.$('modal').querySelectorAll('[data-act="wn-theme"]').forEach(b => b.classList.toggle('on', b.dataset.arg === arg)); g.sfx && g.sfx('tap'); break;
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
        this.modal(`<h3>${this.fIco(k, D)} ${c.focus ? '改成' : '定为'}${D.n}营地？</h3><p>${D.d}</p><p class="nrwarn">代价：${D.bad}。</p><p class="hint">定下来以后 30 分钟内不能再换。</p>`, [{ t: '就这么定', a: 'focus-yes', arg, cls: 'go' }, { t: '再想想', a: 'close-modal' }]); break; }
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
      case 'movebld': g.startMove(+arg); break;
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
      case 'veh': { const [bid, v, n] = String(arg).split(':'); const r = Sim.orderVeh(S, +bid, v, +n || 1); if (!r.ok) this.toast(r.reason, 'warn'); else { g.sfx('tap'); if (r.reason && +n > 1) this.toast(`排了 ${r.n} 辆，${r.reason}`, 'warn'); } break; }
      case 'vehx': { const [bid, i] = String(arg).split(':'); Sim.cancelVeh(S, +bid, +i); break; }
      case 'followtrip': g.view.followTrip = !g.view.followTrip; if (g.view.followTrip) { this.close(); this.toast('镜头跟着车队走（拖动画面就停下）'); } break;
      case 'ignite': { const r = Sim.igniteTower(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else this.close(); break; }
      case 'ruin': { const r = Sim.dismantleRuin(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else { this.g.sfx('build'); this.close(); } break; }
      case 'spot': { const b = Sim.getB(S, +arg); if (b) { g.view.focus(b.x + 1, b.y + 1); this.open('bld', b.id); g.view.select(b.id); } break; }
      case 'campgo': { S.active = +arg; const c = this.camp(); g.view.focus(c.x, c.y); break; }
      case 'campBtn': if (S.camps.length > 1) { const i = S.camps.findIndex(c => c.id === S.active); S.active = S.camps[(i + 1) % S.camps.length].id; const c = this.camp(); g.view.focus(c.x, c.y); this.toast(`切换到「${c.name}」`); } else this.open('camp'); break;
      case 'lmgo': { const l = LANDMARKS[+arg]; g.view.focus(l.x, l.row); this.open('landmark', +arg); break; }
      case 'auto': { const c = Sim.getCamp(S, +arg); c.auto = c.auto === false; break; }
      case 'ev': { const msg = Sim.resolveEvent(S, +arg); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } break; }
      case 'road': { const msg = Sim.resolveRoad(S, +arg); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } break; }
      case 'roadopen': { this.roadModal(); break; }
      case 'dtake': { const [cid, on] = String(arg).split(':'); Sim.takeOver(S, +cid, on === '1'); g.sfx('tap'); this.toast(on === '1' ? '接手了：现在可以在这里盖房、升级' : '交回去了：它会自己运转', 'info'); this.renderPanel(true); this.hud(); break; }
      case 'ddouse': { const c = Sim.getCamp(S, +arg); if (!c) break; const emb = Sim.douseEmbers(S, Sim.getB(S, c.furnace).lvl);
        this.modal(`<h3>让「${esc(c.name)}」熄火？</h3><p>${c.people} 个人会往北去「${esc(Sim.mainCamp(S).name)}」，拆下三成的物资一起带走，换来 ${emb} 点余烬。营地会变成一片积雪的废墟，不能再点着。</p>`, [{ t: '熄火', a: 'ddouse-go', arg: c.id, cls: 'bad' }, { t: '算了', a: 'close-modal' }]); break; }
      case 'ddouse-go': { const r = Sim.douseDepot(S, +arg); this.closeModal(); if (!r.ok) this.toast(r.reason, 'warn'); else { g.sfx('lose'); this.toast(`熄火了，换来 ${r.embers} 点余烬`, 'story'); this.close(); } this.hud(); break; }
      case 'openbld': { const id = +arg; g.view.select(id); this.open('bld', id); break; }
      case 'tutskip': S.meta.tut = true; this.tutorial(); this.toast('已跳过新手引导。「菜单 → 帮助」里能看到玩法说明。', 'info'); break;
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
      case 'townup': { const r = res(Sim.townUp(S, +arg)); if (r.ok) { g.drainFx && g.drainFx(); this.renderPanel(true); } break; }
      case 'towngo': { S.active = +arg; g.cancelModes(); this.open('camp'); break; }
      case 'qyopen': if (!this.qyModal()) { const w = Sim.qyWait(S); this.toast(w ? `奇遇「${QY[w.q.id].n}」还要 ${fmtTime(w.left)} 才有下文。` : '这件奇遇已经过去了。', 'info'); } break;
      case 'qyopt': { const q = S.qy, away0 = q && q.away; const r = res(Sim.qyChoose(S, +arg)); if (r.ok) { g.sfx('tap'); g.drainFx(); this.qyModal({ id: q.id, ic: QY[q.id].ic, n: QY[q.id].n, msg: r.msg, next: r.next, wait: r.wait, away: q.away && q.away !== away0 ? q.away : 0 }); if (this.panel) this.renderPanel(true); } break; }
      case 'forkpick': { const r = res(Sim.pickFork(S, +arg)); if (r.ok) { g.sfx('tap'); this.renderPanel(true); } break; }
      case 'title-go': g.leaveTitle(); break;
      case 'hintsw': S.meta.hintOff = !S.meta.hintOff; if (S.meta.hintOff) g.hints.hide(); this.renderPanel(true); break;
      case 'sugsw': g.sugOn = !g.sugOn; try { localStorage.setItem('hanjin-beixing-v1-sug', g.sugOn ? '1' : '0'); } catch (e) {} this.renderPanel(true); break;
      case 'floats': this.floatOn = this.floatOn === false; try { localStorage.setItem('hanjin-beixing-v1-floats', this.floatOn ? '1' : '0'); } catch (e) {} this.renderPanel(true); break;
      case 'title-new': this.newRunModal(); break;
      case 'slots': this.slotsModal(); break;
      case 'slotuse': g.useSlot(+arg); break;
      case 'slotdel': {
        const s = g.slotInfo(+arg), nx = s.cur && g.nextSlot(+arg);
        const then = s.cur ? `<p class="hint">删掉以后${nx ? `会读取存档 ${nx}「${esc(g.slotInfo(nx).name || '')}」` : '会从头开始一局新的北行'}。</p>` : '';
        this.modal(`<p>删除存档 ${arg}${s.broken ? '（已经坏了）' : `里的「${esc(s.name || '')}」${s.cur ? '（正在玩的这一局）' : ''}`}？这一局的所有进度（包括余烬、专家和收集册）都会删掉。删之前会自动存一份备份，删错了可以到这个存档位的「菜单 → 存档 → 自动备份」里找回来。</p>${then}`, [{ t: '删除', a: 'slotdel-yes', arg, cls: 'bad' }, { t: '算了', a: 'slots' }]);
        break;
      }
      case 'slotdel-yes': if (+arg === g.slot) { g.deleteSlot(+arg); break; } g.deleteSlot(+arg).then(() => { this.slotsModal(); this.toast(`存档 ${arg} 已删除，删之前存了一份备份。`, 'info'); }); break;
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
      case 'netpg': this.netPg = arg; this.netFocus = null; g.sfx('tap'); break;
      case 'netview': this.netPg = 'all'; this.netFocus = arg ? +arg : null; this.open('lines'); break;
      case 'netsend': this.netPg = 'send'; this.open('lines'); break;
      case 'nto': this.netTo = +arg; g.sfx('tap'); break;
      case 'nk': this.netK = arg; g.sfx('tap'); break;
      case 'nsend': { const r = res(Sim.sendBatch(S, S.active, this.netTo, this.netK, arg === 'all' ? 'all' : +arg)); if (r.ok) { this.toast(`装车了：${RES[this.netK].n} ${fmt(r.n)} 送往「${(Sim.getCamp(S, this.netTo) || {}).name}」`, 'good'); g.sfx('tap'); } break; }
      case 'nfeed': { const r = res(Sim.addFeed(S, S.active, this.netTo, this.netK, +arg)); if (r.ok) { this.toast(`长期供货：每分钟 ${arg} ${RES[this.netK].n} 送往「${(Sim.getCamp(S, this.netTo) || {}).name}」`, 'good'); g.sfx('tap'); } break; }
      case 'nsendx': Sim.cancelSend(S, +arg); break;
      case 'nfeedx': Sim.delFeed(S, +arg); break;
      case 'nhold': Sim.toggleHold(S, S.active, arg); g.sfx('tap'); break;
      case 'roadadd': { const r = res(Sim.buildRoad(S, S.active, +arg, S.active)); if (r.ok) { this.toast(r.queued ? r.reason : '路修好了。', r.queued ? 'info' : 'good'); g.sfx('build'); } break; }
      case 'roadup': { const r = res(Sim.upgradeRoad(S, +arg, S.active)); if (r.ok) { this.toast(r.queued ? r.reason : '路升级了，能多运一半。', r.queued ? 'info' : 'good'); g.sfx('build'); } break; }
      case 'roadrail': { const r = res(Sim.railRoad(S, +arg, S.active)); if (r.ok) { this.toast(r.queued ? r.reason : '改成铁路了。', r.queued ? 'info' : 'good'); g.sfx('build'); } break; }
      case 'roadx': Sim.cancelRoad(S, +arg); break;
      case 'gpg': this.gPg = arg; g.sfx('tap'); break;
      case 'cmdsel': this.cmdSel = arg || null; this.cmdH = null; g.sfx('tap'); this.cmdBar(this.camp()); return;
      case 'cmdfire': { const r = res(Sim.fireCmd(S, arg, S.active)); if (r.ok) { this.cmdSel = null; g.drainFx(); } this.cmdH = null; this.cmdBar(this.camp()); return; }
      case 'baymod': { const [id, m] = arg.split(':'); const r = res(Sim.setBayModel(S, +id, m)); if (r.ok) { this.toast(`改成${BOT_MODELS[m].n}了。`, 'good'); g.sfx('build'); } break; }
      case 'bayscrap': { const [id, n] = arg.split(':'); const r = res(Sim.scrapBots(S, +id, +n)); if (r.ok) { this.toast(`拆了 ${r.n} 台自动机，退回 ${r.cores} 个核心。`, 'info'); g.sfx('tap'); } break; }
      case 'bayfill': Sim.bayRefill(S, +arg); g.sfx('tap'); break;
      case 'guild': g.cancelModes(); this.open('guild'); break;
      case 'gsell': { const [k, n] = String(arg).split(':'); const r = res(Sim.guildSell(S, S.active, k, +n)); if (r.ok) { this.toast(`卖了 ${fmt(r.n)} ${RES[k].n}，得银币 ${fmt(r.silver)}。`, 'good'); g.sfx('coin'); } break; }
      case 'gbuy': { const [k, n] = String(arg).split(':'); const r = res(Sim.guildBuy(S, S.active, k, +n)); if (r.ok) { this.toast(`买了 ${fmt(r.n)} ${RES[k].n}，花银币 ${fmt(r.silver)}。`, 'info'); g.sfx('coin'); } break; }
      case 'gemb': { const r = res(Sim.buyEmbers(S, +arg)); if (r.ok) { this.toast(`买了 ${r.n} 点余烬。`, 'good'); g.sfx('coin'); } break; }
      case 'gdeco': { const r = res(Sim.buyDeco(S, arg)); if (r.ok) { this.toast(`买下了「${BLD[arg].n}」的图纸：在建造 › 篝火里能盖了。`, 'good'); g.sfx('win'); } break; }
      case 'gdeliv': { const r = res(Sim.guildDeliver(S, S.active, +arg)); if (r.ok) { this.toast(`订单交了：银币 +${fmt(r.silver)}，余烬 +${r.emb}。`, 'good'); g.sfx('win'); } break; }
      case 'altset': { const [id, on] = String(arg).split(':'); const r = res(Sim.setAlt(S, +id, on === '1')); if (r.ok && !r.same) { this.toast(`换成${on === '1' ? '替代配方' : '原配方'}了，停工 ${ALT_SWITCH} 秒。`, 'info'); g.sfx('tap'); } break; }
      case 'gatego': {
        const m = Sim.mainCamp(S);
        if (arg === 'route') this.open('scout');
        else if (arg === 'chap') this.open('chapter');
        else if (arg === 'flvl') { S.active = m.id; this.actDo('reqgo', m.furnace); }
        else if (arg === 'car') {
          const sh = S.buildings.filter(b => b.type === 'sledshed').sort((a, b) => (b.camp === m.id) - (a.camp === m.id))[0];
          if (sh) { S.active = sh.camp; this.actDo('reqgo', sh.id); } else { S.active = m.id; this.close(); g.startPlace('sledshed'); this.toast('先建一座雪橇棚，在里面造雪橇', 'info'); }
        }
        break;
      }
      case 'mstay': {
        const mc = Sim.tripPlan(S).camps.find(c => c.main); if (!mc) break;
        Sim.setPlan(S, { stay: Math.max(Sim.DEPOT_MIN, Math.min(mc.people, mc.stay + +arg)) }); this.renderPanel(true); break;
      }
      case 'mgood': {
        const [k, d] = arg.split(':'), goods = { ...Sim.tripPlan(S).goods };
        goods[k] = Math.max(0, Math.round((goods[k] || 0) + +d)); if (!goods[k]) delete goods[k];
        Sim.setPlan(S, { goods }); this.renderPanel(true); break;
      }
      case 'mgoodreset': Sim.setPlan(S, { goods: null }); this.renderPanel(true); break;
      case 'mmode': { const [cid, m] = arg.split(':'); Sim.setCampMode(S, +cid, m); this.renderPanel(true); break; }
      case 'routeprev': { const r = Sim.routeInfo(S); if (!r.ok) break; this.close(); g.view.previewRoute(r.path); break; }
      case 'depart': {
        const gt = Sim.departGate(S); if (!gt || !gt.ok) { res({ ok: false, reason: '还没准备好' }); break; }
        const P = gt.plan, douse = P.camps.filter(c => c.mode === 'douse'), keep = P.camps.filter(c => c.mode !== 'douse');
        const vs = Sim.VEH_KEYS.filter(v => P.veh[v]).map(v => `${P.veh[v]} ${v === 'sled' ? '架' : '台'}${Sim.vehName(v)}`).join('、');
        this.modal(`<h2>出发去「${esc(gt.next.n)}」</h2><p class="story">${esc(STORY.migrate)}</p>
          <p>${P.people} 人${P.specs.length ? `、${P.specs.length} 位专家` : ''}坐上 ${vs}，路上大约 ${Math.max(1, Math.round(P.secs / 60))} 分钟。</p>
          ${keep.length ? `<p>留守成补给站：${keep.map(c => esc(c.name)).join('、')}</p>` : ''}${douse.length ? `<p>熄火：${douse.map(c => `${esc(c.name)}（🔥${Sim.douseEmbers(S, c.lvl)}）`).join('、')}，到了以后人跟上来，营地变成废墟。</p>` : ''}`,
          [{ t: '出发', a: 'depart-yes', cls: 'go' }, { t: '再等等', a: 'close-modal' }]);
        break;
      }
      case 'depart-yes': { this.closeModal(); g.backup('depart'); const r = res(Sim.depart(S)); if (r && r.ok) { this.close(); g.view.followTrip = true; g.sfx('horn'); } break; }
      case 'arrive': g.startArrive(); break;
      case 'newjourney': this.modal(`<h2>开始新的北行</h2><p>从灰烬营地重新出发。这一局的营地和物资留在这里；余烬强化、专家、收集册和遗物都带着走。</p>`, [{ t: '出发', a: 'newjourney-yes', cls: 'go' }, { t: '再想想', a: 'close-modal' }]); break;
      case 'newjourney-yes': this.closeModal(); this.close(); g.migrate(); break;
      case 'ember': res(Sim.buyEmber(S, arg)); break;
      case 'eternal': res(Sim.deliverEternal(S)); break;
      case 'help': this.modal(HELP); break;
      case 'changelog': this.modal(changelogHtml()); this.$('modal').querySelector('.mbox').classList.add('clbox'); break;
      case 'export': g.exportCode(); break;
      case 'backups': this.backupsModal(); break;
      case 'bkload': {
        const r = (this.bks || []).find(x => String(x.id) === arg); if (!r) break;
        this.modal(`<h2>退回到这份备份？</h2><p><b>${this.agoText(r.at)}</b>（${(BK_WHY[r.why] || BK_WHY.auto)[1]}）<br>${this.bkLine(r)}</p><p class="hint">从那一刻接着玩，离线时间不补算。现在的进度会先另存一份备份，反悔了还能换回来。</p>`,
          [{ t: '恢复', a: 'bkload-yes', arg: arg, cls: 'go' }, { t: '返回', a: 'backups' }]);
        break;
      }
      case 'bkload-yes': this.closeModal(); g.restoreBackup(/^\d+$/.test(arg) ? +arg : arg); break;
      case 'import': this.modal(`<p>粘贴存档码，或者选一个存成文件的存档码：</p><textarea id="importBox" rows="5"></textarea>`, [{ t: '导入', a: 'import-yes', cls: 'go' }, { t: '📂 从文件读取', a: 'importfile' }, { t: '取消', a: 'close-modal' }]); break;
      case 'importfile': g.pickCodeFile(); break;
      case 'savecode': g.saveCodeFile(); break;
      case 'import-yes': g.importCode(document.getElementById('importBox').value); break;
      case 'copy': { const t = document.getElementById('exportBox'); t.select(); const manual = () => { try { document.execCommand('copy'); } catch (e) {} this.toast('已选中，如未复制请长按手动复制', 'warn'); }; try { navigator.clipboard.writeText(t.value).then(() => this.toast('已复制', 'good'), manual); } catch (e) { manual(); } break; }
      case 'snd': g.audio.unlock(); g.audio.toggle(arg); this.renderPanel(true); break;
      case 'quality': g.setQuality(arg); this.renderPanel(true); break;
      case 'theme': g.theme.set(arg); this.renderPanel(true); break;
      case 'uiscale': g.pc.setZoom(arg); this.renderPanel(true); break;
      case 'pin': g.pc.togglePin(arg); this.renderPanel(true); break;
      case 'wipe': this.newRunModal(g.slot); break;
      case 'wipe-yes': g.wipe(); break;
      case 'start': this.closeModal(); break;
      case 'placeok': g.confirmPlace(); break;
      case 'placeno': g.cancelModes(); break;
      case 'ending': this.closeModal(); break;
      case 'skyend': this.closeModal(); g.skyBack(); break;
      case 'ach': this.achShown = null; this.open('ach'); break;
      case 'dress': this.open('dress'); break;
      case 'settitle': Sim.setTitle(S, arg); break;
      case 'setflame': { const [cid, id] = arg.split(':'); Sim.setFlame(S, cid === 'all' ? null : +cid, id); break; }
      case 'setflag': Sim.setFlag(S, arg); g.view.syncBuildings(true); break;
      case 'album': this.open('album'); break;
      case 'albumview': { const r = (this.album || []).find(x => String(x.id) === arg); if (r) { this.albumView ||= new AlbumView(id => { const u = this.albumUrls && this.albumUrls.get(id); if (u) { URL.revokeObjectURL(u); this.albumUrls.delete(id); } this.albumDirty(); }); this.albumView.show(r, this.albumUrl(r)); } break; }
      case 'setframe': Sim.setFrame(S, arg); if (g.photo) g.photo.fr = arg; break;
      case 'skyreplay': this.close(); g.skyCine(); break;
    }
    this.renderPanel(true);
    this.hud();
  }
  onChange(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const S = this.S, act = el.dataset.act, arg = el.dataset.arg;
    if (act === 'fuel') { Sim.getCamp(S, +arg).fuelPref = el.value; }
    if (act === 'mgoodadd' && el.value) { const k = el.value, goods = { ...Sim.tripPlan(S).goods }; goods[k] = Math.min(Math.floor(Sim.mainCamp(S).stock[k] || 0), (goods[k] || 0) + 100); Sim.setPlan(S, { goods }); }
    if (act === 'spec') { if (el.value) Sim.assignSpec(S, el.value, +arg); }
    this.renderPanel(true);
  }
}

// 新手引导：给出下一步建议
// 烽火塔这一项走到哪了：立地基 → 塔身百分比（缺什么）→ 点火
function towerGoal(S, n) {
  const b = S.buildings.find(x => x.tn === n && BLD[x.type].tower), nm = Sim.towerName(n);
  if (!b) return `立${nm}的地基：建造 › 核心`;
  const sp = Sim.towerSpec(S, n), st = (Sim.rt(S).b[b.id] || {}).status || '';
  if (b.tw.p < sp.dur) return `${nm}塔身 ${Math.floor(b.tw.p / sp.dur * 100)}%${st.startsWith('缺') ? `：${st}` : ''}`;
  return `${nm}的塔身砌好了：交燃料点火`;
}
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
  if (J.trip && J.trip.road) return `车队停下了：${Sim.roadView(S).title}`;
  if (J.trip) return J.trip.phase === 'arrive' ? `车队到了「${Sim.stopOf(S, J.trip.to).n}」：放下新熔炉` : `车队往「${Sim.stopOf(S, J.trip.to).n}」去 ${Math.round(J.trip.d / J.trip.len * 100)}%`;
  // 这一章的产能目标
  const g = Sim.rateGoals(S).find(x => !x.eternal) || Sim.rateGoals(S)[0];
  if (g) {
    const r = Sim.prodRate(S, g.r), h = Sim.holdOf(S, g.id), fr = v => v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    if (r >= g.n - 1e-9) return `${RES[g.r].n} ${fr(r)}/${g.n} 每分钟 · 稳住 ${Math.floor(h.p / 60)}:${String(Math.floor(h.p % 60)).padStart(2, '0')}/3:00`;
    return `${RES[g.r].n}产量 ${fr(r)}/${g.n} 每分钟${g.eternal ? `（第 ${S.eternal.stage + 1}/3 层）` : ''}`;
  }
  // 这一章别的任务
  const chs = Sim.chapters(S), cur = chs.find(c => c.i === J.stage);
  if (cur) { const j = cur.tasks.findIndex(x => !x.ok), t = cur.tasks[j], q = j >= 0 && Sim.chapterDef(S, cur.i).tasks[j]; if (q && q.k === 'tower') return towerGoal(S, q.tn); if (t) return t.t + (t.n > 1 && !t.low ? `（${typeof t.cur === 'number' ? Math.min(t.cur, t.n) : t.cur}/${t.n}）` : ''); }
  // 北迁门槛
  const gt = Sim.departGate(S);
  if (gt) { const m = gt.items.find(i => !i.ok); return m ? `北迁准备 ${gt.n}/4：${m.t}` : `北迁准备好了：往「${gt.next.n}」出发`; }
  return '';
}

export const HELP = `<h3>怎么玩</h3>
<p><b>目标：</b>带着营地一站一站往北走，重新点燃传说中的永恒之炉；过了永恒之炉还有六站，翻过世界之脊以后是没有尽头的北境。</p>
<p><b>熔炉</b>是营地的心脏。只有熔炉周围橙色圈里（供热区）能盖房子。升级熔炉让圈变大、营地更暖。熔炉要一直烧燃料：木材，之后是煤、焦煤块、晶体电池。</p>
<p><b>采集与加工：</b>采集建筑要建在资源点旁边（白圈范围内），矿藏会被采光；树林和猎场砍光了会长回来，伐木场、猎人小屋附近的长得快好几倍；附近没树了就建「育林场」自己种。加工建筑把原料做成更高级的材料；锯木厂、炼钢厂默认会给建造留一些木材和铁锭（「生产 → 物资」里可以关）。相邻的上下游建筑会互相加成。</p>
<p><b>小人：</b>每座建筑要派工人；仓库里的人是搬运工，他们在仓库/熔炉和建筑之间来回搬货。离仓库越远，越费搬运工——把仓库建在生产区中间。</p>
<p><b>升级门槛：</b>建筑每升 5 级，就要用下一层的材料。下一层的原料只在更北的地方有，所以要不断往北走。</p>
<p><b>往北：</b>建侦察营，派侦察队揭开迷雾，找资源、幸存者、专家和地标，也把去下一站的路探出来。主营地和下一站之间可以建「前哨熔炉」开新营地，点火就有一条雪橇道连到最近的营地。</p>
<p><b>物流：</b>所有营地连成一张路网。每 10 秒每座营地算一次缺什么、多什么，多的装上雪橇顺着路送到缺的营地，路上能经过别的营地转运。先送保命的燃料口粮，再送排队的建筑要的料、产线缺的料、主营地升熔炉和北迁要的，最后给每座营地补到木材木板石料铁锭各 200。「生产 → 物流」里看每座营地运来、送出、还缺什么，升级道路（雪橇道、北行主干道、铁路），也能手动送一批、设长期供货、把某样货标成不外送。</p>
<p><b>替代配方和营地特产：</b>有些加工厂能换一套配方（比如焦煤坊不用煤、改用木材），在建筑面板的「配方」里换，换一次停工 20 秒；研究「替代配方·一」「替代配方·二」后才能换。某样原料断了，老向导会提醒你换。每座营地建起来时就定了一样特产：北境的站看地貌，别处看暖圈里哪种矿多。特产的那几种建筑在这座营地里产量 +50%（研究「特产精工」后 +75%），营地面板里能看到。</p>
<p><b>人心：</b>每个营地有「希望」和「不满」。吃不饱、太冷、有人死去会让人失望；住得好、有进展会让人振奋。希望高干活更快、来投奔的人更多；不满太高会有人离开。在「营地 → 律令」里签署营地律令，每条都有好处也有代价。</p>
<p><b>研究：</b>建工程站，派工程师攒研究点数。五条分支共 45 项：生产、生存、物流一开始就有，自动化要侦察到遗迹金属纬度，北境要走到北境才开放；带 ★ 的会解锁新东西（替代配方、城镇、奇观、熔炉号令等）。全部研究完以后开放无尽研究，每一级所有生产 +2%。探险带回的图纸可以直接抵研究点数。</p>
<p><b>探索：</b>迷雾里藏着废弃仓库、冻住的列车、观测站这样的地点。侦察队揭开后，从侦察营派 4 人的探险队去；带足补给更安全，到了还能做更多选择。</p>
<p><b>章节：</b>每到一个新地标就开始新的一章，有自己的故事和三个任务，做完可以领奖励。点顶上的目标栏查看。</p>
<p><b>产能主线：</b>每章的头一个任务是某样材料每分钟产多少。点目标栏的「规划」看这条线：每一环要几座建筑、几个人，现在卡在哪一环。产量稳住一阵，产线就升星，升星加产量；累计产量到了里程碑也有奖励。自己还能立几条支线。一条线搭好了，可以「复制这条线」整组搬到别处。老向导（底下那一行小条，戴皮帽的头像）会一直指着下一步，点他看全文。</p>
<p><b>营地基建：</b>在「营地 → 概况」修路（搬运更快）和蒸汽管道（供热圈更大、更暖）。</p>
<p><b>危险：</b>暴风雪提前一小时就有预报（点右上角的提醒铃看撑不撑得住），记得囤燃料和熟食，熔炉还能超载顶一阵；雪狼和掠夺者会来袭，多建箭塔；侦察兵会提前 15 分钟发现它们，可以点火墙、召集民兵。人可能会冻死饿死，但营地永远不会全灭。</p>
<p><b>生产链：</b>按 C 看整条生产链哪里卡住，按 G 看数据曲线。加工建筑挨着上下游时可以接传送带（之后升级成蒸汽轨道），直接供料、少用搬运工。矿快挖空时可以打深井，侦察营也能勘探新矿脉。</p>
<p><b>营地生活：</b>人多了以后可以在熔炉面板办篝火庆典；路灯、旗杆、雕像、花窖这些装饰能加希望；有人生病就建医务所。营地里的人偶尔会托你办点事（委托），做完有谢礼。熔炉到 5 级可以给营地选专精。犬舍养的雪橇犬让侦察队跑得更快，连着的路也运得更多。</p>
<p><b>天气与掠夺者：</b>除了暴风雪，还有冰风暴（暖炉和管道会冻住）、极寒夜（多烧燃料）、冰湖开裂（绕路），都会提前预报，在右上角的提醒铃里花点材料准备。北边有掠夺者营地，侦察到以后它们会来索贡：交贡、做买卖，或者靠箭塔顶回去，打退两次他们就走了。</p>
<p><b>收集册：</b>建过的建筑、见过的物资和风物、达成的成就都记在收集册里<span class="kh">（K）</span>。</p>
<p><b>成就与装扮：</b>「菜单 → 收藏」里的「成就」按北境、烽火塔、产线、生存、营地分类，带进度条，还有几个隐藏的。「旅程」类的老成就给余烬；新成就给称号、炉火颜色、营旗图案、相框和八种北境装饰，在「装扮」里换上，北迁以后也留着。相册会在抵达新一站、点亮烽火塔、产线第一次三星和点燃天火时自动拍一张。</p>
<p><b>北迁：</b>出发前要做到四件事：路探到了、这一章做完、主营地熔炉够级、车队备好了（在雪橇棚造雪橇和蒸汽拖车，之后还有破冰车）。在「北行 → 北迁」挑带多少人和货，后面的营地选留守（变成补给站，自己运转，多出来的货由物流网运走；车队走过的路变成北行主干道）还是熄火（换余烬，人跟上来）。路上会碰到事，车上带的货能多给一条路。到了以后挑一块平地放下新熔炉，那里就是新的主营地。余烬在「北行 → 专家与余烬」里换永久强化。</p>
<p><b>北境：</b>翻过世界之脊还能一直往北走，地图往北一段段长出来。北境每一站有一种地貌，只在车队停着的那一站生效：平坦雪原、地热谷（暖、省燃料，能建地热井）、富矿带（矿多但冷）、永夜（极光多、希望好涨，干活慢一点）、狼群领地（袭营多、战利品也多）、冰湖群（能建冰钓屋）、古城遗址（拆遗迹换古代构件）、风暴走廊（暴风雪多，预报更早）、陨石雨（陨坑出星核，偶尔砸停建筑）、冻土无林（没有活树，只有枯木堆）。每站两个产能目标和一项地貌任务，目标一站比一站高；熔炉门槛停在世界之脊那一级。第一次走到某个站号给一点余烬，菜单和地图上记着最远纪录。</p>
<p><b>烽火塔：</b>北境前十站各有一座塔要点：先打地基（要在主营地暖圈里），再给塔身一起喂几种高级材料，缺一种就停，但进度不会倒退；喂满以后用晶体电池（后面是星核）点火。点亮的塔立起光柱，那座营地暖 +1、希望 +5。第十站是 4×4 的天火塔，点着它就是最终结局，之后照样可以往北走。</p>
<p><b>矿点与挪位置：</b>矿点快挖空时会提前提醒，侦察营的勘探在那时很便宜。摆建筑时如果会挡住旁边矿点，预览框变黄；地上的金色星星是推荐位置（菜单里能关）。建筑面板里点「↔ 挪位置」能免费搬家，等级和工人都留着，搬完停工一小会儿；烽火塔开始喂料以后就不能挪了。</p>
<p><b>倍速与离线：</b>右边的速度键点一下换 1×、2×、4×，按住暂停。关掉页面时营地也会慢慢攒资源，但比在线时慢，回来会看到一份报告。</p>
<p><b>存档与备份：</b>进度自动存在这台设备上，三个存档位各是一局。玩着每 10 分钟自动备份一份，北迁出发、导入存档码、重开、删除之前也会先备份；「菜单 → 存档 → 自动备份」里点一下就能退回去。换设备用「导出存档码」。</p>
<p><b>操作：</b>拖动地图平移，双指缩放/旋转（电脑：滚轮缩放，右键或 Q/E 旋转）。建造时拖动预览，到合适位置再点 ✓；电脑上按住左键拖一下能一次摆一排，手机上先点「一排」。同类建筑的面板里能一键全升级、全派满。H 是拍照模式，M 是北行地图，+ / − 拉近拉远。菜单里有三个存档位，难度随时可以改。</p>`;
