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
const BUFF_TXT = b => ({ prod: `생산량 ${b.v > 0 ? '+' : ''}${Math.round(b.v * 100)}%`, fuel: `연료는 ${b.v > 0 ? '+' : ''}${Math.round(b.v * 100)}%를 소비합니다.`, heat: `기분 +${b.v}°`, shield: `눈보라 냉각 −${Math.round(b.v * 100)}%`, def: `방어 +${Math.round(b.v * 100)}%` })[b.k] || '';
const TUT = [
  { b: 'lumber', why: '벌목장은 숲 바로 옆에 지어야 합니다. 미리보기 상자에 캘 수 있는 자원 포인트 수가 표시됩니다. 목재는 연료이자 건축 자재입니다.' },
  { b: 'tent', why: '천막은 침대와 보온을 제공합니다. 빈 침대가 있어야 사람들이 찾아옵니다.' },
  { b: 'hunter', why: '사냥꾼 오두막은 순록이 있는 사냥터 옆에 지어 생고기를 가져오게 하세요.' },
  { b: 'kitchen', why: '부엌은 생고기를 익힌 음식으로 만들고, 모두가 이걸로 살아갑니다.' },
  { k: 'stock', why: '하단의 "생산"에는 자재 총괄이 있습니다. 자재별 수량, 입출고량, 어느 단계에서 막혔는지까지 적혀 있습니다.' },
  { k: 'furnace', why: '건물을 누르면 상태, 일손 배치, 업그레이드를 볼 수 있습니다. 용광로는 야영지의 심장으로, 업그레이드하면 난방 범위가 커집니다.' },
  { k: 'goal', why: '상단에는 이 장의 목표가 있습니다. 과제 3개를 완료하면 보상을 받을 수 있습니다. "목판 생산량 6/분" 같은 과제 옆의 "계획"을 누르면 부족한 건물 수와 인원을 계산해 줍니다. 아래쪽 가는 줄은 늙은 길잡이로, 다음에 할 일을 한 문장씩 알려 줍니다. 얼굴을 누르면 전체 내용을 볼 수 있습니다.' },
];
// 建筑状态 → 头顶小图标；严重的状态用红色
const RES_BY_NAME = Object.fromEntries(Object.entries(RES).map(([k, r]) => [r.n, k]));
const STATUS_BAD = st => st.startsWith('부족') || st.includes('고갈') || st === '일손 미배치' || st === '일하는 사람 없음';
const STATUS_ICON = st => st.startsWith('부족') ? (RICON[RES_BY_NAME[st.slice(3).trim()]] || '!') : st.includes('고갈') ? '⛏' : st === '일손 미배치' || st === '일하는 사람 없음' || st === '일손 부족' ? '👷' : st === '운반꾼 부족' ? '🛷' : st.startsWith('너무 추') ? '❄' : st.startsWith('대기') ? '🌱' : st === Sim.KEEP_WHY ? '🔒' : st === Sim.FUEL_KEEP_WHY ? '🔥' : st === Sim.DEEP_WHY ? '⛏' : '!';

export function fmt(n) {
  n = +n || 0;
  const a = Math.abs(n);
  // 大数字按中文习惯：1.2万、35万、1.2亿
  if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '') + '1억';
  if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + '만';
  if (a >= 100) return Math.round(n).toString();
  if (a >= 10) return n.toFixed(0);
  return (Math.round(n * 10) / 10).toString();
}
// 游戏分钟：90 → 1 小时 30 分
export const fmtMin = m => { m = Math.max(1, Math.round(m)); return m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}` : `${m}분`; };
// 北境的位置和最远纪录：「北境第 N 站 · 最远 M 站」（还没进北境时只说最远）
export function northRec(S) { const N = Sim.northN(Sim.journeyOf(S).stage), M = Math.max(N, S.meta.northMax || 0); return N ? `북방번째 역 ${N} · 가장 먼 역 ${M}` : M ? `북방이 가장 먼 정류장 ${M}에 도달했습니다.` : ''; }
export function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  if (s >= 86400) return `${Math.floor(s / 86400)}일${Math.floor(s % 86400 / 3600)}시간`;
  if (s >= 3600) return `${Math.floor(s / 3600)}시간${Math.floor(s % 3600 / 60)}분`;
  if (s >= 60) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `${s}초`;
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
  camp: { n: '야영지', tabs: [['camp', '개요'], ['folk', '일손'], ['mood', '민심'], ['law', '법률 및 명령']] },
  prod: { n: '생산', tabs: [['stock', '용품'], ['plines', '생산 라인'], ['lines', '물류'], ['guild', '상회']] },
  build: { n: '건설', tabs: [['build', '건축학'], ['bqueue', '대기줄'], ['plan', '계획'], ['wonder', '불가사의']] },
  research: { n: '연구', tabs: [['research', '연구']] },
  north: { n: '북쪽 방향', def: 'migrate', tabs: [['scout', '정찰을 사용한 지도'], ['migrate', '북상'], ['towers', '봉화탑'], ['specs', '전문가 및 잔불']] },
  menu: { n: '메뉴', tabs: [['menu', '설정'], ['msave', '저장'], ['mcoll', '모으다'], ['mhelp', '돕다']] },
  bell: { n: '상기시키다', tabs: [['alerts', '상기시키다'], ['log', '정보']] },
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
const VT_N = { tmp: '온도', ppl: '인구', fuel: '연료', food: '요리' };

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
      sb.addEventListener('pointerdown', () => { this.speedLong = false; sb.classList.add('hold'); t = setTimeout(() => { t = null; sb.classList.remove('hold'); this.speedLong = true; this.g.togglePause(true); this.toast('일시중지되었습니다. 계속하려면 속도 키나 화면 중앙의 막대를 클릭하세요.', 'info'); }, 550); });
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
    const lab = n ? `알림, ${n}개 항목` : un ? `알림, ${un}개의 새 메시지` : '상기시키다'; if (b.getAttribute('aria-label') !== lab) b.setAttribute('aria-label', lab);
  }
  // 顶栏下沿：写进 --topB，提示、侧边键、暂停条和左边那列都按它摆
  topSync() { const r = this.$('top').getBoundingClientRect(); const v = Math.round(r.bottom) + 'px'; if (this.topB !== v) { this.topB = v; document.documentElement.style.setProperty('--topB', v); } }
  modal(html, buttons = [{ t: '좋은', a: 'close-modal' }]) {
    const m = this.$('modal'); this.bkOpen = false;
    m.innerHTML = iconize(`<div class="mbox">${html}<div class="mbtns">${buttons.map(b => `<button class="btn ${b.cls || ''}" data-act="${b.a}" ${b.arg != null ? `data-arg="${b.arg}"` : ''}>${b.t}</button>`).join('')}</div></div>`);
    m.classList.add('show');
  }
  closeModal() { this.$('modal').classList.remove('show'); this.bkOpen = false; }
  // 终章：天火塔点亮以后的故事和「这一路」（点亮那一刻记下的数）
  skyEndModal() {
    const S = this.S, E = S.tower && S.tower.end; if (!E) return false;
    const s = E.sum, rows = [
      ['🧭', '통과된 역', `${s.stops} 역(${s.north} 역으로 북쪽으로 향하는 세계의 척추)`], ['🔥', '조명이 켜진 용광로', `${s.furnaces}석`], ['🗼', '조명 타워', `${s.towers}석`],
      ['👥', '지금 사람들', `${fmt(s.people)}명`], ['🤝', '여기저기 찾아오는 사람들', `${fmt(s.arrivals)}명`], ['🕯', '닿지 못한 사람들', `${fmt(s.deaths)}명`],
      ['🐺', '습격 방어', `${s.raidsWon}회`], ['🌨', '살아남은 눈보라', `${s.blizzards} 필드`], ['⏳', '이 여행은 사라졌습니다', `${fmtTime(s.t)}(${s.runs} 북쪽 방향)`]];
    this.modal(`<div class="evtag">마지막 챕터 · 스카이 파이어</div><h2>🔥 스카이 파이어가 켜졌습니다</h2><p class="story">${esc(STORY.skyEnd)}</p>
      <div class="sec">이쪽으로</div><div class="skysum">${rows.map(([i, a, b]) => `<div><span>${i} ${a}</span><b>${b}</b></div>`).join('')}</div>
      <div class="crw">🎁 잠금 해제: 칭호 "천화에 불을 붙인 사람", 금색 Fire, 천화 기념비 (메뉴 → 컬렉션 → 드레스업)</div>
      <p class="hint">북쪽으로 가는 길은 아직 끝나지 않았습니다. 다음 역에는 더 이상 타워가 없으며 각 역마다 목표는 여전히 더 높습니다. 가장 먼 기록이 올라갑니다. </p>`, [{ t: '북쪽으로 계속', a: 'skyend', cls: 'go' }]);
    this.$('modal').querySelector('.mbox').classList.add('skyend');
    return true;
  }
  // ---------- 存档位与难度 ----------
  slotLine(s) {
    if (s.empty) return '<span class="sl0">공석</span>';
    if (s.broken) return '<span class="sl0">저장이 손상되었습니다</span>';
    const ago = s.savedAt ? (Date.now() - s.savedAt) / 1000 : 0;
    return `<b>${esc(s.name)}</b><small>👥 ${s.people}명 · ${Math.floor((s.t || 0) / DAY_LEN) + 1}일째 · ${s.runs}번째 북행 · ${s.diff.ic}${s.diff.n}${s.cur ? '' : ago > 60 ? ` · ${fmtTime(ago)} 전` : ' · 방금'}</small>`;
  }
  slotsModal() {
    const g = this.g; let rows = '';
    for (let n = 1; n <= SLOTS; n++) {
      const s = g.slotInfo(n);
      const btns = s.cur ? `<span class="slcur">재생 중</span><button class="small ghost" data-act="slotdel" data-arg="${n}">삭제</button>`
        : s.empty ? `<button class="small go" data-act="newrun" data-arg="${n}">새 라운드 시작</button>`
        : `<button class="small go" data-act="slotuse" data-arg="${n}">읽기</button><button class="small ghost" data-act="slotdel" data-arg="${n}">삭제</button>`;
      rows += `<div class="slotrow ${s.cur ? 'cur' : ''}"><span class="sln">${n}</span><span class="sli">${this.slotLine(s)}</span><span class="slb">${btns}</span></div>`;
    }
    this.modal(`<h3>저장 슬롯</h3><div class="slots">${rows}</div><p class="hint">각 저장 슬롯은 독립적인 라운드입니다. 잔불, 전문가 및 컬렉션 북은 별도로 기록됩니다. 저장 위치를 변경하면 현재 게임이 먼저 저장됩니다. </p>`, [{ t: '폐쇄', a: 'close-modal' }]);
  }
  newRunModal(slot, diff) {
    const g = this.g;
    if (slot == null) { slot = g.slot; for (let n = 1; n <= SLOTS; n++) if (g.slotInfo(n).empty) { slot = n; break; } }
    this.nr = { slot, diff: diff || (this.nr && this.nr.diff) || 'std' };
    const infos = Array.from({ length: SLOTS }, (_, i) => g.slotInfo(i + 1)), s = infos[slot - 1];
    const seg = `<div class="seg nrslots">${infos.map(x => `<button class="btn ${x.n === slot ? 'on' : ''}" data-act="nrslot" data-arg="${x.n}">세이브 ${x.n}<small>${x.empty ? '빈자리' : esc(x.name)}</small></button>`).join('')}</div>`;
    const warn = s.empty ? '' : `<p class="nrwarn">저장 ${slot}(👥 ${s.people}명): 잔불, 전문가의 "${esc(s.name)}"을 <b>덮어쓰겠습니다</b>. 컬렉션 도서가 삭제됩니다. 덮어쓰기 전에 백업이 자동으로 저장됩니다. 실수하신 경우에는 "메뉴 → 저장 → 자동백업"으로 이동하여 복구하실 수 있습니다. </p>`;
    const cards = DIFF_KEYS.map(k => { const D = DIFF[k]; return `<button class="diffc ${k === this.nr.diff ? 'on' : ''}" data-act="nrdiff" data-arg="${k}"><b>${D.ic} ${D.n}</b><small>${D.d}</small></button>`; }).join('');
    this.modal(`<h3>새로운 북쪽 방향</h3><div class="mlab">존재하는 저장 위치</div>${seg}${warn}<div class="mlab">난이도<small>나중에 메뉴에서 변경할 수도 있음</small></div><div class="diffs">${cards}</div>`,
      [{ t: s.empty ? '북쪽으로 향하기 시작' : '덮고 시작하세요', a: 'newrun-go', cls: s.empty ? 'go' : 'bad' }, { t: '괜찮아요', a: 'close-modal' }]);
  }
  diffModal() {
    const S = this.S, cur = S.meta.diff || 'std';
    const cards = DIFF_KEYS.map(k => { const D = DIFF[k]; return `<button class="diffc ${k === cur ? 'on' : ''}" data-act="diffset" data-arg="${k}"><b>${D.ic} ${D.n}${k === cur ? '· 지금' : ''}</b><small>${D.d}</small></button>`; }).join('');
    this.modal(`<h3>난이도</h3><div class="diffs">${cards}</div><p class="hint">변경 사항은 즉시 적용됩니다. 북상이 가져온 잔불은 당시 북상의 난이도를 기준으로 계산됩니다. </p>`, [{ t: '폐쇄', a: 'close-modal' }]);
  }
  // 随机事件：一段描述 + 几个选项，每个选项写清后果
  eventModal() {
    const v = Sim.eventView(this.S); if (!v) return false;
    const m = this.$('modal');
    m.innerHTML = iconize(`<div class="mbox ev"><div class="evtag">${esc(v.camp)}· 이벤트</div><h2>${esc(v.title)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="ev" data-arg="${i}"` : 'disabled'}><b>${esc(o.t)}</b><small>${esc(o.d)}${o.ok ? '' : '· 공급 부족'}</small></button>`).join('')}</div></div>`);
    m.classList.add('show');
    return true;
  }

  // 路上的事：跟随机事件一样的弹窗；第一项是默认，一分钟没人选就按它办
  roadModal() {
    const v = Sim.roadView(this.S); if (!v) return false;
    const T = Sim.journeyOf(this.S).trip, m = this.$('modal'), hs = (this.S.meta.hints ||= {}), first = !hs.road || hs.road === T.t0;
    hs.road = hs.road || T.t0; // 同一趟里重新打开也还显示；下一趟就不说了
    m.innerHTML = iconize(`<div class="mbox ev"><div class="evtag">행렬 · '로 이동${esc(Sim.stopOf(this.S, T.to).n)}"길에서</div><h2>${esc(v.title)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="road" data-arg="${i}"` : 'disabled'}><b>${esc(o.t)}${o.def ? '<em class="evdef">기본값</em>' : ''}</b><small>${esc(o.d)}${o.ok ? '' : '· 차에 짐을 충분히 가져오지 않았습니다'}</small></button>`).join('')}</div><p class="hint">행렬는 멈춰서 당신이 결정하기를 기다렸습니다.${v.left}몇 초 내에 선택하지 않으면 "기본값"을 클릭하세요. </p>${first ? '<p class="hint wnfirst">✨ 도로에서 처음으로 무언가를 만났을 때: 차에 실린 물건이 나에게 추가 도로를 제공할 수 있습니다. 다리를 건설하는 데 목판, 캠프를 설치하는 데 연료, 늑대에게 던지는 데 생고기가 필요합니다. 회색으로 표시된 옵션은 차에 짐을 충분히 가져오지 않았기 때문입니다. </p>' : ''}</div>`);
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
      this.upFx(b, was == null ? '완공' : `${b.lvl} 레벨에 도달하세요`, b.type === 'furnace' && was != null);
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
        const rate = d.research ? (br.status === '연구 중' ? { rp: br.rp || 0 } : {}) : (br.rate || {});
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
    const card = hasSave ? `<div class="tsave"><b>🔥 ${esc(c.name)}</b><span>${ch ? esc(ch.ch.n) : ''}</span><small>저장${this.g.slot} · ${D.ic}${D.n} · 👥 ${ppl}명 · ${S.meta.runs || 1}번째 북행${ago > 60 ? ` · 마지막 접속 ${fmtTime(ago)} 전` : ''}</small></div>` : '';
    el.innerHTML = iconize(`<div class="tshade"></div><div class="tbox">
      <div class="tkick">HAN · JIN · BEI · XING</div>
      <h1 class="tname">${'차가운 잔불의 북행'.split('').map((ch, i) => `<span style="animation-delay:${0.15 + i * 0.12}s">${ch}</span>`).join('')}</h1>
      <p class="ttag">겨울 동안 세상이 얼었습니다. <br>한 번에 하나씩 북쪽으로 가서 영원의 용광로를 다시 켜세요. </p>${card}
      <div class="tbtns">
        <button class="tbtn go" data-act="title-go">${hasSave ? '계속 북쪽으로 가세요' : '북쪽으로 향하기 시작'}</button>
        <button class="tbtn" data-act="help">플레이 방법</button>${hasSave ? '<button class="tbtn ghost" data-act="title-new">새로운 북행</button><button class="tbtn ghost" data-act="slots">저장 슬롯</button>' : ''}
      </div></div>
      <div class="tfoot">${VERSION_NAME}· 로우 폴리곤 겨울 생존 작동</div>`);
    el.classList.add('show'); document.body.classList.add('titled');
  }
  hideTitle() { const el = this.$('title'); el.classList.add('out'); document.body.classList.remove('titled'); setTimeout(() => { el.classList.remove('show', 'out'); el.innerHTML = ''; }, 700); }

  // 探险队到了地点：选一种做法
  siteModal() {
    const S = this.S, s = Sim.expPending(S); if (!s) return false;
    const v = Sim.siteView(S, s); if (!v) return false;
    if (this.panel && this.panel.kind === 'site') this.close();
    const m = this.$('modal'), K = SITES[v.p.kind];
    m.innerHTML = iconize(`<div class="mbox ev"><div class="evtag">🧭 탐험대 ·${s.n}사람들 ·${s.sup === 'full' ? '충분한 공급품' : '가볍게 짐을 싸세요'}</div><h2>${K.ic} ${esc(v.title)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="siteopt" data-arg="${s.id}:${i}"` : 'disabled'}><b>${o.need ? '⛺ ' : ''}${esc(o.t)}</b><small>${esc(o.d)}${o.ok ? '' : '· 이를 위해서는 충분한 물품을 가져와야 합니다.'}</small></button>`).join('')}</div></div>`);
    m.classList.add('show');
    return true;
  }

  // 1.1 站点奇遇：一段一段地选；选完显示结果（有下文就说多久以后）
  qyModal(res) {
    const S = this.S, m = this.$('modal');
    if (res) {
      m.innerHTML = iconize(`<div class="mbox ev qy"><div class="evtag">북방 · 기연</div><h2>${this.qyIco(res.id, res.ic)} ${esc(res.n)}</h2><p class="story">${esc(res.msg)}</p>${res.next ? `<p class="hint">${res.wait > 5 ? `통과하다${fmtTime(res.wait)}아래에서 더 자세히${res.away ? `, 발송됨${res.away}그때 다시 올게요` : ''}.` : '곧 더 많은 내용이 나올 예정입니다.'}</p>` : '<p class="hint">이 기연가 완성되어 컬렉션 북에 기록되었습니다. </p>'}<div class="mbtns"><button class="btn go" data-act="${res.next && res.wait <= 5 ? 'qyopen' : 'close-modal'}">${res.next && res.wait <= 5 ? '계속 읽어보세요' : '알고 있었다'}</button></div></div>`);
      m.classList.add('show'); return true;
    }
    const v = Sim.qyView(S); if (!v) return false;
    m.innerHTML = iconize(`<div class="mbox ev qy"><div class="evtag">북방 · 기연 ·${esc(v.camp)}${v.st ? '· 아래에' : ''}</div><h2>${this.qyIco(v.id, v.ic)} ${esc(v.n)}</h2><p class="story">${esc(v.text)}</p><div class="evopts">${v.opts.map((o, i) => `<button class="evopt ${o.ok ? '' : 'no'}" ${o.ok ? `data-act="qyopt" data-arg="${i}"` : 'disabled'}><b>${o.g ? '🧭 ' : ''}${esc(o.t)}</b><small>${esc(o.d)}${o.ok ? '' : ` · ${esc(o.why)}`}</small></button>`).join('')}</div><div class="mbtns"><button class="btn ghost" data-act="close-modal">나중에 뵙겠습니다</button></div></div>`);
    m.classList.add('show');
    return true;
  }

  // 点亮远方地标：带回一件遗物
  relicModal(i) {
    const f = FAR_MARKS[i]; if (!f) return false;
    const m = this.$('modal'); if (m.classList.contains('show')) return false;
    const n = Object.keys(this.S.meta.relics || {}).length;
    m.innerHTML = iconize(`<div class="mbox chap"><div class="evtag">✨ 영야 Icefield · No. ${n} / ${FAR_MARKS.length} 유물</div><h2>${esc(f.n)}</h2><p class="story">${esc(f.desc)}</p><div class="relic own"><div class="rli">🏺</div><div><b>유물 "${esc(f.relic.n)}"</b><span>${esc(f.relic.d)}</span><small>영구적으로 유효하며 북상 이후에도 유지됩니다.</small></div></div><div class="mbtns"><button class="btn go" data-act="close-modal">북쪽으로 계속</button></div></div>`);
    m.classList.add('show');
    return true;
  }
  // 新的一章：开场故事 + 三个任务
  chapterModal(i) {
    const ch = Sim.chapterDef(this.S, i); if (!ch) return false;
    const m = this.$('modal'), rl = ch.rule && NORTH_RULES[ch.rule];
    const brief = rl ? [`${rl.ic} ${rl.tip}`] : BRIEF[i];
    m.innerHTML = iconize(`<div class="mbox chap"><div class="evtag">📖 새로운 장 ·${esc(Sim.stopOf(this.S, i).n)}</div><h2>${esc(ch.n)}</h2><p class="story">${esc(ch.story)}</p>${brief ? `<div class="brief">${GMED}<div><b>늙은 길잡이</b>${brief.map(x => `<p>${esc(x)}</p>`).join('')}</div></div>` : ''}<div class="sec">이 장에서 할 일</div><ul class="ctl">${ch.tasks.map(t => `<li>${esc(t.t)}</li>`).join('')}</ul><div class="crw">🎁 보상：${esc(Sim.chapterReward(this.S, i).join('，'))}</div><div class="mbtns"><button class="btn go" data-act="close-modal">이동</button></div></div>`);
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
    const w = Sim.weatherAt(S, S.t), od = cr.stall ? '용광로 퍼니스 종료' : cr.od ? '용광로가 과부하되었습니다' : '';
    if (w.blizzard) A.push({ k: 'bliz', ic: '❄', lvl: 'bad', urgent: true, t: '눈보라중', cnt: fmtTime(w.until - S.t), d: `중지하려면 ${fmtTime(w.until - S.t)}가 소요됩니다. ${od ? od + '，' : ''}는 연료 및 용광로 온도를 응시합니다.`, act: 'wx', btn: '시계 준비' });
    else if (w.warn) A.push({ k: 'bliz', ic: '❄', lvl: 'warn', urgent: true, t: '눈보라가 온다', cnt: fmtTime(w.inSec), d: `${fmtTime(w.inSec)}은(는) 나중에 도착할 예정입니다. 연료를 더 준비하고 필요한 경우 용광로를 과부하하십시오. ${od ? od + '.' : ''}`, act: 'wx', btn: '시계 준비' });
    else if (w.next <= fc) A.push({ k: 'blizfc', ic: '❄', lvl: 'info', t: '기상 예측: 눈보라', cnt: fmtTime(w.next), d: `${fmtTime(w.next)} 뒤 눈보라가 옵니다. ${od ? od + '.' : ''}`, act: 'wx', btn: '보기' });
    else if (od) A.push({ k: 'od', ic: '🔥', lvl: cr.stall ? 'bad' : 'warn', t: od, d: '오븐의 온도를 확인하고 과열하지 마세요.', act: 'wx', btn: '보일러 온도 좀 보세요' });
    { const cs = Sim.coldAt(S);
      if (cs && cs.on) A.push({ k: 'cold', ic: '🌨', lvl: 'bad', urgent: true, t: '한파중', cnt: fmtTime(cs.left), d: `또한 ${fmtTime(cs.left)}. 용광로는 연료보다 ${Sim.coldFuel(S)}배 더 많이 연소되고 실외 채집은 ${Math.round(Sim.coldGather(S) * 100)}%만 남고 온도는 ${Sim.COLD.drop}°로 낮습니다. 동상에는 보상이 없습니다.`, act: 'wx', btn: '보기' });
      else if (cs && cs.fc) A.push({ k: 'cold', ic: '🌨', lvl: cs.inSec <= 300 ? 'warn' : 'info', urgent: cs.inSec <= 300, t: '한파가 온다', cnt: fmtTime(cs.inSec), d: `${fmtTime(cs.inSec)} 뒤 도착해 하루 종일 이어집니다. 물류망이 각 야영지에 연료를 보충하고 있습니다${Sim.coldBliz(S, cs) ? '. 이번에는 눈보라와 겹칩니다' : ''}.`, act: 'wx', btn: '보기' }); }
    { const z = Sim.tideAt(S);
      if (z && z.on) {
        const bv = Sim.beastView(S, z), bin = bv && !bv.done ? bv.in : null;
        A.push({ k: 'tide', ic: '🌌', lvl: 'bad', urgent: true, t: `영동조 ${z.n}번째 웨이브`, cnt: fmtTime(z.left), d: bin != null && bin <= 600 ? `서리 괴물이 ${fmtTime(Math.max(0, bin))} 뒤 "${bv.name}"(으)로 몰려옵니다. 강도 ${bv.str}, 방어 ${bv.def}${bv.def >= bv.str ? ', 막을 수 있습니다' : ', 막을 수 없습니다'}.` : `${fmtTime(z.left)} 남았습니다. 기온이 ${z.drop}° 더 낮아지고 용광로는 연료를 ${Sim.TIDE.fuel}배 태웁니다. ${bv && bv.done ? (bv.won ? '서리 괴물은 이미 쫓아냈습니다.' : '서리 괴물이 침입했습니다. 얼어붙은 건물은 잠시 뒤 녹습니다.') : '마지막 밤에 서리 괴물이 옵니다.'}`, act: 'wx', btn: '보기' });
      } else if (z && z.fc) A.push({ k: 'tide', ic: '🌌', lvl: z.inSec <= 600 ? 'warn' : 'info', urgent: z.inSec <= 600, t: `영동조 ${z.n}번째 웨이브가 옵니다`, cnt: fmtTime(z.inSec), d: `${fmtTime(z.inSec)} 뒤 도착해 하루 반 동안 이어지고 기온이 ${z.drop}° 더 낮아집니다. 물류망이 각 야영지에 연료를 비축하고 있습니다.`, act: 'wx', btn: '보기' }); }
    for (const x of S.camps) { const o = x.pk && x.pk.out; if (o && !x.pk.on && S.t - o.t < 600) A.push({ k: 'peak' + x.id, ic: '🔥', lvl: 'warn', t: `"${x.name}"의 불이 꺼졌습니다`, d: `${o.why}. 삼성 수준을 만회하기 위해 금색의 불이 다시 타오를 것입니다.`, act: o.r ? 'plan' : 'towngo', arg: o.r || x.id, btn: o.r ? '생산라인을 살펴보세요' : '야영지를 보세요' }); }
    { const e = Sim.wxeAt(S, S.t);
      if (e.ev && (e.on || e.inSec <= fc)) {
        const E = Sim.WXE[e.ev.kind], prep = Sim.wxePrepped(S, c, e.ev), need = Sim.wxeMatters(S, c, e.ev) && !prep;
        if (e.on) A.push({ k: 'wxe', ic: E.ic, lvl: 'bad', urgent: true, t: E.n, cnt: fmtTime(e.left), d: `${E.d} 및 ${fmtTime(e.left)}.`, act: 'wx', btn: '보기' });
        else A.push({ k: 'wxe', ic: E.ic, lvl: need && e.inSec <= Sim.WXE_WARN ? 'warn' : 'info', urgent: need && e.inSec <= Sim.WXE_WARN, t: `${E.n}이(가) 옵니다`, cnt: fmtTime(e.inSec), d: `${E.d}${need ? `아직 「${E.prep}」 전입니다. 재료를 조금 써서 미리 준비하세요.` : prep ? '준비되었습니다.' : ''}`, act: 'wx', btn: need ? '준비하다' : '보기' });
      } }
    const nr = Sim.nextRaid(S);
    if (nr && nr.in <= Sim.RAID_PREP) {
      const rc = Sim.getCamp(S, nr.camp), p = Sim.raidPrep(S, nr), str = Sim.raidStrength(S, rc, nr), def = Sim.raidDefense(S, rc, nr);
      const tags = p ? [p.fire && '방화벽', p.mil && '시민군', p.hide && '보급품 모으기'].filter(Boolean).join(',') : '';
      A.push({ k: 'raid', ic: '🐺', lvl: def >= str ? 'warn' : 'bad', urgent: true, t: `공격${S.camps.length > 1 ? '「' + rc.name + '」' : '야영지'}`, cnt: fmtTime(nr.in), d: `${fmtTime(nr.in)}나중에 도착하세요. 방어${def}, 상대의 힘${str}${tags ? `, 이미 준비됐어${tags}` : ', 아직 전쟁 준비가 안 됐어요'}.`, act: 'raidp', btn: '전쟁을 준비하기 위해' });
    }
    for (const d of Sim.gangDemands(S)) A.push({ k: 'gang' + d.g.id, ic: '🏴', lvl: d.st.dem.fight ? 'bad' : 'warn', urgent: true, t: `「${Sim.gangName(d.g)}」${d.st.dem.fight ? '곧 전화하려고 해요.' : '소르곤으로 오세요'}`, cnt: fmtTime(d.left), d: d.st.dem.fight ? '화살탑과 민병대에 의지하여 반격하거나 가능한 한 빨리 조공을 바치십시오.' : '경의를 표하고, 사업을 하거나, 화살탑에 의지하여 되찾으세요. 때가 되면 아무도 대답하지 않을 것이다. 방어할 수 있으면 공격하겠습니다. 우리가 그것을 방어할 수 없다면, 우리는 조공을 바칠 것입니다.', act: 'gang', arg: d.g.id, btn: '답장하다' });
    if (S.car) { const left = S.car.orders.filter(o => !o.done).length; if (left) A.push({ k: 'car', ic: '🛷', lvl: 'good', t: '썰매 캐러밴 캠핑', cnt: fmtTime(S.car.until - S.t), d: `"${Sim.getCamp(S, S.car.camp)?.name || ''}" 외부에 ${left} 주문이 있습니다.`, act: 'car', btn: '순서를 보세요' }); }
    if (S.aurOpen != null) A.push({ k: 'aur', ic: '🌌', lvl: 'good', t: '오로라 밤', d: '잠시 살펴보겠습니다: all 야영지희망 +4, 잔불 +1.', act: 'aurora', btn: '함께 시청하기' });
    { const qv = Sim.qyView(S); if (qv) A.push({ k: 'qy', ic: qv.ic, lvl: 'good', t: `기연：${qv.n}`, d: qv.st ? '다음 내용을 바탕으로 귀하의 결정을 기다리고 있습니다.' : '북방의 이 정류장에서 무언가가 발생하여 귀하가 결정하기를 기다리고 있습니다.', act: 'qyopen', btn: '가 보기' }); }
    for (const c of S.camps) { const nx = Sim.townNext(c); if (nx && !Sim.townBlock(S, c)) A.push({ k: 'town' + c.id, ic: '🎆', lvl: 'good', t: `"${c.name}"을(를) ${nx.n}(으)로 업그레이드할 수 있습니다`, d: nx.d, act: 'towngo', arg: c.id, btn: '가 보기' }); }
    { const F = Sim.forkOf(S); if (F && F.pick == null) A.push({ k: 'fork', ic: '🧭', lvl: 'info', t: '다음 정류장에서 선택할 수 있는 경로가 여러 개 있습니다', d: '풍경도, 만남도, 혜택도 모두 다릅니다. 출발하기 전에 하나를 선택하고, 선택하지 않은 경우 첫 번째를 선택하세요.', act: 'tb', arg: 'migrate', btn: '경로를 선택하려면' }); }
    { const chs = Sim.chapters(S); if (chs.some(x => x.done && !x.got)) A.push({ k: 'gift', ic: '🎁', lvl: 'good', t: '장보상 컬렉션 이용 가능', d: '과제의 이번 장이 끝났습니다.', act: 'chapter', btn: '칼라 보상' }); }
    { const hp = Math.round(c.hope ?? 50), ds = Math.round(c.disc ?? 10);
      if (ds >= 70 || hp <= 25 || ds >= 55) A.push({ k: 'mood', ic: '🕯️', lvl: ds >= 70 ? 'bad' : 'warn', t: ds >= 55 ? `「${c.name}」불만 ${ds}` : `「${c.name}」희망에는 ${hp}만 남았습니다`, d: ds >= Sim.LEAVE_AT ? '누군가 밤에 떠나고 있습니다. 보기 모두를 끌어내리고 있는 것.' : '작업 속도가 느려집니다. 보기무엇이 모두를 방해하고 있나요? 규칙을 변경하세요.', act: 'tb', arg: 'mood', btn: '민심을 보세요' }); }
    if (!c.trade) {
      const ri = this.resInfo(c, cr, RES_KEYS.filter(k => RES[k].t <= S.known && (c.stock[k] || 0) >= 1));
      const sh = ri.filter(r => r.short && r.k !== 'food'), fu = ri.filter(r => r.full);
      if (sh.length || fu.length) A.push({ k: 'store', ic: '📦', lvl: 'warn', t: [sh.length && `${sh.slice(0, 2).map(r => RES[r.k].n).join('、')}${sh.length > 2 ? ' 등' : ''}이(가) 부족합니다`, fu.length && `${fu.slice(0, 2).map(r => RES[r.k].n).join('、')}${fu.length > 2 ? ' 등' : ''}이 가득 찼습니다.`].filter(Boolean).join(','), d: fu.length ? '가득 차면 관련 건물의 작동이 중지됩니다: 창고를 업그레이드하거나 "만재 자동 교환"을 켜세요.' : '어느 단계에서 막혔는지 확인해 보세요.', act: 'tb', arg: 'stock', btn: '소모품 살펴보기' });
    }
    for (const b of Sim.activeBuffs(S, c)) A.push({ k: 'buff' + b.n, ic: '✨', lvl: 'info', t: b.n || '덧셈', cnt: fmtTime(b.until - S.t), d: `${BUFF_TXT(b)}, ${fmtTime(b.until - S.t)} 남았습니다.` });
    { const rl = NORTH_RULES[Sim.campRule(S, c)]; if (rl) A.push({ k: 'rule', ic: rl.ic, lvl: 'info', t: `이 정류장의 풍경: ${rl.n}`, d: `장점은 ${rl.good}입니다. 단점은 ${rl.bad}입니다. 본영에서 이 정류장을 떠나시면 됩니다.` }); }
    { const sky = Sim.skyAt(S, S.t); if (sky.icefog > 0.3) A.push({ k: 'fog', ic: '🌫️', lvl: 'info', t: '얼음 안개', d: '멀리서 보면 뚜렷하게 보이지는 않지만 업무에는 영향을 주지 않습니다.' }); else if (sky.aurora > 0.3 && S.aurOpen == null) A.push({ k: 'aurs', ic: '🌌', lvl: 'info', t: '오로라', d: '보기에는 좋을 뿐 출력에는 영향을 주지 않습니다.' }); }
    { const dc = dayCycle(S.t), nx = { 낮: '해질녘', 해질녘: '밤', 밤: '새벽', 새벽: '낮' }[dc.name]; A.push({ k: 'tod', ic: dc.icon, lvl: 'info', t: dc.name, cnt: fmtTime(dc.left), d: `${fmtTime(dc.left)}은(는) ${nx}을(를) 따릅니다. 낮과 밤에만 조명이 바뀌며 출력에는 영향을 미치지 않습니다.` }); }
    return A;
  }
  // 顶栏四格：温度（有暴风雪时写在下面）、人口（下面是希望或不满）、燃料够烧多久、熟食
  vitals(c, cr, fuelMin, fuelEta) {
    const S = this.S, V = this.vt, set = (k, b, l, cls) => { const v = V[k]; if (v.bh !== b) { v.bh = b; v.b.innerHTML = b; } if (v.lh !== l) { v.lh = l; v.l.innerHTML = l; } const cn = `vt hpl ${k} ${cls}`; if (v.e.className !== cn) v.e.className = cn; };
    const temp = Math.round(cr.tH ?? c.temp), w = Sim.weatherAt(S, S.t);
    const cs = Sim.coldAt(S), z = Sim.tideAt(S), ton = z && z.on, tfc = z && !z.on && z.fc && z.inSec <= DAY_LEN;
    const con = cs && cs.on || ton, cfc = cs && !cs.on && cs.fc || tfc;
    const wl = w.blizzard ? `바람과 눈 ${fmtTime(w.until - S.t)}` : ton ? `영원한 겨울 ${fmtTime(z.left)}` : cs && cs.on ? `한파 ${fmtTime(cs.left)}` : w.warn ? `${fmtTime(w.inSec)}에 눈이 옵니다` : tfc ? `${fmtTime(z.inSec)}영원한 겨울` : cs && !cs.on && cs.fc ? `${fmtTime(cs.inSec)}한파` : '체감 온도';
    // 要紧的事让对应那一格亮一圈：受冻、风雪、寒潮、永冬潮、怪天气正在来是红圈，快到了是黄圈；燃料、熟食不到 10 分钟，缺床或不满太高也亮红圈
    const U = (this.alertsNow || []).filter(u => u.urgent && /^(bliz|cold|tide|wxe)$/.test(u.k)), frz = cr.tH != null && cr.tH < -8 && c.people > 3;
    const ring = (on, w) => on ? ' alarm' : w ? ' alarm-w' : '';
    set('tmp', `${temp}°`, wl, (temp < 0 || w.blizzard || con ? 'bad' : w.warn || cfc ? 'warn' : '') + (temp < 10 ? ' cold' : ' warm') + ring(frz || U.some(u => u.lvl === 'bad'), U.length));
    const hp = Math.round(c.hope ?? 50), ds = Math.round(c.disc ?? 10), mt = cr.mood || { hT: hp, dT: ds }, arr = (v, t) => t > v + 1 ? '▲' : t < v - 1 ? '▼' : '';
    const pl = c.wait > 0 && ds < 55 ? `<span class="neg">침대 ${c.wait}개 누락</span>` : ds >= 55 ? `불만 ${ds}${arr(ds, mt.dT)}` : `희망 ${hp}${arr(hp, mt.hT)}`;
    set('ppl', `${c.people}<small>/${cr.housing || 0}</small>`, pl, (ds >= 70 ? 'bad' : ds >= 55 || hp <= 25 ? 'warn' : '') + ring(c.wait > 0 || ds >= 70));
    const ok = fuelEta === Infinity && fuelMin < 6000, show = Math.min(6001, fuelEta === Infinity ? fuelMin : fuelEta);
    const fv = fuelMin > 6000 ? '연료 넉넉' : ok ? '연료 충분' : show >= 60 ? `${show < 600 && Math.floor(show % 60) ? Math.floor(show % 60) + '가리키다' : ''}(${Math.floor(show / 60)})` : `${Math.max(0, Math.floor(show))}포인트`;
    set('fuel', fv, fuelMin > 6000 || ok ? '연료' : '여전히 화상을 입을 수 있음', (fuelEta < 30 ? 'bad' : fuelEta < 90 ? 'warn' : '') + ring(fuelEta < 10));
    V.fuel.f.style.setProperty('--f', Math.min(1, fuelMin / 240).toFixed(2)); V.fuel.e.style.setProperty('--f', Math.min(1, fuelMin / 240).toFixed(2));
    V.tmp.e.style.setProperty('--h', Math.max(0.06, Math.min(1, (temp + 30) / 90)).toFixed(2));
    const fn = cr.foodNet || 0, fm = fn < 0 ? (c.stock.food || 0) / -fn : Infinity;
    set('food', fmt(this.rolled('food', c.stock.food)), `<span class="${fn < -0.05 ? 'neg' : fn > 0.05 ? 'pos' : ''}">${fn >= 0 ? '+' : ''}${fmt(fn)}/분</span>`, (fm < 10 ? 'bad' : fm < 30 ? 'warn' : '') + ring(fm < 10));
    V.tmp.e.dataset.tt = `집에 사는 느낌 온도${w.blizzard ? '· 눈보라에는 또한' + fmtTime(w.until - S.t) : w.warn ? '·눈보라' + fmtTime(w.inSec) + '나중에 도착' : ''} (용광로를 열려면 클릭하세요)`;
    V.ppl.e.dataset.tt = `인구/병상 · 희망${hp}·불만${ds}${c.wait > 0 ? ` · ${c.wait}사람들이 침대를 기다리고 있어요` : ''}${c.bots ? `·오토마톤${c.bots}탑` : ''}`;
    V.fuel.e.dataset.tt = ok ? `연료는 타는 것보다 더 빨리 들어갑니다. (재고는 ${fmtTime(fuelMin * 60)}을 태울 만큼 충분합니다.)` : `연료는 ${fmtTime(show * 60)}를 태울 수도 있습니다.`;
    V.food.e.dataset.tt = '요리 재고 · 분당 순변화';
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
    const chip = tr && tr.road ? '<i class="gplan" data-act="roadopen">결정하기</i>' : tr && tr.phase === 'go' ? `<i class="gplan" data-act="followtrip">${this.g.view.followTrip ? '더 이상 팔로우하지 마세요' : '따라가다'}</i>` : '<i class="gplan" data-act="plan">계획<kbd class="pk">J</kbd></i>';
    const tag = cur ? cur.ch.n.split(' · ')[0] : '목표';
    let title = goal || (cur ? cur.ch.n.split(' · ')[1] : ''), hold = '';
    { const i = title.indexOf('· 가만히 있어라'); if (i > 0) { hold = title.slice(i + 3).replace('/', ' / '); title = title.slice(0, i); } } // 稳住的计时放到进度管右边
    const key = [tag, title, hold, right, gift, chip, (p * 50 | 0)].join('|');
    if (ge.dataset.t === key) return;
    ge.dataset.t = key; ge.dataset.act = 'chapter';
    ge.innerHTML = iconize(title ? `<div class="gh"><span class="gtag">${esc(tag)}</span><span class="gt">${esc(title)}</span>${gift ? '<i class="gift">🎁 칼라 보상</i>' : right ? `<span class="gr">${right}</span>` : ''}${chip}</div><div class="gb2"><div class="gbar"><i style="--p:${p.toFixed(3)}"></i></div>${hold ? `<span class="ghold">${hold}</span>` : ''}</div>` : '');
    ge.classList.toggle('gift', gift);
    ge.style.visibility = title ? '' : 'hidden';
    ge.title = '이 장을 읽으려면 클릭하세요 과제';
  }
  // ---------- 老向导 ----------
  // 底下一行小条：头像 + 一句短话 + 一个按钮.他要说的排成一摞（他的下一句、攒下的新玩法），点头像或小条在上方展开一张卡，一次一条，左右翻.
  // 头像角上的数字是没看过的条数；「稍后」：同一件事 3 分钟内不再贴出来
  advBtn(a) { return { plan: '계획하다', raid: '전쟁을 준비하기 위해', scout: '정찰으로 이동', arrive: '가서 용광로를 넣어', migrate: '북상으로 이동', place: '구축하다', spot: '가 보기', roadopen: '결정을 내리다', campgo: '가 보기', netview: '물류를 보세요', netroad: '업그레이드로 이동' }[a.act] || (a.kind === 'trip' ? '따라가다' : a.kind === 'fuel' || a.kind === 'cold' ? '용광로로 이동' : a.kind === 'food' ? '소모품 살펴보기' : '가 보기'); }
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
    for (const h of this.guideHints()) L.push({ key: 'h:' + h.id, hint: h, ic: iconize(h.ic).includes('<svg') ? iconize(h.ic).replace('class="', 'class="gi ') : ico('i', 'sparkle', 'gi'), title: h.n, short: h.n, text: h.d, btn: h.a ? '가 보기' : '', at: h.at, go: h.a ? () => this.actDo(h.a.act, h.a.arg) : null });
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
    el.innerHTML = `<div class="ncard" role="dialog" aria-label="늙은 길잡이"><div class="nch"><b>늙은 길잡이</b><span class="u-tag ntg">새로운 게임플레이</span><span class="npg"><button class="btn sm" data-n="prev" aria-label="이전 기사">‹</button><i></i><button class="btn sm" data-n="next" aria-label="next">></button></span></div>
<div class="ncb"><span class="nci"></span><div><b class="nct"></b><p></p></div></div><div class="ncf"><button class="btn sm" data-n="ok"></button><button class="btn go sm" data-n="cgo"></button></div></div>
<button class="gmed" data-n="card" aria-label="늙은 길잡이, 전문을 읽으려면 클릭하세요"><span class="pf"><svg class="gpf" aria-hidden="true"><use href="#c-spec_guide"/></svg></span><b class="u-badge"></b></button>
<div class="nslip" data-n="card"><span class="u-tag ntg">새로운 게임플레이</span><span class="nt"></span><button class="btn go sm" data-n="go"></button></div>`;
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
    E.ok.textContent = it.hint ? '알고 있었다' : '나중에';
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
      if (sky.icefog > 0.2 && !was.i) Sim.logMsg(S, '🌫️ 춥고 안개가 자욱하며 작은 얼음 결정이 공중에서 빛나고 있습니다. 멀리서 보면 뚜렷하게 보이지는 않지만 업무에는 영향을 주지 않습니다.');
      was.i = sky.icefog > 0.2; }
    const cn = this.$('campName'), ct = c.name; if (cn.firstChild.textContent !== ct) cn.firstChild.textContent = ct;
    { const fb = Sim.getB(S, c.furnace), m = Sim.mainCamp(S), sub = `<span class="ck">${c.depot ? '공급 창고' : m && m.id === c.id ? '본영' : '야영지'}${fb ? ' · ' : ''}</span>${fb ? fb.lvl + '레벨' : ''}`, se = cn.querySelector('.csub'); if (se && se.dataset.h !== sub) { se.dataset.h = sub; se.innerHTML = sub; } }
    cn.classList.toggle('one', S.camps.length < 2); cn.title = S.camps.length > 1 ? '다음 항목으로 변경하려면 클릭하세요. 야영지' : '야영지 개요';
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
        this.toast(`${RICON[k]}${RES[k].n}이(가) 거의 가득 찼습니다(상한 ${fmt(cap)}). 가득 차면 관련 건물의 작동이 중지됩니다. 업그레이드창고를 사용하거나 "만재 자동 교환"을 켤 수 있습니다.`, 'warn', { act: 'tb', arg: 'stock', label: '다루다' });
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
      h += `<button class="cmdb ${st}${this.cmdSel === id ? ' sel' : ''}" data-act="cmdsel" data-arg="${id}" style="--p:${p.toFixed(3)}" title="${d.n}" aria-label="${d.n}"><span>${this.cIco('cmd_' + id, d.ic)}</span>${tx ? `<i>${tx}</i>` : '<i class="rdy">사용 가능</i>'}<em class="cl">${d.n}</em></button>`;
    }
    if (h) h = `<div class="cmdh"><b>용광로 주문</b><small>단기 발병</small></div>` + h;
    if (this.cmdSel && ids.includes(this.cmdSel)) {
      const id = this.cmdSel, d = CMDS[id], ck = Sim.cmdCheck(S, id), left = Sim.cmdLeft(S, id), other = left > 0 && !d.net && (S.cmd[id].camp !== c.id);
      const len = d.len >= 120 ? `${d.len / 60}분` : `${d.len}초`;
      h += `<div class="cmdpop"><b>${this.cIco('cmd_' + id, d.ic)} ${d.n}</b><small>${d.d}</small><small class="cm">${d.net ? '전체 물류망' : `"${esc(c.name)}"에서만`} · 지속 ${len} · 재사용 대기 ${d.cd / 60}분</small>${other ? `<small class="cm warn">현재 "${esc(Sim.getCamp(S, S.cmd[id].camp).name)}"에서 적용 중</small>` : ''}<div class="cpb"><button class="small" data-act="cmdsel" data-arg="">접기</button><button class="small ${ck.ok ? 'go' : ''}" data-act="cmdfire" data-arg="${id}" ${ck.ok ? '' : 'disabled'}>${ck.ok ? '📯 발령' : ck.on ? '적용 중' : ck.cd ? fmtTime(ck.cd) + ' 뒤 사용 가능' : esc(ck.reason)}</button></div></div>`;
    }
    if (h !== this.cmdH) { this.cmdH = h; el.innerHTML = iconize(h); }
    document.body.classList.toggle('cmd-on', ids.length > 0);
  }
  // 自动机仓：几台、哪一型、核心、拆回核心
  bayHtml(b, c) {
    const S = this.S, cap = Sim.bayCap(S, b), md = Sim.botModel(S, b), cr = Sim.rt(S).c[c.id] || {}, pow = Sim.botPow(S), n = b.bots || 0;
    let h = `<div class="row"><span>오토마톤</span><span><b>${n}</b>/${cap}타워 ·${BOT_MODELS[md].n}${b.want != null && b.want < cap ? `· 비어 있는${cap - b.want}좌석` : ''}</span></div>`;
    h += `<div class="row sub"><span>오토마톤 코어</span><span>인벤토리 ${fmt(c.stock.core || 0)} · 사용 가능한 경우 자동 설치(핵심 2개 장치 1개)</span></div>`;
    h += `<div class="sec">모델 <small>이 창고의 오토마톤 모델은 다음으로 변경되었습니다.</small></div><div class="achips">`;
    for (const m in BOT_MODELS) {
      const d = BOT_MODELS[m], okm = Sim.botModelOk(S, m);
      h += `<button class="achip ${m === md ? 'on' : ''}" data-act="baymod" data-arg="${b.id}:${m}" ${okm && m !== md ? '' : 'disabled'}><b>${d.ic} ${d.n}</b><small>${okm ? (m === 'labor' ? `나는 모든 종류의 작업을 수행할 수 있으며, 하나의 기계로 모든 작업을 처리할 수 있습니다.${pow}개인의` : m === 'haul' ? `움직이는 것만: 하나의 부하${fmt(BOT.haul * pow / BOT.pow)}운반꾼` : '채집만 사용: 생산량 +30%') : `연구」${TECHS.find(t => t.id === d.tech).n}"이후에는 선택사항`}</small></button>`;
    }
    h += `</div>`;
    const cb = Sim.campBots(S, c);
    h += `<div class="row sub"><span>전체 야영지</span><span>인건비 ${cb.l} · 처리 ${cb.h} · 채굴 ${cb.m} 대만</span></div>`;
    if (md === 'mine' && (cr.mineIdle || 0) >= 1) h += `<div class="hint warning">채굴형에는 ${Math.floor(cr.mineIdle)} 일손이 있으며 일할 곳이 없습니다. 야영지에 채집일자리가 충분하지 않습니다. 채집 건물을 더 짓거나 이 창고를 노동형으로 변경하세요. </div>`;
    if (Sim.techDone(S, 'corerec')) {
      h += `<div class="row"><span>코어 회수</span><span style="flex:none;display:flex;gap:6px">${n >= 2 ? `<button class="small" data-act="bayscrap" data-arg="${b.id}:2">유닛 2개 분해</button><button class="small" data-act="bayscrap" data-arg="${b.id}:${n}">완전한 해체</button>` : ''}${b.want != null ? `<button class="small go" data-act="bayfill" data-arg="${b.id}">리필</button>` : ''}</span></div><div class="hint">분해된 오토마톤 2개를 핵심 1개로 교체하세요. 분해 후 이 칸은 더 이상 자동으로 로드되지 않습니다. 복원하려면 "리필"을 클릭하세요. </div>`;
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
      const br = R.b[b.id]; if (!br || !br.status || br.status === '가동 중' || br.status === '탑 몸통 공사 중') continue;
      if (br.status === '창고가 가득 참') { full.set(b.camp, (full.get(b.camp) || 0) + 1); continue; }
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
          this.talk = { x, y, text: ps.quote, name: p.name, until: now + 4200, sad: ps.mood === '매우 낮음' || ps.hungry || ps.sick };
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
      html += `<div class="qtag" data-q="${q.id}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">⏳${close && miss.length ? '부족' + miss.slice(0, 2).map(k => RICON[k] + fmt(cost[k] - (c.stock[k] || 0))).join(' ') : ''}</div>`;
    }
    // 商队营地：订单数和剩余时间
    if (S.car && Math.abs(S.car.x + 1.5 - cx) <= near && Math.abs(S.car.y + 1.5 - cy) <= near) {
      const p = v.project(S.car.x + 1.5, S.car.y + 1.5, 2.3), left = S.car.orders.filter(o => !o.done).length;
      if (p.on) html += `<div class="cartag ${left ? '' : 'done'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">🛷 캐러밴${left ? `<b>${left}</b>주문` : '모든 상품이 배송되었습니다'}${close ? `<small>${fmtTime(S.car.until - S.t)}</small>` : ''}</div>`;
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
      if (p.on) html += `<div class="surtag ${u.kind}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${u.kind === 'deer' ? '🦌 길 잃은 순록' : '☄ 유성 분화구'}${close ? `<small>클릭${u.kind === 'deer' ? '돌려받기' : '발굴하다'} · ${fmtTime(u.until - S.t)}</small>` : ''}</div>`;
    }
    // 营地名（主营地名字下面挂着称号）
    const ttl = Sim.titleOf(S), mainId = Sim.journeyOf(S).main;
    for (const c of S.camps) {
      const p = v.project(c.x, c.y, 3.8 + 0.08 * Math.min(25, Sim.getB(S, c.furnace).lvl));
      const nf = full.get(c.id) || 0;
      const F = Sim.focusOf(c);
      const role = c.depot ? '<em class="ctrole dep">공급 창고</em>' : S.camps.length > 1 && Sim.isMain(S, c) ? '<em class="ctrole">본영</em>' : '';
      if (p.on) html += `<div class="camptag" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${role}${F ? `<i class="fch xs" style="background:${F.col}" title="${F.n}야영지">${F.ch}</i>` : ''}${esc(c.name)}<small> · ${Sim.getB(S, c.furnace).lvl}레벨</small>${ttl && (c.id === mainId || S.camps.length === 1) ? `<i class="cttl">${esc(ttl)}</i>` : ''}${nf ? `<b class="ctfull" data-camp="${c.id}" title="${nf}창고가 가득 참">📦 가득 참으로 인해 건물이 정지되었습니다${nf}</b>` : ''}</div>`;
    }
    // 熄火的营地留下的废墟
    for (const r of Sim.journeyOf(S).ruins || []) {
      if (Math.abs(r.y - v.cam.ty) > 30) continue;
      const p = v.project(r.x, r.y, 2.2);
      if (p.on) html += `<div class="camptag Ruin" style="transform:translate(${p.x | 0}px,${p.y | 0}px)"><em>파괴</em>${esc(r.n)}</div>`;
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
      html += `<div class="sitetag ${st}" data-site="${p0.id}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${st === 'wait' ? '❗ 탐험대는 여러분의 결정을 기다리고 있습니다' : st === 'going' ? `🧭 ${K.n}· 도로 위의 탐험대` : st === 'back' ? `🧭 ${K.n}· 돌아가는 길` : `${K.ic} ${K.n}`}</div>`;
    }
    for (const id in S.poiFound) {
      const p0 = w.pois.find(p => p.id === +id); if (!p0) continue;
      const p = v.project(p0.x + 0.5, p0.y + 0.5, 1.6);
      if (p.on) html += `<div class="poitag" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">🆘 ${p0.n}명</div>`;
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
      if (p.on) html += `<div class="poitag target" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">🚩 타겟</div>`;
    }
    if (this.g.place && this.g.place.type === 'bp') {
      const P = this.g.place, pl = P.bpPlan;
      const p = v.project(P.x + P.bp.w / 2, P.y + P.bp.h / 2, 3);
      if (pl && p.on) html += `<div class="ghosttag ${pl.ok ? 'ok' : pl.q ? 'soft' : 'bad'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${esc(RES[P.bp.r].n)}철사${P.bp.items.length}건물<br>${[pl.ok && `✓ 지금 구축${pl.ok}`, pl.q && `대기줄${pl.q}`, pl.bad && `${pl.bad}어디에도 들어갈 수 없어`].filter(Boolean).join(' · ')}</div>`;
    } else if (this.g.place && this.g.place.plan) {
      // 拖出来的一排：标签放在这一排中间，写合计
      const P = this.g.place, pl = P.plan, s = BLD[P.type].size, L = pl.plan, m = L[L.length - 1];
      const p = v.project((P.x + m.x) / 2 + s / 2, (P.y + m.y) / 2 + s / 2, 2.6);
      const t = `행${L.length}건물<br>${[pl.ok && `✓ 지금 구축${pl.ok}`, pl.q && `대기줄${pl.q}`, pl.bad && `${pl.bad}아무데도 지을 수 없어`].filter(Boolean).join(' · ')}`;
      if (p.on) html += `<div class="ghosttag ${pl.ok ? 'ok' : pl.q ? 'soft' : 'bad'}" style="transform:translate(${p.x | 0}px,${p.y | 0}px)">${t}</div>`;
    } else if (this.g.place && this.g.place.check) {
      const P = this.g.place, ck = P.check, s = BLD[P.type].size;
      const p = v.project(P.x + s / 2, P.y + s / 2, 2.6);
      let t = ck.ok ? (P.move ? '✓ 여기로 이동' : ck.clears ? `✓ 건축 가능(${ck.clears}나무/자갈 제거)` : '✓ 건설 가능') : esc(ck.reason);
      if (ck.blocks && ck.blocks.length) t += `<br><b class="gwarn">⚠ 옆에 있는 ${ck.blocks.join('、')}를 차단합니다</b>`;
      const pv = P.prev, fr = v => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10), phone = innerWidth < 700;
      if (pv && P.move) { if (Math.abs(pv.after - pv.now) > 0.05) t += `<br><span class="gline">이 ${fr(pv.now)} → <b>${fr(pv.after)}</b> ${RES[pv.r].n}/센트</span>`; }
      else if (pv) {
        const hit = pv.target != null && pv.after >= pv.target - 1e-6;
        const short = pv.ins.filter(x => x.need > x.spare + 0.05), stuck = pv.add < 0.05 && pv.full > 0;
        if (stuck) t += `<br><span class="gwarn">${short.length ? `부족${short.map(x => RES[x.k].n).join('、')}, 구축하더라도 생산적이지 않기 때문에 먼저 업스트림을 보완해야 합니다.` : pv.w && !pv.idle ? '자유로운 사람은 없고 일단 건설되면 그 일을 할 사람도 없습니다.' : `${RES[pv.r].n}당분간은 많이 나오지 않습니다`}</span>`;
        else t += `<br><span class="gline ${hit ? 'hit' : ''}">${pv.named ? `${RES[pv.r].n}철사${fr(pv.before)} → <b>${fr(pv.after)}</b>/포인트${pv.target != null ? `(목표${fr(pv.target)}）` : ''}` : `${RES[pv.r].n} +${fr(pv.add)}/가리키다`}</span>`;
        if (!phone) {
          if (short.length) t += `<br><span class="gwarn">추가 요청 예정${short.map(x => `${RES[x.k].n} ${fr(x.need)}/min (현재 남음${fr(x.spare)}）`).join('、')}</span>`;
          else if (pv.ins.length) t += `<br><span class="gok">충분한 원자재</span>`;
          if (pv.w) t += `<br><span class="${pv.idle < pv.w ? 'gwarn' : 'gok'}">${pv.w}명 필요, ${pv.idle}명 사용 가능</span>`;
        }
      }
      if (ck.camp >= 0 && P.type !== 'furnace') {
        t += `<br>창고 ${ck.dist.toFixed(1)} 그리드로 이동`;
        if (BLD[P.type].gather) t += `· 자원 포인트 ${ck.spots}`;
        if (ck.syn) t += `· 연계 +${Math.round(ck.syn * Sim.SYN_PER * 100)}%`;
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
    if (!steps.length) { S.meta.tut = true; hide(); this.toast('초보자 가이드가 완료되었습니다. 하단의 스트립 라인은 늙은 길잡이며, 이는 다음 단계를 단계별로 상기시켜줍니다. 전체 텍스트를 읽으려면 그의 아바타를 클릭하세요. "메뉴 → 도움말"에 전체 지침이 있습니다.', 'good'); return; }
    const st = steps[0], i = TUT.indexOf(st) + 1, touch = matchMedia('(pointer:coarse)').matches;
    let el = null, pt = null, msg = '';
    if (st.b) {
      const P = g.place;
      if (P && P.type === st.b) {
        const s = BLD[st.b].size; pt = g.view.project(P.x + s / 2, P.y + s / 2, 0.6);
        msg = touch ? '미리보기를 이동하려면 지면을 클릭하고, 같은 위치를 다시 클릭(또는 ✓ 누르기)하면 빌드됩니다. 녹색 상자는 건설 가능함을 나타냅니다.' : '그냥 땅을 클릭하면 건설됩니다. 녹색 상자는 건설 가능을 의미하고 빨간색 상자는 건설할 수 없음을 의미합니다.';
      } else if (P) { el = this.$('placeNo'); msg = '먼저 배치 중인 건물을 취소하세요.'; }
      else if (g.pc && g.pc.bOpen) { // 电脑版：建造是底部横条
        if (g.pc.tier !== 1) { el = document.querySelector('#pcBuild .pct[data-pct="1"]'); msg = '"모닥불" 탭으로 다시 전환하세요.'; }
        else { el = document.querySelector(`#pcBuild .pbc[data-arg="${st.b}"]`); msg = `"${BLD[st.b].n}"을 선택하세요.`; }
      }
      else if (this.panel && this.panel.kind === 'build') {
        if (this.buildTier !== 1) { el = this.sheet.querySelector('.tab[data-arg="1"]'); msg = '"모닥불" 탭으로 다시 전환하세요.'; }
        else { el = this.sheet.querySelector(`.card[data-arg="${st.b}"]`); msg = `"${BLD[st.b].n}"을 선택하세요.`; if (el && this.tutScroll !== st.b) { this.tutScroll = st.b; el.scrollIntoView({ block: 'nearest' }); } }
      } else { el = document.querySelector('#toolbar button[data-arg=build]'); msg = '"건설"을 누르세요.'; }
      msg = `<b>${BLD[st.b].n} 건설</b>${st.why}<br>👉 ${msg}`;
    } else if (st.k === 'stock') { el = this.$('tbProd'); msg = `<b>자재 보기</b>${st.why}<br>👉 하단의 "생산"을 누르세요.`; }
    else if (st.k === 'goal') { el = this.$('goal'); msg = `<b>목표 보기</b>${st.why}<br>👉 상단의 목표 표시줄을 누르세요.`; }
    else {
      const f = Sim.getB(S, c.furnace);
      if (this.panel && this.panel.kind === 'bld') { el = this.sheet.querySelector('[data-act=upgrade]'); msg = '👉 재료가 충분하면 "업그레이드"를 누르세요.'; }
      else { pt = g.view.project(f.x + 1.5, f.y + 1.5, 2.2); msg = '👉 용광로를 누르세요.'; }
      msg = `<b>용광로 살펴보기</b>${st.why}<br>${msg}`;
    }
    box.wrap.style.display = '';
    const html = `<div class="cstep">초보자 가이드 ${i}/${TUT.length}</div><div class="cmsg">${msg}</div><button class="small ghost" data-act="tutskip">가이드 건너뛰기</button>`;
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
  // 打开一个面板.属于某个分区的面板（物资、产线……）顶上带分区的页签；从别的面板里点进来的带一个「‹ 返回」
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
    const bk = this.back ? '<button class="bk" data-act="back" title="뒤로" aria-label="뒤로">‹</button>' : '';
    const ff = this['pf_' + tk], ft = ff ? ff.call(this) : ''; // 面板底部固定的主按钮（有就放）
    const ttl = f.call(this, 'title'); if (!this.panel || this.panel.kind !== tk) return; // 面板自己关掉了（排队的建筑刚开工、目标没了）
    const body = f.call(this, 'body'); if (!this.panel || this.panel.kind !== tk) return;
    const html = `<div class="phead ${tb ? 'tabbed' : ''}">${bk}<b>${ttl}</b><span class="pesc"><kbd>Esc</kbd>를 누르거나 마우스 오른쪽 버튼을 클릭하여 닫으세요</span><button class="x" data-act="close">✕</button>${tb}</div><div class="pbody">${body}</div>${ft ? `<div class="pfbar">${ft}</div>` : ''}`;
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
    if (part === 'title') return '건설';
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
        <div class="ci pic">${this.ico(k, k === 'furnace' ? 2 : 1)}${fresh ? '<i class="cnew">새로운</i>' : ''}${n ? `<i class="chave">${n}</i>` : ''}</div>
        <div class="cb"><div class="cn">${k === 'furnace' ? '전초기지 용광로<small class="cnx">(신규 야영지)</small>' : d.n}${n ? `<small class="chas">이미${n}</small>` : ''}${(Sim.campSpecOf(c) || { b: [] }).b.includes(k) ? `<i class="spec-tag">전문 분야 +${this.specPct()}%</i>` : ''}</div>
        <div class="cd">${esc(d.desc)}</div>
        <div class="cc">${far ? `🔒 ${esc(Sim.stageLock(S, k))}` : locked ? `"하려면 정찰가 필요합니다.${TIER_NAMES[d.t]}"위도` : costHtml(c.stock, cost)}${k === 'furnace' ? '<small class="cnx">(북쪽으로 갈수록 가격이 더 비쌉니다)</small>' : ''}</div>
        ${d.out ? `<div class="cio">${d.in ? Object.keys(d.in).map(r => RICON[r] + d.in[r]).join(' ') + ' → ' : ''}${Object.keys(d.out).map(r => RICON[r] + d.out[r]).join(' ')}<small>/분 ·${d.w}사람들</small></div>` : ''}
        ${d.cat === 'deco' ? `<div class="cio">✨ 장식 · 희망 +${d.hope}${d.w ? `<small> · ${d.w}사람들이 보살핌을 받습니다.</small>` : ''}</div>` : ''}
        </div></div>`;
    }
    this.bNewShown = shown;
    const hint = this.buildTier > S.known ? `<div class="hint">정찰대를 북쪽으로 보내고 "${TIER_NAMES[this.buildTier]}"의 위도를 확인한 후 잠금을 해제하세요. </div>` : '';
    return tabs + hint + `<div class="cards" data-sx="bcards">${cards}</div>`;
  }

  // 建造队列里的一栋：还缺什么、排第几
  // 超载熔炉：炉温条 + 开关（熔炉面板和暴风雪预报里都有）
  panelCamp() { const b = this.panel && this.panel.kind === 'bld' ? Sim.getB(this.S, this.panel.arg) : null; return b ? Sim.getCamp(this.S, b.camp) : this.camp(); }
  odBlock(c, cr, fb) {
    const ovh = Math.round(c.ovh || 0), cool = c.odCool > 0, act = !cool && (!!c.od || (c.odAuto !== false && !!c.odA)); // 用营地上的开关，点了马上变（暂停时也是）
    const boost = Math.round(Sim.odBoost(fb.lvl) * (1 + Sim.specOf(this.S, fb) * 0.5));
    const state = cool ? `<b class="bad">난로를 멈추고 ${fmtTime(c.odCool)}</b> 식히기` : act ? `<b class="hot">오버로드 +${Math.round(cr.odHeat || boost)}°</b>` : ovh > 0 ? '용광로 온도가 떨어지고 있습니다.' : '매끄러운';
    let h = `<div class="odbox ${act ? 'on' : ''} ${cool ? 'cool' : ''}"><div class="odh"><span>🔥 용광로 오버로드</span><span>${state}</span></div>`;
    h += `<div class="odg"><span>오븐 온도</span><div class="bar ${ovh >= 85 ? 'red' : ovh >= 60 ? 'hot' : ''}"><i style="width:${ovh}%"></i><u style="left:85%"></u></div><b>${ovh}%</b></div>`;
    h += `<div class="odd">연료는 두 배 더 많이 연소되고 열에 ${boost}°를 추가합니다. 퍼니스 온도가 가득 차면 ${Sim.OD_STALL / 60}분 동안 강제로 종료됩니다. 그때는 열이 30%밖에 남지 않았습니다. </div>`;
    h += `<div class="odbtn">${cool ? `<button class="btn" 비활성화>퍼니스가 냉각 중입니다</button>` : act && c.od ? `<button class="btn" data-act="od" data-arg="0">오버로드 중지</button>` : act ? `<button class="btn" data-act="od" data-arg="0">먼저 휴식을 취하세요</button>` : `<button class="btn go" data-act="od" data-arg="1">🔥 지금 오버로드</button>`}`;
    h += `<button class="tgl ${c.odAuto !== false ? 'on' : ''}" data-act="odauto"><span class="ti">❄</span><span class="tt">눈보라 시 자동 과부하<small>로 온도가 85%에 도달하면 자동으로 휴식</small></span><i class="sw"></i></button></div></div>`;
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
    if (!e.ev || (!e.on && e.inSec > Sim.forecastOf(S))) return `<div class="row sub"><span></span><span> ${Sim.forecastOf(S) > 3600 ? "두 시간" : "한 시간"} 이내에 얼음 폭풍, 극도로 추운 밤 또는 얼음호수 균열이 발생할 것이라는 예보는 없습니다. </span></div>`;
    const ev = e.ev, E = Sim.WXE[ev.kind], prep = Sim.wxePrepped(S, c, ev), matters = Sim.wxeMatters(S, c, ev);
    let h = `<div class="wxhero ev ${e.on ? 'on' : e.inSec <= Sim.WXE_WARN ? 'near' : ''}"><div class="wxi">${E.ic}</div><div><b>${E.n}${e.on ? `가운데, 왼쪽${fmtTime(e.left)}` : `· 에 대한${fmtTime(e.inSec)}뒤쪽에`}</b><small>${e.on ? '' : `대략 지속됩니다.${Math.round((ev.end - ev.start) / 60)}분 ·`}${esc(E.d)}</small></div></div>`;
    const fx = [];
    if (ev.kind === 'ice') {
      const hs = S.buildings.filter(b => b.camp === c.id && b.type === 'heater').length;
      fx.push(['실외채집', `벌목, 채석, 사냥, 채광 −${Math.round((1 - Sim.WXE_ICE_GATHER) * 100)}%`]);
      fx.push(['용광로/히팅파이프', !matters ? '이 야영지에는 해당 기능이 없으며 영향을 받지 않습니다.' : prep ? '✔ 보온담요로 감싸 난방은 평소와 같이 제공됩니다.' : `<b class="bad">정지</b>:${hs ? `${hs}히터` : ''}${hs && c.pipe ? '그리고' : ''}${c.pipe ? `${c.pipe}등급 히팅 파이프` : ''}난방을 중지하세요`]);
    } else if (ev.kind === 'cold') {
      fx.push(['용광로', `${Math.round((Sim.WXE_FUEL - 1) * 100)}% 더 많은 연료를 연소하세요. 이제 분당 약 ${fmt((cr.baseBurn || cr.burnPerMin || 0) * (e.on ? 1 : Sim.WXE_FUEL))}입니다.`]);
      fx.push(['집에서', `${prep ? '✔ 문과 창문의 이음새가 밀봉되어 온도가 절반으로 감소합니다.' : ''}연료는 충분히 뜨겁다면 몇도 더 추울 것이고, 충분히 뜨겁지 않으면 더 추울 것입니다.`]);
    } else {
      fx.push(['물류망 / 정찰대의 도로', `느린 ${Math.round((1 - Sim.WXE_SLOW) * 100)}%`]);
      fx.push(['야영지 취급', !matters ? '근처에 얼음호수가 없으므로 영향을 받지 않습니다.' : prep ? '✔ 목판 보도는 포장되어 있으며 평소와 같이 영업합니다.' : `<b class="bad">느림 ${Math.round((1 - Sim.WXE_CRACK) * 100)}%</b> (근처에 얼음호수가 있으니 우회하세요)`]);
    }
    for (const [a, b] of fx) h += `<div class="row"><span>${a}</span><span>${b}</span></div>`;
    if (matters && !prep) {
      const cost = Sim.wxePrepCost(S, c, ev), can = Sim.canAfford(c.stock, cost);
      h += `<div class="wxprep"><div><b>${E.prep}</b><small>${E.prepD}(이것만)</small></div><span class="wxpc">${costHtml(c.stock, cost)}</span><button class="btn ${can ? 'go' : ''}" data-act="wxprep" data-arg="${c.id}" ${can ? '' : 'disabled'}>준비</button></div>`;
    } else if (matters && prep) h += `<div class="row sub"><span></span><span>✔ "${esc(c.name)}"은(는) 이미 ${E.prep}입니다. </span></div>`;
    return h;
  }
  p_weather(part) {
    const S = this.S, c = this.camp(), cr = Sim.rt(S).c[c.id] || {}, P = this.wxPlan(c, cr);
    const cs = Sim.coldAt(S), cold = cs && (cs.on || cs.fc);
    const z = Sim.tideAt(S), tide = z && (z.on || z.fc);
    if (part === 'title') return `${P.on ? '눈보라중' : z && z.on ? '영동조중' : cs && cs.on ? '한파중' : '일기 예보'} <small>${esc(c.name)}</small>`;
    const e = Sim.wxeAt(S, S.t), evFirst = e.ev && (e.on || (!P.on && e.inSec < P.inSec && e.inSec <= Sim.forecastOf(S)));
    const evh = `<div class="sec">${e.on ? '현재 날씨' : '기타 날씨'}</div>` + this.wxeCard(c, cr);
    const ch = cs ? `<div class="sec">한파 분기</div>` + this.coldCard(c, cr, cs) : '';
    const th = z ? `<div class="sec">영동조</div>` + this.tideCard(c, cr, z) : '';
    return (tide ? th : '') + (cold ? ch : '') + (evFirst ? evh + '<div class="sec">눈보라</div>' : '') + this.p_weatherBliz(c, cr, P) + (evFirst ? '' : evh) + (cold ? '' : ch) + (tide ? '' : th);
  }
  // 1.1 永冬潮：第几波、多久到、多冷、燃料够不够、霜巨兽打不打得过、挺过去有什么
  tideCard(c, cr, z) {
    const S = this.S, T = Sim.TIDE, C = Sim.tideOf(S) || {};
    if (!z.on && !z.fc) return `<div class="row sub"><span>${z.n} 웨이브</span><span>약 ${fmtTime(z.inSec)} 나중에(${Math.round(Sim.tideLead(S) / DAY_LEN)}일 전에 보고됨)</span></div>` + (C.end ? `<div class="row sub"><span>이전 웨이브</span><span>${C.end}${(S.meta.tideBest || 0) >= C.end ? '그것을 극복했다' : '버티지 않았어'} 웨이브</span></div>` : '');
    const m = T.fuel, burn = cr.burnPerMin || 0, cold = Sim.coldNow(S), base = z.on ? burn / Math.max(m, cold ? Sim.coldFuel(S) : 1) : burn, need = base * m * (z.on ? z.left : T.len) / 60, have = cr.fuelUnits || 0;
    const tIn = Math.round((cr.tH ?? c.temp) - (z.on ? 0 : z.drop)), tc = tIn >= 2 ? 'ok' : tIn >= -8 ? 'warn' : 'bad';
    let h = `<div class="wxhero tide ${z.on ? 'on' : z.inSec <= 600 ? 'near' : ''}"><div class="wxi">🌌</div><div><b>${z.on ? `영동조th${z.n}웨이브, 왼쪽${fmtTime(z.left)}` : `아니요.${z.n}보요${fmtTime(z.inSec)}나중에 도착`}L</b><small>하루 반 동안 지속됨 · 온도 −${z.drop}° · 용광로 연소${m}타임즈 연료 · 아웃도어 채집${Math.round(Sim.tideGather(S) * 100)}%${Sim.techDone(S, 'botshell') ? '(오토마톤는 영향을 받지 않습니다)' : ''}</small></div></div>`;
    h += `<div class="row nw"><span>방에 있는 듯한 느낌</span><span>${z.on ? '지금' : '차오 리오'} <b class="${tc}">${tIn}°</b>${tIn >= 2 ? ', 아무도 얼지 않을 것입니다' : ', 누군가 동상: 업그레이드천막, 히터를 구축하거나 용광로에 과부하를 걸 것입니다.'}</span></div>`;
    h += `<div class="row nw"><span>연료</span><span>${z.on ? '이 단락의 나머지 부분' : '이 파도'}은(는) 약 ${fmt(need)} 소모됩니다. · 이제 ${fmt(have)} ${have >= need ? '<b class="ok">✔ 충분해요</b>' : '<b class="bad">✖ 충분하지 않습니다</b>'}${z.on ? '' : '<small>（물류망는 각 야영지가 보충하도록 돕고 있습니다.）</small>'}</span></div>가 남았습니다.`;
    const bv = Sim.beastView(S, z);
    if (bv) h += `<div class="row nw"><span>서리 괴물</span><span>${bv.done ? (bv.won ? '<b class="ok">✔ 격퇴함</b>' : '<b class="bad">침입당함</b>, 얼어붙은 건물은 잠시 뒤 녹습니다') : `${bv.in > 0 ? fmtTime(bv.in) + ' 뒤' : '곧'} "${esc(bv.name)}"(으)로 몰려옴 · 강도 ${bv.str} · 방어 ${bv.def} ${bv.def >= bv.str ? '<b class="ok">✔ 막을 수 있음</b>' : Sim.colossusReady && Sim.colossusReady(S) && Sim.wonderOn(S, 'wcolossus') ? '<b class="warn">증기 거상으로 위협 가능</b>' : '<b class="bad">✖ 막을 수 없음</b>'}`}<br><small>막지 못하면 건물 여러 채가 ${T.frz / 60}분간 얼어붙고 몇 명이 동상으로 쓰러집니다. 사망자는 없습니다.</small></span></div>`;
    const best = S.meta.tideBest || 0;
    h += `<div class="row sub nw"><span>통과</span><span>동상 환자 없음, 서리 괴물 침입 없음: 잔불 +${T.embers * z.n}, 각 야영지 희망 +${T.hope}${best < 5 ? '<br>살아남은 웨이브 5: 전용 스킨 "서리 하양" 및 칭호 "영동의 불지킴이"' : best < 10 ? '<br>살아남은 웨이브 10: 전용 스킨 "영원한 겨울" 및 칭호 "열 번의 물결에도 꺼지지 않는 자"' : ''}</span></div>`;
    return h;
  }
  // 1.1 寒潮：多久到、这一天要烧多少燃料、屋里会不会冻着、挺过去有什么
  coldCard(c, cr, cs) {
    const S = this.S, m = Sim.coldFuel(S), C = Sim.COLD;
    if (!cs.on && !cs.fc) return `<div class="row sub"><span>다음 번 한파</span><span>약 ${fmtTime(cs.inSec)} 후(${Math.round(Sim.coldLead(S) / DAY_LEN)}일 전)</span></div>`;
    const burn = cr.burnPerMin || 0, base = cs.on ? burn / m : burn, need = base * m * (cs.on ? cs.left : C.len) / 60, have = cr.fuelUnits || 0;
    const tIn = Math.round((cr.tH ?? c.temp) - (cs.on ? 0 : C.drop)), tc = tIn >= 2 ? 'ok' : tIn >= -8 ? 'warn' : 'bad';
    let h = `<div class="wxhero ${cs.on ? 'on' : cs.inSec <= 300 ? 'near' : ''}"><div class="wxi">🌨</div><div><b>${cs.on ? `한파, 아직 있어요${fmtTime(cs.left)}` : `~에 대한${fmtTime(cs.inSec)}나중에 한파 파업`}L</b><small>하루종일 지속됨 · 용광로 화상${m}타임즈 연료 · 아웃도어 채집${Math.round(Sim.coldGather(S) * 100)}% · 온도 -${C.drop}°${Sim.coldBliz(S, cs) ? '· 눈보라와 충돌' : ''}</small></div></div>`;
    h += `<div class="row"><span>방에 있는 듯한 느낌</span><span>${cs.on ? '지금' : '한파 리오'} <b class="${tc}">${tIn}°</b>${tIn >= 2 ? ', 아무도 얼지 않을 것입니다' : ', 누군가 동상: 업그레이드천막, 히터를 구축하거나 용광로에 과부하를 걸 것입니다.'}</span></div>`;
    h += `<div class="row"><span>연료</span><span>${cs.on ? '이 단락의 나머지 부분' : '오늘'} 비용은 약 ${fmt(need)} · 현재 ${fmt(have)} ${have >= need ? '<b class="ok">✔ 충분해요</b>' : '<b class="bad">✖ 충분하지 않습니다</b>'}${cs.on ? '' : '<small>（물류망는 각 야영지가 보충하도록 돕고 있습니다.）</small>'}</span></div> 있음`;
    h += `<div class="row sub"><span>통과</span><span>야영지에 동상이 없고 희망 +${C.hope}가 있습니다. 동상이 없으면 잔불 +${C.embers}</span></div>를 입력하세요.`;
    return h;
  }
  p_weatherBliz(c, cr, P) {
    const S = this.S;
    const fb = Sim.getB(S, c.furnace);
    const tc = t => t >= 2 ? 'ok' : t >= -8 ? 'warn' : 'bad';
    const big = P.on ? `눈보라에는 ${fmtTime(P.dur)} 남았습니다.` : `약 ${fmtTime(P.inSec)} 후에 공격받았습니다.`;
    let h = `<div class="wxhero ${P.on ? 'on' : P.inSec <= 600 ? 'near' : ''}"><div class="wxi">❄</div><div><b>${big}</b><small>${P.on ? '' : `대략 지속됩니다.${Math.round(P.dur / 60)}분 ·`}급격한 기온 하락${Math.round(P.drop)}°</small></div></div>`;
    h += `<div class="sec">버틸 수 있을까 말까</div>`;
    const tl = P.tOD !== P.tB ? `<b class="${tc(P.tB)}">${Math.round(P.tB)}°</b> → 과부하 후 <b class="${tc(P.tOD)}">${Math.round(P.tOD)}°</b>` : `<b class="${tc(P.tB)}">${Math.round(P.tB)}°</b>`;
    h += `<div class="row"><span>방에 있는 느낌</span><span>보통 눈보라에서 ${Math.round(P.base)}° · ${tl}</span></div>`;
    const tv = Math.max(P.tOD, P.tB);
    h += `<div class="row sub"><span></span><span>${tv >= 2 ? '✔ 참으면 누구도 동상에 걸리지 않는다' : tv >= -8 ? '⚠ 어떤 사람은 동상에 걸려 환자가 작동하지 않게 됩니다.' : '✖ 매우 위험합니다. 광범위한 동상을 일으키거나 심지어 얼어 죽을 수도 있습니다.'}</span></div>`;
    h += `<div class="row"><span>연료</span><span>${P.fuelEnd >= 0 ? `<b class="ok">✔ 충분합니다</b> 눈이 그치면 대략 추워질 예정입니다${fmt(P.fuelEnd)}` : `<b class="bad">✖ 충분하지 않음</b> 아직 약 1개가 부족함${fmt(-P.fuelEnd)}`}</span></div>`;
    h += `<div class="row"><span>요리</span><span>${P.foodEnd >= 0 ? `<b class="ok">✔ 충분합니다</b> 눈이 그치면 대략 추워질 예정입니다${fmt(P.foodEnd)}` : `<b class="bad">✖ 충분하지 않음</b> 아직 약 1개가 부족함${fmt(-P.foodEnd)}`}</span></div>`;
    const tips = [];
    if (tv < 2) {
      tips.push('업그레이드천막: 각 절연 수준에 대해 +2°');
      if (BLD.heater.t <= S.known) tips.push('히터 만들기: 석탄을 태워 주변을 따뜻하게 하세요.');
      if (!P.auto && !cr.od) tips.push('다음 "눈보라 시 자동 과부하"를 엽니다.');
    }
    if (P.fuelEnd < 0) tips.push('더 많은 일손 배치를 사용하여 나무를 베어 석탄을 채굴하거나, 먼저 연소된 연료를 발열량이 더 높은 ZZG로 교체하세요.');
    if (P.foodEnd < 0) tips.push('일손 배치를 더 원한다면 사냥터와 부엌으로 가서 요리를 먼저 비축하세요.');
    if (tips.length) h += `<div class="wxtips">${tips.map(t => `<div>· ${t}</div>`).join('')}</div>`;
    h += this.odBlock(c, cr, fb);
    h += `<div class="row sub"><span></span><span>예보는 현재 생산량을 기준으로 추정되었으며 참고용입니다. </span></div>`;
    return h;
  }
  p_far(part) {
    const S = this.S, i = this.panel.arg, f = FAR_MARKS[i], p = (getWorld(S.runSeed).far || [])[i];
    if (!f || !p) { this.close(); return ''; }
    const st = Sim.farState(S, i), own = !!(S.meta.relics && S.meta.relics[i]);
    if (part === 'title') return `${f.n} <small>영야 Icefield · 라인 ${f.row}</small>`;
    let h = `<div class="farhero ${st}"><div class="cari">${st === 'lit' ? '✨' : '📍'}</div><div><b>${st === 'lit' ? '이미 켜져 있음' : st === 'seen' ? '찾았지만 아직 켜지지 않았습니다' : '아직 찾지 못했어요'}</b><small>${esc(f.desc)}</small></div></div>`;
    h += `<div class="relic ${own ? 'own' : ''}"><div class="rli">🏺</div><div><b>유물「${esc(f.relic.n)}」</b><span>${esc(f.relic.d)}</span><small>${own ? '✔ 다시 가져와서 영구적으로 적용되며 북상 이후에도 유지됩니다.' : `그 옆에${14}그리드에서 전초기지 용광로를 클릭하여 다시 가져오면 영구적으로 적용됩니다.`}</small></div></div>`;
    if (st !== 'lit') {
      const near = S.camps.reduce((m, c) => Math.min(m, Math.hypot(c.x - p.x, c.y - p.y)), 1e9);
      h += `<div class="row"><span>가장 가까운 야영지</span><span>${Math.round(near)} 그리드</span></div>`;
      h += `<div class="row sub"><span>온도</span><span>${baseTempOfRow(p.y)}°(용광로는 견딜 수 있을 만큼 충분히 높은 온도가 필요합니다)</span></div>`;
    }
    h += `<button class="btn wide" data-act="farmap" data-arg="${i}">📍 지도에서 보기</button>`;
    // 全部远方地标的进度
    h += `<div class="sec">영야 아이스필드 · 머나먼 랜드마크</div><div class="farlist">${FAR_MARKS.map((x, k) => { const s2 = Sim.farState(S, k), o2 = !!(S.meta.relics && S.meta.relics[k]); return `<div class="fli ${s2} ${k === i ? 'cur' : ''}" ${s2 !== 'none' ? `data-act="far" data-arg="${k}"` : ''}><b>${s2 === 'none' ? '？？？' : esc(x.n)}</b><small>${s2 === 'none' ? `대략 에${x.row}좋아요` : o2 ? `🏺 ${esc(x.relic.d)}` : '아직 유물을 가져오지 못했어요'}</small><i>${s2 === 'lit' ? '✨' : s2 === 'seen' ? '📍' : '·'}</i></div>`; }).join('')}</div>`;
    return h;
  }
  p_raid(part) {
    const S = this.S, nr = Sim.nextRaid(S);
    const on = nr && nr.in <= Sim.RAID_PREP;
    if (part === 'title') return on ? '공격 경고' : '야영지방어';
    const auto = `<button class="tgl ${S.rAuto !== false ? 'on' : ''}" data-act="rauto" style="width:100%;margin-top:8px"><span class="ti">🛡</span><span class="tt">시간에 관계없이 자동으로 전쟁 준비<small>공격 5분 전에 공격을 방어할 수 없으면 야간 경비원이 벽에 불을 붙이고 민병대를 소집합니다</small></span><i class="sw"></i></button>`;
    if (!on) return `<div class="rdhero"><div class="cari">🛡</div><div><b>${nr ? `다음 공격은 약입니다.${fmtTime(nr.in)}뒤쪽에` : '현재는 공격이 없습니다'}</b><small>정찰 군사회의가 예정보다 앞당겨졌습니다${Sim.RAID_PREP / 60}공격자를 발견한 후 몇 분 후에 전투를 준비할 수 있습니다. </small></div></div>` + auto;
    const c = Sim.getCamp(S, nr.camp), p = Sim.raidPrep(S, nr) || {};
    const str = Sim.raidStrength(S, c, nr), d0 = Sim.campDefense(S, c), def = Sim.raidDefense(S, c, nr);
    const name = RAIDERS[tierOfRow(c.y)];
    let h = `<div class="rdhero ${def >= str ? '' : 'bad'}"><div class="cari">🐺</div><div><b>${name}~에 대한${fmtTime(nr.in)}공격 후 "${esc(c.name)}”</b><small>강도${str}·방어${def}${def !== d0 ? `(화살탑 및 일손${d0}）` : ''}</small></div></div>`;
    const lose = Math.round(30 * Math.max(0, 1 - def / str) * (p.hide ? 0.5 : 1));
    h += `<div class="row"><span>예상 결과</span><span>${def >= str ? '<b class="ok">✔ 버틸 수 있다면</b> 생고기 배치를 수확할 수 있습니다' : `<b class="bad">✖ 지키지 못할 경우</b> 약속이 취소됩니다.${lose}% 보급품, 누군가 사망할 수 있음`}</span></div>`;
    const card = (k, ic, n, eff, cost) => {
      const done = p[k];
      return `<div class="ord prep ${done ? 'done' : ''}"><div class="ordk">${ic} ${n}</div><div class="prd">${eff}</div><div class="prc">${cost}</div>${done ? `<div class="ordok">✔ ${done === 2 ? '야간 순찰이 준비되었습니다' : '편곡'}</div>` : `<button class="btn go wide" data-act="prep" data-arg="${k}">${{ fire: '불의 가벼운 벽', mil: '민병대를 불러', hide: '보급품 모으기' }[k]}</button>`}</div>`;
    };
    const fc = Sim.prepCost(S, c, 'fire'), mc = Sim.prepCost(S, c, 'mil');
    h += card('fire', '🔥', '불의 가벼운 벽', `방어 +${Sim.prepGain(S, c, nr, 'fire')}: 야영지 주위에 불의 원이 있고, 짐승과 약탈자는 감히 강한 돌격을 할 수 없습니다.`, `${fmt(fc)}개 소각 연료<small>인벤토리 ${fmt(Sim.fuelUnitsOf(c.stock))}</small>`);
    h += card('mil', '⚔', '민병대를 불러', `방어 +${Sim.prepGain(S, c, nr, 'mil')}: 그 사람을 데려갈 수 있는 사람은 누구나 벽으로 갈 것입니다`, `요리 ${fmt(mc)}, 공격 전 생산량 −20%<small>인벤토리 ${fmt(c.stock.food || 0)}</small>`);
    h += card('hide', '📦', '보급품 모으기', '방어가 실패하면 보급품의 절반만 손실되고, 절반의 인원이 사망합니다.', '공격 전 생산량 -10% (운반꾼이 물건을 옮기러 갔다)');
    return h + auto;
  }
  // 掠夺者营地：他们是谁、离哪座营地近、眼下的索贡怎么答复
  p_gang(part) {
    const S = this.S, g = Sim.gangOf(S, this.panel.arg), st = g && (S.gangs || {})[g.id];
    if (!g || !st) { this.close(); return ''; }
    const nm = Sim.gangName(g);
    if (part === 'title') return `${esc(nm)} <small>약탈자야영지 · 위도 ${g.y}</small>`;
    const c = (st.dem && Sim.getCamp(S, st.dem.camp)) || Sim.gangTarget(S, g);
    const str = Sim.gangStr(S, g), def = c ? Sim.campDefense(S, c) : 0;
    let h = `<div class="rdhero ${st.gone ? '' : st.dem ? 'bad' : ''}"><div class="cari">🏴</div><div><b>${st.gone ? '이미 헤어졌어' : st.dem ? `소르곤에서:${fmtTime(st.dem.until - S.t)}이내에 답장하세요` : c ? `"를 쳐다보며${esc(c.name)}」` : '아직 우리 야영지와는 거리가 멀다'}</b><small>${st.gone ? '야영지 내부에는 천막의 검게 변한 프레임만 남아 있습니다.' : `힘${str}${c ? ` · 「${esc(c.name)}"방어${def}` : ''}· 이미 구타당했습니다${st.wins || 0}/${Sim.GANG_WINS}이류`}</small></div></div>`;
    if (st.gone) return h + `<button class="btn wide" data-act="gangmap" data-arg="${g.id}">🏴 지도에서 보기</button>`;
    h += `<div class="row"><span>여행</span><span>${st.paid || 0}회 공물 바치기 · ${st.trades || 0}회 사고 팔기 · ${st.wins || 0}회 패배 </span></div>`;
    if (!st.dem) {
      h += `<div class="row sub"><span></span><span>${c ? `다음 번에는 대략${fmtTime(Math.max(0, st.next - S.t))}나중에 그는 공물을 요청했습니다.` : `야영지 놔둬${Sim.GANG_R}그리드 내에서만 타겟이 됩니다.`}</span></div>`;
      h += `<div class="hint">공물을 요구하러 올 때 세 가지 선택이 있습니다. 공물의 일부를 지불하고 보내는 것입니다. 그들이 빼앗은 물건에 대한 대가로 더 많은 음식과 연료를 제공하십시오. 아니면 그들을 다시 몰아내고 그들이 싸울 때까지 기다리세요. 두 번의 전투에서 승리한 후 갱단은 해산되었습니다. </div>`;
      return h + `<button class="btn wide" data-act="gangmap" data-arg="${g.id}">🏴 지도에서 보기</button>`;
    }
    const tb = Sim.gangTribute(S, g, c), T = Sim.gangTrade(S, g, c), fight = !!st.dem.fight;
    const lose = Math.round(25 * Math.max(0, 1 - def / str));
    const card = (k, ic, n, eff, cost, can, btn) => `<div class="ord prep ${fight && k !== 'fight' ? 'dim' : ''} ${fight && k === 'fight' ? 'done' : ''}"><div class="ordk">${ic} ${n}</div><div class="prd">${eff}</div>${cost ? `<div class="prc">${cost}</div>` : ''}${fight && k === 'fight' ? `<div class="ordok">✔ 결정되었습니다.${fmtTime(st.dem.until - S.t)}그런 다음 재생을 시작하세요</div>` : fight ? '' : `<button class="btn ${can ? 'go' : ''} wide" data-act="ganggo" data-arg="${g.id}:${k}" ${can ? '' : 'disabled'}>${btn}</button>`}</div>`;
    h += card('tribute', '🎁', '경의를 표하다', '경의를 표하면 이번에는 떠날 것입니다. 다음에 다시 오세요.', costHtml(c.stock, tb), Sim.canAfford(c.stock, tb), '경의를 표하다');
    h += card('trade', '⚖', '사업하다', `그들이 훔친 물품에 대한 대가로 더 많은 음식과 연료를 제공하십시오.${Object.keys(T.get).map(k => `${RICON[k]}<b>${fmt(T.get[k])}</b>`).join(' ')}. 더 많이 오고 갈수록 더 많이 주는 것입니다.`, costHtml(c.stock, T.give) + (Sim.canAfford(c.stock, T.give) && Sim.gangTradeBlock(S, g, c) ? `<div class="prw">${Sim.gangTradeBlock(S, g, c)}</div>` : ''), Sim.canAfford(c.stock, T.give) && !Sim.gangTradeBlock(S, g, c), '거래를 하다');
    h += card('fight', '⚔', '뒤로 밀어', `${def >= str ? '<b class="ok">✔ 버틸 수 있어요</b> (방어' + def + '오른쪽' + str + '): 대량의 물품을 압수한 후에는 약해집니다.' : `<b class="bad">✖ 참을 수 없어요</b>（방어${def}오른쪽${str}): 약속을 강탈당할 것이다${lose}% 보급품, 누군가 사망할 수 있음`}. 화살탑를 더 구축하시면 방어를 추가하실 수 있습니다.`, '', true, '그들을 쫓아내다');
    h += `<div class="row sub"><span></span><span>그때에는 아무도 대답하지 않을 것입니다. 가질 수 있으면 돌아가고, 가질 수 없으면 먼저 공물을 바치십시오(값을 낼 수 없으면 일부만 모으십시오). </span></div>`;
    return h;
  }
  p_caravan(part) {
    const S = this.S, C = S.car;
    if (!C) { if (part === 'title') return '썰매 캐러밴'; const n = Sim.nextCaravan(S); return `<div class="carhero"><div class="cari">🛷</div><div><b>캐러밴이 떠났습니다</b><small>${n ? `다음은 대략${fmtTime(n.in)}나중에 도착` : ''}</small></div></div>`; }
    const c = Sim.getCamp(S, C.camp);
    if (part === 'title') return `썰매 캐러밴 <small>${esc(c.name)}외부</small>`;
    let h = `<div class="carhero"><div class="cari">🛷</div><div><b>야영지 밖에서 캠핑을 하고 ${fmtTime(C.until - S.t)}</b><small>야영지의 물건을 그들이 가져온 것과 교환할 때까지 기다리세요. 떠나시면 주문이 무효화됩니다. </small></div></div>`;
    C.orders.forEach((o, i) => {
      const have = c.stock[o.ask] || 0, why = Sim.orderBlock(S, i);
      const give = o.kind === 'goods' ? `${RICON[o.give]}<b>${fmt(o.gn)}</b> ${RES[o.give].n}` : o.kind === 'ember' ? `🔥<b>${o.gn}</b> 잔불<small>북상</small> 이후 유지` : `👥<b>${o.gn}</b> 사람 <small>노숙자가 머물려면 빈 침대가 있어야 합니다</small>`;
      h += `<div class="ord ${o.done ? 'done' : ''}"><div class="ordk">${['부족한 물품', '잔불', '일손'][['goods', 'ember', 'people'].indexOf(o.kind)]}</div>`;
      h += `<div class="ordr"><span class="ordl">원함</span><span>${RICON[o.ask]}<b>${fmt(o.n)}</b> ${RES[o.ask].n}<small class="${have >= o.n ? 'ok' : 'bad'}">재고 ${fmt(have)}</small></span></div>`;
      h += `<div class="ordr"><span class="ordl">변경</span><span>${give}</span></div>`;
      h += o.done ? `<div class="ordok">✔ 전달됨</div>` : `<button class="btn ${why ? '' : 'go'} wide" data-act="deliver" data-arg="${i}" ${why ? 'disabled' : ''}>${why ? esc(why) : '배달'}</button>`;
      h += `</div>`;
    });
    h += `<button class="tgl ${S.carAuto !== false ? 'on' : ''}" data-act="carauto" style="width:100%;margin-top:8px"><span class="ti">🛷</span><span class="tt">시간 관계없이 자동 배송<small>캐러밴 출발 10분 전, 재고 2배 주문 자동 완료</small></span><i class="sw"></i></button>`;
    return h;
  }
  p_queue(part) {
    const S = this.S, q = Sim.queued(S, this.panel.arg);
    if (!q) { this.close(); return ''; }
    const d = BLD[q.type], c = Sim.getCamp(S, q.camp) || this.camp(), cost = Sim.queueCost(S, q);
    if (part === 'title') return `대기 중: ${d.n} <small>${esc(c.name)}</small>`;
    const mine = S.queue.filter(x => x.camp === q.camp), n = mine.indexOf(q) + 1;
    const miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
    const pic = this.pic(q.type, 1);
    let h = `<div class="bhero"><div class="hpic">${pic}</div><div><div class="status warning">및 기타 자료</div><div class="desc">${esc(d.desc)}</div></div></div>`;
    h += `<div class="row"><span>필수</span><span>${costHtml(c.stock, cost, S.known)}</span></div>`;
    h += `<div class="row"><span>아직 부족</span><span>${miss.length ? miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') : '다 준비됐으니 바로 작업 시작하자'}</span></div>`;
    for (const k of miss) { const w = this.netWait(c, k); if (w) h += `<div class="row sub"><span>${RICON[k]}${RES[k].n}</span><span>${w}</span></div>`; }
    h += `<div class="row sub"><span>큐</span><span>「${esc(c.name)}」아니요. ${n} / ${mine.length} · 자료가 준비되면 작업이 자동으로 순서대로 시작됩니다.</span></div>`;
    h += `<button class="btn wide ghost" data-act="unqueue" data-arg="${q.id}">대기열 해제</button>`;
    return h;
  }

  // 雪橇棚：车队有几辆车、这一程还差多少、排队造车
  shedHtml(b, c) {
    const S = this.S, J = Sim.journeyOf(S), V = Sim.VEH, P = Sim.tripPlan(S);
    let h = `<div class="sec">행렬</div>`;
    h += `<div class="row"><span>기존</span><span>🛷 썰매${J.fleet.sled || 0}선반${J.fleet.tractor || J.stage >= V.tractor.from ? `·증기 트레일러${J.fleet.tractor || 0}탑` : ''}${J.fleet.icebreaker || J.stage >= V.icebreaker.from ? `·쇄빙차${J.fleet.icebreaker || 0}탑` : ''}</span></div>`;
    const big = J.stage >= V.icebreaker.from ? 'icebreaker' : J.stage >= V.tractor.from ? 'tractor' : null;
    if (P.to) h += `<div class="row sub"><span>'으로 이동${esc(P.to.n)}」</span><span>${P.roomOk ? `적합:${P.people}사람과 물건${fmt(P.load)}그렇습니다, 그것은 차에 설치될 수 있습니다${fmt(P.cap)}` : `충분하지 않음${fmt(P.lack)}장소, 대략.${Math.ceil(P.lack / V.sled.cap)}프레임 썰매${big ? `또는${Math.ceil(P.lack / V[big].cap)}탑${V[big].n}` : ''}`}</span></div>`;
    const sp = Sim.vehSpeed(S, b);
    const vq = b.vq || [];
    if (vq.length) {
      const q = vq[0];
      h += `<div class="row vq"><span>${sp > 0 ? '공사중' : '멈추다'} · ${Sim.vehName(q.v)}</span><span>${sp > 0 ? `더${fmtTime((1 - q.p) * V[q.v].secs / sp)}` : '첫 번째 일손 배치'} <button class="small" data-act="vehx" data-arg="${b.id}:0">철회</button></span></div>`;
      h += `<div class="bar"><i style="width:${(q.p * 100).toFixed(0)}%"></i></div>`;
      for (const v of Sim.VEH_KEYS) {
        let n = 0, last = -1; vq.forEach((x, i) => { if (i && x.v === v) { n++; last = i; } });
        if (n) h += `<div class="row sub vq"><span>큐 · ${Sim.vehName(v)} ×${n}</span><span><button class="small" data-act="vehx" data-arg="${b.id}:${last}">1 ${v === 'sled' ? '선반' : '탑'} 출금</button></span></div>`;
      }
    }
    for (const v of Sim.VEH_KEYS) {
      const why = Sim.vehBlock(S, b, v), locked = V[v].from && J.stage < V[v].from;
      h += `<div class="row"><span>${Sim.vehName(v)}<small>장식${V[v].cap}공유하다(${V[v].cap / Sim.PERSON_LOAD}개인의)·${v === 'sled' ? '길에서 장작을 태우고 있다' : v === 'tractor' ? '도로에서 석탄를 굽는 속도는 썰매가 없으면 절반의 속도입니다.' : '도로에서 배터리를 태워 얼음과 균열 계곡 위로 직접 운전하세요.'}</small></span><span>${locked ? `<small>${esc(why)}</small>` : `${costHtml(c.stock, V[v].cost, S.known)} <button class="small ${why ? '' : 'go'}" data-act="veh" data-arg="${b.id}:${v}:1">1개 만들기${v === 'sled' ? '선반' : '탑'}</button>${v === 'sled' ? ` <button class="small" data-act="veh" data-arg="${b.id}:${v}:5">프레임 5개 만들기</button>` : ''}`}</span></div>`;
    }
    return h;
  }
  // 1.1 熟练工：名字旁边的小星（亮几颗是几级）
  skillStars(b) { if (!Sim.skillable(b)) return ''; const l = Sim.skillLvl(b); return l ? `<i class="skst" title="우수한 ${l} 레벨">${'✦'.repeat(l)}<span>${'✦'.repeat(Sim.SKILL_MAX - l)}</span></i>` : ''; }
  skillRow(b) {
    if (!Sim.skillable(b)) return '';
    const S = this.S, l = Sim.skillLvl(b), nx = Sim.skillNext(S, b), pend = b.wDrop != null ? Math.max(0, Math.ceil(Sim.SKILL_GRACE - (S.t - b.wDrop))) : 0;
    return `<div class="row sub"><span>숙련공</span><span>${l ? `${l}레벨 · 생산량 +${Math.round(l * Sim.SKILL_PER * 100)}%` : '아직 초보자입니다'}${nx ? `<small>(가득 차면 후속 조치)${fmtTime(nx.min * 60)}승강기${nx.lvl}수준)</small>` : '<small>(정상까지 연습)</small>'}${pend && (b.xp || 0) > 0 ? `<br><b class="warn">일손가 없습니다:${pend}몇 초 안에 작성하면 숙련도가 손실되지 않습니다.</b>` : ''}</span></div>`;
  }
  // 1.1 替代配方：两套配方并排，点哪套换哪套（换一次停工 20 秒）
  altHtml(b) {
    const S = this.S, alt = Sim.altDef(b.type), ok = Sim.altOk(S, b.type), sw = b.altT > S.t;
    const rc = D => `${Object.keys(D.in).map(k => RICON[k] + fmt(D.in[k])).join(' ')} → ${Object.keys(D.out).map(k => RICON[k] + fmt(D.out[k])).join(' ')}`;
    const opt = (on, D) => `<button class="achip ${!!b.alt === on ? 'on' : ''}" data-act="altset" data-arg="${b.id}:${on ? 1 : 0}" ${(on && !ok) || sw ? 'disabled' : ''}><b>${on ? '대체 레시피' : '오리지널 레시피'}</b><small>${rc(D)}</small></button>`;
    const sub = sw ? `변경 진행 중, 아직 ${Math.ceil(b.altT - S.t)}초` : ok ? `다운타임 변경 ${ALT_SWITCH}초` : `연구「${Sim.ALT_TECH[Sim.altTech(b.type)]}」 이후 교환 가능`;
    return `<div class="sec">레시피 <small>${sub}</small></div><div class="achips">${opt(false, BLD[b.type])}${opt(true, alt)}</div>`;
  }
  p_bld(part) {
    const S = this.S, b = Sim.getB(S, this.panel.arg);
    if (!b) { this.close(); return ''; }
    const d = Sim.bdef(b), c = Sim.getCamp(S, b.camp), R = Sim.rt(S), br = R.b[b.id] || {}, cr = R.c[c.id] || {};
    if (part === 'title') return d.wonder ? `${d.n} <small>불가사의 · ${esc(c.name)}</small>` : d.tower ? `${Sim.towerName(b.tn)} <small>${esc(c.name)}</small>` : `${d.n}${this.skillStars(b)} <small>${b.lvl} 레벨 · ${esc(c.name)}</small>`;
    let h = '';
    const pic = this.pic(b.type, d.wonder ? 4 : b.lvl);
    h += `<div class="bhero"><div class="hpic">${pic}</div><div>`;
    if (br.status) h += `<div class="status ${(['가동 중', '연구 중', '탑 몸통 공사 중', '탑 몸통 완성 · 점화 대기', '완공'].includes(br.status) || WONDER_PH.some(P => br.status === P.n + ' 건설 중')) ? 'ok' : 'bad'}">${esc(br.status)}</div>`;
    h += `<div class="desc">${esc(d.desc)}</div></div></div>`;
    if (c.depot && b.type === 'furnace') h += this.depotHtml(c);
    else if (Sim.depotAuto(c)) h += `<button class="mlink" data-act="tb" data-arg="camp"><span>🏚️</span><span>「${esc(c.name)}」은 업그레이드가 아닌<small>자체적으로 운영되는 보급소입니다. 야영지 패널에서 "일시적으로 인계"해야 합니다</small></span><i>></i></button>`;
    if (d.tower) return h + this.towerHtml(b, c, br);
    if (d.wonder) return h + this.wonderHtml(b, c, br);
    if (b.type === 'workshop') { const T = S.tech || {}, ct = T.cur && Sim.techDef(S, T.cur); h += `<button class="mlink" data-act="tb" data-arg="research"><span>🔬</span><span>${ct ? `현재 연구」${ct.n}」 ${Math.floor(T.prog / ct.pts * 100)}%` : '연구 중 하나를 선택하세요'}<small>이 공학 작업장 매분마다${fmt(br.rp || 0)}</small></span><i>></i></button>을 클릭하세요.`; }
    const mx = Sim.bMax(S, b);
    if (mx) {
      h += `<div class="row"><span>${b.type === 'warehouse' ? '운반꾼' : '일꾼'}</span><span class="stepper"><button data-act="w-" data-arg="${b.id}">−</button><b>${b.workers}/${mx}</b><button data-act="w+" data-arg="${b.id}">+</button><button class="small" data-act="wmax" data-arg="${b.id}">전체</button></span></div>`;
      h += `<div class="row sub"><span>야영지Idle일손</span><span>${Sim.idleLabor(S, c)}</span></div>`;
      const same = b.type !== 'furnace' ? Sim.sameType(S, b) : [];
      if (same.length > 1) { const sf = Sim.staffOf(S, b); h += `<div class="row subbulkr"><span>유사한 ${same.length}개 건물</span><span>총 ${sf.w}/${sf.mx}명<button class="bulkb" data-act="bulkw" data-arg="${b.id}" ${sf.w >= sf.mx ? 'disabled' : ''}>${sf.w >= sf.mx ? '모두 꽉 찼어요' : '모두 채워져 있어요'}</button></span></div>`; }
    }
    h += this.skillRow(b);
    if (!d.out && Sim.campSpecFx(S, b, c) > 0) h += `<div class="row sub"><span>야영지 특선 요리</span><span>${b.type === 'workshop' ? '연구' : b.type === 'tower' ? '힘' : '열'} +${this.specPct()}%<small>（「${esc(c.name)}」님의 특선 요리）</small></span></div>`;
    if (d.out) {
      const rate = br.rate || {};
      h += `<div class="row"><span>출력</span><span>${Object.keys(d.out).map(k => `${RICON[k]}${fmt(rate[k] || 0)}`).join(' ')}<small>/분</small></span></div>`;
      if (d.in) h += `<div class="row"><span>소비</span><span>${Object.keys(d.in).map(k => `${RICON[k]}${fmt((br.inRate || {})[k] || 0)}`).join(' ')}<small>/분</small></span></div>`;
      if (Sim.altDef(b.type)) h += this.altHtml(b);
      { const B = Sim.prodBonus(S, b, c), pc = x => Math.round(x * 100);
        h += `<div class="row sub"><span>레벨, 보너스</span><span>${b.lvl}레벨 ×${Sim.levelMul(b.lvl).toFixed(2)}· 보너스${B.sum >= 0 ? '+' : ''}${pc(B.sum)}%${B.parts.length ? `<small>（${B.parts.map(p => `${p[0]} ${p[1] >= 0 ? '+' : ''}${pc(p[1])}`).join(' · ')}）</small>` : ''}</span></div>`; }
      h += `<div class="row sub"><span>가장 가까운 창고까지</span><span>${(br.dist || 0).toFixed(1)} 그리드 · 운반꾼 ${fmt(br.haul || 0)} 차지</span></div>`;
      const syn = R.adj.get(b.id) || 0;
      if (d.syn) h += `<div class="row sub"><span>인접 연결</span><span>${syn ? '+' + Math.round(syn * Sim.SYN_PER * 100) + '%' : '없음'} <small>(${d.syn.map(t => BLD[t].n).join('/')}에 첨부됨)</small></span></div>`;
      if (d.gather) {
        const sp = R.gatherSpots.get(b.id) || [];
        let left = 0, alive = 0, young = 0, grow = 0; const tended = Sim.tendedSpots(S);
        for (const s of sp) { const l = Sim.harvestLeft(S, s.i); left += l; if (l > 0) alive++; if (Sim.isSapling(S, s.i)) young++; if (Sim.spotLeft(S, s.i) < Sim.spotMax(S, s.i)) grow += Sim.regrowRate(S, s.i, tended); }
        const eta = Sim.gatherEta(S, b);
        h += `<div class="row sub"><span>주변 리소스 포인트</span><span>${alive}어디서나 수집 가능 · 남은 음식${fmt(left)}${eta != null && eta > 0 && !b.deep ? ` · <b class="${eta < 20 ? 'warn' : ''}">현재 속도로는 여전히${fmtMin(eta)}</b>` : ''}</span></div>`;
        if (b.deep) h += `<div class="row sub"><span>⛏ 깊은 우물</span><span>귀리를 파낸 후에도 ${Math.round(Sim.DEEP_RATE * 100)}% 생산량에 ${br.deep ? '(깊이 파고드는)' : ''}</span></div>에 파집니다.`;
        else if (Sim.deepable(b.type)) {
          const fr = Sim.gatherLeftFrac(S, b), dc = Sim.deepCost(S, b), why = Sim.deepBlock(S, b);
          if (fr <= 0.25) h += `<div class="deepbox"><div><b>⛏ 깊은 우물 파기</b><small>표면의 광석이 거의 고갈되었습니다. 깊은 우물을 판 후에는 ${Math.round(Sim.DEEP_RATE * 100)}%의 생산량에서 계속해서 굴을 파낼 수 있습니다. 탐사팀을 정찰 막사로 보내 새로운 광맥을 찾을 수도 있습니다. </small><span>${costHtml(c.stock, dc)}</span></div><button class="small ${why ? '' : 'go'}" data-act="deep" data-arg="${b.id}">깊은 우물 파기</button></div>`;
        }
        if (young || grow > 0.05) h += `<div class="row sub"><span>${d.gather[0] === 'tree' ? '옮겨 심다' : d.gather[0] === 'herd' ? '씨앗 저장' : '다시 덮다'}</span><span>${young ? `${young}~에${d.gather[0] === 'tree' ? '어린 나무' : '견습생'}오랫동안 ·` : ''}+${fmt(grow)}/분</span></div>`;
      }
    }
    // 生产链：原料从哪来、产品去哪（地图上同时画出流向连线）
    { const ch = Sim.chainOf(S, b);
      const grp = l => { const m = new Map(); for (const x of l) { const k = x.b.type; m.set(k, (m.get(k) || 0) + 1); } return [...m].map(([t, n]) => `${BLD[t].n}${n > 1 ? '×' + n : ''}`).join(','); };
      const maker = r => { const t = Object.keys(BLD).find(t => BLD[t].out && BLD[t].out[r]); return t ? BLD[t].n : RES[r].n; };
      if (ch.ins.length) h += `<div class="row chain"><span>⬇ ${b.type === 'furnace' || b.type === 'heater' ? '연료' : '원료'}보낸 사람</span><span>${ch.up.length ? grp(ch.up) : ''}${ch.missing.length ? `<b class="warn">누락${[...new Set(ch.missing.map(maker))].join('、')}</b>` : ''}</span></div>`;
      if (ch.outs.length) h += `<div class="row chain"><span>⬆ 제품이</span><span>${ch.down.length ? grp(ch.down) : ch.outs.includes('food') ? '야영지 사람들이 다 먹어요' : '창고(건설 및 업그레이드용)'}</span></div>로 전송됨`;
      if (ch.ins.length || ch.outs.length) h += `<div class="row chain"><span></span><span><button class="small" data-act="chainmap">🔗 전체 생산 체인 보기</button></span></div>`;
    }
    // 传送带：和挨着的上下游直接连起来
    if (S.known >= Sim.BELT[1].tier && (d.in || d.out) && b.type !== 'furnace') {
      const mine = Sim.beltsOf(S, b.id), opts = mine.length >= Sim.BELT_PER ? [] : Sim.beltOptions(S, b.id);
      if (mine.length || opts.length) {
        h += `<div class="sec">컨베이어 벨트 <small>직접 공급: 운반꾼을 더 적게 사용하고 더 빠르게 하류로</small></div>`;
        for (const e of mine) {
          const o = Sim.getB(S, e.a === b.id ? e.b : e.a); if (!o) continue;
          const up = e.lvl < 2 ? Sim.beltUpBlock(S, e) : null, upCost = e.lvl < 2 ? Sim.beltCost(S, Sim.beltEnds(Sim.getB(S, e.a), Sim.getB(S, e.b)).len, 2) : null;
          h += `<div class="row belt"><span>${RICON[e.k]} ${e.a === b.id ? '에 보내다' : '~에서'} ${BLD[o.type].n}<br><small>${Sim.BELT[e.lvl].n}· 주${Math.round(Sim.BELT[e.lvl].cut * 100)}% 운송${e.b === b.id ? `· 여기 +${Math.round(Sim.BELT[e.lvl].bonus * 100)}%` : ''}</small></span><span class="bbtn">${e.lvl < 2 && S.known >= Sim.BELT[2].tier ? `<button class="small ${up ? '' : 'go'}" data-act="beltup" data-arg="${e.id}" title="${esc(up || '')}">업그레이드 트랙${costHtml(c.stock, upCost)}</button>` : ''}<button class="small" data-act="beltrm" data-arg="${e.id}">해체</button></span></div>`;
        }
        for (const o of opts.slice(0, 4 - Math.min(2, mine.length))) {
          const ck = o.ck;
          h += `<div class="row belt"><span>${RICON[o.k]} ${o.dir === 'out' ? '에 보내다' : '~에서'} ${BLD[o.other.type].n}<br><small>${o.len < 0.5 ? '옆에' : `분리된${o.len.toFixed(1)}그리드`}${ck.ok || ck.soft ? '' : ` · <b class="warn">${esc(ck.reason)}</b>`}</small></span><span class="bbtn">${ck.ok || ck.soft ? `<button class="small ${ck.ok ? 'go' : ''}" data-act="belt" data-arg="${o.a}:${o.b}:${o.k}">연결${costHtml(c.stock, ck.cost)}</button>` : ''}</span></div>`;
        }
      }
    }
    if (b.type === 'furnace') {
      const ring = Sim.heatRadius(S, c);
      h += `<div class="row"><span>온도</span><span>${Math.round(cr.temp)}°C<small>= 위도${baseTempOfRow(c.y)}° + 용광로${Math.round(cr.heat)}°${cr.drop ? `- 눈보라${Math.round(cr.drop)}°` : ''}</small></span></div>`;
      h += `<div class="row sub"><span>집 내부</span><span>${Math.round(cr.tH)}°C(천막 단열재 +${Math.round(cr.ins || 0)}°)</span></div>`;
      h += `<div class="row"><span>연료</span><span>${fmt(cr.burnPerMin)} 단위/분 ${cr.od ? '<small>(과부하×2)</small>' : ''} · 재고 ${fmt(cr.fuelUnits)}</span></div>`;
      h += this.odBlock(c, cr, b);
      { const F = Sim.focusOf(c); h += `<button class="mlink" data-act="tb" data-arg="camp"><span>${F ? `<i class="fch sm" style="background:${F.col}">${F.ch}</i>` : '🧭'}</span><span>${F ? `${F.n}야영지` : '야영지전문화'}<small>${F ? F.d : b.lvl >= FOCUS_LVL ? '아직 방향을 결정하지 않았습니다. 광업, 농경, 공방 또는 요새, 야영지 패널에서 선택하세요.' : `용광로${FOCUS_LVL}레벨업 후 야영지 전문화를 선택할 수 있습니다.`}</small></span><i>›</i></button>`; }
      h += this.festCard(c);
      { const w = Sim.weatherAt(S, S.t); h += `<button class="mlink" data-act="wx"><span>❄</span><span>${w.blizzard ? `눈보라, 아직 있어요${fmtTime(w.until - S.t)}` : `다음 게임 눈보라:${fmtTime(w.next ?? w.inSec)}뒤쪽에`}<small>냉각, 연료 및 요리가 생존하기에 충분한지 확인하세요</small></span><i>></i></button>`; }
      h += `<div class="row sub"><span>열량</span><span>${Object.keys(FUEL).map(f => `${RICON[f]}=${FUEL[f]}`).join(' ')}</span></div>`;
      h += `<div class="row"><span>먼저 연소</span><span><select data-act="fuel" data-arg="${c.id}">${['auto', ...Object.keys(FUEL)].map(f => `<option value="${f}" ${c.fuelPref === f ? 'selected' : ''}>${f === 'auto' ? '자동(먼저 태워짐)' : RES[f].n}</option>`).join('')}</select></span></div>`;
      h += `<div class="row"><span>가열 반경</span><span>${ring}그리드 → 업그레이드${ring + furnaceRadius(b.lvl + 1) - furnaceRadius(b.lvl)}그리드${c.pipe ? `<small>(증기 배관 포함 +${c.pipe}）</small>` : ''}</span></div>`;
      h += `<div class="row sub"><span>운반꾼</span><span>${fmt(cr.haulers)}명 · ${fmt(cr.demand)}${cr.hf < 1 ? '<b class="warn">충분하지 않음</b>' : ''}</span> 필요</div>`;
      h += `<div class="row sub"><span>방어</span><span>${Sim.campDefense(S, c)}</span></div>`;
      h += `<button class="mlink" data-act="camptab" data-arg="infra"><span>${INFRA.pipe.ic}</span><span>야영지 인프라: ${INFRA.road.lv[c.road || 0].n} · ${INFRA.pipe.lv[c.pipe || 0].n}<small>도로를 건설하여 교통 속도를 높이고 증기 배관을 건설하여 난방권을 더 크게 만드세요</small></span><i>></i></button>`;
    }
    if (b.type === 'tent') h += `<div class="row"><span>침대</span><span>${Sim.housingOf(b, S)}명 · 단열재 +${Sim.insulOf(b)}°</span></div>`;
    if (b.type === 'warehouse') h += `<div class="row"><span>저장량</span><span>각 자료의 최대 한도 ${fmt(cr.cap)}</span></div>`;
    if (b.type === 'tower') h += `<div class="row"><span>전력</span><span>${Math.round(Sim.towerPower(b.lvl))}</span></div>`;
    if (b.type === 'sledshed') h += this.shedHtml(b, c);
    if (b.type === 'heater') h += `<div class="row"><span>난방</span><span>+${Math.round(BLD.heater.heat * (1 + 0.5 * (b.lvl - 1)))}° · 연소 석탄 ${fmt(BLD.heater.burn * b.lvl)}/분</span></div>`;
    if (b.type === 'bay') h += this.bayHtml(b, c);
    if (b.type === 'kennel') {
      const n = Sim.kennelDogs(b.lvl), br = Sim.rt(S).b[b.id] || {}, all = Sim.dogsOf(S, c.id);
      h += `<div class="row"><span>썰매 개</span><span>${Math.round(br.dogs || 0)}/${n}썰매만 당길 수 있습니다 ·${b.workers ? `생고기를 먹어라${fmt(n * BLD.kennel.feed)}/가리키다${(br.fed ?? 1) < 0.95 ? '<b class="warn">먹지 않음</b>' : ''}` : '아무도 보고 있지 않습니다. 개는 스스로 음식을 찾기 위해 밖으로 나갔습니다.'}</span></div>`;
      h += `<div class="row sub"><span>전체야영지</span><span>${Math.round(all)}전용 → 정찰대+${Math.round(Sim.dogScout(S, c.id) * 100)}%${Sim.roadsAt(S, c.id).length ? `· 연결도로 용량 +${Math.round(Math.max(...Sim.roadsAt(S, c.id).map(r => Sim.roadDogs(S, r))) * 100)}%` : '· 도로 건설은 더 많은 교통수단을 가져올 것입니다'}</span></div>`;
      h += `<div class="hint">먹인 개 한 마리는 정찰대를 5% 더 빠르게 만들고(최대 +60%), 이 야영지로 이어지는 도로는 3% 더 빠릅니다(최대 +45%, 철도는 절반으로 줄임). </div>`;
    }
    if (b.type === 'infirmary') {
      const ward = Sim.wardOf(S, c), br = Sim.rt(S).b[b.id] || {}, nb = Sim.wardBeds(b.lvl), sickN = cr.sick || 0;
      h += `<div class="row"><span>병원 침대</span><span>${Math.round(br.pts || 0)}/${nb}장유유${(br.staff ?? 0) < 0.99 ? `<b class="warn">일손로는 충분하지 않습니다. 우리가 처리할 수 있는 것은${Math.floor(nb * (br.staff || 0))}장</b>` : ''}</span></div>`;
      h += `<div class="row sub"><span>Full야영지</span><span>환자${sickN}사람들${cr.treated ? `，${Math.round(cr.treated)}병원 침대에 누워 있는 사람` : ''}· 새로 아픈 사람 −${Math.round(Sim.WARD_GUARD * ward.guard * 100)}%${ward.care > 1.001 ? `· 의사는 복구를 더욱 빠르게 해줍니다.${Math.round((ward.care - 1) * 100)}%` : ''}</span></div>`;
      h += `<div class="hint">병원 침대에 있는 사람들은 밖이 춥고 피부가 팽팽해도 좋아지고 더 빨리 좋아집니다. 병원에 사는 사람들은 그렇게 걱정하지 않습니다. ${S.meta.specs.he ? '더 빨리 나아지려면 여기에 허 의원를 배열하십시오.' : '진료소가 열려 있고 누군가가 지키고 있습니다. 잠시 후 늙은 의사가 그와 함께 올 것입니다.'}</div>`;
    }
    if (d.cat === 'deco') {
      const one = Sim.decoOne(b), dh = Sim.decoHope(S, c), mx2 = Sim.bMax(S, b), sf = mx2 ? Math.min(1, b.workers / mx2) : 1;
      h += `<div class="row"><span>희망</span><span>이 건물 +${fmt(one * sf)}${sf < 1 ? `<b class="warn">예${mx2}누군가가 챙겨줄 때만 +${fmt(one)}</b>` : ''}</span></div>`;
      h += `<div class="row sub"><span>전체 야영지장식</span><span>합계 +${fmt(dh.v)} 희망(상한 ${Sim.DECO_CAP}, 더 많이 추가할수록 더 적게 추가됨)</span></div>`;
      h += `<div class="hint">장식은 아무것도 생성하지 않으며 민심을 더 밝게 만듭니다. 모두가 앞뒤로 걷는 길가나 용광로 옆에 배치할 수 있습니다. 업그레이드 레벨 1이 25% 더 많습니다. </div>`;
    }
    if (b.type === 'scout') {
      const sl = Sim.scoutSlots(S, c.id);
      h += `<div class="row"><span>정찰대</span><span>${sl.used}/${sl.n} 팀이 외부에 있습니다 · 가장 먼 ${Sim.scoutRange(S, c.id)} 블록</span></div>`;
      h += `<button class="btn wide" data-act="scoutpick">🚩 정찰대 보내기(지도에서 대상 클릭)</button>`;
    }
    // 专家
    const sid = Sim.specIn(S, b.id);
    const fits = SPECS.filter(sp => S.meta.specs[sp.id] && sp.aff.includes(b.type));
    if (sid || fits.length || Object.keys(S.meta.specs).length) {
      const sp = sid && SPECS.find(s => s.id === sid);
      h += `<div class="row"><span>전문가</span><span>${sp ? `${sp.n} <small>${S.meta.specs[sid].lvl}레벨 +${Math.round(Sim.specOf(S, b) * 100)}%</small> <button class="small" data-act="unspec" data-arg="${sid}">가주세요</button>` : `<select data-act="spec" data-arg="${b.id}"><option 값="">— 전문가 정렬 —</option>${SPECS.filter(s => S.meta.specs[s.id]).map(s => `<option value="${s.id}">${s.n}（${s.role}）${s.aff.includes(b.type) ? '★상대편' : ''}${S.specAt[s.id] ? '· 다른 곳' : ''}</option>`).join('')}</select>`}</span></div>`;
    }
    // 升级
    const cost = Sim.upgradeCost(S, b);
    const g = Sim.gateTier(b.type, b.lvl);
    h += `<div class="upbox"><div class="sec">업그레이드</div>`;
    { const nb = { ...b, lvl: b.lvl + 1 }, fx = [];
      if (d.out) fx.push(`생산량 ×${Sim.levelMul(b.lvl).toFixed(2)}→×${Sim.levelMul(b.lvl + 1).toFixed(2)}`);
      const m2 = Sim.maxWorkers(b.type, b.lvl + 1); if (m2 > mx) fx.push(`일자리 ${mx}→${m2}`);
      if (b.type === 'furnace') fx.push(`난방 +5°`, `반경 ${furnaceRadius(b.lvl)}→${furnaceRadius(b.lvl + 1)}`, '소비 연료 +17%');
      if (b.type === 'tent') fx.push(`침대 ${Sim.housingOf(b, S)}→${Sim.housingOf(nb, S)}`, `단열재 +${Sim.insulOf(b)}→+${Sim.insulOf(nb)}°`);
      if (b.type === 'tower') fx.push(`전력 ${Math.round(Sim.towerPower(b.lvl))}→${Math.round(Sim.towerPower(b.lvl + 1))}`);
      if (b.type === 'heater') fx.push('난방 +50%');
      if (b.type === 'scout') fx.push('+8 블록 더 이동');
      if (b.type === 'kennel') fx.push(`개 ${Sim.kennelDogs(b.lvl)}→${Sim.kennelDogs(b.lvl + 1)}`);
      if (b.type === 'infirmary') fx.push(`병원 침대 ${Sim.wardBeds(b.lvl)}→${Sim.wardBeds(b.lvl + 1)}`);
      if (d.cat === 'deco') fx.push(`희망 +${fmt(Sim.decoOne(b))}→+${fmt(Sim.decoOne(nb))}`);
      if (fx.length) h += `<div class="row sub"><span>효과</span><span>${fx.join(' · ')}</span></div>`; }
    { const same = b.type !== 'furnace' ? Sim.sameType(S, b) : [];
      if (same.length > 1) {
        const lv = same.map(x => x.lvl), lo = Math.min(...lv), hi = Math.max(...lv), qn = same.filter(x => x.qup).length;
        h += `<div class="row subbulkr"><span>유사${same.length}건물</span><span>${lo === hi ? `모두${lo}레벨` : `${lo}～${hi}레벨`}${qn ? ` · ${qn}줄서서 건물 짓기` : ''}<button class="bulkb" data-act="bulkup" data-arg="${b.id}">⬆ 각 건물 업그레이드</button></span></div>`;
      } }
    if (g > d.t) h += `<div class="row sub"><span>임계값</span><span>${b.lvl}레벨 이상에서 "${TIER_NAMES[g]}" 레이어의 ${RES[GATE[g]].n}${RES[GATE[g]].t > S.known ? '(아직 잠금이 해제되지 않았습니다)' : ''}를 사용해야 합니다</span></div>`;
    else { const nextGate = (Math.floor(b.lvl / GATE_EVERY) + 1) * GATE_EVERY; if (d.t < 7) h += `<div class="row sub"><span>임계값</span><span>${nextGate} 수준 이상에는 "${TIER_NAMES[d.t + 1]}" 수준의 ${RES[GATE[d.t + 1]].n} 필요</span></div>`; }
    h += `</div>`;
    if (b.type !== 'furnace' && !Sim.moveBlock(S, b)) h += `<button class="btn wide" data-act="movebld" data-arg="${b.id}">← 위치 이동 <small>재료 소비 불필요, 수평과 일꾼 모두 유지</small></button>`;
    if (b.type !== 'furnace') h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">철거(기본 자재 절반 반납)</button>`;
    // 升级按钮钉在面板底部，往下翻也一直看得到
    { const can = Sim.canAfford(c.stock, cost), locked = Object.keys(cost).some(k => RES[k].t > S.known);
      const btn = can ? `<button class="btn go" data-act="upgrade" data-arg="${b.id}">⬆ 업그레이드</button>`
        : locked ? `<button class="btn" data-act="upgrade" data-arg="${b.id}">⬆ 업그레이드</button>`
        : `<button class="btn qup ${b.qup ? 'on' : ''}" data-act="qup" data-arg="${b.id}" title="${b.qup ? '이미 대기열에 있음: 모든 재료를 사용할 수 있을 때 자동 업그레이드(취소하려면 클릭)' : '재료가 준비된 후 자동으로 업그레이드'}">${b.qup ? '⏳ 대기 중' : '⏳ 대기열 업그레이드'}</button>`;
      h += `<div class="pfoot"><span class="pfc"><small>${b.lvl + 1}${b.qup && !can ? '· 재료 도착 시 자동 업그레이드' : ''}</small><span>${costHtml(c.stock, cost, S.known)}</span></span>${btn}</div> 레벨로 업그레이드됨`; }
    return h;
  }

  // 烽火塔：地基 → 塔身（几种高级材料一起喂）→ 点火
  towerHtml(b, c, br) {
    const S = this.S, sp = Sim.towerSpec(S, b.tn), T = b.tw, st = T.lit ? 3 : T.p >= sp.dur ? 2 : 1;
    let h = `<div class="twsteps">${['기반', '타워 본체', '점화'].map((n, i) => `<span class="${i < st ? 'ok' : i === st ? 'on' : ''}">${i < st ? '✓' : i + 1} ${n}</span>`).join('<i>›</i>')}</div>`;
    const mm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (!T.lit) {
      h += `<div class="row"><span>타워</span><span>${mm(T.p)} / ${mm(sp.dur)} <small>(게임 시간)</small></span></div><div class="mbar tw"><i style="width:${(T.p / sp.dur * 100).toFixed(1)}%"></i></div>`;
      if (T.p < sp.dur) {
        for (const k of sp.kinds) { const short = br.status === '부족' + RES[k].n, have = c.stock[k] || 0, pr = Sim.prodRate(S, k);
          h += `<div class="row sub"><span>${RICON[k]} ${RES[k].n}</span><span>분당${fmt(sp.rate)} · 재고 ${fmt(have)} · 현재 생산 중 ${fmt(pr)}/분${short ? '<b class="warn">재고가 없어 타워가 주차되어 있습니다</b>' : pr < sp.rate ? '<b class="warn">탑을 먹는 것보다 아기가 태어나는 속도가 더 느립니다.</b>' : ''}</span></div>`; }
        h += `<div class="row sub"><span>교통</span><span>${(br.dist || 0).toFixed(1)} 그리드 · 운반꾼 ${fmt(br.haul || 0)}</span></div> 점유`;
        h += `<div class="hint">탑은 재료가 충분할 때만 위로 자랍니다. 하나라도 없으면 멈추긴 하지만 뒤로 돌아가지는 않습니다. 타워는 실제로 상품을 모두 소모하므로 생산 라인에는 마진이 있어야 합니다. 장의 생산력 목표는 총 생산량으로 계산되며 타워에 공급되는 것도 계산됩니다. </div>`;
        h += `<div class="row sub"><span>다음 대상</span><span>${costHtml(c.stock, sp.fuel, S.known)}</span></div>`;
      } else {
        const ck = Sim.towerIgniteCheck(S, b);
        h += `<div class="hint">타워 본체가 완성되었습니다. 연료를 뒤집어 점화하면 광선이 계속 켜져 있습니다. </div>`;
        h += `<div class="pfoot"><span class="pfc"><small>다음으로 시작</small><span>${costHtml(c.stock, sp.fuel, S.known)}</span></span><button class="btn go" data-act="ignite" data-arg="${b.id}" ${ck.ok ? '' : 'disabled'}>🔥 시작</button></div>`;
      }
    } else {
      h += `<div class="row"><span>이미 켜짐</span><span>${fmtTime(S.t - (T.litT || S.t))} 전</span></div>`;
      h += `<div class="row sub"><span>효과</span><span>「${esc(c.name)}」희망 +${TOWER_FX.hope} · 난방권 +${TOWER_FX.warm} 그리드(이 야영지만)</span></div>`;
      h += `<div class="hint">타워 꼭대기의 광선은 항상 켜져 있으며 야영지가 뒤에 남아 있든 꺼져 있든 상관 없습니다. 남쪽을 보면 이전 탑의 빛이 보입니다. </div>`;
    }
    h += `<div class="row sub"><span>북방의 탑</span><span>${Sim.towersLit(S)} / ${Sim.TOWER_N} 블록이 켜졌습니다</span></div>`;
    if (!Sim.moveBlock(S, b)) h += `<button class="btn wide" data-act="movebld" data-arg="${b.id}">← 위치 이동 <small>타워가 커지기 전에는 이동할 수 있습니다</small></button>`;
    if (!T.lit && !T.p) h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">기초 제거(재료의 절반 반환)</button>`;
    return h;
  }

  // 1.1 奇观工地：三期进度、这一期每种料吃多少、缺什么
  wonderHtml(b, c, br) {
    const S = this.S, W = WONDERS[b.type], wd = b.wd || { ph: 0, p: 0 }, done = Sim.wonderDone(b);
    let h = `<div class="twsteps">${WONDER_PH.map((P, i) => `<span class="${i < wd.ph ? 'ok' : i === wd.ph ? 'on' : ''}">${i < wd.ph ? '✓' : i + 1} ${P.n}</span>`).join('<i>›</i>')}</div>`;
    h += `<div class="row nw"><span>효과</span><span>${esc(W.d)}<br><small>이 프로세스는 완료 후 항상 유효하며 모든 야영지가 계산됩니다</small></span></div>`;
    if (!done) {
      const sp = Sim.wonderSpec(b.type, wd.ph), mul = Sim.feedMul(S, c), left = 1 - wd.p / sp.dur;
      h += `<div class="row"><span>${sp.n}</span><span>${Math.floor(wd.p / sp.dur * 100)}%<small>· 모두${Math.floor(Sim.wonderProg(b) * 100)}%${mul > 1 ? `· 건설 ×${fmt(mul)}` : ''}</small></span></div><div class="mbar tw"><i style="width:${(wd.p / sp.dur * 100).toFixed(1)}%"></i></div>`;
      for (const k of sp.kinds) {
        const short = br.status === '부족' + RES[k].n, have = c.stock[k] || 0, pr = Sim.prodRate(S, k), r = sp.rate[k] * mul;
        h += `<div class="row sub"><span>${RICON[k]} ${RES[k].n}</span><span>추가 ${fmt(sp.amt[k] * left)} · 분당 ${fmt(r)} · 재고 ${fmt(have)} · 현재 생산량 ${fmt(pr)}/분${short ? '<b class="warn">품절, 건설현장 주차</b>' : pr < r && have < sp.amt[k] * left ? '<b class="warn">건설현장에서 먹는 것보다 생산이 느리다</b>' : ''}</span></div>`;
      }
      h += `<div class="row sub"><span>교통</span><span>${(br.dist || 0).toFixed(1)} 그리드 · 운반꾼 ${fmt(br.haul || 0)}</span></div> 점유`;
      const nx = WONDER_PH.map((P, i) => i > wd.ph ? `${P.n}：${Object.entries(W.ph[i]).map(([k, v]) => `${RICON[k]}${fmt(v)}`).join(' ')}` : '').filter(Boolean);
      if (nx.length) h += `<div class="row sub"><span>뒤</span><span>${nx.join('<br>')}</span></div>`;
      h += `<div class="hint">건설 현장은 자재가 충분할 때만 진행됩니다. 하나라도 없으면 멈추긴 하지만 뒤로 돌아가지는 않습니다. 물류망은 이 기간에 필요한 자료를 여기로 보내드립니다. 도시 건설이 25% 빨라지고, "전원 일심" 주문이 3배 빨라집니다. </div>`;
    } else {
      const w = Sim.wonderList(S).find(x => x.w === b.type);
      h += `<div class="row"><span>완료</span><span>${w ? fmtTime(S.t - w.t) + '앞으로' : ''}</span></div>`;
      if (b.type === 'wcolossus') h += `<div class="row sub"><span>오늘</span><span>${Sim.colossusReady(S) ? '습격를 한 번 놀라게 할 수도 있습니다.' : '이미 조치를 취했습니다. 내일 다시 오세요.'}</span></div>`;
      h += `<div class="hint">야영지가 꺼지고 떠났지만 불가사의는 여전히 여기에 서 있고 효과는 항상 존재합니다. </div>`;
    }
    if (!Sim.moveBlock(S, b)) h += `<button class="btn wide" data-act="movebld" data-arg="${b.id}">← 위치 이동 <small>작업을 시작하기 전에도 이동할 수 있습니다</small></button>`;
    if (!wd.ph && !wd.p) h += `<button class="btn wide ghost" data-act="demolish" data-arg="${b.id}">공사장 철거(자재 절반 반납)</button>`;
    return h;
  }
  // 建造 › 奇观：六种奇观，有没有图纸、在哪儿建的、建到哪了
  p_wonder(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return `불가사의 <small>각 여행 유형당 하나 · 최대 하나의 야영지</small>`;
    let h = `<div class="hint">불가사의는 3단계로 구성되며 운반꾼은 자재를 건설 현장에 조금씩 전달합니다. 완료되면 이 프로세스가 적용되고 모든 야영지가 계산되며 야영지는 중단되더라도 손실되지 않습니다. 도면은 연구 "불가사의 도면 1 / 2"에서 가져온 것이며 북방 및 기연의 분기도 전송됩니다. </div>`;
    const here = Sim.wonderIn(S, c.id);
    let cards = '';
    for (const k of WONDER_KEYS) {
      const W = WONDERS[k], built = Sim.wonderList(S).find(x => x.w === k), b = S.buildings.find(x => x.type === k), have = Sim.bpHave(S, k);
      const where = id => esc((Sim.getCamp(S, id) || { name: '정지된 야영지' }).name);
      const st = built ? `✓ 완료됨 · ${where(built.camp)}` : b ? `${Math.floor(Sim.wonderProg(b) * 100)}% · ${where(b.camp)} 공사 중` : have ? (here ? `이 야영지에는 이미 ${BLD[here.type].n}이(가) 있습니다. 또 다른 야영지를 만들어 보겠습니다.` : '도면이 있고 위치를 선택할 수 있습니다.') : `아직 그림이 없습니다(${W.tech === 'wonder1' ? '불가사의 도면 1' : '불가사의 도면 2'}).`;
      const act = b ? `data-act="openbld" data-arg="${b.id}"` : !built && have && !here ? `data-act="place" data-arg="${k}"` : '';
      const tot = {}; for (const P of W.ph) for (const r in P) tot[r] = (tot[r] || 0) + P[r];
      cards += `<div class="card ${!have && !built ? 'locked' : ''} ${built ? 'on' : ''}" ${act}>
        <div class="ci pic">${this.ico(k, 4)}</div>
        <div class="cb"><div class="cn">${W.n}</div><div class="cd">${esc(W.d)}</div>
        <div class="cc">${esc(st)}</div>
        ${!built ? `<div class="cio"><small>총 3단계 </small>${Object.keys(tot).sort((a, b) => RES[a].t - RES[b].t).map(r => RICON[r] + fmt(tot[r])).join(' ')}</div>` : ''}</div></div>`;
    }
    return h + `<div class="cards">${cards}</div>`;
  }
  // 营地 › 概况：炉火鼎盛.这座营地的产线全稳在三星，产量 +25%，炉火变金色
  peakHtml(c) {
    const S = this.S, V = Sim.peakView(S, c);
    if (!V.lines.length) return '';
    const n3 = V.lines.filter(l => l.star >= 3 && (l.on || l.slow < Sim.PEAK.grace)).length;
    let h = `<div class="sec">불의 화로 <small>${V.on ? '<b class="ok">굽는 중</b>' : `${n3}/${V.lines.length}삼성에서 안정적`}</small></div>`;
    h += `<div class="hint">${V.on ? `이 야영지의 생산 라인은 삼성이 전적으로 소유하고 있습니다. 야영지생산량 +${Sim.PEAK.prod * 100}%, 용광로 화재가 금색로 연소되었습니다. 별 3개 수준(속도가 목표보다 낮고 초과)에 해당하는 선은 무엇입니까?${Sim.PEAK.grace}초) 피크가 소멸됩니다.` : `이번 야영지(업스트림 포함)가 사용하는 생산 라인은 모두 삼성이며 속도는 목표 이상이다.${V.lines.length < V.need ? `, 그리고 적어도${V.need}조각` : ''}, 화재가 본격화됩니다 : 야영지생산량 +${Sim.PEAK.prod * 100}%, 불은 금색가 됩니다.`}</div>`;
    h += `<div class="pklines">${V.lines.map(l => { const ok = l.star >= 3 && (l.on || l.slow < Sim.PEAK.grace); return `<button class="pkl ${ok ? 'ok' : l.star >= 3 ? 'slow' : ''}" data-act="plan" data-arg="${l.r}">${RICON[l.r]} ${RES[l.r].n}<i>${'★'.repeat(l.star)}${'☆'.repeat(3 - l.star)}</i>${l.star >= 3 && !l.on ? '<small>속도가 충분하지 않습니다</small>' : ''}</button>`; }).join('')}</div>`;
    return h;
  }
  // 营地 › 概况：城镇.人够、希望够就能升一级（升了不会降）
  townHtml(c) {
    const S = this.S, t = Sim.townOf(c), nx = Sim.townNext(c), why = Sim.townBlock(S, c);
    if (c.depot) return '';
    let h = `<div class="sec">타운 <small>현재 ${TOWN[t].n}</small></div>`;
    if (!t && !Sim.techDone(S, 'townplan')) return h + `<div class="hint">연구 "도시 계획" 이후 야영지는 ${TOWN[1].pop}명의 사람이 있고 희망 ${TOWN[1].need} 이상이면 마을로 업그레이드할 수 있습니다. 천막은 목조 주택으로 전환할 수 있고 가로등은 문에서 클릭할 수 있으며 침대 수는 +20%가 됩니다. </div>`;
    h += `<div class="twsteps">${TOWN.map((T, i) => `<span class="${i <= t ? 'ok' : i === t + 1 ? 'on' : ''}">${this.cIco('town_' + i, i <= t ? '✓ ' : '')}${T.n}</span>`).join('<i>›</i>')}</div>`;
    for (let i = 1; i <= t; i++) h += `<div class="row sub"><span>${TOWN[i].n}</span><span>${TOWN[i].d}</span></div>`;
    if (nx) {
      h += `<div class="row"><span>${nx.n}<br><small>${nx.d}</small></span><span>👥 ${c.people} / ${nx.pop}<br>희망 ${Math.round(c.hope ?? 50)} / ${nx.need}</span></div>으로 업그레이드됨`;
      h += `<button class="btn wide tl ${why ? '' : 'go'}" data-act="townup" data-arg="${c.id}" ${why ? 'disabled' : ''}>승진${nx.n}${why ? `<small>${esc(why)}</small>` : '<small>행사를 열고 모두가 30초 동안 일을 멈추고 불꽃놀이를 감상합니다.</small>'}</button>`;
    } else h += `<div class="hint">이미 대도시입니다. 시립 선물 가방이 매일 배달됩니다. </div>`;
    return h;
  }

  // ---------- 物资总览：每种物资的进出、卡在哪一环 ----------
  reqWho(r) { return personOf({ k: 'r', i: r.id, camp: r.camp }); }
  // 人物委托：谁、想要什么、做到哪了、给什么
  p_req(part) {
    const S = this.S, L = S.reqs || [];
    if (part === 'title') return `커미션 <small>야영지 사람들의 작은 소망</small>`;
    if (!L.length) return `<div class="empty">지금은 요청하는 사람이 없습니다. 플레이할 때, 야영지의 사람들이 가끔씩 당신을 돕기 위해 당신에게 올 것입니다. </div>`;
    const sel = this.panel.arg;
    let h = '';
    for (const r of [...L].sort((a, b) => (b.id === sel) - (a.id === sel))) {
      const p = this.reqWho(r), pr = Sim.reqProgress(S, r), c = Sim.getCamp(S, r.camp), rw = r.rw || {};
      const rwTxt = [...Object.keys(rw.res || {}).map(k => `${RICON[k]}${fmt(rw.res[k])}`), rw.embers ? `잔불 +${rw.embers}` : '', rw.hope ? `희망 +${rw.hope}` : '', rw.disc ? `불만 ${rw.disc}` : ''].filter(Boolean).join(' · ');
      const quote = { build: `야영지에 ${BLD[r.type]?.n} 좌석이 있으면 좋을 것 같아요.`, upgrade: `${BLD[r.type]?.n}이 더 좋다면 우리는 그렇게 열심히 일할 필요가 없을 것입니다.`, stock: `${RES[r.k]?.n}를 모아서 모두를 위해 무언가를 준비하고 싶습니다.`, beds: `오두막집은 너무 혼잡합니다. 누구나 침대를 가질 수 있나요?` }[r.kind];
      const go = r.kind === 'build' ? `<button class="small" data-act="place" data-arg="${r.type}">빌드로 이동</button>` : r.kind === 'upgrade' ? `<button class="small" data-act="reqgo" data-arg="${r.bid}">보기 이 건물</button>` : r.kind === 'beds' ? `<button class="small" data-act="place" data-arg="tent">천막 빌드</button>` : '';
      h += `<div class="reqcard ${pr.done ? 'done' : ''} ${r.id === sel ? 'sel' : ''}"><div class="rqhead"><span class="rqav">${esc(p.name.slice(0, 1))}</span><span><b>${esc(p.name)}</b><small>${p.age}나이 ·${esc(p.trait)} · ${esc(c ? c.name : '')}</small></span><small class="rqt">${fmtTime(Math.max(0, r.until - S.t))}</small></div>
        <div class="rqq">「${esc(quote)}」</div>
        <div class="rqgoal"><b>${esc(Sim.reqTitle(S, r))}</b><span class="rqbar"><i style="width:${(pr.cur / pr.need * 100).toFixed(0)}%"></i></span><small>${fmt(pr.cur)} / ${fmt(pr.need)}</small></div>
        <div class="rqrw"><span>반환:${rwTxt}</span><span class="rqbtn">${pr.done ? `<button class="small go" data-act="reqok" data-arg="${r.id}">${r.kind === 'stock' ? '넘겨주다' + (p.name.length > 2 ? p.name.slice(1) : p.name) : '말하다' + (p.name.length > 2 ? p.name.slice(1) : p.name)}</button>` : go}<button class="small ghost" data-act="reqno" data-arg="${r.id}" title="걱정하지 마세요. 잠시 후 다른 일이 있을 것입니다.">잊으세요</button></span></div></div>`;
    }
    h += `<div class="note">커미션은 플레이할 때만 표시되며 한 번에 최대 2개까지 표시됩니다. 1시간 이내에 완료하지 않으면 상대방이 약간 실망하게 됩니다(희망-2). </div>`;
    return h;
  }
  p_stock(part) {
    const S = this.S, c = this.camp(), R = Sim.rt(S), cr = R.c[c.id] || {}, flow = cr.flow || {}, cap = cr.cap || 0;
    if (part === 'title') return `소모품 <small>${esc(c.name)} · 각 유형당 최대 ${fmt(cap)}</small>`;
    const bs = S.buildings.filter(b => b.camp === c.id);
    const full = [], miss = {}, idle = [], depl = [];
    for (const b of bs) {
      const st = (R.b[b.id] || {}).status; if (!st) continue;
      if (st === '창고가 가득 참') full.push(b);
      else if (st.startsWith('부족')) (miss[st.slice(3).trim()] ||= []).push(b);
      else if (st === '일손 미배치' || st === '일하는 사람 없음') idle.push(b);
      else if (st.includes('고갈')) depl.push(b);
    }
    const maker = k => Object.keys(BLD).filter(t => BLD[t].out && BLD[t].out[k] && BLD[t].t <= S.known);
    const auto = Sim.depotAuto(c);
    const btn = (t, label) => auto ? '' : `<button class="small go" data-act="place" data-arg="${t}">${label || '설립하다' + BLD[t].n}</button>`;
    const issues = [];
    // 补给站自己运转：这里的「卡在哪」只是看看，要动手先临时接手
    if (auto) issues.push({ sev: 9, html: `<div class="issue"><span class="ii">📦</span><span class="it"><b>"${esc(c.name)}"은 공급 스테이션입니다.</b><small>자체 일손 배치, 자체 생산이 있으며 새 집을 짓지 않습니다. 아래 부족한 부분을 보완해야 하므로 임시 인수</small></span><span class="ia"><button class="small" data-act="dtake" data-arg="${c.id}:1">임시 인수</button></span></div>` });
    // 缺料：用它的建筑想要的比实际拿到的多
    for (const k of RES_KEYS) {
      const f = flow[k]; if (!f || f.want <= 0.05) continue;
      const gap = f.want - f.c; if (gap < Math.max(0.05, f.want * 0.08)) continue;
      const who = miss[RES[k].n] || [];
      const mk = maker(k);
      const sev = gap / f.want;
      const whoTxt = k === 'food' ? '먹을 만큼 부족한 사람은 없다' : who.length ? `${[...new Set(who.map(b => BLD[b.type].n))].join('、')}이(가) 기다리고 있습니다` : FUEL[k] && cr.fueled < 1 ? '용광로연료로는 충분하지 않습니다' : '그 건물이 기다리고 있습니다';
      issues.push({ sev: 1 + sev - RES[k].t * 0.001 + (RES[k].raw ? 0.0005 : 0), html: `<div class="issue bad"><span class="ii">${RICON[k]}</span><span class="it"><b>${RES[k].n}</b> 누락: ${whoTxt}, 분당 ${Math.round((1 - sev) * 100)}%<small>${fmt(f.want)}만 출력, ${fmt(f.p)}</small></span><span class="ia">${mk.length ? btn(mk[0]) : ''}</span></div>` });
    }
    if (cr.hf != null && cr.hf < 0.85) issues.push({ sev: 1.5, html: `<div class="issue bad"><span class="ii">🛷</span><span class="it"><b>운반꾼 부족</b>: 비용은 ${fmt(cr.demand)}명이며, 창고에서 ${fmt(cr.haulers)}<small>일자리만 운반꾼이고, 멀리 있는 건물은 더 비쌉니다.</small></span><span class="ia">${btn('warehouse')}</span></div>` });
    if (full.length) {
      const ks = [...new Set(full.flatMap(b => Object.keys(BLD[b.type].out || {})))].filter(k => (c.stock[k] || 0) >= cap * 0.97);
      issues.push({ sev: 1.2, html: `<div class="issue warning"><span class="ii">📦</span><span class="it"><b>${ks.map(k => RICON[k] + RES[k].n).join('、') || '창고'}이 가득 찼습니다</b>: ${full.length}개 건물이 작동하지 않습니다<small>업그레이드 이상 창고는 더 많이 넣을 수 있습니다. 아래에서 '만재 자동 교환'을 설정할 수도 있습니다.</small></span><span class="ia">${btn('warehouse', '창고 빌드')}</span></div>` });
    }
    if (idle.length) issues.push({ sev: 1.1, html: `<div class="issue warn"><span class="ii">👷</span><span class="it"><b>${idle.length}건물에서 작업하는 사람은 없습니다.</b><small>${c.auto === false ? '자동 일손 배치가 닫힙니다.' : '무료 일손가 충분하지 않습니다. 천막를 더 많이 구축하고 요리를 충분히 준비하면 사람들이 여러분과 함께 올 것입니다.'}</small></span><span class="ia">${c.auto === false ? `<button class="small go" data-act="auto" data-arg="${c.id}">자동 일손 배치 켜기</button>` : btn('tent')}</span></div>` });
    if (c.wait > 0) issues.push({ sev: 1.15, html: `<div class="issue warning"><span class="ii">⛺</span><span class="it"><b>${c.wait} 침대를 기다리는 사람들</b><small>침대가 가득 차면 새로 도착한 사람들은 일도 하지 않고 오두막에서 기다립니다. Duogai 또는 업그레이드천막, 그들은 혼자 살 것입니다</small></span><span class="ia">${btn('tent', '천막 빌드')}</span></div>` });
    if (depl.length) { const wood = depl.some(b => b.type === 'lumber'); issues.push({ sev: 1, html: `<div class="issue"><span class="ii">⛏</span><span class="it"><b>${depl.length}채집 건물 근처 지역이 채굴되었습니다</b><small>${wood ? '근처에 나무가 없으면 조림장를 만들고 직접 나무를 심을 수 있습니다.' : ''}광산에서 채석장는 깊은 우물을 파고 계속 파낼 수 있으며, 정찰 막사는 탐사 팀을 보내 새로운 광맥을 찾을 수도 있습니다.</small></span>${wood ? `<span class="ia">${btn('nursery')}</span>` : ''}</div>` }); }
    if ((c.disc ?? 0) >= 60) issues.push({ sev: 1.3, html: `<div class="issue ${(c.disc ?? 0) >= Sim.LEAVE_AT ? 'bad' : 'warn'}"><span class="ii">💢</span><span class="it"><b>불만 ${Math.round(c.disc)}</b>: 작업 속도가 느려집니다 ${(c.disc ?? 0) >= Sim.LEAVE_AT ? ', 누군가 떠나고 있어요' : ''}<small>보기 모두가 불만인 이유는 민심을 달래기 위한 법령에 서명할 수도 있습니다</small></span><span class="ia"><button class="small go" data-act="tb" data-arg="mood">민심</button></span></div>` });
    issues.sort((a, b) => b.sev - a.sev);
    // 库存：一格一种，按层分组；红框缺、黄框满，点一格看曲线
    const ri = this.resInfo(c, cr, RES_KEYS.filter(k => RES[k].t <= S.known && ((c.stock[k] || 0) >= 1 || (flow[k] && (flow[k].p > 0.01 || flow[k].c > 0.01 || flow[k].want > 0.01)) || RES[k].t <= 1)));
    // 卡住的排最上面；顺畅就只在库存下面写一行
    const real = issues.filter(i => i.sev < 9);
    let h = real.length ? `<div class="sec">걸림 · ${real.length}</div>` + issues.slice(0, 6).map(i => i.html).join('') : issues.map(i => i.html).join('');
    const pins = this.g.pc && this.g.pc.on ? this.g.pc.pinList() : null; // 电脑版：每格右上角一枚图钉，钉住的显示在顶栏
    h += `<div class="sec">인벤토리 <small>아래 숫자는 ${pins ? '· 압정을 클릭하면 상단바에 고정됩니다. (최대 5개 항목)' : ''}</small></div>의 분당 순 변화입니다.`; let tier = 0;
    for (const r of ri) {
      const tt = RES[r.k].t;
      if (tt !== tier) { h += (tier ? '</div>' : '') + `<div class="stier">${TIER_NAMES[tt]}</div><div class="rgrid">`; tier = tt; }
      const nc = r.net < -0.05 ? 'neg' : r.net > 0.05 ? 'pos' : '';
      h += `<button class="rgc ${r.short ? 'short' : r.full ? 'full' : ''}" data-act="curve" data-arg="${r.k}" style="--f:${(r.fr * 100).toFixed(1)}%" title="${RES[r.k].n}:생산하다${fmt(r.f.p)}· 사용${fmt(r.f.c)}/ 분 (곡선을 보려면 클릭하세요)">${pins ? `<span class="rpin ${pins.includes(r.k) ? 'on' : ''}" data-act="pin" data-arg="${r.k}" title="${pins.includes(r.k) ? '상단바에서 삭제' : '상단 표시줄에 고정'}">${ico('i', 'pin')}</span>` : ''}<span class="ri">${RICON[r.k]}</span><span class="rn">${RES[r.k].n}${r.short ? '<em>누락</em>' : r.full ? '<em>전체</em>' : ''}</span><b>${fmt(r.have)}</b><small class="${nc}">${r.act ? (r.net >= 0 ? '+' : '') + fmt(r.net) : '—'}</small><i></i></button>`;
    }
    if (tier) h += '</div>';
    if (!real.length) h += `<div class="issue ok"><span class="ii">✓</span><span class="it"><b>생산은 매우 원활합니다</b><small>자재 부족, 작업 중단 또는 인력 부족 없음</small></span></div>`;
    // 加工留料
    const kp = c.keep !== false;
    h += `<div class="sec">가공 고정 재료</div>`;
    h += `<div class="row"><span>${kp ? '이미 켜져 있음' : '닫은'}<br><small>제재소는 모든 목재를 목판으로 보지 않으며, 제강소는 철괴를 사용하지 않습니다: 목재, 철괴 이러한 기본 건축 자재, 창고는 건설을 위해 ${fmt(Math.min(Sim.KEEP_MAX, cap * Sim.KEEP_FRAC))}을 남깁니다. </small></span><span style="flex:none"><button class="small ${kp ? 'go' : ''}" data-act="keep" data-arg="${c.id}">${kp ? '폐쇄' : '켜다'}</button></span></div>`;
    // 满仓兑换
    h += `<div class="sec">만재 자동 교환</div>`;
    h += `<div class="row"><span>${c.trade ? '이미 켜져 있음' : '닫은'}<br><small>창고가 가득 참은 전원을 켠 후에도 작동이 멈추지 않으며 초과분은 가격의 30%를 야영지에 가장 부족한 수준 이하의 재료로 교환됩니다. </small></span><span style="flex:none"><button class="small ${c.trade ? 'go' : ''}" data-act="trade" data-arg="${c.id}">${c.trade ? '폐쇄' : '켜다'}</button></span></div>`;
    const tl = Object.entries(cr.trade || {}).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]);
    if (tl.length) h += `<div class="row sub"><span>사용</span><span>${tl.slice(0, 4).map(([q, v]) => { const [a, b] = q.split('>'); return `${RICON[a]}→${RICON[b]} ${fmt(v)}/가리키다`; }).join(' · ')}</span></div>`;
    return h;
  }

  pf_stock() { return '<button class="btn" data-act="curve">📈 데이터 곡선</button><button class="btn go" data-act="chainmap">🔗 생산 체인 개요</button>'; }

  // ---------- 一个人 ----------
  p_person(part) {
    const S = this.S, info = this.panel.arg, R = Sim.rt(S), p = personOf(info);
    if (part === 'title') return `${p.name} <small>${p.age}세 · ${p.from}</small>부터`;
    const sc = info.k === 's' ? S.scouts.find(x => x.id === info.sid) : null;
    const ps = personState(S, info, p, R, { scoutTemp: sc ? baseTempOfRow(sc.y) : undefined, feast: Sim.activeBuffs(S, Sim.getCamp(S, info.camp) || this.camp()).some(b => b.k === 'prod' && b.v > 0), night: this.g.view.nf > 0.5, aurora: this.g.view.aur > 0.4, icefog: this.g.view.ice > 0.4 });
    const warm = ps.t >= 10 ? '따뜻한' : ps.t >= 0 ? '조금 추워요' : '추위에 떨다';
    let h = `<div class="pquote">「${esc(ps.quote)}」</div>`;
    h += `<div class="row"><span>뭐하고 있어요</span><span>${esc(ps.role)}</span></div>`;
    h += `<div class="row"><span>거주지</span><span>${info.k === 's' ? '야생에서' : ps.housed ? '천막에서 라이브' : '<b class="warn">침대 없음, 밖에서 자세요</b>'}</span></div>`;
    h += `<div class="row"><span>차갑고 따뜻함</span><span class="${ps.t < 0 ? 'neg' : ''}">${warm} · 체감 ${ps.t}°</span></div>`;
    h += `<div class="row"><span>식사</span><span>${ps.hungry ? '<b class="warn">배가 고프다</b>' : '잘 먹다'}</span></div>`;
    h += `<div class="row"><span>본문</span><span>${ps.sick ? '<b class="warn">열이 나네요. 조금만 기다려주세요</b>' : '질병이나 재난이 없을 것'}</span></div>`;
    h += `<div class="row"><span>기분</span><span>${ps.mood}</span></div>`;
    h += `<div class="row sub"><span>문자</span><span>${p.trait}</span></div>`;
    if (info.b != null && Sim.getB(S, info.b)) h += `<button class="btn wide" data-act="openbld" data-arg="${info.b}">${BLD[Sim.getB(S, info.b).type].n} 보기</button>`;
    h += `<div class="hint">야영지의 사람들은 춥고 배고플 것입니다. 체온이 2° 미만이거나 충분히 먹지 않으면 누군가 병에 걸릴 것입니다. 환자는 작동할 수 없으며 따뜻하고 배가 부르면 천천히 좋아집니다. </div>`;
    return h;
  }

  // ---------- 消息记录 ----------
  p_log(part) {
    const S = this.S, f = this.logF || 'all';
    if (part === 'title') return `메시지 <small>지난 ${S.log.length}</small>`;
    const si = this.logOpenSeen ? S.log.lastIndexOf(this.logOpenSeen) : S.log.length - 1;
    const ago = dt => dt < 60 ? '단지' : dt < 3600 ? `${Math.floor(dt / 60)}분 전` : dt < 86400 ? `${Math.floor(dt / 3600)}시간 전` : `${Math.floor(dt / 86400)}일 전`;
    const pick = l => f === 'all' || (f === 'hot' ? l.kind === 'bad' || l.kind === 'warn' : l.kind === 'story' || l.kind === 'good');
    let h = `<div class="lfil">${[['all', '모두'], ['hot', '중요한'], ['story', '이야기와 수확']].map(([k, n]) => `<button class="${f === k ? 'on' : ''}" data-act="logf" data-arg="${k}">${n}</button>`).join('')}</div>`;
    // 连续相同的合并；按「今天 / 昨天 / 更早」分段（游戏里的天）
    const rows = [];
    for (let j = S.log.length - 1; j >= 0; j--) {
      const l = S.log[j];
      if (!pick(l)) continue;
      const last = rows[rows.length - 1];
      if (last && last.msg === l.msg && last.kind === l.kind) { last.n++; continue; }
      rows.push({ ...l, n: 1, isNew: j > si });
    }
    if (!rows.length) return h + `<div class="hint">아직 소식이 없습니다. </div>`;
    let day = null;
    h += '<div class="lrows">';
    for (const r of rows) {
      const dd = Math.floor((S.t - r.t) / 86400), dn = dd <= 0 ? '오늘' : dd === 1 ? '어제' : `${dd}일 전`;
      if (dn !== day) { day = dn; h += `</div><div class="lday">${dn}</div><div class="lrows">`; }
      h += `<div class="lrow ${r.kind}${r.isNew ? ' new' : ''}"><span class="lm">${esc(r.msg)}${r.n > 1 ? `<b class="tn">×${r.n}</b>` : ''}</span><small>${ago(S.t - r.t)}</small></div>`;
    }
    return h + '</div>';
  }

  // 营地 › 概况：各营地一张卡、补给站、专精、基建
  p_camp(part) {
    const S = this.S;
    if (part === 'title') return `야영지 <small>${esc(this.camp().name)}</small>`;
    let h = '';
    if (this.camp().depot) h += this.depotHtml(this.camp()); // 补给站：先说它自己的事，手机上不用往下翻
    h += this.netRow(this.camp());
    for (const c of S.camps) {
      const cr = Sim.rt(S).c[c.id] || {};
      const f = Sim.getB(S, c.furnace);
      h += `<div class="card ${c.id === S.active ? 'on' : ''}" data-act="campgo" data-arg="${c.id}"><div class="ci">🔥</div><div class="cb">
        <div class="cn">${esc(c.name)}<small>용광로${f.lvl}고도·위도${Math.round(c.y)}</small>${Sim.campSpecOf(c) ? `<i class="spec-tag">전문 분야·${Sim.campSpecOf(c).n}</i>` : ''}${c.town ? `<i class="spec-tag">${TOWN[Sim.townOf(c)].n}</i>` : ''}</div>
        <div class="cd">👥${c.people}/${cr.housing || 0} · 🌡${Math.round(cr.tH ?? 0)}° · 🍖${fmt(c.stock.food)}（${(cr.foodNet || 0) >= 0 ? '+' : ''}${fmt(cr.foodNet)}/분)·🔥${cr.burnPerMin ? fmtTime(cr.fuelUnits / cr.burnPerMin * 60) : '—'}· 운송${fmt(cr.haulers)}/${fmt(cr.demand)}·방어${Sim.campDefense(S, c)}</div></div></div>`;
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
    const v = this.specPct(), what = t => (t === 'workshop' ? '연구' : t === 'tower' ? '힘' : t === 'heater' ? '열' : '생산량');
    const why = NORTH_RULES[c.spec] ? `${NORTH_RULES[c.spec].n}의 지형` : SPOTS[c.spec] ? `난방권에는 다른 곳보다 ${SPOTS[c.spec].n}이(가) 더 많습니다.` : '';
    let h = `<div class="sec">야영지 특수 <small>야영지가 빌드될 때 결정되었으며 변경되지 않습니다</small></div>`;
    h += `<div class="row"><span>${esc(sp.n)}<br><small>${why}</small></span><span>${sp.b.map(t => `${BLD[t].n} ${what(t)} +${v}%`).join('<br>')}</span></div>`;
    return h;
  }
  // 营地 › 人手：住的、病的、饿的；哪类建筑缺几个人，一键派满
  p_folk(part) {
    const S = this.S, c0 = this.camp(), cr0 = Sim.rt(S).c[c0.id] || {}, R = Sim.rt(S);
    if (part === 'title') return `일손 <small>${esc(c0.name)}</small>`;
    const bay0 = c0.bots ? S.buildings.find(b => b.camp === c0.id && b.type === 'bay') : null;
    const botRow = c0.bots ? `<div class="row"><span>오토마톤${c0.bots}대만<br><small>노동${c0.bots - (c0.botH || 0) - (c0.botM || 0)}· 운송${c0.botH || 0}· 추출${c0.botM || 0}. 원톱${Sim.botPow(S)}개인적으로 저는 먹기 싫고, 추위도 두렵지 않습니다. </small></span>${bay0 ? `<span style="flex:none"><button style="white-space:nowrap" class="small" data-act="openbld" data-arg="${bay0.id}">모델 변경</button></span>` : ''}</div>` : '';
    let h = `<div class="folk"><span><b>${c0.people}</b>사람</span><span><b>${Math.max(0, Sim.idleLabor(S, c0))}</b>유휴</span><span><b>${Math.min(c0.people, cr0.housing || 0)}</b>천막에서 라이브</span><span class="${c0.people > (cr0.housing || 0) ? 'bad' : ''}"><b>${Math.max(0, c0.people - (cr0.housing || 0))}</b>외박</span>${c0.wait > 0 ? `<span class="bad"><b>${c0.wait}</b>침대를 기다리는 중</span>` : ''}${cr0.sick ? `<span class="bad"><b>${cr0.sick}</b>아프다</span>` : ''}${(cr0.hunger || 0) > 0.05 ? `<span class="bad"><b>${Math.round(cr0.hunger * 100)}%</b>배가 고프다</span>` : ''}</div>`;
    h += botRow;
    h += `<div class="row"><span>자동 일손 배치<br><small>새로 도착한 사람은 사람이 부족한 건물로 자동으로 이동합니다(식사 및 난방 우선). 수동으로 인구를 제거한 건물은 사람으로 채워지지 않습니다. </small></span><span style="flex:none"><button style="white-space:nowrap" class="small ${c0.auto === false ? '' : 'go'}" data-act="auto" data-arg="${c0.id}">${c0.auto === false ? '닫은' : '이미 켜져 있음'}</button></span></div>`;
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
      h += `<div class="sec">여러 건물의 일손 <small>실종자가 가장 많은 건물이 앞쪽에 있습니다</small></div><div class="wtab">`;
      for (const g of rows) {
        const d = BLD[g.b.type], miss = g.mx - g.w;
        h += `<div class="wrow ${miss > 0 ? 'short' : ''}"><span class="wn">${this.ico(g.b.type, g.b.lvl)}<span><b>${d.n}</b><small>${g.n}좌석${g.bad ? ` · <em>${g.bad}중지</em>` : ''}</small></span></span><span class="ww"><b>${g.w}</b>/${g.mx}</span><span class="wb">${miss > 0 ? `<button class="small go" data-act="bulkw" data-arg="${g.b.id}">전체 배송</button>` : '<small>완전히 사용됨</small>'}</span></div>`;
      }
      h += `</div>`;
    }
    h += `<div class="sec">모두가 이야기하고 있습니다</div><div class="voices">${campVoices(S, c0, Sim.rt(S)).map(q => `<div>「${esc(q)}」</div>`).join('')}</div>`;
    h += `<div class="hint">지도에서 작은 사람을 클릭하면 이 사람이 누구인지, 무엇을 하고 있는지, 어떻게 지내는지 알 수 있습니다. </div>`;
    return h;
  }

  // 补给站：留守的人、撑不撑得住、往北送什么、临时接手、熄火
  depotHtml(c) {
    const S = this.S, cr = Sim.rt(S).c[c.id] || {};
    let h = `<div class="sec">공급 창고 <small>${esc(c.name)}</small></div>`;
    h += `<div class="hint">${c.manual ? '당신은 일시적으로 인계를 받습니다. 당신은 집 업그레이드를 지을 수 있습니다. 작업이 끝나면 다시 돌려주면 자동으로 돌아갑니다.' : '이 야영지는 일손 배치를 소유하고 생산를 소유하며 새 집을 짓지 않으며 업그레이드를 소유하지 않습니다. 용광로는 남은 사람 수에 따라 불을 태워 연료를 구합니다. 추가 상품은 물류망에게 제공되며, 공급이 부족한 야영지는 해당 야영지로 발송됩니다.'}</div>`;
    const fm = cr.burnPerMin ? cr.fuelUnits / cr.burnPerMin : 0, why = Sim.depotTrouble(S, c);
    h += `<div class="row"><span>뒤처지기</span><span>${c.people}사람들${c.people < Sim.DEPOT_MIN ? `(미만${Sim.DEPOT_MIN}사람들)` : ''}</span></div>`;
    h += `<div class="row sub"><span>잠깐만 기다리실 수 있나요?</span><span class="${why ? 'bad' : ''}">${why ? '⚠ ' + why : `연료이면 충분합니다${fm ? fmtTime(fm * 60) : '—'}·요리${fmt(c.stock.food)}`}</span></div>`;
    const emb = Sim.douseEmbers(S, Sim.getB(S, c.furnace).lvl);
    h += `<div class="drow"><button class="btn ${c.manual ? 'go' : ''}" data-act="dtake" data-arg="${c.id}:${c.manual ? 0 : 1}">${c.manual ? '반납하고 직접 전송하세요.' : '일시적으로 인수'}</button><button class="btn bad" data-act="ddouse" data-arg="${c.id}">불을 끄고 ${emb} 잔불으로 변경</button></div>`;
    return h;
  }
  // 营地专精：四个方向的卡片，强一样、弱一样
  focusHtml(c) {
    const S = this.S, f = Sim.getB(S, c.furnace), left = Sim.focusLeft(S, c);
    let h = `<div class="sec">야영지 전문화 <small>${esc(c.name)}</small></div>`;
    if (f.lvl < FOCUS_LVL) return h + `<div class="hint">용광로가 ${FOCUS_LVL} 레벨에 도달하면 이 야영지에 대한 방향을 설정할 수 있습니다: 광업, 농경, 공방 또는 요새. </div>`;
    h += `<div class="focus">${FOCUS_KEYS.map(k => { const D = FOCUS[k], on = c.focus === k, why = Sim.focusBlock(S, c, k);
      return `<button class="fcard ${on ? 'on' : ''} ${why && !on ? 'wait' : ''}" ${!on && !why ? `data-act="focus" data-arg="${c.id}:${k}"` : ''}>${this.fIco(k, D)}<span><b>${D.n}${on ? '<em>지금</em>' : ''}</b><small>${D.d}</small><small class="fbad">${D.bad}</small></span></button>`; }).join('')}</div>`;
    h += `<div class="hint">${!c.focus ? '방향을 선택하세요. 강함과 동일, 약함과 동일합니다. 이후의 각 변경은 30분 간격으로 수행되어야 합니다.' : left > 0 ? `전문 분야가 바뀔 때까지 기다려야 해요.${Math.ceil(left / 60)}분.` : '원하는 경우 언제든지 방향을 변경할 수 있지만 30분 이내에는 다시 변경할 수 없습니다.'}</div>`;
    return h;
  }
  // 营地基建：道路和蒸汽管道
  infraHtml(c) {
    const S = this.S;
    let h = `<div class="sec">야영지 인프라 <small>${esc(c.name)}</small></div><div class="infra">`;
    for (const k of ['road', 'pipe']) {
      const I = INFRA[k], lv = c[k] || 0, cur = I.lv[lv], nx = I.lv[lv + 1];
      const lock = nx && Object.keys(nx.cost).find(r => RES[r].t > S.known);
      h += `<div class="ifc"><div class="ifh"><span class="ti">${I.ic}</span><div><b>${I.n} <small>${lv}/${I.lv.length - 1} · ${cur.n}</small></b><small>${lv ? cur.d : I.what}</small></div></div><div class="ipips">${I.lv.slice(1).map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>`;
      if (!nx) h += `<div class="ifn">최상의 상태로 수리되었습니다</div>`;
      else h += `<div class="ifn">다음 레벨 "${nx.n}」：${nx.d}</div><div class="ifa"><span class="tcost">${costHtml(c.stock, nx.cost, S.known)}</span>${lock ? `<span class="tlock">먼저 가세요"${RES[lock].n}"위도</span>` : `<button class="small go" data-act="infra" data-arg="${c.id}:${k}">빌드</button>`}</div>`;
      h += `</div>`;
    }
    return h + `</div>`;
  }

  p_mood(part) {
    const S = this.S, c = this.camp(), cr = Sim.rt(S).c[c.id] || {};
    if (part === 'title') return `민심${S.camps.length > 1 ? ` <small>${esc(c.name)}</small>` : ''}`;
    const hp = c.hope ?? 50, dc = c.disc ?? 10, m = cr.mood || Sim.moodFactors(S, c, cr);
    const trend = (v, t) => t > v + 1 ? `<small class="up">▲ ${Math.round(t)} 상승</small>` : t < v - 1 ? `<small class="dn">▼ ${Math.round(t)} 방향</small>` : '<small>안정화</small>';
    const pct = x => (x >= 0 ? '+' : '−') + Math.abs(Math.round(x * 100)) + '%';
    const mul = Sim.moodMul(c) - 1;
    let h = `<div class="mood2">
      <div class="mg hope"><div class="mgh"><span>희망</span><b>${Math.round(hp)}</b>${trend(hp, m.hT)}</div><div class="mbar"><i style="width:${hp}%"></i><em style="left:${m.hT}%" title="천천히 오겠습니다"></em></div></div>
      <div class="mg disc"><div class="mgh"><span>불만</span><b>${Math.round(dc)}</b>${trend(dc, m.dT)}</div><div class="mbar"><i style="width:${dc}%"></i><em style="left:${m.dT}%"></em><u style="left:${Sim.LEAVE_AT}%" title="초과하면 누군가 떠날 것입니다. 여기"></u></div></div>
    </div>`;
    h += `<div class="mnow"><span>작업 효율성 <b class="${mul < -0.005 ? 'neg' : ''}">${pct(mul)}</b></span><span>출발 속도 <b>×${(0.7 + 0.6 * hp / 100).toFixed(2)}</b></span>${dc >= Sim.LEAVE_AT ? '<span><b class="neg">누군가 떠나고 있습니다</b></span>' : ''}</div>`;
    h += `<button class="btn wide ghost cvlink" data-act="curve">📈 온도의 인구, 기분, 곡선을 살펴보세요</button>`;
    h += `<div class="hint">희망 및 불만은 화살표로 표시된 위치를 향해 천천히 이동합니다. 희망이 높을수록 작업은 더 어려워지고 더 많은 사람들이 피난처를 찾으러 올 것입니다. 불만이 60을 초과하면 작업 속도가 느려지고 불만이 ${Sim.LEAVE_AT}을 초과하면 일부 사람들이 밤에 떠나게 됩니다. </div>`;
    // 为什么
    const rows = new Map();
    for (const [n, v] of m.hope) rows.set(n, { h: v, d: 0 });
    for (const [n, v] of m.disc) { const r = rows.get(n) || { h: 0, d: 0 }; r.d = v; rows.set(n, r); }
    const sg = (v, bad) => v ? `<b class="${bad ? 'neg' : 'pos'}">${v > 0 ? '+' : '−'}${Math.abs(Math.round(v))}</b>` : '<i>·</i>';
    h += `<div class="sec">이유</div><div class="mfac"><div class="mfh"><span></span><span>희망</span><span>불만</span></div><div class="mfb"><span>시작점</span><span>50</span><span>10</span></div>`;
    for (const [n, r] of rows) h += `<div><span>${esc(n)}</span><span>${sg(r.h, r.h < 0)}</span><span>${sg(r.d, r.d > 0)}</span></div>`;
    h += `</div>`;
    h += this.festCard(c);
    { const nl = LAWS.filter(l => Sim.lawOn(S, l.id)).length; h += `<button class="mlink" data-act="htab" data-arg="law"><span>📜</span><span>법률${nl ? `: 적용중${nl}조각` : ': 아직 서명되지 않았습니다.'}<small>법률에 따라 희망 및 불만가 변경될 수 있으며 가격은 각 항목 아래에 표시됩니다.</small></span><i>></i></button>`; }
    return h;
  }
  // 营地 › 律令：对所有营地生效
  p_law(part) {
    const S = this.S;
    if (part === 'title') return '이 법령은 <small>모든 야영지에 적용됩니다</small>';
    let h = `<div class="laws">`;
    for (const l of LAWS) {
      const on = Sim.lawOn(S, l.id), wait = Sim.lawWait(S, l.id);
      h += `<div class="law ${on ? 'on' : ''}"><div class="lh"><span class="li">${this.cIco('law_' + l.id, l.ic)}</span><b>${l.n}</b>${on ? '<span class="lon">효과적</span>' : ''}
        <button class="small ${wait > 0 ? '' : on ? '' : 'go'}" data-act="law" data-arg="${l.id}" ${wait > 0 ? 'disabled' : ''}>${wait > 0 ? fmtTime(wait) + '추후 변경 가능' : on ? '폐지' : '징후'}</button></div>
        <div class="ld">${l.d}</div><div class="lfx"><span class="g">${l.good}</span><span class="b">${l.bad}</span></div></div>`;
    }
    h += `</div><div class="hint">변경된 법률은 3분 이내에 변경할 수 없습니다. 법을 폐지하면 불만 +4가 발생합니다. </div>`;
    return h;
  }

  p_research(part) {
    const S = this.S, R = Sim.rt(S), T = S.tech || { done: {}, cur: null, prog: 0 }, nd = TECHS.filter(t => T.done[t.id]).length, EL = Sim.endlessLvl(S);
    if (part === 'title') return `연구<small>완료${nd}/${TECHS.length}${EL ? `· 끝없는${EL}레벨` : ''}</small>`;
    if (this.g.pc && this.g.pc.on) return this.researchPC();
    const shops = S.buildings.filter(b => b.type === 'workshop'), rate = R.rpRate || 0;
    let potential = 0; for (const b of shops) potential += (R.b[b.id] || {}).rp || 0;
    let h = '';
    const ct = T.cur && Sim.techDef(S, T.cur);
    if (ct) {
      const left = ct.pts - T.prog;
      h += `<div class="tcur"><div class="tch"><span class="ti">${this.rIco(ct)}</span><div><b>${ct.n}</b><small>${ct.d}</small></div></div>
        <div class="mbar"><i style="width:${Math.min(100, T.prog / ct.pts * 100).toFixed(1)}%"></i></div>
        <div class="tcm"><span>${fmt(T.prog)} / ${ct.pts}가리키다 ·${rate > 0 ? `더${fmtTime(left / rate * 60)}` : '<b class="neg">중지됨: 공학 작업장에서 작업하는 사람이 없습니다</b>'}</span><button class="small" data-act="techstop">중지(자료 반환)</button></div></div>`;
    } else h += `<div class="tcur idle"><b>지금은 연구에 없습니다. </b><small>아래 항목 중 하나를 클릭하면 세부정보를 볼 수 있습니다. 처음에 재료비를 먼저 지불하고 연구 포인트를 충분히 모은 후 진행을 완료하세요. </small></div>`;
    if (!shops.length) h += `<div class="issue warning"><span class="ii">🔬</span><span class="it"><b>아직 공학 작업장이 없습니다</b><small>연구 포인트는 공학 작업장의 기술자에 의해 생성됩니다</small></span><span class="ia"><button class="small go" data-act="place" data-arg="workshop">빌드 공학 작업장</button></span></div>`;
    else h += `<div class="row sub"><span>공학 작업장</span><span>${shops.length}석 · ${fmt(ct ? rate : potential)}포인트 분당 ${!ct ? '(연구를 시작한 다음 일손 배치를 시작하십시오)' : ''}</span></div>`;
    if (T.bank > 0.5) h += `<div class="row sub"><span>📜 모험에서 가져온 그림</span><span>${fmt(T.bank)}포인트 · 다음 항목 시작 부분에서 직접 계산 연구</span></div>`;
    // 无尽研究
    const all = Sim.allTechDone(S);
    h += `<button class="rend ${all ? 'on' : ''} ${this.techSel === 'endless' ? 'sel' : ''}" data-act="techsel" data-arg="endless"><span class="ti">♾️</span><span><b>끝없는 연구${EL ? `· 이미${EL}레벨` : ''}</b><small>${all ? `각 레벨에서 모든 생산에 대해 +2%, 상한 없음(현재 +${Math.round(EL * 2)}%）` : `연구가 완성된 후 5개 지점이 모두 오픈됩니다(아직 일부 지점이 남아 있음).${TECHS.length - nd}목)`}</small></span><i>›</i></button>`;
    // 研究树：五列，每列一条分支，从上往下按纬度排；连线连到前置
    const cols = TECH_BR.map((n, br) => { const list = TECHS.filter(x => x.br === br); return { n, br, list, lay: techLayout(list), gate: Sim.techGateWhy(S, br) }; });
    const RH = 84, H = Math.max(...cols.map(c => c.lay.rows)) * RH + 6, sel = this.techSelOf();
    h += `<div class="rhd">${cols.map(c => `<span class="${c.gate ? 'lk' : ''}"><b>${c.n}</b><small>${c.gate ? '🔒 열지 않음' : `${c.list.filter(t => T.done[t.id]).length}/${c.list.length}`}</small></span>`).join('')}</div>`;
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
    h += `<div class="hint">★는 새로운 것을 잠금해제하는 연구입니다. 연구는 모든 야영지에 유효하며, 앞으로는 북상도 유효합니다. </div>`;
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
    let L = `<div class="rph"><span>${shops.length ? `${shops.length}좌석 공학 작업장 · 분당${fmt(ct ? rate : potential)}가리키다${ct ? '' : '(연구를 시작한 다음 일손 배치를 시작하십시오)'}` : '아직 공학 작업장가 없습니다'}</span><span class="rleg"><i class="lg done"></i> 완료<i class="lg ok"></i> OK 연구<i class="lg lk"></i>아직 열리지 않음</span></div>`;
    if (ct) L += `<div class="rpcur"><span class="ti">${this.rIco(ct)}</span><b>연구에서:${ct.n}</b><div class="u-tube"><i style="width:${Math.min(100, T.prog / ct.pts * 100).toFixed(1)}%"></i></div><small>${rate > 0 ? `더${fmtTime((ct.pts - T.prog) / rate * 60)}` : '<b class="neg">중지됨: 공학 작업장에서 작업하는 사람이 없습니다</b>'}</small><button class="small" data-act="techstop">중지(자료 반환)</button></div>`;
    if (!shops.length) L += `<div class="issue warning"><span class="ii">🔬</span><span class="it"><b>아직 공학 작업장이 없습니다</b><small>연구 포인트는 공학 작업장의 기술자에 의해 생성됩니다</small></span><span class="ia"><button class="small go" data-act="place" data-arg="workshop">빌드 공학 작업장</button></span></div>`;
    if (T.bank > 0.5) L += `<div class="row sub"><span>📜 모험에서 가져온 그림</span><span>${fmt(T.bank)}포인트 · 다음 항목 시작 부분에서 직접 계산 연구</span></div>`;
    TECH_BR.forEach((n, br) => {
      const list = TECHS.filter(x => x.br === br), lay = techLayout(list), gate = Sim.techGateWhy(S, br);
      const ord = [...list].sort((a, b) => lay.at[a.id].row - lay.at[b.id].row);
      L += `<div class="rrow ${gate ? 'gate' : ''}"><div class="rbr"><b>${n}</b><small>${gate ? esc(gate.replace(/^정찰이 "(.+)"의 위도에 도달한 후 열림$/, '$1 위도 개방')) : `${list.filter(x => T.done[x.id]).length}/${list.length}`}</small></div><div class="rnodes">`;
      for (const x of ord) {
        const ck = Sim.techCheck(S, x.id), cls = ck.done ? 'done' : ck.cur ? 'cur' : ck.lock ? 'lock' : ck.ok ? 'ok' : 'soft';
        L += `<button class="rpn ${cls}${sel === x ? ' sel' : ''}" data-act="techsel" data-arg="${x.id}" title="${esc(x.n)}"><span class="rpi">${this.rIco(x)}${ck.done ? `<em class="rpb ok">${ico('i', 'check')}</em>` : ck.cur ? `<em class="rpb cur">${ico('i', 'hourglass')}</em>` : ck.lock ? `<em class="rpb lk">${ico('i', 'lock')}</em>` : ''}${x.star ? '<em class="rps">★</em>' : ''}</span><span class="rpl">${x.n}</span></button>`;
      }
      L += '</div></div>';
    });
    const all = Sim.allTechDone(S), EL = Sim.endlessLvl(S);
    L += `<button class="rend ${all ? 'on' : ''} ${this.techSel === 'endless' ? 'sel' : ''}" data-act="techsel" data-arg="endless"><span class="ti">♾️</span><span><b>끝없는 연구${EL ? `· 이미${EL}레벨` : ''}</b><small>${all ? `각 레벨에서 모든 생산에 대해 +2%, 상한 없음(현재 +${Math.round(EL * 2)}%）` : `연구가 완성된 후 5개 지점이 모두 오픈될 예정이며, 아직 갈 시간이 남아 있습니다.${TECHS.length - TECHS.filter(x => T.done[x.id]).length}목`}</small></span><i>›</i></button>`;
    // 右边：选中的那一项
    const t = sel, ck = Sim.techCheck(S, t.id), cls = ck.done ? 'done' : ck.cur ? 'cur' : ck.lock ? 'lock' : ck.ok ? 'ok' : 'soft';
    const tags = [t.br >= 0 ? TECH_BR[t.br] : '', TIER_NAMES[t.t] || '', t.star ? '★ 새로운 콘텐츠 잠금 해제' : ''].filter(Boolean).map(s => `<span class="u-tag">${s}</span>`).join('');
    const reqs = (t.req || []).map(r => { const q = TECHS.find(x => x.id === r); return q ? `<span class="${T.done[r] ? 'pos' : 'neg'}">${this.rIco(q)}${q.n}${T.done[r] ? ' ✓' : ''}</span>` : ''; }).join(' ');
    let D = `<div class="rpd ${cls}"><span class="rpbig">${this.rIco(t)}</span><b class="rpn2">${t.n}</b>${tags ? `<div class="rptags">${tags}</div>` : ''}<p>${t.d}</p>`;
    if (!ck.done) {
      D += `<div class="rpkv"><span>재료</span><span>${costHtml(c.stock, t.cost, S.known) || '재료가 필요하지 않습니다'}</span></div>`;
      D += `<div class="rpkv"><span>연구 포인트</span><span><b>🔬${t.pts}</b>${rate || potential ? `<small>약.${fmtTime(t.pts / (rate || potential) * 60)}</small>` : ''}</span></div>`;
    }
    if (reqs) D += `<div class="rpkv"><span>접두사</span><span>${reqs}</span></div>`;
    D += '<div class="rpsp"></div>';
    if (ck.done) D += '<div class="tdone">✓ 완료</div>';
    else if (ck.cur) D += `<div class="tdone cur">연구중 · ${Math.round(T.prog / t.pts * 100)}%</div><button class="btn wide" data-act="techstop">중지(자료 반환)</button>`;
    else if (!ck.lock) D += `<button class="btn wide ${ck.ok ? 'go' : ''}" data-act="tech" data-arg="${t.id}" ${ck.ok || ck.soft ? '' : 'disabled'}>Start연구</button>`;
    if (ck.lock || (ck.soft && !ck.ok) || ck.busy) D += `<small class="rpwhy ${ck.lock ? 'tlock' : 'neg'}">${esc(ck.reason)}</small>`;
    D += '</div>';
    return `<div class="rpc"><div class="rpl0">${L}</div>${D}</div>`;
  }
  // 研究面板底部：选中那一项的详情和开始按钮
  pf_research() {
    if (this.g.pc && this.g.pc.on) return ''; // 电脑版：详情在窗口右边
    const S = this.S, c = this.camp(), t = this.techSelOf(), ck = Sim.techCheck(S, t.id);
    const act = ck.done ? '<span class="tdone">✓ 완료</span>' : ck.cur ? '<span class="tdone cur">연구중</span>' : ck.lock ? '' : `<button class="btn ${ck.ok ? 'go' : ''}" data-act="tech" data-arg="${t.id}" ${ck.ok || ck.soft ? '' : 'disabled'}>연구 시작</button>`;
    const tag = t.br >= 0 ? `${TECH_BR[t.br]} · ${TIER_NAMES[t.t] || ''}` : '';
    return `<div class="rdet ${ck.done ? 'done' : ck.lock ? 'lock' : ''}"><div class="tdh"><span class="ti">${this.rIco(t)}</span><b>${t.n}</b>${t.star ? '<i class="tstar2">★ 잠금 해제</i>' : ''}${tag ? `<small class="rmeta">${tag}</small>` : ''}</div><small class="rd">${t.d}</small>
      ${ck.done ? '' : `<div class="rfoot"><span class="tcost">${costHtml(c.stock, t.cost, S.known)} <span class="cost">🔬${t.pts}</span></span>${act}</div>`}${ck.lock || (ck.soft && !ck.ok) || ck.busy ? `<small class="${ck.lock ? 'tlock' : 'neg'}">${esc(ck.reason)}</small>` : ''}</div>`;
  }


  // 北行 › 地图与侦察
  p_scout(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return '정찰을 사용한 지도';
    const sl = Sim.scoutSlots(S, c.id);
    let h = `<button class="mlink" data-act="bigmap"><span>🗺️</span><span>북쪽 지도<small>${esc(northRec(S) || '도중에 있는 랜드마크, 야영지 및 아직 탐험하지 못한 장소')}<span class="kh">(M)</span></small></span><i>></i></button>`;
    if (!sl.n) h += `<div class="hint">"${esc(c.name)}"에는 아직 정찰 막사가 없습니다. "건설 → 모닥불"로 하나 만드세요. </div>`;
    else {
      h += `<div class="row"><span>정찰대</span><span>${sl.used}/${sl.n} 외부 · 가장 먼 ${Sim.scoutRange(S, c.id)} 블록 · 팀당 3명</span></div>`;
      const t = this.g.scoutTarget;
      if (t) {
        const cost = Sim.scoutCost(S, c.id, t.x, t.y);
        const d = Math.hypot(t.x + 0.5 - c.x, t.y + 0.5 - c.y);
        h += `<div class="row"><span>목표</span><span>${Math.round(d)} 추가 · 기온은 약 ${baseTempOfRow(t.y)}°C</span></div><div class="row"><span>공급품</span><span>${costHtml(c.stock, cost)}</span></div>`;
        h += `<button class="btn wide go" data-act="scoutgo">이동</button><button class="btn wide ghost" data-act="scoutcancel">취소</button>`;
      } else h += `<button class="btn wide" data-act="scoutpick">🚩 지도에서 타겟을 클릭하세요</button>`;
    }
    if (sl.n) {
      // 勘探新矿脉
      const why = Sim.surveyBlock(S, c), going = S.scouts.some(s => s.camp === c.id && s.kind === 'survey');
      h += `<div class="sec">맥 탐색</div>`;
      h += `<div class="row"><span>⛏ "${esc(c.name)}》난방권에 깊은 곳에 묻혀 있는 새로운 광산 찾기<br><small>두 곳을 찾을 때마다 야영지에서 가장 부족한 광산을 우선적으로 찾습니다. 그것은 탐구되었습니다${c.surveys || 0}더 많이 탐색할수록 비용은 더 높아집니다.</small></span><span style="flex:none">${going ? '길을 나서는 탐사팀' : `<button class="small ${why ? '' : 'go'}" data-act="survey" data-arg="${c.id}" ${why && !why.startsWith('부족') ? 'disabled' : ''}>이동</button>`}</span></div>`;
      if (!going && Sim.surveyCheap(S, c)) h += `<div class="row sub"><span>💡</span><span style="color:var(--good)">이번에는 거의 완성된 ${SPOTS[Sim.surveyNext(S, c)].n}을(를) 찾아서 첫 번째 가격을 지불하려고 합니다</span></div>`;
      if (!going) h += `<div class="row sub"><span>소모품</span><span>${costHtml(c.stock, Sim.surveyCost(S, c))}</span></div>${why && !why.startsWith('부족') ? `<div class="row sub"><span></span><span class="warn">${esc(why)}</span></div>` : ''}`;
    }
    const w = getWorld(S.runSeed);
    const found = Object.keys(S.poiFound).map(id => w.pois.find(p => p.id === +id)).filter(Boolean);
    if (found.length) {
      h += `<div class="sec">생존자 구조 대기 중</div>`;
      for (const p of found) {
        const going = S.scouts.some(s => s.poi === p.id);
        const cost = Sim.scoutCost(S, c.id, p.x, p.y, 'rescue');
        h += `<div class="row"><span>🆘 ${p.n}사람들 ·${Math.round(Math.hypot(p.x - c.x, p.y - c.y))}추가</span><span>${going ? '구조대가 출발했습니다' : `${costHtml(c.stock, cost)} <button class="small" data-act="rescue" data-arg="${p.id}">구출을 위해 4명을 보내세요</button>`}</span></div>`;
      }
    }
    const sites = (w.sites || []).filter(p => S.reveal[idx(p.x, p.y)] && Sim.siteState(S, p) !== 'done').sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
    if (sites.length) {
      h += `<div class="sec">안개 속에 위치</div>`;
      for (const p of sites.slice(0, 6)) {
        const st = Sim.siteState(S, p), K = SITES[p.kind];
        h += `<div class="row"><span>${K.ic} ${K.n} · ${Math.round(Math.hypot(p.x - c.x, p.y - c.y))}추가</span><span>${st === 'seen' ? `<button class="small" data-act="site-open" data-arg="${p.id}">Pai탐험대</button>` : st === 'wait' ? `<button class="small go" data-act="site-decide">귀하의 결정을 기다리는 중</button>` : '도로 위의 탐험대'}</span></div>`;
      }
    }
    if (S.scouts.length) {
      h += `<div class="sec">외부 팀</div>`;
      for (const s of S.scouts) h += `<div class="row sub"><span>${s.kind === 'rescue' ? '🆘 구조팀' : s.kind === 'exp' ? '🧭탐험대' : s.kind === 'survey' ? '⛏ 탐사팀' : '🚩정찰대'} · ${esc(Sim.getCamp(S, s.camp).name)} · ${s.n}사람</span><span>${s.phase === 'wait' ? `<button class="small go" data-act="site-decide">귀하의 결정을 기다리는 중</button>` : s.phase === 'out' ? '대상으로 이동' : '돌아오는 길에'} <button class="small" data-act="lookat" data-arg="${s.x},${s.y}">보기</button></span></div>`;
    }
    h += `<div class="hint">정찰대는 안개를 발견하고, 폐허에서 재료를 가져오고, 생존자 및 전문가를 만나게 됩니다. 안개에는 창고, 기차, 관측소와 같은 위치가 숨겨져 있으며, 탐험대를 보내야만 검색할 수 있습니다. 북쪽으로 갈수록 날씨가 추워져서 돌아오지 못하는 사람도 있습니다. 업그레이드정찰 막사는 점점 더 멀리 갈 수 있습니다. </div>`;
    return h;
  }

  // 物流：所有营地连成一张路网，缺什么自动从有余的营地运过来.三页：总览（每个营地运来、送出、还缺）、道路、送货
  netGood(k, n) { return k === '@fuel' ? `🔥연료${n != null ? ' ' + fmt(n) + '공유하다' : ''}` : `${RICON[k]}${RES[k].n}${n != null ? ' ' + fmt(n) : ''}`; }
  netNames(ids) { return [...ids].map(id => `「${esc((Sim.getCamp(this.S, id) || {}).name || '?')}」`).join(''); }
  // 一样货现在怎么样了：正从哪运来、多久到；整张网都没有；路满了在排队
  netWait(c, k) {
    const S = this.S, v = Sim.netView(S, c.id), i = v.inc[k], sh = v.short[k];
    if (i) return `배송 시작가: ${this.netNames(i.from)}, 약 ${fmtTime(Math.max(1, i.eta))}`;
    if (S.camps.length < 2) return '';
    if (sh && sh.none) return '전체 네트워크에는 불필요한 것이 없습니다';
    if (sh && sh.jam) return '길은 꽉 차서 줄을 서고 있어요';
    return '물류망이 상품을 전송하기를 기다리는 중';
  }
  netRole(c) { const m = Sim.mainCamp(this.S); return m && m.id === c.id ? '본영' : c.depot ? '공급 창고' : '전초'; }
  p_lines(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return `물류 <small>${S.camps.length} 야영지 · 도로 ${Sim.roads(S).filter(Sim.roadOn).length}</small>`;
    if (S.camps.length < 2) return `<div class="hint">현재 야영지는 하나만 있습니다. "Outpost 용광로"를 사용하여 다른 곳의 두 번째 야영지를 클릭하면 썰매 도로가 자동으로 건설되어 연결됩니다. 미래에는 야영지에 뭔가가 부족한 물류망이 잉여 야영지에서 운송될 것입니다. </div>`;
    const pg = this.netPg || 'all';
    let h = `<div class="tabs" data-sx="ntabs">${[['all', '개요'], ['road', '길'], ['send', '물건을 배달하다']].map(([k, n]) => `<button class="tab ${k === pg ? 'on' : ''}" data-act="netpg" data-arg="${k}">${n}</button>`).join('')}</div>`;
    if (pg === 'road') return h + this.netRoads(c);
    if (pg === 'send') return h + this.netSend(c);
    // 总览：每座营地一张卡，正在看的、出问题的放前面
    const m = Sim.mainCamp(S), on = this.netFocus || c.id;
    const L = S.camps.slice().sort((a, b) => (b.id === on) - (a.id === on) || (b.id === (m && m.id)) - (a.id === (m && m.id)) || b.y - a.y);
    const nShips = Sim.ships(S).length;
    h += `<div class="hint">10초마다 각 야영지가 누락 또는 추가로 계산됩니다. 더 많은 썰매가 로드되어 도로를 따라 누락된 야영지로 전송되고, 다른 야영지는 도로에서 전송될 수 있습니다. 현재 도로에 ${nShips}개의 화물이 있습니다. </div>`;
    for (const x of L) {
      const v = Sim.netView(S, x.id), inc = Object.entries(v.inc), out = Object.entries(v.out), sh = Object.entries(v.short).sort((a, b) => a[1].tier - b[1].tier);
      h += `<div class="ncard ${x.id === on ? 'on' : ''}"><div class="nh"><b>${esc(x.name)}</b><small>${this.netRole(x)}</small>${x.id !== S.active ? `<button class="small ghost" data-act="campgo" data-arg="${x.id}">여기로 이동</button>` : ''}</div>`;
      if (inc.length) h += `<div class="nl"><span>배송</span><span>${inc.map(([k, i]) => `${this.netGood(k, i.n)}<small>약.${fmtTime(Math.max(1, i.eta))}· 에서${this.netNames(i.from)}</small>`).join('<br>')}</span></div>`;
      if (out.length) h += `<div class="nl"><span>보내기</span><span>${out.map(([k, o]) => `${this.netGood(k, o.n)}<small>에${this.netNames(o.to)}</small>`).join('<br>')}</span></div>`;
      if (sh.length) h += `<div class="nl"><span>아직 부족</span><span>${sh.map(([k, q]) => `<i class="${q.tier > 5 ? '' : q.none ? 'bad' : q.jam ? 'warn' : ''}">${this.netGood(k, q.n)} <small>${esc(q.why)} · ${q.none ? (q.tier > 5 ? '다른 야영지는 많지 않으니 구하시면 드릴게요.' : '전체 네트워크에는 불필요한 것이 없습니다') : q.jam ? '길은 꽉 차서 줄을 서고 있어요' : '다음 버스를 기다리세요'}</small></i>`).join('<br>')}</span></div>`;
      if (!inc.length && !out.length && !sh.length) h += `<div class="nl"><span></span><span><small>아무것도 없고, 보낼 것도 없습니다</small></span></div>`;
      h += '</div>';
    }
    return h;
  }
  // 1.1 北方商会：卖货 / 订单 / 买（装饰图纸、余烬、救急物资）
  p_guild(part) {
    const S = this.S, G = Sim.guildOf(S), on = Sim.guildOn(S), m = Sim.guildCamp(S, S.active);
    const sv = v => `🪙${fmt(v)}`;
    if (part === 'title') return `북방 상회 <small>${on ? `은화${fmt(G.silver)}` : '아직 여관이 없습니다'}</small>`;
    if (!on) return `<div class="hint">야영지(석탄과 철 위도, 목판 120, 철괴 40)에 "상회 역참"를 구축하세요. 북방 상회의 행렬가 매일 찾아옵니다. 상품을 판매하고 은화를 받고, 주문을 받고, 은화를 사용하세요. 장식 도면 및 잔불 구매 건축 자재가 부족하면 비상용품을 높은 가격에 구입할 수도 있습니다. </div>${Sim.unlocked(S, 'guildpost') ? '<button class="btn wide go" data-act="place" data-arg="guildpost">가서 커버 상회 역참</button>' : `<div class="hint">먼저 정찰를 사용해야 합니다."${TIER_NAMES[2]}"위도. </div>`}`;
    const pg = this.gPg || 'sell', posts = Sim.guildPosts(S), cids = [...new Set(posts.map(b => b.camp))];
    const day = Sim.guildDay(S), left = (day + 1) * DAY_LEN - S.t;
    let h = `<div class="ghero"><div><b>${sv(G.silver)}</b><small>은화 · 본영 계산, 북상 팔로우</small></div><div><small>"${esc(m.name)}" · 행렬 ${fmtTime(left)} 거래 후 새 가격 및 주문으로 교환</small></div></div>`;
    if (cids.length > 1) h += `<div class="dchips">${cids.map(id => `<button class="dchip ${id === m.id ? 'on' : ''}" data-act="campgo" data-arg="${id}">${esc(Sim.getCamp(S, id).name)}</button>`).join('')}</div>`;
    h += `<div class="tabs">${[['sell', '물건을 팔다'], ['order', `주문하다${G.orders.length}`], ['buy', '구입']].map(([k, n]) => `<button class="tab ${k === pg ? 'on' : ''}" data-act="gpg" data-arg="${k}">${n}</button>`).join('')}</div>`;
    const pct = k => { const f = Sim.floatOf(S, k); return `<i class="${f >= 1.15 ? 'pos' : f <= 0.85 ? 'neg' : ''}">${Math.round(f * 100)}%</i>`; };
    if (pg === 'sell') {
      const ks = RES_KEYS.filter(k => Sim.tradable(S, k) && (m.stock[k] || 0) >= 1).sort((a, b) => Sim.sellValue(S, b, m.stock[b]) - Sim.sellValue(S, a, m.stock[a]));
      h += `<div class="hint">가격은 매일 오르락내리락합니다. 당일에 많이 팔수록 가격이 더 저렴해지고, 다음날 회복됩니다. 판매되는 상품은 "${esc(m.name)}" 창고의 상품입니다. </div>`;
      if (!ks.length) h += `<div class="hint">"${esc(m.name)}"의 창고가 비어 있습니다. </div>`;
      for (const k of ks) {
        const have = Math.floor(m.stock[k]), q = [50, 200].filter(n => n < have * 0.9), half = Math.floor(have / 2);
        h += `<div class="grow"><span class="gk">${RICON[k]}<span><b>${RES[k].n}</b><small>예${fmt(have)}· 현재 가격${sv(Sim.sellPrice(S, k))}/개인${pct(k)}</small></span></span><span class="gb">${q.map(n => `<button class="small" data-act="gsell" data-arg="${k}:${n}">판매${n}<small>${sv(Sim.sellValue(S, k, n))}</small></button>`).join('')}${half >= 1 ? `<button class="small" data-act="gsell" data-arg="${k}:${half}">반값에 판매<small>${sv(Sim.sellValue(S, k, half))}</small></button>` : ''}</span></div>`;
      }
    } else if (pg === 'order') {
      h += `<div class="hint">하루 ${Sim.orderMax(S)} 주문: 제한된 시간 내에 여관으로 상품 묶음을 은화 및 잔불으로 배달합니다. 배송된 상품은 "${esc(m.name)}" 창고에 있습니다. 상품이 충분하지 않은 경우 물류망이 먼저 배송될 수 있습니다. </div>`;
      if (!G.orders.length) h += `<div class="hint">오늘 주문이 배송되었으며, 행렬이 내일 새 주문을 가져올 예정입니다. </div>`;
      for (const o of G.orders) {
        const have = m.stock[o.k] || 0, ok = have >= o.n, tl = o.until - S.t;
        h += `<div class="gord ${ok ? 'ok' : ''}"><div class="gk">${RICON[o.k]}<span><b>무료 ${fmt(o.n)} ${RES[o.k].n}</b><small>${fmtTime(tl)} 남음 · 보상 ${sv(o.silver)} + 잔불 ${o.emb}</small></span></div><div class="gbar"><i style="width:${Math.min(100, have / o.n * 100).toFixed(0)}%"></i></div><div class="gb"><small>「${esc(m.name)}」에는 ${fmt(have)}/${fmt(o.n)}</small><button class="small ${ok ? 'go' : ''}" data-act="gdeliv" data-arg="${o.id}" ${ok ? '' : 'disabled'}>배송</button></div></div>`;
      }
    } else {
      h += `<div class="sec">장식 그림 <small>한 번 구매하면 영원히 유효하며 이를 덮으려면 더 많은 재료를 소비해야 합니다.</small></div><div class="gdeco">`;
      for (const t of Sim.SHOP_DECOS) {
        const d = BLD[t], have = Sim.shopHave(S, t);
        h += `<div class="gdc ${have ? 'have' : ''}">${this.ico(t, 1)}<b>${d.n}</b><small>희망 +${d.hope}</small>${have ? '<small class="ok">기존 그림</small>' : `<button class="small ${G.silver >= d.shop ? 'go' : ''}" data-act="gdeco" data-arg="${t}" ${G.silver >= d.shop ? '' : 'disabled'}>${sv(d.shop)}</button>`}</div>`;
      }
      h += `</div>`;
      const ep = Sim.emberPrice(S), el = Sim.emberLeft(S);
      h += `<div class="sec">잔불 <small>오늘도 구매하실 수 있습니다${el}</small></div><div class="grow"><span class="gk">🔥<span><b>잔불</b><small>${sv(ep)}/piece · 북쪽으로 갈수록 가격이 더 비쌉니다</small></span></span><span class="gb">${[1, 5, el].filter((n, i, a) => n >= 1 && a.indexOf(n) === i).map(n => `<button class="small" data-act="gemb" data-arg="${n}" ${G.silver >= ep * n && el >= n ? '' : 'disabled'}>구매${n}<small>${sv(ep * n)}</small></button>`).join('')}</span></div>`;
      h += `<div class="sec">비상용품 <small>가격의 3배, 매일 한정, "${esc(m.name)}"(으)로 배송</small></div>`;
      const bk = RES_KEYS.filter(k => Sim.tradable(S, k) && !RES[k].raw || ['wood', 'stone', 'coal'].includes(k)).filter(k => Sim.tradable(S, k) && k !== 'food' && k !== 'game');
      for (const k of bk) {
        const p = Sim.buyPrice(S, k), bl = Sim.buyLeft(S, k), q = [Math.min(50, bl), bl].filter((n, i, a) => n >= 1 && a.indexOf(n) === i);
        h += `<div class="grow"><span class="gk">${RICON[k]}<span><b>${RES[k].n}</b><small>${sv(p)}/개 · 오늘 남음${fmt(bl)}</small></span></span><span class="gb">${q.map(n => `<button class="small" data-act="gbuy" data-arg="${k}:${n}" ${G.silver >= p * Math.min(n, 1) ? '' : 'disabled'}>구매${n}<small>${sv(p * n)}</small></button>`).join('')}${!q.length ? '<small>오늘 매진</small>' : ''}</span></div>`;
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
      h += `<div class="ncard ${v.jam ? 'jam' : ''}"><div class="nh"><b>${building ? '썰매 도로(건설 중)' : `${Sim.roadKindName(r)} ${r.lvl}레벨`}</b><small>「${esc(a.name)}」⇄「${esc(b.name)}」</small></div>`;
      if (!building) {
        h += `<div class="nl"><span>용량</span><span>분당 ${fmt(v.flow)} / ${fmt(v.cap)}개 이동 · 도로 주행 차량 ${v.ships}대 · 편도 약 ${fmtTime(Sim.roadTime(S, r))}</span></div>`;
        h += `<div class="bar"><i style="width:${Math.min(100, v.flow / Math.max(1, v.cap) * 100).toFixed(0)}%"></i></div>`;
      }
      if (v.jam) { const ks = [...new Set(v.jam.map(j => j.k))]; h += `<div class="nl warning"><span>전체</span><span>${ks.map(k => this.netGood(k)).join('、')}이(가) 대기 중입니다. 레벨을 업그레이드하면 운송량이 절반으로 증가할 수 있습니다. </span></div>`; }
      if (r.pend) {
        const by = Sim.getCamp(S, r.pend.by) || a, miss = Object.keys(r.pend.cost).filter(k => (by.stock[k] || 0) < r.pend.cost[k]);
        h += `<div class="nl"><span>자료 대기 중</span><span>${r.pend.what === 'build' ? '도로를 건설하다' : r.pend.what === 'rail' ? '철도로 변경' : '업그레이드'}"에 랭크됨${esc(by.name)}"건설 대기열${miss.length ? `: 아직 없어${miss.map(k => `${RICON[k]}${fmt(r.pend.cost[k] - (by.stock[k] || 0))}`).join(' ')}，${this.netWait(by, miss[0])}` : ', 재료가 준비되는 대로 작업이 시작됩니다'} <button class="small ghost" data-act="roadx" data-arg="${r.id}">취소</button></span></div>`;
      } else {
        const uc = Sim.roadUpCost(S, r), pay = r.a === c.id || r.b === c.id ? c : a;
        if (uc) h += `<div class="nl"><span>${r.lvl + 1}</span><span>${costHtml(pay.stock, uc, S.known)} 레벨로 업그레이드 <button class="small" data-act="roadup" data-arg="${r.id}">업그레이드</button></span></div>`;
        if (Sim.railOk(S, r)) h += `<div class="nl"><span>철도로 변경됨</span><span>${costHtml(pay.stock, Sim.RAIL_COST, S.known)} <button class="small go" data-act="roadrail" data-arg="${r.id}">리모델링됨</button></span></div>`;
        else if (r.kind !== 'rail' && S.known >= 4) h += `<div class="nl"><span></span><span><small>레벨 3 도달 후 철도로 변경 가능(분당 ${Sim.ROAD.rail.cap}개, 2배 이상 빠른 속도)</small></span></div>`;
      }
      h += '</div>';
    }
    const others = S.camps.filter(o => o.id !== c.id && !Sim.roadBetween(S, c.id, o.id));
    if (others.length) {
      h += `<div class="sec">다른 도로 건설 <small>"${esc(c.name)}"에서 시작</small></div>`;
      for (const o of others) h += `<div class="row"><span>"${esc(o.name)}"<small>${this.netRole(o)}까지 · 직선 ${Math.round(Math.hypot(o.x - c.x, o.y - c.y))} 그리드</small></span><span>${costHtml(c.stock, Sim.roadCost(S, c.id, o.id), S.known)} <button class="small" data-act="roadadd" data-arg="${o.id}">도로 건설</button></span></div>`;
    }
    h += `<div class="hint">썰매는 분당 ${Sim.ROAD.sled.cap}개, 북쪽 방향 주요 도로 ${Sim.ROAD.trunk.cap}개, 철도 ${Sim.ROAD.rail.cap}개, 업그레이드마다 50% 이상을 운반합니다. 한 도로의 화물은 동일한 운송 용량을 공유합니다. 길은 멀지만 도착은 느리고 불운은 아닐 것입니다. 도로를 건설하려면 업그레이드가 처음에 보고 있는 야영지 재료를 사용합니다. 반대쪽 끝에서 재료가 충분하지 않은 경우 대기열에 추가하면 물류망이 재료를 그곳으로 운송합니다. </div>`;
    return h;
  }
  // 送货：从正在看的营地送一批、长期供货、不外送
  netSend(c) {
    const S = this.S, others = S.camps.filter(o => o.id !== c.id);
    if (!others.some(o => o.id === this.netTo)) this.netTo = (others.find(o => o.id === (Sim.mainCamp(S) || {}).id) || others[0]).id;
    const sp = Sim.campSpare(S, c, {}, true), spA = Sim.campSpare(S, c, {}, false);
    const ks = RES_KEYS.filter(k => RES[k].t <= S.known && (sp[k] || 0) >= 1).sort((a, b) => (sp[b] || 0) - (sp[a] || 0));
    if (!ks.includes(this.netK)) this.netK = ks[0];
    let h = `<div class="sec">"에서${esc(c.name)}"보내기</div><div class="dchips">${others.map(o => `<button class="dchip ${o.id === this.netTo ? 'on' : ''}" data-act="nto" data-arg="${o.id}">${esc(o.name)}<small>${this.netRole(o)}</small></button>`).join('')}</div>`;
    h += `<div class="sec">줄거리 <small>테이크아웃 가능(연료, 배급은 30분 정도 남겨두세요)</small></div>`;
    h += ks.length ? `<div class="dchips">${ks.slice(0, 18).map(k => `<button class="dchip ${k === this.netK ? 'on' : ''}" data-act="nk" data-arg="${k}">${RICON[k]}${RES[k].n}<small>${fmt(sp[k])}</small></button>`).join('')}</div>` : '<div class="hint">여기에는 사용할 수 있는 항목이 없습니다. </div>';
    if (this.netK) {
      const k = this.netK, all = Math.floor(spA[k] || 0);
      h += `<div class="drow"><button class="btn" data-act="nsend" data-arg="100">100을 기부하세요</button><button class="btn" data-act="nsend" data-arg="500">500을 기부하세요</button><button class="btn go" data-act="nsend" data-arg="all"${all < 1 ? 'disabled' : ''}> 초과분은 모두 폐기됩니다.${all >= 1 ? ` (${fmt(all)})` : ''}</button></div>`;
      h += `<div class="drow"><span class="dl">장기 공급</span><button class="btn" data-act="nfeed" data-arg="10">분당 10개</button><button class="btn" data-act="nfeed" data-arg="30">분당 30개</button><button class="btn" data-act="nfeed" data-arg="60">분당 60</button></div>`;
      h += `<div class="hint">인명을 구하는 연료배급 뒤에 먼저 배치를 보내세요. "건설용으로 예약된" 재료를 사용할 수 있습니다. 장기 공급은 중단할 때까지 분당 너무 많은 전달을 제공합니다. 하나의 야영지는 최대 ${Sim.FEED_MAX}개의 품목을 배송할 수 있습니다. </div>`;
    }
    const B = Sim.sends(S).filter(b => b.from === c.id || b.to === c.id);
    if (B.length) {
      h += `<div class="sec">보내는 중</div>`;
      for (const b of B) h += `<div class="row"><span>${this.netGood(b.k, b.n)} <small>「${esc((Sim.getCamp(S, b.from) || {}).name)}」→「${esc((Sim.getCamp(S, b.to) || {}).name)}”</small></span><span>도착${fmt(b.arr || 0)}· 길에서${fmt(b.n - b.left - (b.arr || 0))}${b.left >= 1 ? `· 아직 설치되지 않았습니다.${fmt(b.left)}` : ''} <button class="small ghost" data-act="nsendx" data-arg="${b.id}">취소</button></span></div>`;
    }
    const F = Sim.feeds(S).filter(f => f.from === c.id || f.to === c.id);
    if (F.length) {
      h += `<div class="sec">장기 공급 <small>${Sim.feeds(S).filter(f => f.from === c.id).length}/${Sim.FEED_MAX}</small></div>`;
      for (const f of F) h += `<div class="row"><span>${f.k === 'people' ? '👥이민' : this.netGood(f.k)} <small>「${esc((Sim.getCamp(S, f.from) || {}).name)}」→「${esc((Sim.getCamp(S, f.to) || {}).name)}」</small></span><span>분당${fmt(f.rate)}${f.k === 'people' ? '사람들' : ''} <button class="small ghost" data-act="nfeedx" data-arg="${f.id}">중지</button></span></div>`;
    }
    const hk = RES_KEYS.filter(k => RES[k].t <= S.known && ((c.stock[k] || 0) >= 1 || (c.hold && c.hold[k])));
    h += `<div class="sec">배송 불가 <small>조명 상품은 "${esc(c.name)}"자신의 용도로</small></div><div class="dchips">${hk.map(k => `<button class="dchip ${c.hold && c.hold[k] ? 'on' : ''}" data-act="nhold" data-arg="${k}">${RICON[k]}${RES[k].n}</button>`).join('')}</div>`;
    return h;
  }
  // 营地面板里的一行：这里正在运来什么、还缺什么
  netRow(c) {
    const S = this.S; if (S.camps.length < 2) return '';
    const v = Sim.netView(S, c.id), inc = Object.entries(v.inc), sh = Object.entries(v.short).sort((a, b) => a[1].tier - b[1].tier);
    let h = `<div class="sec">물류 <small>${Sim.roadsAt(S, c.id).length} 길은 여기로 연결됩니다</small></div>`;
    h += `<div class="row"><span>배송</span><span>${inc.length ? inc.slice(0, 3).map(([k, i]) => `${this.netGood(k, i.n)}<small>약.${fmtTime(Math.max(1, i.eta))}</small>`).join(' · ') + (inc.length > 3 ? `외 ${inc.length}건` : '') : '<small>배송 중 물품 없음</small>'}</span></div>`;
    if (sh.length) h += `<div class="row sub"><span>아직 부족</span><span>${sh.slice(0, 3).map(([k, q]) => `<i class="${q.tier > 5 ? '' : q.none ? 'bad' : q.jam ? 'warn' : ''}">${this.netGood(k, q.n)}</i>`).join(' · ')}</span></div>`;
    h += `<div class="drow"><button class="btn" data-act="netview" data-arg="${c.id}">물류 보기</button><button class="btn" data-act="netsend">배송</button></div>`;
    return h;
  }

  // 北行 › 专家与余烬：专家跟着你一路走；余烬强化是永久的
  p_specs(part) {
    const S = this.S, c = this.camp();
    if (part === 'title') return `전문가 및 잔불 <small>🔥 ${Math.floor(S.meta.embers)}</small>`;
    const have = SPECS.filter(s => S.meta.specs[s.id]);
    let h = `<div class="sec">전문가 <small>${have.length}/${SPECS.length}</small></div>`;
    if (!have.length) h += `<div class="hint">아직 전문가가 없습니다. 전문가는 북쪽에 흩어져 있으니 정찰대를 보내서 찾으세요. 그들은 항상 당신을 따라갈 것이며 북상이 있을 때에도 함께 갈 것입니다. </div>`;
    for (const sp of have) {
      const m = S.meta.specs[sp.id];
      const at = S.specAt[sp.id] && Sim.getB(S, S.specAt[sp.id]);
      const cost = specTrainCost(m.lvl);
      h += `<div class="card"><div class="ci">${this.cIco('spec_' + sp.id, '🧑‍🔧')}</div><div class="cb"><div class="cn">${sp.n} <small>${sp.role} · ${m.lvl}레벨</small></div>
        <div class="cd">${esc(sp.story)}<br>대상:${sp.aff.map(t => BLD[t].n).join('、')}（+${Math.round(specBonus(m.lvl, true) * 100)}%, 다른 곳 +${Math.round(specBonus(m.lvl, false) * 100)}%）</div>
        <div class="cc">${at ? `존재하다"${BLD[at.type].n}」(${esc(Sim.getCamp(S, at.camp).name)}) <button class="small" data-act="spot" data-arg="${at.id}">보기</button> <button class="small" data-act="unspec" data-arg="${sp.id}">가주세요</button>` : `<button class="small" data-act="autospec" data-arg="${sp.id}">해당 건물에 배치</button>`}
        · ${m.lvl >= SPEC_MAX ? '이미 정상까지 연습했어' : `키우다${costHtml(c.stock, cost, S.known)} <button class="small" data-act="train" data-arg="${sp.id}">재배</button>`}</div></div></div>`;
    }
    const missing = SPECS.filter(s => s.row != null && !S.meta.specs[s.id]).length;
    if (missing) h += `<div class="hint">북쪽에는 ${missing}개의 전문가가 발견되기를 기다리고 있습니다. </div>`;
    if (!S.meta.specs.he) h += `<div class="hint">늙은 의사가 머물 곳을 찾고 있다고 들었습니다. 진료소와 일손 배치를 만들어 이를 지키세요. 그는 잠시 후에 올 수도 있습니다. </div>`;
    h += `<div class="sec">잔불 향상 <small>영구적, 끝까지 쌓임</small></div>` + this.emberHtml();
    return h;
  }

  // 篝火庆典的卡片：熔炉面板和人心面板里都有
  festCard(c) {
    const S = this.S;
    if (c.fest) return `<div class="festcard on"><div class="fhd"><span class="fci">🔥</span><b>모닥불 축하 진행 중</b><em>${fmtTime(c.fest.until - S.t)} 남음</em></div><div class="fcd">모두가 모닥불 주변에서 춤을 추고 있는데 일하는 사람 중 절반이 실종되었습니다. 게임이 끝나면 ${Sim.FEST_AFTER / 60}분 안에 희망 +15, 불만 −10, 생산량 +15%가 발생합니다. </div><button class="btn wide" data-act="festgo" data-arg="${c.id}">가 보기</button></div>`;
    const why = Sim.festBlock(S, c), cost = Sim.festCost(S, c);
    return `<div class="festcard"><div class="fhd"><span class="fci">🔥</span><b>모닥불 축하</b><em>${costHtml(c.stock, cost)}</em></div><div class="fcd">야영지 옆에 큰 모닥불 무리를 밝히고 모두가 하던 일을 내려놓고 춤추게 하세요(${Sim.FEST_LEN / 60}분 동안 생산량는 절반으로 줄어듭니다). 게임 종료 후 희망 +15, 불만 −10, 이후${Sim.FEST_AFTER / 60}분생산량 +15%. 모든${Sim.FEST_CD / 60}한 세션은 몇 분 안에 열릴 수 있습니다. </div>${why ? `<div class="fcw">${esc(why)}</div>` : ''}<button class="btn wide ${why ? '' : 'go'}" data-act="fest" data-arg="${c.id}" ${why ? 'disabled' : ''}>🎉축하행사 개최</button></div>`;
  }
  // 收集册：建筑、物资、地标、人物、风物五栏，外加成就.跨轮保留
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
    if (part === 'title') return `데이터 곡선 <small>${esc(c.name)}</small>`;
    this.cvDefault();
    let h = '';
    if (S.camps.length > 1) h += `<div class="cvchips">${S.camps.map(x => `<button class="chip ${x.id === c.id ? 'on' : ''}" data-act="cvcamp" data-arg="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
    h += `<div class="seg cvseg">${[['camp', '야영지'], ['res', '용품']].map(([k, n]) => `<button class="btn ${st.tab === k ? 'on' : ''}" data-act="cvtab" data-arg="${k}">${n}</button>`).join('')}</div>`;
    h += `<div class="cvrange">${[['d1', '지난 1일'], ['d4', '지난 4일'], ['all', '게임 전체']].map(([k, n]) => `<button class="${st.range === k ? 'on' : ''}" data-act="cvrange" data-arg="${k}">${n}</button>`).join('')}</div>`;
    const H = c.hist || {};
    let T = st.range === 'all' && H.c && H.c.n >= 2 ? H.c : H.f;
    if (!T || T.n < 2) return h + `<div class="empty">녹화를 시작하세요. 30초마다 녹화하고 1~2분 후에 다시 확인하세요. </div>`;
    const i0 = st.range === 'd1' && T === H.f ? Math.max(0, T.n - Math.round(DAY_LEN / T.dt)) : 0;
    const ts = Array.from({ length: T.n - i0 }, (_, j) => T.t0 + (i0 + j + 0.5) * T.dt);
    const col = k => (T.v[k] ? T.v[k].slice(i0) : ts.map(() => null));
    const w = Math.max(250, Math.min(560, (this.sheet.clientWidth || 380) - 30)), meta = this.cvMeta = {};
    const chart = o => { const r = chartHtml({ w, h: 150, ts, off: H.off, ...o }); meta[o.id] = r.meta; return r.html; };
    const table = (cols) => {
      // 按天看数字：每天天亮那一笔（最多 8 天）
      const rows = []; let lastD = -1;
      for (let i = ts.length - 1; i >= 0 && rows.length < 8; i--) { const d = Math.floor(ts[i] / DAY_LEN); if (d !== lastD) { lastD = d; rows.push(i); } }
      return `<details class="cvtbl"><summary>일별 수치 보기</summary><table><tr><th></th>${cols.map(x => `<th>${esc(x.name)}</th>`).join('')}</tr>${rows.map(i => `<tr><td>${dayLabel(ts[i])}</td>${cols.map(x => `<td>${fmtV(x.vals[i])}${x.unit || ''}</td>`).join('')}</tr>`).join('')}</table></details>`;
    };
    if (st.tab === 'camp') {
      const pop = col('pop'), wait = col('wait'), hope = col('hope'), disc = col('disc'), tin = col('tin'), tout = col('tout');
      const ps = [{ name: '인구', col: CV_COL[0], vals: pop }]; if (wait.some(v => v > 0)) ps.push({ name: '침대를 기다리는 중', col: CV_COL[1], vals: wait });
      h += chart({ id: 'pop', title: '인구', sub: wait.some(v => v > 0) ? '천막에 사는 사람들, 판잣집에서 침대를 기다리는 사람들' : '야영지에 사는 사람들', series: ps, zero: true, area: true });
      h += chart({ id: 'mood', title: '감정', sub: `불만이 ${Sim.LEAVE_AT}을(를) 초과하면 누군가 떠날 것입니다`, series: [{ name: '희망', col: CV_COL[0], vals: hope }, { name: '불만', col: CV_COL[1], vals: disc }], fixed: [0, 100, [0, 50, 100]] });
      h += chart({ id: 'temp', title: '온도', sub: '집 내부에는 체온용 천막이 장착되어 있고, 실외기에는 냉방용 눈보라가 장착되어 있습니다.', series: [{ name: '집에서', col: CV_COL[0], vals: tin }, { name: '집 밖의', col: CV_COL[1], vals: tout }], unit: '°' });
      h += table([{ name: '인구', vals: pop }, { name: '희망', vals: hope }, { name: '불만', vals: disc }, { name: '집에서', vals: tin, unit: '°' }]);
    } else {
      const have = RES_KEYS.filter(k => T.v['s:' + k] || T.v['p:' + k]);
      st.sel = st.sel.filter(e => have.includes(e.k) || RES[e.k].t <= S.known);
      h += `<div class="cvres">${have.map(k => { const e = st.sel.find(x => x.k === k); return `<button class="${e ? 'on' : ''}" data-act="cvres" data-arg="${k}" title="${RES[k].n}">${RICON[k]}<span>${RES[k].n}</span>${e ? `<i style="background:${CV_COL[e.c]}"></i>` : ''}</button>`; }).join('')}</div>`;
      if (!st.sel.length) return h + `<div class="empty">위의 자료를 클릭하면 보유량과 생산량 변경 사항을 볼 수 있습니다(동시에 최대 ${CV_COL.length}). </div>`;
      const sel = st.sel.filter(e => have.includes(e.k));
      const ss = sel.map(e => ({ name: RES[e.k].n, col: CV_COL[e.c], vals: col('s:' + e.k) })), pp = sel.map(e => ({ name: RES[e.k].n, col: CV_COL[e.c], vals: col('p:' + e.k).map(v => v ?? 0) }));
      h += chart({ id: 'stock', title: '재고 있음', sub: `창고 상한 ${fmt((Sim.rt(S).c[c.id] || {}).cap || 0)}`, series: ss, zero: true, area: true });
      h += chart({ id: 'prod', title: '분당 생산량', sub: '이 기간 동안 분당 평균 출력은 얼마입니까?', series: pp, zero: true, area: true });
      h += table(ss);
    }
    if ((H.off || []).length) h += `<div class="hint">밝은 색상의 기간은 오프라인의 시간입니다. 오프라인 중에는 남은 시간에 따라 재료가 할인됩니다(첫 번째 시간에 40%, 4시간에 20%, 12시간에 10%). </div>`;
    return h;
  }

  // ---------- 成就页：按类别排，进度条和奖励；新的二十个只换装扮，老的达成有余烬 ----------
  achHtml(isNew = () => '') {
    const S = this.S, B = Sim.bookOf(S), all = Sim.ACH.length, got = Sim.ACH.filter(a => B.a[a.id]).length;
    let h = `<div class="achtop"><span><b>${got}</b><small>/${all}</small> 업적</span><button class="btn sm" data-act="dress">🎨 정장</button></div>`;
    for (const cat of Sim.ACH_CATS) {
      const L = Sim.ACH.filter(a => Sim.achCat(a) === cat).map(a => ({ a, done: B.a[a.id], cur: Math.min(a.need, a.cur(S, B) || 0) }));
      if (cat === '여행') L.sort((x, y) => (!!y.done - !!x.done) || (y.cur / y.a.need - x.cur / x.a.need));
      h += `<div class="sec achsec">${cat === '숨기기' ? '❔숨기기' : cat}${cat === '여행' ? '<small>이전 업적는 이제 잔불입니다.</small>' : ''}<em>${L.filter(x => x.done).length}/${L.length}</em></div>`;
      for (const { a, done, cur } of L) {
        const hid = a.hid && !done;
        const rw = a.gift ? Sim.giftList(a).map(([k, v]) => `<i class="achg${done ? ' on' : ''}">${Sim.GIFT_ICON[k]} ${hid ? '？？？' : `${Sim.GIFT_LABEL[k]}「${esc(Sim.giftName(k, v))}」`}</i>`).join('') : `<i class="achg${done ? ' on' : ''}">🔥 잔불 ${a.rw}</i>`;
        h += `<div class="bkach ${done ? 'on' : ''}"><span class="bai">${done ? '🏆' : hid ? '❔' : '🔒'}</span><span class="bab"><b>${hid ? '？？？' : a.n}${isNew(a.id)}</b><small>${hid ? '숨기기업적: 해본 다음에야 그게 뭔지 알게 될 거야' : a.d}</small>
          ${done ? `<em>아니요.${done}두 번째 여행은 북쪽으로</em>` : !hid && a.need > 1 ? `<i class="bap"><i style="width:${(cur / a.need * 100).toFixed(0)}%"></i></i><em>${a.id === 'nodeath' ? `${fmtTime(cur * 60)}/ 3시간` : `${cur} / ${a.need}`}</em>` : ''}<span class="achgs">${rw}</span></span></div>`;
      }
    }
    return h;
  }
  p_ach(part) {
    if (part === 'title') return '업적';
    const S = this.S, B = Sim.bookOf(S);
    const fr = B.fresh.filter(f => f.startsWith('a:')).map(f => f.slice(2)), shown = this.achShown || (this.achShown = new Set());
    if (fr.length) { fr.forEach(x => shown.add(x)); Sim.bookSeen(S, 'a'); }
    return this.achHtml(id => shown.has(id) ? '<i class="bknew">새로운</i>' : '');
  }
  // ---------- 装扮：成就送的称号、炉火颜色、旗子、相框、北境装饰 ----------
  p_dress(part) {
    if (part === 'title') return '옷을 입다';
    const S = this.S, cur = Sim.titleOf(S), B = Sim.bookOf(S);
    const lockTxt = (k, id) => { const a = Sim.giftFrom(k, id); return a ? `업적「${a.hid && !B.a[a.id] ? '？？？' : a.n}」` : ''; };
    let h = `<div class="hint">장식은 보기에만 좋을 뿐 값은 변하지 않습니다. 업적에 도달하면 잠금을 해제할 수 있으며 앞으로도 북상을 유지할 수 있습니다. </div>`;
    // 称号
    h += `<div class="sec">🎖 칭호<small>본영 이름 아래에 표시되며 사진 모서리에도 인쇄됩니다</small></div><div class="dgrid">`;
    h += `<button class="dpick ${!cur ? 'on' : ''}" data-act="settitle" data-arg="none"><b>표시하지 않음</b></button>`;
    for (const id in TITLES) { const have = Sim.cosHave(S, 'title', id); h += `<button class="dpick ${have ? '' : 'off'} ${have && cur === TITLES[id] ? 'on' : ''}" ${have ? `data-act="settitle" data-arg="${id}"` : 'disabled'}><b>${have ? TITLES[id] : '？？？'}</b>${have ? '' : `<small>${lockTxt('title', id)}</small>`}</button>`; }
    h += '</div>';
    // 炉火颜色：全部营地一起换，营地多的话还能单独给某一座换
    const sw = (id, on, act, arg) => { const f = FLAMES[id], have = Sim.cosHave(S, 'flame', id), c = f.c || ['#fff2b8', '#ffc040', '#ff6a18'];
      return `<button class="dsw2 ${on ? 'on' : ''} ${have ? '' : 'off'}" style="background:radial-gradient(circle at 50% 62%,${c[0]} 0 22%,${c[1]} 45%,${c[2]} 80%)" title="${have ? f.n : `${f.n}：${lockTxt('flame', id)}터놓다`}" ${have ? `data-act="${act}" data-arg="${arg}"` : 'disabled'}></button>`; };
    const all = (Sim.cosOf(S).flame && Sim.cosHave(S, 'flame', Sim.cosOf(S).flame)) ? Sim.cosOf(S).flame : 'def';
    h += `<div class="sec">🔥 불 색상<small>용광로의 불꽃과 빛의 색상이 변경됩니다</small></div><div class="dgrid">`;
    for (const id in FLAMES) { const f = FLAMES[id], have = Sim.cosHave(S, 'flame', id), c = f.c || ['#fff2b8', '#ffc040', '#ff6a18'];
      h += `<button class="dpick ${have ? '' : 'off'} ${have && all === id ? 'on' : ''}" ${have ? `data-act="setflame" data-arg="all:${id}"` : 'disabled'}><i class="dsw" style="background:radial-gradient(circle at 50% 62%,${c[0]} 0 22%,${c[1]} 45%,${c[2]} 80%)"></i><b>${have ? f.n : '？？？'}</b>${have ? '' : `<small>${lockTxt('flame', id)}</small>`}</button>`; }
    h += '</div>';
    if (S.camps.length > 1 && Object.keys(FLAMES).filter(id => Sim.cosHave(S, 'flame', id)).length > 1) {
      h += `<div class="mlab">특정 야영지를 개별적으로 교체<small>선택하지 않으면 위와 동일</small></div>`;
      for (const c of S.camps) { const fo = Sim.flameOf(S, c); h += `<div class="dcamp"><span>${esc(c.name)}</span><div class="dsws">${Object.keys(FLAMES).filter(id => Sim.cosHave(S, 'flame', id)).map(id => sw(id, fo === id, 'setflame', c.id + ':' + id)).join('')}</div></div>`; }
    }
    // 旗子
    const fl = Sim.flagOf(S);
    h += `<div class="sec">🚩 캠프 깃발 패턴<small>깃대와 북상행렬의 선두 차량에 매달리세요</small></div><div class="dgrid">`;
    for (const id in FLAGS) { const have = Sim.cosHave(S, 'flag', id);
      h += `<button class="dpick ${have ? '' : 'off'} ${have && fl === id ? 'on' : ''}" ${have ? `data-act="setflag" data-arg="${id}"` : 'disabled'}><img src="${this.cosPrev('flag', id)}" alt=""><b>${have ? FLAGS[id].n : '？？？'}</b>${have ? '' : `<small>${lockTxt('flag', id)}</small>`}</button>`; }
    h += '</div>';
    // 相框
    const fr = Sim.frameOf(S);
    h += `<div class="sec">🖼 사진 프레임<small>사진 촬영 시 기본으로 설정되는 프레임으로, 사진 툴바에서도 변경할 수 있습니다.</small></div><div class="dgrid">`;
    for (const id in FRAMES) { const have = Sim.cosHave(S, 'frame', id);
      h += `<button class="dpick ${have ? '' : 'off'} ${have && fr === id ? 'on' : ''}" ${have ? `data-act="setframe" data-arg="${id}"` : 'disabled'}><img src="${this.cosPrev('frame', id)}" alt=""><b>${have ? FRAMES[id].n : '？？？'}</b>${have ? '' : `<small>${lockTxt('frame', id)}</small>`}</button>`; }
    h += '</div>';
    // 北境装饰
    h += `<div class="sec">🗿 북방장식<small>잠금 해제 후 "건설 → 장식"에 희망도 추가</small></div>`;
    for (const k of NDECO) { const d = BLD[k], have = Sim.cosHave(S, 'deco', k);
      h += `<div class="ndeco"><b>${have ? d.n : '？？？'}</b><small>${have ? `희망+${d.hope} · ${Object.entries(d.cost).map(([r, v]) => `${RICON[r] || ''}${v}`).join(' ')}` : lockTxt('deco', k) + '터놓다'}</small>${have ? `<button class="btn" data-act="place" data-arg="${k}">건설로 이동</button>` : ''}</div>`; }
    return h;
  }
  // ---------- 相册：新的在前，点开看大图 ----------
  p_album(part) {
    if (part === 'title') return '사진 앨범';
    if (!this.album) { this.loadAlbum(); return '<div class="hint">사진 앨범을 살펴보는 중...</div>'; }
    const L = this.album;
    let h = `<div class="hint">새 역에 도착해 삼성 최초의 생산라인인 봉화탑을 밝히고 스카이파이어를 밝히면 자동으로 사진이 찍힙니다. 사진 모드에서 "사진 앨범에 포함"할 수도 있습니다. 이 기기의 브라우저에 저장되는 최대 사진 수는 ${ALBUM_MAX}입니다. 가득 차면 가장 오래된 자동 사진부터 먼저 압축됩니다. </div>`;
    if (!L.length) return h + '<div class="empty">앨범이 아직 비어 있습니다. 먼저 사진을 찍어 보겠습니다. </div><button class="btn go" data-act="photo">📷 사진 모드</button>';
    h += `<div class="mlab">사진 ${L.length}장<small>자동으로 찍은 사진 ${L.filter(r => r.auto).length}장</small></div><div class="algrid">`;
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
  agoText(at) { const s = Math.max(0, (Date.now() - at) / 1000); return s < 60 ? '단지' : s < 3600 ? Math.floor(s / 60) + '몇 분 전' : s < 86400 ? Math.floor(s / 3600) + '몇 시간 전' : Math.floor(s / 86400) + '며칠 전'; }
  bkLine(r) { const i = r.info || {}; return `${esc(i.name || '？')} · 👥 ${fmt(i.people || 0)}명 · ${Math.floor((i.t || 0) / DAY_LEN) + 1}일째${(i.runs || 1) > 1 ? ` · ${i.runs}번째 북행` : ''}`; }
  bkRow() {
    if (!this.bks) { this.loadBackups(); return '<div class="row"><span>자동 백업<br><small>계산 중...</small></span></div>'; }
    const L = this.bks;
    return `<div class="row"><span>자동 백업 <b>${L.length}</b> 부분<br><small>${L.length ? `가장 최근의${this.agoText(L[0].at)} · ` : ''}재생하는 동안 10분마다 한 장씩 복사됩니다. 또한 북상 이전에 백업하고 가져오고 다시 시작하세요</small></span><span style="flex:none"><button class="small" data-act="backups"${L.length ? '' : 'disabled'}>백업 보기</button></span></div>`;
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
    if (!this.bks) { this.modal('<h2>자동 백업</h2><div class="hint">계산 중...</div>', [{ t: '폐쇄', a: 'close-modal' }]); this.bkOpen = true; this.loadBackups(); return; }
    const L = this.bks;
    const rows = L.map(r => { const [ic, n] = BK_WHY[r.why] || BK_WHY.auto, d = new Date(r.at);
      return `<div class="bkrow"><span class="bki">${ic}</span><span class="bkt"><b>${this.agoText(r.at)}</b><em>${n} · ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</em><small>${this.bkLine(r)}</small></span><button class="small" data-act="bkload" data-arg="${r.id}">복원</button></div>`; }).join('');
    this.modal(`<h2>자동 백업</h2><p class="hint">저장 ${this.g.slot}의 이전 진행 상황이 이 기기에 저장되어 있습니다. 복구 후 해당 순간부터 계속 플레이하면 현재 진행 상황이 다른 복사본에 저장됩니다. 후회하시면 다시 바꾸시면 됩니다. </p>
      <div class="bklist">${rows || '<div class="hint">아직 백업이 없습니다. 10분 동안 플레이하고 첫 번째 사본을 받으세요. </div>'}</div>
      <p class="hint">예약된 백업은 몇 분 전, 30분 전, 몇 시간 전, 하루 전에 진행 상태를 종료합니다. 북상 출발 전, 저장 코드를 가져오기 전, 다시 시작 전, 삭제 전의 마지막 4개 백업이 유지됩니다. </p>`, [{ t: '폐쇄', a: 'close-modal' }]);
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
    if (part === 'title') return '컬렉션 북';
    const B = Sim.bookOf(S), N = Sim.bookCount(S), tab = this.bookTab || 'a';
    // 这一栏里新进册的，看过就清掉「新」，但这次打开期间还标着
    const shown = this.bookShown || (this.bookShown = {});
    const fr = B.fresh.filter(f => f.startsWith(tab + ':')).map(f => f.slice(2));
    if (fr.length) { (shown[tab] ||= new Set()); fr.forEach(x => shown[tab].add(x)); Sim.bookSeen(S, tab); }
    const isNew = id => shown[tab] && shown[tab].has(id) ? '<i class="bknew">새로운</i>' : '';
    const TABS = [['a', '🏆업적'], ['b', '건축학'], ['r', '용품'], ['l', '경계표'], ['p', '수치'], ['s', '경치']];
    let h = `<div class="bkhead"><div class="bkt"><b>${N.got}</b><small>/${N.all}</small> 수집<span>·</span><b>${N.cats.a[0]}</b><small>/${N.cats.a[1]}</small> 업적</div><div class="bkbar"><i style="width:${(N.got / N.all * 100).toFixed(1)}%"></i></div><div class="bksub">북상도 유지됩니다. 업적을 달성하려면 잔불이 있습니다. </div></div>`;
    h += '<div class="tabs bktabs" data-sx="bktabs">' + TABS.map(([k, n]) => `<button class="tab ${k === tab ? 'on' : ''} ${k !== tab && B.fresh.some(f => f.startsWith(k + ':')) ? 'hasnew' : ''}" data-act="booktab" data-arg="${k}">${n}<small>${N.cats[k][0]}/${N.cats[k][1]}</small></button>`).join('') + '</div>';
    const pick = this.bookPick && this.bookPick.startsWith(tab + ':') ? this.bookPick.slice(2) : null;
    if (tab === 'a') return h + this.achHtml(isNew);
    const cell = (id, have, pic, name, sub) => `<button class="bkc ${have ? '' : 'off'} ${pick === id ? 'pk' : ''}" data-act="bookpick" data-arg="${tab}:${id}"><span class="bkp">${pic}</span><b>${have ? name : '？？？'}</b><small>${sub}</small>${have ? isNew(id) : ''}</button>`;
    const card = (have, ic, name, sub, desc, id) => `<div class="bkcard ${have ? '' : 'off'}"><span class="bki">${ic}</span><span class="bkb"><b>${have ? name : '？？？'}${have ? isNew(id) : ''}</b><small>${sub}</small>${desc ? `<p>${esc(desc)}</p>` : ''}</span></div>`;
    let detail = '';
    if (tab === 'b') {
      if (pick && BLD[pick]) { const d = BLD[pick], have = B.b[pick]; detail = `<div class="bkdet"><span class="bkp">${this.ico(pick, pick === 'furnace' ? 2 : 1)}</span><span><b>${have ? d.n : '？？？'}</b><small>${TIER_NAMES[d.t]} · ${have ? `아니요.${have}북쪽 이남 수익` : '아직 구축되지 않음'}</small><p>${have ? esc(d.desc) : `도착하다"${TIER_NAMES[d.t]}” 해당 지역을 잠금 해제한 후 하나를 건설하면 해당 지역이 포함됩니다.`}</p></span></div>`; }
      h += detail + '<div class="bkgrid">';
      for (let t = 1; t <= 7; t++) for (const k of BLD_KEYS.filter(k => BLD[k].t === t)) h += cell(k, B.b[k], this.ico(k, k === 'furnace' ? 2 : 1), BLD[k].n, TIER_NAMES[t]);
      return h + '</div>';
    }
    if (tab === 'r') {
      if (pick && RES[pick]) { const d = RES[pick], have = B.r[pick]; detail = `<div class="bkdet"><span class="bkp big">${RICON[pick]}</span><span><b>${have ? d.n : '？？？'}</b><small>${TIER_NAMES[d.t]} · ${d.raw ? '땅에서 뽑은' : '가공를 원한다'}</small><p>${have ? `아니요.${have}두 번째 북쪽 여행에서 처음으로 얻었습니다. 이 프로세스의 누적 출력${fmt(S.stats.prod[pick] || 0)}.` : `「${TIER_NAMES[d.t]}"이 지역의 보급품입니다.`}</p></span></div>`; }
      h += detail + '<div class="bkgrid res">';
      for (const k of RES_KEYS) h += cell(k, B.r[k], RICON[k], RES[k].n, TIER_NAMES[RES[k].t]);
      return h + '</div>';
    }
    if (tab === 'l') {
      LANDMARKS.forEach((l, i) => { const id = 'L' + i; h += card(B.l[id], '🚩', l.n, `위도${l.row}${B.l[id] ? `· 아니요.${B.l[id]}북쪽 방향 도착` : ''}`, B.l[id] ? l.desc : '', id); });
      FAR_MARKS.forEach((f, i) => { const id = 'F' + i; h += card(B.l[id], '🗿', f.n, `원거리 · 위도${f.row}${B.l[id] ? `· 유물${f.relic.n}」` : ''}`, B.l[id] ? f.desc : '', id); });
      return h;
    }
    if (tab === 'p') {
      for (const sp of SPECS) h += card(B.p[sp.id], this.cIco('spec_' + sp.id, '🧑‍🔧'), sp.n, `${sp.role}${B.p[sp.id] ? '' : sp.row == null ? '· 진료소는 당신이 그것을 건설한 후에 당신에게 올 것입니다' : `· 위도${sp.row}영역`}`, B.p[sp.id] ? sp.story : '', sp.id);
      return h;
    }
    if (tab === 's') {
      for (const x of Sim.SIGHTS) h += card(B.s[x.id], x.ic, x.n, B.s[x.id] ? `북쪽으로 ${B.s[x.id]} 여행에서 확인함` : `단서: ${x.how}`, B.s[x.id] ? x.d : '', x.id);
      return h;
    }
    return h;
  }

  p_migrate(part) {
    const S = this.S, J = Sim.journeyOf(S);
    if (part === 'title') return J.trip ? '행렬이 이동 중입니다.' : '북상';
    let h = '';
    if (J.trip) return h + this.tripHtml(J.trip);
    const g = Sim.departGate(S);
    if (!g) return h + `<div class="story">${esc(STORY.trueEnd || '')}</div><div class="hint">세계의 척추까지 걸어갔습니다. 북쪽으로 더 가면 끝없이 펼쳐진 빙원이 있어 원하는 만큼 멀리 갈 수 있습니다. </div>`;
    const P = g.plan, V = Sim.VEH, main = Sim.mainCamp(S);
    const rl = Sim.ruleOf(g.next);
    h += `<div class="mighero"><div class="mgto">다음 정거장 · <b>${esc(g.next.n)}</b></div><small>${g.route.ok ? `길이 좀 길어요${Math.round(g.route.len)}그리드, 행렬가 떠납니다${Math.max(1, Math.round(P.secs / 60))}약 분` : '아직 탐색되지 않은 도로'}${g.next.far ? '' : `· 위도${Math.round(g.next.y)}`}</small>${rl ? `<div class="mgrule"><b>${rl.ic}지형:${esc(rl.n)}</b><span class="good">좋음:${esc(rl.good)}</span><span class="bad">나쁨:${esc(rl.bad)}</span></div>` : ''}</div>`;
    h += this.forkHtml(J);
    // 四条门槛
    h += `<div class="sec">출발 전 해야 할 일 <small class="mgn">${g.n}/4</small></div>`;
    const go = { route: '탐험해 보세요', chap: '장을 보세요', flvl: '용광로로 이동', car: '썰매 헛간으로 이동' };
    for (const it of g.items) h += `<div class="row mgate ${it.ok ? 'ok' : ''}"><span><b class="mgt"><i class="mgk">${it.ok ? '✓' : ''}</i>${esc(it.t)}</b><small>${esc(it.sub)}</small></span>${it.ok ? '' : `<button class="small" data-act="gatego" data-arg="${it.id}">${go[it.id]}</button>`}</div>`;
    // 车队装载
    h += `<div class="sec">행렬</div>`;
    const mc = P.camps.find(c => c.main);
    h += `<div class="row"><span>길 위의 사람들<small>${mc && mc.mode === 'douse' ? `본영 엔진 종료: 유지${mc.stay}사람들이 불을 지키고, 행렬가 이를 따라잡기 위해 여기에 있습니다.` : `본영 스테이${mc ? mc.stay : 0}유인 보급창(적어도${Sim.DEPOT_MIN}사람들)`}</small></span><span class="stepper">${mc && mc.mode !== 'douse' ? `<button data-act="mstay" data-arg="5">−</button>` : ''}<b>👥${P.people}</b>${mc && mc.mode !== 'douse' ? `<button data-act="mstay" data-arg="-5">＋</button>` : ''}</span></div>`;
    if (P.specs.length) h += `<div class="row sub"><span>전문가</span><span>${P.specs.length} 같이 가자</span></div>`;
    const fl = J.fleet, vs = Sim.VEH_KEYS.filter(v => (fl[v] || 0) || (v === 'sled')).map(v => `${Sim.vehName(v)} ${P.veh[v] || 0}/${fl[v] || 0}`).join(' · ');
    h += `<div class="row"><span>자동차<small>${vs}(중고/사용 가능)</small></span><span>${fmt(P.load)} / ${fmt(P.cap)}주</span></div>`;
    h += `<div class="bar ${P.roomOk ? '' : 'over'}"><i style="width:${Math.min(100, P.load / Math.max(1, P.cap) * 100).toFixed(0)}%"></i></div>`;
    if (!P.roomOk) h += `<div class="row sub"><span></span><span class="miss">아직 ${fmt(P.lack)}의 공간이 남아 있습니다. 썰매 헛간에서 자동차를 더 만들거나 물품을 적게 가져오세요</span></div>`;
    // 货：每样都能加减，点炉的材料和路上的口粮燃料另算
    h += `<div class="sec">상품 가져오기 <button class="small ghost" data-act="mgoodreset">추천 벨트 누르기</button></div>`;
    const keys = Object.keys(P.goods).filter(k => P.goods[k] > 0);
    for (const k of keys) {
      const n = P.goods[k], st = Math.max(10, Math.pow(10, Math.floor(Math.log10(Math.max(10, n)))) / 2), have = Math.floor(main.stock[k] || 0), need = P.need[k] || 0;
      h += `<div class="row mgood"><span>${RICON[k]} ${RES[k].n}<small>Cully ${fmt(have)}${need > have ? '· <b class="miss">충분하지 않습니다</b>' : ''}</small></span><span class="stepper"><button data-act="mgood" data-arg="${k}:${-st}">−</button><b>${fmt(n)}</b><button data-act="mgood" data-arg="${k}:${st}">+</button></span></div>`;
    }
    const extra = RES_KEYS.filter(k => !keys.includes(k) && (main.stock[k] || 0) >= 10 && RES[k].t <= S.known);
    if (extra.length) h += `<div class="row sub"><span>하나 더 가져오기</span><span><select data-act="mgoodadd"><option value="">하나 선택...</option>${extra.map(k => `<option value="${k}">${RES[k].n}(카레${fmt(main.stock[k])}）</option>`).join('')}</select></span></div>`;
    const sup = Object.keys(P.supplies).map(k => `${RICON[k]}${fmt(P.supplies[k])}`).join(' '), kit = Object.keys(P.kit).map(k => `${RICON[k]}${fmt(P.kit[k])}`).join(' ');
    h += `<div class="row sub"><span>길에서 탄 음식</span><span>${sup}(자동 계산)</span></div>`;
    h += `<div class="row sub"><span>새 용광로 클릭</span><span>${kit}(자동 계산)</span></div>`;
    if (P.short.length) h += `<div class="row sub"><span></span><span class="miss">본영 라이브러리가 충분하지 않습니다: ${esc(P.short.join('，'))}</span></div>`;
    h += `<div class="hint">도로 위의 어떤 것들은 자동차의 화물을 사용해야 합니다. 다리 건설 비용은 목판(아이스필드 균열 비용 강재), 캠프 설치 비용 연료, 늑대에게 던지는 비용 생고기입니다. 조금 더 가져오면 때가 되면 여분의 길이 생길 것입니다. </div>`;
    // 后面的营地：留守还是熄火
    h += `<div class="sec">야영지 뒤</div>`;
    for (const c of P.camps) {
      const em = Sim.douseEmbers(S, c.lvl);
      h += `<div class="mcamp"><div class="row"><span><b>${esc(c.name)}${c.main ? '<i class="tagm">본영</i>' : ''}</b><small>👥${c.people}·용광로${c.lvl}레벨</small></span></div>
        <div class="seg"><button class="btn ${c.mode !== 'douse' ? 'on' : ''}" data-act="mmode" data-arg="${c.id}:keep">유지<small>${c.main ? `${Math.max(Sim.DEPOT_MIN, c.stay)}명 남김` : '보급 창고로 전환'}, 화물은 물류망으로</small></button><button class="btn ${c.mode === 'douse' ? 'on' : ''}" data-act="mmode" data-arg="${c.id}:douse">끄기<small>🔥${em}(으)로 교환, 인원은 따라옴</small></button></div></div>`;
    }
    // 路上的天气：极光观测站以后看得到
    if (J.stage >= 9 && g.route.ok) {
      const wx = Sim.tripWeather(S, P.secs);
      h += `<div class="row sub"><span>도로 날씨</span><span>${wx ? `<b class="miss">출발 약 ${Math.max(1, Math.round(wx.at / 60))}분 후 눈보라</b>를 만나 행렬이 멈춰서 결정을 내려야 합니다.` : '이 도로에는 눈보라가 없습니다'}</span></div>`;
    }
    if (g.route.ok) h += `<button class="btn wide ghost" data-act="routeprev">지도에서 경로 보기</button>`;
    h += `<button class="btn wide ${g.ok ? 'go' : ''}" data-act="depart" ${g.ok ? '' : 'disabled'}>${g.ok ? `갑시다"${esc(g.next.n)}」` : `충분하지 않음${4 - g.n}출발하다`}</button>`;
    return h;
  }
  // 1.1 分岔北境：去下一站的几条路；这一站的奇遇
  forkHtml(J) {
    const S = this.S, N = Sim.northN(J.stage); if (!N) return '';
    let h = '';
    const F = Sim.forkOf(S);
    if (F) {
      const n = Sim.forkN(S);
      h += `<div class="sec">경로 선택 <small class="mgn">정찰 병사들이 ${n}${n < 3 ? '· 연구 "세 갈래 정찰" 하나 더' : ''}</small>을 되찾아옵니다</div><div class="fkl">`;
      F.opts.slice(0, n).forEach((o, i) => {
        const rl = NORTH_RULES[o.rule], on = F.pick === i, q = QY[o.qy];
        h += `<div class="fko ${on ? 'on' : ''}"><div class="fkh"><b>${rl.ic} ${esc(rl.n)}${o.rich ? `<small>${esc(RES[SPOTS[o.rich].res].n)}</small>` : ''}</b><i class="fkd d${o.d}">${FORK.dn[o.d]}</i></div>`
          + `<div class="fkr"><span class="good">좋음: ${esc(rl.good)}</span><span class="bad">나쁨: ${esc(rl.bad)}</span></div>`
          + `<div class="fkg"><span>전문 분야<b>${esc(Sim.forkSpec(o))}</b></span><span>기연<b>${this.qyIco(o.qy, q.ic)} ${esc(q.n)}</b></span><span>혜택<b>${esc(Sim.bonusTxt(o.bonus, o.d))}</b></span><span>목표<b>×${FORK.diff[o.d]}</b></span></div>`
          + (on ? '<div class="fkon">✓ 이쪽으로 가세요</div>' : `<button class="small" data-act="forkpick" data-arg="${i}">이 ${F.pick == null && i === 0 ? '(선택하지 않으면 그대로 두세요)' : ''} 선택</button>`) + '</div>';
      });
      h += `</div><div class="hint">다음 정류장 위치는 변경되지 않습니다. 어느 쪽을 선택하든 그에 따라 그 땅이 재생성될 것입니다. 험난한 길의 도로 목표는 1.5% 더 높습니다(보상 ×${FORK.rew[2]}). 수월한 길의 도로 목표는 10% 더 낮습니다(보상 ×${FORK.rew[0]}). 출발하기 전에 변경할 수 있습니다. </div>`;
    } else if (N) {
      h += `<div class="row sub"><span>🧭 다음 정류장으로 가는 길</span><span>${N <= Sim.TOWER_N ? '이 스테이션에서 봉화탑를 밝힌 후 정찰 병사들은 선택할 수 있는 여러 경로를 다시 가져올 것입니다.' : '이 장을 마친 후 정찰 병사들은 선택할 수 있는 여러 경로를 다시 불러올 것입니다.'}</span></div>`;
    }
    const q = Sim.qyOf(S);
    if (q) {
      const Q = QY[q.id], w = Sim.qyWait(S);
      h += `<div class="row"><span>${this.qyIco(q.id, Q.ic)}기연<small>이 정류장에서${esc(Q.n)}</small></span>${q.done ? `<span>${q.miss ? '놓쳤다' : '걷기를 마쳤다'}</span>` : w ? `<span>${q.away ? `${q.away}사람들은 밖에 있고,` : ''}${fmtTime(w.left)}뒤쪽에${q.st ? '다음이 있습니다' : '나타나다'}</span>` : '<button class="small go" data-act="qyopen">결정하기</button>'}</div>`;
    }
    return h;
  }
  // 车队在路上：进度、路上的事、跟着看；到了以后去放熔炉
  tripHtml(T) {
    const S = this.S, st = Sim.stopOf(S, T.to), left = T.phase === 'arrive' ? 0 : (T.len - T.d) / Math.max(1e-6, T.speed) + (T.hold || 0);
    let h = `<div class="mighero"><div class="mgto"><b>로 이동${esc(st.n)}</b>」</div><small>${T.phase === 'arrive' ? '행렬가 도착했습니다' : `다 쓴${Math.round(T.d / T.len * 100)}% · 더${fmtTime(left)}~에 대한`}</small></div>`;
    h += `<div class="bar"><i style="width:${(T.d / T.len * 100).toFixed(0)}%"></i></div>`;
    const vs = Sim.VEH_KEYS.filter(v => T.veh[v]).map(v => `${Sim.vehName(v)} ${T.veh[v]}`).join(' · ');
    h += `<div class="row"><span>차에서</span><span>👥${T.people}${T.specs.length ? `·전문가${T.specs.length}` : ''} · ${vs}</span></div>`;
    if (T.sick) h += `<div class="row sub"><span></span><span>${T.sick} 사람 동상, 도착하면 먼저 회복하세요</span></div>`;
    if (T.phase === 'arrive') {
      h += `<div class="hint">"${esc(st.n)}" 근처의 평평한 땅을 선택하고 새 용광로를 내려놓으세요. 자동차에 탄 사람과 물건이 새로운 본영의 시작입니다. ${Math.max(0, Math.ceil(Sim.ARRIVE_AUTO - (S.t - T.at)))}을 몇 초 내에 선택하지 않으면 권장 위치에 배치됩니다. </div>`;
      return h + `<button class="btn wide go" data-act="arrive">가서 용광로 넣어</button>`;
    }
    if (T.road) h += `<button class="btn wide go" data-act="roadopen">행렬 중지됨: ${esc(Sim.roadView(S).title)} · 결정하세요</button>`;
    else if (T.hold > 0) h += `<div class="row sub"><span></span><span>행렬이 캠핑 중이며 기다리고 있습니다. ${Math.ceil(T.hold)}초가 걸립니다</span></div>`;
    if ((T.done || []).length) h += `<div class="sec">길 위의 일들</div>` + T.done.map(([id, i]) => `<div class="row sub"><span>${esc(Sim.roadName(id))}</span><span>${i === 0 ? '안전하게 플레이하세요' : '다른 방법을 선택하세요'}</span></div>`).join('');
    h += `<div class="hint">행렬이 도로에 있을 때 뒤에 있는 야영지는 평소처럼 작동합니다. 행렬 페이지를 닫고 계속 진행하세요. 아무도 길 위의 일에 잠시 관심을 두지 않으므로 안전하게 플레이하세요. </div>`;
    h += `<button class="btn wide ${this.g.view.followTrip ? '' : 'go'}" data-act="followtrip">${this.g.view.followTrip ? '더 이상 팔로우하지 마세요' : '시청하려면 행렬를 팔로우하세요.'}</button>`;
    return h;
  }
  // 余烬强化：永久的，跟着一路叠上去；通关以后可以开新的北行
  emberHtml() {
    const S = this.S;
    let h = `<div class="row"><span>잔불 보유</span><b>🔥 ${Math.floor(S.meta.embers)}</b></div>`;
    h += `<div class="hint">잔불은 다음 장소에서 나옵니다: 정지된 야영지(용광로 레벨당 2포인트), 처음으로 랜드마크에 도착, 장, 업적 완료, 도로 위의 물건, 캐러밴 주문 및 야영지 커미션 완료. </div>`;
    for (const k in EMBER_UPS) {
      const u = EMBER_UPS[k], lv = Sim.up(S, k), cost = emberCost(k, lv);
      h += `<div class="row"><span><b>${u.n}</b> ${lv}/${u.max}<br><small>${u.d}</small></span><span>${lv >= u.max ? '가득한' : `<button class="small ${S.meta.embers >= cost ? 'go' : ''}" data-act="ember" data-arg="${k}">🔥${cost}</button>`}</span></div>`;
    }
    if (S.meta.graduated) h += `<div class="sec">새로운 북쪽 방향</div><div class="hint">영원의 용광로가 켜졌습니다. 잿빛 야영지부터 다시 시작할 수 있습니다: 잔불 강화, 전문가, 컬렉션 북과 유물을 모두 가져갈 수 있으며, 더 어려운 난이도로 변경할 수도 있습니다. </div><button class="btn wide" data-act="newjourney">북쪽으로 새로운 여행을 시작하세요</button>`;
    return h;
  }

  // 菜单 › 设置：声音、画面、提示、难度
  p_menu(part) {
    const S = this.S;
    if (part === 'title') return '설정';
    const g = this.g;
    const tg = (k, on, ic, n, d) => `<button class="tgl ${on ? 'on' : ''}" data-act="snd" data-arg="${k}"><span class="ti">${ic}</span><span class="tt">${n}<small>${d}</small></span><i class="sw"></i></button>`;
    let h = `<div class="sec">사운드 및 그림</div><div class="tgls">${tg('sfx', g.audio.sfxOn, '🔊', '음향 효과', '바람, 불, 구타')}${tg('music', g.audio.musicOn, '🎵', '음악', '낮은 멜로디와 벨소리')}<button class="tgl ${this.floatOn !== false ? 'on' : ''}" data-act="floats"><span class="ti">✨</span><span class="tt">플로팅 문자 생성<small>"+5 🪵"이 건물 위에 표시됨</small></span><i class="sw"></i></button><button class="tgl ${S.meta.hintOff ? '' : 'on'}" data-act="hintsw"><span class="ti">📜</span><span class="tt">새로운 게임플레이 팁<small>특정 게임플레이를 처음 사용할 때 말해주세요</small></span><i class="sw"></i></button><button class="tgl ${g.sugOn ? 'on' : ''}" data-act="sugsw"><span class="ti">⭐</span><span class="tt">추천 위치<small>마크 3 건물을 배치할 때 지상에 좋은 위치</small></span><i class="sw"></i></button></div>`;
    h += `<div class="mlab">인터페이스 색상 매칭<small>날씨에 따르세요: 눈보라 및 한파는 때로는 춥고 보통 따뜻합니다.</small></div>`;
    h += `<div class="seg">${THEMES.map(([k, n, d]) => `<button class="btn ${g.theme.pref === k ? 'on' : ''}" data-act="theme" data-arg="${k}">${n}<small>${d}</small></button>`).join('')}</div>`;
    if (g.pc && g.pc.on) { // 电脑版才有：界面大小
      h += `<div class="mlab">인터페이스 크기<small>자동: 1080p의 경우 100%, 2K 이상에서는 125%</small></div>`;
      h += `<div class="seg">${ZOOMS.map(([k, n, d]) => `<button class="btn ${g.pc.zp === k ? 'on' : ''}" data-act="uiscale" data-arg="${k}">${n}${d ? `<small>${d}</small>` : ''}</button>`).join('')}</div>`;
    }
    h += `<div class="mlab">이미지 품질<small>멈추면 자동으로 한 단계씩 떨어집니다.</small></div>`;
    h += `<div class="seg">${[['low', '매끄러운', '그림자 없음'], ['high', '표준', '추천하다'], ['ultra', '극심한', '자세한 내용']].map(([k, n, d]) => `<button class="btn ${g.quality === k ? 'on' : ''}" data-act="quality" data-arg="${k}">${n}<small>${d}</small></button>`).join('')}</div>`;
    h += `<div class="sec">게임 방법</div><div class="row"><span>난이도 <b>${Sim.diffOf(S).ic}${Sim.diffOf(S).n}</b><br><small>언제든지 변경 가능</small></span><span style="flex:none"><button class="small" data-act="diff">난이도 변경</button></span></div>`;
    h += `<div class="mfoot">차가운 잔불의 북행 · ${VERSION_NAME}</div>`;
    return h;
  }
  // 菜单 › 存档：自动保存、存档码、备份、存档位
  p_msave(part) {
    const S = this.S, g = this.g;
    if (part === 'title') return `저장 <small>저장 비트 ${g.slot} / ${SLOTS}</small>`;
    const ago = S.savedAt ? Math.max(0, (Date.now() - S.savedAt) / 1000) : null;
    return `<div class="msave"><span class="msi">💾</span><span>이 기기에 자동 저장${ago != null ? `<em>${ago < 60 ? '단지' : ago < 3600 ? Math.floor(ago / 60) + '몇 분 전' : ago < 86400 ? Math.floor(ago / 3600) + '몇 시간 전' : Math.floor(ago / 86400) + '며칠 전'}저장됨</em>` : ''}<small>페이지를 닫은 후 야영지는 평소대로 작동하고 눈보라 및 습격도 평소대로 정착합니다. 단, 오프라인의 경우 부재 기간에 따라 재료가 할인됩니다. 최초 1시간은 40%, 1~4시간은 20%, 4~12시간은 10%, 12시간 이상은 10%입니다. 시간은 더 이상 중요하지 않습니다. 삼성의 생산 라인은 절반 정도만 차지하고 오프라인의 저장 용량은 창고의 최대 80%에 이릅니다. </small></span></div>
      <div class="row2"><button class="btn" data-act="export">📤 저장 코드 내보내기</button><button class="btn" data-act="import">📥 저장 코드 가져오기</button></div>
      <div class="hint">기기를 변경할 때 기존 기기에서 저장 코드를 내보내고 새 기기에서 가져오세요. </div>${this.bkRow()}<div class="row"><span>저장 비트 <b>${g.slot}</b> / ${SLOTS}<br><small>3개의 저장 위치, 각각은 원형입니다.</small></span><span style="flex:none"><button class="small" data-act="slots">저장 위치 변경</button></span></div>
      <div class="mdanger"><button class="btn ghost" data-act="wipe">이 저장를 삭제하고 처음부터 시작하세요</button></div>`;
  }
  // 菜单 › 收藏：收集册、成就、装扮、相册、拍照、曲线
  p_mcoll(part) {
    const S = this.S;
    if (part === 'title') return '모으다';
    let h = '';
    { const N = Sim.bookCount(S), nf = Sim.bookOf(S).fresh.length;
      h += `<button class="mlink book" data-act="book"><span>🏆</span><span>컬렉션북${nf ? `<b class="mnew">${nf}신규</b>` : ''}<small>수집${N.got}/${N.all}·업적${N.cats.a[0]}/${N.cats.a[1]}(북상 이후에도 유지됨)</small></span><i>></i></button>`; }
    if (Sim.skyEnded(S)) h += `<button class="mlink" data-act="skyreplay"><span>🔥</span><span>Skyfire를 다시 시청하세요<small>10개의 빛 광선이 남쪽으로 영원의 용광로까지 갔다가 보기 "이쪽으로" 갑니다</small></span><i>></i></button>`;
    { const B = Sim.bookOf(S), got = Sim.ACH.filter(x => B.a[x.id]).length, nf = B.fresh.filter(f => f.startsWith('a:')).length;
      h += `<div class="mrow2"><button class="mlink" data-act="ach"><span>🏆</span><span>업적${nf ? `<b class="mnew">${nf}신규</b>` : ''}<small>${got}/${Sim.ACH.length}· 카테고리별 진행상황 보기 및 보상</small></span><i>></i></button><button class="mlink" data-act="dress"><span>🎨</span><span>장식<small>칭호, 불, 깃발, 액자</small></span><i>></i></button></div>`; }
    if (!this.album) this.loadAlbum();
    h += `<div class="mrow2"><button class="mlink" data-act="photo"><span>📷</span><span>사진 모드<small>인터페이스 숨기기, 시간, 필터, 사진 프레임 변경, 사진 찍기<span class="kh">(H)</span></small></span><i>></i></button><button class="mlink" data-act="album"><span>📔</span><span>앨범<small>${this.album ? `${this.album.length}열려 있는 ·` : ''}도중에 자동으로 찍은 것과 수집한 것 </small></span><i>></i></button></div>`;
    h += `<button class="mlink" data-act="curve"><span>📈</span><span>데이터 곡선<small>인구, 분위기, 온도, 재료 보유량 및 생산량이 어떻게 변경되었는지<span class="kh">(G)</span></small></span><i>></i></button>`;
    return h;
  }
  // 菜单 › 帮助：玩法说明、更新日志、按键
  p_mhelp(part) {
    if (part === 'title') return `<small>${VERSION_NAME}</small> 도와주세요`;
    const keys = [['1 – 5', '야영지 · 생산 · 건설 · 연구 · 북행'], ['Esc/오른쪽 클릭', '창 닫기'], ['J', '계획'], ['공간', '다시 불로'], ['B', '건설'], ['M', '북쪽 방향 지도'], ['C', '생산 체인'], ['G', '데이터 곡선'], ['K', '컬렉션 북'], ['H', '사진'], ['P', '정지시키다'], ['F', '속도 변경'], ['+ / −', '확대/축소'], ['Q / E', '카메라를 돌려'], ['WASD', '움직이는 카메라']];
    return `<button class="mlink" data-act="changelog"><span>📜</span><span>변경 로그<small>${VERSION_NAME}· 각 에디션에 추가되는 내용</small></span><i>></i></button>
      <div class="help">${HELP}</div>
      <div class="sec">컴퓨터의 키</div><div class="keys">${keys.map(([k, n]) => `<span><kbd>${k}</kbd>${n}</span>`).join('')}</div>
      <div class="hint">휴대폰: 두 손가락을 모아 확대/축소하고 카메라를 회전합니다. 일시 정지하려면 속도 키를 길게 누르세요. </div>`;
  }
  // 北行 › 烽火塔：这一路走到哪了、北境的塔、地标和北行纪事
  p_towers(part) {
    const S = this.S, st = S.stats;
    if (part === 'title') return `봉화탑 <small>조명 ${Sim.towersLit(S)} / ${Sim.TOWER_N}</small>`;
    const top = LANDMARKS[LANDMARKS.length - 1].row, far = Math.round(Math.max(...S.camps.map(c => c.y)));
    const known = Math.max(S.known, ...S.discovered);
    const next = LANDMARKS.findIndex((l, i) => !S.founded.includes(i) && l.row > far);
    const people = S.camps.reduce((a, c) => a + c.people, 0);
    let h = `<div class="mjour">
      <div class="mjh"><div><div class="mjt">${S.meta.runs}번째 북행</div><small>이번 여정 ${fmtTime(S.t)} 진행${Sim.skyEnded(S) ? '· 🔥 하늘의 불이 켜졌습니다' : S.meta.graduated ? '· 🌟 점화 영원의 용광로' : ''}</small></div>
        <div class="mje" title="잔불：북상일 때 다음 여행에 영구 보너스 제공"><b>🔥${fmt(S.meta.embers)}</b><small>잔불</small></div></div>
      <div class="route"><i class="rl"><i style="너비:${Math.min(100, far / top * 100).toFixed(1)}%"></i></i>
        ${LANDMARKS.map((l, i) => { const cls = S.founded.includes(i) ? 'on' : S.discovered.includes(i) ? 'seen' : ''; return `<span class="rn ${cls} ${i === next ? 'next' : ''} ${i % 2 ? 'up' : ''}" style="left:${(l.row / top * 100).toFixed(1)}%"><em></em><small>${i <= known || cls ? l.n : '？'}</small></span>`; }).join('')}</div>
      <div class="mnext">${Sim.northN(Sim.journeyOf(S).stage) ? `🧭 <b>${esc(northRec(S))}</b> · 다음 정거장:${esc(Sim.stopOf(S, Sim.journeyOf(S).stage + 1).n)}` : next >= 0 ? `다음 정거장:<b>${LANDMARKS[next].n}</b>(위도${LANDMARKS[next].row}, 이제 북쪽으로${far}）${S.meta.northMax ? `<br><small>🧭 ${esc(northRec(S))}</small>` : ''}` : `모든 랜드마크를 걸었습니다.${S.meta.northMax ? ` 🧭 ${esc(northRec(S))}` : '세계의 척추를 뒤집으면 북방가 나옵니다.'}`}</div>
      <div class="mstats">
        <span><b>${people}</b>인구</span><span><b>${S.camps.length}</b>야영지</span><span><b>${S.buildings.length}</b>건물</span>
        <span><b>${st.arrivals}</b>탈북한 사람들</span><span class="${st.deaths ? 'neg' : ''}"><b>${st.deaths}</b>사람들이 사망했습니다</span><span><b>${st.raidsWon}/${st.raids}</b>습격 유지</span>
      </div>
    </div>`;
    // 十座塔
    const N = Sim.northN(Sim.journeyOf(S).stage), lit = Sim.towerList(S);
    h += `<div class="sec">북방의 타워 <small>처음 10개의 스테이션 각각에 하나씩, 10번째 스테이션은 천화탑입니다</small></div><div class="twlist">`;
    for (let n = 1; n <= Sim.TOWER_N; n++) {
      const L = lit.find(t => t.n === n), b = !L && S.buildings.find(x => x.tn === n && BLD[x.type].tower);
      let stx = '', cls = '';
      if (L) { stx = '문학'; cls = 'lit'; }
      else if (b) { const sp = Sim.towerSpec(S, n); stx = b.tw.p >= sp.dur ? '타워 본체가 준비되어 조명을 기다리고 있습니다.' : `타워 본체 ${Math.floor(b.tw.p / sp.dur * 100)}%`; cls = 'on'; }
      else if (N === n) { stx = '이 중지: 기초 설정'; cls = 'here'; }
      else stx = n < N ? '미확립' : `북방번째 역 ${n}`;
      h += `<div class="twr ${cls}" ${b ? `data-act="spot" data-arg="${b.id}"` : ''}><i>${n === Sim.TOWER_N ? '☀' : n}</i><span><b>${Sim.towerName(n)}</b><small>${stx}</small></span>${b ? '<em>›</em>' : ''}</div>`;
    }
    h += `</div><div class="hint">각 조명 타워는 야영지희망 +${TOWER_FX.hope}, 난방권 +${TOWER_FX.warm} 그리드를 만듭니다. 10번째 스테이션에서 천화탑을 조명하는 것이 최종 결과입니다. </div>`;
    h += `<div class="sec">길을 따라 있는 랜드마크</div><div class="journey">`;
    LANDMARKS.forEach((l, i) => {
      const st2 = S.founded.includes(i) ? 'done' : S.discovered.includes(i) ? 'seen' : '';
      h += `<div class="jstep ${st2}" data-act="${S.discovered.includes(i) ? 'lmgo' : ''}" data-arg="${i}"><span>${st2 === 'done' ? '🏁' : st2 === 'seen' ? '📍' : '❔'}</span>${i <= known || st2 ? l.n : '？？？'}</div>`;
    });
    h += `</div><button class="mlink" data-act="chapter"><span>📖</span><span>Northbound Chronicle<small>정류장마다 새로운 장이 열립니다</small></span><i>></i></button>`;
    return h;
  }
  // 生产 › 产线：主线和支线，各自的速度、星级和下一颗星
  pf_plines() { return '<button class="btn" data-act="chainmap">🔗 생산 체인 맵</button><button class="btn go" data-act="pladd">+ 수직 지선</button>'; }
  p_plines(part) {
    const S = this.S, L = Sim.plinesOf(S);
    if (part === 'title') return `생산 라인 <small>메인 라인 + 지선 ${Sim.sideCount(S)}/${Sim.sideMax(S)}</small>`;
    const fr = v => v >= 10 ? Math.round(v) : Math.round(v * 10) / 10, mm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    let h = '';
    if (!L.length) return h + `<div class="hint">아직 생산 라인이 없습니다. 각 챕터의 생산력 목표는 자동으로 메인 라인으로 설정됩니다. 재료를 선택해 분기선을 설정할 수도 있으며, 목표 속도를 안정시키면 별이 떠오릅니다. </div>`;
    for (const l of L) {
      const r = Sim.prodRate(S, l.r), pct = Math.min(1, r / Math.max(0.01, l.n)), nx = l.star < 3 ? Sim.STAR_T[l.star] - l.st : 0;
      h += `<div class="plrow ${l.on ? 'up' : ''}" data-act="plan" data-arg="${l.r}"><span class="pli">${RICON[l.r]}</span><span class="plt"><b>${RES[l.r].n}${l.main ? '<em>메인 라인</em>' : ''}<i class="stars">${'★'.repeat(l.star)}${'☆'.repeat(3 - l.star)}</i></b>
        <span class="plbar"><i style="width:${(pct * 100).toFixed(1)}%"></i></span>
        <small>${fr(r)} / ${fr(l.n)}분당 ·${l.star >= 3 ? '이미 삼성' : `꾸준히 버티세요${mm(nx)}승강기${l.star + 1}별${l.on ? '' : '(넘어짐, 일시중지됨)'}`}</small></span><em>›</em></div>`;
    }
    h += `<div class="hint">속도가 목표 이상으로 안정되면 10분에 별 1개(생산량 +15%), 30분에 별 2개(좌석당 일꾼 1개 이상), 90분에 별 3개(생산량 +30%)로 늘어납니다. 라인을 클릭하여 플래너를 열고 전체 체인의 각 링크에 얼마나 많은 차이가 있는지 확인하세요. </div>`;
    return h;
  }
  // 建造 › 规划：每条线最卡的那一环还差几座，直接建
  p_plan(part) {
    const S = this.S, L = Sim.plinesOf(S);
    if (part === 'title') return '계획 <small>방향만 지적하고 어디에 구축할지 결정합니다</small>';
    const fr = v => v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    let h = '';
    if (!L.length) return `<div class="hint">이 장에는 아직 생산력 대상이 없습니다. 먼저 상단의 목표를 따르세요. "분당 생산량"을 목표로 여기에서는 각 링에 몇 단위가 남아 있는지 계산합니다. </div><button class="btn wide" data-act="plan">오픈 플래너</button>`;
    for (const l of L) {
      const P = Sim.planLine(S, l.r, l.n), x = P.worst;
      h += `<div class="pcard"><div class="pch">${RICON[l.r]}<b>${RES[l.r].n}${l.main ? '본선' : '지선'}</b><small>분당 ${fr(P.rate)} / ${fr(l.n)}</small><button class="small" data-act="plan" data-arg="${l.r}">Planner ›</button></div>`;
      if (!x) { h += `<div class="pcok">✓ 모든 단계를 따라가세요</div></div>`; continue; }
      const t = x.type, per = x.count && x.prod > 0 ? x.prod / x.count : x.one, nb = t ? Math.max(1, Math.ceil(x.gap / Math.max(0.1, per))) : 0;
      const short = Object.keys(x.stat).filter(k => k.startsWith('부족')).map(k => k.slice(1));
      h += `<div class="pcw"><span>${RICON[x.k]}</span><span><b>가장 막힌 부분:${RES[x.k].n}</b><small>현재${fr(x.prod)}/ 원하다${fr(x.need)}분당${t ? ` · ${BLD[t].n} ×${x.count}` : ''}</small>${x.count && short.length ? `<small class="warn">업스트림입니다.${short.join('、')}충분하지 않습니다. 먼저 업스트림을 보충하세요</small>` : t && x.gap >= 0.05 ? `<small>아직 <b>에 대해${nb}</b> 좌석${BLD[t].n}</small>` : ''}</span>${t && Sim.unlocked(S, t) && x.gap >= 0.05 ? `<button class="small go" data-act="place" data-arg="${t}">하나 만들기</button>` : t && !Sim.unlocked(S, t) ? `<small class="bad">${BLD[t].n}아직 잠금 해제되지 않았습니다</small>` : ''}</div></div>`;
    }
    { const main = Sim.mainCamp(S); h += `<div class="hint">본영의 인구는 ${main.people}/${Sim.popCap(S, main)}이고 무료 ${Math.max(0, Sim.idleLabor(S, main))}명이 있습니다. 난방권에는 약 ${Sim.freeLand(S, main)} 블록의 빈 땅이 있습니다. </div>`; }
    return h;
  }
  // 建造 › 队列：等材料的建筑和升级，材料到齐按顺序自动开工
  p_bqueue(part) {
    const S = this.S, c = this.camp();
    const Q = (S.queue || []).filter(q => q.camp === c.id), U = S.buildings.filter(b => b.camp === c.id && b.qup);
    if (part === 'title') return `대기열 <small>${esc(c.name)} · ${Q.length + U.length}개 항목</small>`;
    if (!Q.length && !U.length) return `<div class="hint">재료를 기다리는 건물이 없습니다. 건물을 배치할 때 재료가 충분하지 않은 경우 건물(청사진)을 먼저 배치하면 재료가 도착하자마자 자동으로 건설이 시작됩니다. 건물 패널의 "재료를 사용할 수 있을 때 자동 업그레이드"도 여기에 나열됩니다. </div>`;
    let h = '';
    if (Q.length) h += `<div class="sec">다른 재료를 사용한 신축 <small>${Q.length}/${Sim.QUEUE_MAX}</small></div>`;
    Q.forEach((q, i) => {
      const cost = Sim.queueCost(S, q), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
      h += `<div class="qrow"><span class="qn">${i + 1}</span>${this.ico(q.type, 1)}<span class="qt"><b>${BLD[q.type].n}</b><small>${miss.length ? '기타 재료:' + miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') + (this.netWait(c, miss[0]) ? `，${RES[miss[0]].n}${this.netWait(c, miss[0])}` : '') : '다 준비됐으니 바로 작업 시작하자'}</small></span><button class="small" data-act="lookat" data-arg="${q.x + BLD[q.type].size / 2},${q.y + BLD[q.type].size / 2}">보기</button><button class="small ghost" data-act="unqueue" data-arg="${q.id}">취소</button></div>`;
    });
    if (U.length) h += `<div class="sec">기타 자료 업그레이드</div>`;
    for (const b of U) {
      const cost = Sim.upgradeCost(S, b), miss = Object.keys(cost).filter(k => (c.stock[k] || 0) < cost[k]);
      h += `<div class="qrow"><span class="qn">↑</span>${this.ico(b.type, b.lvl)}<span class="qt"><b>${BLD[b.type].n} ${b.lvl}→${b.lvl + 1}수준</b><small>${miss.length ? '기타 재료:' + miss.map(k => `${RICON[k]}${fmt(cost[k] - (c.stock[k] || 0))}`).join(' ') + (this.netWait(c, miss[0]) ? `，${RES[miss[0]].n}${this.netWait(c, miss[0])}` : '') : '모두 함께 말이 올라간다'}</small></span><button class="small" data-act="openbld" data-arg="${b.id}">보기</button><button class="small ghost" data-act="qup" data-arg="${b.id}">취소</button></div>`;
    }
    return h;
  }
  // 提醒：眼下要留意的事一条一张卡；消息在旁边的页签
  p_alerts(part) {
    const S = this.S, A = this.alertsNow || [];
    if (part === 'title') return `알림 <small>${esc(this.camp().name)}</small>`;
    const act = A.filter(a => a.lvl !== 'info'), info = A.filter(a => a.lvl === 'info');
    let h = '';
    if (!act.length) h += `<div class="hint">지금은 할 일이 없습니다. </div>`;
    for (const a of act) h += this.alertCard(a);
    if (this.adv) h += this.alertCard({ ic: GMED, lvl: 'tip', t: '늙은 길잡이', d: this.adv.text, act: 'advisor', btn: this.advBtn(this.adv) });
    if (info.length) h += `<div class="sec">지금 이 순간</div>` + info.map(a => this.alertCard(a)).join('');
    const nl = S.log.length; h += `<button class="mlink" data-act="htab" data-arg="log"><span>📜</span><span>메시지 기록<small>최근 ${nl}: 일어난 모든 일이 여기에 있습니다</small></span><i>></i></button>`;
    return h;
  }
  alertCard(a) {
    return `<div class="alc ${a.lvl}"><span class="ali">${a.ic}</span><span class="alt"><b>${esc(a.t)}${a.cnt ? `<small>${a.cnt}</small>` : ''}</b><small>${esc(a.d)}</small></span>${a.act ? `<button class="small ${a.lvl === 'bad' ? 'go' : ''}" data-act="${a.act}" data-arg="${a.arg ?? ''}">${esc(a.btn || '가 보기')}</button>` : ''}</div>`;
  }

  p_spot(part) {
    const S = this.S, i = this.panel.arg, w = getWorld(S.runSeed);
    const k = SPOT_KEYS[w.spot[i]], sp = SPOTS[k];
    if (k === 'ruin') {
      // 古城废墟：不是矿，点一下派人拆
      if (part === 'title') return '🏛고성 폐허';
      const ck = Sim.ruinBlock(S, i), n = (ck.tiles || []).length, loot = Sim.ruinLoot(n), cost = Sim.ruinCost(n);
      if (!n) return '<div class="hint">여기 폐허는 철거되었습니다. </div>';
      return `<div class="row"><span>공간 점유</span><span>${n}벽 부수기</span></div>
        <div class="row"><span>해체하면 얻을 수 있습니다</span><span>${RICON.part}고대 부품${loot.part} · ${RICON.steel}강재${loot.steel}</span></div>
        <div class="row sub"><span>일손 배치 분해</span><span>${RICON.food}요리${cost.food}(일할 때는 다들 밥을 먹어야 해요)</span></div>
        <button class="go" data-act="ruin" data-arg="${i}" ${ck.why ? 'disabled' : ''}>이 폐허 철거</button>${ck.why ? `<div class="hint warn">${esc(ck.why)}</div>` : ''}<div class="hint">고성 유적의 무너진 벽이 난방 범위의 땅을 차지하고 있습니다. 철거하면 자유롭게 지을 수 있고 고대 부품과 강재도 얻습니다.</div>`;
    }
    if (part === 'title') return `${RICON[sp.res]} ${sp.n}`;
    const left = Sim.spotLeft(S, i), mx = Sim.spotMax(S, i), grow = !!Sim.REGROW[k];
    const GW = { tree: ['어린 나무', '자르다', '벌목장을 다시 심는 중입니다.'], herd: ['견습생', '이기다', '씨앗을 저장하는 사냥꾼'], dead: ['새로운 죽은 나무', '자르다', '벌목장이 처리하고 있습니다.'], fish: ['튀김', '어업', '얼음낚시 오두막이 처리하고 있습니다.'] }[k] || ['새로운', '선택하다', '돌봐줄 사람'];
    let g = '';
    if (grow) {
      const rate = Sim.regrowRate(S, i, Sim.tendedSpots(S)), tend = rate > Sim.REGROW[k] * 1.5, sap = Sim.isSapling(S, i);
      g = `<div class="row sub"><span>복원</span><span>${left >= mx ? '너무 크게 자란' : `+${fmt(rate)}/가리키다${tend ? ' · ' + GW[2] : ''}`}</span></div>`;
      if (sap) g += `<div class="row sub"><span>${GW[0]}</span><span>${GW[1]}을(를) 얻는 데 약 30%(${fmt(mx * Sim.SAP_RIPE)})가 소요되며 약 ${Math.max(1, Math.ceil((mx * Sim.SAP_RIPE - left) / Math.max(0.01, rate)))}분</span></div>`;
    }
    if (!grow && left > 0) {
      const by = Sim.minerOf(S, i);
      const eta = by ? Sim.gatherEta(S, by) : null;
      g += by ? `<div class="row sub"><span>파악</span><span>${BLD[by.type].n}${eta != null && eta > 0 ? `· 이 지역은 현재의 속도로 여전히 채굴할 수 있습니다.${fmtMin(eta)}` : ''}</span></div>` : `<div class="row sub"><span>아직 파낸 사람이 없습니다</span><span>옆에 ${BLD[Sim.gatherTypeFor(k)].n}를 건설하세요</span></div>`;
    }
    const gt = BLD[Object.keys(BLD).find(t => BLD[t].gather && BLD[t].gather.includes(k))];
    const why = { tree: '잘린 나무는 다시 자라납니다. 근처에 벌목장이 있으면 다시 심고 자라는 속도가 4배 빨라집니다.', herd: '사냥감은 연마 후 다시 돌아옵니다. 근처에 사냥꾼 오두막이 있으면 씨앗을 남기고 3배 더 빠르게 돌아옵니다.', dead: '동토에는 라이브 트리가 없고 고목 더미만 있습니다. 절단 후 돌풍과 눈이 불어 또 다른 더미가 날아갔습니다. 근처에 벌목장을 두어 처리하자 세 배 더 빨리 터졌습니다.', fish: '얼음 동굴의 물고기를 모두 잡히면 천천히 돌아옵니다. 얼음낚시 오두막이 근처에 있는 그들을 돌보면 세 배 더 빨리 돌아올 것입니다. 잡은 생선은 직접 먹습니다.' }[k] || '광물 매장지는 일단 채굴되면 사라질 것이고, 더 멀리 가야 할 것입니다.';
    return `<div class="row"><span>남은 보유량</span><span>${fmt(left)} / ${fmt(mx)} ${RES[sp.res].n}</span></div><div class="bar"><i style="width:${(left / mx * 100).toFixed(1)}%"></i></div>${g}
      <div class="hint">${why}채집 근처(${gt.reach} 셀 내)에 "${gt.n}"을(를) 건설하세요. </div>`;
  }

  p_chapter(part) {
    const S = this.S, chs = Sim.chapters(S);
    if (part === 'title') { const N = Sim.northN(Sim.journeyOf(S).stage); return N ? `북행 연대기 <small>${esc(northRec(S))}</small>` : `북방 여행 연대기 <small>${Math.min(CHAPTERS.length, Sim.journeyOf(S).stage + 1)}/${CHAPTERS.length}장</small>`; }
    let h = '';
    chs.slice().reverse().forEach((c, n) => {
      const open = n === 0 || (c.done && !c.got) || this.panel.arg === c.i;
      const nOk = c.tasks.filter(t => t.ok).length;
      if (!open) { h += `<div class="chrow" data-act="chapter" data-arg="${c.i}"><b>${esc(c.ch.n)}</b><span>${c.got ? '✓ 완료' : `${nOk}/${c.tasks.length}`}</span></div>`; return; }
      const rl = c.ch.rule && NORTH_RULES[c.ch.rule];
      h += `<div class="chcard ${c.got ? 'got' : c.done ? 'ready' : ''}"><div class="chh"><small>📍 ${esc(Sim.stopOf(S, c.i).n)}${rl ? ` · ${rl.ic} ${esc(rl.n)}` : ''}</small><b>${esc(c.ch.n)}</b></div><p class="story">${esc(c.got ? c.ch.end : c.ch.story)}</p><div class="ctasks">`;
      for (const t of c.tasks) {
        const pr = t.low ? (t.ok ? 1 : Math.max(0, Math.min(1, (100 - t.cur) / (100 - t.n)))) : Math.min(1, t.cur / t.n);
        h += `<div class="ctask ${t.ok ? 'ok' : ''}"><span class="ck">${t.ok ? '✓' : ''}</span><div><span>${esc(t.t)}</span>${t.ok ? '' : `<div class="mbar"><i style="width:${(pr * 100).toFixed(1)}%"></i></div><small>${t.low ? `현재 최고${fmt(t.cur)}` : `${fmt(t.cur)} / ${fmt(t.n)}`}</small>`}</div></div>`;
      }
      h += `</div><div class="crw">🎁 ${esc(Sim.chapterReward(S, c.i).join('，'))}</div>`;
      if (c.got) h += `<div class="cgot">✓ 보상이 수집되었습니다</div>`;
      else if (c.done) h += `<button class="btn wide go" data-act="chapclaim" data-arg="${c.i}">보상 수신("${esc(this.camp().name)}"로 전송됨)</button>`;
      h += `</div>`;
    });
    const nx = LANDMARKS.findIndex((l, i) => i > Math.max(...S.founded)), J = Sim.journeyOf(S);
    if (nx > 0 && !Sim.northN(J.stage)) h += `<div class="chrow next"><b>${esc(CHAPTERS[nx].n)}</b><span>"${esc(LANDMARKS[nx].n)}"이 용광로를 빌드한 후 시작</span></div>`;
    if (J.stage >= Sim.SPINE) { const st = Sim.stopOf(S, J.stage + 1), rl = st && NORTH_RULES[st.rule]; if (st) h += `<div class="chrow next"><b>${esc(st.n)}</b><span>${rl ? `${rl.ic} ${esc(rl.n)} · ` : ''}행렬 도착 시 시작</span></div>`; }
    h += `<div class="hint">${Sim.northN(J.stage) ? '북방의 각 정류장은 하나의 장입니다. 두 개의 생산력 목표, 이 역의 지형에 관한 한 가지, 처음 10개의 정류장에 있는 한 개의 봉화탑입니다.' : '새로운 랜드마크에 도달할 때마다 새로운 장이 시작됩니다.'}과제가 완료되면 완료됩니다. 장은 북상이 다음 여정에 도달하면 다시 시작됩니다. </div>`;
    return h;
  }

  p_site(part) {
    const S = this.S, c = this.camp(), p = (getWorld(S.runSeed).sites || []).find(q => q.id === this.panel.arg);
    if (!p) return '';
    const K = SITES[p.kind];
    if (part === 'title') return `${K.ic} ${K.n}`;
    const st = Sim.siteState(S, p), d = Math.hypot(p.x + 0.5 - c.x, p.y + 0.5 - c.y);
    let h = `<div class="story">${esc(K.desc)}</div>`;
    h += `<div class="row"><span>위치</span><span>"${esc(c.name)}"에서 ${Math.round(d)}블록 · 기온은 약 ${baseTempOfRow(p.y)}°C</span></div>`;
    const prev = Sim.siteView(S, { poi: p.id, sup: 'full' });
    const optList = `<div class="sopts">${prev.opts.map(o => `<div><b>${o.need ? '⛺ ' : ''}${esc(o.t)}</b><small>${esc(o.d)}</small></div>`).join('')}</div>`;
    if (st === 'done') return h + `<div class="row"><span>상태</span><span>탐색 통과</span></div>`;
    if (st === 'wait') return h + `<div class="row"><span>상태</span><span>탐험대가 도착했으며 귀하의 결정을 기다리고 있습니다</span></div><button class="btn wide go" data-act="site-decide">결정</button>`;
    if (st === 'going' || st === 'back') return h + `<div class="row"><span>상태</span><span>${st === 'going' ? '탐험대가 오는 중입니다' : '돌아오는 길에 탐험대'}</span></div>`;
    h += `<div class="sec">도착 후 가능합니다.</div>${optList}`;
    const sl = Sim.scoutSlots(S, c.id), range = Sim.scoutRange(S, c.id) + 10;
    if (!sl.n) h += `<div class="issue warning"><span class="ii">🧭</span><span class="it"><b>「${esc(c.name)}」아직 정찰 막사</b><small>탐험대가 정찰 막사에서 출발</small></span><span class="ia"><button class="small go" data-act="place" data-arg="scout">빌드 정찰 막사</button></span></div>`;
    else if (d > range) h += `<div class="issue warning"><span class="ii">📏</span><span class="it"><b>너무 멀다</b><small>"${esc(c.name)}"에서 갈 수 있는 가장 먼 곳은 ${range}블록입니다. 업그레이드정찰 막사, 또는 더 가까운 야영지에서 시작</small></span></div>`;
    else {
      h += `<div class="sec">4인용 탐험대</div><div class="sups">`;
      for (const [sup, t, dsc] of [['light', '가볍게 짐을 싸세요', '보급품이 거의 없으면 동상이 길에서 실종되기 쉽습니다.'], ['full', '충분한 준비물을 가져오세요', '거의 아무 일도 일어나지 않을 것이며, 가져올 선택을 해야 할 때가 오면 ⛺']]) {
        const cost = Sim.expCost(S, c.id, p, sup), r = Sim.expRisk(S, c.id, p, sup);
        h += `<div class="sup"><b>${sup === 'full' ? '⛺ ' : '🎒 '}${t}</b><small>${dsc}</small><div class="tcost">${costHtml(c.stock, cost)}</div><small class="${r > 0.2 ? 'neg' : ''}">${r < 0.01 ? '도로에서는 거의 아무 일도 일어나지 않습니다' : `~에 대한${Math.round(r * 100)}% 사람이 한 명 줄어들 것입니다`}</small><button class="small ${sup === 'full' ? 'go' : ''}" data-act="exp-go" data-arg="${p.id}:${sup}">시작</button></div>`;
      }
      h += `</div><div class="row sub"><span>정찰대 할당량</span><span>${sl.used}/${sl.n}이(가) 초과되었습니다</span></div>`;
    }
    h += `<div class="hint">탐험대가 도착하면 멈추고 사용자가 무엇을 할지 결정할 때까지 기다립니다. 당신이 가져오는 물건은 야영지와 창고에 들어오고 나갈 것입니다. </div>`;
    return h;
  }

  p_landmark(part) {
    const S = this.S, i = this.panel.arg, l = LANDMARKS[i];
    if (part === 'title') return `📍 ${l.n}`;
    let h = `<div class="story">${esc(l.desc)}</div>`;
    h += `<div class="row"><span>상태</span><span>${S.founded.includes(i) ? '이미 옆에 있는 용광로를 클릭했습니다(나중에 여기에서 시작할 수 있습니다).' : '도착으로 간주하려면 14개 타일 내에 전초기지 용광로를 건설하세요.'}</span></div>`;
    { const ch = Sim.chapters(S).find(x => x.i === i); h += `<button class="mlink" data-act="chapter" data-arg="${i}"><span>📖</span><span>${esc(CHAPTERS[i].n)}<small>${ch ? (ch.got ? '이 장은 완료되었습니다' : `과제${ch.tasks.filter(t => t.ok).length}/3${ch.done ? '· 지금 보상를 얻을 수 있습니다' : ''}`) : '여기에서 용광로를 구축한 후 이 장을 시작하세요.'}</small></span><i>›</i></button>`; }
    if (i === 6) {
      const ec = Sim.eternalCamp(S);
      const st = S.eternal.stage;
      h += `<div class="sec">영원의 용광로 다시 켜기</div>`;
      for (let k = 0; k < ETERNAL_STAGES.length; k++) h += `<div class="row"><span>아니요.${k + 1}바닥 난로</span><span>${k < st ? '✅라이트 업' : k === st ? `${S.eternal.have}/${ETERNAL_STAGES[k]} 🌟` : `필요${ETERNAL_STAGES[k]} 🌟`}</span></div>`;
      if (st < ETERNAL_STAGES.length) h += ec ? `<button class="btn wide go" data-act="eternal">영원의 용광로 부품 삽입("${esc(ec.name)}"에 ${fmt(ec.stock.heart || 0)}이 있음)</button>` : `<div class="hint">옆에 전초기지 용광로를 건설하세요. </div>`;
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
      case 'unqueue': Sim.unqueue(S, +arg); this.close(); this.toast('대기열이 취소되었습니다.', 'info'); break;
      case 'od': { const c = this.panelCamp(), r = Sim.setOverdrive(S, c.id, arg === '1'); if (!r.ok) this.toast(r.reason, 'warn'); else if (arg === '1') { g.sfx && g.sfx('build'); this.toast('용광로가 과부하되었습니다. 연료는 두 배 빠르게 연소되고 열은 급격히 상승합니다. 오븐 온도에 주의하고 너무 익히지 마세요.', 'info'); } this.renderPanel(true); break; }
      case 'odauto': { const c = this.panelCamp(); Sim.setOdAuto(S, c.id, c.odAuto === false); this.renderPanel(true); break; }
      case 'wx': g.cancelModes(); this.open('weather'); break;
      case 'car': g.cancelModes(); if (S.car) this.open('caravan'); else this.toast('캐러밴이 떠났습니다.', 'info'); break;
      case 'deliver': { const r = Sim.deliverOrder(S, +arg); if (r.ok) { g.sfx('up'); this.toast(`거래를 해라! ${r.got}을(를) 받으세요.`, 'good'); } else this.toast(r.reason, 'warn'); this.renderPanel(true); break; }
      case 'carauto': Sim.setCarAuto(S, S.carAuto === false); this.renderPanel(true); break;
      case 'raidp': g.cancelModes(); this.open('raid'); break;
      case 'far': g.cancelModes(); this.open('far', +arg); break;
      case 'farmap': { const p = (getWorld(S.runSeed).far || [])[+arg]; if (p) { this.close(); g.view.focus(p.x + 0.5, p.y + 0.5); } break; }
      case 'prep': { const r = Sim.doPrep(S, arg); if (r.ok) { g.sfx(arg === 'fire' ? 'build' : 'tap'); this.toast({ fire: '방화벽에 불이 붙었고, 야영지 주변에는 불의 원이 있었습니다.', mil: '민병대는 그 사람을 붙잡아 벽에 걸어 놓았습니다.', hide: '모두가 물품을 지하실로 옮겼습니다.' }[arg], 'good'); } else this.toast(r.reason, 'warn'); this.renderPanel(true); break; }
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
        this.modal(`<h3>${this.fIco(k, D)} ${c.focus ? '다음으로 변경' : '다음으로 설정'}${D.n}야영지? </h3><p>${D.d}</p><p class="nrwarn">가격: ${D.bad}. </p><p class="hint">설정 후 30분 이내에는 변경할 수 없습니다. </p>`, [{ t: '그게 다야', a: 'focus-yes', arg, cls: 'go' }, { t: '다시 생각해보세요', a: 'close-modal' }]); break; }
      case 'focus-yes': { const [cid, k] = arg.split(':'), r = Sim.setFocus(S, +cid, k); this.closeModal(); if (!r.ok) this.toast(r.reason, 'warn'); else g.sfx('win'); this.renderPanel(true); break; }
      case 'cvtab': this.cvState().tab = arg; this.renderPanel(true); break;
      case 'cvrange': this.cvState().range = arg; this.renderPanel(true); break;
      case 'cvcamp': this.cvState().cid = +arg; this.renderPanel(true); break;
      case 'cvres': { const st = this.cvState(); this.cvDefault(); const i = st.sel.findIndex(e => e.k === arg); if (i >= 0) st.sel.splice(i, 1); else { if (st.sel.length >= CV_COL.length) this.toast(`동시에 최대 ${CV_COL.length}개 항목을 볼 수 있으며, 가장 먼저 선택한 "${RES[st.sel[0].k].n}" 항목이 먼저 제거됩니다.`, 'info'); this.cvSelect(arg); } this.renderPanel(true); break; }
      case 'bulkw': {
        const b = Sim.getB(S, +arg); if (!b) break;
        const r = Sim.bulkStaff(S, b.id), n = BLD[b.type].n;
        if (r.add) g.sfx('tap');
        this.toast(r.short ? `${r.add ? `주다${r.n}건물${n}추가됨${r.add}개인의,` : ''}충분하지 않음${r.short}사람: 무료 일손가 충분하지 않습니다. 더 많은 천막를 건설하여 새로운 사람들을 유치하거나 다른 건물의 사람들을 줄이세요.` : `${r.n}건물${n}모두 채워져 있어요${r.add ? `(추가됨${r.add}사람들)` : ''}.`, r.short ? 'warn' : 'good');
        this.renderPanel(true); break;
      }
      case 'bulkup': {
        const b = Sim.getB(S, +arg); if (!b) break;
        const r = Sim.bulkUpgrade(S, b.id), n = BLD[b.type].n;
        if (r.up) g.sfx('up');
        const msg = [r.up && `${r.up} 및 ${n} 건물이 각각 한 레벨로 업그레이드되었습니다.`, r.q && `${r.q} 건물의 재료가 부족하여 대기열에 추가되었습니다(모든 재료를 사용할 수 있게 되면 자동으로 업그레이드됩니다).`, r.locked && `${r.locked} 건물에는 아직 잠금 해제되지 않은 재료가 필요합니다.`].filter(Boolean).join(',');
        this.toast((msg || '승진할 수 없음') + '.', r.up ? 'good' : r.q ? 'info' : 'warn');
        this.renderPanel(true); break;
      }
      case 'upgrade': if (res(Sim.upgrade(S, +arg)).ok) { g.sfx('up'); } break;
      case 'movebld': g.startMove(+arg); break;
      case 'demolish': this.modal(`<p>정말 이 건물을 철거하시겠습니까? 기본 재료의 절반을 반환합니다. </p>`, [{ t: '철거하다', a: 'demolish-yes', arg, cls: 'bad' }, { t: '괜찮아요', a: 'close-modal' }]); break;
      case 'demolish-yes': Sim.demolish(S, +arg); this.closeModal(); this.close(); break;
      case 'unspec': Sim.assignSpec(S, arg, null); break;
      case 'autospec': {
        const sp = SPECS.find(s => s.id === arg);
        const b = S.buildings.filter(b => sp.aff.includes(b.type) && !Sim.specIn(S, b.id)).sort((a, b) => (b.camp === S.active) - (a.camp === S.active) || b.lvl - a.lvl)[0];
        if (b) { Sim.assignSpec(S, arg, b.id); this.toast(`${sp.n}이(가) "${BLD[b.type].n}"(으)로 이동했습니다.`, 'good'); } else this.toast(`빈 상대 건물(${sp.aff.map(t => BLD[t].n).join('、')})이 없습니다.`, 'warn');
        break;
      }
      case 'train': res(Sim.trainSpec(S, arg)); break;
      case 'veh': { const [bid, v, n] = String(arg).split(':'); const r = Sim.orderVeh(S, +bid, v, +n || 1); if (!r.ok) this.toast(r.reason, 'warn'); else { g.sfx('tap'); if (r.reason && +n > 1) this.toast(`대기 중인 차량 ${r.n}대, ${r.reason}`, 'warn'); } break; }
      case 'vehx': { const [bid, i] = String(arg).split(':'); Sim.cancelVeh(S, +bid, +i); break; }
      case 'followtrip': g.view.followTrip = !g.view.followTrip; if (g.view.followTrip) { this.close(); this.toast('카메라가 행렬을 따라갑니다(화면을 드래그하면 멈춤).'); } break;
      case 'ignite': { const r = Sim.igniteTower(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else this.close(); break; }
      case 'ruin': { const r = Sim.dismantleRuin(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else { this.g.sfx('build'); this.close(); } break; }
      case 'spot': { const b = Sim.getB(S, +arg); if (b) { g.view.focus(b.x + 1, b.y + 1); this.open('bld', b.id); g.view.select(b.id); } break; }
      case 'campgo': { S.active = +arg; const c = this.camp(); g.view.focus(c.x, c.y); break; }
      case 'campBtn': if (S.camps.length > 1) { const i = S.camps.findIndex(c => c.id === S.active); S.active = S.camps[(i + 1) % S.camps.length].id; const c = this.camp(); g.view.focus(c.x, c.y); this.toast(`"${c.name}"(으)로 전환`); } else this.open('camp'); break;
      case 'lmgo': { const l = LANDMARKS[+arg]; g.view.focus(l.x, l.row); this.open('landmark', +arg); break; }
      case 'auto': { const c = Sim.getCamp(S, +arg); c.auto = c.auto === false; break; }
      case 'ev': { const msg = Sim.resolveEvent(S, +arg); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } break; }
      case 'road': { const msg = Sim.resolveRoad(S, +arg); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } break; }
      case 'roadopen': { this.roadModal(); break; }
      case 'dtake': { const [cid, on] = String(arg).split(':'); Sim.takeOver(S, +cid, on === '1'); g.sfx('tap'); this.toast(on === '1' ? '인수: 이제 여기에 집을 지을 수 있습니다, 업그레이드' : '돌려주세요. 저절로 작동합니다.', 'info'); this.renderPanel(true); this.hud(); break; }
      case 'ddouse': { const c = Sim.getCamp(S, +arg); if (!c) break; const emb = Sim.douseEmbers(S, Sim.getB(S, c.furnace).lvl);
        this.modal(`<h3>"${esc(c.name)}"을(를) 중지하시겠습니까? </h3><p>${c.people}은(는) 북쪽으로 "${esc(Sim.mainCamp(S).name)}"로 이동하여 ${emb} 포인트 잔불과 교환하여 보급품의 30%를 가져갑니다. 야영지는 눈 덮인 폐허로 변해 더 이상 불을 붙일 수 없습니다. </p>`, [{ t: '불을 꺼주세요', a: 'ddouse-go', arg: c.id, cls: 'bad' }, { t: '괜찮아요', a: 'close-modal' }]); break; }
      case 'ddouse-go': { const r = Sim.douseDepot(S, +arg); this.closeModal(); if (!r.ok) this.toast(r.reason, 'warn'); else { g.sfx('lose'); this.toast(`엔진을 끄고 ${r.embers}포인트를 획득하세요잔불`, 'story'); this.close(); } this.hud(); break; }
      case 'openbld': { const id = +arg; g.view.select(id); this.open('bld', id); break; }
      case 'tutskip': S.meta.tut = true; this.tutorial(); this.toast('온보딩을 건너뛰었습니다. "메뉴 → 도움말"에서 게임 플레이 지침을 볼 수 있습니다.', 'info'); break;
      case 'survey': { const r = Sim.startSurvey(S, +arg); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast(`탐사팀은 ${SPOTS[r.kind].n}을(를) 찾기 위해 출발했습니다.`, 'good'); g.sfx && g.sfx('tap'); } break; }
      case 'req': this.open('req', +arg); break;
      case 'reqok': { const r = Sim.claimReq(S, +arg); if (!r.ok) this.toast(r.reason, 'warn'); else this.toast('감사합니다!' + (r.rw.embers ? `잔불 +${r.rw.embers}` : ''), 'good'); break; }
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
      case 'surgo': { const u = S.sur; if (!u) { this.toast('이미 사라졌어', 'warn'); break; } if (S.active !== u.camp) S.active = u.camp; g.view.focus(u.x + 0.5, u.y + 0.5); break; }
      case 'sur': this.surClaim(); break;
      case 'reqgo': { const b = Sim.getB(S, +arg); if (b) { const s = BLD[b.type].size; g.view.focus(b.x + s / 2, b.y + s / 2); g.view.select(b.id); this.open('bld', b.id); } break; }
      case 'belt': { const [x, y, k] = arg.split(':'); const r = Sim.addBelt(S, +x, +y, k); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast('컨베이어 벨트가 연결되었습니다.', 'good'); g.sfx('build'); } break; }
      case 'beltup': { const r = Sim.upBelt(S, +arg); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast('증기 트랙으로 교체되었습니다.', 'good'); g.sfx('build'); } break; }
      case 'beltrm': { Sim.removeBelt(S, +arg); this.toast('컨베이어 벨트가 해체되고 자재의 절반이 반환되었습니다.'); break; }
      case 'deep': { const r = Sim.digDeep(S, +arg); if (!r.ok) this.toast(r.reason, 'bad'); else { this.toast('깊은 우물이 파졌습니다. 채굴된 후에도 35% 생산량으로 계속 파낼 수 있습니다.', 'good'); g.view.syncBuildings && g.view.syncBuildings(); } break; }
      case 'keep': { const c = Sim.getCamp(S, +arg); c.keep = c.keep === false; this.toast(c.keep ? '가공 재료 보유가 활성화되었습니다. 가공 공장은 건설에 대한 원자재의 20%를 예약합니다.' : '가공 자재 보유가 종료되었습니다. 가공 공장은 모든 원자재를 사용합니다.', 'info'); break; }
      case 'trade': { const c = Sim.getCamp(S, +arg); c.trade = !c.trade; this.toast(c.trade ? '가득 찬 창고의 자동 상환이 활성화됩니다. 초과 공급은 가장 부족한 품목으로 대체됩니다.' : '전체 포지션의 자동 상환이 꺼졌습니다.', 'info'); break; }
      case 'scoutpick': g.startScoutPick(); break;
      case 'scoutgo': { const t = g.scoutTarget; if (t && res(Sim.sendScout(S, S.active, t.x, t.y)).ok) { g.scoutTarget = null; this.toast('정찰대가 출발했습니다.', 'good'); } break; }
      case 'scoutcancel': g.scoutTarget = null; g.mode = null; break;
      case 'siteopt': { const [sid, i] = String(arg).split(':').map(Number); const msg = Sim.resolveSite(S, sid, i); this.closeModal(); if (msg) { this.toast(msg, 'story'); g.sfx('tap'); } if (this.panel && this.panel.kind === 'site') this.close(); break; }
      case 'site-decide': this.siteModal(); break;
      case 'townup': { const r = res(Sim.townUp(S, +arg)); if (r.ok) { g.drainFx && g.drainFx(); this.renderPanel(true); } break; }
      case 'towngo': { S.active = +arg; g.cancelModes(); this.open('camp'); break; }
      case 'qyopen': if (!this.qyModal()) { const w = Sim.qyWait(S); this.toast(w ? `기연「${QY[w.q.id].n}」을(를) 진행하려면 ${fmtTime(w.left)}이(가) 필요합니다.` : '이 기연이 통과되었습니다.', 'info'); } break;
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
        const then = s.cur ? `<p class="hint">삭제 후${nx ? `저장를 읽을 것입니다.${nx}「${esc(g.slotInfo(nx).name || '')}」` : '새로운 북쪽 방향 게임이 처음부터 시작됩니다'}.</p>` : '';
        this.modal(`<p>저장 삭제${arg}${s.broken ? '(이미 깨졌음)' : `" 안에${esc(s.name || '')}」${s.cur ? '(지금 우리가 하고 있는 게임)' : ''}`}? 이번 라운드의 모든 진행 상황(잔불, 전문가 및 컬렉션 북 포함)이 삭제됩니다. 삭제하기 전에 백업이 자동으로 저장됩니다. 실수로 삭제하신 경우, 본 저장 위치의 "메뉴 → 저장 → 자동백업"에서 복구하실 수 있습니다. </p>${then}`, [{ t: '삭제', a: 'slotdel-yes', arg, cls: 'bad' }, { t: '괜찮아요', a: 'slots' }]);
        break;
      }
      case 'slotdel-yes': if (+arg === g.slot) { g.deleteSlot(+arg); break; } g.deleteSlot(+arg).then(() => { this.slotsModal(); this.toast(`저장 ${arg}이(가) 삭제되었습니다. 삭제하기 전에 백업이 저장되었습니다.`, 'info'); }); break;
      case 'newrun': this.newRunModal(+arg); break;
      case 'nrslot': this.newRunModal(+arg); break;
      case 'nrdiff': this.newRunModal(this.nr.slot, arg); break;
      case 'newrun-go': { const { slot, diff } = this.nr; if (slot === g.slot) g.wipe(diff); else g.useSlot(slot, diff); break; }
      case 'diff': this.diffModal(); break;
      case 'diffset': { S.meta.diff = arg; this.diffModal(); this.toast(`난이도가 "${DIFF[arg].n}"(으)로 변경되었습니다.`, 'info'); this.renderPanel(true); break; }
      case 'infra': { const [cid, k] = String(arg).split(':'); if (res(Sim.upgradeInfra(S, +cid, k)).ok) { g.sfx('build'); } this.renderPanel(true); break; }
      case 'chapter': this.g.cancelModes && this.g.cancelModes(); this.open('chapter', arg != null ? +arg : undefined); break;
      case 'chapclaim': { const msg = Sim.claimChapter(S, +arg); if (msg) { this.toast('🎁 ' + msg, 'story'); g.sfx('win'); } this.renderPanel(true); break; }
      case 'site-open': { const p = (getWorld(S.runSeed).sites || []).find(q => q.id === +arg); if (p) { g.view.focus(p.x + 0.5, p.y + 0.5); this.open('site', p.id); } break; }
      case 'exp-go': { const [sid, sup] = String(arg).split(':'); if (res(Sim.sendExpedition(S, S.active, +sid, sup)).ok) { this.toast('탐험대가 출발했습니다.', 'good'); g.sfx('tap'); } break; }
      case 'rescue': { const p = getWorld(S.runSeed).pois.find(p => p.id === +arg); if (res(Sim.sendScout(S, S.active, p.x, p.y, 'rescue', p.id)).ok) this.toast('구조대가 출발했습니다.', 'good'); break; }
      case 'lookat': { const [x, y] = arg.split(',').map(Number); g.view.focus(x, y); break; }
      case 'netpg': this.netPg = arg; this.netFocus = null; g.sfx('tap'); break;
      case 'netview': this.netPg = 'all'; this.netFocus = arg ? +arg : null; this.open('lines'); break;
      case 'netsend': this.netPg = 'send'; this.open('lines'); break;
      case 'nto': this.netTo = +arg; g.sfx('tap'); break;
      case 'nk': this.netK = arg; g.sfx('tap'); break;
      case 'nsend': { const r = res(Sim.sendBatch(S, S.active, this.netTo, this.netK, arg === 'all' ? 'all' : +arg)); if (r.ok) { this.toast(`로드됨: ${RES[this.netK].n} ${fmt(r.n)}이(가) "${(Sim.getCamp(S, this.netTo) || {}).name}"에 전송되었습니다.`, 'good'); g.sfx('tap'); } break; }
      case 'nfeed': { const r = res(Sim.addFeed(S, S.active, this.netTo, this.netK, +arg)); if (r.ok) { this.toast(`장기 공급량: ${arg} ${RES[this.netK].n}이(가) 분당 "${(Sim.getCamp(S, this.netTo) || {}).name}"(으)로 전송됨`, 'good'); g.sfx('tap'); } break; }
      case 'nsendx': Sim.cancelSend(S, +arg); break;
      case 'nfeedx': Sim.delFeed(S, +arg); break;
      case 'nhold': Sim.toggleHold(S, S.active, arg); g.sfx('tap'); break;
      case 'roadadd': { const r = res(Sim.buildRoad(S, S.active, +arg, S.active)); if (r.ok) { this.toast(r.queued ? r.reason : '도로가 수리되었습니다.', r.queued ? 'info' : 'good'); g.sfx('build'); } break; }
      case 'roadup': { const r = res(Sim.upgradeRoad(S, +arg, S.active)); if (r.ok) { this.toast(r.queued ? r.reason : '도로는 업그레이드고 절반만 더 수송할 수 있습니다.', r.queued ? 'info' : 'good'); g.sfx('build'); } break; }
      case 'roadrail': { const r = res(Sim.railRoad(S, +arg, S.active)); if (r.ok) { this.toast(r.queued ? r.reason : '철도로 변경되었습니다.', r.queued ? 'info' : 'good'); g.sfx('build'); } break; }
      case 'roadx': Sim.cancelRoad(S, +arg); break;
      case 'gpg': this.gPg = arg; g.sfx('tap'); break;
      case 'cmdsel': this.cmdSel = arg || null; this.cmdH = null; g.sfx('tap'); this.cmdBar(this.camp()); return;
      case 'cmdfire': { const r = res(Sim.fireCmd(S, arg, S.active)); if (r.ok) { this.cmdSel = null; g.drainFx(); } this.cmdH = null; this.cmdBar(this.camp()); return; }
      case 'baymod': { const [id, m] = arg.split(':'); const r = res(Sim.setBayModel(S, +id, m)); if (r.ok) { this.toast(`${BOT_MODELS[m].n}(으)로 변경되었습니다.`, 'good'); g.sfx('build'); } break; }
      case 'bayscrap': { const [id, n] = arg.split(':'); const r = res(Sim.scrapBots(S, +id, +n)); if (r.ok) { this.toast(`${r.n} 오토마톤을 분해하고 ${r.cores} 핵심을 반환했습니다.`, 'info'); g.sfx('tap'); } break; }
      case 'bayfill': Sim.bayRefill(S, +arg); g.sfx('tap'); break;
      case 'guild': g.cancelModes(); this.open('guild'); break;
      case 'gsell': { const [k, n] = String(arg).split(':'); const r = res(Sim.guildSell(S, S.active, k, +n)); if (r.ok) { this.toast(`${fmt(r.n)} ${RES[k].n}을(를) 판매하고 은화 ${fmt(r.silver)}을(를) 받았습니다.`, 'good'); g.sfx('coin'); } break; }
      case 'gbuy': { const [k, n] = String(arg).split(':'); const r = res(Sim.guildBuy(S, S.active, k, +n)); if (r.ok) { this.toast(`${fmt(r.n)} ${RES[k].n}을(를) 구매하고 은화 ${fmt(r.silver)}을(를) 지출했습니다.`, 'info'); g.sfx('coin'); } break; }
      case 'gemb': { const r = res(Sim.buyEmbers(S, +arg)); if (r.ok) { this.toast(`${r.n}포인트잔불을 구매했습니다.`, 'good'); g.sfx('coin'); } break; }
      case 'gdeco': { const r = res(Sim.buyDeco(S, arg)); if (r.ok) { this.toast(`"${BLD[arg].n}" 도면을 구입했습니다. 건설 › 모닥불으로 제작할 수 있습니다.`, 'good'); g.sfx('win'); } break; }
      case 'gdeliv': { const r = res(Sim.guildDeliver(S, S.active, +arg)); if (r.ok) { this.toast(`주문이 접수되었습니다: 은화 +${fmt(r.silver)}, 잔불 +${r.emb}.`, 'good'); g.sfx('win'); } break; }
      case 'altset': { const [id, on] = String(arg).split(':'); const r = res(Sim.setAlt(S, +id, on === '1')); if (r.ok && !r.same) { this.toast(`${on === '1' ? '대체 레시피' : '오리지널 레시피'}(으)로 변경되었으며 ${ALT_SWITCH}초 동안 작동이 중지되었습니다.`, 'info'); g.sfx('tap'); } break; }
      case 'gatego': {
        const m = Sim.mainCamp(S);
        if (arg === 'route') this.open('scout');
        else if (arg === 'chap') this.open('chapter');
        else if (arg === 'flvl') { S.active = m.id; this.actDo('reqgo', m.furnace); }
        else if (arg === 'car') {
          const sh = S.buildings.filter(b => b.type === 'sledshed').sort((a, b) => (b.camp === m.id) - (a.camp === m.id))[0];
          if (sh) { S.active = sh.camp; this.actDo('reqgo', sh.id); } else { S.active = m.id; this.close(); g.startPlace('sledshed'); this.toast('먼저 썰매 헛간을 구축한 다음 그 안에 썰매를 구축하세요.', 'info'); }
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
        const gt = Sim.departGate(S); if (!gt || !gt.ok) { res({ ok: false, reason: '아직 준비 안 됐어' }); break; }
        const P = gt.plan, douse = P.camps.filter(c => c.mode === 'douse'), keep = P.camps.filter(c => c.mode !== 'douse');
        const vs = Sim.VEH_KEYS.filter(v => P.veh[v]).map(v => `${P.veh[v]} ${v === 'sled' ? '선반' : '탑'}${Sim.vehName(v)}`).join(',');
        this.modal(`<h2>'로 출발${esc(gt.next.n)}」</h2><p class="story">${esc(STORY.migrate)}</p>
          <p>${P.people}사람들${P.specs.length ? `、${P.specs.length}비트전문가` : ''}앉다${vs}, 에 대한${Math.max(1, Math.round(P.secs / 60))}분. </p>${keep.length ? `<p>뒤에 머물면서 보급 창고가 되어보세요:${keep.map(c => esc(c.name)).join('、')}</p>` : ''}${douse.length ? `<p>사용 중지:${douse.map(c => `${esc(c.name)}（🔥${Sim.douseEmbers(S, c.lvl)}）`).join('、')}, 사람들이 따라가자 야영지는 폐허가 되었습니다. </p>` : ''}`,
          [{ t: '출발하다', a: 'depart-yes', cls: 'go' }, { t: '잠깐만요', a: 'close-modal' }]);
        break;
      }
      case 'depart-yes': { this.closeModal(); g.backup('depart'); const r = res(Sim.depart(S)); if (r && r.ok) { this.close(); g.view.followTrip = true; g.sfx('horn'); } break; }
      case 'arrive': g.startArrive(); break;
      case 'newjourney': this.modal(`<h2>새로운 북쪽 여행을 시작하세요</h2><p>잿빛 야영지에서 다시 시작하세요. 야영지와 이번 라운드의 보급품은 여기에 남아 있습니다. 잔불 강화, 전문가, 컬렉션 북 및 유물이 모두 제거됩니다. </p>`, [{ t: '출발하다', a: 'newjourney-yes', cls: 'go' }, { t: '다시 생각해보세요', a: 'close-modal' }]); break;
      case 'newjourney-yes': this.closeModal(); this.close(); g.migrate(); break;
      case 'ember': res(Sim.buyEmber(S, arg)); break;
      case 'eternal': res(Sim.deliverEternal(S)); break;
      case 'help': this.modal(HELP); break;
      case 'changelog': this.modal(changelogHtml()); this.$('modal').querySelector('.mbox').classList.add('clbox'); break;
      case 'export': g.exportCode(); break;
      case 'backups': this.backupsModal(); break;
      case 'bkload': {
        const r = (this.bks || []).find(x => String(x.id) === arg); if (!r) break;
        this.modal(`<h2>이 백업으로 되돌리시겠습니까? </h2><p><b>${this.agoText(r.at)}</b> (${(BK_WHY[r.why] || BK_WHY.auto)[1]})<br>${this.bkLine(r)}</p><p class="hint">그 순간부터 계속 플레이하면 오프라인 시간이 계산되지 않습니다. 현재 진행 상황은 백업으로 저장되며, 후회할 경우 다시 변경할 수 있습니다. </p>`,
          [{ t: '다시 덮다', a: 'bkload-yes', arg: arg, cls: 'go' }, { t: '반품', a: 'backups' }]);
        break;
      }
      case 'bkload-yes': this.closeModal(); g.restoreBackup(/^\d+$/.test(arg) ? +arg : arg); break;
      case 'import': this.modal(`<p>저장 코드를 붙여넣거나 파일로 저장된 저장 코드를 선택하세요.</p><textarea id="importBox"rows="5"></textarea>`, [{ t: '수입', a: 'import-yes', cls: 'go' }, { t: '📂 파일에서 읽기', a: 'importfile' }, { t: '취소', a: 'close-modal' }]); break;
      case 'importfile': g.pickCodeFile(); break;
      case 'savecode': g.saveCodeFile(); break;
      case 'import-yes': g.importCode(document.getElementById('importBox').value); break;
      case 'copy': { const t = document.getElementById('exportBox'); t.select(); const manual = () => { try { document.execCommand('copy'); } catch (e) {} this.toast('선택하고 복사되지 않은 경우 길게 눌러 수동으로 복사하세요.', 'warn'); }; try { navigator.clipboard.writeText(t.value).then(() => this.toast('복사됨', 'good'), manual); } catch (e) { manual(); } break; }
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
  if (!b) return `${nm}를 세우기 위한 기초: 건설 › 핵심`;
  const sp = Sim.towerSpec(S, n), st = (Sim.rt(S).b[b.id] || {}).status || '';
  if (b.tw.p < sp.dur) return `${nm}타워 본체${Math.floor(b.tw.p / sp.dur * 100)}%${st.startsWith('부족') ? `：${st}` : ''}`;
  return `${nm}의 타워 본체가 준비되었습니다. 점화를 위해 연료로 전환하세요.`;
}
export function nextGoal(S) {
  const has = t => S.buildings.some(b => b.type === t);
  const c0 = S.camps[0];
  const steps = [
    [() => !has('lumber'), '벌목장을 건설합니다(흰색 원 안에 침엽수림이 있어야 함).'],
    [() => !has('tent'), '천막을 제작하여 모든 사람이 집에 거주하고 따뜻하게 지낼 수 있도록 하세요.'],
    [() => !has('hunter'), '짐승 출몰지 옆에 사냥꾼 오두막을 건설하세요.'],
    [() => !has('kitchen'), '부엌을 지어고 생고기를 요리로 만듭니다.'],
    [() => !has('sawmill'), '제재소를 지어고 목판을 사용하여 업그레이드를 만듭니다.'],
    [() => Sim.getB(S, c0.furnace).lvl < 2, '용광로를 클릭하여 레벨 2로 업그레이드하세요. (난방권은 더 커집니다.)'],
    [() => !has('warehouse'), '생산 지역 중앙에 창고를 건설하고 여기서 운반꾼이 시작됩니다.'],
    [() => !has('tower'), '눈늑대를 준비하기 위해 하나 또는 두 개의 화살탑을 구축하십시오.'],
    [() => !has('scout'), '정찰 막사를 조립하고 북쪽으로 가는 길을 탐험할 준비를 하세요.'],
  ];
  if (S.site === 0 && Sim.journeyOf(S).stage === 0) for (const [cond, txt] of steps) if (cond()) return txt;
  const J = Sim.journeyOf(S);
  if (J.trip && J.trip.road) return `행렬 중지됨: ${Sim.roadView(S).title}`;
  if (J.trip) return J.trip.phase === 'arrive' ? `행렬이 "${Sim.stopOf(S, J.trip.to).n}"에 도착함: 새 용광로를 내려놓으세요` : `행렬${Math.round(J.trip.d / J.trip.len * 100)}%에 대해 "${Sim.stopOf(S, J.trip.to).n}"(으)로 이동`;
  // 这一章的产能目标
  const g = Sim.rateGoals(S).find(x => !x.eternal) || Sim.rateGoals(S)[0];
  if (g) {
    const r = Sim.prodRate(S, g.r), h = Sim.holdOf(S, g.id), fr = v => v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    if (r >= g.n - 1e-9) return `분당 ${RES[g.r].n} ${fr(r)}/${g.n} · 꾸준함 ${Math.floor(h.p / 60)}:${String(Math.floor(h.p % 60)).padStart(2, '0')}/3:00`;
    return `${RES[g.r].n}생산량${fr(r)}/${g.n}분당${g.eternal ? `(아니요.${S.eternal.stage + 1}/3레이어)` : ''}`;
  }
  // 这一章别的任务
  const chs = Sim.chapters(S), cur = chs.find(c => c.i === J.stage);
  if (cur) { const j = cur.tasks.findIndex(x => !x.ok), t = cur.tasks[j], q = j >= 0 && Sim.chapterDef(S, cur.i).tasks[j]; if (q && q.k === 'tower') return towerGoal(S, q.tn); if (t) return t.t + (t.n > 1 && !t.low ? `(${typeof t.cur === 'number' ? Math.min(t.cur, t.n) : t.cur}/${t.n})` : ''); }
  // 北迁门槛
  const gt = Sim.departGate(S);
  if (gt) { const m = gt.items.find(i => !i.ok); return m ? `북상 준비됨 ${gt.n}/4：${m.t}` : `북상이 준비되었습니다. "${gt.next.n}"(으)로 향합니다.`; }
  return '';
}

export const HELP = `<h3>게임 방법</h3>
<p><b>목표:</b> 야영지를 역별로 타고 북쪽으로 이동하여 전설적인 영원의 용광로를 다시 불태우세요. 영원의 용광로를 지나도 여전히 6개의 역이 있고, 세계의 척추를 넘어서면 끝없는 북방이 있습니다. </p>
<p><b>용광로</b>는 야영지의 핵심입니다. 용광로 주변의 주황색 원(난방 구역)만이 집을 지을 수 있습니다. 업그레이드용광로는 원을 더 크게 만들고 야영지를 더 따뜻하게 만듭니다. 용광로는 계속해서 연료: 목재를 굽고 이어서 석탄, 코크스 덩어리 및 수정 배터리를 굽습니다. </p>
<p><b>채집 및 가공:</b> 채집 건물은 자원 지점 옆(흰색 원 내)에 건설되어야 하며 광물 매장지가 채굴됩니다. 숲과 사냥터는 베어지면 다시 자라며, 벌목장과 사냥꾼 오두막 근처의 숲은 몇 배 더 빨리 자랍니다. 근처에 나무가 없으면 "조림장"를 만들고 직접 심으세요. 가공은 원자재를 고급 재료로 만듭니다. 제재소 및 제강소는 기본적으로 건설에 대해 일부 목재 및 철괴를 남겨 둡니다("생산 → 재료"에서 끌 수 있음). 인접한 상류 및 하류 건물이 서로 추가됩니다. </p>
<p><b>악당:</b> 일꾼이 각 건물로 전송됩니다. 창고에 있는 사람들은 운반꾼이며 창고/용광로와 건물 사이를 오가며 물품을 이동합니다. 창고에서 멀어질수록 더 비싼 운반꾼이 됩니다. - 생산 영역의 중간에 창고를 구축하세요. </p>
<p><b>업그레이드 임계값:</b> 건물이 5레벨로 업그레이드될 때마다 다음 레이어의 재료를 사용해야 합니다. 다음 레벨의 재료는 더 북쪽에서만 찾을 수 있으므로 계속 북쪽으로 가세요. </p>
<p><b>북쪽으로 이동:</b> 정찰 막사를 지어고, 정찰대를 보내 안개를 발견하고, 리소스, 생존자, 전문가 및 랜드마크를 찾고, 다음 정류장으로 가는 길도 알아보세요. 본영과 다음 역 사이에 "전초 기지 용광로"를 건설하여 새로운 야영지를 열 수 있습니다. 가장 가까운 야영지에 연결되는 썰매 도로가 있을 것입니다. </p>
<p><b>물류:</b> 모든 야영지는 도로망에 연결되어 있습니다. 10초마다 각 야영지는 부족한 것과 부족한 것을 계산합니다. 초과분이 있는 썰매를 싣고 길을 따라 사라진 야영지로 보내집니다. 이동 중에 다른 야영지로 전송할 수 있습니다. 먼저 생명을 구하는 연료배급을 보낸 다음 건설에 필요한 자재, 생산 라인에서 누락된 자재 본영을 용광로 및 북상으로 보내고 마지막으로 각 야영지 목재목판석재철괴를 보냅니다. 200. "생산 → 물류"에서는 각 야영지가 배송한 내용, 배송된 내용, 누락된 내용을 확인할 수 있습니다. 업그레이드길(썰매 도로, 북쪽 방향 주요 도로, 철도)의 경우 수동으로 배치를 보내고, 장기 공급을 설정하고, 특정 상품을 배송 불가로 표시할 수도 있습니다. </p>
<p><b>대체 공식 및 야영지 특수 기능:</b> 일부 가공 공장은 공식 세트를 변경할 수 있습니다(예: 코크스 공방은 석탄을 사용하지 않지만 목재를 사용합니다). 건물 패널의 "레시피"에서 변경하세요. 변경 사항은 20초 동안 작동을 중지합니다. 연구 "대체 레시피 1" "대체 레시피 2" 이후에만 변경할 수 있습니다. 특정 원자재가 파손된 경우 늙은 길잡이는 이를 교체하라고 알려줍니다. 각 야영지는 제작 시 특별한 기능을 가지고 있습니다. 북방 스테이션에서 지형을 볼 수 있고, 다른 곳에서는 난방권에 어떤 광물이 풍부한지 확인할 수 있습니다. 특수 건물은 이 야영지에서 생산량 +50%(연구 "특산품 정공" 이후 +75%)이며 이는 야영지 패널에서 볼 수 있습니다. </p>
<p><b>민심:</b> 각 야영지에는 "희망" 및 "불만"가 있습니다. 먹을 것이 부족하고, 너무 추워서 사람들이 죽어가는 것은 실망스러울 수 있습니다. 잘 수용되고 발전하는 것은 흥미로울 수 있습니다. 희망이 너무 높으면 작업이 더 빨라지고 더 많은 사람들이 합류하게 됩니다. 불만이 너무 높으면 일부 사람들이 떠날 것입니다. "야영지 → 법률 명령"에서 야영지 법률 명령에 서명하세요. 각각에는 이점과 비용이 있습니다. </p>
<p><b>연구:</b> 공학 작업장을 지어고 기술자를 보내 연구 포인트를 적립하세요. 총 45개 아이템으로 구성된 5개 브랜치: 생산, 생존, 물류는 처음부터 사용 가능하며, 자동화는 정찰~유적 금속 위도가 필요하며, 북방은 북방까지 열리지 않습니다. ★를 사용하면 새로운 것(대체 조리법, 마을, 불가사의, 용광로 명령 등)이 잠금 해제됩니다. 모든 연구가 완료되면 끝없는 연구가 열리고 모든 생산은 각 레벨에서 +2%됩니다. 원정대에서 가져온 그림은 연구 포인트의 가치를 직접적으로 얻을 수 있습니다. </p>
<p><b>탐색:</b> 안개에는 버려진 창고, 얼어붙은 열차와 같은 위치와 관측소가 포함되어 있습니다. 정찰대가 공개된 후 정찰 막사에서 탐험대로 4명을 보냅니다. 충분한 물품을 가져가는 것이 더 안전하며, 도착하면 더 많은 선택을 할 수 있습니다. </p>
<p><b>장:</b> 새로운 랜드마크에 도달할 때마다 새로운 장이 시작됩니다. 그것은 자신의 이야기와 세 개의 과제를 가지고 있습니다. 완료하면 보상을 받을 수 있습니다. 상단의 타겟바를 클릭하시면 보실 수 있습니다. </p>
<p><b>생산력 메인 라인:</b> 각 장의 첫 번째 과제는 분당 특정 재료를 얼마나 생산할 수 있는지를 나타냅니다. 이 줄을 보려면 대상 열에서 "계획"을 클릭하세요. 각 링크에 얼마나 많은 건물과 사람이 필요한지, 어떤 링크가 현재 멈춰 있는지 확인하세요. 생산량이 한동안 안정화된 후 생산 라인이 스타 수준으로 올라갔고 생산량이 스타 수준에 추가되었습니다. 누적된 생산량이 이정표에 도달했을 때 보상도 있었습니다. 몇 개의 지선을 설정할 수도 있습니다. 회선이 설정되면 "이 회선을 복사"하여 전체 그룹을 다른 위치로 이동할 수 있습니다. 늙은 길잡이(하단에 있는 줄의 줄, 가죽 모자를 쓴 그림)는 다음 단계를 계속 가리키며, 전체 텍스트를 읽으려면 그를 클릭하세요. </p>
<p><b>야영지 인프라:</b> "야영지 → 개요"(더 빠른 교통) 및 증기 배관(난방권은 더 크고 따뜻함)의 도로 건설입니다. </p>
<p><b>위험:</b> 1시간 전에 눈보라에 대한 예보가 있습니다(오른쪽 상단에 있는 알림 벨을 클릭하여 버틸 수 있는지 확인하세요). 연료 및 요리를 비축하는 것을 잊지 마십시오. 용광로는 잠시 동안 과부하가 걸릴 수 있습니다. 눈늑대와 약탈자가 공격합니다. 더 많은 화살탑을 구축하십시오. 정찰 병사들이 미리 출동합니다. 15분 안에 그들을 찾아내 벽에 불을 지르고 민병대를 소집하세요. 사람은 얼어 죽고 굶어 죽을 수도 있지만 야영지는 결코 완전히 멸망하지 않습니다. </p>
<p><b>생산 체인:</b> C를 눌러 전체 생산 체인이 걸린 위치를 확인하고 G를 눌러 데이터 곡선을 확인하세요. 가공 건물이 상류 및 하류에 인접하면 컨베이어 벨트(나중에 업그레이드가 증기 트랙이 됨)에 연결하여 재료를 직접 공급할 수 있으므로 운반꾼을 덜 사용하십시오. 광산을 비우려고 할 때 깊은 우물을 파낼 수 있으며, 정찰 막사는 새로운 광맥을 탐색할 수도 있습니다. </p>
<p><b>야영지 생활:</b> 인원이 많아지면 용광로 패널에서 모닥불 축하 행사를 열 수 있습니다. 가로등, 깃대, 조각상, 꽃 저장고 및 장식을 희망에 추가할 수 있습니다. 누군가 아프면 진료소를 건설하세요. 야영지에 있는 사람들은 가끔 당신에게 어떤 일을 해달라고(위임) 요청하고, 그것을 완료하면 감사 선물을 받게 됩니다. 용광로는 레벨 5에서 ​​야영지에 대한 전문화를 선택할 수 있습니다. 개집에 자란 썰매 개는 정찰대를 더 빠르게 달리게 하고 길을 따라 더 많은 교통량을 운반하게 합니다. </p>
<p><b>날씨 및 약탈자:</b> 눈보라 외에도 얼음 폭풍(용광로와 파이프가 얼어붙음), 극도로 추운 밤(더 많은 연료 화상), 얼음호수 균열(우회)도 있으며 이는 사전에 예측됩니다. 오른쪽 상단 알림벨에서 재료를 소모하여 준비해주세요. 북쪽에는 약탈자야영지가 있습니다. 정찰이 도착하면 그들은 조공을 요구하러 올 것입니다. 조공을 바치거나, 사업을 하거나, 화살탑에 의존하여 그들을 밀어낼 것입니다. 두 번 처치하고 떠나세요. </p>
<p><b>컬렉션북:</b> 당신이 건설한 건물, 당신이 본 재료와 풍경, 당신이 달성한 업적은 모두 컬렉션북 <span class="kh">(K)</span>에 기록되어 있습니다. </p>
<p><b>업적 및 장식:</b> "메뉴 → 컬렉션"의 "업적"는 북방, 봉화탑, 생산 라인, 생존, 야영지, 진행률 표시줄이 있는 여러 숨기기로 분류됩니다. "여행" 카테고리의 기존 업적은 잔불에 제공됩니다. 새로운 업적은 칭호에 "Dress Up"에서 입는 파이어 컬러, 캠프 깃발 패턴, 액자와 북방장식 8종을 증정하며, 앞으로도 북상은 유지될 예정입니다. 사진 앨범은 새로운 역에 도착하면 자동으로 사진을 찍고, 생산 라인의 첫 세 별인 봉화탑을 밝히고, 하늘의 불을 밝힙니다. </p>
<p><b>북상:</b> 출발 전에 네 가지 작업을 완료해야 합니다. 로드 스카우트가 도착하고, 이 장이 완료되었으며, 본영용광로가 충분히 레벨이고, 행렬이 준비되었습니다(썰매 및 증기 트레일러는 썰매 헛간에 내장되었으며 쇄빙차는 나중에 사용할 수 있습니다). "북행 → 북상"에서 탑승하고 싶은 사람과 물건의 수를 선택하세요. 뒤에 있는 야영지는 뒤에 머물거나(공급 스테이션으로 전환하여 자체적으로 작동하며 추가 물품은 물류망으로 운송됩니다. 행렬이 가는 도로는 북쪽 방향 주요 도로가 됩니다) 정지(잔불으로 변경하면 사람들이 따라옵니다)를 선택할 수 있습니다. 도로에 문제가 생길 수 있고, 차에 실린 물건으로 인해 추가 도로가 생길 수 있습니다. 도착 후 평평한 땅을 골라 새 용광로를 내려놓으세요. 새로운 본영이 있을 것입니다. 잔불은 "북향 → 전문가 및 잔불"에서 영구강화로 교환 가능합니다. </p>
<p><b>북방:</b> 세계의 척추를 넘어 북쪽으로 곧장 갈 수 있으며, 지도는 북쪽으로 섹션이 늘어납니다. 북방의 각 스테이션에는 행렬이 주차된 스테이션에서만 적용되는 일종의 지형이 있습니다. 희망이 상승하고 작동 속도가 느려짐), 늑대 무리 영역(Z ZG390ZZ 및 더 많은 전리품이 있음), 얼음호수 지대(얼음낚시 오두막을 건설할 수 있음), 고성 유적지(폐허를 제거하고 고대 부품으로 교체), 폭풍 회랑(Z ZG260ZZ가 많으며 예상은 다음과 같습니다) 이전), 운석비(별핵이 분화구에서 나오며 가끔 건물을 멈추기도 함), 나무 없는 동토(살아있는 나무는 없고 고목 더미만 있음). 각 스테이션에는 2개의 생산력 타겟과 1개의 지형 과제가 있으며, 각 스테이션에는 더 높은 타겟이 있습니다. 용광로 임계값은 세계의 척추 레벨에서 중지됩니다. 처음 특정 역 번호로 걸어갈 때 잔불을 주었습니다. 가장 먼 곳까지의 기록이 메뉴와 지도에 기록되었습니다. </p>
<p><b>봉화탑:</b> 북방의 처음 10개 스테이션에는 각각 타워가 있습니다. 핵심 사항: 먼저 기초 공사(본영난방권에 있어야 함)를 사용한 다음 여러 고급 재료를 타워 본체에 공급합니다. 하나라도 누락되면 중지되지만 진행 상태는 취소되지 않습니다. 가득 차면 수정 배터리(다음에 별핵)를 사용하여 점화합니다. 조명이 켜진 탑은 빛의 기둥을 세웠으며 야영지는 +1, 희망 +5를 따뜻하게했습니다. 열 번째 정거장은 4×4 천화탑입니다. 조명을 켜는 것이 최종 엔딩이고, 그 이후에도 북쪽으로 갈 수 있습니다. </p>
<p><b>채굴 지점 및 재배치:</b> 채굴 지점이 비워질 예정이면 미리 알림을 받게 됩니다. 당시 정찰 막사의 탐사 비용은 매우 저렴했습니다. 건물을 배치할 때 건물이 근처의 광물 지점을 차단하면 미리보기 상자가 노란색으로 변합니다. 지상의 금색 별 위치가 권장 위치입니다(메뉴에서 끌 수 있음). 건물 패널에서 '위치 이동'을 클릭하면 무료로 이동할 수 있습니다. 레벨과 일꾼은 유지됩니다. 이동 후 잠시 작업이 중단됩니다. 봉화탑은 공급을 시작한 후에는 이동할 수 없습니다. </p>
<p><b>배속과 오프라인:</b> 오른쪽 속도 키를 눌러 1×, 2×, 4×를 바꾸고, 길게 누르면 일시 정지합니다. 페이지를 닫아도 자원이 천천히 쌓이지만 접속 중보다 느립니다. 돌아오면 보고서가 표시됩니다.</p</p>
<p><b>저장 및 백업:</b> 진행 상황은 이 기기에 자동으로 저장되며, 3개의 저장 비트는 각각 하나의 게임입니다. 플레이하는 동안 10분마다 자동으로 백업됩니다. 또한 북상을 시작하고 저장 코드를 가져오고 다시 시작하고 삭제하기 전에 백업됩니다. "메뉴 → 저장 → 자동 백업"을 클릭하여 돌아갈 수 있습니다. 장치를 변경하려면 "저장 코드 내보내기"를 사용하십시오. </p>
<p><b>조작:</b> 지도를 드래그해 이동하고, 두 손가락으로 확대/축소·회전합니다(PC: 휠로 확대/축소, 우클릭 또는 Q/E로 회전). 건설할 때는 미리보기를 드래그해 자리를 잡은 뒤 ✓를 누르세요. PC에서는 왼쪽 버튼을 누른 채 드래그하면 한 번에 한 줄을 놓을 수 있고, 휴대폰에서는 먼저 "한 줄"을 누르세요. 같은 종류 건물의 패널에서 일괄 업그레이드와 일괄 배치를 할 수 있습니다. H는 사진 모드, M은 북행 지도, + / −는 확대/축소입니다. 메뉴에 저장 슬롯이 3개 있고 난이도는 언제든 바꿀 수 있습니다.</p>`;
