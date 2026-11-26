// 路上的事：出发时抽好、走到了弹出来、车队停下等、一分钟不选按默认、离线按默认、存档带着
import * as G from '../src/sim.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const bad = s => /undefined|NaN|null/.test(s);

function ready(seed) {
  const S = G.newRun(G.defaultMeta(), 0, seed);
  S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S);
  const m = G.mainCamp(S); m.people = 40;
  for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'game']) m.stock[k] = 5000;
  G.getB(S, m.furnace).lvl = 3; for (let k = 0; k < 3; k++) G.chapState(S).ok['0:' + k] = 1;
  G.journeyOf(S).fleet.sled = 20;
  return S;
}

const S = ready(777), J = G.journeyOf(S);
ok(G.depart(S).ok, 'departs');
const T = J.trip;
ok(T.ev.length >= 2 && T.ev.length <= 3, `${T.ev.length} road events rolled: ${T.ev.map(e => e.id + '@' + e.at.toFixed(2)).join(' ')}`);
ok(T.ev.every((e, i) => e.at > 0.15 && e.at < 0.9 && (!i || e.at > T.ev[i - 1].at)), 'events spread along the road in order');
ok(T.ev.every(e => ['storm', 'lost', 'wolves'].includes(e.id)), 'first leg only draws storm / stranded / wolves');
let n = 0;
while (!T.road && n < 1000) { G.step(S, 1); n++; }
ok(T.road && T.road.id === T.ev[0].id, `first event pops after ${n}s at ${(T.d / T.len * 100).toFixed(0)}%`);
const d0 = T.d; for (let i = 0; i < 10; i++) G.step(S, 1);
ok(T.d === d0 && T.road, 'caravan waits while the event is open');
const v = G.roadView(S);
ok(v && v.opts.length === 2 && v.opts[0].def && v.opts[0].ok && v.left <= 50 && v.left > 40, `view: ${v.title} · ${v.opts.map(o => o.t + '〔' + o.d + '〕').join(' / ')} · ${v.left}s left`);
for (let i = 0; i < 55 && T.road; i++) G.step(S, 1);
ok(!T.road && T.done.length === 1 && T.done[0][1] === 0, 'no answer in a minute → default option');
ok(S.log.some(l => /按默认的办/.test(l.msg)), 'log says the default was taken');

// 每一件都强行弹一次，两个选项的说明和结果都跑通
for (const id of G.ROAD_IDS) {
  for (const pick of [0, 1]) {
    T.ev.push({ id, at: T.d / T.len + 1e-4 }); T.hold = 0;
    if (id === 'bot') T.goods.part = 30;
    if (id === 'chasm') T.goods.steel = 300;
    G.step(S, 1);
    if (!T.road || T.road.id !== id) { ok(false, `forced ${id} did not pop`); continue; }
    const w = G.roadView(S);
    const txt = w.text + w.opts.map(o => o.t + o.d).join('');
    const useable = w.opts[pick].ok;
    const msg = useable ? G.resolveRoad(S, pick) : G.resolveRoad(S, 0);
    ok(!bad(txt) && msg && !bad(msg), `${id} → ${useable ? w.opts[pick].t : w.opts[0].t + '（另一项不能选）'}：${w.opts[pick].d}`);
  }
}
// 搭桥要车上多带的木板
T.hold = 0; T.detour = 0; T.goods.plank = 60; T.ev.push({ id: 'ice', at: T.d / T.len + 1e-4 }); G.step(S, 1);
ok(!G.roadView(S).opts[1].ok, 'bridge needs spare planks (the furnace kit does not count)');
T.goods.plank = 200;
ok(G.roadView(S).opts[1].ok, 'bridge allowed with 140 spare planks');
G.resolveRoad(S, 0);
ok(T.detour === 10, 'detour adds 10 tiles at half speed');
// 顶着暴风雪走：到了以后有病人
T.hold = 0; T.detour = 0; T.ev.push({ id: 'storm', at: T.d / T.len + 1e-4 }); G.step(S, 1); G.resolveRoad(S, 1);
const sick = T.sick;
ok(sick > 0, `pushing through the storm hurts ${sick}`);
// 存档里带着弹出来的事
T.hold = 0; T.ev.push({ id: 'lost', at: T.d / T.len + 1e-4 }); G.step(S, 1);
const S2 = G.deserialize(G.serialize(S));
ok(G.roadView(S2) && G.roadView(S2).id === 'lost', 'open event survives save/load');
G.resolveRoad(S, 0);
n = 0; while (J.trip && n < 3000) { G.step(S, 1); n++; }
ok(!J.trip && J.stage === 1, `arrived after ${n}s more`);
const nm = G.mainCamp(S);
ok(Math.floor(nm.sick) >= 1, 'frostbitten arrive sick: ' + nm.sick.toFixed(1));
ok(J.legs[0].road.length >= 5, 'leg history keeps the events: ' + J.legs[0].road.map(x => x.join(':')).join(' '));

// 离线：按默认一路走到
const O = ready(778);
ok(G.depart(O).ok, 'second run departs');
const ne = G.journeyOf(O).trip.ev.length;
G.catchUp(O, 1500);
ok(G.journeyOf(O).stage === 1 && G.journeyOf(O).legs[0].road.length === ne && G.journeyOf(O).legs[0].road.every(x => x[1] === 0), `offline: all ${ne} events took the default`);
// 抽签：七件事在各自那几程才会有
const seen = {};
for (let k = 0; k < 12; k++) for (let s = 0; s < 30; s++) { const X = { runSeed: s + 1 }; for (const e of G.rollRoad(X, { from: k, to: k + 1, t0: s * 100, people: 50, veh: { sled: 5, tractor: 2 }, len: 50, d: 0 })) (seen[e.id] || (seen[e.id] = new Set())).add(k); }
const rng = id => [...(seen[id] || [])].sort((a, b) => a - b);
console.log(Object.keys(seen).map(id => id + ' ' + rng(id).join(',')).join(' | '));
ok(rng('wolves').every(k => k <= 1) && rng('ice').every(k => k >= 2 && k <= 3) && rng('wreck').every(k => k >= 3) && rng('bot').every(k => k >= 5) && rng('night').every(k => k >= 6) && rng('chasm').every(k => k >= 6) && rng('chasm').length, 'regional events only on their legs');
ok(rng('storm').length === 12 && rng('lost').length === 12, 'storm and stranded can happen on every leg');
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
