// 1.1 分岔北境 + 站点奇遇
import * as G from '../src/sim.js';
import { DAY_LEN, FORK, QY_KEYS, NORTH_RULES, BLD } from '../src/data.js';
import { getWorld, W, northStop } from '../src/worldgen.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const run = (S, s, dt = 1) => { for (let i = 0; i < s; i += dt) G.step(S, dt); };
const seed = 6061;
const S = G.newRun(G.defaultMeta(), 0, seed), J = G.journeyOf(S);
S.known = 7; J.stage = G.SPINE;
const fill = () => { const m = G.mainCamp(S); m.people = Math.max(m.people, 90); for (const k of ['wood', 'stone', 'plank', 'food', 'game', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = Math.max(m.stock[k] || 0, 20000); G.getB(S, m.furnace).lvl = Math.max(37, G.getB(S, m.furnace).lvl); };
J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20;
const travel = () => {
  fill();
  for (let s = 0; s <= J.stage; s++) for (let k = 0; k < 4; k++) G.chapState(S).ok[s + ':' + k] = 1;
  S.reveal.fill(1); G.rt(S).revealN = (G.rt(S).revealN || 0) + 1; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); if (!d.ok) { console.log('depart failed', d.reason); process.exit(1); }
  let t = 0; while (J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
};

// ---- 世界之脊 → 北境第 1 站：没有分岔，有奇遇 ----
travel();
ok(G.northN(J.stage) === 1, `at 北境 1 (${G.stopOf(S, J.stage).n})`);
ok(S.qy && S.qy.k === J.stage && QY_KEYS.includes(S.qy.id) && S.qy.at === Math.round(S.qy.at), `奇遇 set on arrival: ${S.qy && S.qy.id}`);
ok(!G.qyPending(S), 'not shown right away');
run(S, 4); ok(!G.forkOf(S), 'no fork before the tower is lit');

// ---- 点亮塔 → 侦察兵带回两条路 ----
G.towerList(S).push({ n: 1, x: 0, y: 0, t: S.t, camp: J.main });
run(S, 3);
const F = G.forkOf(S);
ok(F && F.k === J.stage + 1 && F.opts.length === 3, 'fork appears after the tower is lit');
const N2 = F.k - G.SPINE, def = northStop(seed, N2);
ok(G.forkN(S) === 2, 'two roads without 三岔侦察');
ok(F.opts[0].rule === def.rule0, `road 1 is the seed's terrain (${def.rule0})`);
ok(new Set(F.opts.map(o => o.rule)).size === 3 && F.opts.every(o => NORTH_RULES[o.rule]), `three different terrains: ${F.opts.map(o => o.rule).join('/')}`);
ok(new Set(F.opts.map(o => o.qy)).size === 3 && !F.opts.some(o => o.qy === S.qy.id), 'each road has its own 奇遇, not the one just seen');
ok(new Set(F.opts.map(o => o.bonus)).size === 3 && new Set(F.opts.map(o => o.d)).size === 3, 'bonuses and difficulties differ');
ok(F.opts.every(o => o.rule !== 'rich' || o.rich), 'rich roads name their ore');
ok(F.opts.every(o => G.forkSpec(o)), `each road shows a specialty (${F.opts.map(G.forkSpec).join('/')})`);
S.tech = S.tech || { done: {}, cur: null, prog: 0 }; S.tech.done.fork3 = true; ok(G.forkN(S) === 3, '三岔侦察: three roads'); delete S.tech.done.fork3;

// ---- 选第二条：下一站那片地按新地貌重新生成，别处不动 ----
const w0 = getWorld(seed), ter0 = w0.terrain.slice(), spot0 = w0.spot.slice();
const alt = F.opts[1], r = G.pickFork(S, 1);
ok(r.ok && r.changed && northStop(seed, N2).rule === alt.rule, `picked road 2 → ${alt.rule}`);
const w1 = getWorld(seed);
ok(w1 !== w0, 'world regenerated');
let near = 0, far = 0;
const cy = northStop(seed, N2).y;
for (let i = 0; i < Math.min(ter0.length, w1.terrain.length); i++) {
  const y = Math.floor(i / W), diff = ter0[i] !== w1.terrain[i] || spot0[i] !== w1.spot[i];
  if (!diff) continue;
  if (Math.abs(y - cy) <= 45) near++; else far++;
}
ok(near > 0 && far === 0, `only the next station's area changed (${near} tiles near, ${far} elsewhere)`);
ok(J.picks[F.k].rule === alt.rule && J.picks[F.k].qy === alt.qy, 'pick stored on the journey');
// 难度：难走的路目标更高、奖励更多
const chOf = d => { J.picks[F.k].d = d; delete G.rt(S).nch[F.k]; return G.chapterDef(S, F.k); };
const easy = chOf(0), hard = chOf(2), mid = chOf(1);
const rate = ch => ch.tasks.filter(t => t.k === 'rate').reduce((a, t) => a + t.n, 0);
ok(rate(easy) < rate(mid) && rate(mid) < rate(hard), `goals ×0.9/×1/×1.15 (${rate(easy)} / ${rate(mid)} / ${rate(hard)})`);
ok(hard.reward.people > mid.reward.people && mid.reward.people > easy.reward.people && hard.reward.bonus === alt.bonus, 'rewards scale; the road bonus is in the chapter reward');
J.picks[F.k].d = alt.d; delete G.rt(S).nch[F.k];
// 存档：选过的路读回来，地图一样
const str = G.serialize(S);
G.newRun(G.defaultMeta(), 0, seed); // 同一个种子开新的一程：选法清空
ok(northStop(seed, N2).rule === def.rule0, 'a new run with the same seed forgets the pick');
const S2 = G.deserialize(str);
ok(northStop(seed, N2).rule === alt.rule && G.forkOf(S2) && G.forkOf(S2).pick === 1, 'load restores the pick');
const w2 = getWorld(seed); let same = true; for (let i = 0; i < w1.terrain.length; i++) if (w1.terrain[i] !== w2.terrain[i] || w1.spot[i] !== w2.spot[i]) { same = false; break; }
ok(same, 'loaded world matches the picked world');
// 改主意：选回第一条
ok(G.pickFork(S, 0).ok && northStop(seed, N2).rule === def.rule0, 'can change the pick before departing');
G.pickFork(S, 1);

// ---- 奇遇：半天以后出现，选项、派人、回来 ----
const q = S.qy; q.at = S.t; run(S, 2);
ok(G.qyPending(S) && G.qyView(S).opts.length === 2, `奇遇 shows after half a day: ${G.qyView(S).n}, 2 options`);
ok(S.log.slice(-6).some(l => /奇遇/.test(l.msg || '')), 'a log line points at it');
S.tech.done.guide = true; ok(G.qyView(S).opts.length === 3 && G.qyView(S).opts[2].g, '奇遇向导 adds a third option on the first stage'); delete S.tech.done.guide;

// 每一件奇遇、每一条路都走一遍：不报错、能走完、派出去的人都回来
const camp = G.mainCamp(S);
let paths = 0, bad = [];
for (const id of QY_KEYS) {
  for (const guide of [false, true]) {
    const E = G.QE[id];
    const firsts = E.st[0].o.length + (guide && E.st[0].g ? 1 : 0);
    for (let a = 0; a < firsts; a++) for (let b = 0; b < 3; b++) {
      fill(); S.meta.embers = 100; camp.people = 90; camp.sick = 0; const p0 = camp.people;
      if (guide) S.tech.done.guide = true; else delete S.tech.done.guide;
      S.qy = { k: J.stage, id, st: 0, at: S.t, camp: camp.id };
      let r = G.qyChoose(S, a), steps = 0;
      if (!r.ok) { bad.push(`${id}:${a} ${r.reason}`); continue; }
      while (S.qy && !S.qy.done && steps++ < 5) {
        S.t = Math.max(S.t, S.qy.at); run(S, 2);
        const v = G.qyView(S); if (!v) { bad.push(`${id}:${a} no view at stage ${S.qy.st}`); break; }
        r = G.qyChoose(S, Math.min(b, v.opts.length - 1)); if (!r.ok) { bad.push(`${id}:${a}/${b} ${r.reason}`); break; }
      }
      if (!S.qy.done) bad.push(`${id}:${a}/${b} did not finish`);
      if (S.qy.away) bad.push(`${id}:${a}/${b} people still away`);
      if (camp.people < p0) bad.push(`${id}:${a}/${b} lost people ${p0} → ${camp.people}`);
      paths++;
    }
  }
}
delete S.tech.done.guide;
ok(!bad.length, `all ${paths} 奇遇 paths finish, nobody lost${bad.length ? ': ' + bad.slice(0, 6).join(' | ') : ''}`);
ok(Object.keys(S.meta.qy).length === 12, 'all 12 recorded in meta (book / achievements)');
// 派人：人走了占着床位，到点回来
fill(); camp.people = 90; S.qy = { k: J.stage, id: 'undercity', st: 0, at: S.t, camp: camp.id };
G.qyChoose(S, 0);
ok(camp.people === 80 && S.qy.away === 10 && G.awayOf(S, camp) >= 10, '10 people leave for the ice city (beds kept)');
ok(!G.qyPending(S) && G.qyWait(S).left === 600, 'next stage in 10 minutes');
run(S, 602); ok(camp.people >= 80 + 10 - 1 && !S.qy.away && G.qyPending(S), 'they come back and the next stage shows');
G.qyChoose(S, 1); ok(S.qy.done && (S.wbp && Object.keys(S.wbp).length >= 1), 'the clock tower gives a wonder blueprint');
// 人手不够
camp.people = 15; S.qy = { k: J.stage, id: 'whale', st: 0, at: S.t, camp: camp.id };
ok(!G.qyView(S).opts[0].ok && /人手不够/.test(G.qyView(S).opts[0].why) && G.qyView(S).opts[1].ok, 'not enough hands: that option is greyed, the other still works');
camp.people = 90;
// 狼王：打赢了解锁装饰
S.meta.f13 = {}; S.qy = { k: J.stage, id: 'wolfking', st: 1, at: S.t, camp: camp.id };
const dWas = G.campDefense; G.qyChoose(S, 0);
const won = (S.meta.f13 || {}).wolfking;
console.log('     wolf king', won ? 'won' : 'lost', 'def', G.campDefense(S, camp));
S.meta.f13.wolfking = 1; G.bookTick(S);
ok(G.cosHave(S, 'deco', 'wolfrug') && G.unlocked(S, 'wolfrug'), '狼王皮 deco unlocks with the achievement');
void dWas;
// 地热喷发：免费地热井（不是地热谷也能建，不要材料）
camp.freeB = { geowell: 1 };
ok(G.unlocked(S, 'geowell') && Object.keys(G.buildCost(S, 'geowell', camp.id, camp.y)).length === 0, 'free geowell: unlocked and costs nothing');
let gw = null;
for (let y = Math.floor(camp.y) - 9; y <= camp.y + 9 && !gw; y++) for (let x = Math.floor(camp.x) - 9; x <= camp.x + 9 && !gw; x++) { const c = G.checkPlace(S, 'geowell', x, y); if (c.ok) { const pr = G.place(S, 'geowell', x, y); if (pr.ok) gw = G.getB(S, pr.id); } }
ok(gw && !camp.freeB.geowell && (G.ruleNow(S) === 'geo' || !G.unlocked(S, 'geowell')), 'placed; token used up');
// 全局加成：研究 ×2、商会 +20%
const T = S.tech; T.cur = null;
G.gBuffAdd(S, 'res', 1, DAY_LEN, 't'); ok(G.gBuff(S, 'res') === 1, 'research buff on');
G.gBuffAdd(S, 'guild', 0.2, DAY_LEN, 't'); const p1 = G.sellPrice(S, 'steel'); S.gbuffs = []; const p0g = G.sellPrice(S, 'steel');
ok(Math.abs(p1 / p0g - 1.2) < 1e-9, 'guild price +20% during the buff');
// 到了第 2 站：用的是选的那条路的奇遇、地貌、特产
G.pickFork(S, 1);
const qyWant = J.picks[F.k].qy;
travel();
ok(G.northN(J.stage) === 2 && G.ruleNow(S) === alt.rule, `arrived at 北境 2 on the picked terrain (${G.ruleNow(S)})`);
ok(S.qy.id === qyWant && S.qy.k === J.stage, 'its 奇遇 is the road\'s one');
// 章节奖励里的好处
const ch = G.chapters(S).find(c => c.i === J.stage);
for (let k = 0; k < ch.tasks.length; k++) G.chapState(S).ok[J.stage + ':' + k] = 1;
const e0 = S.meta.embers, wb0 = Object.keys(S.wbp || {}).length, sp0 = JSON.stringify(S.meta.specs);
ok(G.chapterReward(S, J.stage).some(t => /余烬|图纸|专家/.test(t)), `reward list shows the road bonus: ${G.chapterReward(S, J.stage).slice(-1)}`);
G.claimChapter(S, J.stage);
ok(S.meta.embers > e0 || Object.keys(S.wbp || {}).length > wb0 || JSON.stringify(S.meta.specs) !== sp0, `bonus given (${alt.bonus}, ${FORK.dn[alt.d]})`);
// 没选路就出发：走第一条
G.towerList(S).push({ n: 2, x: 0, y: 0, t: S.t, camp: J.main }); run(S, 3);
const F3 = G.forkOf(S); ok(F3 && F3.pick == null, 'fork at 北境 2');
S.qy.at = S.t; run(S, 2); ok(G.qyPending(S), '奇遇 pending when we leave');
travel();
ok(G.northN(J.stage) === 3 && northStop(seed, F3.k - G.SPINE).rule === F3.opts[0].rule && J.picks[F3.k], 'departing without a pick takes road 1');
ok(S.qy.k === J.stage && !S.qy.done, 'new 奇遇 for 北境 3; the old one was missed');
// 离线：奇遇不弹提醒
S.qy.at = S.t; G.rt(S).offline = true; const nl = S.log.length; run(S, 3); G.rt(S).offline = false;
ok(!S.log.slice(nl).some(l => /奇遇/.test(l.msg || '')), 'no 奇遇 alert while catching up offline');
void BLD;

console.log(fail ? `\n${fail} FAILED` : '\nall ok');
process.exit(fail ? 1 : 0);
