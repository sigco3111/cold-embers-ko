// 第十三版的装扮：炉火颜色（全部 / 单个营地）、营旗图案、相框；北境装饰要成就才能建；存档往返和北迁都留着
import * as G from '../src/sim.js';
import fs from 'fs';
import { BLD, NDECO, FLAMES } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const S = G.deserialize(fs.readFileSync('/tmp/v13/north1.json', 'utf8'));
const B = G.bookOf(S), grant = id => { B.a[id] = S.t; };
const m = G.mainCamp(S);
// 没解锁：什么都换不了
ok(G.flameOf(S, m) === 'def' && G.flagOf(S) === 'def' && G.frameOf(S) === 'none', 'defaults: plain flame, plain flag, no frame');
ok(!G.setFlame(S, null, 'gold').ok && !G.setFlag(S, 'star').ok && !G.setFrame(S, 'film').ok && !G.setFlame(S, null, 'nope').ok, 'locked or unknown ones are refused');
ok(G.setFlame(S, null, 'def').ok && G.flameOf(S, m) === 'def', 'the plain flame is always allowed');
// 北境装饰
ok(NDECO.every(k => BLD[k].gift && G.unlocked(S, k) === !!B.a[G.giftFrom('deco', k).id]) && !G.unlocked(S, 'skymem') && /^成就「.+」解锁$/.test(G.stageLock(S, 'skymem')), `north decos are locked until their achievement (${NDECO.filter(k => G.unlocked(S, k)).length} open already): ` + G.stageLock(S, 'skymem'));
{ const hid = G.ACH.find(a => a.hid && a.gift.deco); ok(G.stageLock(S, hid.gift.deco).includes('？？？'), `hidden achievement stays hidden in the lock text: ${BLD[hid.gift.deco].n} → ${G.stageLock(S, hid.gift.deco)}`); }
for (const a of G.ACH) if (a.cat) grant(a.id);
ok(NDECO.every(k => G.unlocked(S, k) && !G.stageLock(S, k)), 'all eight unlock with their achievements');
{
  for (const k of ['wood', 'plank', 'stone', 'iron', 'steel', 'alloy']) m.stock[k] = 99999;
  const h0 = G.decoHope(S, m).raw; let at = null;
  for (let y = Math.floor(m.y - 12); y <= m.y + 12 && !at; y++) for (let x = Math.floor(m.x - 12); x <= m.x + 12 && !at; x++) if (G.checkPlace(S, 'skymem', x, y).ok) at = [x, y];
  const r = at && G.place(S, 'skymem', at[0], at[1]);
  ok(r && r.ok && G.decoHope(S, m).raw > h0, `sky-fire monument placed, hope ${h0} → ${G.decoHope(S, m).raw}`);
}
// 炉火：全部营地、单独一座
const camps = S.camps.length > 1 ? S.camps : null;
ok(G.setFlame(S, null, 'gold').ok && S.camps.every(c => G.flameOf(S, c) === 'gold'), 'all camps → gold');
ok(S.meta.cos.fc === 1, 'changing the flame counts for 换个颜色');
G.bookTick(S); ok(G.cosHave(S, 'title', 'keeper'), '守火人 title unlocked');
ok(G.setFlame(S, m.id, 'aurora').ok && G.flameOf(S, m) === 'aurora' && m.flame === 'aurora', 'main camp alone → aurora');
ok(FLAMES.aurora.shift && FLAMES.gold.c.length === 3, 'aurora shifts, gold has a 3-colour palette');
ok(G.setFlame(S, m.id, 'gold').ok && !('flame' in m) && G.flameOf(S, m) === 'gold', 'picking the camp-wide colour again drops the override');
G.setFlame(S, m.id, 'blue');
ok(G.setFlame(S, null, 'purple').ok && !('flame' in m) && G.flameOf(S, m) === 'purple', 'a new camp-wide colour resets single-camp picks');
G.setFlame(S, m.id, 'green');
// 旗子、相框
ok(G.setFlag(S, 'wolf').ok && G.flagOf(S) === 'wolf' && G.setFrame(S, 'film').ok && G.frameOf(S) === 'film', 'flag 狼头, frame 胶片');
ok(G.setFrame(S, 'none').ok && G.frameOf(S) === 'none' && G.setFrame(S, 'map').ok, 'frame can be turned off and back on');
// 存档往返
{
  const T = G.deserialize(G.serialize(S)), tm = G.mainCamp(T);
  ok(G.flameOf(T, tm) === 'green' && T.camps.filter(c => c.id !== tm.id).every(c => G.flameOf(T, c) === 'purple') && G.flagOf(T) === 'wolf' && G.frameOf(T) === 'map', 'save round trip keeps flame, flag and frame');
  // 成就记录没了（比如换了一份存档）就退回本色，不会挂着锁住的东西
  T.meta.book.a = {}; ok(G.flameOf(T, tm) === 'def' && G.flagOf(T) === 'def' && G.frameOf(T) === 'none', 'without the achievements they fall back to plain');
}
// 北迁：全部营地的颜色、旗子、相框跟着走
{
  S.meta.graduated = true; const N = G.migrate(S);
  ok(N !== S && G.flameOf(N, G.mainCamp(N)) === 'purple' && G.flagOf(N) === 'wolf' && G.frameOf(N) === 'map', 'new run keeps the camp-wide flame, the flag and the frame');
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
