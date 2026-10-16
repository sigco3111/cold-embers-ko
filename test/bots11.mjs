// 1.1 自动机三型 + 熔炉号令
import * as G from '../src/sim.js';
import { BOT, CMDS } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const run = (S, s, dt = 1) => { for (let i = 0; i < s; i += dt) G.step(S, dt); };
const put = (S, camp, type) => {
  for (let y = Math.floor(camp.y) - 11; y <= camp.y + 11; y++) for (let x = Math.floor(camp.x) - 11; x <= camp.x + 11; x++) {
    const c = G.checkPlace(S, type, x, y); if (c.ok) { const r = G.place(S, type, x, y); if (r.ok) return G.getB(S, r.id); }
  }
  return null;
};
const S = G.newRun(G.defaultMeta(), 0, 99);
S.reveal.fill(1); G.rt(S).revealN = 99; G.dirty(S);
S.known = 7; const main = G.mainCamp(S); main.auto = false; S.active = main.id;
S.buildings.find(b => b.type === 'furnace' && b.camp === main.id).lvl = 10;
const fill = () => { for (const k of ['wood', 'stone', 'food', 'plank', 'coal', 'iron', 'steel', 'alloy', 'part', 'battery']) main.stock[k] = 600; };
fill();
const T = S.tech || (S.tech = { done: {}, cur: null, prog: 0 });
for (const b of S.buildings) if (b.camp === main.id && b.type !== 'furnace') b.workers = 0;

// ---- 自动机仓 ----
const bay = put(S, main, 'bay'); ok(!!bay, 'bay placed');
const idle0 = G.idleLabor(S, main);
main.stock.core = 10; run(S, 2);
ok(bay.bots === 8 && main.stock.core === 6 && main.bots === 8, `bay loads 2 bots per core up to 8 (${bay.bots}, cores left ${main.stock.core})`);
ok(G.idleLabor(S, main) - idle0 === 12, `a labor bot counts as 1.5 people (+${G.idleLabor(S, main) - idle0})`);
T.done.botcal = true; run(S, 1);
ok(G.idleLabor(S, main) - idle0 === 16, '自动机校准: 2 people each');
delete T.done.botcal;
T.done.botbay = true; run(S, 2); ok(bay.bots === 12 && main.stock.core === 4, '仓位扩容: 12 per level');
delete T.done.botbay; run(S, 1); ok(bay.bots === 8, 'capacity drops back without the tech (test only)');

// ---- 型号 ----
ok(!G.setBayModel(S, bay.id, 'haul').ok, 'haul model needs research');
T.done.bothaul = true; T.done.botmine = true;
ok(G.setBayModel(S, bay.id, 'haul').ok && main.botH === 8, 'switched to haulers');
ok(G.idleLabor(S, main) === idle0, 'hauler bots do not take job slots');
// 采掘型：伐木场全由自动机干
main.people = Math.max(main.people, 6);
let lum = null;
for (let y = Math.floor(main.y) - 11; y <= main.y + 11 && !lum; y++) for (let x = Math.floor(main.x) - 11; x <= main.x + 11 && !lum; x++) {
  if (!G.checkPlace(S, 'lumber', x, y).ok) continue; fill(); const r = G.place(S, 'lumber', x, y); if (!r.ok) continue;
  const b = G.getB(S, r.id); b.workers = 2; G.step(S, 1); if (/采空/.test(G.rt(S).b[b.id].status || '')) G.demolish(S, b.id); else lum = b;
}
G.setBayModel(S, bay.id, 'labor');
for (const b of S.buildings) if (b.camp === main.id && b.type !== 'furnace') b.workers = 0;
lum.workers = 4; main.people = 2; G.dirty(S); run(S, 3);
const rL = (G.rt(S).b[lum.id].rate || {}).wood || 0;
G.setBayModel(S, bay.id, 'mine'); lum.workers = 4; run(S, 3);
const rM = (G.rt(S).b[lum.id].rate || {}).wood || 0, cr = G.rt(S).c[main.id];
ok(cr.mineU === 4 && rM > rL * 1.2, `采掘型: lumber +30% (${rL.toFixed(2)} → ${rM.toFixed(2)}/min, mine slots ${cr.mineU})`);
const saw = put(S, main, 'sawmill');
if (saw) { saw.workers = 2; run(S, 2); ok(G.rt(S).b[saw.id].staff < 0.99 || main.people >= 2, 'mine bots never work the sawmill'); }

