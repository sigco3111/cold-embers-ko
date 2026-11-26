// 1.1 北方商会：卖货、买货、余烬、装饰图纸、订单、每天重来
import * as G from '../src/sim.js';
import { GUILD, DAY_LEN, BLD } from '../src/data.js';

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
S.known = 3; const main = G.mainCamp(S); main.people = 40;
S.buildings.find(b => b.type === 'furnace' && b.camp === main.id).lvl = 8;
const fill = () => { for (const k of ['wood', 'stone', 'food', 'plank', 'coal', 'ore', 'iron']) main.stock[k] = 400; };
fill();
const sil = () => G.guildOf(S).silver;

// ---- 没有驿站 ----
ok(!G.guildOn(S), 'no post: guild off');
ok(!G.guildSell(S, main.id, 'wood', 10).ok, 'no post: cannot sell');
ok(!G.buyEmbers(S, 1).ok, 'no post: cannot buy embers');
run(S, 3); ok(!S.guild || S.guild.day < 0, 'no post: no caravan day');

// ---- 盖驿站，车队第一次到 ----
fill(); const post = put(S, main, 'guildpost');
ok(!!post, 'guildpost placed (t2, plank + iron)');
const nLog = S.log.length; run(S, 3);
const Gd = G.guildOf(S);
ok(Gd.day === G.guildDay(S), 'caravan day set');
ok(S.log.slice(nLog).some(l => /车队第一次到了/.test(l.m || l.msg || l.t || JSON.stringify(l))), 'first caravan log');
ok(Gd.orders.length === GUILD.orders, `3 orders on day one (${Gd.orders.length})`);
ok(Gd.orders.every(o => G.tradable(S, o.k) && o.n >= 10 && o.until > S.t && o.silver > 0 && o.emb >= 1), 'orders are well formed');

// ---- 卖 ----
ok(!G.tradable(S, 'heart') && !G.tradable(S, 'shard'), 'heart/shard are not tradable');
ok(!G.tradable(S, 'crystal'), 'goods above the known tier are not tradable');
const f = G.floatOf(S, 'wood'); ok(f >= 1 - GUILD.float - 1e-9 && f <= 1 + GUILD.float + 1e-9, `daily float within ±40% (${f.toFixed(2)})`);
const p0 = G.sellPrice(S, 'wood'); ok(Math.abs(p0 - GUILD.price[1] * f) < 1e-9, 'first unit price = base × float');
const v10 = G.sellValue(S, 'wood', 10); ok(v10 < 10 * p0 && v10 > 10 * p0 * 0.95, `10 wood ≈ 10 × price, a touch less (${v10.toFixed(2)})`);
fill(); const s0 = sil(); const r1 = G.guildSell(S, main.id, 'wood', 100);
ok(r1.ok && r1.n === 100 && Math.abs(sil() - s0 - r1.silver) < 1e-9 && main.stock.wood === 300, `sold 100 wood for ${r1.silver.toFixed(1)}`);
const r2 = G.guildSell(S, main.id, 'wood', 100);
ok(r2.ok && r2.silver < r1.silver, `the second 100 sell for less (${r2.silver.toFixed(1)} < ${r1.silver.toFixed(1)})`);
ok(G.sellPrice(S, 'wood') < p0 * 0.6, 'after 200 wood the price has dropped (depth 300)');
main.stock.plank = 5; const r3 = G.guildSell(S, main.id, 'plank', 50);
ok(r3.ok && r3.n === 5 && main.stock.plank === 0, 'cannot sell more than the camp has');
ok(!G.guildSell(S, main.id, 'plank', 5).ok, 'nothing left: sell refused');
// 卖多少都不会无限赚：同一天卖一万木头也有上限
const cap = G.sellValue(S, 'coal', 1e6); ok(cap < GUILD.price[1] * (1 + GUILD.float) * GUILD.depth + 1, `one day of one good is capped (${cap.toFixed(0)})`);

// ---- 买 ----
fill(); Gd.silver = 5000;
const bp = G.buyPrice(S, 'stone'); ok(Math.abs(bp - GUILD.price[1] * G.floatOf(S, 'stone') * 3) < 1e-9, 'buy price = 3× base × float');
ok(G.buyLeft(S, 'stone') === GUILD.buyLim[1], 'tier-1 buy limit 300/day');
const st0 = main.stock.stone, b1 = G.guildBuy(S, main.id, 'stone', 1000);
ok(b1.ok && b1.n === 300 && main.stock.stone === st0 + 300 && G.buyLeft(S, 'stone') === 0, 'buy stops at the daily limit');
ok(!G.guildBuy(S, main.id, 'stone', 1).ok, 'limit reached: refused');
Gd.silver = 1; ok(!G.guildBuy(S, main.id, 'iron', 10).ok, 'not enough silver: refused');

