// 1.1 物流网：自动修路、缺和余、自动调货、路上的货、手动送一批、长期供货、不外送、修路付钱、熄火接路、旧存档迁移、离线
import * as G from '../src/sim.js';
import { W } from '../src/worldgen.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const run = (S, s) => { for (let i = 0; i < s; i++) G.step(S, 1); };

const S = G.newRun(G.defaultMeta(), 0, 777), J = G.journeyOf(S);
S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S);
const main = G.mainCamp(S); main.people = 40;
for (const k of ['wood', 'stone', 'plank', 'food', 'coal']) main.stock[k] = 3000;
ok(G.roads(S).length === 0, 'one camp: no roads');

// 前哨：自动修一条雪橇道到最近的营地
let spot = null;
for (let y = 30; y < 40 && !spot; y++) for (let x = 2; x < W - 4; x++) { const c = G.checkPlace(S, 'furnace', x, y); if (c.ok) { spot = [x, y]; break; } }
const pr = G.place(S, 'furnace', spot[0], spot[1]);
const out = G.getCamp(S, pr.camp);
ok(G.roads(S).length === 1 && G.roads(S)[0].kind === 'sled' && G.roadBetween(S, out.id, main.id), 'outpost gets a free sled road to the main camp');
ok(S.log.some(l => /雪橇道已经修好/.test(l.msg)), 'outpost log says the road is built');
const road = G.roads(S)[0];
console.log('road', G.roadLen(S, road).toFixed(1), 'cells', G.roadTime(S, road).toFixed(1), 's', G.roadCap(S, road).toFixed(1), '/min');
ok(Math.abs(G.roadTime(S, road) - G.roadLen(S, road) / 3) < 1e-6, 'sled speed 3 cells/s');

// 补底：前哨的木材木板石料补到 200，从主营地运来
const o0 = { wood: out.stock.wood || 0, stone: out.stock.stone || 0, plank: out.stock.plank || 0 };
S.active = main.id;
run(S, 12);
ok(G.ships(S).length > 0 && G.ships(S).every(s => s.from === main.id && s.to === out.id), `ships leave the main camp for the outpost (${G.ships(S).map(s => s.k + ' ' + Math.round(s.n)).join(', ')})`);
ok(G.ships(S).every(s => s.n >= 10 - 1e-9), 'every batch is at least 10');
const sent10 = G.ships(S).reduce((a, s) => a + s.n, 0);
ok(sent10 <= G.roadCap(S, road) * 30 / 60 + 1e-6, `one window never ships more than the road allows (${sent10.toFixed(1)})`);
const v = G.netView(S, out.id);
ok(Object.keys(v.inc).length > 0 && Object.values(v.inc).every(x => x.eta > 0), 'netView shows incoming goods with an ETA');
run(S, 200);
ok(out.stock.wood > o0.wood + 20 && out.stock.plank > o0.plank + 20, `several goods arrive side by side: wood ${Math.round(o0.wood)} → ${Math.round(out.stock.wood)}, plank ${o0.plank} → ${Math.round(out.stock.plank)}`);
const flow = G.netRoadView(S, road).flow;
ok(flow > 5 && flow <= G.roadCap(S, road) * 1.6, `road flow shows up (${flow.toFixed(1)}/min of ${G.roadCap(S, road).toFixed(0)})`);
// 不会来回倒：主营地自己留 200
ok(main.stock.wood >= 200 && main.stock.stone >= 200, 'main camp keeps its own base stock');
ok(!G.ships(S).some(s => s.from === out.id && s.to === main.id && ['wood', 'stone', 'plank'].includes(s.k)), 'no ping-pong of base goods');

// 建造队列：前哨排一座需要木板的房子，料运过去
// 建造队列：前哨排一座要石料的房子；主营地自己攒石料升熔炉（第 6 档），照样先给前哨排队的（第 3 档）
out.stock.stone = 0; out.stock.wood = 0; out.stock.plank = 0;
let q = null;
for (let y = Math.floor(out.y) - 6; y <= out.y + 6 && !q; y++) for (let x = Math.floor(out.x) - 6; x <= out.x + 6 && !q; x++) { const r = G.queueBuild(S, 'quarry', x, y); if (r.ok && r.queued) q = r; }
ok(!!q, 'queued a quarry at the outpost');
const gq = G.campGaps(S, out);
ok(gq.some(g => g.tier === 3 && g.k === 'wood'), 'queue materials are a tier-3 gap: ' + gq.map(g => `${g.tier}:${g.k}:${Math.round(g.n)}`).join(' '));
run(S, 150);
ok(!G.queued(S, q.id), 'the queued quarry got built with goods from the main camp');

