// 掠夺者营地：地图上有、侦察到才出现、索贡（纳贡 / 做买卖 / 顶回去）、没人答复时的默认、打赢两次散伙
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
import { getWorld, idx } from '../src/worldgen.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S0 = G.newRun(G.defaultMeta(), 0, 3131);
const w = getWorld(S0.runSeed);
ok(w.gangs && w.gangs.length >= 5, `地图上有 ${w.gangs.length} 处掠夺者营地：${w.gangs.map(g => g.y).join(',')}`);
ok(w.gangs.every(g => !w.sites.some(s => Math.hypot(s.x - g.x, s.y - g.y) < 6)), '不和遗迹挤在一起');
const g0 = w.gangs[0];
ok(!!G.siteAt(S0, g0.x + 1, g0.y + 1, 0), '营地上不能盖房子');
const mk = () => {
  const S = G.newRun(G.defaultMeta(), 0, 3131), c = S.camps[0];
  run(S, 6);
  for (const k of ['wood', 'plank', 'stone', 'food', 'coal']) c.stock[k] = 900;
  c.people = 40; // 太小的营地掠夺者看不上
  return { S, c, g: getWorld(S.runSeed).gangs[0] };
};
// 没侦察到：什么都不发生
{ const { S } = mk(); run(S, 1200); ok(!S.gangs || !Object.keys(S.gangs).length, '没侦察到就没动静'); }
// 侦察到
const reveal = (S, g) => { S.reveal[idx(g.x, g.y)] = 1; };
// 营地太小：看不上
{ const { S, c, g } = mk(); c.people = 12; reveal(S, g); run(S, G.GANG_FIRST + 30); ok(!S.gangs[g.id].dem && !G.gangTarget(S, g), `只有 ${c.people} 人的营地他们看不上`); }
{ const { S, c, g } = mk(); reveal(S, g); run(S, 4);
  ok(S.gangs[g.id] && S.log.some(l => l.msg.includes('发现了掠夺者营地')), `发现「${G.gangName(g)}」`);
  ok(G.gangTarget(S, g) === c, `盯上了「${c.name}」（距离 ${Math.hypot(c.x - g.x, c.y - g.y).toFixed(0)}）`);
  run(S, G.GANG_FIRST + 4);
  const st = S.gangs[g.id];
  ok(st.dem && st.dem.camp === c.id, '过一阵来索贡');
  ok(G.gangDemands(S).length === 1, '顶栏能看到');
  // 纳贡
  const cost = G.gangTribute(S, g, c), f0 = c.stock.food;
  const r = G.gangAnswer(S, g.id, 'tribute');
  ok(r.ok && !st.dem && Math.abs(f0 - c.stock.food - cost.food) < 1e-6 && st.rel === 1, `纳贡：熟食 −${cost.food}，关系 ${st.rel}`);
  ok(!G.gangAnswer(S, g.id, 'tribute').ok, '没索贡时不能乱交');
  // 下一次：做买卖
  S.t = st.next + 1; run(S, 4);
  ok(st.dem, '下一回又来了');
  c.stock.plank = 10; const T = G.gangTrade(S, g, c), p0 = c.stock.plank;
  ok(Object.keys(T.get).length > 0 && Object.keys(T.get).every(k => true), `买卖：给 ${JSON.stringify(T.give)}，换 ${JSON.stringify(T.get)}`);
  ok(G.gangAnswer(S, g.id, 'trade').ok && c.stock.plank > p0 - (T.give.plank || 0), '做成了');
}
// 顶回去：守不住就挨抢；守得住缴获；赢两次散伙
{ const { S, c, g } = mk(); reveal(S, g); run(S, 4); S.t = S.gangs[g.id].next + 1; run(S, 4);
  const st = S.gangs[g.id];
  ok(G.gangAnswer(S, g.id, 'fight').ok && st.dem.fight, '决定顶回去');
  const p0 = c.people, w0 = c.stock.wood;
  ok(G.campDefense(S, c) < G.gangStr(S, g), `守不住：防御 ${G.campDefense(S, c)} 对 ${G.gangStr(S, g)}`);
  S.t = st.dem.until - 1; run(S, 4);
  ok(!st.dem && c.stock.wood < w0 && st.rel === 0, `被抢：木材 ${w0.toFixed(0)} → ${c.stock.wood.toFixed(0)}，${p0 - c.people} 人遇难`);
  // 造箭塔
  for (let i = 0; i < 3; i++) { let at = null; for (let y = Math.floor(c.y - 8); y <= c.y + 8 && !at; y++) for (let x = Math.floor(c.x - 8); x <= c.x + 8 && !at; x++) if (G.checkPlace(S, 'tower', x, y).ok) at = [x, y]; c.stock.wood = c.stock.stone = c.stock.plank = 900; const b = G.getB(S, G.place(S, 'tower', at[0], at[1]).id); b.lvl = 3; b.workers = G.maxWorkers('tower', 3); }
  c.people = Math.max(c.people, 12); c.auto = false;
  ok(G.campDefense(S, c) >= G.gangStr(S, g), `有箭塔：防御 ${G.campDefense(S, c)} 对 ${G.gangStr(S, g)}`);
  for (let round = 0; round < 2; round++) { S.t = st.next + 1; run(S, 4); G.gangAnswer(S, g.id, 'fight'); S.t = st.dem.until - 1; run(S, 4); }
  ok(st.wins === 2 && st.gone && S.stats.gangs === 1, `赢了 ${st.wins} 次，散伙了`);
  S.t += G.GANG_P * 2; run(S, 4); ok(!st.dem, '散伙以后不再来');
  run(S, 4); ok(G.bookOf(S).a.gang && G.bookOf(S).s.gang, '成就和收集册'); }
