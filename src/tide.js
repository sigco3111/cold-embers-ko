// 1.1 炉火鼎盛 + 永冬潮
// 炉火鼎盛：一座营地上的产线（至少两条）全都稳在三星水准，营地产量 +25%，炉火烧成金色；哪条线掉下来就熄，提醒里点名是哪条。
// 永冬潮：走到北境第 4 站以后，大约每 2 小时来一波，一波比一波冷。提前 2 天报（研究「永冬准备」提前 4 天），
// 持续一天半：气温再降、熔炉烧 2.5 倍燃料、户外采集变慢；最后一夜霜巨兽冲主营地。挺过去给余烬，第 5、10 波还有专属炉火和称号。
// 挺不过去：有人冻伤、几座建筑冻住一阵，不会输掉这一局。
import { BLD, RES, DAY_LEN } from './data.js';
import { rt, dirty, getCamp, logMsg, techDone, bumpMood, campDefense, raidStrength, trimWorkers } from './sim.js';
import { journeyOf, northN, mainCamp } from './journey.js';
import { plinesOf, lineTypes } from './lines.js';
import { colossusScare } from './wonder.js';
import { hash3 } from './worldgen.js';

// ---------- 炉火鼎盛 ----------
export const PEAK = { prod: 0.25, min: 2, grace: 90, settle: 20 };
const pkOf = c => c.pk || (c.pk = { on: 0, n: 0, miss: {} });
// 这座营地上的产线：营地里有这条线（连上游）的建筑
export function campLines(S, c) {
  const ts = new Set(); for (const b of S.buildings) if (b.camp === c.id) ts.add(b.type);
  return plinesOf(S).filter(l => { for (const t of lineTypes(l.r)) if (ts.has(t)) return true; return false; });
}
export const peakOn = (S, c) => !!(c && c.pk && c.pk.on);
export function peakProd(S, b) { const c = getCamp(S, b.camp); return peakOn(S, c) ? PEAK.prod : 0; }
// 一条线算不算「三星水准」：三星，速度在目标以上（掉下去 90 秒以内还算，免得一抖就熄）
function lineHold(S, P, l) {
  if (l.star < 3) { delete P.miss[l.id]; return false; }
  if (l.on) { delete P.miss[l.id]; return true; }
  if (P.miss[l.id] == null) P.miss[l.id] = S.t;
  return S.t - P.miss[l.id] < PEAK.grace;
}
const lineName = l => `${RES[l.r].n}${l.main ? '主线' : '支线'}`;
function whyOut(S, l) { return l.star < 3 ? `${lineName(l)}还是 ${l.star} 星` : `${lineName(l)}的速度掉到了目标以下`; }
// 面板用：这座营地的线、哪条还差、熄过一次是因为哪条
export function peakView(S, c) {
  const P = pkOf(c), L = campLines(S, c);
  return {
    on: !!P.on, n: P.n || 0, t0: P.t0, out: P.out || null, need: PEAK.min,
    lines: L.map(l => ({ id: l.id, r: l.r, star: l.star, on: !!l.on, main: !!l.main, n: l.n, slow: P.miss[l.id] != null ? S.t - P.miss[l.id] : 0 })),
  };
}
function peakStep(S) {
  for (const c of S.camps) {
    const P = pkOf(c), L = campLines(S, c);
    const bad = L.find(l => !lineHold(S, P, l));
    const all = L.length >= PEAK.min && !bad;
    if (all) { if (P.ok == null) P.ok = S.t; } else P.ok = null;
    if (!P.on && all && S.t - P.ok >= PEAK.settle) {
      P.on = 1; P.t0 = S.t; P.n = (P.n || 0) + 1; P.out = null;
      S.meta.peakN = (S.meta.peakN || 0) + 1;
      dirty(S);
      logMsg(S, `🔥 「${c.name}」炉火鼎盛！这里的 ${L.length} 条产线全稳在三星：营地产量 +${PEAK.prod * 100}%，炉火烧成了金色。`, 'good', { act: 'campgo', arg: c.id, label: '看看' });
      rt(S).fx.push({ kind: 'peak', camp: c.id, first: P.n === 1, x: c.x, y: c.y });
    } else if (P.on && !all) {
      P.on = 0; P.out = { t: S.t, r: bad ? bad.r : null, why: bad ? whyOut(S, bad) : `产线不到 ${PEAK.min} 条` };
      dirty(S);
      logMsg(S, `「${c.name}」的炉火鼎盛熄了：${P.out.why}。补回三星水准，金色的火会再烧起来。`, 'warn', bad ? { act: 'plan', arg: bad.r, label: '看产线' } : undefined);
      rt(S).fx.push({ kind: 'peakoff', camp: c.id });
    }
  }
}
// 炉火颜色：鼎盛的营地没换过颜色的话烧成金色
export function peakFlame(S, c, id) { return id === 'def' && peakOn(S, c) ? 'gold' : id; }