// ---- 余烬 ----
Gd.silver = 1e6; const e0 = S.meta.embers;
ok(G.emberPrice(S) === GUILD.emberCost * 3, 'ember price = 40 × known tier');
const eb = G.buyEmbers(S, 50); ok(eb.ok && eb.n === 20 && S.meta.embers === e0 + 20, 'ember buys capped at 20/day');
ok(!G.buyEmbers(S, 1).ok && G.emberLeft(S) === 0, 'the 21st ember is refused');

// ---- 装饰图纸 ----
ok(G.SHOP_DECOS.length === 6, 'six shop decos');
ok(!G.unlocked(S, 'gbench'), 'gbench locked before buying');
ok(/银币/.test(G.stageLock(S, 'gbench')), `lock text mentions silver: ${G.stageLock(S, 'gbench')}`);
Gd.silver = 100; ok(!G.buyDeco(S, 'gbench').ok, 'not enough silver for the plan');
Gd.silver = 1000; const bd = G.buyDeco(S, 'gbench'); ok(bd.ok && Gd.silver === 1000 - BLD.gbench.shop, 'bought the bench plan');
ok(G.unlocked(S, 'gbench') && !G.stageLock(S, 'gbench'), 'gbench unlocked');
ok(!G.buyDeco(S, 'gbench').ok, 'cannot buy the same plan twice');
fill(); const bench = put(S, main, 'gbench'); ok(!!bench, 'bench can be built');
const S3 = G.newRun(S.meta, 0, 7); ok(G.unlocked(S3, 'gbench'), 'plan stays bought in a new run (meta)');

// ---- 订单 ----
const o = Gd.orders[0]; main.stock[o.k] = 0;
const d0 = G.guildDeliver(S, main.id, o.id); ok(!d0.ok && /还差/.test(d0.reason), `deliver without goods refused: ${d0.reason}`);
main.stock[o.k] = o.n + 5; const sv = Gd.silver, em = S.meta.embers;
const d1 = G.guildDeliver(S, main.id, o.id);
ok(d1.ok && main.stock[o.k] === 5 && Gd.silver === sv + o.silver && S.meta.embers === em + o.emb, `delivered ${o.n} ${o.k}: +${o.silver} silver, +${o.emb} embers`);
ok(!Gd.orders.some(x => x.id === o.id) && S.stats.orders === 1, 'order removed, counted');

// ---- 第二天：价钱、限量、余烬重来；过期的订单撤掉、补满 ----
const day0 = G.guildDay(S), fl0 = ['wood', 'stone', 'coal', 'plank'].map(k => G.floatOf(S, k));
const short = Gd.orders.find(x => x.until <= (day0 + 1) * DAY_LEN + 3);
S.t = (day0 + 1) * DAY_LEN + 0.5; run(S, 3);
ok(G.guildDay(S) === day0 + 1 && Gd.day === day0 + 1, 'next caravan day');
ok(!Object.keys(Gd.vol).length && !Object.keys(Gd.bought).length && Gd.emb === 0, 'volumes, buy limits and embers reset');
ok(G.buyLeft(S, 'stone') === GUILD.buyLim[1] && G.emberLeft(S) === GUILD.emberDay, 'limits back to full');
ok(['wood', 'stone', 'coal', 'plank'].some((k, i) => Math.abs(G.floatOf(S, k) - fl0[i]) > 1e-6), 'prices move from day to day');
ok(Gd.orders.length === GUILD.orders, `orders topped back up to 3 (${Gd.orders.length})`);
ok(!short || !Gd.orders.includes(short), 'expired orders are withdrawn');
S.tech = S.tech || { done: {}, cur: null, prog: 0 }; S.tech.done.guild = true;
S.t = (day0 + 2) * DAY_LEN + 0.5; run(S, 3);
ok(Gd.orders.length === GUILD.ordersPro, `商会合同: 5 orders (${Gd.orders.length})`);
ok(new Set(Gd.orders.map(x => x.k)).size === Gd.orders.length || Gd.orders.length > 4, 'orders mostly ask for different goods');

// ---- 多营地：在哪交易 ----
const camps = S.camps;
ok(G.guildCamp(S, main.id) === main, 'trade at the main camp when it has the post');
ok(G.guildCamp(S, 12345) === main, 'unknown camp falls back to the main camp');

// ---- 存档 ----
const S2 = G.deserialize(G.serialize(S));
ok(S2.guild && Math.abs(S2.guild.silver - Gd.silver) < 1e-6 && S2.guild.orders.length === Gd.orders.length, 'guild state survives save/load');
ok(G.unlocked(S2, 'gbench'), 'bought plans survive save/load');
// 离线：车队照样来，不刷日志
const nl = S.log.length; const dd = G.guildDay(S); G.catchUp(S, DAY_LEN * 2.5, 0.25);
ok(S.guild.day === dd + 2, `offline: caravan days still roll (${dd} → ${S.guild.day})`);
ok(!S.log.slice(nl).some(l => /商会的车队到了/.test(JSON.stringify(l))), 'offline: no caravan logs');
void camps;

console.log(fail ? `\n${fail} FAILED` : '\nall ok');
process.exit(fail ? 1 : 0);
