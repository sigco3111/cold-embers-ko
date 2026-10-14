// 新玩法提示：新手引导走完以后，某个玩法第一次用得上时，弹一张小卡片说一句怎么用（每样只说一次）
import { BLD, FOCUS_LVL } from './data.js';
import * as Sim from './sim.js';
import { iconize } from './icons.js';

const GAP = 75, FIRST = 25; // 两张提示至少隔 75 秒；打开游戏 25 秒后才开始
const make = S => c => S.buildings.filter(b => b.camp === c.id && BLD[b.type].cat === 'make');

// when(S, c, cr, g) 返回 false 表示还用不上；返回 { act, arg } 表示「去看看」按钮要做什么（没有按钮就返回 true）
export const HINTS = [
  { id: 'gang', ic: '🏴', n: '掠夺者来索贡了', d: '点顶上的 🏴 答复：交贡、做买卖，或者靠箭塔顶回去。到时候没人答复，守得住就打，守不住就交贡。',
    when: S => { const d = Sim.gangDemands(S)[0]; return d ? { act: 'gang', arg: d.g.id } : false; } },
  { id: 'wxe', ic: '❄', n: '怪天气要来了', d: '冰风暴、极寒夜、冰湖开裂都会提前预报。点顶上的天气图标，花点材料提前准备，能少受很多罪。',
    when: (S, c) => { const e = Sim.wxeAt(S, S.t); return e.ev && !e.on && e.inSec <= Sim.forecastOf(S) && Sim.wxeMatters(S, c, e.ev) && !Sim.wxePrepped(S, c, e.ev) ? { act: 'wx' } : false; } },
  { id: 'ward', ic: '🩺', n: '有人病了', d: '建一座医务所，派两个人照看：住进去的病人在冷天里也能慢慢好起来，营地里染病的人也会少。',
    when: (S, c, cr) => (cr.sick || 0) >= 1 && Sim.unlocked(S, 'infirmary') && !Sim.countType(S, c.id, 'infirmary') ? { act: 'tb', arg: 'build' } : false },
  { id: 'deep', ic: '⛏', n: '矿快挖空了', d: '矿场面板里能「打深井」：地表采空以后还能慢慢挖下去。侦察营还能派人勘探新矿脉。',
    when: (S, c) => { const gs = Sim.rt(S).gatherSpots; const b = S.buildings.find(b => b.camp === c.id && !b.deep && Sim.deepable(b.type) && gs && (gs.get(b.id) || []).length && Sim.gatherLeftFrac(S, b) <= 0.25); return b ? { act: 'reqgo', arg: b.id } : false; } },
  { id: 'chain', ic: '🔗', n: '生产链总览', d: '按 C（或「物资」面板最上面）看整条生产链：哪一环缺人、缺料、堆满了，一眼就能看出来。',
    when: (S, c) => make(S)(c).length >= 2 && S.buildings.filter(b => b.camp === c.id).length >= 10 ? { act: 'chainmap' } : false },
  { id: 'bulk', ic: '⬆', n: '一次管一批', d: '同类建筑多了：面板里能「每栋升一级」「都派满」。建造时还能一次摆一排。',
    pc: '建造时按住左键拖一下，一次摆一排。', touch: '建造时先点「一排」，再拖预览，一次摆一排。',
    when: (S, c) => { const n = {}; for (const b of S.buildings) if (b.camp === c.id && b.type !== 'tent' && BLD[b.type].cat !== 'deco' && b.type !== 'furnace') if ((n[b.type] = (n[b.type] || 0) + 1) >= 3) return { act: 'reqgo', arg: b.id }; return false; } },
  { id: 'fest', ic: '🎉', n: '可以办篝火庆典了', d: '熔炉面板里能办庆典：花些熟食和木材，大家歇一会儿，希望一下子涨上去，之后干活也更有劲。',
    when: (S, c) => !Sim.festBlock(S, c) && (c.hope ?? 50) < 60 ? { act: 'reqgo', arg: c.furnace } : false },
  { id: 'focus', ic: '🧭', n: '营地可以选专精了', d: '熔炉到了 ' + FOCUS_LVL + ' 级：在「营地」面板里选矿业、农垦、工坊或要塞，强一样、弱一样。',
    when: (S, c) => !c.focus && !c.trade && (Sim.getB(S, c.furnace) || {}).lvl >= FOCUS_LVL ? { act: 'tb', arg: 'camp' } : false },
  { id: 'belt', ic: '⛓', n: '传送带', d: '加工建筑的面板里能接传送带：上下游挨得近，就能直接供料，少用搬运工，下游还快一点。',
    slow: true,
    when: (S, c) => { if (S.known < Sim.BELT[1].tier || (S.belts || []).length) return false; for (const b of make(S)(c)) if (Sim.beltOptions(S, b.id).some(o => o.ck.ok)) return { act: 'reqgo', arg: b.id }; return false; } },
  { id: 'kennel', ic: '🐕', n: '雪橇犬舍', d: '建一座犬舍养雪橇犬：侦察队和连着这座营地的运输线都会跑得更快。狗要吃生肉。',
    when: (S, c) => Sim.countType(S, c.id, 'scout') && !S.buildings.some(b => b.type === 'kennel') && S.buildings.filter(b => b.camp === c.id).length >= 14 ? { act: 'tb', arg: 'build' } : false },
  { id: 'deco', ic: '🏮', n: '装饰建筑', d: '路灯、旗杆、雕像、花窖不产东西，但能让人心里亮一点（加希望）。放在大家常走的路边、熔炉旁边。',
    when: (S, c) => (c.hope ?? 50) < 50 && S.buildings.filter(b => b.camp === c.id).length >= 16 && !S.buildings.some(b => BLD[b.type].cat === 'deco') ? { act: 'tb', arg: 'build' } : false },
  { id: 'curve', ic: '📈', n: '数据曲线', d: '按 G（或「物资」面板最上面）看曲线：人口、温度、物资储量这几个小时是怎么变的，哪里在慢慢往下掉。',
    when: (S, c) => (c.hist && c.hist.f && c.hist.f.n >= 40) ? { act: 'curve' } : false },
  { id: 'depart', ic: '🛷', n: '可以北迁了', d: '出发前的四件事都备好了。打开「北迁」面板，挑好带多少人、多少货，后面的营地是留守还是熄火，再按出发。车队在路上的时候，营地照常干活。',
    when: S => { const g = Sim.departGate(S); return g && g.ok && !Sim.journeyOf(S).trip ? { act: 'tb', arg: 'migrate' } : false; } },
  { id: 'trip', ic: '🚩', n: '车队上路了', d: '「北迁」面板里能看车队走到哪儿、还要多久，点「跟着车队」镜头就跟过去。到了以后挑一块平地放下新熔炉，那里就是新的主营地。',
    when: S => { const T = Sim.journeyOf(S).trip; return T && T.phase !== 'arrive' && !Sim.roadView(S) ? { act: 'tb', arg: 'migrate' } : false; } },
  { id: 'photo', ic: '📷', n: '拍照模式', d: '按 H（或菜单里）进拍照模式：藏起界面，换时辰、滤镜和镜头角度，给营地拍一张。',
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

// 老存档第一次打开第十二版：说一下这版改了什么，老存档是怎么接上的
export const WHATS_NEW = 12;
export function whatsNewHtml(S) {
  const J = Sim.journeyOf(S), main = Sim.mainCamp(S), depots = S.camps.filter(c => c.depot);
  const back = S.meta.refund12 || 0;
  return `<h2>第十二版 · 一路往北</h2>
<div class="wn"><b>🛷 北迁</b><span>北迁不再重开一局。造好雪橇和拖车，带上人和货上路；到了新地标点起新熔炉，那里就是新的主营地。后面的营地可以留守，变成补给站往北送货，也可以熄火换余烬。全程十二站，永恒之炉以北还有六站。</span></div>
<div class="wn"><b>📈 产能主线</b><span>每一章的头一个目标改成「每分钟产多少」。产线能升星，有支线和里程碑；规划器帮你算要几座建筑；老向导会指出现在卡在哪一环。整条产线可以一键复制。</span></div>
<div class="wn"><b>⚖ 节奏</b><span>多了 4 倍速；离开一阵回来会看到一份报告。离线也会攒资源，但比在线慢。升级和同一种建筑越建越贵，加成有上限，数字不会一下子涨飞。</span></div>
<div class="wn"><b>🏔 模型</b><span>建筑、人和地面都做得更细了。</span></div>
<div class="wn"><b>💾 你的存档</b><span>已经接上了，什么都没丢：「${main.name}」现在是主营地${depots.length ? `，${depots.map(c => '「' + c.name + '」').join('、')}变成补给站，自己运转、往北送货` : ''}。还没领奖的章节换成了新的产能目标。${back ? `巧手强化现在最多 15 级，多出来的几级退回了 🔥${back} 余烬，可以在「北迁 → 余烬强化」里重新分配。` : ''}</span></div>`;
}
