// 寒烬北行 · 1.1 北方商会：任何一座营地盖了商会驿站，商会的车队每天来一趟
// 卖货换银币（每天的价钱上下浮动四成，同一天卖得越多越便宜）、接订单（限时送一批货，给银币和余烬）、
// 用银币买商会装饰的图纸、买余烬（每天最多 20），缺建材时还能按三倍价钱买一点救急。银币算在主营地，跟着北迁走
import { RES, RES_KEYS, BLD, GUILD, DAY_LEN } from './data.js';
import { rt, getCamp, logMsg, techDone, prodRate, gBuff } from './sim.js';
import { mainCamp } from './journey.js';
import { hash3 } from './worldgen.js';

const NO_TRADE = new Set(['heart', 'shard', 'starcore']); // 炉心的东西商会不收也不卖
export const guildPosts = S => S.buildings.filter(b => b.type === 'guildpost');
export const guildOn = S => S.buildings.some(b => b.type === 'guildpost');
export function guildOf(S) { return S.guild || (S.guild = { silver: 0, day: -1, vol: {}, bought: {}, emb: 0, orders: [], nid: 1 }); }
export const guildDay = S => Math.floor(S.t / DAY_LEN);
// 在哪个营地交易：这座营地有驿站就在这里，不然主营地，再不然第一座有驿站的营地
export function guildCamp(S, cid) {
  const ps = guildPosts(S); if (!ps.length) return null;
  if (cid != null && ps.some(b => b.camp === cid)) return getCamp(S, cid);
  const m = mainCamp(S); if (m && ps.some(b => b.camp === m.id)) return m;
  return getCamp(S, ps[0].camp);
}
export const tradable = (S, k) => !NO_TRADE.has(k) && RES[k] && RES[k].t <= S.known;
const ki = k => RES_KEYS.indexOf(k) + 1;
export const basePrice = k => GUILD.price[RES[k].t] || 1;
export const floatOf = (S, k, day = guildDay(S)) => 1 + GUILD.float * (2 * hash3(day + 7, ki(k) * 31, S.runSeed || 1) - 1);
const depthOf = k => GUILD.depth / RES[k].t; // 卖到这么多，价钱掉到三成七
const volOf = (S, k) => (guildOf(S).vol[k] || 0);
// 现在卖一个能换多少银币
const qyMul = S => 1 + gBuff(S, 'guild'); // 奇遇「迷路的商队」：一天里收价 +20%
export function sellPrice(S, k) { return basePrice(k) * floatOf(S, k) * qyMul(S) * Math.exp(-volOf(S, k) / depthOf(k)); }
// 卖 n 个一共换多少（越卖越便宜，按积分算）
export function sellValue(S, k, n) { const D = depthOf(k), v = volOf(S, k); return basePrice(k) * floatOf(S, k) * qyMul(S) * D * (Math.exp(-v / D) - Math.exp(-(v + n) / D)); }
export function guildSell(S, cid, k, n) {
  const c = guildCamp(S, cid); if (!c) return { ok: false, reason: '先在哪座营地盖一座商会驿站' };
  if (!tradable(S, k)) return { ok: false, reason: '商会不收这样东西' };
  n = Math.floor(Math.min(n, c.stock[k] || 0)); if (n < 1) return { ok: false, reason: `「${c.name}」没有${RES[k].n}可卖` };
  const v = sellValue(S, k, n), G = guildOf(S);
  c.stock[k] -= n; G.vol[k] = volOf(S, k) + n; G.silver += v;
  S.stats.sold = (S.stats.sold || 0) + v;
  return { ok: true, n, silver: v };
}
// 买：三倍底价（跟着当天浮动），每天每样有限量
export const buyPrice = (S, k) => basePrice(k) * floatOf(S, k) * GUILD.buyMul;
export const buyLeft = (S, k) => Math.max(0, (GUILD.buyLim[RES[k].t] || 0) - (guildOf(S).bought[k] || 0));
export function guildBuy(S, cid, k, n) {
  const c = guildCamp(S, cid); if (!c) return { ok: false, reason: '先在哪座营地盖一座商会驿站' };
  if (!tradable(S, k)) return { ok: false, reason: '商会不卖这样东西' };
  const G = guildOf(S), p = buyPrice(S, k);
  n = Math.floor(Math.min(n, buyLeft(S, k), G.silver / p));
  if (n < 1) return { ok: false, reason: buyLeft(S, k) < 1 ? `今天的${RES[k].n}卖完了，明天再来` : '银币不够' };
  G.silver -= n * p; G.bought[k] = (G.bought[k] || 0) + n; c.stock[k] = (c.stock[k] || 0) + n;
  return { ok: true, n, silver: n * p };
}
// 余烬：每天最多买 20，越往北越贵
export const emberPrice = S => GUILD.emberCost * Math.max(1, S.known);
export const emberLeft = S => Math.max(0, GUILD.emberDay - (guildOf(S).emb || 0));
export function buyEmbers(S, n) {
  if (!guildOn(S)) return { ok: false, reason: '先盖一座商会驿站' };
  const G = guildOf(S), p = emberPrice(S);
  n = Math.floor(Math.min(n, emberLeft(S), G.silver / p));
  if (n < 1) return { ok: false, reason: emberLeft(S) < 1 ? '今天的余烬买满了，明天再来' : '银币不够' };
  G.silver -= n * p; G.emb = (G.emb || 0) + n;
  S.meta.embers += n; S.meta.emberTotal = (S.meta.emberTotal || 0) + n;
  return { ok: true, n };
}
// 装饰图纸：买一次一直有效（记在存档的总进度里，下一次北行也能盖）
export const SHOP_DECOS = Object.keys(BLD).filter(t => BLD[t].shop);
export const shopHave = (S, t) => !!(S.meta.shop && S.meta.shop[t]);
export function buyDeco(S, t) {
  if (!guildOn(S)) return { ok: false, reason: '先盖一座商会驿站' };
  const d = BLD[t]; if (!d || !d.shop) return { ok: false, reason: '' };
  if (shopHave(S, t)) return { ok: false, reason: '已经买过了' };
  const G = guildOf(S); if (G.silver < d.shop) return { ok: false, reason: `还差 ${Math.ceil(d.shop - G.silver)} 银币` };
  G.silver -= d.shop; (S.meta.shop || (S.meta.shop = {}))[t] = 1;
  return { ok: true };
}
// 订单：每天 3 张（研究「商会合同」后 5 张），限时送一批货，给银币和余烬
export const orderMax = S => (techDone(S, 'guild') ? GUILD.ordersPro : GUILD.orders);
function newOrders(S, day) {
  const G = guildOf(S), want = orderMax(S) - G.orders.length; if (want <= 0) return;
  let ks = RES_KEYS.filter(k => tradable(S, k) && k !== 'game' && prodRate(S, k) > 0.05);
  if (!ks.length) ks = ['wood'];
  for (let i = 0; i < want; i++) {
    const h = hash3(day * 7 + i, 53, S.runSeed || 1), k = ks[Math.floor(h * ks.length) % ks.length];
    if (G.orders.some(o => o.k === k)) { if (ks.length > G.orders.length) { i--; ks = ks.filter(x => x !== k); continue; } }
    const days = 1 + ((day + i) % 3), mins = days * DAY_LEN / 60, rate = Math.max(prodRate(S, k), 0.5);
    const n = Math.max(10, Math.round(rate * mins * 0.6 / 10) * 10), t = RES[k].t;
    G.orders.push({ id: G.nid++, k, n, until: S.t + days * DAY_LEN, silver: Math.round(n * basePrice(k) * 2.2), emb: 1 + Math.floor(t / 2) });
  }
}
export function guildDeliver(S, cid, oid) {
  const c = guildCamp(S, cid), G = guildOf(S), o = G.orders.find(x => x.id === oid);
  if (!c || !o) return { ok: false, reason: '' };
  if ((c.stock[o.k] || 0) < o.n) return { ok: false, reason: `「${c.name}」的${RES[o.k].n}还差 ${Math.ceil(o.n - (c.stock[o.k] || 0))}` };
  c.stock[o.k] -= o.n; G.silver += o.silver; S.meta.embers += o.emb; S.meta.emberTotal = (S.meta.emberTotal || 0) + o.emb;
  G.orders = G.orders.filter(x => x !== o); S.stats.orders = (S.stats.orders || 0) + 1;
  return { ok: true, silver: o.silver, emb: o.emb };
}
// 每天：车队到了，价钱和限量重来，过期的订单撤掉、补上新的
export function guildStep(S) {
  if (!guildOn(S)) return;
  const G = guildOf(S), day = guildDay(S);
  if (G.day === day) return;
  const first = G.day < 0;
  G.day = day; G.vol = {}; G.bought = {}; G.emb = 0;
  G.orders = G.orders.filter(o => o.until > S.t);
  newOrders(S, day);
  if (!rt(S).offline) {
    const best = RES_KEYS.filter(k => tradable(S, k) && prodRate(S, k) > 0.05).sort((a, b) => floatOf(S, b) - floatOf(S, a))[0];
    logMsg(S, first ? '🛷 北方商会的车队第一次到了驿站：可以卖货换银币、接订单、买装饰图纸。生产 › 商会。' : `🛷 商会的车队到了：今天${best ? `「${RES[best].n}」价钱最好（${Math.round(floatOf(S, best) * 100)}%）` : '带来了新的价钱'}，订单 ${G.orders.length} 张。`, 'info', { act: 'guild', label: '去商会' });
  }
}
