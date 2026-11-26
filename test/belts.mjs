// 传送带：伐木场 → 锯木厂连上以后少用搬运工、锯木厂快一点；不能穿过建筑；升级蒸汽轨道；拆除；拆建筑带走传送带；存档读档
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const meta = G.defaultMeta(); meta.sites.push(1);
const S = G.newRun(meta, 1, 4242);
const c = S.camps[0], R = G.rt(S);
c.auto = false;
run(S, 4);
const fill = () => { for (const k of ['wood', 'stone', 'plank', 'iron', 'steel', 'engine', 'food']) c.stock[k] = 900; };
fill();
const near = (type, x0, y0, rmin = 0) => { let best = null, bd = 1e9; for (let y = Math.floor(y0 - 10); y <= y0 + 10; y++) for (let x = Math.floor(x0 - 10); x <= x0 + 10; x++) { const ck = G.checkPlace(S, type, x, y); const d = Math.hypot(x - x0, y - y0); if (ck.ok && d >= rmin && d < bd) { bd = d; best = [x, y]; } } return best; };
let lum = S.buildings.find(b => b.type === 'lumber');
if (!lum) { const p = near('lumber', c.x + 4, c.y); lum = G.getB(S, G.place(S, 'lumber', p[0], p[1]).id); }
fill();
// 找一个离伐木场 2~5 格、中间没东西挡着的位置放锯木厂
let saw = null;
S.known = 3;
const cands = [];
for (let y = lum.y - 7; y <= lum.y + 7; y++) for (let x = lum.x - 7; x <= lum.x + 7; x++) { const d = Math.hypot(x - lum.x, y - lum.y); if (d >= 4 && G.checkPlace(S, 'sawmill', x, y).ok) cands.push([d, x, y]); }
cands.sort((a, b) => a[0] - b[0]);
for (const [, x, y] of cands) { fill(); const id = G.place(S, 'sawmill', x, y).id; const ck = G.beltCheck(S, lum.id, id, 'wood'); if (ck.ok && ck.len >= 1) { saw = G.getB(S, id); break; } G.demolish(S, id); }
ok(!!saw, `锯木厂放在离伐木场 ${saw && G.beltEnds(lum, saw).len.toFixed(1)} 格`);
lum.workers = BLD.lumber.w; saw.workers = BLD.sawmill.w;
c.keep = false;
run(S, 30);
const h0 = R.b[saw.id].haul + R.b[lum.id].haul, r0 = R.b[saw.id].rate.plank || 0;
S.known = 1;
ok(!G.beltCheck(S, lum.id, saw.id, 'wood').ok && /煤与铁/.test(G.beltCheck(S, lum.id, saw.id, 'wood').reason), `没解锁：「${G.beltCheck(S, lum.id, saw.id, 'wood').reason}」`);
S.known = 3;
const opts = G.beltOptions(S, lum.id);
ok(opts.some(o => o.b === saw.id && o.k === "wood" && o.ck.ok), `伐木场的可连列表里有锯木厂（${opts.map(o => BLD[o.other.type].n + ":" + o.ck.reason + ":" + o.len.toFixed(1)).join(" / ")}）`);
ok(!G.beltCheck(S, saw.id, lum.id, 'wood').ok, '方向反了不行');
fill();
const r = G.addBelt(S, lum.id, saw.id, 'wood');
ok(r.ok && S.belts.length === 1, '接上传送带');
ok(!G.addBelt(S, lum.id, saw.id, 'wood').ok, '不能重复接');
run(S, 30);
const h1 = R.b[saw.id].haul + R.b[lum.id].haul, r1 = R.b[saw.id].rate.plank || 0;
ok(h1 < h0 * 0.85, `搬运需求下降 ${h0.toFixed(3)} → ${h1.toFixed(3)}`);
ok(r1 > r0 * 1.04 || R.b[saw.id].beltB > 0.05, `锯木厂加成 ${(R.b[saw.id].beltB * 100).toFixed(0)}%（产量 ${r0.toFixed(2)} → ${r1.toFixed(2)}）`);
// 传送带经过的地不能盖房子
const tiles = [...R.beltOcc.keys()];
if (tiles.length) { const i = tiles[0], x = i % 48, y = Math.floor(i / 48); let blocked = false; for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) { const ck = G.checkPlace(S, 'tent', x + dx, y + dy); if (!ck.ok && /传送带|重叠/.test(ck.reason)) blocked = true; } ok(blocked, `传送带上不能盖帐篷（${tiles.length} 格）`); }
else ok(true, '两栋紧挨着，传送带不占地');
// 升级
fill();
const e = S.belts[0];
ok(!G.beltUpBlock(S, e), '可以升级成蒸汽轨道');
ok(G.upBelt(S, e.id).ok && e.lvl === 2, '升级成蒸汽轨道');
run(S, 30);
const h2 = R.b[saw.id].haul + R.b[lum.id].haul;
ok(h2 < h1, `蒸汽轨道更省人 ${h1.toFixed(3)} → ${h2.toFixed(3)}`);
// 存档读档
const S2 = G.deserialize(G.serialize(S));
ok(S2.belts && S2.belts.length === 1 && S2.belts[0].lvl === 2, '读档后传送带还在');
// 拆除传送带
ok(G.removeBelt(S, e.id).ok && !S.belts.length, '拆掉传送带');
fill();
G.addBelt(S, lum.id, saw.id, 'wood');
ok(S.belts.length === 1, '重新接上');
G.demolish(S, saw.id);
run(S, 2);
ok(!S.belts.length, '拆掉锯木厂，传送带一起没了');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
