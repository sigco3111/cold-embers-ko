// 北境的章节：每站两条产能目标 + 地貌任务 + 烽火塔，目标按站涨（+8% 到 ×1.8，再 +3% 到 ×2.5），最远纪录和第一次到站的余烬
import * as G from '../src/sim.js';
import * as WG from '../src/worldgen.js';
import { NORTH_HI, NORTH_TASK, RES, CHAPTERS } from '../src/data.js';
import { nextGoal } from '../src/ui.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

// 涨幅
ok(near(G.northMult(1), 1.08) && near(G.northMult(10), 1.8) && near(G.northMult(11), 1.83) && near(G.northMult(30), 2.4) && G.northMult(40) === 2.5 && G.northMult(99) === 2.5, 'targets: +8%/stop to ×1.8 at 10, then +3%/stop, capped at ×2.5');

const S = G.newRun(G.defaultMeta(), 0, 6061), J = G.journeyOf(S);
S.known = 7;
const spineRate = {}; CHAPTERS.forEach(c => c.tasks.forEach(q => { if (q.k === 'rate') spineRate[q.r] = q.n; }));
// 前二十站的章节：两条高级材料（不重复）、按站涨、地貌任务对得上、前十站有塔
{
  let good = true, msg = [];
  for (let N = 1; N <= 20; N++) {
    const ch = G.chapterDef(S, G.SPINE + N), st = G.stopOf(S, G.SPINE + N);
    const rates = ch.tasks.filter(t => t.k === 'rate'), hi = rates.filter(t => NORTH_HI.includes(t.r));
    const want = st.rule === 'rich' ? 'rate' : NORTH_TASK[st.rule]?.k;
    const ruleT = st.rule === 'rich' ? rates.find(t => !NORTH_HI.includes(t.r)) : ch.tasks.find(t => t.k === want && t.k !== 'rate');
    const tower = ch.tasks.find(t => t.k === 'tower');
    const scaled = hi.every(t => Math.abs(t.n - spineRate[t.r] * G.northMult(N)) <= (t.n >= 10 ? 0.5 : 0.25));
    const fine = hi.length === 2 && hi[0].r !== hi[1].r && scaled && (st.rule === 'flat' ? !ruleT : !!ruleT) && (N <= 10 ? tower && tower.n === N : !tower) && ch.n.startsWith(`北境第 ${N} 站 · `) && ch.story.includes(st.short);
    if (!fine) good = false;
    if (N <= 11 || !fine) msg.push(`${N}${st.rule}:${hi.map(t => t.r + t.n).join('+')}${ruleT ? '+' + (ruleT.f || ruleT.b || ruleT.r || ruleT.k) : ''}${tower ? '+T' : ''}`);
  }
  ok(good, 'north chapters 1–20: ' + msg.join(' '));
  const pairs = new Set(); for (let N = 1; N <= 12; N++) pairs.add(G.northPair(S, N).slice().sort().join());
  ok(pairs.size >= 4, `rate pairs rotate (${pairs.size} different pairs in 12 stops)`);
}

