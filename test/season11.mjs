// 1.1 熟练工 + 寒潮季
import * as G from '../src/sim.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const run = (S, s, dt = 1) => { for (let i = 0; i < s; i += dt) G.step(S, dt); };
const put = (S, camp, type) => {
  for (let y = Math.floor(camp.y) - 10; y <= camp.y + 10; y++) for (let x = Math.floor(camp.x) - 10; x <= camp.x + 10; x++) {
    const c = G.checkPlace(S, type, x, y); if (c.ok) { const r = G.place(S, type, x, y); if (r.ok) return G.getB(S, r.id); }
  }
  return null;
};
const S = G.newRun(G.defaultMeta(), 0, 99);
S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S);
const main = G.mainCamp(S); main.people = 40; main.auto = false;
const fill = () => { for (const k of ['wood', 'stone', 'food']) main.stock[k] = 400; main.stock.plank = 100; };
fill();
for (const b of S.buildings) if (b.camp === main.id && b.type !== 'furnace') b.workers = 0;
const saw = put(S, main, 'sawmill'), saw2 = put(S, main, 'sawmill');
G.setWorkers(S, saw.id, 2); G.setWorkers(S, saw2.id, 1);
ok(G.skillLvl(saw) === 0, 'new building: no skill');
for (let i = 0; i < 600; i++) { fill(); G.step(S, 1); }
ok(G.skillLvl(saw) === 1 && G.skillLvl(saw2) === 0, `10 min full staff → 熟练 1; half staff is half speed (${saw.xp.toFixed(2)} / ${saw2.xp.toFixed(2)})`);
ok(Math.abs(saw2.xp - 5) < 0.2, 'half staff: 5 minutes of xp');
ok(G.prodBonus(S, saw, main).parts.some(p => p[0] === '熟练' && Math.abs(p[1] - 0.06) < 1e-9), 'prodBonus shows 熟练 +6%');
// 撤人一分钟内补回来不掉
G.setWorkers(S, saw.id, 1); run(S, 30); G.setWorkers(S, saw.id, 2); run(S, 40);
ok(G.skillLvl(saw) === 1 && saw.xp > 10.5, `short move (<1 min) keeps the skill (${saw.xp.toFixed(2)})`);
// 撤一半人超过一分钟：掉一半
const x0 = saw.xp; G.setWorkers(S, saw.id, 1); run(S, 61);
ok(Math.abs(saw.xp - x0 / 2) < 1.2, `half the staff gone for over a minute → half the skill (${x0.toFixed(1)} → ${saw.xp.toFixed(1)})`);
// 学徒制：快一半、只掉一半的一半
S.tech = S.tech || { done: {}, cur: null, prog: 0 }; S.tech.done.apprentice = true;
G.setWorkers(S, saw.id, 2); const x1 = saw.xp; for (let i = 0; i < 120; i++) { fill(); G.step(S, 1); }
ok(Math.abs(saw.xp - x1 - 3) < 0.2, `学徒制: 1.5× speed (${(saw.xp - x1).toFixed(2)} min in 2 min)`);
const x2 = saw.xp; G.setWorkers(S, saw.id, 1); run(S, 61);
ok(Math.abs(saw.xp - x2 * 0.75) < 0.6, `学徒制: half loss (${x2.toFixed(1)} → ${saw.xp.toFixed(1)})`);
delete S.tech.done.apprentice; G.setWorkers(S, saw.id, 2);
// 升级、挪位置都保留
const x3 = saw.xp; saw.lvl = 2; G.dirty(S); run(S, 70);
ok(saw.xp >= x3, 'upgrade keeps the skill (more slots is not a drop)');
// 离线按离线收益的比例长
const x4 = saw.xp; main.stock.wood = 4000; const off = G.catchUp(S, 600, 0.25);
ok(Math.abs(saw.xp - x4 - 2.5) < 0.6, `offline grows at the offline rate (${(saw.xp - x4).toFixed(2)} in 10 min at 25%)`);
// 研究：工程站也有熟练
const ws = put(S, main, 'workshop'); ok(G.skillable(ws), 'workshop has skill');
// 老存档：在岗的从 1 级起
const o = JSON.parse(G.serialize(S)); delete o.sk; for (const b of o.buildings) { delete b.xp; delete b.wRef; }
const S2 = G.deserialize(JSON.stringify(o));
ok(S2.buildings.filter(b => G.skillable(b) && b.workers > 0).every(b => G.skillLvl(b) === 1) && S2.buildings.some(b => G.skillLvl(b) === 1), 'old save: staffed buildings start at 熟练 1');
ok(S2.buildings.filter(b => G.skillable(b) && !b.workers).every(b => !b.xp), 'old save: empty buildings start at 0');

