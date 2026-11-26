// 老营地：补给站自己运转、不盖不升、物流网往北送货、临时接手、熄火换余烬
import * as G from '../src/sim.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

const S = G.newRun(G.defaultMeta(), 0, 777), J = G.journeyOf(S);
S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S);
const old = G.mainCamp(S); old.people = 40;
for (const k of ['wood', 'stone', 'plank', 'food', 'coal']) old.stock[k] = 5000;
G.getB(S, old.furnace).lvl = 3; for (let k = 0; k < 3; k++) G.chapState(S).ok['0:' + k] = 1;
J.fleet.sled = 20;
{ let k = 0; for (const t of ['lumber', 'tent', 'quarry', 'tent', 'hunter']) for (let y = Math.floor(old.y) - 6; y <= old.y + 6; y++) { let done = false; for (let x = Math.floor(old.x) - 6; x <= old.x + 6; x++) if (G.checkPlace(S, t, x, y).ok && G.place(S, t, x, y).ok) { k++; done = true; break; } if (done) break; }
  ok(k >= 4, `old camp has ${k} buildings`); }
ok(G.depart(S).ok, 'departs, old main kept by default');
let n = 0; while (J.trip && n < 3000) { G.step(S, 1); n++; }
const m = G.mainCamp(S), d = S.camps.find(c => c.id === old.id);
ok(J.stage === 1 && d && d.depot && G.depotAuto(d), `old main is a supply depot with ${d.people} people`);
// 不盖新房、不升级
let at = null; for (let y = Math.floor(d.y) - 5; y <= d.y + 5 && !at; y++) for (let x = Math.floor(d.x) - 5; x <= d.x + 5 && !at; x++) { const c = G.checkPlace(S, 'tent', x, y); if (/补给站/.test(c.reason)) at = [x, y, c.reason]; }
ok(!!at, 'cannot build in a depot: ' + (at && at[2]));
const lum = S.buildings.find(b => b.camp === d.id && b.type !== 'furnace') || G.getB(S, d.furnace);
ok(/补给站/.test(G.upgrade(S, lum.id).reason || ''), 'cannot upgrade in a depot');
// 临时接手
G.takeOver(S, d.id, true);
ok(!G.depotAuto(d) && !/补给站/.test(G.checkPlace(S, 'tent', at[0], at[1]).reason), 'take over → can build again');
G.takeOver(S, d.id, false);
ok(G.depotAuto(d) && d.auto === true, 'hand back → runs itself');
// 自动派人：补给站关了自动派人也照样派
d.auto = false; for (const b of S.buildings) if (b.camp === d.id) b.workers = 0;
for (let i = 0; i < 6; i++) G.step(S, 1);
ok(S.buildings.some(b => b.camp === d.id && b.workers > 0), 'depot staffs its own buildings');
// 物流网：补给站多出来的往缺的主营地送
ok(G.roadBetween(S, d.id, m.id) && G.roadBetween(S, d.id, m.id).kind === 'trunk', 'depot and main camp joined by a trunk road');
m.stock.food = 5; d.stock.food = 4000; d.stock.stone = 4000;
let f0 = m.stock.food; for (let i = 0; i < 90; i++) G.step(S, 1);
ok(m.stock.food > f0 + 30, `food ships to the main camp (${Math.round(f0)} → ${Math.round(m.stock.food)})`);
ok(d.stock.food >= d.people * G.EAT * 30 - 1, 'depot keeps half an hour of food');
// 长期供货代替原来的「送哪几样」
const s0 = m.stock.stone || 0; G.addFeed(S, d.id, m.id, 'stone', 20);
for (let i = 0; i < 60; i++) G.step(S, 1);
ok((m.stock.stone || 0) > s0, 'a stone feed ships north');
G.delFeed(S, G.feeds(S)[0].id);
// 撑不住提醒
for (const k of ['wood', 'coal', 'coke']) d.stock[k] = 0;
for (let i = 0; i < 31; i++) G.step(S, 1);
ok(S.log.some(l => /补给站「/.test(l.msg) && /燃料|挨饿|只剩/.test(l.msg)), 'warns when a depot is in trouble: ' + (S.log.filter(l => /补给站「/.test(l.msg)).pop() || {}).msg);
// 存档
d.manual = true; G.toggleHold(S, d.id, 'stone');
const S2 = G.deserialize(G.serialize(S)), d2 = S2.camps.find(c => c.id === d.id);
ok(d2.depot && d2.manual && d2.hold.stone, 'depot settings survive save/load');
d.manual = false; G.toggleHold(S, d.id, 'stone');
// 熄火
const e0 = S.meta.embers, p0 = m.people + (m.wait || 0), dp = d.people, nr = J.ruins.length;
const r = G.douseDepot(S, d.id);
ok(r.ok && S.meta.embers === e0 + r.embers && r.embers > 0, `douse gives ${r.embers} embers`);
ok(!S.camps.find(c => c.id === d.id) && J.ruins.length === nr + 1 && J.ruins[nr].b.length > 0, 'camp becomes a ruin with its buildings');
ok(m.people + (m.wait || 0) === p0 + dp, `people walked north (${dp})`);
ok(!G.douseDepot(S, m.id).ok, 'main camp cannot be doused this way');
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
