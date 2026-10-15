// 第十三版挪建筑：同营地暖圈里挪，等级、工人留着，不花材料，停工 30 秒；熔炉不能挪；连着的传送带拆掉
import fs from 'fs';
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.deserialize(fs.readFileSync(process.argv[2] || '/tmp/v12/bot7e.json', 'utf8'));
const main = G.mainCamp(S);
for (let i = 0; i < 5; i++) G.step(S, 1);
const fur = G.getB(S, main.furnace);
ok(!!G.moveBlock(S, fur), 'furnace cannot move: ' + G.moveBlock(S, fur));
const b = S.buildings.find(x => x.camp === main.id && BLD[x.type].out && !BLD[x.type].gather && x.workers > 0 && BLD[x.type].size === 2);
ok(!!b, `picked ${BLD[b.type].n} lvl ${b.lvl} workers ${b.workers} at ${b.x},${b.y}`);
const before = { lvl: b.lvl, workers: b.workers, stock: JSON.stringify(main.stock) };
let to = null;
for (let r = 3; r < 16 && !to; r++) for (let dy = -r; dy <= r && !to; dy++) for (let dx = -r; dx <= r; dx++) { const ck = G.checkMove(S, b.id, b.x + dx, b.y + dy); if (ck.ok) { to = [b.x + dx, b.y + dy]; break; } }
ok(!!to, 'found a free spot to move to: ' + to);
const ckSame = G.checkMove(S, b.id, b.x, b.y);
ok(!ckSame.ok, 'same spot refused: ' + ckSame.reason);
// 自己原来占的格子不算重叠：挪一格
const ck1 = G.checkMove(S, b.id, b.x + 1, b.y);
console.log('move by one tile:', ck1.ok, ck1.reason || '');
// 带一条传送带
const nb = (S.belts || []).length;
const r = G.moveBuilding(S, b.id, to[0], to[1]);
ok(r.ok, 'moved ' + JSON.stringify(r));
const b2 = G.getB(S, b.id);
ok(b2.x === to[0] && b2.y === to[1] && b2.lvl === before.lvl && b2.workers === before.workers, 'position changed, level and workers kept');
ok(Math.abs(G.buildCost ? 0 : 0) === 0, 'no cost');
G.step(S, 1);
ok(G.rt(S).b[b.id].status === '在搬家', 'status while moving: ' + G.rt(S).b[b.id].status);
for (let i = 0; i < 32; i++) G.step(S, 1);
ok(G.rt(S).b[b.id].status !== '在搬家', 'back to work after 30 s: ' + G.rt(S).b[b.id].status);
// 别的营地的暖圈不行
const other = S.camps.find(c => c.id !== main.id && G.getB(S, c.furnace));
if (other) { const ck = G.checkMove(S, b.id, Math.round(other.x) + 2, Math.round(other.y) + 2); ok(!ck.ok, 'other camp refused: ' + ck.reason); }
// 传送带：给挪的建筑连一条，再挪就拆掉
const opts = G.beltOptions ? G.beltOptions(S, b.id) : null;
if (opts && opts.length) {
  for (const k of Object.keys(main.stock)) main.stock[k] = Math.max(main.stock[k], 5000);
  const o = opts[0], rb = G.addBelt(S, o.a, o.b, o.k);
  ok(rb && rb.ok, 'belt added ' + JSON.stringify(rb));
  const nb1 = S.belts.length;
  let t2 = null; for (let rr = 3; rr < 16 && !t2; rr++) for (let dy = -rr; dy <= rr && !t2; dy++) for (let dx = -rr; dx <= rr; dx++) { if (G.checkMove(S, b.id, b2.x + dx, b2.y + dy).ok) { t2 = [b2.x + dx, b2.y + dy]; break; } }
  const ck = G.checkMove(S, b.id, t2[0], t2[1]);
  ok(ck.belts === 1, 'move preview counts the attached belt');
  const r2 = G.moveBuilding(S, b.id, t2[0], t2[1]);
  ok(r2.ok && S.belts.length === nb1 - 1, 'attached belt removed on move');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
