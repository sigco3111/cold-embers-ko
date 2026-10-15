// 地图生成：地标与资源纬度固定，地形与细节每轮随机
import { SPOTS, SPOT_KEYS, LANDMARKS, SPECS, FAR_MARKS, tierOfRow, SPINE_ROW, NORTH_GAP, NORTH_RULE_KEYS, NORTH_MARKS, NORTH_NAME_A, NORTH_NAME_B, RICH_KINDS } from './data.js';

export const W = 48;
// 地图先生成 1000 行（世界之脊在 800 行），走进北境以后按段往北接，每段 400 行。
// H 是现在已经生成到的行数：同一个种子每次接出来的地形都一样，存档里只记生成到哪一行
export const BASE_H = 1000, SEG_H = 400;
export let H = BASE_H;
export function setRows(n) { H = Math.max(BASE_H, BASE_H + SEG_H * Math.ceil(((n | 0) - BASE_H) / SEG_H)); return H; }
// 要看到第 y 行（再往北留 60 行）地图得生成到多少行
export const rowsFor = y => Math.max(BASE_H, BASE_H + SEG_H * Math.ceil((y + 60 - BASE_H) / SEG_H));
export const T_SNOW = 0, T_ROCK = 1, T_ICE = 2;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash3(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function valueNoise(seed, x, y, scale) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash3(x0, y0, seed), b = hash3(x0 + 1, y0, seed);
  const c = hash3(x0, y0 + 1, seed), d = hash3(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

const cache = new Map();
export function getWorld(seed) {
  let w = cache.get(seed);
  if (!w || w.rows > H) { cache.clear(); w = genWorld(seed); cache.set(seed, w); }
  while (w.rows < H) genSegment(w);
  return w;
}

// ---------- 北境的站：位置、名字、地貌规则只由种子决定（还没生成到的段也能先算出来） ----------
const NS = { seed: null, list: [], names: null, bag: [], rr: null };
export function northStop(seed, k) {
  if (!(k >= 1)) return null;
  if (NS.seed !== seed) {
    NS.seed = seed; NS.list = []; NS.bag = [];
    // 站名：前半个字轮完一圈才重复，前后两半的搭配整局不重复
    const r = mulberry32(seed * 97 + 3), shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const A = shuf(NORTH_NAME_A), B = shuf(NORTH_NAME_B), nA = A.length, nB = B.length;
    NS.names = Array.from({ length: nA * nB }, (_, i) => A[i % nA] + B[(Math.floor(i / nA) + i % nA) % nB]);
    NS.rr = mulberry32(seed * 131 + 17);
  }
  const L = NS.list;
  while (L.length < k) {
    const n = L.length + 1, prev = L[n - 2];
    // 第 1 站固定平坦雪原；之后十条规则装一袋轮流抽，抽完再装，连着两站不重复
    let rule = 'flat';
    if (n > 1) {
      if (!NS.bag.length) {
        const b = NORTH_RULE_KEYS.slice();
        for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(NS.rr() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
        if (b[0] === prev.rule) b.push(b.shift());
        NS.bag = b;
      }
      rule = NS.bag.shift();
    }
    const mark = (n - 1) % NORTH_MARKS.length;
    const p = { k: n, y: SPINE_ROW + NORTH_GAP * n + Math.round((hash3(n, 91, seed) - 0.5) * 10), x: 24 + Math.round((hash3(n, 92, seed) - 0.5) * 16), name: NS.names[(n - 1) % NS.names.length], rule, mark, r: NORTH_MARKS[mark].r };
    if (rule === 'rich') p.rich = RICH_KINDS[Math.floor(hash3(n, 93, seed) * RICH_KINDS.length) % RICH_KINDS.length];
    L.push(p);
  }
  return L[k - 1];
}
// 北境第几站离第 y 行最近（往南找）
export function northAt(seed, y) { if (y < SPINE_ROW + NORTH_GAP / 2) return null; let k = Math.max(1, Math.round((y - SPINE_ROW) / NORTH_GAP)); while (k > 1 && northStop(seed, k).y - NORTH_GAP / 2 > y) k--; while (northStop(seed, k + 1).y - NORTH_GAP / 2 <= y) k++; return northStop(seed, k); }
// 新营地大概扎在哪：地标南边几格
export const northCampAt = s => ({ x: s.x + 0.5, y: s.y + 0.5 - s.r - 4.5 });
const RAW_BASE = ['tree', 'tree', 'tree', 'tree', 'rock', 'rock', 'rock', 'herd', 'herd'];
// 矿：会挖完、不长回来的那几种（北境地貌专有的不算）
export const ORE_KEYS = SPOT_KEYS.filter(k => !['tree', 'rock', 'herd'].includes(k) && !SPOTS[k].nw);
const SK = k => SPOT_KEYS.indexOf(k);
const spotVal = (key, y, f = 1) => Math.round(SPOTS[key].reserve * (1 + Math.min(y, SPINE_ROW) / 160) * f);
// 一站的地面：地标周围铲平、营地那块搬走石头，按地貌规则改一改，再保证暖圈里每种原料都有（这些不消耗主随机数）
function placeNorth(w, s) {
  const { terrain, spot, spotInit, seed } = w, mx = s.x + 0.5, my = s.y + 0.5, c = northCampAt(s);
  for (let y = Math.floor(my - s.r - 3); y <= my + s.r + 3; y++) for (let x = Math.max(1, Math.floor(mx - s.r - 3)); x <= Math.min(W - 2, mx + s.r + 3); x++) {
    const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my), j = idx(x, y);
    if (d < s.r + 2.5) terrain[j] = T_SNOW;
    if (d < s.r + 1.5) spot[j] = -1;
  }
  for (let y = Math.floor(c.y - 6); y <= c.y + 6; y++) for (let x = Math.max(0, Math.floor(c.x - 6)); x <= Math.min(W - 1, c.x + 6); x++) {
    const i = idx(x, y);
    if (terrain[i] !== T_SNOW && Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < 5.5 && Math.min(x, W - 1 - x) >= 2) terrain[i] = T_SNOW;
  }
  const lm = (x, y) => Math.hypot(x + 0.5 - mx, y + 0.5 - my) < s.r + 1.8;
  const need = s.rule === 'tundra' ? RAW_BASE.map(k => k === 'tree' ? 'dead' : k) : RAW_BASE.slice();
  for (const k of ORE_KEYS) need.push(k, k);
  ruleGround(w, s, c, need, lm);
  ensureNear(seed + 5000 + s.k, terrain, spot, spotInit, Math.floor(c.x), Math.floor(c.y), need, 4, 11, SPINE_ROW, lm);
  if (s.rule === 'rich') { const rk = SK(s.rich); for (let y = Math.floor(c.y - 32); y <= c.y + 32; y++) for (let x = 0; x < W; x++) { const i = idx(x, y); if (y >= 0 && y < terrain.length / W && spot[i] === rk && Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) <= 32) spotInit[i] *= 3; } }
  if (s.rule === 'lakes') fishSpots(w, s, c, lm);
  if (s.rule === 'ruins') ruinSpots(w, s, c, lm);
}
// 地貌规则改地面：只动这一站营地周围，用自己的随机数（同一个种子每次一样）
function ruleGround(w, s, c, need, lm) {
  const { terrain, spot, spotInit, seed } = w, rr = mulberry32(seed * 389 + s.k * 7 + 1);
  const each = (R, fn) => {
    for (let y = Math.floor(c.y - R); y <= c.y + R; y++) for (let x = 1; x < W - 1; x++) {
      if (y < 0 || y >= terrain.length / W || Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) > R) continue;
      fn(idx(x, y), x, y);
    }
  };
  const key = i => spot[i] >= 0 ? SPOT_KEYS[spot[i]] : null;
  switch (s.rule) {
    case 'flat': // 暖圈里铲平：岩石、冰湖变雪地；矿点少一半（保底的后面照放）；营地边上的树和石头也稀一些
      each(17, (i, x, y) => {
        if (terrain[i] !== T_SNOW && Math.min(x, W - 1 - x) >= 2) terrain[i] = T_SNOW;
        const k = key(i), d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
        if (k && ORE_KEYS.includes(k) && rr() < 0.5) spot[i] = -1;
        else if ((k === 'tree' || k === 'rock') && d < 9 && rr() < 0.6) spot[i] = -1;
      });
      break;
    case 'geo': // 煤和油页岩减半
      each(32, i => { const k = key(i); if ((k === 'coal' || k === 'shale') && rr() < 0.5) spot[i] = -1; });
      break;
    case 'rich': // 一种矿储量 ×3（保底的放完再乘），再多放一片
      need.push(s.rich);
      break;
    case 'tundra': { // 没有活树：树都成了枯木堆；石头和矿多一些
      const dk = SK('dead');
      each(32, (i, x, y) => { if (key(i) === 'tree') { spot[i] = dk; spotInit[i] = spotVal('dead', y, 0.7 + rr() * 0.6); } });
      need.push('dead', 'rock', 'rock', 'rock');
      for (const k of ORE_KEYS) need.push(k);
      break;
    }
    case 'meteor': // 星核石多两片
      need.push('starfall', 'starfall');
      break;
    case 'lakes': { // 营地周围冒出几片冰湖（熔炉那块不动）
      const n = 7;
      for (let b = 0; b < n; b++) {
        const a = rr() * Math.PI * 2, d = 7 + rr() * 9, bx = c.x + Math.cos(a) * d, by = c.y + Math.sin(a) * d, br = 1.6 + rr() * 1.6;
        each(17, (i, x, y) => {
          const q = Math.hypot(x + 0.5 - bx, (y + 0.5 - by) * 1.2);
          if (q > br + (hash3(x, y, seed + 7) - 0.5) * 0.9) return;
          if (Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < 6.5 || lm(x, y) || Math.min(x, W - 1 - x) < 2) return;
          terrain[i] = T_ICE; spot[i] = -1;
        });
      }
      break;
    }
  }
}
// 冰钓点：冰湖边上（挨着雪地的冰面），离营地 4 到 14 格
function fishSpots(w, s, c, lm) {
  const { terrain, spot, spotInit, seed } = w, fk = SK('fish'), cand = [];
  for (let y = Math.floor(c.y - 14); y <= c.y + 14; y++) for (let x = 2; x < W - 2; x++) {
    const i = idx(x, y), d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
    if (d < 4 || d > 14 || terrain[i] !== T_ICE || spot[i] >= 0 || lm(x, y)) continue;
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => terrain[idx(x + dx, y + dy)] === T_SNOW);
    if (shore) cand.push([hash3(x, y, seed + 31), i, y]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const used = [];
  for (const [, i, y] of cand) {
    const x = i % W;
    if (used.some(([ux, uy]) => Math.hypot(ux - x, uy - y) < 3)) continue;
    spot[i] = fk; spotInit[i] = spotVal('fish', y); used.push([x, y]);
    if (used.length >= 7) break;
  }
}
// 古城废墟：暖圈里散着几处断墙（每处 2 到 4 格），熔炉那块和地标周围不放
function ruinSpots(w, s, c, lm) {
  const { terrain, spot, spotInit, seed } = w, rk = SK('ruin'), rr = mulberry32(seed * 433 + s.k * 11 + 5);
  const shapes = [[[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0]]];
  let n = 0;
  for (let tries = 0; tries < 400 && n < 8; tries++) {
    const a = rr() * Math.PI * 2, d = 5 + rr() * 8, x0 = Math.round(c.x + Math.cos(a) * d), y0 = Math.round(c.y + Math.sin(a) * d);
    const sh = shapes[Math.floor(rr() * shapes.length)];
    const tiles = sh.map(([dx, dy]) => [x0 + dx, y0 + dy]);
    const bad = tiles.some(([x, y]) => {
      if (x < 2 || x > W - 3 || lm(x, y) || Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) < 4.5) return true;
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) { const j = idx(xx, yy); if (spot[j] === rk || (spot[j] >= 0 && SPOT_KEYS[spot[j]] !== 'tree' && SPOT_KEYS[spot[j]] !== 'rock')) return true; }
      return terrain[idx(x, y)] === T_ROCK;
    });
    if (bad) continue;
    for (const [x, y] of tiles) { const i = idx(x, y); terrain[i] = T_SNOW; spot[i] = rk; spotInit[i] = 1; }
    n++;
  }
}
// 离北境站的地标或营地太近（放地点、兴趣点时避开）
function nearNorth(seed, x, y, r) {
  for (let k = Math.max(1, Math.floor((y - SPINE_ROW) / NORTH_GAP) - 1); k >= 1; k++) {
    const s = northStop(seed, k); if (s.y - y > 40) return false;
    if (Math.hypot(x - s.x, y - s.y) <= s.r + r) return true;
    const c = northCampAt(s); if (Math.hypot(x - c.x, y - c.y) <= 4 + r * 0.5) return true;
  }
  return false;
}
// 接着往北生成一段（同一个种子、同一段，每次结果一样）
function genSegment(w) {
  const seed = w.seed, y0 = w.rows, y1 = y0 + SEG_H, N1 = W * y1, seg = (y0 - BASE_H) / SEG_H;
  const grow = (A, T, fill) => { const a = new T(N1); if (fill != null) a.fill(fill); a.set(A); return a; };
  w.terrain = grow(w.terrain, Uint8Array); w.height = grow(w.height, Float32Array); w.spot = grow(w.spot, Int8Array, -1); w.spotInit = grow(w.spotInit, Float32Array);
  const { terrain, height, spot, spotInit } = w, rnd = mulberry32(seed * 7919 + 1009 * (seg + 1) + 13);
  const stops = [];
  for (let k = 1; ; k++) { const s = northStop(seed, k); if (s.y >= y1) break; if (s.y >= y0) stops.push(s); }
  const nearStop = (x, y, r) => stops.some(s => (x - s.x) ** 2 + (y - s.y) ** 2 <= (s.r + r) ** 2);
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), n = valueNoise(seed, x, y, 9) * 0.7 + valueNoise(seed + 77, x, y, 4) * 0.3;
    height[i] = n;
    let t = T_SNOW;
    if (n > 0.74 || (Math.min(x, W - 1 - x) < 2 && n > 0.5)) t = T_ROCK;
    else if (valueNoise(seed + 991, x, y, 7) > 0.8) t = T_ICE;
    if (nearStop(x, y, 4)) t = T_SNOW;
    terrain[i] = t;
  }
  // 资源点：和永恒之炉以北一样的密度，储量按世界之脊那一行算（越往北不再越多）
  for (let y = y0; y < y1; y++) for (let x = 1; x < W - 1; x++) {
    const i = idx(x, y);
    if (terrain[i] !== T_SNOW || nearStop(x, y, 1)) continue;
    for (let k = SPOT_KEYS.length - 1; k >= 0; k--) {
      const key = SPOT_KEYS[k], s = SPOTS[key];
      if (y < s.from) continue;
      let dens = s.dens;
      if (key === 'tree') dens *= 1.6 * valueNoise(seed + 5, x, y, 6) * 0.15;
      else if (key === 'herd') dens *= 0.12;
      else if (key === 'shard') dens = 0.025;
      else dens *= 0.6 + 0.8 * valueNoise(seed + 31 * (k + 1), x, y, 8);
      if (rnd() < dens) { spot[i] = k; spotInit[i] = Math.round(s.reserve * (0.7 + rnd() * 0.6) * (1 + SPINE_ROW / 160)); break; }
    }
  }
  for (const s of stops) placeNorth(w, s);
  // 兴趣点和雾里的地点：避开站点
  let pid = w.pois.reduce((a, p) => Math.max(a, p.id), -1) + 1, sid = w.sites.reduce((a, p) => Math.max(a, p.id), -1) + 1;
  for (let y = y0 + 4; y < y1 - 6; y += 9) {
    const r = rnd(), x = 3 + Math.floor(rnd() * (W - 6)), yy = y + Math.floor(rnd() * 6);
    if (terrain[idx(x, yy)] !== T_SNOW || spot[idx(x, yy)] >= 0 || nearNorth(seed, x, yy, 3)) continue;
    if (r < 0.5) w.pois.push({ id: pid++, kind: 'survivors', x, y: yy, n: 4 + Math.floor(rnd() * 5 + SPINE_ROW / 30) });
    else if (r < 0.9) w.pois.push({ id: pid++, kind: 'cache', x, y: yy, tier: 7 });
  }
  const r2 = mulberry32(seed * 31 + 7 + 101 * (seg + 1)), kinds = ['train', 'lab', 'wreck', 'camp', 'shrine', 'lab'];
  for (let y = y0 + 4; y < y1 - 10; y += 20) {
    const kind = kinds[Math.floor(r2() * kinds.length)];
    for (let tries = 0; tries < 30; tries++) {
      const x = 4 + Math.floor(r2() * (W - 8)), yy = y + Math.floor(r2() * 12);
      let bad = false;
      for (let dy = -2; dy <= 2 && !bad; dy++) for (let dx = -2; dx <= 2; dx++) {
        const j = idx(x + dx, yy + dy);
        if (terrain[j] !== T_SNOW && (Math.abs(dx) < 2 && Math.abs(dy) < 2 || terrain[j] === T_ROCK)) { bad = true; break; }
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && spot[j] >= 0) { bad = true; break; }
      }
      if (bad || nearNorth(seed, x, yy, 6) || w.pois.some(p => Math.hypot(p.x - x, p.y - yy) < 3)) continue;
      w.sites.push({ id: sid++, kind, x, y: yy, t: 7 });
      break;
    }
  }
  w.north.push(...stops);
  w.rows = y1;
}