// ---------- 永冬潮 ----------
export const TIDE = { from: 4, first: 4 * DAY_LEN, every: 10 * DAY_LEN, len: 1.5 * DAY_LEN, lead: 2 * DAY_LEN, leadPrep: 4 * DAY_LEN, fuel: 2.5, drop: 8, dropW: 2, dropMax: 30, gather: 0.6, gatherSuit: 0.75, embers: 20, hope: 6, frz: 600, sick: 0.08, warn: 120 };
export const tideLead = S => (techDone(S, 'wintprep') ? TIDE.leadPrep : TIDE.lead);
export const tideDrop = n => Math.min(TIDE.dropMax, TIDE.drop + TIDE.dropW * (n - 1));
export const tideGather = S => (techDone(S, 'thermal') ? TIDE.gatherSuit : TIDE.gather);
export const tideOf = S => S.tide || null;
// 第 n 波什么时候来（按种子前后错开半天以内）
export function tideStart(S, n) { return S.tide.t0 + TIDE.first + (n - 1) * TIDE.every + (hash3(n, 211, S.runSeed) - 0.5) * DAY_LEN; }
// 霜巨兽：这一波最后一个夜里（入夜后不久）
export function beastAt(start) {
  const end = start + TIDE.len;
  let d = Math.floor(end / DAY_LEN), t = d * DAY_LEN + 0.66 * DAY_LEN;
  if (t > end - 0.05 * DAY_LEN) t -= DAY_LEN;
  return t >= start ? t : end - 0.1 * DAY_LEN;
}
export function beastStr(S, camp, n) { return Math.round(raidStrength(S, camp, { var: 0.5 }) * (1.6 + 0.2 * (n - 1)) * (techDone(S, 'wintprep') ? 0.8 : 1)); }
// 眼下或下一波：on 正在潮里；fc 已经报出来了
export function tideAt(S, t = S.t) {
  const C = S.tide; if (!C) return null;
  let n = Math.max(1, Math.floor((t - C.t0 - TIDE.first) / TIDE.every) + 1), s = tideStart(S, n);
  if (t >= s + TIDE.len) { n++; s = tideStart(S, n); }
  else if (t < s && n > 1) { const p = tideStart(S, n - 1); if (t < p + TIDE.len) { n--; s = p; } }
  const on = t >= s && t < s + TIDE.len;
  return { n, on, start: s, end: s + TIDE.len, left: s + TIDE.len - t, inSec: s - t, fc: !on && s - t <= tideLead(S), beastT: beastAt(s), drop: tideDrop(n) };
}
export function tideNow(S) { const z = S.tide ? tideAt(S) : null; return z && z.on ? z : null; }
// 这一波的霜巨兽打得过打不过（主营地的防御对巨兽的强度）
export function beastView(S, z) {
  const c = mainCamp(S); if (!c || !z) return null;
  const str = beastStr(S, c, z.n), def = campDefense(S, c);
  const C = S.tide, done = C && C.bt === z.n;
  return { camp: c.id, name: c.name, str, def, at: z.beastT, in: z.beastT - S.t, done, won: done ? C.bw === 1 : null };
}
function tideStep(S) {
  const J = journeyOf(S);
  if (!S.tide) { if (northN(J.stage) >= TIDE.from) S.tide = { t0: S.t }; else return; }
  const C = S.tide, z = tideAt(S); if (!z) return;
  // 上一波过去了：结算
  if (C.on != null && C.end !== C.on && S.t >= tideStart(S, C.on) + TIDE.len) { C.end = C.on; tideEnd(S, C.on); }
  if (!z.on && z.fc && C.fc !== z.n) {
    C.fc = z.n;
    logMsg(S, `🌌 永冬潮预报：第 ${z.n} 波约 ${Math.max(1, Math.round(z.inSec / 60))} 分钟后到，持续一天半：气温再降 ${z.drop}°，熔炉烧 ${TIDE.fuel} 倍燃料，户外采集变慢；最后一夜霜巨兽会冲主营地。物流网会先给每座营地备燃料。`, 'warn', { act: 'wx', label: '看看' });
  }
  if (z.on && C.on !== z.n) {
    C.on = z.n; C.hit = {}; C.bw = null;
    S.stats.tide = (S.stats.tide || 0) + 1;
    logMsg(S, `🌌 永冬潮第 ${z.n} 波来了！一天半里气温再降 ${z.drop}°，熔炉烧 ${TIDE.fuel} 倍燃料，户外采集只剩 ${Math.round(tideGather(S) * 100)}%。最后一夜霜巨兽会来。`, 'bad', { act: 'wx', label: '看看' });
    rt(S).fx.push({ kind: 'tide', n: z.n });
  }
  if (z.on && C.on === z.n && C.bt !== z.n) {
    const left = z.beastT - S.t;
    if (left <= TIDE.warn && C.bwarn !== z.n) {
      C.bwarn = z.n; const v = beastView(S, z);
      if (v) logMsg(S, `🧊 霜巨兽从冰原那头走过来了，直奔「${v.name}」（强度 ${v.str}，防御 ${v.def}）。${v.def >= v.str ? '箭塔够它受的。' : '防御不够：多建箭塔，或者靠蒸汽巨像吓走它。'}`, 'warn', { act: 'wx', label: '看看' });
    }
    if (S.t >= z.beastT) { C.bt = z.n; beastAttack(S, z); }
  }
}
// 霜巨兽冲主营地：守住了没事；守不住，几座建筑冻住一阵、有人冻伤（不死人）
function beastAttack(S, z) {
  const C = S.tide, camp = mainCamp(S), R = rt(S);
  if (!camp || camp.people <= 0) { C.bw = 1; return; }
  const str = beastStr(S, camp, z.n), def = campDefense(S, camp);
  const guard = def < str && S.buildings.find(b => b.camp === camp.id && b.type === 'colossus' && b.workers > 0 && !(b.cd > S.t));
  if (def >= str || guard || colossusScare(S)) {
    C.bw = 1; bumpMood(camp, 4, -2);
    if (guard) guard.cd = S.t + BLD.colossus.guardCd / (1 + 0.15 * (guard.lvl - 1));
    const how = def >= str ? `箭塔一轮轮射过去（${def} 对 ${str}）` : guard ? '巨像守卫站起来挡在门口' : '蒸汽巨像拉响汽笛、喷出一大团白汽';
    logMsg(S, `🧊 霜巨兽冲到了「${camp.name}」外面，${how}，它退回了冰原。`, 'good');
    R.fx.push({ kind: 'raid', camp: camp.id, won: true, str, def: Math.max(def, str), t: S.t, beast: 1 });
    return;
  }
  C.bw = 0;
  const k = Math.min(6, 2 + Math.floor(z.n / 2));
  const cand = S.buildings.filter(b => b.camp === camp.id && BLD[b.type].out && !BLD[b.type].wonder && !(b.frz > S.t));
  cand.sort((a, b) => hash3(a.id, z.n, 223) - hash3(b.id, z.n, 223));
  const froze = cand.slice(0, k);
  for (const b of froze) b.frz = S.t + TIDE.frz;
  const hurt = Math.max(1, Math.round(camp.people * TIDE.sick));
  camp.sick = Math.min(camp.people * 0.3, (camp.sick || 0) + hurt);
  bumpMood(camp, -8, 6); trimWorkers(S, camp); dirty(S);
  logMsg(S, `🧊 霜巨兽闯进了「${camp.name}」（防御 ${def} 对 ${str}）：${froze.length ? `${[...new Set(froze.map(b => BLD[b.type].n))].join('、')}被冻住了 ${TIDE.frz / 60} 分钟，` : ''}${hurt} 人冻伤病倒。没人遇难，冰化了就好。`, 'bad');
  R.fx.push({ kind: 'raid', camp: camp.id, won: false, str, def, t: S.t, beast: 1 });
}
function tideEnd(S, n) {
  const C = S.tide, live = S.camps.filter(x => x.people > 0), hit = live.filter(x => (C.hit || {})[x.id]), ok = live.filter(x => !(C.hit || {})[x.id]);
  for (const x of ok) bumpMood(x, TIDE.hope, 0);
  const win = !hit.length && C.bw !== 0;
  S.meta.tideMax = Math.max(S.meta.tideMax || 0, n);
  if (win) {
    const e = TIDE.embers * n;
    S.meta.embers += e; S.meta.emberTotal = (S.meta.emberTotal || 0) + e;
    S.meta.tideBest = Math.max(S.meta.tideBest || 0, n);
    S.stats.tideOk = (S.stats.tideOk || 0) + 1;
    logMsg(S, `🌌 永冬潮第 ${n} 波过去了，所有营地都挺住了：余烬 +${e}，每座营地希望 +${TIDE.hope}。${n >= 10 ? '十波永冬都没能熄掉这团火。' : n >= 5 ? '第五波都挺过来了，北境记住了这团火。' : ''}`, 'good');
  } else {
    const why = [hit.length && `${hit.map(x => `「${x.name}」`).join('')}有人冻伤`, C.bw === 0 && '霜巨兽闯进了主营地'].filter(Boolean).join('，');
    logMsg(S, `🌌 永冬潮第 ${n} 波过去了。${why}，这一波没有余烬。下一波更冷：早点备燃料、升级帐篷保暖、多建箭塔。`, 'warn');
  }
  rt(S).fx.push({ kind: 'tide-end', n, win });
}
// 冻住的建筑：霜巨兽闯进来以后，几座产出建筑停工一阵
export const frozenB = (S, b) => b.frz > S.t;

export function seasonStep(S) { peakStep(S); tideStep(S); }
