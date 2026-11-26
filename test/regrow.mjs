// 木材不会卡死：树林会长回来（伐木场附近更快），加工厂给建造留料；离线收益按低倍率；人满不溢出
import * as G from '../src/sim.js';
import { BLD, SPOT_KEYS } from '../src/data.js';
import { getWorld } from '../src/worldgen.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
function placeNear(S, c, type) {
  let best = null, bs = -1;
  for (let y = Math.floor(c.y - 8); y <= c.y + 8; y++) for (let x = Math.floor(c.x - 8); x <= c.x + 8; x++) {
    const ck = G.checkPlace(S, type, x, y);
    if (!ck.ok && !ck.soft) continue;
    const sc = BLD[type].gather ? (ck.spots || 0) : 1;
    if (BLD[type].gather && !sc) continue;
    if (sc > bs) { bs = sc; best = [x, y]; }
  }
  if (!best) return null;
  for (const k of ['wood', 'stone', 'plank']) c.stock[k] = 999;
  const r = G.place(S, type, best[0], best[1]);
  return r.ok ? G.getB(S, r.id) : null;
}

// 1) 树苗与补种
{
  const S = G.newRun(G.defaultMeta(), 0, 777);
  const w = getWorld(S.runSeed), R = G.rt(S);
  const lum = placeNear(S, S.camps[0], 'lumber');
  lum.workers = BLD.lumber.w; S.camps[0].stock.wood = 0;
  G.step(S, 1);
  const sp = R.gatherSpots.get(lum.id);
  ok(sp && sp.length > 0, `伐木场范围里有 ${sp.length} 处树林`);
  for (const s of sp) S.spots[s.i] = 0.5;
  run(S, 120);
  const sap = sp.filter(s => G.isSapling(S, s.i)).length;
  ok(sap === sp.length, `砍光后都变成树苗 ${sap}/${sp.length}`);
  const br = R.b[lum.id];
  ok(br.status === '等树苗长大', `伐木场状态「${br.status}」`);
  const tended = G.tendedSpots(S), i0 = sp[0].i;
  ok(G.regrowRate(S, i0, tended) === 4, `有人的伐木场旁边每分钟长 ${G.regrowRate(S, i0, tended)}`);
  const far = Object.keys(S.spots).length; void far;
  // 长到三成后能再砍
  const need = G.spotMax(S, i0) * G.SAP_RIPE / 4;
  let grown = -1;
  for (let m = 0; m < need + 5 && grown < 0; m++) { run(S, 60, 10); if (!G.isSapling(S, i0)) grown = m + 1; }
  ok(grown > 0 && grown <= need + 3, `第 ${grown} 分钟树苗长成（算的是 ${Math.ceil(need)} 分钟），可以再砍`);
  run(S, 120);
  ok((R.b[lum.id].rate || {}).wood > 0, `伐木场重新出木材 ${(R.b[lum.id].rate || {}).wood?.toFixed(2)}/分`);
}
// 2) 加工留料：锯木厂不会把木材吃光
{
  const S = G.newRun(G.defaultMeta(), 0, 777);
  const c = S.camps[0], R = G.rt(S);
  const saw = placeNear(S, c, 'sawmill');
  ok(!!saw, '放下锯木厂');
  c.auto = false; for (const b of S.buildings) if (b.type === 'lumber') b.workers = 0;
  saw.workers = BLD.sawmill.w; c.stock.wood = 300; c.stock.plank = 0;
  run(S, 1800);
  const cap = G.storeCap(S, c);
  ok(c.stock.wood >= cap * G.KEEP_FRAC - 1, `30 分钟后木材 ${c.stock.wood.toFixed(0)}，留够两成 ${(cap * G.KEEP_FRAC).toFixed(0)}`);
  ok(R.b[saw.id].status === G.KEEP_WHY || c.stock.wood > cap * G.KEEP_FRAC + 5, `锯木厂状态「${R.b[saw.id].status}」`);
  c.keep = false; run(S, 1800);
  ok(c.stock.wood < cap * G.KEEP_FRAC * 0.5, `关掉留料后木材会用到 ${c.stock.wood.toFixed(0)}`);
}
// 3) 离线收益按低倍率
{
  const A = G.newRun(G.defaultMeta(), 0, 777), B = G.newRun(G.defaultMeta(), 0, 777);
  run(A, 600); run(B, 600);
  const w0 = A.camps[0].stock.wood;
  run(A, 1800, 10);
  const sum = G.catchUp(B, 1800);
  const gA = A.camps[0].stock.wood - w0, gB = B.camps[0].stock.wood - w0;
  ok(sum.rate === G.OFFLINE_RATE, `离线倍率 ${sum.rate}`);
  ok(gA > 0 && Math.abs(gB - gA * G.OFFLINE_RATE) < Math.max(3, gA * 0.05), `在线 30 分钟木材 +${gA.toFixed(0)}，离线 +${gB.toFixed(0)}`);
  ok(B.camps[0].people === A.camps[0].people, `人口照常 ${B.camps[0].people}`);
}
// 4) 人满不溢出：奖励的人先等床位，盖了帐篷再住进来
{
  const S = G.newRun(G.defaultMeta(), 0, 777);
  const c = S.camps[0];
  run(S, 60);
  placeNear(S, c, 'tent');
  const beds = G.bedsOf(S, c);
  c.people = beds;
  const r = G.addPeople(S, c, 7);
  ok(r.inn === 0 && c.wait === 7 && c.people === beds, `床位满时 7 人去等床位（人口 ${c.people}/${beds}）`);
  run(S, 30);
  ok(c.people <= beds, `过一会儿也没有溢出 ${c.people}/${beds}`);
  const tent = placeNear(S, c, 'tent');
  ok(!!tent, '盖一顶帐篷');
  run(S, 4);
  ok(c.wait < 7 && c.people <= G.bedsOf(S, c), `住进来 ${7 - c.wait} 人，人口 ${c.people}/${G.bedsOf(S, c)}，还在等 ${c.wait}`);
  // 侦察队出门时，床位给他们留着
  c.wait = 0; c.people = G.bedsOf(S, c) - 1;
  const away = 3; S.scouts.push({ id: S.nextId++, camp: c.id, kind: 'scout', x: c.x, y: c.y, tx: c.x, ty: c.y + 3, phase: 'out', n: away, carry: { people: 0, loot: {}, spec: null } });
  c.people -= away;
  ok(G.freeBeds(S, c) === 1, `3 人出门侦察，空床只算 ${G.freeBeds(S, c)} 张`);
  // 旧存档：超出床位的人挪去等
  const T = G.newRun(G.defaultMeta(), 0, 778), tc = T.camps[0];
  placeNear(T, tc, 'tent'); placeNear(T, tc, 'tent');
  run(T, 4);
  tc.people = G.bedsOf(T, tc) + 9; delete tc.popFix;
  run(T, 2);
  ok(tc.people === G.bedsOf(T, tc) && tc.wait === 9, `旧存档 9 人溢出 → 等床位 ${tc.wait}，人口 ${tc.people}/${G.bedsOf(T, tc)}`);
}
// 5) 育林场：不靠树林也出木材
{
  const S = G.newRun(G.defaultMeta(), 0, 777), c = S.camps[0], R = G.rt(S);
  const n = placeNear(S, c, 'nursery');
  ok(!!n, '放下育林场');
  n.workers = BLD.nursery.w; c.stock.wood = 0;
  run(S, 120);
  ok((R.b[n.id].rate || {}).wood > 3, `育林场出木材 ${((R.b[n.id].rate || {}).wood || 0).toFixed(2)}/分，状态「${R.b[n.id].status}」`);
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