// 没人答复：守不住、交得起就自动纳贡
{ const { S, c, g } = mk(); reveal(S, g); run(S, 4); S.t = S.gangs[g.id].next + 1; run(S, 4);
  const st = S.gangs[g.id]; S.t = st.dem.until - 1; run(S, 4);
  ok(!st.dem && st.paid === 1, '没人答复：自动纳贡');
  // 交不起又打不过：能凑多少交多少，不打、不死人
  S.t = st.next + 1; run(S, 4); c.stock.food = 10; c.stock.wood = 5; const d0 = S.stats.deaths, f0 = c.stock.food; S.t = st.dem.until - 1; run(S, 4);
  ok(!st.dem && st.short === 1 && S.stats.deaths === d0 && c.stock.food >= f0 / 2 - 1, `凑不齐：只交一部分（熟食 ${f0} → ${Math.round(c.stock.food)}），没人遇难`);
  ok(st.next - S.t < G.GANG_P * 0.7, '下回来得早一些');
  // 越要越凶，但有上限
  st.n = 40; const s40 = G.gangStr(S, g); st.n = 8; ok(G.gangStr(S, g) === s40, `强度涨到头就不再涨（${s40}）`);
  // 存读档
  const S2 = G.deserialize(G.serialize(S)); ok(S2.gangs && S2.gangs[g.id].paid === 1, '存读档后还记得'); }
// 离得太远：不来
{ const { S, c } = mk(); const far = getWorld(S.runSeed).gangs[3]; reveal(S, far); run(S, 4); S.t += G.GANG_FIRST + 10; run(S, 4); ok(!S.gangs[far.id].dem, `太远（${Math.round(Math.hypot(c.x - far.x, c.y - far.y))} 格）不来索贡`); }
// 一次只来一伙：另一伙还在等答复，这伙往后推
{ const { S, c } = mk(); const [g0, g1] = getWorld(S.runSeed).gangs; reveal(S, g0); reveal(S, g1);
  S.gangs = { [g0.id]: { seen: 1, next: 9e9, rel: 0, wins: 0, n: 1, dem: { camp: c.id, until: S.t + 900, at: S.t } }, [g1.id]: { seen: 1, next: S.t, rel: 0, wins: 0, n: 0 } };
  run(S, 4); ok(!S.gangs[g1.id].dem && S.gangs[g1.id].next > S.t + 500, `另一伙在等答复时不叠着来（推到 ${Math.round(S.gangs[g1.id].next - S.t)} 秒后）`);
  ok(G.gangDemands(S).length === 1, '顶上只有一个索贡'); }
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