// ---- 寒潮季 ----
ok(!S.cold, 'chapter 1: no cold snaps');
const J = G.journeyOf(S); J.stage = 2; S.stats.left = 0;
run(S, 1);
ok(S.cold && S.cold.t0 != null, 'chapter 3: cold snaps start');
const t0 = S.cold.t0, c0 = G.coldAt(S);
ok(!c0.on && !c0.fc && Math.abs(c0.inSec - 2 * 720) < 2, `first snap 2 days later, forecast 1 day ahead (${c0.inSec})`);
for (const b of S.buildings) if (b.camp === main.id && b.type !== 'furnace') b.workers = 0;
const lum = put(S, main, 'lumber') || S.buildings.find(b => b.type === 'lumber' && b.camp === main.id); G.setWorkers(S, lum.id, 2);
main.stock.wood = 3000; main.stock.food = 3000;
run(S, 720 - (S.t - t0) + 2, 2);
const cf = G.coldAt(S);
ok(cf.fc && !cf.on && S.log.some(l => /寒潮预报/.test(l.msg)), `forecast logged (${Math.round(cf.inSec)} s ahead)`);
ok(G.fuelKeepMin(S) === 34, `logistics tops camps to a day of fuel during the forecast (${G.fuelKeepMin(S)} min)`);
main.stock.wood = 200; G.step(S, 1);
const R = G.rt(S), burn0 = R.c[main.id].burnPerMin, temp0 = main.temp, rate0 = (R.b[lum.id].rate || {}).wood || 0;
const hope0 = main.hope, emb0 = S.meta.embers;
run(S, cf.inSec + 4, 2); main.stock.wood = 200; G.step(S, 1);
ok(G.coldAt(S).on && S.log.some(l => /寒潮来了/.test(l.msg)), 'cold snap starts');
const burn1 = R.c[main.id].burnPerMin, rate1 = (R.b[lum.id].rate || {}).wood || 0;
ok(Math.abs(burn1 / burn0 - 2) < 0.05, `furnace burns 2× (${burn0.toFixed(2)} → ${burn1.toFixed(2)})`);
ok(Math.abs(rate1 / rate0 - 0.5) < 0.05, `outdoor gathering halved (${rate0.toFixed(2)} → ${rate1.toFixed(2)})`);
ok(Math.abs((temp0 - main.temp) - 10) < 1.5, `temperature −10° (${temp0.toFixed(1)} → ${main.temp.toFixed(1)})`);
G.getB(S, main.furnace).lvl = 20; G.dirty(S); // 烧旺一点，别冻着
run(S, 740, 2);
ok(!G.coldAt(S).on && S.log.some(l => /寒潮过去了/.test(l.msg)), 'cold snap ends');
const hit = (S.cold.hit || {})[main.id];
console.log(S.log.filter(l => /寒潮|余烬/.test(l.msg)).slice(-4).map(l => l.msg).join('\n'));
console.log('hit', !!hit, 'hope', hope0.toFixed(1), '→', main.hope.toFixed(1), 'embers', emb0, '→', S.meta.embers);
ok(hit ? S.log.some(l => /有人冻伤了/.test(l.msg)) : S.log.some(l => /一个人都没冻伤/.test(l.msg)), 'end message matches frostbite state');
// 再来一次：故意冻着
const cn = G.coldAt(S); S.t = cn.start - 1; main.stock.wood = 0; main.stock.coal = 0; for (const k in main.stock) if (G.FUEL_KEYS && G.FUEL_KEYS.includes(k)) main.stock[k] = 0;
G.getB(S, main.furnace).lvl = 1; G.dirty(S);
const emb1 = S.meta.embers, n1 = S.log.length;
run(S, 740, 2);
ok(S.cold.hit && S.cold.hit[main.id] && S.log.slice(n1).some(l => /「灰烬营地」有人冻伤了/.test(l.msg)) && !S.log.slice(n1).some(l => /余烬 \+5/.test(l.msg)), 'frostbite → no embers, the camp is named');
// 没人冻伤：希望 +5、余烬 +5
{ const cn2 = G.coldAt(S); S.t = cn2.start - 1; G.getB(S, main.furnace).lvl = 30; G.dirty(S); main.stock.wood = 3000; main.stock.food = 3000; main.sick = 0; const e0 = S.meta.embers, n2 = S.log.length; let ee = 0; for (let i = 0; i < 740; i += 2) { const a = S.meta.embers; G.step(S, 2); if (S.log.length && /寒潮过去了/.test(S.log[S.log.length - 1].msg)) ee = S.meta.embers - a; }
  ok(!S.cold.hit[main.id] && S.meta.embers >= e0 + 5 && S.log.slice(n2).some(l => /一个人都没冻伤/.test(l.msg)), `warm camp → hope and embers +5 (${S.meta.embers - e0})`); }
// 寒潮预报（研究）：提前两天，燃料 ×1.7；保温工装：户外 ×0.7
S.tech.done.coldcast = true; S.tech.done.thermal = true;
ok(G.coldLead(S) === 1440 && G.coldFuel(S) === 1.7 && G.coldGather(S) === 0.7, '寒潮预报 + 保温工装 numbers');
// 老存档：读档后过一天开始报
const o2 = JSON.parse(G.serialize(S)); delete o2.cold; o2.savedAt = Date.now() - 3600 * 1000;
const S3 = G.deserialize(JSON.stringify(o2)), c3 = G.coldAt(S3);
ok(S3.cold && Math.abs(S3.cold.t0 - (o2.t + 3600)) < 5 && Math.abs(c3.inSec - (3600 + 1440)) < 6, `old save: first snap two days after the (offline) load time (${Math.round(c3.inSec)} s)`);
console.log(fail ? `FAILED ${fail}` : 'all ok');
