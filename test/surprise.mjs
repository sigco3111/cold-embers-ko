// 在线小惊喜：极光夜可以一起看一次；走失驯鹿、流星坑隔一阵冒出来，点了有回报，过期就没了
import * as G from '../src/sim.js';
import { DAY_LEN } from '../src/data.js';
import { getWorld, W } from '../src/worldgen.js';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, secs, dt = 5) => { for (let t = 0; t < secs; t += dt) G.step(S, dt); };
const meta = G.defaultMeta(); meta.sites.push(1);
const S = G.newRun(meta, 1, 31337);
const c = S.camps[0], R = G.rt(S);
run(S, 20);
ok(!G.rollSurprise(S) && !S.sur, '开局没有惊喜');
// 第一夜一定有极光
let aur = 0;
for (let t = 0; t < DAY_LEN; t += 10) { run(S, 10, 5); R.fx = []; G.rollSurprise(S); if (S.aurOpen != null) aur++; }
ok(aur > 0 && S.stats.aurora == null, `第一夜极光出现（${aur} 次检查都开着）`);
// 再走到下一次极光
let got = false;
for (let t = 0; t < DAY_LEN * 8 && !got; t += 10) { run(S, 10, 5); R.fx = []; G.rollSurprise(S); if (S.aurOpen != null) got = true; }
ok(got, '之后的极光夜又能看');
const h0 = c.hope ?? 50, e0 = S.meta.embers || 0;
ok(G.watchAurora(S).ok && S.aurOpen == null && (S.meta.embers || 0) === e0 + 1 && c.hope >= Math.min(100, h0 + 4) - 0.01, `一起看极光：希望 ${h0.toFixed(0)}→${c.hope.toFixed(0)}，余烬 +1`);
ok(!G.watchAurora(S).ok, '一夜只能看一次');
// 走失驯鹿
S.sur = null; S.surNext = 0;
const kinds = {};
for (let i = 0; i < 40; i++) { S.sur = null; S.surNext = 0; S.t += 37; const u = G.rollSurprise(S); if (u) kinds[u.kind] = (kinds[u.kind] || 0) + 1; }
ok(Object.keys(kinds).length >= 1, `冒出来的：${JSON.stringify(kinds)}`);
S.sur = null; S.surNext = 0;
const u = G.rollSurprise(S);
ok(!!u, `冒出 ${u && u.kind} @${u && u.x},${u && u.y}`);
const w = getWorld(S.runSeed), i = u.y * W + u.x;
ok(S.reveal[i] && !R.occ[i] && !R.beltOcc.has(i), '落在已探明的空地上');
const d = Math.hypot(u.x + 0.5 - c.x, u.y + 0.5 - c.y), hr = G.heatRadius(S, c);
ok(d >= 3 && d <= hr + 3.5, `离营地 ${d.toFixed(1)}（供热圈 ${hr.toFixed(1)}）`);
ok(!G.rollSurprise(S) && S.sur === u, '同一时间只有一个');
const st0 = { ...c.stock }, rw = G.surReward(S, u);
const cl = G.claimSurprise(S);
ok(cl.ok && !S.sur && Object.keys(rw.res).every(k => c.stock[k] === (st0[k] || 0) + rw.res[k]), `领到 ${JSON.stringify(rw)}`);
ok(S.stats.sur === 1, '计数');
ok(!G.claimSurprise(S).ok, '领过就没了');
// 过期
S.surNext = 0; const u2 = G.rollSurprise(S);
ok(!!u2, '又来一个');
S.t = u2.until + 1; S.surNext = S.t + 9999;
G.rollSurprise(S);
ok(!S.sur, '过期就不见了');
// 流星：去过两个营地以后才会有
S.known = 3; let met = null;
for (let k = 0; k < 40 && !met; k++) { S.sur = null; S.surNext = 0; S.t += 41; const x = G.rollSurprise(S); if (x && x.kind === 'meteor') met = x; }
ok(!!met, '流星也会落');
ok(met && G.surReward(S, met).res.steel > 0, `第三层流星坑出钢材：${met && JSON.stringify(G.surReward(S, met))}`);
// 存档
const S2 = G.deserialize(G.serialize(S));
ok(S2.sur && S2.sur.id === S.sur.id, '存档后还在');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
