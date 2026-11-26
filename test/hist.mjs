// 数据曲线：细历史 30 秒一笔、只留 4 天；粗历史整局都在、满了两两合并；离线那段物资按离线比例记
import * as G from '../src/sim.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 4321);
const c = S.camps[0];
run(S, 300);
const F = c.hist.f, C = c.hist.c;
ok(F.n === 10 && F.v.pop.length === 10 && F.dt === 30, `5 分钟：细历史 ${F.n} 笔`);
ok(C.n === 2 && C.dt === 120, `粗历史 ${C.n} 笔`);
ok(F.v.pop.every(x => x === c.people || x > 0) && F.v.hope.every(x => x > 0), `人口 ${F.v.pop.slice(-3)} 希望 ${F.v.hope.slice(-3)}`);
ok(F.v['s:wood'] && F.v['s:wood'].length === F.n, `木材储量 ${F.v['s:wood'].slice(-3)}`);
ok(Object.keys(F.v).some(k => k.startsWith('p:')), `有产量曲线：${Object.keys(F.v).filter(k => k.startsWith('p:')).join(',')}`);
// 后出现的物资：前面补 null，长度对齐
c.stock.iron = 50; run(S, 60);
ok(F.v['s:iron'] && F.v['s:iron'].length === F.n && F.v['s:iron'][0] === null && F.v['s:iron'][F.n - 1] > 0, `新物资补齐：${F.v['s:iron'].slice(-4)}`);
// 细历史满 96 笔后往前滚
run(S, 96 * 30);
ok(F.n === 96 && F.v.pop.length === 96 && Math.abs(F.t0 + F.n * F.dt - S.t) <= F.dt, `细历史滚动：${F.n} 笔，最早 ${F.t0}s，现在 ${S.t}s`);
// 粗历史满了合并
const n0 = C.n, dt0 = C.dt, st0 = S.t;
run(S, (G.HIST.c.max - C.n) * C.dt + 10, 10);
ok(C.dt === dt0 * 2 && C.n < G.HIST.c.max && C.v.pop.length === C.n, `粗历史合并：${n0} 笔/${dt0}s → ${C.n} 笔/${C.dt}s（${st0}→${S.t}s）`);
ok(Object.values(C.v).every(A => A.length === C.n), '每条曲线长度一致');
const sr = G.histSeries(C, 'pop');
ok(sr.length === C.n && sr[0].t === C.t0 + C.dt / 2, '取点：时间是每段中点');
// 大步长（离线追赶）也不会漏笔
const nF = F.n, tF = F.t0;
G.step(S, 120);
ok(F.t0 + F.n * F.dt <= S.t && S.t - (F.t0 + F.n * F.dt) < F.dt, `一步 120 秒：细历史跟上（${nF}→${F.n} 笔，t0 ${tF}→${F.t0}）`);
// 离线：物资涨幅按比例记，标出离线段
for (const k in c.stock) c.stock[k] = 0;
c.stock.wood = 100;
for (const b of S.buildings) if (b.type === 'lumber') b.workers = G.maxWorkers('lumber', b.lvl);
const w0 = c.stock.wood;
G.catchUp(S, 1800, 0.25);
const lastW = F.v['s:wood'][F.n - 1];
ok(c.hist.off && c.hist.off.length === 1 && c.hist.off[0][1] - c.hist.off[0][0] >= 1790, `离线段 ${JSON.stringify(c.hist.off)}`);
ok(Math.abs(lastW - c.stock.wood) < Math.max(30, c.stock.wood * 0.25), `离线后最后一笔木材 ${lastW} ≈ 实际 ${Math.round(c.stock.wood)}（开始 ${w0}）`);
// 存档来回
const S2 = G.deserialize(G.serialize(S));
ok(S2.camps[0].hist.f.n === F.n && S2.camps[0].hist.c.v.pop.length === C.n, '存档后历史还在');
const size = JSON.stringify(c.hist).length;
ok(size < 40000, `一个营地的历史 ${(size / 1024).toFixed(1)} KB`);
console.log(fails ? `${fails} FAIL` : 'all ok');