export function idx(x, y) { return y * W + x; }
export function inMap(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

export function genWorld(seed) {
  const HB = BASE_H, N = W * HB; // 前 1000 行永远按老规则生成（老存档的地图不变）
  const terrain = new Uint8Array(N);
  const height = new Float32Array(N);
  const spot = new Int8Array(N).fill(-1); // SPOT_KEYS 下标
  const spotInit = new Float32Array(N);
  const rnd = mulberry32(seed * 7919 + 13);
  const nearLandmark = (x, y, r) => LANDMARKS.some(l => (x - l.x) ** 2 + (y - l.row) ** 2 <= r * r);

  for (let y = 0; y < HB; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const n1 = valueNoise(seed, x, y, 9), n2 = valueNoise(seed + 77, x, y, 4);
      const n = n1 * 0.7 + n2 * 0.3;
      height[i] = n;
      let t = T_SNOW;
      const edge = Math.min(x, W - 1 - x);
      if (n > 0.74 || (edge < 2 && n > 0.5)) t = T_ROCK;
      else if (valueNoise(seed + 991, x, y, 7) > 0.8) t = T_ICE;
      if (nearLandmark(x, y, 7)) t = T_SNOW;
      terrain[i] = t;
    }
  }
  // 资源点：越往北储量越大；成片出现
  for (let y = 0; y < HB; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (terrain[i] !== T_SNOW) continue;
      if (nearLandmark(x, y, 3)) continue;
      for (let k = SPOT_KEYS.length - 1; k >= 0; k--) {
        const s = SPOTS[SPOT_KEYS[k]];
        if (y < s.from) continue;
        let dens = s.dens;
        const key = SPOT_KEYS[k];
        if (key === 'tree') dens *= 1.6 * valueNoise(seed + 5, x, y, 6) * Math.max(0.15, 1 - y / 552);
        else if (key === 'herd') dens *= Math.max(0.12, 1 - y / 483);
        else dens *= 0.6 + 0.8 * valueNoise(seed + 31 * (k + 1), x, y, 8);
        // 新层资源在刚出现的纬度更集中一点，确保地标附近找得到
        if (s.from > 0 && y - s.from < 25) dens *= 1.5;
        if (key === 'shard') { const d = Math.hypot(x - 24, y - 325); dens = d < 18 ? 0.09 : y > 345 ? 0.025 : 0; }
        if (rnd() < dens) {
          spot[i] = k;
          spotInit[i] = Math.round(s.reserve * (0.7 + rnd() * 0.6) * (1 + y / 160));
          break;
        }
      }
    }
  }
  // 保证起点附近有基础资源
  ensureNear(seed, terrain, spot, spotInit, LANDMARKS[0].x, LANDMARKS[0].row, ['tree', 'tree', 'tree', 'tree', 'rock', 'rock', 'herd', 'herd'], 5, 11);
  for (let li = 1; li < LANDMARKS.length; li++) {
    const l = LANDMARKS[li];
    const need = ['tree', 'tree', 'tree', 'rock', 'rock', 'rock', 'herd', 'herd'];
    const t = tierOfRow(l.row);
    // 从这里重开时也要能做出前面各层的材料：每层的原料都放几处
    for (const k of SPOT_KEYS) {
      if (SPOTS[k].nw) continue; // 北境地貌专有的不在老地图里放
      const st = SPOTS[k].from > 0 ? tierOfRow(SPOTS[k].from) : 0;
      if (st === t) need.push(k, k, k);
      else if (st >= 2 && st < t) need.push(k, k);
    }
    ensureNear(seed + li, terrain, spot, spotInit, l.x, l.row, need, 6, 13);
  }

  // 兴趣点：幸存者、遗迹物资、专家
  const pois = [];
  let pid = 0;
  for (let y = 18; y < HB - 6; y += 9) {
    const r = rnd();
    const x = 3 + Math.floor(rnd() * (W - 6));
    const yy = y + Math.floor(rnd() * 6);
    if (terrain[idx(x, yy)] !== T_SNOW) continue;
    if (r < 0.5) pois.push({ id: pid++, kind: 'survivors', x, y: yy, n: 4 + Math.floor(rnd() * 5 + yy / 30) });
    else if (r < 0.9) pois.push({ id: pid++, kind: 'cache', x, y: yy, tier: tierOfRow(yy) });
  }
  for (const s of SPECS) {
    if (s.row == null) continue; // 不在地图上的专家（比如医生是自己找来的）
    let x = 4 + Math.floor(rnd() * (W - 8)), y = s.row;
    if (s.id === 'luyu') { x = 24; y = 318; }
    terrain[idx(x, y)] = T_SNOW; spot[idx(x, y)] = -1;
    pois.push({ id: pid++, kind: 'spec', spec: s.id, x, y });
  }
  // 雾里的地点（单独的随机数，不影响上面已经生成好的地图）
  const sites = [], r2 = mulberry32(seed * 31 + 7);
  let sid = 0;
  for (let y = 24; y < HB - 10; y += 20) {
    const t = tierOfRow(y);
    const kinds = t <= 1 ? ['depot', 'camp', 'depot'] : t <= 3 ? ['depot', 'camp', 'train', 'shrine'] : ['train', 'lab', 'wreck', 'camp', 'shrine', 'lab'];
    const kind = kinds[Math.floor(r2() * kinds.length)];
    for (let tries = 0; tries < 30; tries++) {
      const x = 4 + Math.floor(r2() * (W - 8)), yy = y + Math.floor(r2() * 12);
      if (yy >= HB - 4) break;
      // 模型约 2.5 格宽：周围一圈不能有资源点，两圈内不能有岩石
      let bad = false;
      for (let dy = -2; dy <= 2 && !bad; dy++) for (let dx = -2; dx <= 2; dx++) {
        const j = idx(x + dx, yy + dy);
        if (terrain[j] !== T_SNOW && (Math.abs(dx) < 2 && Math.abs(dy) < 2 || terrain[j] === T_ROCK)) { bad = true; break; }
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && spot[j] >= 0) { bad = true; break; }
      }
      if (bad) continue;
      if (LANDMARKS.some(l => Math.hypot(l.x - x, l.row - yy) < 9)) continue;
      if (pois.some(p => Math.hypot(p.x - x, p.y - yy) < 3)) continue;
      sites.push({ id: sid++, kind, x, y: yy, t: tierOfRow(yy) });
      break;
    }
  }
  // 从北边地标重开时营地扎在地标南边 8 格：那一圈也铲平，免得岩石堆贴着熔炉。
  // 放在最后做，不消耗随机数，老存档的资源点位置不变
  for (let li = 1; li < LANDMARKS.length; li++) {
    const l = LANDMARKS[li], cx = l.x + 0.5, cy = l.row - 6.5;
    for (let y = Math.floor(cy - 6); y <= cy + 6; y++) for (let x = Math.max(0, Math.floor(cx - 6)); x <= Math.min(W - 1, cx + 6); x++) {
      const i = idx(x, y);
      if (terrain[i] === T_ROCK && Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < 5.5 && Math.min(x, W - 1 - x) >= 2) terrain[i] = T_SNOW;
    }
  }
  // 永恒之炉以北的远方地标：在目标纬度找一块离遗迹、兴趣点都远的地方，再把周围铲平。不消耗随机数
  const far = FAR_MARKS.map((f, i) => {
    let best = null;
    for (let dx = 0; dx <= 14 && !best; dx++) for (const sg of [1, -1]) {
      const x = 24 + Math.round((hash3(i, 41, seed) - 0.5) * 12) + sg * dx;
      if (x < 8 || x > W - 9) continue;
      if (sites.some(s => Math.hypot(s.x - x, s.y - f.row) < f.r + 5) || pois.some(p => Math.hypot(p.x - x, p.y - f.row) < f.r + 3)) continue;
      best = { x, y: f.row }; break;
    }
    best ||= { x: 24, y: f.row };
    for (let y = Math.floor(best.y - f.r - 3); y <= best.y + f.r + 3; y++) for (let x = Math.max(1, Math.floor(best.x - f.r - 3)); x <= Math.min(W - 2, best.x + f.r + 3); x++) {
      const d = Math.hypot(x - best.x, y - best.y), j = idx(x, y);
      if (d < f.r + 2.5) terrain[j] = T_SNOW;
      if (d < f.r + 1.5) spot[j] = -1;
    }
    return best;
  });
  // 星落之坑周围的星核石：单独的随机数，只放在坑外一圈的空雪地上（不影响别处的资源点）
  { const fk = SPOT_KEYS.indexOf('starfall'), p = far[4], rs = mulberry32(seed * 71 + 5);
    if (fk >= 0 && p) for (let n = 0, tries = 0; n < 9 && tries < 300; tries++) {
      const a = rs() * Math.PI * 2, d = FAR_MARKS[4].r + 2.5 + rs() * 7;
      const x = Math.round(p.x + Math.cos(a) * d), y = Math.round(p.y + Math.sin(a) * d);
      if (x < 2 || x > W - 3) continue;
      const i = idx(x, y);
      if (terrain[i] !== T_SNOW || spot[i] >= 0) continue;
      spot[i] = fk; spotInit[i] = SPOTS.starfall.reserve; n++;
      const j = idx(x + (rs() < 0.5 ? 1 : -1), y);
      if (terrain[j] === T_SNOW && spot[j] < 0) { spot[j] = fk; spotInit[j] = SPOTS.starfall.reserve; }
    } }
  // 掠夺者营地：每段纬度一处（单独的随机数，不改地形、不动别的东西）
  const gangs = [], r3 = mulberry32(seed * 53 + 11);
  [42, 86, 136, 190, 242, 296].forEach((row, gi) => {
    for (let tries = 0; tries < 60; tries++) {
      const x = 5 + Math.floor(r3() * (W - 10)), y = row + Math.floor(r3() * 10);
      let bad = false;
      for (let dy = -2; dy <= 2 && !bad; dy++) for (let dx = -2; dx <= 2; dx++) {
        const j = idx(x + dx, y + dy);
        if (terrain[j] !== T_SNOW || (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && spot[j] >= 0)) { bad = true; break; }
      }
      if (bad) continue;
      if (LANDMARKS.some(l => Math.hypot(l.x - x, l.row - y) < 12)) continue;
      if (sites.some(q => Math.hypot(q.x - x, q.y - y) < 6) || pois.some(q => Math.hypot(q.x - x, q.y - y) < 4)) continue;
      gangs.push({ id: gi, x, y });
      break;
    }
  });
  const w = { seed, terrain, height, spot, spotInit, pois, sites, far, gangs, rows: HB, north: [] };
  // 北境头两站落在前 1000 行里：在最后补上（不消耗随机数，世界之脊以南不受影响），站点周围的地点和兴趣点挪走
  for (let k = 1; ; k++) {
    const s = northStop(seed, k); if (s.y >= HB) break;
    w.sites = w.sites.filter(q => !nearNorth(seed, q.x, q.y, 6));
    w.pois = w.pois.filter(q => q.kind === 'spec' || !nearNorth(seed, q.x, q.y, 3));
    placeNorth(w, s); w.north.push(s);
  }
  return w;
}

