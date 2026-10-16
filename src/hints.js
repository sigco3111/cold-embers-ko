// 新玩法提示：新手引导走完以后，某个玩法第一次用得上时，弹一张小卡片说一句怎么用（每样只说一次）
import { BLD, FOCUS_LVL } from './data.js';
import * as Sim from './sim.js';
import { iconize } from './icons.js';
import { CHANGELOG, VERSION_NAME } from './changelog.js';

const GAP = 75, FIRST = 25; // 两张提示至少隔 75 秒；打开游戏 25 秒后才开始
const make = S => c => S.buildings.filter(b => b.camp === c.id && BLD[b.type].cat === 'make');

// when(S, c, cr, g) 返回 false 表示还用不上；返回 { act, arg } 表示「去看看」按钮要做什么（没有按钮就返回 true）
export const HINTS = [
  { id: 'gang', ic: '🏴', n: '掠夺者来索贡了', d: '点左下角的便签或右上角的提醒铃答复：交贡、做买卖，或者靠箭塔顶回去。到时候没人答复，守得住就打，守不住就交贡。',
    when: S => { const d = Sim.gangDemands(S)[0]; return d ? { act: 'gang', arg: d.g.id } : false; } },
  { id: 'net', ic: '🛷', n: '路已经修好了', d: '新营地一点火就有一条雪橇道连到最近的营地。在这里摆建筑就行，缺的木材、木板、石料，物流网会自己从有余的营地运过来。「生产 → 物流」里能看路上在运什么。',
    when: (S, c) => { const m = Sim.mainCamp(S); return c && m && c.id !== m.id && !c.depot && Sim.roadsAt(S, c.id).length ? { act: 'netview', arg: c.id } : false; } },
  { id: 'wxe', ic: '❄', n: '怪天气要来了', d: '冰风暴、极寒夜、冰湖开裂都会提前预报。打开右上角的提醒铃，花点材料提前准备，能少受很多罪。',
    when: (S, c) => { const e = Sim.wxeAt(S, S.t); return e.ev && !e.on && e.inSec <= Sim.forecastOf(S) && Sim.wxeMatters(S, c, e.ev) && !Sim.wxePrepped(S, c, e.ev) ? { act: 'wx' } : false; } },
  { id: 'ward', ic: '🩺', n: '有人病了', d: '建一座医务所，派两个人照看：住进去的病人在冷天里也能慢慢好起来，营地里染病的人也会少。',
    when: (S, c, cr) => (cr.sick || 0) >= 1 && Sim.unlocked(S, 'infirmary') && !Sim.countType(S, c.id, 'infirmary') ? { act: 'tb', arg: 'build' } : false },
  { id: 'deep', ic: '⛏', n: '矿快挖空了', d: '矿场面板里能「打深井」：地表采空以后还能慢慢挖下去。侦察营还能派人勘探新矿脉。',
    when: (S, c) => { const gs = Sim.rt(S).gatherSpots; const b = S.buildings.find(b => b.camp === c.id && !b.deep && Sim.deepable(b.type) && gs && (gs.get(b.id) || []).length && Sim.gatherLeftFrac(S, b) <= 0.25); return b ? { act: 'reqgo', arg: b.id } : false; } },
  { id: 'chain', ic: '🔗', n: '生产链总览', d: '按 C（或「生产 → 产线」里的生产链图）看整条生产链：哪一环缺人、缺料、堆满了，一眼就能看出来。',
    when: (S, c) => make(S)(c).length >= 2 && S.buildings.filter(b => b.camp === c.id).length >= 10 ? { act: 'chainmap' } : false },
  { id: 'bulk', ic: '⬆', n: '一次管一批', d: '同类建筑多了：面板里能「每栋升一级」「都派满」。建造时还能一次摆一排。',
    pc: '建造时按住左键拖一下，一次摆一排。', touch: '建造时先点「一排」，再拖预览，一次摆一排。',
    when: (S, c) => { const n = {}; for (const b of S.buildings) if (b.camp === c.id && b.type !== 'tent' && BLD[b.type].cat !== 'deco' && b.type !== 'furnace') if ((n[b.type] = (n[b.type] || 0) + 1) >= 3) return { act: 'reqgo', arg: b.id }; return false; } },
  { id: 'fest', ic: '🎉', n: '可以办篝火庆典了', d: '熔炉面板里能办庆典：花些熟食和木材，大家歇一会儿，希望一下子涨上去，之后干活也更有劲。',
    when: (S, c) => !Sim.festBlock(S, c) && (c.hope ?? 50) < 60 ? { act: 'reqgo', arg: c.furnace } : false },
  { id: 'focus', ic: '🧭', n: '营地可以选专精了', d: '熔炉到了 ' + FOCUS_LVL + ' 级：在「营地 → 概况」里选矿业、农垦、工坊或要塞，强一样、弱一样。',
    when: (S, c) => !c.focus && !c.trade && (Sim.getB(S, c.furnace) || {}).lvl >= FOCUS_LVL ? { act: 'tb', arg: 'camp' } : false },
  { id: 'belt', ic: '⛓', n: '传送带', d: '加工建筑的面板里能接传送带：上下游挨得近，就能直接供料，少用搬运工，下游还快一点。',
    slow: true,
    when: (S, c) => { if (S.known < Sim.BELT[1].tier || (S.belts || []).length) return false; for (const b of make(S)(c)) if (Sim.beltOptions(S, b.id).some(o => o.ck.ok)) return { act: 'reqgo', arg: b.id }; return false; } },
  { id: 'kennel', ic: '🐕', n: '雪橇犬舍', d: '建一座犬舍养雪橇犬：侦察队跑得更快，连着这座营地的路也运得更多。狗要吃生肉。',
    when: (S, c) => Sim.countType(S, c.id, 'scout') && !S.buildings.some(b => b.type === 'kennel') && S.buildings.filter(b => b.camp === c.id).length >= 14 ? { act: 'tb', arg: 'build' } : false },
  { id: 'deco', ic: '🏮', n: '装饰建筑', d: '路灯、旗杆、雕像、花窖不产东西，但能让人心里亮一点（加希望）。放在大家常走的路边、熔炉旁边。',
    when: (S, c) => (c.hope ?? 50) < 50 && S.buildings.filter(b => b.camp === c.id).length >= 16 && !S.buildings.some(b => BLD[b.type].cat === 'deco') ? { act: 'tb', arg: 'build' } : false },
  { id: 'curve', ic: '📈', n: '数据曲线', d: '按 G（或「菜单 → 收藏」）看曲线：人口、温度、物资储量这几个小时是怎么变的，哪里在慢慢往下掉。',
    when: (S, c) => (c.hist && c.hist.f && c.hist.f.n >= 40) ? { act: 'curve' } : false },
  { id: 'depart', ic: '🛷', n: '可以北迁了', d: '出发前的四件事都备好了。打开「北行 → 北迁」，挑好带多少人、多少货，后面的营地是留守还是熄火，再按出发。车队在路上的时候，营地照常干活。',
    when: S => { const g = Sim.departGate(S); return g && g.ok && !Sim.journeyOf(S).trip ? { act: 'tb', arg: 'migrate' } : false; } },
  { id: 'trip', ic: '🚩', n: '车队上路了', d: '「北行 → 北迁」里能看车队走到哪儿、还要多久，点「跟着车队」镜头就跟过去。到了以后挑一块平地放下新熔炉，那里就是新的主营地。',
    when: S => { const T = Sim.journeyOf(S).trip; return T && T.phase !== 'arrive' && !Sim.roadView(S) ? { act: 'tb', arg: 'migrate' } : false; } },
  { id: 'photo', ic: '📷', n: '拍照模式', d: '按 H（或「菜单 → 收藏」）进拍照模式：藏起界面，换时辰、滤镜和镜头角度，给营地拍一张。',
    when: S => S.camps.length >= 2 || S.buildings.length >= 40 ? { act: 'photo' } : false },
];

