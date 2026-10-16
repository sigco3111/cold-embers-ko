// 1.1 奇观 + 城镇
// 奇观：4×4，三期施工，每期几种材料一起喂（像烽火塔身），喂满一期进下一期。建成以后记在 S.wonder.list 里，
// 这一程一直有效、所有营地都算，营地熄火了也不丢。每种一程只能建一座，一座营地最多一座。
// 城镇：研究「城镇规划」后，营地人够多、希望够高，就能一级一级升成镇、城、大城（升了不会降）。
import { BLD, RES, DAY_LEN, WONDERS, WONDER_KEYS, WONDER_PH, WONDER_FX, TOWN, TOWN_FEST } from './data.js';
import { rt, dirty, getCamp, logMsg, techDone, cmdOn, addBuff, bumpMood, fuelKeep, storeCap } from './sim.js';
import { journeyOf } from './journey.js';
import { bpHave } from './north.js';

// ---------- 奇观 ----------
export const wonderOf = S => S.wonder || (S.wonder = { list: [] });
export const wonderList = S => wonderOf(S).list;
export const wonderOn = (S, w) => !!(S.wonder && S.wonder.list.some(x => x.w === w));
export const isWonder = type => !!(BLD[type] && BLD[type].wonder);
// 这座营地里的奇观（建好的或者还在施工的）
export const wonderIn = (S, cid) => S.buildings.find(b => b.camp === cid && isWonder(b.type)) || null;
export const wonderDone = b => !!(b && b.wd && b.wd.ph >= WONDER_PH.length);
export function wonderLock(S, type) {
  const W = WONDERS[type]; if (!W) return '不是奇观';
  if (!bpHave(S, type)) return `还没有「${W.n}」的图纸：研究「奇观图纸·${W.tech === 'wonder1' ? '一' : '二'}」，或在北境的分岔、奇遇里拿到`;
  if (wonderOn(S, type)) return `${W.n}这一程已经建过了`;
  const b = S.buildings.find(x => x.type === type);
  if (b) return `${W.n}已经在「${(getCamp(S, b.camp) || {}).name || '?'}」开工了`;
  return '';
}
// 第 ph 期要喂什么：每种的总量、每分钟多少（满速）、喂多久
export function wonderSpec(type, ph) {
  const W = WONDERS[type], P = WONDER_PH[ph]; if (!W || !P) return null;
  const amt = W.ph[ph], rate = {};
  for (const k in amt) rate[k] = amt[k] / P.dur * 60;
  return { ph, n: P.n, dur: P.dur, amt, rate, kinds: Object.keys(amt) };
}
// 施工快慢：万众一心 ×3，城 ×1.25
export const feedMul = (S, camp) => (cmdOn(S, 'unity', camp) ? 3 : 1) * ((camp && camp.town || 0) >= 2 ? TOWN[2].feed : 1);
// 搬运工要跑多少趟（像加工厂送料一样算）
export function wonderDem(S, b, distF) {
  if (!b.wd || wonderDone(b)) return 0;
  const sp = wonderSpec(b.type, b.wd.ph); if (!sp) return 0;
  let r = 0; for (const k of sp.kinds) r += sp.rate[k];
  return r / 60 * distF;
}
export function wonderFeed(S, b, dt, hf, offK, st, R, dem, fuelKeepU = 0) {
  const br = R.b[b.id] || (R.b[b.id] = {}), W = b.wd || (b.wd = { ph: 0, p: 0 });
  br.rate = {}; br.inRate = {}; br.want = {}; br.haul = 0; br.act = 0; br.staff = 1; br.dist = R.dist.get(b.id) || 0;
  const sp = wonderSpec(b.type, W.ph);
  if (!sp) { br.status = '建成了'; return; }
  if (b.moveT > S.t) { br.status = '在搬家'; return; }
  const camp = getCamp(S, b.camp), mul = feedMul(S, camp);
  const f = Math.min(dt * hf * offK * mul, sp.dur - W.p);
  let lim = 1, whyK = null;
  for (const k of sp.kinds) {
    const need = sp.rate[k] * f / 60; if (need <= 0) continue;
    const have = Math.max(0, (st[k] || 0) - fuelKeep(st, k, fuelKeepU));
    if (have < need && have / need < lim) { lim = have / need; whyK = k; }
  }
  for (const k of sp.kinds) {
    st[k] = Math.max(0, (st[k] || 0) - sp.rate[k] * f / 60 * lim);
    br.inRate[k] = sp.rate[k] * hf * mul * lim; br.want[k] = sp.rate[k] * hf * mul;
  }
  W.p = Math.min(sp.dur, W.p + f * lim);
  br.act = lim; br.haul = dem * hf * lim;
  br.status = lim < 0.95 ? (fuelKeep(st, whyK, fuelKeepU) > 0 && (st[whyK] || 0) > 0 ? '留燃料给熔炉' : `缺${RES[whyK].n}`) : hf < 0.7 ? '搬运工不够' : `${sp.n}中`;
  if (W.p >= sp.dur - 1e-6) wonderNext(S, b);
}
function wonderNext(S, b) {
  const W = b.wd, Wn = WONDERS[b.type], camp = getCamp(S, b.camp), s = BLD[b.type].size;
  W.ph++; W.p = 0;
  const R = rt(S);
  if (W.ph < WONDER_PH.length) {
    logMsg(S, `🏗️ ${Wn.n}「${WONDER_PH[W.ph - 1].n}」完工了，接着${WONDER_PH[W.ph].n}：${Object.entries(Wn.ph[W.ph]).map(([k, v]) => `${RES[k].n} ${v}`).join('、')}。`, 'good', { act: 'spot', arg: b.id, label: '去看看' });
    R.fx.push({ kind: 'wonder-ph', bid: b.id, ph: W.ph, x: b.x + s / 2, y: b.y + s / 2 });
    return;
  }
  const J = journeyOf(S);
  wonderList(S).push({ w: b.type, camp: b.camp, stage: J.stage, x: b.x + s / 2, y: b.y + s / 2, t: S.t, bid: b.id });
  const M = S.meta, D = M.wdone || (M.wdone = {}); D[b.type] = (D[b.type] || 0) + 1;
  M.wMax = Math.max(M.wMax || 0, wonderList(S).length);
  for (const c of S.camps) bumpMood(c, c.id === b.camp ? 10 : 4, -3);
  dirty(S);
  logMsg(S, `${Wn.ic}【${Wn.n}】在「${camp ? camp.name : '?'}」落成了！${Wn.d}。这一程一直有效，营地熄火了也不丢。`, 'story', { act: 'spot', arg: b.id, label: '去看看' });
  R.fx.push({ kind: 'wonder-done', bid: b.id, w: b.type, x: b.x + s / 2, y: b.y + s / 2 });
}
// 施工进度（0..1，按三期的时长加权）
export function wonderProg(b) {
  if (!b || !b.wd) return 0;
  let tot = 0, got = 0;
  WONDER_PH.forEach((P, i) => { tot += P.dur; if (i < b.wd.ph) got += P.dur; else if (i === b.wd.ph) got += b.wd.p; });
  return Math.min(1, got / tot);
}
// ---------- 奇观的效果 ----------
// 产量：蒸汽巨像所有建筑 +15%；星辰熔炉出永恒炉件、星核的建筑 +30%
export function wonderProd(S, b) {
  if (!S.wonder || !S.wonder.list.length) return 0;
  let v = 0;
  if (wonderOn(S, 'wcolossus')) v += WONDER_FX.prod;
  const out = BLD[b.type].out;
  if (out && (out.heart || out.starcore) && wonderOn(S, 'wstarforge')) v += WONDER_FX.star;
  return v;
}
export const wonderCap = S => (wonderOn(S, 'wvault') ? WONDER_FX.cap : 1);
export const wonderWarm = S => (wonderOn(S, 'wbeacon') ? WONDER_FX.warm : 0);
export const wonderFuel = S => (wonderOn(S, 'wbeacon') ? WONDER_FX.fuel : 1);
export const wonderRes = S => (wonderOn(S, 'waurora') ? 1 + WONDER_FX.res : 1);
export const wonderHope = S => (wonderOn(S, 'waurora') ? WONDER_FX.hope : 0);
export const wonderRoad = S => (wonderOn(S, 'wterminal') ? WONDER_FX.road : 1);
export const wonderTrip = S => (wonderOn(S, 'wterminal') ? WONDER_FX.trip : 1);
// 蒸汽巨像：每天替你吓退一次守不住的袭营
export function colossusScare(S) {
  if (!wonderOn(S, 'wcolossus')) return false;
  const day = Math.floor(S.t / DAY_LEN), W = wonderOf(S);
  if (W.scare === day) return false;
  W.scare = day; return true;
}
export const colossusReady = S => wonderOn(S, 'wcolossus') && wonderOf(S).scare !== Math.floor(S.t / DAY_LEN);

