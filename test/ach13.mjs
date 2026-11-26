// 第十三版的成就：二十个、只给装扮不给余烬；老存档读进来按条件补发；称号的选择；各个钩子（永夜极光、风暴、冰湖庆典、挪位置、拆古城、拍照）
import * as G from '../src/sim.js';
import fs from 'fs';
import { TITLES, NDECO, BLD } from '../src/data.js';

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const load = f => G.deserialize(fs.readFileSync(f, 'utf8'));
const NEW = G.ACH.filter(a => a.cat && !a.v); // 1.1 加的（v: 11）另算
const got = (S, id) => !!G.bookOf(S).a[id];

ok(NEW.length === 20 && NEW.every(a => a.rw === 0 && a.gift && G.giftList(a).length) && G.ACH.filter(a => !a.cat).every(a => a.rw > 0), `20 new achievements, cosmetics only (${G.ACH.length} in all)`);
ok(NEW.filter(a => a.hid).length === 3 && G.ACH_CATS.every(c => G.ACH.some(a => G.achCat(a) === c)), 'six new categories + the old ones, three hidden');
// 奖励表：四个称号来自文档，八种北境装饰各有一个成就，每样装扮都只从一个成就来
{
  const all = NEW.flatMap(a => G.giftList(a).map(([k, v]) => k + ':' + v));
  ok(new Set(all).size === all.length, 'no reward is given twice');
  ok(['破冰者', '点灯人', '北境旅人', '点燃天火的人'].every(t => Object.values(TITLES).includes(t)) && Object.keys(TITLES).every(id => G.giftFrom('title', id)), 'all titles come from an achievement (incl. the four in the plan)');
  ok(NDECO.every(d => G.giftFrom('deco', d)) && ['gold', 'blue', 'purple', 'green', 'aurora'].every(f => G.giftFrom('flame', f)), 'each north deco and flame colour is unlocked by one achievement');
  ok(G.giftFrom('title', 'sky').id === 'sky' && G.giftFrom('flame', 'gold').id === 'sky' && G.giftFrom('deco', 'skymem').id === 'sky', 'sky fire gives 点燃天火的人, gold flame and the sky-fire monument (as the ending says)');
}
// 新开一局：一个都没有
{
  const S = G.newRun(G.defaultMeta(), 0, 5); G.bookTick(S);
  ok(NEW.every(a => !got(S, a.id)) && G.titleOf(S) === '' && !G.cosHave(S, 'title', 'ice') && G.cosHave(S, 'flame', 'def'), 'fresh run: none, no title, default flame available');
}
// 北境第 10 站（九座塔）：读进来就补发
{
  const S = load('/tmp/v13/tw10x.json'), e0 = S.meta.embers; G.rt(S).fx = [];
  const add = G.bookTick(S) || [];
  const ids = add.filter(a => a[0] === 'a').map(a => a[1]);
  ok(['n1', 'n5', 'n10', 'tw1', 'tw5'].every(id => got(S, id)) && !got(S, 'n20') && !got(S, 'sky'), 'north 10 save: 北境 1/5/10 and towers 1/5 granted on load: ' + ids.join(','));
  ok(S.meta.embers === e0 + add.filter(a => a[0] === 'a').reduce((s, [, id]) => s + G.ACH.find(x => x.id === id).rw, 0), 'new ones add no embers');
  ok(G.rt(S).fx.some(f => f.kind === 'book' && f.add.some(a => a[1] === 'n1')), 'book fx queued (toast "解锁…" in the game)');
  ok(G.rulesSeen(S) >= 8, `terrains seen on the way: ${G.rulesSeen(S)} (${Object.keys(S.meta.rulesSeen).join(' ')})`);
  ok(G.cosHave(S, 'title', 'ice') && G.cosHave(S, 'title', 'lamp') && G.cosHave(S, 'flame', 'blue') && !G.cosHave(S, 'flame', 'gold'), 'unlocked: 破冰者, 点灯人, ice-blue flame; gold still locked');
  ok(Object.values(TITLES).includes(G.titleOf(S)) && G.titleOf(S) !== '', 'no choice yet: shows the newest title: ' + G.titleOf(S));
  ok(G.setTitle(S, 'sky').ok === false && G.setTitle(S, 'ice').ok && G.titleOf(S) === '破冰者', 'pick 破冰者 (点燃天火的人 still locked)');
  G.setTitle(S, 'none'); ok(G.titleOf(S) === '', 'hide the title');
  // 天火
  const m = G.mainCamp(S);
  for (const k of ['steel', 'alloy', 'part', 'core', 'starcore']) m.stock[k] = 5000;
  let p = null; for (let y = Math.floor(m.y - 9); y <= m.y + 9 && !p; y++) for (let x = Math.floor(m.x - 9); x <= m.x + 9 && !p; x++) if (G.checkPlace(S, 'skyfire', x, y).ok) p = { x, y };
  const b = G.getB(S, G.place(S, 'skyfire', p.x, p.y).id); b.tw.p = G.towerSpec(S, 10).dur; G.igniteTower(S, b.id); G.bookTick(S);
  ok(got(S, 'sky') && G.cosHave(S, 'title', 'sky') && G.cosHave(S, 'flame', 'gold') && G.cosHave(S, 'deco', 'skymem'), 'sky fire: title, gold flame, monument unlocked');
  ok(G.setTitle(S, 'sky').ok && G.titleOf(S) === '点燃天火的人', 'pick 点燃天火的人');
  // 存档往返：装扮的选择和成就都在 meta 里
  const T = G.deserialize(G.serialize(S)); ok(G.titleOf(T) === '点燃天火的人' && got(T, 'sky'), 'save round trip keeps title and achievements');
  // 北迁：新的一程也留着
  S.meta.graduated = true; const N = G.migrate(S); ok(N !== S && got(N, 'sky') && G.titleOf(N) === '点燃天火的人', 'new run keeps them');
}
// 挪位置、拍照
{
  const S = load('/tmp/v13/north1.json'); G.bookTick(S);
  S.meta.moves = 9; S.meta.photos = 19; G.bookTick(S); ok(!got(S, 'mover') && !got(S, 'photo20'), '9 moves, 19 photos: not yet');
  const m = G.mainCamp(S), b = S.buildings.find(x => x.camp === m.id && x.type !== 'furnace' && BLD[x.type].size === 2 && !BLD[x.type].tower);
  let moved = false;
  for (let d = 2; d < 12 && !moved && b; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (!moved && G.moveBuilding(S, b.id, b.x + dx, b.y + dy).ok) moved = true;
  S.meta.photos = 20; G.bookTick(S);
  ok(moved && S.meta.moves === 10 && got(S, 'mover') && got(S, 'photo20'), 'the 10th move and the 20th photo unlock 挪挪更顺 and 随手拍');
}
// 永夜：一起看 5 次极光
{
  let S = null, n = 0; for (let k = 1; k <= 8 && !S; k++) { const T = load(`/tmp/v13/north${k}.json`); if (G.ruleNow(T) === 'night') { S = T; n = k; } }
  if (!S) ok(false, 'no night fixture'); else {
    G.bookTick(S);
    for (let i = 0; i < 4; i++) { S.aurOpen = S.t; G.watchAurora(S); }
    G.bookTick(S); const c4 = G.ACH.find(a => a.id === 'aur5').cur(S, G.bookOf(S));
    ok(!got(S, 'aur5') && c4 === 4, `night stop (north ${n}): 4 auroras, progress ${c4}/5`);
    S.aurOpen = S.t; G.watchAurora(S); G.bookTick(S);
    ok(got(S, 'aur5') && G.cosHave(S, 'flame', 'green') && G.cosHave(S, 'deco', 'windchime'), '5th aurora: 永夜极光 (green flame, wind chime)');
  }
}
// 冰湖：有冰钓屋的营地办庆典
{
  let S = null; for (let k = 1; k <= 8 && !S; k++) { const T = load(`/tmp/v13/north${k}.json`); if (G.ruleNow(T) === 'lakes') S = T; }
  const m = G.mainCamp(S); m.people = Math.max(60, m.people); m.stock.food = 99999; m.stock.wood = 99999;
  for (const k of ['wood', 'plank', 'stone', 'iron', 'steel']) m.stock[k] = 99999;
  const W = 48; let placed = null;
  for (let y = Math.floor(m.y - 14); y <= m.y + 14 && !placed; y++) for (let x = Math.floor(m.x - 14); x <= m.x + 14 && !placed; x++) if (G.checkPlace(S, 'icefish', x, y).ok) { const r = G.place(S, 'icefish', x, y); if (r.ok) placed = r; }
  const r1 = G.startFest(S, m.id); G.bookTick(S);
  ok(placed && r1.ok && got(S, 'icefest') && G.cosHave(S, 'deco', 'deerstatue'), 'festival with an ice-fishing hut: 冰湖庆典 ' + (r1.reason || ''));
}
// 风暴走廊：第 4 场没人冻伤的暴风雪（北境第 9 站，NORTH=9 node test/mknorth.mjs）
{
  let S = null; for (let k = 1; k <= 9 && !S; k++) { const f = `/tmp/v13/north${k}.json`; if (!fs.existsSync(f)) continue; const T = load(f); if (G.ruleNow(T) === 'storm') S = T; }
  if (!S) ok(false, 'no storm fixture (run NORTH=9 node test/mknorth.mjs)'); else {
    G.bookTick(S);
    const ns = G.nsOf(S); ns.blizOk = 3; ns.bz = { k: -5, s0: 0, bad: 0 };
    let t = 0; while (ns.bz && t < 3000) { G.step(S, 1); t++; }
    G.bookTick(S);
    ok(ns.blizOk === 4 && got(S, 'storm4') && G.cosHave(S, 'deco', 'snowman'), `4th clean blizzard: 风暴不倒 (after ${t}s)`);
  }
}
console.log(fail ? `${fail} FAILED` : 'all ok');
process.exit(fail ? 1 : 0);