// ---- 核心回收 ----
ok(!G.scrapBots(S, bay.id, 4).ok, 'scrapping needs 核心回收');
T.done.corerec = true; const c0 = main.stock.core || 0;
const sc = G.scrapBots(S, bay.id, 4); run(S, 2);
ok(sc.ok && bay.bots === 4 && main.stock.core === c0 + 2, `scrapped 4 bots → 2 cores, bay stays at 4 (${bay.bots})`);
G.bayRefill(S, bay.id); run(S, 2); ok(bay.bots === 8, 'refill loads the cores again');
const c1 = main.stock.core || 0; G.demolish(S, bay.id);
ok(main.stock.core === c1 + 4 && main.bots === 0, 'demolishing a bay with 核心回收 returns cores');

// ---- 老存档 ----
const bay2 = put(S, main, 'bay'); run(S, 1);
const o = JSON.parse(G.serialize(S)); delete o.bt; for (const b of o.buildings) delete b.bots; o.camps.find(c => c.id === main.id).bots = 6; o.camps.find(c => c.id === main.id).stock.core = 0;
const S2 = G.deserialize(JSON.stringify(o)); G.step(S2, 1);
ok(S2.buildings.find(b => b.id === bay2.id).bots === 6 && G.mainCamp(S2).bots === 6 && !G.mainCamp(S2).botH, 'old save: camp bots move into the bay as 劳工型');

// ---- 无人工坊 ----
if (saw) { T.done.autofac = true; ok(G.prodBonus(S, saw, main).parts.some(p => p[0] === '无人工坊' && p[1] >= 0.1), 'autofac: factories +10% or more'); delete T.done.autofac; }

// ---- 熔炉号令 ----
ok(G.cmdCheck(S, 'blaze').lock, 'commands need research');
T.done.cmd1 = true; T.done.cmd2 = true;
for (const b of S.buildings) if (b.camp === main.id && b.type !== 'furnace') b.workers = 0;
main.people = 30; lum.workers = 4; fill(); main.stock.wood = 100; G.dirty(S); run(S, 3);
const w0 = (G.rt(S).b[lum.id].rate || {}).wood, f0 = G.rt(S).c[main.id].burnPerMin;
ok(G.fireCmd(S, 'blaze', main.id).ok, 'fired 熔炉狂燃');
main.stock.wood = 100; run(S, 2);
const w1 = (G.rt(S).b[lum.id].rate || {}).wood, f1 = G.rt(S).c[main.id].burnPerMin;
ok(Math.abs(w1 / w0 - 2) < 0.05 && Math.abs(f1 / f0 - 3) < 0.05, `blaze: output ×2 (${w0.toFixed(1)} → ${w1.toFixed(1)}), fuel ×3 (${f0.toFixed(1)} → ${f1.toFixed(1)})`);
ok(!G.cmdCheck(S, 'blaze').ok && G.cmdCheck(S, 'blaze').on, 'cannot fire again while active');
run(S, 60); ok(!G.cmdOn(S, 'blaze', main) && G.cmdCheck(S, 'blaze').cd > 0, 'blaze ends after 60 s, cooldown running');
S.t += 600; ok(G.cmdCheck(S, 'blaze').ok, 'cooldown 10 min');
// 炉火庇护
const hr0 = G.heatRadius(S, main); G.fireCmd(S, 'shelter', main.id); run(S, 2);
ok(G.heatRadius(S, main) === hr0 + 2 && Math.abs(G.rt(S).c[main.id].burnPerMin / f0 - 0.5) < 0.05, 'shelter: warm ring +2, fuel ×0.5');
// 万众一心
main.disc = 70; G.fireCmd(S, 'unity', main.id); ok(main.disc === 0, 'unity: discontent → 0'); run(S, 30); ok(main.disc === 0, 'and stays 0');
// 紧急调度
G.rt(S).offline = true; ok(!G.fireCmd(S, 'rush', main.id).ok, 'no commands offline'); G.rt(S).offline = false;
const cap0 = G.netMul(S, 'cap'), spd0 = G.netMul(S, 'spd');
ok(G.fireCmd(S, 'rush', main.id).ok && G.netMul(S, 'cap') === cap0 * 3 && G.netMul(S, 'spd') === spd0 * 2, 'rush: roads ×3, sleds ×2');
ok(Object.values(CMDS).every(d => d.cd >= 480 && d.cd <= 1200), 'cooldowns 8–20 min');
// 存档
const S3 = G.deserialize(G.serialize(S)); ok(G.cmdOn(S3, 'rush') && G.cmdCd(S3, 'blaze') === G.cmdCd(S, 'blaze'), 'command timers survive save/load');

console.log(fail ? `\n${fail} FAILED` : '\nall ok');
process.exit(fail ? 1 : 0);
