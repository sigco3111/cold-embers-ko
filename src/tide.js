// 1.1 炉火鼎盛 + 永冬潮
// 炉火鼎盛：一座营地上的产线（至少两条）全都稳在三星水准，营地产量 +25%，炉火烧成金色；哪条线掉下来就熄，提醒里点名是哪条.
// 永冬潮：走到北境第 4 站以后，大约每 2 小时来一波，一波比一波冷.提前 2 天报（研究「永冬准备」提前 4 天），
// 持续一天半：气温再降、熔炉烧 2.5 倍燃料、户外采集变慢；最后一夜霜巨兽冲主营地.挺过去给余烬，第 5、10 波还有专属炉火和称号.
// 挺不过去：有人冻伤、几座建筑冻住一阵，不会输掉这一局.
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
const lineName = l => `${RES[l.r].n}${l.main ? '본선' : '지선'}`;
function whyOut(S, l) { return l.star < 3 ? `${lineName(l)} 또는 ${l.star}개의 별` : `${lineName(l)}의 속도가 목표보다 떨어졌습니다.`; }
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
      logMsg(S, `🔥 「${c.name}」이(가) 한창 진행 중입니다! 여기의 ${L.length} 생산 라인은 삼성에서 모두 안정적입니다: 야영지생산량 +${PEAK.prod * 100}%, 용광로는 금색으로 불타버렸습니다.`, 'good', { act: 'campgo', arg: c.id, label: '보기' });
      rt(S).fx.push({ kind: 'peak', camp: c.id, first: P.n === 1, x: c.x, y: c.y });
    } else if (P.on && !all) {
      P.on = 0; P.out = { t: S.t, r: bad ? bad.r : null, why: bad ? whyOut(S, bad) : `${PEAK.min} 미만 생산 라인` };
      dirty(S);
      logMsg(S, `"${c.name}"의 불이 꺼졌습니다: ${P.out.why}. 삼성 수준을 만회하기 위해 금색의 불이 다시 타오를 것입니다.`, 'warn', bad ? { act: 'plan', arg: bad.r, label: '생산라인을 살펴보세요' } : undefined);
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
    logMsg(S, `🌌 영동조 예측: 첫 번째 ${z.n} 파도는 약 ${Math.max(1, Math.round(z.inSec / 60))}분 후에 도달하고 하루 반 동안 지속됩니다. 온도는 ${z.drop}° 더 떨어지고, 용광로는 연료의 ${TIDE.fuel}배를 태울 것이며, 실외 채집은 속도가 느려질 것입니다. 서리 괴물은 어젯밤에 본영으로 돌진할 것입니다. 물류망은 먼저 각 야영지에 대해 연료를 준비합니다.`, 'warn', { act: 'wx', label: '보기' });
  }
  if (z.on && C.on !== z.n) {
    C.on = z.n; C.hit = {}; C.bw = null;
    S.stats.tide = (S.stats.tide || 0) + 1;
    logMsg(S, `🌌 영동조 Wave ${z.n}이(가) 왔습니다! 하루 반 만에 온도가 ${z.drop}° 더 떨어졌고, 용광로는 연료보다 ${TIDE.fuel}배 더 많이 연소되었으며 실외 채집은 ${Math.round(tideGather(S) * 100)}%만 남았습니다. 서리 짐승은 어젯밤에 올 것이다.`, 'bad', { act: 'wx', label: '보기' });
    rt(S).fx.push({ kind: 'tide', n: z.n });
  }
  if (z.on && C.on === z.n && C.bt !== z.n) {
    const left = z.beastT - S.t;
    if (left <= TIDE.warn && C.bwarn !== z.n) {
      C.bwarn = z.n; const v = beastView(S, z);
      if (v) logMsg(S, `🧊 서리 거인은 빙원 반대편에서 다가와 "${v.name}"(강도 ${v.str}, 방어 ${v.def})을 향해 직진했습니다. ${v.def >= v.str ? '화살탑이면 충분합니다.' : '방어로는 충분하지 않습니다. 화살탑를 더 구축하거나 증기 거상로 겁을 주어 쫓아내세요.'}`, 'warn', { act: 'wx', label: '보기' });
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
    const how = def >= str ? `화살탑은 라운드 후 라운드를 슛합니다(${def} 대 ${str}).` : guard ? '거상 수호자가 일어나 문을 막았다.' : '증기 거상이 휘파람을 불며 커다란 흰 증기를 뿜어냈다.';
    logMsg(S, `🧊 서리괴수는 "${camp.name}", ${how} 밖으로 달려나가 빙원으로 후퇴했습니다.`, 'good');
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
  logMsg(S, `🧊 서리 괴물이 "${camp.name}"에 들이닥쳤습니다(방어 ${def} 대 강도 ${str}). ${froze.length ? `${[...new Set(froze.map(b => BLD[b.type].n))].join('、')}이(가) ${TIDE.frz / 60}분간 얼어붙고, ` : ''}${hurt}명이 동상으로 쓰러졌습니다. 사망자는 없으며 얼음이 녹으면 괜찮아집니다.`, 'bad');
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
    logMsg(S, `🌌 영동조의 ${n} 파동이 통과되었으며 모든 야영지가 살아 남았습니다. 잔불 +${e}, 각 야영지희망 +${TIDE.hope}. ${n >= 10 ? '영원한 겨울의 10번의 파도가 이 화재를 진압하는데 실패했습니다.' : n >= 5 ? '다섯 번째 공격에서 살아남은 후 북방는 이 화재를 기억했습니다.' : ''}`, 'good');
  } else {
    const why = [hit.length && `${hit.map(x => `「${x.name}」`).join('')}에서 동상 환자 발생`, C.bw === 0 && '서리 괴물이 본영에 침입했습니다.'].filter(Boolean).join(',');
    logMsg(S, `🌌 영동조 ${n}번째 웨이브가 지났습니다. ${why}, 이 웨이브에는 잔불이 없습니다. 다음 파도는 더 추울 것입니다. 연료 및 업그레이드천막을 일찍 준비하여 따뜻하게 유지하고 더 많은 화살탑을 구축하십시오.`, 'warn');
  }
  rt(S).fx.push({ kind: 'tide-end', n, win });
}
// 冻住的建筑：霜巨兽闯进来以后，几座产出建筑停工一阵
export const frozenB = (S, b) => b.frz > S.t;

export function seasonStep(S) { peakStep(S); tideStep(S); }
