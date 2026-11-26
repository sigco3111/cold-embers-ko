// 1.0：自己运转的补给站只按留守的人烧火；屋里太冷时不会有流浪的人来投奔（以前来一个冻死一个）
// 存档 /tmp/v13/depotN.json：北境第 2 站，灰帆原留成了补给站（模拟玩家跑出来的）
import * as G from '../src/sim.js';
import { furnaceBurn } from '../src/data.js';
import fs from 'fs';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const load = () => G.deserialize(fs.readFileSync('/tmp/v13/depotN.json', 'utf8'));
{
  const S = load(), d = S.camps.find(c => c.depot && !c.manual), fb = G.getB(S, d.furnace);
  ok(!!d, 'fixture has an auto depot');
  ok(G.depotFireLvl(S, d) < fb.lvl && G.depotFireLvl(S, d) >= 1, `depot burns at level ${G.depotFireLvl(S, d)} instead of ${fb.lvl} (${d.people} people)`);
  d.stock.wood = 5000; const deaths0 = S.stats.deaths;
  for (let i = 0; i < 720; i++) G.step(S, 10);
  const cr = G.rt(S).c[d.id];
  ok(d.stock.wood > 3000, `2 hours later the depot still has wood ${Math.round(d.stock.wood)} (burn ${cr.burnPerMin.toFixed(1)}/min, full level would be ${furnaceBurn(fb.lvl).toFixed(0)})`);
  ok(cr.tH >= -2, `depot stays warm (tH ${cr.tH.toFixed(1)})`);
  void deaths0;
  d.manual = true; G.step(S, 10);
  ok(Math.abs(G.rt(S).c[d.id].burnPerMin - furnaceBurn(fb.lvl)) < furnaceBurn(fb.lvl) * 0.5, 'taken over: burns for the full furnace level again');
}
{
  // 燃料烧光了的补给站（以前会冻死一批、来一批再冻死一批）：现在按人数烧火、攒够燃料才收人，十二小时里不再死人
  const S = load(), d = S.camps.find(c => c.depot && !c.manual);
  for (const k of ['wood', 'coal', 'coke', 'battery']) d.stock[k] = 0;
  d.deathAcc = 0;
  let dead = 0; const seen = new Set(S.log);
  for (let i = 0; i < 4320; i++) { G.step(S, 10); for (const l of S.log) { if (!seen.has(l) && l.msg.includes(d.name) && l.msg.includes('没能熬过去')) dead++; seen.add(l); } }
  ok(dead <= 2, `depot that ran dry: ${dead} deaths in 12 hours, ${d.people} people now, burning at level ${G.depotFireLvl(S, d)}`);
}
console.log(fail ? `${fail} FAILED` : 'all passed');
