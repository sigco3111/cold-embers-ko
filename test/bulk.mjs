// 批量操作：同类一起升级（不够的排队）、一起派满人；拖出一排的预演和摆放
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 4321);
const c = S.camps[0];
run(S, 6);
for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 5000;
c.people = 40;
// 找三块能建伐木场（采集建筑）的地
const spots = [];
for (let y = Math.floor(c.y - 9); y <= c.y + 9 && spots.length < 3; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9 && spots.length < 3; x++) if (G.checkPlace(S, 'tent', x, y).ok) { G.place(S, 'tent', x, y); spots.push([x, y]); }
const tents = S.buildings.filter(b => b.type === 'tent');
ok(tents.length >= 3, `帐篷 ${tents.length} 栋`);
const lv0 = tents.map(b => b.lvl);
let r = G.bulkUpgrade(S, tents[0].id);
ok(r.up === tents.length && tents.every((b, i) => b.lvl === lv0[i] + 1), `材料够：${r.up}/${r.n} 栋各升一级`);
// 材料只够升一栋：升最低的那栋，其余排队
const one = G.upgradeCost(S, [...tents].sort((a, b) => a.lvl - b.lvl || a.id - b.id)[0]);
for (const k in c.stock) c.stock[k] = 0;
for (const k in one) c.stock[k] = one[k];
tents[1].lvl = 4; // 其他的等级高一点
r = G.bulkUpgrade(S, tents[1].id);
ok(r.up === 1 && r.q === tents.length - 1, `只够一栋：升 ${r.up}，排队 ${r.q}`);
ok(tents.filter(b => b.qup).length === tents.length - 1 && !tents.find(b => b.lvl === 3 && b.qup), '排队的是没升上的那几栋');
// 材料来了，排队的自动升
for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 5000;
run(S, 4);
ok(tents.every(b => !b.qup), '材料到齐自动升完，队列清空');
// 派满人
const saw = [];
for (let y = Math.floor(c.y - 9); y <= c.y + 9 && saw.length < 3; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9 && saw.length < 3; x++) if (G.checkPlace(S, 'sawmill', x, y).ok) { const p = G.place(S, 'sawmill', x, y); saw.push(G.getB(S, p.id)); }
ok(saw.length === 3, `锯木厂 ${saw.length} 栋`);
c.auto = false;
for (const b of saw) G.setWorkers(S, b.id, 0);
ok(saw.every(b => b.hold && b.workers === 0), '手动减到 0 人');
r = G.bulkStaff(S, saw[0].id);
ok(saw.every(b => b.workers === G.maxWorkers(b.type, b.lvl) && !b.hold), `都派满：添了 ${r.add} 人，还差 ${r.short}`);
// 人手不够时只派到够为止，先派等级高的
for (const b of saw) G.setWorkers(S, b.id, 0);
saw[2].lvl = 4;
c.people = G.assignedWorkers(S, c.id) + 3; // 只空出 3 个人
r = G.bulkStaff(S, saw[0].id);
ok(r.add === 3 && r.short > 0 && saw[2].workers === Math.min(3, G.maxWorkers('sawmill', 4)), `只有 3 个空闲：添 ${r.add}，还差 ${r.short}，先给 4 级的 ${saw[2].workers} 人`);
ok(G.idleLabor(S, c) === 0, '没有多派');
// 一排：沿主方向、按宽度隔开、最多 10 栋
const s = BLD.tent.size;
let sl = G.rowSlots('tent', 10, 10, 15, 11);
ok(sl.length === Math.round(5 / s) + 1 && sl.every(([x, y], i) => y === 10 && x === 10 + i * s), `横着拖：${JSON.stringify(sl)}`);
sl = G.rowSlots('tent', 10, 10, 9, 2);
ok(sl.every(([x, y], i) => x === 10 && y === 10 - i * s), `竖着往上拖：${JSON.stringify(sl)}`);
ok(G.rowSlots('tent', 0, 0, 100, 0).length === G.ROW_MAX, `最多 ${G.ROW_MAX} 栋`);
// 预演：材料按顺序扣、同类越建越贵；够的绿、不够的排队、不能建的红
c.people = 60;
let row = null;
for (let y = Math.floor(c.y - 12); y <= c.y + 12 && !row; y++) for (let x = Math.floor(c.x - 12); x <= c.x + 12 && !row; x++) {
  const sl2 = G.rowSlots('tent', x, y, x + 3 * s, y);
  if (sl2.every(([a, b]) => G.checkPlace(S, 'tent', a, b).ok)) row = sl2;
}
ok(!!row, `找到能放 4 栋的一排：${JSON.stringify(row)}`);
const n0 = G.countType(S, c.id, 'tent');
const c1 = G.buildCost(S, 'tent', c.id, row[0][1]), c2 = G.buildCost(S, 'tent', c.id, row[0][1], 1);
ok(Object.keys(c1).every(k => c2[k] >= c1[k]) && Object.keys(c1).some(k => c2[k] > c1[k]), '第二栋比第一栋贵');
for (const k in c.stock) c.stock[k] = 0;
for (const k in c1) c.stock[k] = c1[k] + c2[k]; // 只够两栋
let pl = G.rowPlan(S, 'tent', row);
ok(pl.ok === 2 && pl.q === 2 && pl.bad === 0 && pl.plan.map(e => e.st).join() === 'ok,ok,q,q', `预演：${pl.plan.map(e => e.st).join()}`);
const tot = Object.keys(pl.total).every(k => pl.total[k] >= (c1[k] + c2[k]));
ok(tot, `合计花费 ${JSON.stringify(pl.total)}`);
const qBefore = (S.queue || []).length;
r = G.placeRow(S, 'tent', row);
ok(r.built === 2 && r.queued === 2 && r.failed === 0, `摆下去：建 ${r.built}、排队 ${r.queued}`);
ok(G.countType(S, c.id, 'tent') === n0 + 2 && S.queue.length === qBefore + 2, '两栋建好，两栋是蓝图');
// 同一排再预演：全是已占的格子，都不能建
pl = G.rowPlan(S, 'tent', row);
ok(pl.bad === 4, `重复摆同一排：${pl.bad} 处不能建`);
// 队列上限
S.queue = []; for (const k in c.stock) c.stock[k] = 0;
const far = [];
for (let y = Math.floor(c.y - 14); y <= c.y + 14 && far.length < 12; y++) for (let x = Math.floor(c.x - 14); x <= c.x + 14 && far.length < 12; x += s) if (G.checkPlace(S, 'tent', x, y).soft && !far.some(([a, b]) => Math.abs(a - x) < s && Math.abs(b - y) < s)) far.push([x, y]);
pl = G.rowPlan(S, 'tent', far.slice(0, 10));
ok(pl.q === G.QUEUE_MAX && pl.bad === 10 - G.QUEUE_MAX, `没材料：排队 ${pl.q}，超出队列上限的 ${pl.bad} 处标红`);
console.log(fails ? `${fails} FAIL` : 'all ok');
