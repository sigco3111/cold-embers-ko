// 第十三版规划手感：摆放预演、推荐位置、规划表还差几座
import fs from 'fs';
import * as G from '../src/sim.js';
import { BLD } from '../src/data.js';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.deserialize(fs.readFileSync(process.argv[2] || '/tmp/v12/bot7e.json', 'utf8'));
for (let i = 0; i < 10; i++) G.step(S, 1);
const main = G.mainCamp(S);
for (const type of ['sawmill', 'steelworks', 'crystalmine', 'tent']) {
  const t0 = Date.now(), sg = G.suggestSpots(S, type, main.id), ms = Date.now() - t0;
  ok(Array.isArray(sg), `${BLD[type].n}: ${sg.length} suggestions in ${ms} ms ${JSON.stringify(sg.map(p => [p.x, p.y, Math.round(p.sc * 10) / 10]))}`);
  for (const p of sg) { const ck = G.checkPlace(S, type, p.x, p.y); ok(ck.ok || ck.soft, `  suggestion ${p.x},${p.y} placeable`); ok(!G.blocksOre(S, type, p.x, p.y, main.id).length, '  does not block ore'); }
  if (sg[0]) {
    const ck = G.checkPlace(S, type, sg[0].x, sg[0].y), pv = G.placePreview(S, type, sg[0].x, sg[0].y, ck);
    console.log('   preview', JSON.stringify(pv && { ...pv, ins: pv.ins.map(x => `${x.k} need ${x.need.toFixed(1)} spare ${x.spare.toFixed(1)}`) }));
    if (BLD[type].out) ok(pv && pv.after >= pv.before, '  preview after >= before');
  }
}
// 缓存：第二次很快
G.suggestSpots(S, 'tent', main.id); const t1 = Date.now(); G.suggestSpots(S, 'tent', main.id); ok(Date.now() - t1 < 5, 'second call is cached');
console.log(fail ? `${fail} FAILED` : 'all ok');
