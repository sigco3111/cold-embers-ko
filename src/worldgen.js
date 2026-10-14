// 地图生成：地标与资源纬度固定，地形与细节每轮随机
import { SPOTS, SPOT_KEYS, LANDMARKS, SPECS, FAR_MARKS, tierOfRow } from './data.js';

export const W = 48;
export const H = 1000; // 永恒之炉在 325 行，再往北是没有尽头的永夜冰原
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
  if (!cache.has(seed)) { cache.clear(); cache.set(seed, genWorld(seed)); }
  return cache.get(seed);
}

export function idx(x, y) { return y * W + x; }
export function inMap(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }

export function genWorld(seed) {
  const N = W * H;
  const terrain = new Uint8Array(N);
  const height = new Float32Array(N);
  const spot = new Int8Array(N).fill(-1); // SPOT_KEYS 下标
  const spotInit = new Float32Array(N);
  const rnd = mulberry32(seed * 7919 + 13);
  const nearLandmark = (x, y, r) => LANDMARKS.some(l => (x - l.x) ** 2 + (y - l.row) ** 2 <= r * r);

  for (let y = 0; y < H; y++) {
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
  for (let y = 0; y < H; y++) {
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
      const st = SPOTS[k].from > 0 ? tierOfRow(SPOTS[k].from) : 0;
      if (st === t) need.push(k, k, k);
      else if (st >= 2 && st < t) need.push(k, k);
    }
    ensureNear(seed + li, terrain, spot, spotInit, l.x, l.row, need, 6, 13);
  }

  // 兴趣点：幸存者、遗迹物资、专家
  const pois = [];
  let pid = 0;
  for (let y = 18; y < H - 6; y += 9) {
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
  for (let y = 24; y < H - 10; y += 20) {
    const t = tierOfRow(y);
    const kinds = t <= 1 ? ['depot', 'camp', 'depot'] : t <= 3 ? ['depot', 'camp', 'train', 'shrine'] : ['train', 'lab', 'wreck', 'camp', 'shrine', 'lab'];
    const kind = kinds[Math.floor(r2() * kinds.length)];
    for (let tries = 0; tries < 30; tries++) {
      const x = 4 + Math.floor(r2() * (W - 8)), yy = y + Math.floor(r2() * 12);
      if (yy >= H - 4) break;
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
  return { seed, terrain, height, spot, spotInit, pois, sites, far, gangs };
}

function ensureNear(seed, terrain, spot, spotInit, cx, cy, list, rmin, rmax) {
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
      if (!inMap(x, y) || x < 1 || x > W - 2) continue;
      const i = idx(x, y);
      if (spot[i] >= 0) continue;
      terrain[i] = T_SNOW;
      spot[i] = SPOT_KEYS.indexOf(key);
      spotInit[i] = Math.round(SPOTS[key].reserve * (1 + y / 160));
      // 再放一个相邻的，形成小片
      const j = idx(Math.min(W - 2, x + 1), y);
      if (spot[j] < 0 && terrain[j] !== T_ROCK) { terrain[j] = T_SNOW; spot[j] = spot[i]; spotInit[j] = spotInit[i]; }
      break;
    }
  }
}