// 保命：前哨燃料快烧完，先送燃料
out.stock.wood = 0; out.stock.coal = 0; out.stock.coke = 0;
run(S, 3);
const gaps1 = G.campGaps(S, out);
ok(gaps1.some(g => g.tier === 1 && g.k === '@fuel'), 'low fuel is a tier-1 gap');
const got0 = (G.rt(S).net.got || []).length;
run(S, 40);
const fu = (G.rt(S).net.got || []).slice(got0).filter(x => x.to === out.id && ["battery","coke","coal","wood"].includes(x.k));
ok(fu.length > 0 && G.fuelUnitsOf(out.stock) > 0, 'fuel reaches the outpost first: ' + fu.map(x => x.k + ' ' + Math.round(x.n)).join(', '));

// 手动送一批
main.stock.food = 3000;
const sb = G.sendBatch(S, main.id, out.id, 'food', 100);
ok(sb.ok && sb.n === 100, 'send a batch of 100 food');
run(S, 300);
ok(!G.sends(S).length && S.log.some(l => /送到了：熟食|送到了：.*100/.test(l.msg)), 'batch arrives and logs: ' + ((S.log.filter(l => /送到了/.test(l.msg)).pop() || {}).msg || ''));
ok(!G.sendBatch(S, main.id, main.id, 'food', 10).ok, 'cannot send to itself');

// 长期供货
const st0 = out.stock.stone;
ok(G.addFeed(S, main.id, out.id, 'stone', 12).ok, 'feed 12 stone/min');
run(S, 120);
ok(out.stock.stone - st0 >= 18, `feed delivers stone (+${Math.round(out.stock.stone - st0)} in 2 min)`);
G.delFeed(S, G.feeds(S)[0].id); ok(!G.feeds(S).length, 'feed removed');

// 不外送
G.toggleHold(S, main.id, 'stone');
ok(!(G.campSpare(S, main, {})['stone'] > 0), 'held stone is not spare');
G.toggleHold(S, main.id, 'stone');
ok(G.campSpare(S, main, {})['stone'] > 0, 'unheld again');

// 修一条路：两头都没料就排队
const r2 = G.buildRoad(S, out.id, main.id, main.id);
ok(!r2.ok, 'no second road between the same camps');
const up0 = road.lvl, uc = G.roadUpCost(S, road);
main.stock.wood = 3000; main.stock.plank = 3000;
ok(G.upgradeRoad(S, road.id, main.id).ok && road.lvl === up0 + 1, `upgrade road with ${JSON.stringify(uc)}`);
ok(G.roadCap(S, road) > 30 * 1.4, 'level 2 road carries +50%');
ok(!G.railRoad(S, road.id, main.id).ok, 'no rail before 油与铁路 and level 3');
for (const c of S.camps) { c.stock.wood = 0; c.stock.plank = 0; c.stock.iron = 0; }
const ur = G.upgradeRoad(S, road.id, out.id);
ok(ur.ok && ur.queued && road.pend && road.pend.by === out.id, 'neither end can pay → queued at the viewed camp: ' + ur.reason);
ok(G.campGaps(S, out).some(g => g.tier === 3 && g.k === 'plank'), 'pending road cost is a queue gap');
out.stock.wood = 5000; out.stock.plank = 5000; out.stock.iron = 500;
run(S, 2);
ok(!road.pend && road.lvl === up0 + 2, 'queued upgrade finishes when materials arrive');

// 存档
const S2 = G.deserialize(G.serialize(S));
ok(S2.roads.length === S.roads.length && S2.roads[0].lvl === road.lvl, 'roads survive save/load');