// ---------- 城镇 ----------
export const townOf = camp => Math.max(0, Math.min(TOWN.length - 1, (camp && camp.town) | 0));
export const townName = camp => TOWN[townOf(camp)].n;
export const townNext = camp => TOWN[townOf(camp) + 1] || null;
export function townBlock(S, camp) {
  const nx = townNext(camp); if (!nx) return '已经是大城了';
  if (!techDone(S, 'townplan')) return '先研究「城镇规划」';
  if (camp.depot) return '补给站升不了城镇';
  if (camp.people < nx.pop) return `要住满 ${nx.pop} 人（现在 ${camp.people}）`;
  if ((camp.hope ?? 50) < nx.need) return `希望要到 ${nx.need}（现在 ${Math.round(camp.hope ?? 50)}）`;
  return '';
}
export function townUp(S, cid) {
  const camp = getCamp(S, cid); if (!camp) return { ok: false, reason: '没有这个营地' };
  const why = townBlock(S, camp); if (why) return { ok: false, reason: why };
  const nx = townNext(camp);
  camp.town = townOf(camp) + 1;
  if (camp.town >= 3) camp.giftDay = Math.floor(S.t / DAY_LEN); // 第一份市政礼包明天送
  addBuff(S, camp, 'prod', -0.5, TOWN_FEST, `升${nx.n}典礼（大家都去看烟花了）`);
  bumpMood(camp, 10, -6);
  S.meta.town = Math.max(S.meta.town || 0, camp.town);
  dirty(S);
  logMsg(S, `🎆「${camp.name}」升成了${nx.n}！大家放下手里的活，围着熔炉看了一场烟花。${nx.d}。`, 'story');
  rt(S).fx.push({ kind: 'town', camp: camp.id, lvl: camp.town, x: camp.x, y: camp.y });
  return { ok: true, lvl: camp.town };
}
export const townBeds = camp => (townOf(camp) >= 1 ? 1 + TOWN[1].beds : 1);
export const townHope = camp => (townOf(camp) >= 1 ? TOWN[1].hope : 0);
export const townProd = camp => (townOf(camp) >= 2 ? TOWN[2].prod : 0);
export const townSpec = camp => (townOf(camp) >= 3 ? TOWN[3].spec : 1);
// 大城每天一份市政礼包：两种这一站用得上的中高级材料
const GIFT_KS = ['steel', 'gear', 'seal', 'engine', 'alloy', 'battery', 'part', 'core'];
export function townStep(S) {
  const day = Math.floor(S.t / DAY_LEN);
  for (const c of S.camps) {
    if (townOf(c) < 3 || c.giftDay === day) continue;
    c.giftDay = day;
    const ks = GIFT_KS.filter(k => RES[k].t <= S.known), got = [];
    for (let i = 0; i < 2 && ks.length; i++) {
      const k = ks.splice(Math.floor(((day * 7 + c.id * 13 + i * 5) % 97) / 97 * ks.length), 1)[0];
      const n = Math.round((RES[k].t >= 6 ? 40 : RES[k].t >= 5 ? 120 : 300) * (1 + 0.1 * Math.min(10, S.camps.length)));
      const add = Math.max(0, Math.min(n, storeCap(S, c) - (c.stock[k] || 0)));
      if (add > 0) { c.stock[k] = (c.stock[k] || 0) + add; got.push(`${RES[k].n} ${Math.round(add)}`); }
    }
    if (got.length && !rt(S).offline) logMsg(S, `🎁「${c.name}」的市政礼包到了：${got.join('、')}。`, 'good');
  }
}
// 物流网：奇观工地这一期还要的料，按十分钟的量往这儿送（也不往外调）
export function wonderNeeds(S, cid) {
  const out = {};
  for (const b of S.buildings) {
    if (b.camp !== cid || !b.wd || wonderDone(b)) continue;
    const sp = wonderSpec(b.type, b.wd.ph), left = 1 - b.wd.p / sp.dur;
    for (const k of sp.kinds) out[k] = (out[k] || 0) + Math.min(sp.amt[k] * left, sp.rate[k] * 10);
  }
  return out;
}