export class Hints {
  constructor(g) {
    this.g = g; this.t = 0; this.since = -FIRST; this.slowT = 0; this.cur = null;
    const el = this.el = document.createElement('div'); el.id = 'hint';
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      this.done(); // 「去看看」的动作交给 body 上的点击委托
    });
  }
  seen(S) { return (S.meta.hints ||= {}); }
  // 每帧调；内部每 2 秒查一次
  tick(dt) {
    const g = this.g, S = g.S;
    this.t += dt; this.since += dt; this.slowT += dt;
    if (this.t < 2) return; this.t = 0;
    if (this.cur && this.cur.S !== S) this.hide();
    const blocked = !S.meta.tut || S.meta.hintOff || g.titleOn || (g.photo && g.photo.on) || g.place || document.getElementById('modal').classList.contains('show');
    const phoneSheet = innerWidth < 760 && document.body.classList.contains('sheet-open');
    this.el.classList.toggle('away', !!(blocked || phoneSheet || g.bigmap.open || g.chainmap.open));
    if (this.cur || blocked || this.since < GAP) return;
    const slow = this.slowT > 10; if (slow) this.slowT = 0;
    const c = Sim.getCamp(S, S.active) || S.camps[0], cr = Sim.rt(S).c[c.id] || {}, seen = this.seen(S);
    for (const h of HINTS) {
      if (seen[h.id] || (h.slow && !slow)) continue;
      let r = false; try { r = h.when(S, c, cr, g); } catch (e) { r = false; }
      if (!r) continue;
      this.show(S, h, r === true ? null : r);
      break;
    }
  }
  show(S, h, a) {
    this.cur = { S, h };
    this.seen(S)[h.id] = 1; // 弹出来就算看过：刷新页面不会再弹
    const touch = this.g.isTouch(), extra = touch ? h.touch : h.pc;
    this.el.innerHTML = iconize(`<div class="hk">✨ 新玩法</div><div class="hb"><span class="hi">${h.ic}</span><div><b>${h.n}</b><p>${h.d}${extra ? ' ' + extra : ''}</p></div></div>
      <div class="hbtn">${a ? `<button class="small go" data-act="${a.act}" data-arg="${a.arg ?? ''}">去看看</button>` : ''}<button class="small ghost">知道了</button></div>`);
    this.el.classList.add('show');
  }
  done() { this.since = 0; this.hide(); }
  hide() { this.cur = null; this.el.classList.remove('show'); }
}