// 北迁：主干道；熄火中间的补给站，两头自动接上
G.getB(S, main.furnace).lvl = 3; for (let k = 0; k < 3; k++) G.chapState(S).ok['0:' + k] = 1;
J.fleet.sled = 20; main.stock.food = 3000; main.stock.wood = 3000; main.stock.plank = 1000;
const dep = G.depart(S);
ok(dep.ok, 'depart ' + (dep.reason || ''));
let n = 0; while (J.trip && n < 3000) { G.step(S, 1); n++; }
const m2 = G.mainCamp(S);
const tr = G.roadBetween(S, main.id, m2.id);
ok(tr && tr.kind === 'trunk', 'arrival builds a trunk road old main ⇄ new main');
ok(G.roadCap(S, tr) >= 60 * 0.99, `trunk carries 60/min (${G.roadCap(S, tr).toFixed(1)})`);
main.stock.food = 4000; m2.stock.food = 2;
run(S, 12);
ok(G.ships(S).some(s => s.k === 'food' && s.to === m2.id), 'depot ships food north to the new main camp');
const s0 = G.ships(S).find(s => s.to === m2.id);
const eta = s0.t0 + s0.dur - S.t;
ok(eta > 5, `long trunk: food arrives in ${eta.toFixed(0)} s`);
// 路过中间营地转运：前哨 → 主营地，要经过老主营地
main.stock.stone = 200; m2.stock.stone = 0; out.stock.stone = 3000; m2.stock.food = 3000; for (const k of ['wood', 'plank', 'iron']) m2.stock[k] = Math.max(m2.stock[k] || 0, 300);
let via = null;
for (let t = 0; t < 90 && !via; t++) { G.step(S, 1); via = G.ships(S).find(s => s.from === out.id && s.to === m2.id); }
ok(via && via.legs.length === 2, 'goods transit through a middle camp: ' + (via ? via.legs.length + ' legs' : 'none'));
// 中间熄火
const rd = G.douseDepot(S, main.id);
ok(rd.ok, 'douse the middle depot');
const heal = G.roadBetween(S, out.id, m2.id);
ok(heal && heal.lvl >= 1, `neighbours reconnected (${heal && heal.kind} lvl ${heal && heal.lvl})`);
ok(G.ships(S).every(s => s.to !== main.id), 'ships to the doused camp redirect');
run(S, 200);
ok(G.ships(S).every(s => G.getCamp(S, s.to)), 'all ships still have a destination');

// 旧存档：运输线 + 路线 + 补给站「送哪几样」
const O = G.newRun(G.defaultMeta(), 0, 777); O.reveal.fill(1);
const om = G.mainCamp(O); om.people = 40; for (const k of ['wood', 'stone', 'plank', 'food', 'coal']) om.stock[k] = 5000;
let sp2 = null;
for (let y = 30; y < 40 && !sp2; y++) for (let x = 2; x < W - 4; x++) { const c = G.checkPlace(O, 'furnace', x, y); if (c.ok) { sp2 = [x, y]; break; } }
const o2 = G.getCamp(O, G.place(O, 'furnace', sp2[0], sp2[1]).camp);
O.lines = [{ id: 9001, a: om.id, b: o2.id, lvl: 2, rail: false, routes: [{ from: 'a', res: 'wood', keep: 50 }, { from: 'b', res: 'coal' }, {}, {}] }];
delete O.roads; delete O.ships; delete O.feeds; delete O.sends;
const O2 = G.deserialize(G.serialize(O));
G.step(O2, 1);
ok(O2.roads.length === 1 && O2.roads[0].lvl === 2 && O2.roads[0].kind === 'sled', 'old line → level-2 sled road');
ok(O2.feeds.length === 2 && O2.feeds.some(f => f.k === 'wood' && f.from === om.id) && O2.feeds.some(f => f.k === 'coal' && f.from === o2.id), 'old routes → feeds: ' + JSON.stringify(O2.feeds.map(f => [f.k, f.rate])));
ok(!O2.lines.length, 'old lines cleared');

// 离线：路上的货不算增长，到了也不被扣
const F = G.deserialize(G.serialize(S));
const fm = G.mainCamp(F), fo = F.camps.find(c => c.id !== fm.id);
for (const c of F.camps) c.stock.stone = 0;
F.ships = [{ id: 99999, k: 'stone', n: 500, from: fo.id, to: fm.id, legs: [[G.roadBetween(F, fo.id, fm.id).id, fo.id]], t0: F.t, dur: 60, src: 'auto' }];
const sum = X => X.camps.reduce((a, c) => a + (c.stock.stone || 0), 0) + G.ships(X).filter(s => s.k === 'stone').reduce((a, s) => a + s.n, 0);
const b4 = sum(F);
G.catchUp(F, 600, 0.25);
ok(F.camps.reduce((a, c) => a + (c.stock.stone || 0), 0) >= 480 && !G.ships(F).some(s => s.id === 99999), `offline: in-transit stone arrives untrimmed (${Math.round(F.camps.reduce((a, c) => a + (c.stock.stone || 0), 0))} in camps)`);
ok(sum(F) >= b4 - 30, `offline: stone total kept (${b4} → ${Math.round(sum(F))})`);

console.log(fail ? `${fail} FAIL` : 'all ok');
