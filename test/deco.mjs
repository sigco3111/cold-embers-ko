// 装饰建筑：能盖、加希望（有上限、越多越少）、花窖要人照看、升级更多、不出奇怪的状态
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 2) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const S = G.newRun(G.defaultMeta(), 0, 777);
const c = S.camps[0];
run(S, 6);
for (const k of ['wood', 'plank', 'stone', 'iron', 'steel']) c.stock[k] = 99999;
S.known = 3;
const hopeOf = () => G.moodFactors(S, c, G.rt(S).c[c.id]).hope.find(f => f[0] === '装饰');
ok(!hopeOf(), '没装饰时没有「装饰」这一项');
const spot = (type) => { for (let r = 2; r < 14; r++) for (let y = Math.floor(c.y - r); y <= c.y + r; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) if (G.checkPlace(S, type, x, y).ok) return [x, y]; return null; };
const put = type => { const at = spot(type); if (!at) return null; const r = G.place(S, type, at[0], at[1]); return r && r.id ? G.getB(S, r.id) : null; };
const lamp = put('lamp');
ok(!!lamp, '路灯盖得下');
run(S, 2);
ok(hopeOf() && Math.abs(hopeOf()[1] - G.decoHope(S, c).v) < 0.06 && hopeOf()[1] > 0.9, `一盏路灯 +${hopeOf() && hopeOf()[1].toFixed(2)} 希望`);
const st = G.rt(S).b[lamp.id] && G.rt(S).b[lamp.id].status;
ok(!st || !/没有派人|缺|人手/.test(st), `路灯状态正常（${st || '无'}）`);
const fp = put('flagpole'), sta = put('statue');
ok(fp && sta, '旗杆、雕像盖得下');
const fh = put('flowerhouse');
ok(!!fh, '花窖盖得下');
c.auto = false; fh.workers = 0; run(S, 2);
const raw0 = G.decoHope(S, c).raw;
fh.workers = G.maxWorkers('flowerhouse', fh.lvl); run(S, 2);
const raw1 = G.decoHope(S, c).raw;
ok(Math.abs(raw1 - raw0 - 4.5) < 1e-6, `花窖要人照看：没人 ${raw0} → 有人 ${raw1}`);
const v1 = G.decoHope(S, c).v;
lamp.lvl = 5; run(S, 2);
ok(Math.abs(G.decoOne(lamp) - 2) < 1e-9 && G.decoHope(S, c).v > v1, `5 级路灯 +${G.decoOne(lamp)}`);
// 上限：放一堆路灯
let nLamp = 0; for (let i = 0; i < 40; i++) { c.stock.wood = c.stock.stone = 99999; if (put('lamp')) nLamp++; }
run(S, 2);
const dh = G.decoHope(S, c);
ok(dh.v <= G.DECO_CAP && dh.v > 12, `一大堆装饰：原始 ${dh.raw.toFixed(1)} → 实际 +${dh.v.toFixed(2)}（上限 ${G.DECO_CAP}）`);
ok(G.upgradeCost(S, lamp) && Object.keys(G.upgradeCost(S, lamp)).length > 0, '能升级');
// 存读档后不变
const S2 = G.deserialize(G.serialize(S));
ok(Math.abs(G.decoHope(S2, S2.camps[0]).v - dh.v) < 1e-9, '存读档后一样');
ok(G.bookOf(S).b.lamp, '进了收集册');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
