// 老向导：建筑说缺哪样就先看哪样；总产量够、却被别的建筑吃掉时，点出是谁吃掉的
import * as G from '../src/sim.js';
import fs from 'fs';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.deserialize(fs.readFileSync(new URL('./fixtures/stage4.json', import.meta.url), 'utf8'));
for (let i = 0; i < 400; i++) G.step(S, 1);
const P = G.planLine(S, 'alloy', 16), w = P.worst;
ok(w && w.k === 'iron' && w.comp && w.from === 'battery', `alloy line stuck on iron for batteries (${w && w.k} from ${w && w.from}, comp ${w && w.comp})`);
const a = G.advisor(S);
ok(a && /电池工坊/.test(a.text) && /炼钢厂/.test(a.text), 'advisor names the starved and the hungry building: ' + (a && a.text));
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