// 老存档第一次打开新版：说一下这版加了什么，老存档是怎么接上的（from：存档原来是第几版）
export const WHATS_NEW = 15; // 14 = 1.0.0 正式版，15 = 1.1.0 炉火连城
export function whatsNewHtml(S, from = 13) {
  const J = Sim.journeyOf(S), main = Sim.mainCamp(S), depots = S.camps.filter(c => c.depot);
  Sim.bookTick(S); // 先把老存档早就做到的新成就补发了，下面好说个数
  const B = Sim.bookOf(S), got = Sim.ACH.filter(a => a.cat && B.a[a.id]).length;
  const atSpine = J.stage === Sim.SPINE && !J.trip, north = Sim.northN(J.stage);
  const notes = [];
  if (from < 12) {
    const back = S.meta.refund12 || 0;
    notes.push(`第十二版的改动也一起来了：北迁不再重开一局，「${main.name}」现在是主营地${depots.length ? `，${depots.map(c => '「' + c.name + '」').join('、')}变成补给站` : ''}；每章的头一个目标改成「每分钟产多少」；多了 4 倍速，离线攒资源比在线慢。${back ? `巧手强化多出来的几级退回了 🔥${back} 余烬。` : ''}`);
  }
  if (atSpine) notes.push('车队停在世界之脊，往北的路已经通了：北迁面板里的下一站就是「北境第 1 站」。');
  else if (north) notes.push(`你已经在北境第 ${north} 站了，接着往北走就行。`);
  if (got && from < 13) notes.push(`你以前做到的事已经算数：补发了 ${got} 个新成就，奖励在「菜单 → 收藏 → 装扮」里换上。`);
  if (from < 15) {
    const nr = (S.meta.netNew || []).length, sp = S.camps.filter(c => c.spec).length, bots = S.buildings.reduce((a, b) => a + (b.bots || 0), 0);
    notes.push(`1.1 接上了：${nr ? `原来的运输线和补给站换成了物流网，新修了 ${nr} 条路；` : S.camps.length > 1 ? '原来的运输线换成了物流网；' : ''}${sp ? `每座营地按地形分到了一样特产；` : ''}在岗的建筑从熟练 1 级算起；以前的研究都还在；${bots ? `营地里的 ${bots} 台自动机都按劳工型装回了仓里；` : ''}${S.cold ? '寒潮过一天开始报；' : ''}${north >= 4 ? '已经过了北境第 4 站，第一波永冬潮大约两天后报出来；' : ''}读档前自动备份了一份，「菜单 → 存档 → 自动备份」里能退回去。`);
  }
  notes.push('存档里的东西都没丢。');
  const W11 = [['🧭', '新界面', 0], ['🛷', '物流网', 1], ['⚗', '配方和特产', 2], ['🌨', '熟练工和寒潮', 3], ['🏪', '北方商会', 4], ['🔬', '45 项研究', 5], ['🤖', '自动机和号令', 6], ['🗺', '分岔和奇遇', 7], ['🏛', '奇观和城镇', 8], ['🔥', '鼎盛和永冬潮', 9]];
  const v11 = W11.map(([ic, n, i]) => `<div class="wn"><b>${ic} ${n}</b><span>${CHANGELOG[0].items[i]}</span></div>`).join('');
  const more = `<p class="hint">「菜单 → 帮助 → 更新日志」里能看到每一版加了什么。</p>`;
  if (from >= 14) return `<h2>${VERSION_NAME}</h2>${v11}<div class="wn"><b>📜 你的存档</b><span>${notes.join('')}</span></div>${more}`;
  const v1 = `<div class="wn"><b>🎉 1.0.0 正式版</b><span>${CHANGELOG[1].items.map(t => '· ' + t).join('<br>')}</span></div>`;
  if (from >= 13) return `<h2>${VERSION_NAME}</h2>${v11}<p class="hint wnfirst">1.0.0 正式版的改动也一起来了：</p>${v1}<div class="wn"><b>📜 你的存档</b><span>${notes.join('')}</span></div>${more}`;
  return `<h2>${VERSION_NAME}</h2>${v11}<p class="hint wnfirst">1.0.0 正式版和第十三版「极北篇」的内容也一起来了：</p>${v1}
<div class="wn"><b>🧭 无尽北境</b><span>翻过世界之脊还能一直往北走。北境每一站有一种地貌：地热谷、富矿带、永夜、狼群领地、冰湖群、古城遗址、风暴走廊、陨石雨、冻土无林……各有好处和麻烦，还有一项专属任务。菜单和地图上记着你走到过的最远一站。</span></div>
<div class="wn"><b>🗼 烽火塔</b><span>北境前十站各点亮一座烽火塔：打地基、喂高级材料、点火，一道光柱连回南边。第十站是天火塔，点着它就是最终结局。</span></div>
<div class="wn"><b>🏆 成就与装扮</b><span>二十个新成就，奖励称号、炉火颜色、营旗图案、相框和八种北境装饰。相册会自动记下抵达、点塔这些时刻，拍照模式里也能收进去。</span></div>
<div class="wn"><b>⛏ 矿点规划</b><span>矿快挖空会提前说，便宜的勘探随时补；摆建筑会挡住矿点时预览变黄。建筑能「挪位置」，不花材料；地上的金星是推荐位置；规划器会告诉你还差几座。</span></div>
<div class="wn"><b>💾 存档</b><span>存档能存成文件、从文件读回来，存档位可以删除；拍的照片能直接保存。</span></div>
<div class="wn"><b>📜 你的存档</b><span>${notes.join('')}</span></div>`;
}