// 走到北境第 1 站：新的一章接上，出发门槛要做完它，第一次到给余烬，记下最远纪录
function fill() { const m = G.mainCamp(S); m.people = Math.max(m.people, 120); for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = 20000; }
function travel() {
  fill(); S.reveal.fill(1); G.rt(S).revealN++; G.dirty(S);
  const P = J.plan || (J.plan = {}); P.mode = {}; for (const c of S.camps) P.mode[c.id] = 'douse';
  const d = G.depart(S); if (!d.ok) return d;
  let t = 0; while (J.trip && t < 6000) { if (J.trip.road) G.resolveRoad(S, 0); G.step(S, 1); t++; }
  S.reveal.fill(1); G.rt(S).revealN++; G.dirty(S); fill();
  return { ok: !J.trip };
}
J.stage = G.SPINE; J.fleet.icebreaker = 10; J.fleet.tractor = 10; J.fleet.sled = 20;
G.getB(S, G.mainCamp(S).furnace).lvl = 37;
for (let s = 0; s <= G.SPINE; s++) for (let k = 0; k < 3; k++) G.chapState(S).ok[s + ':' + k] = 1;
const e0 = S.meta.embers;
ok(travel().ok && J.stage === G.SPINE + 1, 'arrived at north 1');
const k1 = J.stage, cur = G.chapters(S).at(-1);
ok(cur && cur.i === k1 && cur.tasks.length === 3 && !cur.done, `current chapter is ${cur && cur.ch.n} with ${cur && cur.tasks.length} tasks: ${cur && cur.tasks.map(t => t.t).join(' / ')}`);
{ const l = S.log.find(l => /第一次走到北境第 1 站/.test(l.msg)); ok(S.meta.northMax === 1 && l && l.msg.includes(`带来 ${G.northEmbers(S)} 点余烬`) && S.meta.embers - e0 >= G.northEmbers(S), `first arrival: record 1, ${l && l.msg}`); }
ok(G.rt(S).fx.some(f => f.kind === 'chapter' && f.i === k1), 'chapter modal queued on arrival');
ok(G.rateGoals(S).filter(g => g.ch === k1).length === 2, 'both rate targets are live goals');
ok(G.plinesOf(S).filter(l => l.main && l.stage === k1).length === 2, 'and become main lines in the planner');
{ const g = nextGoal(S); ok(/产量 .*\/(\d+(\.5)?) 每分钟/.test(g) && cur.tasks.some(t => g.includes(RES[t.r]?.n || '@@')), 'goal bar shows a north target: ' + g); }
{ const gate = G.departGate(S), c = gate.items.find(i => i.id === 'chap'); ok(!c.ok && /北境第 1 站/.test(c.t), 'gate waits for the north chapter: ' + c.t + ' · ' + c.sub); }
// 做到两条产能（直接记完成）、塔先记成完成：章节做完，领奖励不给余烬，给两样高级材料
{
  const C = G.chapState(S); C.ok[k1 + ':0'] = 1; C.ok[k1 + ':1'] = 1;
  ok(!G.chapters(S).at(-1).done, 'tower task still open');
  S.tower = { lit: 1 }; // 第八步才有真的塔
  const c = G.chapters(S).at(-1); ok(c.done, 'tower lit → chapter done');
  const m = G.mainCamp(S), em = S.meta.embers, [a, b] = G.northPair(S, 1), a0 = m.stock[a], b0 = m.stock[b];
  ok(!G.chapterReward(S, k1).some(x => /余烬/.test(x)), 'reward list has no embers: ' + G.chapterReward(S, k1).join('，'));
  G.claimChapter(S, k1);
  ok(S.meta.embers === em && m.stock[a] === a0 + 30 && m.stock[b] === b0 + 30, 'claim: no embers, +30 of each target good');
}
// 地貌任务：计数和希望
{
  const st = n => G.chapterDef(S, G.SPINE + n);
  let wolfN = 0, nightN = 0; for (let n = 1; n <= 20 && (!wolfN || !nightN); n++) { if (G.stopOf(S, G.SPINE + n).rule === 'wolf') wolfN ||= n; if (G.stopOf(S, G.SPINE + n).rule === 'night') nightN ||= n; }
  const goTo = n => { while (G.northN(J.stage) < n) { for (let k = 0; k < 4; k++) G.chapState(S).ok[J.stage + ':' + k] = 1; if (!travel().ok) break; } };
  const wolf = () => {
    goTo(wolfN);
    const c = G.chapters(S).at(-1), t = G.chapterDef(S, J.stage).tasks.findIndex(x => x.k === 'ns');
    ok(G.ruleNow(S) === 'wolf' && t >= 0, `at the wolf stop (north ${wolfN}): ${c.tasks.map(x => x.t).join(' / ')}`);
    G.nsOf(S).raidW = 2; ok(!G.chapters(S).at(-1).tasks[t].ok, 'two raids repelled: not yet');
    G.nsOf(S).raidW = 3; G.step(S, 1); ok(G.chapters(S).at(-1).tasks[t].ok && G.chapState(S).ok[J.stage + ':' + t], 'three raids repelled: task done and remembered');
    ok(st(wolfN).tasks.length === (wolfN <= 10 ? 4 : 3), 'wolf chapter has rate×2 + task' + (wolfN <= 10 ? ' + tower' : ''));
  };
  const night = () => {
    goTo(nightN);
    const m = G.mainCamp(S), h = G.chapterDef(S, J.stage).tasks.findIndex(x => x.k === 'hhold');
    ok(G.ruleNow(S) === 'night' && h >= 0, `at the night stop (north ${nightN})`);
    const hold = v => { for (let i = 0; i < 300; i++) { m.hope = v; G.step(S, 2); } };
    hold(60); ok((G.nsOf(S).hh || 0) === 0, 'hope 60: no progress');
    hold(85); ok(Math.abs(G.nsOf(S).hh - 600) < 3 && G.chapters(S).at(-1).tasks[h].ok, `hope 85 for 10 min: done (${G.chapters(S).at(-1).tasks[h].cur} min)`);
  };
  if (nightN < wolfN) { night(); wolf(); } else { wolf(); night(); }
}
// 新的北行：最远纪录留着，再走到北境第 1 站不给余烬
{
  const far = S.meta.northMax;
  const N = G.newRun(S.meta, 0, 4242), JN = G.journeyOf(N);
  ok(N.meta.northMax === far, `new run keeps the record (${far})`);
  N.known = 7; JN.stage = G.SPINE; JN.fleet.icebreaker = 10; JN.fleet.tractor = 10; JN.fleet.sled = 20; G.getB(N, G.mainCamp(N).furnace).lvl = 37;
  for (let s = 0; s <= G.SPINE; s++) for (let k = 0; k < 3; k++) G.chapState(N).ok[s + ':' + k] = 1;
  const m = G.mainCamp(N); m.people = 120; for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart', 'starcore']) m.stock[k] = 20000;
  N.reveal.fill(1); G.rt(N).revealN++; G.dirty(N);
  const P = JN.plan || (JN.plan = {}); P.mode = {}; for (const c of N.camps) P.mode[c.id] = 'douse';
  const d = G.depart(N); let t = 0; while (d.ok && JN.trip && t < 6000) { if (JN.trip.road) G.resolveRoad(N, 0); G.step(N, 1); t++; }
  const e = N.meta.embers; ok(G.northN(JN.stage) === 1 && N.meta.northMax === far && !N.log.some(l => /第一次走到北境/.test(l.msg)), `second time at north 1: no embers (${e})`);
}
// 存档往返：章节、计数、纪录都在
{
  const str = G.serialize(S); WG.setRows(WG.BASE_H); const T = G.deserialize(str);
  ok(T.meta.northMax === S.meta.northMax && G.chapters(T).at(-1).i === J.stage && G.nsOf(T).hh === G.nsOf(S).hh, 'save round trip keeps chapter, counters and record');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
