// 新玩法提示：每条的条件在开局时都不成立，凑齐条件后成立，并且给出能用的「去看看」
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
import { HINTS } from '../src/hints.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const H = id => HINTS.find(h => h.id === id);
const ask = (S, id) => { const c = S.camps[0]; return H(id).when(S, c, G.rt(S).c[c.id] || {}, {}); };
const mk = () => { const S = G.newRun(G.defaultMeta(), 0, 777), c = S.camps[0]; run(S, 6); for (const k of ['wood', 'plank', 'stone', 'food', 'coal', 'iron']) c.stock[k] = 900; return { S, c }; };
const spot = (S, c, type) => { for (let r = 2; r < 14; r++) for (let y = Math.floor(c.y - r); y <= c.y + r; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) if (G.checkPlace(S, type, x, y).ok) return [x, y]; return null; };
const build = (S, c, type) => { const at = spot(S, c, type); if (!at) return null; const r = G.place(S, type, at[0], at[1]); return r.ok ? G.getB(S, r.id) : null; };

{ const { S } = mk();
  const on = HINTS.filter(h => { try { return !!ask(S, h.id); } catch (e) { console.log(h.id, e.message); return true; } });
  ok(!on.length, `开局一条都不弹：${on.map(h => h.id).join(',') || '无'}`);
  ok(new Set(HINTS.map(h => h.id)).size === HINTS.length, `${HINTS.length} 条，id 不重复`);
}
// 同类三栋 → 批量；指向其中一栋
{ const { S, c } = mk(); for (let i = 0; i < 3; i++) build(S, c, 'lumber'); for (const k of ['wood', 'stone']) c.stock[k] = 900;
  const r = ask(S, 'bulk'); ok(r && r.act === 'reqgo' && G.getB(S, r.arg).type === 'lumber', `三栋伐木场 → 批量提示 ${JSON.stringify(r)}`); }
// 生产链：两栋加工 + 十栋建筑
{ const { S, c } = mk(); S.known = 2;
  for (const t of ['sawmill', 'kitchen', 'lumber', 'hunter', 'quarry', 'tent', 'tent', 'tent', 'warehouse']) { build(S, c, t); for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 900; }
  const n = S.buildings.filter(b => b.camp === c.id).length;
  ok(!!ask(S, 'chain') === (n >= 10), `生产链：${n} 栋 → ${JSON.stringify(ask(S, 'chain'))}`); }
// 病人 + 能建医务所
{ const { S, c } = mk(); S.known = 2; G.rt(S).c[c.id].sick = 2;
  ok(ask(S, 'ward') && ask(S, 'ward').arg === 'build', '有人病了 → 医务所提示');
  build(S, c, 'infirmary'); ok(!ask(S, 'ward'), '建了医务所就不弹'); }
// 庆典
{ const { S, c } = mk(); c.people = 30; c.hope = 40; ok(ask(S, 'fest') && ask(S, 'fest').arg === c.furnace, '人够了、希望不高 → 庆典提示指熔炉');
  c.hope = 80; ok(!ask(S, 'fest'), '希望很高就不催'); }
// 专精
{ const { S, c } = mk(); G.getB(S, c.furnace).lvl = 5; ok(ask(S, 'focus') && ask(S, 'focus').arg === 'camp', '熔炉 5 级 → 专精提示'); c.focus = 'mine'; ok(!ask(S, 'focus'), '选了就不弹'); }
// 掠夺者索贡
{ const { S } = mk(); const g = G.gangsOf(S)[0]; S.gangs = { [g.id]: { seen: 1, next: 9e9, rel: 0, wins: 0, n: 0, dem: { camp: S.camps[0].id, until: S.t + 900 } } };
  ok(ask(S, 'gang') && ask(S, 'gang').arg === g.id, '索贡 → 提示指向那一伙'); }
// 怪天气：找到下一次预报
{ const { S, c } = mk(); let hit = null;
  for (let t = 0; t < 40 && !hit; t++) { const e = G.wxeAt(S, S.t); if (e.ev && !e.on && e.inSec <= G.FORECAST) { hit = e; break; } S.t += 600; }
  if (hit) { const m = G.wxeMatters(S, c, hit.ev); ok(!!ask(S, 'wxe') === m, `预报「${G.WXE[hit.ev.kind].n}」，跟本营地有关 ${m} → 提示 ${!!ask(S, 'wxe')}`); }
  else ok(false, '没找到怪天气预报'); }
// 深井：矿挖到只剩两成
{ const { S, c } = mk(); const R = G.rt(S); let b = null;
  for (const type of ['quarry']) { let best = null, bs = 0;
    for (let y = Math.floor(c.y - 9); y <= c.y + 9; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9; x++) { const ck = G.checkPlace(S, type, x, y); if (ck.ok && ck.spots > bs) { bs = ck.spots; best = [x, y]; } }
    if (best) { const r = G.place(S, type, best[0], best[1]); if (r.ok) b = G.getB(S, r.id); } }
  if (b) { run(S, 4); ok(!ask(S, 'deep'), '矿还多不弹');
    for (const s of R.gatherSpots.get(b.id) || []) S.spots[s.i] = 0;
    const f = G.gatherLeftFrac(S, b), r = ask(S, 'deep'); ok(f <= 0.25 && r && r.arg === b.id, `剩 ${Math.round(f * 100)}% → 深井提示 ${JSON.stringify(r)}`); }
  else ok(false, '采石场没地方建'); }
// 数据曲线 / 拍照
{ const { S, c } = mk(); run(S, 1300, 5); ok(ask(S, 'curve') && ask(S, 'curve').act === 'curve', `玩了 20 多分钟 → 曲线提示（${c.hist.f.n} 个点）`); }
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
