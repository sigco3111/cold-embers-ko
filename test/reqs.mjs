// 人物委托：隔一阵冒出来（最多两个），做到能领回报，过期扣一点希望
import * as G from '../src/sim.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 5) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const meta = G.defaultMeta(); meta.sites.push(1);
const S = G.newRun(meta, 1, 777);
const c = S.camps[0];
run(S, 20);
ok(!G.rollRequest(S) && S.reqs.length === 0, '开局一阵子没有委托');
const seen = {};
for (let i = 0; i < 60 && S.reqs.length < 2; i++) { run(S, 120, 10); const r = G.rollRequest(S); if (r) seen[r.kind] = G.reqTitle(S, r); }
ok(S.reqs.length === 2, `冒出两个委托：${S.reqs.map(r => G.reqTitle(S, r)).join(' / ')}`);
run(S, 3000, 10); G.rollRequest(S);
ok(S.reqs.length <= 2, '最多两个');
// 造一个能完成的：攒物资
const r = { kind: 'stock', k: 'wood', n: 50, rw: { embers: 2, hope: 6 }, id: S.nextId++, camp: c.id, t0: S.t, until: S.t + 3600 };
S.reqs = [r];
c.stock.wood = 10;
ok(!G.claimReq(S, r.id).ok, '没攒够不能交');
c.stock.wood = 200; const e0 = S.meta.embers || 0, h0 = c.hope ?? 50;
const got = G.claimReq(S, r.id);
ok(got.ok && c.stock.wood === 150 && (S.meta.embers || 0) === e0 + 2 && (c.hope ?? 50) >= Math.min(100, h0 + 6) - 0.01, `交了 50 木材，余烬 +2，希望 ${h0.toFixed(0)}→${c.hope.toFixed(0)}`);
ok(!S.reqs.length && S.stats.reqs === 1, '委托完成计数');
// 过期
const r2 = { kind: 'beds', n: 5, rw: { hope: 6 }, id: S.nextId++, camp: c.id, t0: S.t, until: S.t + 10 };
S.reqs = [r2]; const h1 = c.hope;
run(S, 20); G.rollRequest(S);
ok(!S.reqs.some(x => x.id === r2.id) && c.hope <= h1 - 1.5, `过期后消失、希望 −2（${h1.toFixed(1)}→${c.hope.toFixed(1)}）`);
// 建造类
const r3 = { kind: 'build', type: 'kitchen', n: G.campBuildings(S, c.id).filter(b => b.type === 'kitchen').length, rw: { res: { plank: 60 }, hope: 5 }, id: S.nextId++, camp: c.id, t0: S.t, until: S.t + 3600 };
S.reqs = [r3];
ok(G.reqProgress(S, r3).done && G.claimReq(S, r3.id).ok, '已经有的建筑也算');
// 存档
S.reqs = [{ ...r, id: S.nextId++ }];
const S2 = G.deserialize(G.serialize(S));
ok(S2.reqs && S2.reqs.length === 1, '读档后委托还在');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