function ensureNear(seed, terrain, spot, spotInit, cx, cy, list, rmin, rmax, capY = Infinity, avoid = null) {
  const rnd = mulberry32(seed * 31 + cy);
  let tries = 0;
  // 统计现有
  const have = {};
  for (let y = cy - rmax; y <= cy + rmax; y++) for (let x = cx - rmax; x <= cx + rmax; x++) {
    if (!inMap(x, y)) continue;
    const d = Math.hypot(x - cx, y - cy);
    if (d > rmax) continue;
    const s = spot[idx(x, y)];
    if (s >= 0) have[SPOT_KEYS[s]] = (have[SPOT_KEYS[s]] || 0) + 1;
  }
  for (const key of list) {
    if ((have[key] || 0) > 0) { have[key]--; continue; }
    while (tries++ < 400) {
      const a = rnd() * Math.PI * 2, d = rmin + rnd() * (rmax - rmin);
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (!inMap(x, y) || x < 1 || x > W - 2 || y >= terrain.length / W) continue;
      const i = idx(x, y);
      if (spot[i] >= 0 || (avoid && avoid(x, y))) continue;
      terrain[i] = T_SNOW;
      spot[i] = SPOT_KEYS.indexOf(key);
      spotInit[i] = Math.round(SPOTS[key].reserve * (1 + Math.min(y, capY) / 160));
      // 再放一个相邻的，形成小片
      const j = idx(Math.min(W - 2, x + 1), y);
      if (spot[j] < 0 && terrain[j] !== T_ROCK && !(avoid && avoid(Math.min(W - 2, x + 1), y))) { terrain[j] = T_SNOW; spot[j] = spot[i]; spotInit[j] = spotInit[i]; }
      break;
    }
  }
}
