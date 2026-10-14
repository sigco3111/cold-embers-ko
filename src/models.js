// 低多边形模型：所有建筑、资源点、小人都用程序生成，并合并成带顶点色的几何体
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BLD } from './data.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

// 一个部件：几何体 + 颜色 + 变换
export function P(geom, color, o = {}) {
  let g = geom.index ? geom.toNonIndexed() : geom.clone();
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
  _q.setFromEuler(_e);
  _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
  _p.set(o.x || 0, o.y || 0, o.z || 0);
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  _c.set(color);
  const jit = o.jit || 0;
  const seed = (o.x || 0) * 13.1 + (o.y || 0) * 7.7 + (o.z || 0) * 3.3 + n;
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (jit ? (Math.sin(i * 12.9898 + seed) * 0.5) * jit : 0);
    for (let j = 0; j < 3 && i + j < n; j++) { col[(i + j) * 3] = _c.r * k; col[(i + j) * 3 + 1] = _c.g * k; col[(i + j) * 3 + 2] = _c.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(key)) g.deleteAttribute(key);
  return g;
}
export function merge(parts) {
  const ok = parts.filter(Boolean);
  if (!ok.length) return new THREE.BufferGeometry();
  const g = mergeGeometries(ok, false);
  g.computeVertexNormals();
  return g;
}

// 常用几何
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl5: new THREE.CylinderGeometry(0.5, 0.5, 1, 5),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  frust8: new THREE.CylinderGeometry(0.38, 0.5, 1, 8),
  frust12: new THREE.CylinderGeometry(0.42, 0.5, 1, 12),
  cone4: new THREE.ConeGeometry(0.71, 1, 4),
  cone5: new THREE.ConeGeometry(0.5, 1, 5),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  cone7: new THREE.ConeGeometry(0.5, 1, 7),
  cone7o: new THREE.ConeGeometry(0.5, 1, 7, 1, true),
  cone8: new THREE.ConeGeometry(0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  dode: new THREE.DodecahedronGeometry(0.5, 0),
  oct: new THREE.OctahedronGeometry(0.5, 0),
  tet: new THREE.TetrahedronGeometry(0.5, 0),
  sph: new THREE.SphereGeometry(0.5, 7, 5),
  sph2: new THREE.SphereGeometry(0.5, 10, 7),
  hemi: new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  hemiLo: new THREE.SphereGeometry(0.5, 7, 2, 0, Math.PI * 2, 0, Math.PI / 2),
  head: new THREE.SphereGeometry(0.5, 6, 4),
  cyl6o: new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true),
  torus: new THREE.TorusGeometry(0.5, 0.08, 4, 12),
  torus16: new THREE.TorusGeometry(0.5, 0.06, 4, 16),
  wheel: new THREE.TorusGeometry(0.5, 0.07, 4, 10),
  gear: (() => { const s = new THREE.Shape(); const n = 10; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.5 : 0.38; const a2 = a + Math.PI / (n * 2); if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); s.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } const h = new THREE.Path(); h.absarc(0, 0, 0.14, 0, Math.PI * 2, true); s.holes.push(h); return new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 6 }); })(),
  arch: (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(-0.5, 0.6); s.absarc(0, 0.6, 0.5, Math.PI, 0, true); s.lineTo(0.5, 0); s.lineTo(-0.5, 0); return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 5 }).translate(0, 0, -0.5); })(),
};
// 实心的人字形山墙（屋脊沿 x 方向）
function gable(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

// 每层的外观配色：木 → 石木 → 砖 → 铆钢 → 霜晶 → 遗迹 → 炉心金
export const PAL = [
  null,
  { wall: '#8a5a34', wall2: '#6e4526', line: '#5a3820', roof: '#5c3a22', roof2: '#4a2e1a', trim: '#c9a26b', base: '#7d7f86', metal: '#6b6f78', glow: '#ffb050', post: '#4a2e1a' },
  { wall: '#857262', wall2: '#5d4f45', line: '#4a3e36', roof: '#3f3a3a', roof2: '#2f2b2b', trim: '#a88c62', base: '#6f7178', metal: '#5b606a', glow: '#ff9a40', post: '#3d2a1c' },
  { wall: '#9a5040', wall2: '#7a3a2e', line: '#c9a58a', roof: '#4b4f58', roof2: '#3a3d45', trim: '#c49a5c', base: '#656872', metal: '#7d8794', glow: '#ff8a30', post: '#3a3d45' },
  { wall: '#69798a', wall2: '#4f5c6b', line: '#38424e', roof: '#2f3640', roof2: '#252b33', trim: '#b87333', base: '#575c66', metal: '#9aa6b4', glow: '#ffa040', post: '#2f3640' },
  { wall: '#a8c4d4', wall2: '#7e9fb4', line: '#5f8098', roof: '#3d5a70', roof2: '#2f4659', trim: '#7fe8ff', base: '#6b8090', metal: '#c4dce8', glow: '#7fe8ff', post: '#3d5a70' },
  { wall: '#6c5a86', wall2: '#4e3f66', line: '#3a2e4e', roof: '#2e2440', roof2: '#231b31', trim: '#c8a0ff', base: '#4a4458', metal: '#9a8ab4', glow: '#c080ff', post: '#2e2440' },
  { wall: '#8a6a40', wall2: '#6b4f2e', line: '#4e381e', roof: '#3a2a1a', roof2: '#2c1f12', trim: '#ffd060', base: '#5a4a3a', metal: '#d4a050', glow: '#ffd060', post: '#3a2a1a' },
];
export function visTier(type, lvl) { return Math.min(7, BLD[type].t + Math.floor((lvl - 1) / 5)); }

const SNOW = '#eef4fa', SNOW2 = '#dfe8f2', ICE = '#cfe8ff', DARK = '#2a2622', WOOD = '#7a4a2a', WOOD2 = '#5c3a22', STONE = '#8e959e';

// 一套搭建工具：往 parts/glow 里塞部件
function kit(vt) {
  const p = PAL[vt];
  const parts = [], glow = [];
  const add = (g, c, o) => parts.push(P(g, c, o));
  const lit = (g, c, o) => glow.push(P(g, c, o));
  const box = (c, sx, sy, sz, x, y, z, o = {}) => add(G.box, c, { sx, sy, sz, x, y, z, ...o });

  // 墙体：按层级做出原木横纹 / 石块 / 砖缝 / 铆钉钢板 / 发光线
  const wall = (w, h, d, x, z, y0 = 0.12, c = p.wall) => {
    box(c, w, h, d, x, y0 + h / 2, z, { jit: 0.06 });
    const fz = z + d / 2 + 0.005, sxp = x + w / 2 + 0.005;
    if (vt === 1) {
      for (let k = 1; k < Math.floor(h / 0.13); k++) { box(p.line, w + 0.01, 0.025, 0.01, x, y0 + k * 0.13, fz); box(p.line, 0.01, 0.025, d + 0.01, sxp, y0 + k * 0.13, z); }
    } else if (vt === 2) {
      box('#7d7f86', w + 0.02, Math.min(0.3, h * 0.35), d + 0.02, x, y0 + Math.min(0.3, h * 0.35) / 2, z, { jit: 0.15 });
      for (let k = 0; k < 3; k++) box(p.line, 0.05, h, 0.02, x - w / 2 + 0.05 + k * (w - 0.1) / 2, y0 + h / 2, fz);
    } else if (vt === 3) {
      for (let k = 1; k < Math.floor(h / 0.1); k++) { box(p.line, w + 0.01, 0.012, 0.01, x, y0 + k * 0.1, fz); box(p.line, 0.01, 0.012, d + 0.01, sxp, y0 + k * 0.1, z); }
    } else {
      const n = Math.max(2, Math.round(w / 0.35));
      for (let k = 1; k < n; k++) box(p.line, 0.02, h, 0.015, x - w / 2 + k * w / n, y0 + h / 2, fz);
      box(p.trim, w + 0.02, 0.04, d + 0.02, x, y0 + h - 0.03, z);
      if (vt >= 5) lit(G.box, p.glow, { sx: w * 0.9, sy: 0.025, sz: 0.01, x, y: y0 + h * 0.18, z: fz + 0.004 });
    }
    // 四角立柱
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(p.post, 0.07, h + 0.02, 0.07, x + cx * w / 2, y0 + h / 2, z + cz * d / 2);
  };
  // 人字屋顶：两块有厚度的屋面 + 积雪 + 屋脊 + 冰凌
  const roof = (w, d, hr, x, y, z, c = p.roof, ice = true) => {
    add(gable(w - 0.02, hr, d - 0.02), p.wall2, { x, y, z });
    const a = Math.atan2(hr, d / 2), L = Math.hypot(d / 2, hr) + 0.14, t = 0.06;
    for (const sg of [1, -1]) {
      const cz = z + sg * (d / 4 + 0.03), cy = y + hr / 2 + 0.02;
      add(G.box, c, { sx: w + 0.18, sy: t, sz: L, x, y: cy, z: cz, rx: sg * a, jit: 0.05 });
      // 积雪：盖住上面大半
      const ny = Math.cos(a), nz = sg * Math.sin(a);
      add(G.box, SNOW, { sx: w + 0.1, sy: 0.05, sz: L * 0.78, x, y: cy + ny * 0.05 + Math.sin(a) * L * 0.1, z: cz + nz * 0.05 - sg * Math.cos(a) * L * 0.1, rx: sg * a });
    }
    box(p.roof2, w + 0.22, 0.07, 0.09, x, y + hr + 0.05, z);
    add(G.box, SNOW, { sx: w + 0.16, sy: 0.06, sz: 0.14, x, y: y + hr + 0.1, z });
    if (ice) { const n = Math.max(3, Math.round(w / 0.18)); for (let k = 0; k < n; k++) add(G.cone4, ICE, { sx: 0.03, sy: 0.08 + ((k * 7) % 3) * 0.04, sz: 0.03, x: x - w / 2 + (k + 0.5) * w / n, y: y - 0.05, z: z + d / 2 + 0.12, rx: Math.PI }); }
  };
  const flatRoof = (w, d, x, y, z, c = p.roof) => {
    box(c, w + 0.14, 0.08, d + 0.14, x, y + 0.04, z);
    box(p.trim, w + 0.16, 0.03, d + 0.16, x, y + 0.01, z);
    box(SNOW, w + 0.04, 0.06, d + 0.04, x, y + 0.11, z, { jit: 0.04 });
    add(G.box, SNOW2, { sx: w * 0.4, sy: 0.08, sz: d * 0.35, x: x - w * 0.2, y: y + 0.15, z: z - d * 0.15, ry: 0.3 });
  };
  const door = (x, z, w = 0.26, h = 0.42, y0 = 0.12) => {
    box(p.post, w + 0.08, h + 0.05, 0.04, x, y0 + h / 2 + 0.02, z + 0.01);
    box(vt >= 4 ? p.metal : WOOD2, w, h, 0.04, x, y0 + h / 2, z + 0.025);
    box(p.trim, 0.04, 0.04, 0.03, x + w * 0.3, y0 + h * 0.5, z + 0.05);
    box('#9aa0a8', w + 0.18, 0.05, 0.16, x, y0 - 0.02, z + 0.1);
  };
  const win = (x, y, z, w = 0.18, h = 0.18, side = false) => {
    const o = side ? { ry: Math.PI / 2 } : {};
    const fx = side ? 0.012 : 0, fz = side ? 0 : 0.012;
    box(p.post, side ? 0.03 : w + 0.06, h + 0.06, side ? w + 0.06 : 0.03, x, y, z);
    lit(G.box, p.glow, { sx: side ? 0.02 : w, sy: h, sz: side ? w : 0.02, x: x + fx, y, z: z + fz });
    box(p.post, side ? 0.02 : 0.025, h, side ? 0.025 : 0.02, x + fx * 1.6, y, z + fz * 1.6);
    box(p.post, side ? 0.02 : w, 0.025, side ? w : 0.02, x + fx * 1.6, y, z + fz * 1.6);
    box(SNOW, side ? 0.08 : w + 0.1, 0.035, side ? w + 0.1 : 0.08, x + fx * 3, y - h / 2 - 0.035, z + fz * 3);
    void o;
  };
  // 一栋带门窗的小屋（门朝 +z）
  const house = (w, h, d, x = 0, z = 0, kind = 'gable', c = p.wall) => {
    wall(w, h, d, x, z, 0.12, c);
    if (kind === 'gable') roof(w, d, 0.42 * Math.min(w, d) + 0.1, x, 0.12 + h, z);
    else if (kind === 'flat') flatRoof(w, d, x, 0.12 + h, z);
    else if (kind === 'pyr') { add(G.cone4, p.roof, { sx: w * 0.78, sy: 0.6, sz: d * 0.78, x, y: 0.12 + h + 0.3, z, ry: Math.PI / 4 }); add(G.cone4, SNOW, { sx: w * 0.42, sy: 0.32, sz: d * 0.42, x, y: 0.12 + h + 0.46, z, ry: Math.PI / 4 }); box(p.trim, w + 0.06, 0.04, d + 0.06, x, 0.12 + h, z); }
    if (w >= 0.7) { door(x - (w > 1.1 ? w * 0.2 : 0), z + d / 2, 0.24, Math.min(0.42, h * 0.62)); }
    if (w > 1.1) win(x + w * 0.24, 0.12 + h * 0.62, z + d / 2 + 0.01);
    else if (w >= 0.7) { /* 小屋只开门 */ }
    if (d >= 0.8) win(x + w / 2 + 0.01, 0.12 + h * 0.6, z, 0.16, 0.16, true);
  };
  const chimney = (x, z, h, brick = vt >= 3 ? '#7a3a2e' : '#6a6f78') => {
    box(brick, 0.22, h, 0.22, x, 0.12 + h / 2, z, { jit: 0.12 });
    box(DARK, 0.28, 0.06, 0.28, x, 0.12 + h, z);
    box(SNOW, 0.24, 0.04, 0.24, x, 0.12 + h + 0.05, z);
    box('#1a1716', 0.14, 0.02, 0.14, x, 0.12 + h + 0.075, z);
  };
  const stack = (x, z, h, c = p.wall2, r = 0.32) => {
    add(G.frust12, c, { sx: r, sy: h, sz: r, x, y: 0.12 + h / 2, z, jit: 0.08 });
    for (let k = 1; k <= 2; k++) add(G.torus16, p.trim, { s: r * 1.08, rx: Math.PI / 2, x, y: 0.12 + h * (0.3 + k * 0.25), z });
    add(G.cyl12, DARK, { sx: r * 0.95, sy: 0.08, sz: r * 0.95, x, y: 0.12 + h + 0.02, z });
  };
  const pipe = (x0, z0, x1, z1, y, r = 0.06, c = p.metal) => {
    const d = Math.hypot(x1 - x0, z1 - z0);
    add(G.cyl8, c, { sx: r * 2, sy: d, sz: r * 2, x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, rz: Math.PI / 2, ry: -Math.atan2(z1 - z0, x1 - x0), order: 'YXZ' });
  };
  const vpipe = (x, z, h, y0 = 0.12, r = 0.05, c = p.metal) => { add(G.cyl8, c, { sx: r * 2, sy: h, sz: r * 2, x, y: y0 + h / 2, z }); add(G.cyl8, p.trim, { sx: r * 2.6, sy: 0.04, sz: r * 2.6, x, y: y0 + h * 0.5, z }); };
  const crate = (x, z, y = 0.12, s = 0.2, c = '#b08050', r = 0) => { add(G.box, c, { s, x, y: y + s / 2, z, ry: r, jit: 0.1 }); box(WOOD2, s + 0.01, 0.025, s + 0.01, x, y + s * 0.5, z, { ry: r }); box(SNOW, s * 0.9, 0.025, s * 0.9, x, y + s + 0.012, z, { ry: r }); };
  const barrel = (x, z, y = 0.12, c = '#6a4a2e') => { add(G.cyl8, c, { sx: 0.16, sy: 0.22, sz: 0.16, x, y: y + 0.11, z, jit: 0.1 }); add(G.torus, '#3a3a40', { s: 0.17, rx: Math.PI / 2, x, y: y + 0.06, z }); add(G.torus, '#3a3a40', { s: 0.17, rx: Math.PI / 2, x, y: y + 0.17, z }); add(G.cyl8, SNOW, { sx: 0.14, sy: 0.02, sz: 0.14, x, y: y + 0.225, z }); };
  const logs = (x, z, n = 6, len = 0.6, ry = 0) => {
    let k = 0;
    for (let row = 0; k < n; row++) for (let i = 0; i < 3 - row && k < n; i++, k++) {
      const off = (i - (2 - row) / 2) * 0.13;
      add(G.cyl6, k % 2 ? WOOD : '#8a5a34', { sx: 0.12, sy: len, sz: 0.12, rz: Math.PI / 2, ry, x: x + Math.sin(ry) * off, y: 0.18 + row * 0.11, z: z + Math.cos(ry) * off, order: 'YXZ' });
      add(G.cyl6, '#d8b888', { sx: 0.1, sy: 0.01, sz: 0.1, rz: Math.PI / 2, ry, x: x + Math.cos(ry) * len / 2 + Math.sin(ry) * off, y: 0.18 + row * 0.11, z: z - Math.sin(ry) * len / 2 + Math.cos(ry) * off, order: 'YXZ' });
    }
    add(G.box, SNOW, { sx: len * 0.8, sy: 0.04, sz: 0.12, x, y: 0.18 + 0.11 * 2 + 0.07, z, ry });
  };
  const lantern = (x, z, h = 0.7) => { box(p.post, 0.04, h, 0.04, x, 0.12 + h / 2, z); box(p.post, 0.18, 0.03, 0.03, x + 0.07, 0.12 + h, z); lit(G.box, p.glow, { s: 0.07, x: x + 0.14, y: 0.12 + h - 0.07, z }); box(DARK, 0.09, 0.02, 0.09, x + 0.14, 0.12 + h - 0.025, z); };
  const fence = (x0, z0, x1, z1) => {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(d / 0.3)), ang = -Math.atan2(z1 - z0, x1 - x0);
    for (let k = 0; k <= n; k++) box(p.post, 0.04, 0.26, 0.04, x0 + (x1 - x0) * k / n, 0.25, z0 + (z1 - z0) * k / n);
    for (const y of [0.22, 0.32]) box(WOOD, d, 0.025, 0.025, (x0 + x1) / 2, y, (z0 + z1) / 2, { ry: ang });
  };
  const drift = (x, z, w = 0.5, d = 0.3) => add(G.hemi, SNOW, { sx: w, sy: 0.16, sz: d, x, y: 0.1, z, jit: 0.03 });
  const rocks = (x, z, n = 3, c = STONE, s = 0.2) => { for (let k = 0; k < n; k++) add(G.dode, c, { s: s * (0.7 + (k % 3) * 0.25), x: x + Math.cos(k * 2.4) * s * 0.9, y: 0.12 + s * 0.3, z: z + Math.sin(k * 2.4) * s * 0.9, jit: 0.2 }); };
  return { p, parts, glow, add, lit, box, wall, roof, flatRoof, door, win, house, chimney, stack, pipe, vpipe, crate, barrel, logs, lantern, fence, drift, rocks };
}

// 建筑脚下踩实的雪地（中心偏灰，边缘融进雪里）
function groundPad(s, parts) {
  const R = s * 0.62 + 0.35, n = 14;
  const pos = [], col = [];
  const cIn = new THREE.Color('#a9b0b8'), cOut = new THREE.Color('#d6e0ea');
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const r0 = R * (0.92 + 0.12 * Math.sin(i * 2.7)), r1 = R * (0.92 + 0.12 * Math.sin((i + 1) * 2.7));
    pos.push(0, 0.012, 0, Math.cos(a1) * r1, 0.012, -Math.sin(a1) * r1, Math.cos(a0) * r0, 0.012, -Math.sin(a0) * r0);
    col.push(cIn.r, cIn.g, cIn.b, cOut.r, cOut.g, cOut.b, cOut.r, cOut.g, cOut.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  parts.push(g);
}

// 返回 { geo, glow, h }：glow 是需要发光材质的部分
export function buildingGeo(type, lvl, deep = false) {
  const d = BLD[type];
  const s = d.size;
  const vt = visTier(type, lvl);
  const K = kit(vt);
  const { p, parts, glow, add, lit, box, wall, roof, door, win, house, chimney, stack, pipe, vpipe, crate, barrel, logs, lantern, fence, drift, rocks } = K;
  const big = 1 + Math.min(0.5, (lvl - 1) * 0.025); // 等级越高越高大一点
  const H = big;
  if (d.cat === 'deco' && type !== 'flowerhouse') {
    // 小摆设不铺整块地基，只有一圈踩实的雪
    groundPad(s * 0.75, parts);
  } else if (type !== 'furnace') {
    groundPad(s, parts);
    // 地基：石块或钢板
    box(p.base, s - 0.1, 0.12, s - 0.1, 0, 0.06, 0, { jit: 0.12 });
    box(vt >= 4 ? p.base : '#9aa0a8', s - 0.04, 0.03, s - 0.04, 0, 0.125, 0, { jit: 0.06 });
    if (vt >= 4) for (const [sx, sz, x, z] of [[s - 0.02, 0.05, 0, s / 2 - 0.03], [s - 0.02, 0.05, 0, -s / 2 + 0.03], [0.05, s - 0.02, s / 2 - 0.03, 0], [0.05, s - 0.02, -s / 2 + 0.03, 0]]) box(p.trim, sx, 0.045, sz, x, 0.13, z);
  }

  switch (type) {
    case 'furnace': {
      const r = 1.08 + 0.025 * Math.min(lvl, 20);
      const h = 1.15 + 0.075 * Math.min(lvl, 25);
      groundPad(3.2, parts);
      // 八角石台两级 + 台阶
      add(G.cyl8, '#7a7d84', { sx: 3.0, sy: 0.18, sz: 3.0, y: 0.09, jit: 0.15, ry: Math.PI / 8 });
      add(G.cyl8, '#8e9198', { sx: 2.6, sy: 0.14, sz: 2.6, y: 0.25, jit: 0.12, ry: Math.PI / 8 });
      for (let k = 0; k < 3; k++) box('#9aa0a8', 0.7, 0.07, 0.16, 0, 0.04 + k * 0.08, 1.45 - k * 0.12);
      // 炉身：砖/钢 + 竖肋 + 铁箍
      add(G.frust12, p.wall2, { sx: r * 2, sy: h, sz: r * 2, y: 0.32 + h / 2, jit: 0.1 });
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; box(p.metal, 0.09, h, 0.09, Math.cos(a) * r * 0.93, 0.32 + h / 2, Math.sin(a) * r * 0.93, { ry: -a }); }
      const bands = Math.min(5, 2 + Math.floor(lvl / 5));
      for (let i = 0; i < bands; i++) add(G.torus16, p.metal, { s: r * 2.0 - i * 0.04, rx: Math.PI / 2, y: 0.42 + i * (h - 0.2) / Math.max(1, bands - 1) });
      // 四面的炉门：拱形门框 + 火光 + 栅栏
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 2, cx = Math.cos(a) * r * 0.97, cz = Math.sin(a) * r * 0.97;
        const dw = k === 0 ? 0.62 : 0.42, dh = k === 0 ? 0.5 : 0.36;
        add(G.arch, p.metal, { sx: dw + 0.12, sy: (dh + 0.1) / 1.1, sz: 0.1, x: cx, y: 0.32, z: cz, ry: -a + Math.PI / 2 });
        lit(G.arch, '#ff8a2a', { sx: dw, sy: dh / 1.1, sz: 0.06, x: cx * 1.02, y: 0.34, z: cz * 1.02, ry: -a + Math.PI / 2 });
        for (let b = -1; b <= 1; b++) { const tx = -Math.sin(a) * b * dw * 0.3, tz = Math.cos(a) * b * dw * 0.3; box(DARK, 0.03, dh * 0.95, 0.03, cx * 1.06 + tx, 0.34 + dh * 0.5, cz * 1.06 + tz); }
      }
      // 炉顶：外沿垛口 + 火盆 + 火焰
      const top = 0.32 + h;
      add(G.cyl12, p.wall, { sx: r * 2.15, sy: 0.18, sz: r * 2.15, y: top + 0.06 });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; box(p.wall, 0.2, 0.18, 0.14, Math.cos(a) * r * 1.0, top + 0.22, Math.sin(a) * r * 1.0, { ry: -a }); box(SNOW, 0.2, 0.04, 0.14, Math.cos(a) * r * 1.0, top + 0.33, Math.sin(a) * r * 1.0, { ry: -a }); }
      add(G.cyl12, DARK, { sx: r * 1.75, sy: 0.12, sz: r * 1.75, y: top + 0.17 });
      // 炭床：暗红的余烬 + 一圈煤块 + 铁格栅
      lit(G.cyl12, '#c8461a', { sx: r * 1.35, sy: 0.04, sz: r * 1.35, y: top + 0.24 });
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = r * (0.42 + (k % 3) * 0.08); add(G.dode, k % 2 ? '#2a2420' : '#3a2e26', { s: 0.2 + (k % 3) * 0.05, x: Math.cos(a) * rr, y: top + 0.27, z: Math.sin(a) * rr, jit: 0.3 }); }
      // 炉顶四角的铁爪托住火焰
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; box(p.metal, 0.08, 0.55, 0.08, Math.cos(a) * r * 0.78, top + 0.5, Math.sin(a) * r * 0.78, { rz: Math.cos(a) * -0.35, rx: Math.sin(a) * 0.35, ry: -a }); }
      // 煤堆 + 柴堆 + 铲子
      for (let k = 0; k < 6; k++) add(G.dode, '#26262b', { s: 0.22 + (k % 3) * 0.06, x: -1.15 + (k % 3) * 0.16, y: 0.3 + Math.floor(k / 3) * 0.12, z: 0.85 + (k % 2) * 0.12, jit: 0.3 });
      logs(1.05, 0.95, 5, 0.5, 0.4);
      // 更高层级：蒸汽管、烟囱、晶体、符文
      if (vt >= 2) { for (const sg of [-1, 1]) { pipe(sg * r * 0.9, -0.3, sg * 1.35, -0.3, 0.75, 0.07); vpipe(sg * 1.35, -0.3, 0.63, 0.12, 0.07); } }
      if (vt >= 3) { stack(-r * 0.75, -r * 0.7, h + 1.0, p.wall2, 0.26); stack(r * 0.75, -r * 0.7, h + 0.8, p.wall2, 0.24); }
      if (vt >= 4) for (let k = 0; k < 3; k++) add(G.gear, p.trim, { s: 0.45, x: -0.6 + k * 0.6, y: 0.32 + h * 0.55, z: r * 0.98 + 0.02, ry: 0, rz: k });
      if (vt >= 5) for (let i = 0; i < 4; i++) lit(G.oct, p.trim, { sx: 0.25, sy: 0.65, sz: 0.25, x: Math.cos(i * 1.57 + 0.78) * 1.32, y: 0.62, z: Math.sin(i * 1.57 + 0.78) * 1.32 });
      if (vt >= 6) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; lit(G.box, p.glow, { sx: 0.05, sy: h * 0.5, sz: 0.02, x: Math.cos(a) * r * 1.0, y: 0.32 + h * 0.5, z: Math.sin(a) * r * 1.0, ry: -a }); }
      break;
    }
    case 'tent': {
      if (vt === 1 && lvl < 3) {
        // 兽皮帐篷：拼色的圆锥 + 交叉的支杆 + 门帘 + 门口的小火堆
        const tz = -0.1;
        add(G.cone8, '#c2a27a', { sx: 1.45, sy: 1.3, sz: 1.45, x: 0, y: 0.12 + 0.65, z: tz, jit: 0.18 });
        for (let k = 0; k < 4; k++) add(G.box, '#8a6a48', { sx: 0.03, sy: 1.0, sz: 0.02, x: Math.cos(k * 1.57 + 0.3) * 0.38, y: 0.62, z: tz + Math.sin(k * 1.57 + 0.3) * 0.38, rz: Math.cos(k * 1.57 + 0.3) * 0.48, rx: -Math.sin(k * 1.57 + 0.3) * 0.48 });
        add(G.cone8, SNOW, { sx: 0.62, sy: 0.55, sz: 0.62, y: 0.12 + 1.02, z: tz });
        for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.3; add(G.cyl5, WOOD2, { sx: 0.035, sy: 0.55, sz: 0.035, x: Math.cos(a) * 0.08, y: 1.48, z: tz + Math.sin(a) * 0.08, rz: Math.cos(a) * 0.35, rx: -Math.sin(a) * 0.35 }); }
        add(G.cone4, '#3a2a1e', { sx: 0.32, sy: 0.48, sz: 0.06, y: 0.36, z: tz + 0.6, rx: -0.5 });
        add(G.box, '#a4865e', { sx: 0.18, sy: 0.4, sz: 0.03, x: 0.15, y: 0.33, z: tz + 0.62, rz: -0.35, rx: -0.5 });
        lit(G.cone4, p.glow, { sx: 0.18, sy: 0.25, sz: 0.04, y: 0.25, z: tz + 0.66, rx: -0.5 });
        // 火堆
        for (let k = 0; k < 6; k++) add(G.dode, '#7d8088', { s: 0.08, x: 0.5 + Math.cos(k) * 0.12, y: 0.16, z: 0.55 + Math.sin(k) * 0.12 });
        lit(G.cone5, '#ffa030', { sx: 0.12, sy: 0.2, sz: 0.12, x: 0.5, y: 0.25, z: 0.55 });
        drift(-0.6, 0.5, 0.4, 0.3);
      } else {
        house(1.5, 0.72 * H, 1.25, 0, -0.05, 'gable', vt === 1 ? '#8a5a34' : p.wall);
        chimney(0.45, -0.35, 1.3 * H);
        logs(-0.62, 0.58, 3, 0.35, 1.2);
        lantern(0.66, 0.6, 0.55);
      }
      break;
    }
    case 'lumber': {
      house(0.95, 0.66, 0.85, -0.38, -0.35);
      logs(0.4, 0.15, 6, 0.75, 0.2);
      // 树桩 + 斧头 + 锯木架
      add(G.cyl8, '#6b4526', { sx: 0.3, sy: 0.22, sz: 0.3, x: -0.45, y: 0.23, z: 0.55 });
      add(G.cyl8, '#d8b888', { sx: 0.26, sy: 0.01, sz: 0.26, x: -0.45, y: 0.345, z: 0.55 });
      box(WOOD2, 0.03, 0.3, 0.03, -0.42, 0.45, 0.55, { rz: 0.4 }); box('#9aa0a8', 0.12, 0.07, 0.02, -0.48, 0.58, 0.55, { rz: 0.4 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(WOOD2, 0.03, 0.32, 0.03, 0.2 + sx * 0.18, 0.26, 0.6 + sz * 0.06, { rz: sx * 0.35 });
      add(G.cyl6, WOOD, { sx: 0.12, sy: 0.6, sz: 0.12, rz: Math.PI / 2, x: 0.2, y: 0.4, z: 0.6 });
      drift(0.6, -0.55, 0.4, 0.25);
      break;
    }
    case 'nursery': {
      // 育苗小屋 + 围栏里一垄垄高矮不一的小冷杉 + 水桶、铁锹
      house(0.72, 0.5, 0.62, -0.56, -0.5, 'gable', '#8a5a34');
      const fir = (x, z, h) => {
        add(G.cyl6, '#4a3020', { sx: 0.05, sy: h * 0.3, sz: 0.05, x, y: 0.12 + h * 0.15, z });
        add(G.cone7, '#2f5a46', { sx: h * 0.42, sy: h * 0.55, sz: h * 0.42, x, y: 0.12 + h * 0.42, z, jit: 0.15 });
        add(G.cone7, '#2a5040', { sx: h * 0.3, sy: h * 0.45, sz: h * 0.3, x, y: 0.12 + h * 0.72, z, ry: 0.6, jit: 0.15 });
        add(G.cone5, SNOW, { sx: h * 0.12, sy: h * 0.16, sz: h * 0.12, x, y: 0.12 + h * 0.95, z });
      };
      for (let r = 0; r < 4; r++) {
        const z = -0.68 + r * 0.44;
        box('#5a4632', 0.88, 0.05, 0.16, 0.42, 0.13, z); // 翻过的土垄
        for (let c = 0; c < 3; c++) fir(0.1 + c * 0.32, z, 0.28 + 0.34 * ((r * 3 + c * 5) % 7) / 6);
      }
      fence(-0.04, -0.9, 0.92, -0.9); fence(0.92, -0.9, 0.92, 0.9); fence(-0.04, 0.9, 0.92, 0.9);
      barrel(-0.6, 0.25); add(G.cyl8, '#4a7ab0', { sx: 0.12, sy: 0.01, sz: 0.12, x: -0.6, y: 0.355, z: 0.25 });
      box(WOOD2, 0.03, 0.5, 0.03, -0.35, 0.36, 0.55, { rz: 0.25 }); box('#9aa0a8', 0.1, 0.12, 0.02, -0.41, 0.14, 0.55, { rz: 0.25 });
      logs(-0.55, 0.62, 3, 0.45, 0.2);
      break;
    }
    case 'quarry': {
      house(0.8, 0.55, 0.75, -0.42, -0.42, 'flat');
      for (let i = 0; i < 6; i++) add(G.box, i % 2 ? '#a8aeb6' : '#959ba4', { sx: 0.3, sy: 0.22, sz: 0.24, x: 0.15 + (i % 3) * 0.28, y: 0.23 + Math.floor(i / 3) * 0.22, z: 0.35, ry: (i % 2) * 0.1, jit: 0.1 });
      add(G.box, SNOW, { sx: 0.7, sy: 0.04, sz: 0.2, x: 0.43, y: 0.58, z: 0.35 });
      // 木吊杆 + 滑轮 + 吊着的石块
      box(WOOD2, 0.08, 1.4, 0.08, 0.6, 0.82, -0.5);
      box(WOOD2, 0.9, 0.06, 0.06, 0.3, 1.5, -0.5, { rz: -0.12 });
      box(WOOD2, 0.05, 0.9, 0.05, 0.6, 0.6, -0.25, { rx: -0.5 });
      box('#2a2a2e', 0.01, 0.6, 0.01, -0.1, 1.2, -0.5);
      add(G.box, '#a0a6ae', { s: 0.22, x: -0.1, y: 0.85, z: -0.5, jit: 0.1 });
      if (!deep) rocks(-0.5, 0.45, 3, '#8e959e', 0.16);
      else {
        // 深采：门前挖下去的深坑（石砌坑沿）+ 坑上的三脚吊架和吊桶 + 伸进坑里的梯子 + 吊杆顶上的红灯
        add(G.cyl12, '#1a1c20', { sx: 0.64, sy: 0.02, sz: 0.64, x: -0.48, y: 0.13, z: 0.48 });
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(G.box, k % 2 ? '#a8aeb6' : '#8e959e', { sx: 0.17, sy: 0.1, sz: 0.1, x: -0.48 + Math.cos(a) * 0.34, y: 0.17, z: 0.48 + Math.sin(a) * 0.34, ry: -a, jit: 0.1 }); }
        for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; box(WOOD2, 0.04, 0.85, 0.04, -0.48 + Math.cos(a) * 0.2, 0.52, 0.48 + Math.sin(a) * 0.2, { rx: Math.sin(a) * 0.22, rz: -Math.cos(a) * 0.22 }); }
        add(G.cyl8, WOOD, { sx: 0.1, sy: 0.08, sz: 0.1, x: -0.48, y: 0.92, z: 0.48 });
        box('#2a2a2e', 0.012, 0.5, 0.012, -0.48, 0.64, 0.48);
        add(G.cyl8, WOOD2, { sx: 0.12, sy: 0.1, sz: 0.12, x: -0.48, y: 0.37, z: 0.48 });
        for (const sg of [-1, 1]) box(WOOD2, 0.03, 0.46, 0.03, -0.24, 0.24, 0.62 + sg * 0.06, { rz: -0.5 });
        for (let k = 0; k < 3; k++) { const y = 0.14 + k * 0.1; box(WOOD2, 0.022, 0.022, 0.14, -0.24 + 0.546 * (y - 0.24), y, 0.62); }
        lit(G.oct, '#ff4a2a', { s: 0.08, x: 0.6, y: 1.62, z: -0.5 });
      }
      break;
    }
    case 'hunter': {
      house(1.0, 0.62, 0.85, -0.25, -0.3);
      // 鹿角挂在门楣上
      for (const sg of [-1, 1]) { box('#e8dcc0', 0.025, 0.18, 0.025, -0.25 + sg * 0.08, 0.95, 0.15, { rz: sg * 0.5 }); box('#e8dcc0', 0.02, 0.1, 0.02, -0.25 + sg * 0.14, 1.02, 0.15, { rz: -sg * 0.3 }); }
      // 晾皮架
      for (const x of [0.15, 0.75]) box(WOOD2, 0.04, 0.6, 0.04, x, 0.42, 0.55);
      box(WOOD2, 0.7, 0.04, 0.04, 0.45, 0.7, 0.55);
      for (let i = 0; i < 3; i++) add(G.box, i === 1 ? '#c8a07a' : '#a0704a', { sx: 0.17, sy: 0.32, sz: 0.02, x: 0.26 + i * 0.19, y: 0.5, z: 0.55, rz: (i - 1) * 0.08 });
      // 肉架 + 雪橇
      box('#b05040', 0.06, 0.16, 0.05, 0.62, 0.45, -0.55); box('#b05040', 0.06, 0.14, 0.05, 0.72, 0.46, -0.55); box(WOOD2, 0.35, 0.03, 0.03, 0.67, 0.56, -0.55);
      box(WOOD, 0.5, 0.04, 0.22, -0.55, 0.16, 0.6); box('#c8d0d8', 0.55, 0.02, 0.03, -0.55, 0.14, 0.7);
      break;
    }
    case 'sawmill': {
      house(1.3, 0.72, 0.95, 0, -0.25, 'gable');
      // 水车般的大圆锯 + 原木 + 木板堆
      add(G.cyl16, '#c0c4cc', { sx: 0.62, sy: 0.03, sz: 0.62, rx: Math.PI / 2, x: 0.45, y: 0.48, z: 0.55 });
      add(G.cyl8, DARK, { sx: 0.1, sy: 0.08, sz: 0.1, rx: Math.PI / 2, x: 0.45, y: 0.48, z: 0.55 });
      box(WOOD2, 0.7, 0.18, 0.3, 0.45, 0.21, 0.55);
      add(G.cyl6, WOOD, { sx: 0.16, sy: 0.9, sz: 0.16, rz: Math.PI / 2, x: 0.1, y: 0.38, z: 0.62 });
      for (let k = 0; k < 4; k++) box(k % 2 ? '#d8a868' : '#c89858', 0.55, 0.05, 0.22, -0.5, 0.15 + k * 0.055, 0.58);
      add(G.box, SNOW, { sx: 0.5, sy: 0.03, sz: 0.2, x: -0.5, y: 0.38, z: 0.58 });
      chimney(-0.45, -0.55, 1.2);
      break;
    }
    case 'kitchen': {
      house(1.2, 0.72, 1.0, 0, -0.2);
      chimney(0.38, -0.45, 1.5, '#7a5040');
      // 露天大锅 + 火 + 柴 + 桶
      for (const sg of [-1, 1]) box(DARK, 0.03, 0.42, 0.03, -0.45 + sg * 0.22, 0.32, 0.58);
      box(DARK, 0.5, 0.03, 0.03, -0.45, 0.53, 0.58);
      add(G.hemi, '#3a3a40', { sx: 0.34, sy: 0.3, sz: 0.34, x: -0.45, y: 0.36, z: 0.58, rx: Math.PI });
      add(G.cyl12, '#c8b090', { sx: 0.3, sy: 0.01, sz: 0.3, x: -0.45, y: 0.365, z: 0.58 });
      lit(G.cone5, '#ffa030', { sx: 0.16, sy: 0.18, sz: 0.16, x: -0.45, y: 0.2, z: 0.58 });
      barrel(0.45, 0.6); crate(0.2, 0.68, 0.12, 0.16, '#b08050', 0.3);
      break;
    }
    case 'warehouse': {
      const w = 1.7, hh = 0.92 * H;
      wall(w, hh, 1.35, 0, -0.15, 0.12, p.wall2);
      roof(w, 1.35, 0.62, 0, 0.12 + hh, -0.15);
      // 双开大门 + 斜撑
      box(p.post, 0.82, 0.66, 0.05, 0, 0.45, 0.53);
      for (const sg of [-1, 1]) { box(vt >= 4 ? p.metal : WOOD, 0.37, 0.6, 0.05, sg * 0.19, 0.42, 0.56); box(p.post, 0.05, 0.7, 0.03, sg * 0.19, 0.42, 0.59, { rz: sg * 0.55 }); }
      box(p.trim, 0.9, 0.05, 0.05, 0, 0.8, 0.56);
      K.win(0, 0.12 + hh * 0.9, 0.54, 0.22, 0.12);
      crate(-0.62, 0.62, 0.12, 0.22, '#b08050', 0.2); crate(-0.62, 0.62, 0.34, 0.18, '#a07040', 0.6); crate(-0.38, 0.7, 0.12, 0.18, '#c09060', 0.9);
      barrel(0.6, 0.66); barrel(0.75, 0.5);
      add(G.sph, '#c8b090', { sx: 0.2, sy: 0.16, sz: 0.16, x: 0.45, y: 0.2, z: 0.75 });
      break;
    }
    case 'tower': {
      const h = 1.55 * H + 0.1 * vt;
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) box(vt >= 3 ? p.metal : WOOD2, 0.08, h, 0.08, x * 0.9, h / 2 + 0.05, z * 0.9, { rx: -z * 0.08, rz: x * 0.08 });
      for (let k = 1; k <= 3; k++) { const y = h * k / 4; box(vt >= 3 ? p.metal : WOOD, 0.62, 0.03, 0.03, 0, y, 0.27); box(vt >= 3 ? p.metal : WOOD, 0.03, 0.03, 0.62, 0.27, y, 0); box(WOOD, 0.75, 0.025, 0.025, 0, y + 0.18, 0.28, { rz: 0.6 }); }
      // 平台 + 栏杆 + 尖顶 + 火盆 + 旗
      box(p.wall, 0.95, 0.1, 0.95, 0, h, 0);
      for (const [x, z, sx, sz] of [[0, 0.45, 0.95, 0.03], [0, -0.45, 0.95, 0.03], [0.45, 0, 0.03, 0.95], [-0.45, 0, 0.03, 0.95]]) box(p.post, sx, 0.22, sz, x, h + 0.16, z);
      for (const [x, z] of [[-0.43, -0.43], [0.43, -0.43], [-0.43, 0.43], [0.43, 0.43]]) box(p.post, 0.05, 0.6, 0.05, x, h + 0.3, z);
      add(G.cone4, p.roof, { sx: 0.95, sy: 0.45, sz: 0.95, y: h + 0.82, ry: Math.PI / 4 });
      add(G.cone4, SNOW, { sx: 0.55, sy: 0.25, sz: 0.55, y: h + 0.92, ry: Math.PI / 4 });
      box(p.post, 0.03, 0.5, 0.03, 0, h + 1.2, 0); box('#b03a2e', 0.3, 0.16, 0.01, 0.15, h + 1.36, 0);
      add(G.cyl8, DARK, { sx: 0.2, sy: 0.1, sz: 0.2, x: 0.25, y: h + 0.12, z: 0.25 });
      lit(G.cone5, p.glow, { sx: 0.16, sy: 0.22, sz: 0.16, x: 0.25, y: h + 0.27, z: 0.25 });
      if (vt >= 3) add(G.cyl6, '#2a2a2e', { sx: 0.1, sy: 0.55, sz: 0.1, rx: Math.PI / 2, x: -0.1, y: h + 0.22, z: 0.38 });
      // 梯子
      for (const sg of [-1, 1]) box(WOOD, 0.025, h, 0.025, sg * 0.1, h / 2 + 0.05, 0.46, { rx: -0.12 });
      for (let k = 1; k < 8; k++) box(WOOD, 0.2, 0.02, 0.02, 0, k * h / 8, 0.46 - (k * h / 8 - h / 2) * 0.12);
      break;
    }
    case 'lamp': {
      // 石墩 + 细铁杆 + 弯臂挂一盏玻璃灯（夜里亮），灯罩上积着雪；高级的是双灯
      const h = 1.2 + 0.04 * Math.min(lvl, 10), y0 = 0.2;
      add(G.cyl8, STONE, { sx: 0.3, sy: 0.18, sz: 0.3, y: 0.09, jit: 0.12 });
      add(G.cyl8, '#a0a6ae', { sx: 0.2, sy: 0.06, sz: 0.2, y: 0.2 });
      add(G.cyl6, p.metal, { sx: 0.06, sy: h, sz: 0.06, y: y0 + h / 2 });
      add(G.torus, p.metal, { s: 0.09, rx: Math.PI / 2, y: y0 + h * 0.3 });
      const arms = lvl >= 5 ? [1, -1] : [1];
      for (const sg of arms) {
        const ax = sg * 0.24;
        box(p.metal, 0.3, 0.03, 0.03, sg * 0.13, y0 + h, 0);
        box(p.metal, 0.02, 0.1, 0.02, ax, y0 + h - 0.05, 0);
        add(G.cone4, DARK, { sx: 0.19, sy: 0.1, sz: 0.19, x: ax, y: y0 + h - 0.08, ry: Math.PI / 4 });
        add(G.cone4, SNOW, { sx: 0.13, sy: 0.05, sz: 0.13, x: ax, y: y0 + h - 0.03, ry: Math.PI / 4 });
        lit(G.box, p.glow, { sx: 0.1, sy: 0.15, sz: 0.1, x: ax, y: y0 + h - 0.21 });
        box(DARK, 0.13, 0.02, 0.13, ax, y0 + h - 0.29, 0);
      }
      add(G.sph, '#c8a050', { s: 0.07, y: y0 + h + 0.04 });
      drift(-0.22, 0.22, 0.32, 0.2);
      break;
    }
    case 'flagpole': {
      // 石座 + 高木杆 + 一面红底的营旗（三段折出飘的样子）+ 拉绳
      const h = 2.1 + 0.05 * Math.min(lvl, 10);
      box(STONE, 0.42, 0.14, 0.42, 0, 0.07, 0, { jit: 0.12 });
      box('#a0a6ae', 0.3, 0.08, 0.3, 0, 0.18, 0);
      add(G.cyl6, WOOD2, { sx: 0.07, sy: h, sz: 0.07, y: 0.22 + h / 2 });
      add(G.sph, '#d8b060', { s: 0.09, y: 0.22 + h + 0.03 });
      const fc = vt >= 3 ? '#a8322a' : '#b8402e', fy = 0.22 + h - 0.3;
      for (let k = 0; k < 3; k++) box(k === 1 ? '#c85a3a' : fc, 0.24, 0.4, 0.02, 0.05 + 0.12 + k * 0.23, fy - k * 0.02, Math.sin(k * 1.7) * 0.05, { ry: (k % 2 ? 0.25 : -0.25) });
      box('#f0d090', 0.2, 0.06, 0.025, 0.4, fy - 0.02, Math.sin(1.7) * 0.05 + 0.005, { ry: 0.25 });
      box('#d8c8a8', 0.012, h - 0.4, 0.012, 0.06, 0.22 + (h - 0.4) / 2, 0.05);
      add(G.cyl6, p.metal, { sx: 0.05, sy: 0.08, sz: 0.05, x: 0.06, y: 0.5, z: 0.06 });
      drift(-0.2, 0.25, 0.3, 0.18);
      break;
    }
    case 'statue': {
      // 两级石台 + 铭牌 + 举火把的旅人（披风、帽兜）；高级换成铜像，火把夜里亮
      const brz = vt >= 3, c1 = brz ? '#8a6a3c' : '#9a9fa6', c2 = brz ? '#6e522c' : '#7e848c';
      box(STONE, 0.78, 0.16, 0.78, 0, 0.08, 0, { jit: 0.1 });
      box('#a4aab2', 0.6, 0.42, 0.6, 0, 0.37, 0, { jit: 0.06 });
      box(p.trim, 0.66, 0.05, 0.66, 0, 0.6, 0);
      box('#5a4a38', 0.32, 0.14, 0.02, 0, 0.36, 0.305);
      box('#c8a860', 0.26, 0.02, 0.022, 0, 0.4, 0.306); box('#c8a860', 0.2, 0.02, 0.022, 0, 0.34, 0.306);
      const y = 0.62;
      add(G.cone7, c2, { sx: 0.34, sy: 0.7, sz: 0.3, y: y + 0.35 });            // 披风
      add(G.cyl8, c1, { sx: 0.2, sy: 0.4, sz: 0.18, y: y + 0.48 });            // 身子
      add(G.sph, c1, { s: 0.17, y: y + 0.8 });                                  // 头
      add(G.cone6, c2, { sx: 0.22, sy: 0.16, sz: 0.22, y: y + 0.88 });          // 帽兜
      box(c1, 0.07, 0.36, 0.07, 0.12, y + 0.82, 0.02, { rz: -0.25 });           // 举火把的手
      add(G.cyl6, WOOD2, { sx: 0.035, sy: 0.24, sz: 0.035, x: 0.17, y: y + 1.04, z: 0.02 });
      lit(G.cone5, p.glow, { sx: 0.09, sy: 0.16, sz: 0.09, x: 0.17, y: y + 1.22, z: 0.02 });
      box(c1, 0.06, 0.28, 0.06, -0.12, y + 0.42, 0.04, { rz: 0.12 });            // 另一只手
      add(G.hemi, SNOW, { sx: 0.16, sy: 0.05, sz: 0.16, y: y + 0.93 });
      box(SNOW, 0.22, 0.03, 0.14, 0, y + 0.69, -0.02);
      drift(0.3, 0.3, 0.26, 0.16);
      break;
    }
    case 'flowerhouse': {
      // 半地下的花窖：木框玻璃顶、里面透出暖光，门口两排花箱开着红黄粉紫的花，侧面烟囱
      const w = 1.45, dd = 1.05, hh = 0.42;
      wall(w, hh, dd, 0, -0.18, 0.12, p.wall);
      // 玻璃屋顶：两面斜坡，木条分格
      for (const sg of [-1, 1]) {
        add(G.box, '#9fc4d8', { sx: w + 0.06, sy: 0.04, sz: dd * 0.62, x: 0, y: 0.12 + hh + 0.2, z: -0.18 + sg * dd * 0.27, rx: sg * 0.62 });
        for (let k = 0; k < 5; k++) add(G.box, WOOD2, { sx: 0.03, sy: 0.05, sz: dd * 0.64, x: -w / 2 + 0.03 + k * (w - 0.06) / 4, y: 0.12 + hh + 0.21, z: -0.18 + sg * dd * 0.27, rx: sg * 0.62 });
      }
      box(WOOD2, w + 0.08, 0.05, 0.06, 0, 0.12 + hh + 0.4, -0.18);
      lit(G.box, p.glow, { sx: w - 0.1, sy: 0.03, sz: 0.3, x: 0, y: 0.12 + hh + 0.24, z: -0.18 + dd * 0.22 });
      box(SNOW, 0.5, 0.03, 0.2, -0.4, 0.12 + hh + 0.33, -0.18 - dd * 0.22, { rx: -0.62 });
      door(0.35, -0.18 + dd / 2, 0.24, 0.34);
      win(-0.3, 0.12 + hh * 0.6, -0.18 + dd / 2 + 0.01, 0.24, 0.14);
      chimney(0.62, -0.5, 0.75);
      // 花箱
      const flw = ['#e0485a', '#f0c040', '#f08cb8', '#9a6ad8', '#f07a3a'];
      for (let r = 0; r < 2; r++) {
        const z = 0.55 + r * 0.24;
        box(WOOD, 1.3, 0.16, 0.16, -0.05, 0.08, z);
        box('#4a3628', 1.24, 0.03, 0.12, -0.05, 0.165, z);
        for (let k = 0; k < 9; k++) { const x = -0.65 + k * 0.15, c = flw[(k + r * 2) % flw.length]; add(G.cyl6, '#4a7a3a', { sx: 0.025, sy: 0.12, sz: 0.025, x, y: 0.22, z }); add(G.ico, c, { s: 0.09, x, y: 0.3, z, jit: 0.1 }); }
      }
      lantern(-0.82, 0.3, 0.6);
      break;
    }
    case 'infirmary': {
      // 浅色长病房（人字顶、一排窗）+ 门楣上白底绿十字的牌子 + 侧面小烟囱；
      // 门前：晾着白床单和绷带的绳子、盖着毯子的担架雪橇、药箱、水桶、长凳和一盏灯
      const wc = vt >= 3 ? '#c9c2b4' : '#b9ad98', hh = 0.7 * H, x0 = -0.05, z0 = -0.32, ww = 1.6, dd = 1.0;
      house(ww, hh, dd, x0, z0, 'gable', wc);
      win(x0 - ww * 0.42, 0.12 + hh * 0.62, z0 + dd / 2 + 0.01, 0.15, 0.17);
      win(x0 + ww * 0.42, 0.12 + hh * 0.62, z0 + dd / 2 + 0.01, 0.15, 0.17);
      win(x0 - ww / 2 - 0.01, 0.12 + hh * 0.6, z0, 0.16, 0.16, true);
      // 门楣上的牌子
      const sx = x0 - ww * 0.2, sy = 0.12 + Math.min(0.42, hh * 0.62) + 0.13, sz = z0 + dd / 2 + 0.04;
      box(p.post, 0.3, 0.22, 0.03, sx, sy, sz);
      box('#ece8e0', 0.26, 0.18, 0.02, sx, sy, sz + 0.012);
      box('#3f9a5a', 0.15, 0.045, 0.012, sx, sy, sz + 0.026); box('#3f9a5a', 0.045, 0.15, 0.012, sx, sy, sz + 0.026);
      chimney(x0 + 0.55, z0 - 0.3, 1.15);
      // 晾衣绳：两根杆、一根绳、三块白布、两条绷带
      const ly = 0.12 + 0.58, lz = 0.72;
      for (const xx of [-0.92, 0.12]) box(WOOD2, 0.04, 0.6, 0.04, xx, 0.12 + 0.3, lz);
      box('#d8d0c0', 1.04, 0.012, 0.012, -0.4, ly, lz);
      for (const [xx, w2, h2, c2] of [[-0.72, 0.22, 0.26, '#f2efe8'], [-0.46, 0.2, 0.3, '#e8eef2'], [-0.2, 0.22, 0.24, '#f2efe8']]) add(G.box, c2, { sx: w2, sy: h2, sz: 0.012, x: xx, y: ly - h2 / 2 - 0.01, z: lz, ry: 0.05, jit: 0.05 });
      for (const xx of [-0.04, 0.04]) box('#eadfca', 0.035, 0.2, 0.01, xx, ly - 0.11, lz);
      // 担架雪橇：滑板 + 毯子 + 枕头
      const tx = 0.6, tz = 0.6;
      for (const sg of [-1, 1]) box(WOOD2, 0.6, 0.03, 0.03, tx, 0.15, tz + sg * 0.11, { ry: 0.25 });
      add(G.box, WOOD, { sx: 0.56, sy: 0.04, sz: 0.24, x: tx, y: 0.19, z: tz, ry: 0.25 });
      add(G.box, '#8a4a3a', { sx: 0.42, sy: 0.05, sz: 0.25, x: tx + 0.05, y: 0.235, z: tz - 0.01, ry: 0.25, jit: 0.1 });
      add(G.box, '#e8e4dc', { sx: 0.12, sy: 0.05, sz: 0.18, x: tx - 0.2, y: 0.235, z: tz + 0.05, ry: 0.25 });
      // 药箱、水桶、长凳、灯
      crate(0.82, 0.86, 0.12, 0.16, '#d8d0c0', 0.2);
      box('#3f9a5a', 0.1, 0.03, 0.012, 0.82 + 0.02, 0.2, 0.86 + 0.082, { ry: 0.2 }); box('#3f9a5a', 0.03, 0.1, 0.012, 0.82 + 0.02, 0.2, 0.86 + 0.082, { ry: 0.2 });
      barrel(0.88, -0.05);
      box(WOOD, 0.5, 0.04, 0.14, 0.3, 0.3, 0.33); for (const xx of [0.1, 0.5]) box(WOOD2, 0.04, 0.16, 0.12, xx, 0.2, 0.33);
      lantern(-0.88, 0.25, 0.62);
      drift(0.7, -0.75, 0.3, 0.16);
      break;
    }
    case 'kennel': {
      // 后排三间小狗屋（拱门朝前，门楣上挂着名牌），前面用栅栏围出一块院子：雪橇、食盆、拴狗桩、草垛
      for (let i = 0; i < 3; i++) {
        const x = -0.6 + i * 0.6, z = -0.55;
        box(i === 1 ? WOOD2 : WOOD, 0.46, 0.32, 0.42, x, 0.28, z, { jit: 0.15 });
        add(gable(0.48, 0.2, 0.54), p.roof, { x, y: 0.44, z, ry: Math.PI / 2, jit: 0.1 });
        add(gable(0.3, 0.1, 0.56), SNOW, { x, y: 0.55, z: z - 0.06, ry: Math.PI / 2 });
        add(G.arch, DARK, { sx: 0.18, sy: 0.19, sz: 0.04, x, y: 0.12, z: z + 0.205 });
        box(['#c8a070', '#d8b080', '#b89060'][i], 0.16, 0.06, 0.015, x, 0.37, z + 0.215);
      }
      for (const [x0, z0, x1, z1] of [[-0.92, -0.2, -0.92, 0.9], [0.92, -0.2, 0.92, 0.9], [-0.92, 0.9, -0.22, 0.9], [0.22, 0.9, 0.92, 0.9]]) fence(x0, z0, x1, z1);
      // 雪橇斜靠在右边栅栏上
      box(WOOD, 0.18, 0.04, 0.55, 0.78, 0.2, 0.3, { rz: 0.35 }); box('#c8d0d8', 0.03, 0.02, 0.6, 0.7, 0.12, 0.3, { rz: 0.35 }); box('#c8d0d8', 0.03, 0.02, 0.6, 0.86, 0.28, 0.3, { rz: 0.35 });
      for (const x of [-0.45, -0.28]) { add(G.cyl8, '#5a6068', { sx: 0.13, sy: 0.04, sz: 0.13, x, y: 0.15, z: -0.06 }); add(G.cyl8, '#a05040', { sx: 0.09, sy: 0.01, sz: 0.09, x, y: 0.17, z: -0.06 }); }
      box(WOOD2, 0.05, 0.45, 0.05, 0.1, 0.35, -0.12); add(G.torus, '#a08060', { s: 0.1, rx: Math.PI / 2, x: 0.1, y: 0.5, z: -0.12 });
      add(G.dode, '#c8a860', { sx: 0.3, sy: 0.12, sz: 0.22, x: 0.32, y: 0.16, z: -0.08, jit: 0.2 });
      lantern(-0.82, 0.78, 0.55);
      break;
    }
    case 'scout': {
      add(gable(1.1, 0.75, 1.0), '#7a8a6a', { x: -0.25, y: 0.12, z: -0.1, jit: 0.1 });
      add(gable(1.12, 0.3, 0.42), SNOW, { x: -0.25, y: 0.48, z: -0.1 });
      add(G.cone4, '#2a3020', { sx: 0.32, sy: 0.5, sz: 0.04, x: 0.32, y: 0.34, z: -0.1, ry: Math.PI / 2 });
      // 旗杆 + 路标 + 雪橇 + 绳圈
      box(WOOD2, 0.05, 1.8, 0.05, 0.6, 1.0, 0.5);
      lit(G.box, '#e05040', { sx: 0.42, sy: 0.26, sz: 0.02, x: 0.82, y: 1.72, z: 0.5 });
      box(WOOD2, 0.04, 0.7, 0.04, -0.6, 0.45, 0.6);
      for (const [y, a] of [[0.7, 0.3], [0.58, -0.4]]) box('#c8a070', 0.4, 0.09, 0.02, -0.45, y, 0.6, { ry: a });
      box(WOOD, 0.55, 0.04, 0.22, 0.05, 0.16, 0.6); box('#c8d0d8', 0.6, 0.02, 0.03, 0.05, 0.14, 0.7);
      crate(0.05, 0.58, 0.18, 0.16, '#8a6a48');
      add(G.torus, '#a08060', { s: 0.2, rx: Math.PI / 2, x: -0.2, y: 0.15, z: 0.35 });
      break;
    }
    case 'coalmine': case 'ironmine': case 'limequarry': case 'shalepit': case 'crystalmine': case 'salvage': case 'excavator': {
      const ore = { coalmine: '#2a2a30', ironmine: '#9a5a3a', limequarry: '#e6e0cc', shalepit: '#40363a', crystalmine: '#7fe8ff', salvage: '#b080ff', excavator: '#ff9a40' }[type];
      const glowOre = type === 'crystalmine' || type === 'excavator' || type === 'salvage';
      // 山体 + 矿口（拱形木框）+ 轨道 + 矿车
      add(G.dode, '#7d8088', { sx: 1.3, sy: 0.9, sz: 0.9, x: -0.25, y: 0.3, z: -0.45, jit: 0.2 });
      add(G.dode, SNOW, { sx: 1.0, sy: 0.35, sz: 0.65, x: -0.25, y: 0.68, z: -0.5 });
      add(G.arch, DARK, { sx: 0.42, sy: 0.4, sz: 0.2, x: -0.25, y: 0.12, z: -0.02 });
      for (const sg of [-1, 1]) box(WOOD2, 0.07, 0.5, 0.07, -0.25 + sg * 0.25, 0.37, 0.05);
      box(WOOD2, 0.6, 0.08, 0.08, -0.25, 0.64, 0.05);
      for (const sg of [-1, 1]) box('#8a96a3', 0.03, 0.03, 0.85, -0.25 + sg * 0.1, 0.14, 0.45);
      for (let k = 0; k < 5; k++) box(WOOD, 0.3, 0.025, 0.06, -0.25, 0.13, 0.12 + k * 0.17);
      box(p.metal, 0.3, 0.18, 0.22, -0.25, 0.27, 0.62); box(DARK, 0.26, 0.04, 0.18, -0.25, 0.37, 0.62);
      for (let i = 0; i < 3; i++) (glowOre ? K.lit : add)(G.dode, ore, { s: 0.1, x: -0.32 + i * 0.07, y: 0.4, z: 0.62 });
      // 矿石堆
      for (let i = 0; i < 6; i++) (glowOre ? K.lit : add)(G.dode, ore, { s: 0.16 + (i % 3) * 0.05, x: 0.45 + (i % 3) * 0.15, y: 0.18 + Math.floor(i / 3) * 0.12, z: 0.5 - (i % 2) * 0.12, jit: 0.25 });
      // 井架（天轮）
      if (type !== 'limequarry') {
        const hh = type === 'excavator' ? 2.0 : 1.4;
        for (const sg of [-1, 1]) box(vt >= 3 ? p.metal : WOOD2, 0.06, hh, 0.06, 0.55 + sg * 0.18, 0.12 + hh / 2, -0.45, { rz: -sg * 0.12 });
        box(vt >= 3 ? p.metal : WOOD2, 0.06, hh * 0.9, 0.06, 0.55, 0.1 + hh * 0.45, -0.15, { rx: 0.35 });
        add(G.wheel, p.metal, { s: 0.45, x: 0.55, y: 0.12 + hh, z: -0.45 });
        box(DARK, 0.04, 0.04, 0.12, 0.55, 0.12 + hh, -0.45);
      } else if (!deep) {
        for (let k = 0; k < 3; k++) box('#d6ceb4', 0.6 - k * 0.15, 0.12, 0.5 - k * 0.12, 0.45, 0.18 + k * 0.12, -0.4, { jit: 0.1 });
      }
      if (type === 'shalepit' || type === 'excavator') { vpipe(-0.75, 0.55, 0.9, 0.12, 0.07); pipe(-0.75, 0.55, -0.75, 0.2, 1.0, 0.06); }
      if (type === 'salvage') { box(p.trim, 0.08, 1.8, 0.08, -0.75, 0.9, 0.5); box(p.trim, 1.0, 0.07, 0.07, -0.35, 1.75, 0.5); box(DARK, 0.01, 0.5, 0.01, 0.1, 1.5, 0.5); }
      if (vt >= 3) chimney(-0.7, -0.7, 0.9);
      if (deep) {
        // 深井：井架加高成钢桁架，顶上一盏红灯；旁边一间蒸汽绞车房，钢缆连到天轮
        const hh = type === 'excavator' ? 2.0 : type === 'limequarry' ? 0 : 1.4, top = 0.12 + hh;
        if (hh) {
          for (const sg of [-1, 1]) box(p.metal, 0.05, 0.62, 0.05, 0.55 + sg * 0.1, top + 0.31, -0.45);
          for (let k = 0; k < 3; k++) box(p.metal, 0.24, 0.03, 0.03, 0.55, top + 0.12 + k * 0.2, -0.45);
          add(G.wheel, p.trim, { s: 0.34, x: 0.55, y: top + 0.62, z: -0.45 });
          lit(G.oct, '#ff4a2a', { s: 0.09, x: 0.55, y: top + 0.78, z: -0.45 });
        } else {
          // 石灰岩床没有井架：露天深坑 + 梯子 + 吊杆
          // 一圈圈往下的台阶，越往里越暗
          add(G.cyl12, '#d6ceb4', { sx: 0.78, sy: 0.06, sz: 0.66, x: 0.45, y: 0.14, z: -0.4, jit: 0.05 });
          add(G.cyl12, '#a89f86', { sx: 0.6, sy: 0.02, sz: 0.5, x: 0.45, y: 0.175, z: -0.4 });
          add(G.cyl12, '#5a5446', { sx: 0.42, sy: 0.02, sz: 0.34, x: 0.45, y: 0.185, z: -0.4 });
          add(G.cyl12, '#1e1c18', { sx: 0.24, sy: 0.02, sz: 0.2, x: 0.45, y: 0.195, z: -0.4 });
          for (const sg of [-1, 1]) box(WOOD2, 0.04, 0.5, 0.04, 0.45 + sg * 0.08, 0.3, -0.12, { rx: -0.35 });
          box(WOOD2, 0.05, 1.2, 0.05, 0.75, 0.72, -0.7); box(WOOD2, 0.6, 0.05, 0.05, 0.5, 1.3, -0.62, { ry: 0.4 });
          lit(G.oct, '#ff4a2a', { s: 0.08, x: 0.75, y: 1.38, z: -0.7 });
        }
        box(p.wall2, 0.34, 0.3, 0.3, 0.8, 0.27, 0.0, { jit: 0.06 });
        add(G.cone4, p.roof, { sx: 0.32, sy: 0.18, sz: 0.28, x: 0.8, y: 0.51, z: 0.0, ry: Math.PI / 4 });
        add(G.cyl8, p.metal, { sx: 0.1, sy: 0.32, sz: 0.1, x: 0.88, y: 0.66, z: -0.08 });
        lit(G.box, p.glow, { sx: 0.1, sy: 0.08, sz: 0.01, x: 0.8, y: 0.3, z: 0.155 });
        if (hh) { // 钢缆：绞车房顶 → 天轮
          const a0 = [0.8, 0.6, 0.0], a1 = [0.55, top, -0.45], dv = a1.map((v, k) => v - a0[k]), L = Math.hypot(...dv);
          add(G.box, DARK, { sx: 0.014, sy: 0.014, sz: L, x: (a0[0] + a1[0]) / 2, y: (a0[1] + a1[1]) / 2, z: (a0[2] + a1[2]) / 2, ry: Math.atan2(dv[0], dv[2]), rx: -Math.asin(dv[1] / L), order: 'YXZ' });
        }
      }
      break;
    }
    case 'smelter': case 'coker': case 'steelworks': {
      const wc = type === 'steelworks' ? p.wall2 : type === 'coker' ? '#5a4a42' : '#8a4a38';
      house(1.25, 0.82 * H, 0.95, -0.2, -0.15, 'flat', wc);
      stack(0.58, -0.5, type === 'steelworks' ? 2.4 : 1.7, p.wall2, 0.34);
      if (type === 'steelworks') stack(0.58, 0.12, 2.0, p.wall2, 0.28);
      // 出铁口：发光的流槽和铁水桶
      box(DARK, 0.5, 0.36, 0.05, -0.2, 0.32, 0.34);
      lit(G.box, '#ff7a20', { sx: 0.42, sy: 0.26, sz: 0.04, x: -0.2, y: 0.3, z: 0.36 });
      box(p.metal, 0.12, 0.05, 0.4, -0.2, 0.2, 0.55, { rx: 0.15 });
      lit(G.box, '#ffb040', { sx: 0.07, sy: 0.02, sz: 0.36, x: -0.2, y: 0.23, z: 0.55, rx: 0.15 });
      add(G.cyl8, '#3a3a40', { sx: 0.28, sy: 0.2, sz: 0.28, x: -0.2, y: 0.22, z: 0.78 });
      lit(G.cyl8, '#ffa030', { sx: 0.22, sy: 0.02, sz: 0.22, x: -0.2, y: 0.33, z: 0.78 });
      if (type === 'coker') for (let k = 0; k < 4; k++) add(G.dode, '#3a3638', { s: 0.18, x: 0.45 + (k % 2) * 0.18, y: 0.2 + Math.floor(k / 2) * 0.12, z: 0.6 });
      else for (let k = 0; k < 3; k++) box(type === 'steelworks' ? '#9aa6b4' : '#7a7f88', 0.32, 0.07, 0.12, 0.5, 0.16 + k * 0.075, 0.62);
      break;
    }
    case 'gearworks': {
      house(1.4, 0.88 * H, 1.05, 0, -0.2, 'flat', p.wall2);
      add(G.gear, p.trim, { s: 0.85, x: 0.12, y: 0.78, z: 0.34 });
      add(G.gear, p.metal, { s: 0.5, x: -0.4, y: 0.62, z: 0.34, rz: 0.3 });
      chimney(-0.5, -0.5, 1.6);
      vpipe(0.6, 0.45, 0.6); crate(-0.6, 0.62, 0.12, 0.18, '#7a7f88');
      break;
    }
    case 'engineworks': {
      house(1.3, 0.88 * H, 1.0, -0.1, -0.3, 'gable', p.wall2);
      // 门前一台蒸汽机：锅炉 + 飞轮 + 活塞
      add(G.cyl12, p.metal, { sx: 0.42, sy: 0.9, sz: 0.42, rz: Math.PI / 2, x: -0.15, y: 0.38, z: 0.55 });
      for (const x of [-0.5, 0.2]) add(G.torus16, p.trim, { s: 0.44, ry: Math.PI / 2, x, y: 0.38, z: 0.55 });
      add(G.wheel, DARK, { s: 0.55, x: 0.45, y: 0.4, z: 0.55 });
      box(p.trim, 0.3, 0.05, 0.05, 0.35, 0.45, 0.55, { rz: 0.3 });
      vpipe(-0.35, 0.55, 0.55, 0.5, 0.05);
      chimney(0.55, -0.6, 1.9);
      break;
    }
    case 'greenhouse': {
      box(p.base, 1.75, 0.28, 1.45, 0, 0.26, 0);
      // 玻璃拱顶 + 钢肋 + 里面的绿色
      lit(G.box, '#7fc898', { sx: 1.62, sy: 0.02, sz: 1.32, y: 0.41 });
      add(gable(1.75, 0.8, 1.45), '#a8d8c0', { y: 0.4 });
      for (let k = 0; k <= 4; k++) { const x = -0.85 + k * 0.425; add(gable(0.04, 0.82, 1.48), p.metal, { x, y: 0.4 }); }
      box(p.metal, 1.8, 0.05, 0.05, 0, 1.22, 0);
      for (let i = 0; i < 8; i++) lit(G.sph, i % 2 ? '#58b868' : '#3e9a50', { s: 0.2, x: -0.6 + (i % 4) * 0.4, y: 0.52, z: -0.3 + Math.floor(i / 4) * 0.6 });
      add(gable(1.0, 0.32, 0.5), SNOW, { x: -0.3, y: 0.9, z: 0 });
      chimney(0.75, -0.65, 1.4);
      break;
    }
    case 'heater': {
      add(G.cyl12, p.metal, { sx: 0.62, sy: 0.72, sz: 0.62, y: 0.48, jit: 0.08 });
      for (let k = 0; k < 3; k++) add(G.torus16, p.trim, { s: 0.64, rx: Math.PI / 2, y: 0.22 + k * 0.24 });
      lit(G.box, '#ff8a30', { sx: 0.24, sy: 0.18, sz: 0.02, y: 0.38, z: 0.31 });
      for (let b = -1; b <= 1; b++) box(DARK, 0.02, 0.18, 0.02, b * 0.07, 0.38, 0.33);
      add(G.cone8, p.roof, { sx: 0.7, sy: 0.25, sz: 0.7, y: 0.97 });
      chimney(0, 0, 1.45);
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + 0.78; pipe(Math.cos(a) * 0.3, Math.sin(a) * 0.3, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.2, 0.04); }
      break;
    }
    case 'refinery': {
      for (const [x, z, r, h] of [[-0.45, -0.35, 0.7, 0.95], [0.45, -0.35, 0.62, 1.15], [-0.05, 0.42, 0.52, 0.72]]) {
        add(G.cyl16, p.metal, { sx: r, sy: h, sz: r, x, y: 0.12 + h / 2, z, jit: 0.05 });
        add(G.hemi, SNOW, { sx: r * 0.98, sy: 0.12, sz: r * 0.98, x, y: 0.12 + h, z });
        add(G.torus16, p.trim, { s: r * 1.02, rx: Math.PI / 2, x, y: 0.12 + h * 0.4, z });
        for (let k = 0; k < 4; k++) box(DARK, 0.02, h * 0.95, 0.02, x + r * 0.5 * Math.cos(k * 1.57 + 0.4), 0.12 + h / 2, z + r * 0.5 * Math.sin(k * 1.57 + 0.4));
      }
      pipe(-0.45, -0.35, 0.45, -0.35, 0.95, 0.05); pipe(-0.05, 0.42, 0.45, -0.35, 0.55, 0.05);
      stack(0.7, 0.5, 2.0, p.wall2, 0.24);
      lit(G.cone5, '#ffa030', { sx: 0.12, sy: 0.25, sz: 0.12, x: 0.7, y: 2.3, z: 0.5 });
      barrel(-0.7, 0.65, 0.12, '#2a2226');
      break;
    }
    case 'sealworks': {
      house(1.4, 0.78, 0.95, 0, -0.25, 'flat', p.wall2);
      for (let i = 0; i < 3; i++) add(G.cyl8, p.trim, { sx: 0.12, sy: 1.3, sz: 0.12, rz: Math.PI / 2, x: 0, y: 0.25 + i * 0.13, z: 0.5 });
      for (let i = 0; i < 4; i++) add(G.torus, '#2a2226', { s: 0.22, x: -0.55 + i * 0.12, y: 0.25, z: 0.72, rx: 0.2 });
      barrel(0.6, 0.65, 0.12, '#2a2226');
      vpipe(-0.5, -0.65, 1.3);
      break;
    }
    case 'batteryworks': {
      house(1.3, 0.8, 0.95, -0.1, -0.3, 'flat');
      for (let i = 0; i < 4; i++) { add(G.box, p.metal, { sx: 0.24, sy: 0.4, sz: 0.24, x: -0.5 + i * 0.32, y: 0.32, z: 0.55 }); lit(G.box, '#40c8f0', { sx: 0.18, sy: 0.28, sz: 0.02, x: -0.5 + i * 0.32, y: 0.32, z: 0.68 }); box(SNOW, 0.22, 0.03, 0.22, -0.5 + i * 0.32, 0.535, 0.55); }
      for (let k = 0; k < 3; k++) box('#d0a040', 0.02, 0.02, 0.6, -0.5 + k * 0.4, 0.92 + 0.15, -0.3);
      vpipe(0.62, -0.55, 1.3, 0.12, 0.04, '#d0a040');
      break;
    }
    case 'alloyworks': {
      house(1.3, 0.9, 1.05, -0.15, -0.2, 'pyr');
      stack(0.6, -0.55, 2.0, p.wall2, 0.3);
      lit(G.box, '#a8f0e0', { sx: 0.48, sy: 0.3, sz: 0.04, x: -0.15, y: 0.42, z: 0.35 });
      for (let k = 0; k < 3; k++) { box('#c8e8f0', 0.36, 0.06, 0.14, 0.5, 0.16 + k * 0.065, 0.62); }
      lit(G.oct, p.trim, { s: 0.2, x: -0.65, y: 0.25, z: 0.65 });
      break;
    }
    case 'partworks': {
      house(1.4, 0.92, 1.05, 0, -0.25, 'pyr');
      for (let i = 0; i < 3; i++) lit(G.oct, '#c8a0ff', { s: 0.24, x: -0.5 + i * 0.5, y: 0.34, z: 0.62 });
      for (let i = 0; i < 3; i++) box(p.metal, 0.12, 0.2, 0.12, -0.5 + i * 0.5, 0.2, 0.62);
      add(G.gear, p.trim, { s: 0.4, x: 0.55, y: 0.75, z: 0.29 });
      break;
    }
    case 'coreworks': {
      add(G.cyl12, p.base, { sx: 1.7, sy: 0.25, sz: 1.7, y: 0.25 });
      add(G.sph2, p.wall, { sx: 1.45, sy: 1.2, sz: 1.45, y: 0.6 });
      for (let k = 0; k < 3; k++) add(G.torus16, p.trim, { s: 1.48 - k * 0.12, rx: Math.PI / 2 + (k - 1) * 0.3, y: 0.7 + k * 0.08 });
      lit(G.sph2, '#ff80d0', { s: 0.38, y: 1.3 });
      for (let k = 0; k < 4; k++) { const a = k * 1.57; vpipe(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.5, 0.12, 0.05); }
      chimney(0.7, -0.7, 1.5);
      break;
    }
    case 'bay': {
      house(1.7, 1.0, 1.35, 0, -0.15, 'flat', p.wall2);
      box('#2a2a30', 1.0, 0.72, 0.04, 0, 0.5, 0.53);
      for (let k = 1; k < 6; k++) box('#3a3a42', 1.0, 0.02, 0.02, 0, 0.14 + k * 0.12, 0.56);
      lit(G.box, '#ff80d0', { sx: 1.0, sy: 0.03, sz: 0.02, x: 0, y: 0.88, z: 0.56 });
      lit(G.sph, '#ff80d0', { s: 0.18, y: 1.32, x: 0.55 });
      for (let k = 0; k < 2; k++) { add(G.box, p.metal, { sx: 0.18, sy: 0.24, sz: 0.14, x: -0.6 + k * 0.3, y: 0.3, z: 0.75 }); lit(G.box, '#ff80d0', { sx: 0.1, sy: 0.04, sz: 0.01, x: -0.6 + k * 0.3, y: 0.36, z: 0.825 }); add(G.box, p.metal, { s: 0.12, x: -0.6 + k * 0.3, y: 0.5, z: 0.75 }); }
      break;
    }
    case 'forge': {
      house(1.3, 1.0, 1.05, -0.15, -0.25, 'flat', '#5a3a2a');
      stack(0.6, -0.55, 2.6, p.wall2, 0.34);
      lit(G.box, '#ffd060', { sx: 0.6, sy: 0.45, sz: 0.04, x: -0.15, y: 0.46, z: 0.29 });
      // 铁砧 + 炉心碎片
      box(DARK, 0.3, 0.12, 0.14, 0.35, 0.3, 0.6); box(DARK, 0.14, 0.14, 0.1, 0.35, 0.18, 0.6);
      lit(G.oct, '#ffd060', { s: 0.32, x: -0.55, y: 0.35, z: 0.62 });
      lit(G.oct, '#ffb030', { s: 0.2, x: -0.35, y: 0.25, z: 0.72 });
      break;
    }
    case 'workshop': {
      // 工程站：平顶工房 + 屋顶黄铜观测穹顶和望远镜 + 墙上大齿轮 + 门前绘图桌和图纸卷
      house(1.3, 0.82 * H, 1.0, -0.12, -0.25, 'flat', p.wall);
      const ry = 0.12 + 0.82 * H + 0.12;
      add(G.cyl12, p.trim, { sx: 0.62, sy: 0.08, sz: 0.62, x: 0.12, y: ry + 0.04, z: -0.35 });
      add(G.hemi, '#b8873e', { sx: 0.3, sy: 0.3, sz: 0.3, x: 0.12, y: ry + 0.08, z: -0.35 });
      box(DARK, 0.08, 0.32, 0.3, 0.12, ry + 0.22, -0.2, { rx: -0.5 });
      add(G.cyl8, '#d8b878', { sx: 0.1, sy: 0.7, sz: 0.1, x: 0.12, y: ry + 0.38, z: -0.04, rx: 0.9 });
      add(G.cyl8, DARK, { sx: 0.12, sy: 0.04, sz: 0.12, x: 0.12, y: ry + 0.6, z: 0.24, rx: 0.9 });
      add(G.gear, p.trim, { s: 0.5, x: -0.62, y: 0.62, z: 0.27 });
      add(G.gear, p.metal, { s: 0.3, x: -0.36, y: 0.82, z: 0.27, rz: 0.4 });
      chimney(-0.62, -0.55, 1.35);
      // 绘图桌：斜面上铺着蓝图，旁边一盏灯
      for (const [x, z] of [[0.28, 0.5], [0.66, 0.5], [0.28, 0.78], [0.66, 0.78]]) box(WOOD2, 0.04, 0.34, 0.04, x, 0.29, z);
      box(WOOD, 0.5, 0.04, 0.4, 0.47, 0.48, 0.64, { rx: 0.35 });
      box('#3a6aa8', 0.42, 0.012, 0.32, 0.47, 0.505, 0.64, { rx: 0.35 });
      box('#d8e6f8', 0.3, 0.004, 0.02, 0.47, 0.513, 0.6, { rx: 0.35 });
      box('#d8e6f8', 0.02, 0.004, 0.2, 0.4, 0.513, 0.64, { rx: 0.35 });
      for (const [x, z, c] of [[-0.1, 0.62, '#c8d8ee'], [-0.02, 0.7, '#a8c0e0'], [-0.18, 0.72, '#d8e4f4']]) add(G.cyl8, c, { sx: 0.07, sy: 0.38, sz: 0.07, rz: Math.PI / 2, x, y: 0.16, z });
      lantern(0.82, 0.3, 0.6);
      crate(-0.62, 0.7, 0.12, 0.18, '#9a7a58', 0.4);
      break;
    }
    default: house(1.2, 0.8, 1.0);
  }
  // 高层级：屋檐下一圈装饰条
  if (vt >= 4 && type !== 'furnace' && type !== 'tower') box(p.trim, s - 0.2, 0.05, 0.05, 0, 0.15, s / 2 - 0.12);
  let flame = null, flameY = 0;
  if (type === 'furnace') {
    const r = 1.08 + 0.025 * Math.min(lvl, 20), h = 1.15 + 0.075 * Math.min(lvl, 25);
    flameY = 0.32 + h + 0.26;
    flame = merge(furnaceFlame(r, lvl));
  }
  return { geo: merge(parts), glow: glow.length ? merge(glow) : null, flame, flameY, h: type === 'furnace' ? 3 : 1.5 };
}

// 熔炉的火焰：一簇歪斜的火舌，外红内黄，中心发白（原点在炭床上，便于动画缩放）
function furnaceFlame(r, lvl) {
  const out = [];
  const big = 1 + Math.min(lvl, 25) * 0.025;
  const tongues = [[0, 0, 1.25, 0.62, '#ff6a18'], [0.32, 0.18, 0.95, 0.42, '#ff7a20'], [-0.3, 0.22, 1.0, 0.44, '#ff6a18'], [0.1, -0.34, 0.9, 0.4, '#ff8424'], [-0.22, -0.26, 0.8, 0.36, '#ff7a20'], [0.38, -0.12, 0.7, 0.3, '#ff9030']];
  tongues.forEach(([x, z, hh, w, c], i) => {
    const H = hh * big * 0.78, Wd = w * r * 0.8;
    out.push(P(G.cone5, c, { sx: Wd, sy: H, sz: Wd, x: x * r, y: H / 2, z: z * r, ry: i * 1.3, rz: -x * 0.35, rx: z * 0.35 }));
    out.push(P(G.cone5, '#ffc040', { sx: Wd * 0.6, sy: H * 0.75, sz: Wd * 0.6, x: x * r * 0.9, y: H * 0.375, z: z * r * 0.9, ry: i * 1.3 + 0.6, rz: -x * 0.3, rx: z * 0.3 }));
  });
  out.push(P(G.cone6, '#fff2b8', { sx: r * 0.3, sy: 0.6 * big, sz: r * 0.3, y: 0.3 * big }));
  // 飞起的火星
  for (let k = 0; k < 5; k++) out.push(P(G.oct, '#ffd070', { s: 0.06 + (k % 2) * 0.03, x: Math.cos(k * 2.3) * r * 0.5, y: (1.05 + k * 0.2) * big, z: Math.sin(k * 2.3) * r * 0.5 }));
  return out;
}

// ---------- 资源点 ----------
export function spotGeo(kind) {
  switch (kind) {
    case 'tree': {
      // 层层叠叠的冷杉，每层上沿压着雪
      const parts = [P(G.cyl6, '#4a3020', { sx: 0.11, sy: 0.4, sz: 0.11, y: 0.2 })];
      const layers = [[0.78, 0.5, 0.42], [0.62, 0.48, 0.72], [0.46, 0.44, 0.99], [0.3, 0.4, 1.24]];
      layers.forEach(([r, h, y], i) => {
        parts.push(P(G.cone7, i % 2 ? '#2f5a46' : '#2a5040', { sx: r, sy: h, sz: r, y, ry: i * 0.6, jit: 0.18 }));
        parts.push(P(G.cone7o, SNOW, { sx: r * 0.62, sy: h * 0.42, sz: r * 0.62, y: y + h * 0.3, ry: i * 0.6 + 0.2 }));
      });
      parts.push(P(G.cone5, SNOW, { sx: 0.14, sy: 0.2, sz: 0.14, y: 1.48 }));
      return merge(parts);
    }
    case 'rock': return merge([P(G.dode, '#8e959e', { sx: 0.55, sy: 0.4, sz: 0.5, y: 0.15, jit: 0.2 }), P(G.dode, '#a3aab3', { s: 0.32, x: 0.3, y: 0.1, z: 0.15, jit: 0.15 }), P(G.dode, '#7d848e', { s: 0.22, x: -0.28, y: 0.08, z: -0.18 }), P(G.dode, SNOW, { sx: 0.38, sy: 0.12, sz: 0.32, y: 0.33 }), P(G.dode, SNOW, { sx: 0.2, sy: 0.08, sz: 0.18, x: 0.3, y: 0.22, z: 0.15 })]);
    case 'herd': return deerGeo().body;
    case 'coal': return merge([P(G.dode, '#2c2c32', { sx: 0.6, sy: 0.35, sz: 0.55, y: 0.12, jit: 0.3 }), P(G.dode, '#1e1e22', { s: 0.35, x: -0.3, y: 0.1, z: 0.2, jit: 0.3 }), P(G.dode, '#36363c', { s: 0.22, x: 0.32, y: 0.08, z: -0.15 }), P(G.dode, SNOW, { sx: 0.4, sy: 0.1, sz: 0.3, x: 0.1, y: 0.28 })]);
    case 'ore': return merge([P(G.dode, '#7a5040', { sx: 0.6, sy: 0.45, sz: 0.55, y: 0.18, jit: 0.25 }), P(G.dode, '#6a4436', { s: 0.3, x: -0.3, y: 0.1, z: 0.2 }), P(G.oct, '#d07a3a', { s: 0.22, x: 0.25, y: 0.3, z: 0.15 }), P(G.oct, '#c0703a', { s: 0.16, x: -0.2, y: 0.32, z: -0.1 }), P(G.dode, SNOW, { sx: 0.35, sy: 0.1, sz: 0.3, y: 0.4 })]);
    case 'lime': return merge([P(G.box, '#e6e0cc', { sx: 0.5, sy: 0.3, sz: 0.4, y: 0.15, ry: 0.3, jit: 0.1 }), P(G.box, '#d6ceb4', { sx: 0.35, sy: 0.25, sz: 0.3, x: 0.3, y: 0.12, z: 0.2, ry: 0.9 }), P(G.box, '#ece6d4', { sx: 0.25, sy: 0.18, sz: 0.22, x: -0.28, y: 0.09, z: -0.18, ry: 0.5 })]);
    case 'shale': return merge([P(G.cyl8, '#1a1416', { sx: 0.9, sy: 0.03, sz: 0.7, y: 0.02 }), P(G.box, '#4a3c40', { sx: 0.5, sy: 0.15, sz: 0.35, y: 0.1, ry: 0.4 }), P(G.box, '#40363a', { sx: 0.4, sy: 0.12, sz: 0.3, x: 0.25, y: 0.2, z: -0.1, ry: 1.1 }), P(G.box, '#c8d8e8', { sx: 0.3, sy: 0.04, sz: 0.25, x: -0.15, y: 0.2, z: 0.05, ry: 0.2 })]);
    case 'crystal': return merge([P(G.oct, '#7fe8ff', { sx: 0.2, sy: 0.8, sz: 0.2, y: 0.4, rz: 0.2 }), P(G.oct, '#a0f0ff', { sx: 0.15, sy: 0.55, sz: 0.15, x: 0.2, y: 0.28, rz: -0.4 }), P(G.oct, '#60d0f0', { sx: 0.14, sy: 0.5, sz: 0.14, x: -0.18, y: 0.25, z: 0.12, rx: 0.4 }), P(G.oct, '#b8f6ff', { sx: 0.1, sy: 0.35, sz: 0.1, x: 0.05, y: 0.18, z: -0.2, rx: -0.5 })]);
    case 'star': return merge([P(G.tet, '#6a5a86', { sx: 0.9, sy: 0.7, sz: 0.6, y: 0.25, ry: 0.5 }), P(G.box, '#9a8ab4', { sx: 0.7, sy: 0.08, sz: 0.2, x: 0.2, y: 0.45, rz: 0.4 }), P(G.box, '#8a7aa4', { sx: 0.08, sy: 0.5, sz: 0.08, x: -0.3, y: 0.3, z: -0.1, rz: -0.3 }), P(G.oct, '#c080ff', { s: 0.18, x: -0.25, y: 0.2, z: 0.2 })]);
    case 'shard': return merge([P(G.oct, '#ff9a40', { sx: 0.3, sy: 0.6, sz: 0.3, y: 0.3 }), P(G.oct, '#ffc060', { s: 0.2, x: 0.25, y: 0.15, z: 0.1 }), P(G.oct, '#ffb050', { sx: 0.12, sy: 0.3, sz: 0.12, x: -0.2, y: 0.15, z: -0.12, rz: 0.4 }), P(G.dode, '#5a4a3a', { sx: 0.6, sy: 0.15, sz: 0.5, y: 0.04 })]);
  }
}
export const SPOT_GLOW = new Set(['crystal', 'shard', 'star']);

// 驯鹿：身体与头分开，头绕脖子根转动（低头吃草、抬头张望）
export const DEER_NECK = [0, 0.42, 0.2];
export function deerGeo() {
  const fur = '#7a5a40', light = '#d8c8b0', dark = '#3a2a1e', horn = '#e8dcc0';
  const body = merge([
    P(G.box, fur, { sx: 0.18, sy: 0.18, sz: 0.42, y: 0.34, jit: 0.1 }),
    P(G.box, light, { sx: 0.16, sy: 0.06, sz: 0.36, y: 0.25 }),
    P(G.box, light, { sx: 0.17, sy: 0.15, sz: 0.09, y: 0.4, z: 0.19 }),
    ...[[-0.06, -0.15], [0.06, -0.15], [-0.06, 0.15], [0.06, 0.15]].map(([x, z]) => P(G.box, dark, { sx: 0.04, sy: 0.26, sz: 0.04, x, y: 0.13, z })),
    P(G.box, light, { sx: 0.06, sy: 0.06, sz: 0.04, y: 0.42, z: -0.22 }),
    P(G.box, SNOW, { sx: 0.12, sy: 0.02, sz: 0.2, y: 0.435, z: -0.04 }),
  ]);
  const head = merge([
    P(G.box, fur, { sx: 0.1, sy: 0.17, sz: 0.1, y: 0.06, z: 0.04, rx: -0.4 }),
    P(G.box, fur, { sx: 0.1, sy: 0.1, sz: 0.18, y: 0.15, z: 0.11 }),
    P(G.box, '#5e4430', { sx: 0.08, sy: 0.07, sz: 0.06, y: 0.13, z: 0.21 }),
    P(G.box, dark, { sx: 0.05, sy: 0.04, sz: 0.03, y: 0.14, z: 0.245 }),
    ...[-1, 1].flatMap(sg => [
      P(G.box, horn, { sx: 0.02, sy: 0.2, sz: 0.02, x: sg * 0.05, y: 0.29, z: 0.07, rz: sg * 0.4 }),
      P(G.box, horn, { sx: 0.02, sy: 0.1, sz: 0.02, x: sg * 0.11, y: 0.35, z: 0.11, rz: -sg * 0.3, rx: 0.4 }),
      P(G.box, horn, { sx: 0.02, sy: 0.09, sz: 0.02, x: sg * 0.1, y: 0.32, z: 0.03, rz: sg * 0.9 }),
      P(G.box, fur, { sx: 0.05, sy: 0.03, sz: 0.02, x: sg * 0.07, y: 0.2, z: 0.05, rz: sg * 0.5 }),
    ]),
  ]);
  return { body, head };
}

// 流星坑：焦黑的坑 + 翻起来的雪 + 中间半埋的陨石，裂缝里发光
export function meteorGeo(glowCol = '#ff8a30') {
  const parts = [P(G.cyl12, '#2a2422', { sx: 1.3, sy: 0.03, sz: 1.2, y: 0.02 }), P(G.cyl12, '#4a3c36', { sx: 0.9, sy: 0.04, sz: 0.85, y: 0.03 })];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; parts.push(P(G.dode, k % 2 ? '#e8eef4' : '#c8d0d8', { sx: 0.32, sy: 0.14, sz: 0.22, x: Math.cos(a) * 0.62, y: 0.05, z: Math.sin(a) * 0.58, ry: -a, jit: 0.15 })); }
  parts.push(P(G.dode, '#2e2830', { sx: 0.42, sy: 0.32, sz: 0.38, y: 0.12, rx: 0.3, jit: 0.25 }), P(G.dode, '#3a3238', { s: 0.18, x: 0.28, y: 0.06, z: 0.12, jit: 0.2 }), P(G.dode, '#3a3238', { s: 0.12, x: -0.3, y: 0.05, z: -0.15 }));
  const glow = [P(G.oct, glowCol, { sx: 0.06, sy: 0.16, sz: 0.06, x: 0.06, y: 0.24, z: 0.12, rz: 0.4 }), P(G.oct, glowCol, { sx: 0.05, sy: 0.12, sz: 0.05, x: -0.1, y: 0.22, z: -0.05, rz: -0.6 }), P(G.box, glowCol, { sx: 0.3, sy: 0.015, sz: 0.04, x: 0.02, y: 0.29, z: 0.02, ry: 0.5 }), P(G.oct, glowCol, { s: 0.07, x: 0.3, y: 0.12, z: 0.13 })];
  return { geo: merge(parts), glow: merge(glow) };
}
// 雪橇犬：小个子的哈士奇，头朝 -z（和人、雪橇一样）
export function dogGeo() {
  const fur = '#8a9098', light = '#eef0f2', dark = '#3a3d42';
  return merge([
    P(G.box, fur, { sx: 0.1, sy: 0.09, sz: 0.24, y: 0.14 }),
    P(G.box, light, { sx: 0.085, sy: 0.04, sz: 0.2, y: 0.1 }),
    P(G.box, fur, { sx: 0.09, sy: 0.08, sz: 0.09, y: 0.2, z: -0.14 }),
    P(G.box, light, { sx: 0.06, sy: 0.04, sz: 0.06, y: 0.18, z: -0.2 }),
    P(G.box, dark, { sx: 0.025, sy: 0.02, sz: 0.02, y: 0.195, z: -0.235 }),
    P(G.cone4, fur, { sx: 0.03, sy: 0.05, sz: 0.03, x: -0.028, y: 0.26, z: -0.13 }), P(G.cone4, fur, { sx: 0.03, sy: 0.05, sz: 0.03, x: 0.028, y: 0.26, z: -0.13 }),
    P(G.box, fur, { sx: 0.03, sy: 0.03, sz: 0.1, y: 0.2, z: 0.15, rx: 0.8 }),
    ...[[-0.03, -0.08], [0.03, -0.08], [-0.03, 0.08], [0.03, 0.08]].map(([x, z]) => P(G.box, dark, { sx: 0.025, sy: 0.1, sz: 0.025, x, y: 0.05, z })),
  ]);
}
// 走失的驯鹿：脖子上系的红布和铃铛，背上的褡裢
export function deerBellGeo() {
  return merge([P(G.cyl8, '#b03a2e', { sx: 0.13, sy: 0.04, sz: 0.13, y: 0.43, z: 0.2, rx: 0.5 }), P(G.oct, '#ffd060', { s: 0.06, y: 0.36, z: 0.25 }),
    // 背上搭着褡裢：一条皮带两个口袋
    P(G.box, '#5a3a22', { sx: 0.22, sy: 0.02, sz: 0.06, y: 0.445, z: -0.03 }),
    P(G.box, '#8a5a32', { sx: 0.05, sy: 0.13, sz: 0.15, x: 0.115, y: 0.36, z: -0.03 }), P(G.box, '#8a5a32', { sx: 0.05, sy: 0.13, sz: 0.15, x: -0.115, y: 0.36, z: -0.03 }),
    P(G.box, '#6a4226', { sx: 0.055, sy: 0.04, sz: 0.155, x: 0.115, y: 0.42, z: -0.03 }), P(G.box, '#6a4226', { sx: 0.055, sy: 0.04, sz: 0.155, x: -0.115, y: 0.42, z: -0.03 })]);
}

// ---------- 施工脚手架 ----------
// 传送带 / 蒸汽轨道：沿 +x 从 0 铺到 len，架在柱子上（人从下面走过不穿模），两头各一个料斗接进建筑
export const BELT_H = 0.66;
export function beltGeo(len, lvl) {
  const parts = [], add = (g, c, o) => parts.push(P(g, c, o));
  const L = Math.max(0.35, len), H = BELT_H, rail = lvl >= 2;
  const metal = '#5a6068', wood = '#6a4a30', dark = '#26282c';
  const nPost = Math.max(1, Math.round(L / 0.9));
  for (let i = 0; i <= nPost; i++) {
    const x = i / nPost * L;
    for (const z of [-0.15, 0.15]) add(G.box, rail ? metal : wood, { sx: 0.06, sy: H, sz: 0.06, x, y: H / 2, z });
    add(G.box, rail ? metal : wood, { sx: 0.04, sy: 0.04, sz: 0.34, x, y: H * 0.42 });
    add(G.box, '#3a3d42', { sx: 0.14, sy: 0.04, sz: 0.42, x, y: 0.02 }); // 柱脚压在雪里
  }
  if (!rail) {
    add(G.box, dark, { sx: L + 0.16, sy: 0.05, sz: 0.28, x: L / 2, y: H + 0.02 });
    for (const z of [-0.16, 0.16]) add(G.box, '#7a5a3a', { sx: L + 0.16, sy: 0.09, sz: 0.04, x: L / 2, y: H + 0.05, z });
    for (const x of [-0.08, L + 0.08]) add(G.cyl8, metal, { sx: 0.1, sy: 0.3, sz: 0.1, rx: Math.PI / 2, x, y: H + 0.01 });
    const nR = Math.max(1, Math.round(L / 0.35));
    for (let i = 1; i < nR; i++) add(G.box, '#8a8f96', { sx: 0.03, sy: 0.02, sz: 0.3, x: i / nR * L, y: H - 0.01 });
  } else {
    add(G.box, metal, { sx: L + 0.16, sy: 0.06, sz: 0.34, x: L / 2, y: H });
    const nS = Math.max(2, Math.round(L / 0.2));
    for (let i = 0; i <= nS; i++) add(G.box, wood, { sx: 0.05, sy: 0.03, sz: 0.34, x: -0.08 + i * (L + 0.16) / nS, y: H + 0.045 });
    for (const z of [-0.09, 0.09]) add(G.box, '#a8b2bc', { sx: L + 0.16, sy: 0.03, sz: 0.03, x: L / 2, y: H + 0.075, z });
    for (let i = 0; i < nPost; i++) {
      const x0 = i / nPost * L, x1 = (i + 1) / nPost * L, dx = x1 - x0, dy = H * 0.75;
      for (const z of [-0.15, 0.15]) add(G.box, metal, { sx: Math.hypot(dx, dy), sy: 0.025, sz: 0.025, x: (x0 + x1) / 2, y: 0.05 + dy / 2, z, rz: Math.atan2(dy, dx) * (i % 2 ? -1 : 1) });
    }
  }
  // 两头：料斗往下接进建筑
  for (const x of [-0.1, L + 0.1]) {
    add(G.frust8, rail ? '#8a7048' : '#9a7a50', { sx: 0.3, sy: 0.16, sz: 0.3, x, y: H + 0.1 });
    add(G.box, '#3a3d42', { sx: 0.12, sy: H * 0.6, sz: 0.12, x, y: H * 0.45 });
  }
  return merge(parts);
}
export function beltCrateGeo(color) {
  return merge([P(G.box, color, { sx: 0.15, sy: 0.11, sz: 0.15, y: 0.055, jit: 0.15 }), P(G.box, '#5a3e26', { sx: 0.16, sy: 0.02, sz: 0.16, y: 0.11 })]);
}
export function cartGeo(color) {
  return merge([
    P(G.box, '#3a3d42', { sx: 0.34, sy: 0.08, sz: 0.2, y: 0.06 }),
    P(G.box, color, { sx: 0.22, sy: 0.1, sz: 0.17, x: -0.05, y: 0.15, jit: 0.15 }),
    P(G.cyl8, '#26282c', { sx: 0.06, sy: 0.14, sz: 0.06, x: 0.12, y: 0.17 }),
    P(G.box, '#c0782a', { sx: 0.08, sy: 0.08, sz: 0.18, x: 0.1, y: 0.13 }),
    ...[-0.1, 0.1].flatMap(x => [-0.1, 0.1].map(z => P(G.cyl8, '#1a1c1f', { sx: 0.07, sy: 0.03, sz: 0.07, rx: Math.PI / 2, x, y: 0.035, z }))),
  ]);
}
// 等床位的窝棚：木杆斜搭的棚子 + 破油布 + 一小堆火，中心在原点，占地约 1.6×1.4
export function shantyGeo() {
  const parts = [], glow = [], add = (g, c, o) => parts.push(P(g, c, o)), wood = '#5a3e26', wood2 = '#4a3220';
  // 斜屋顶：四根杆子，前高后低
  for (const x of [-0.6, 0.6]) { add(G.box, wood2, { sx: 0.06, sy: 0.75, sz: 0.06, x, y: 0.37, z: 0.25 }); add(G.box, wood2, { sx: 0.06, sy: 0.4, sz: 0.06, x, y: 0.2, z: -0.4 }); }
  add(G.box, '#7a6a5a', { sx: 1.35, sy: 0.04, sz: 0.85, x: 0, y: 0.58, z: -0.08, rx: -0.5, jit: 0.2 });
  add(G.box, '#e8eef4', { sx: 1.3, sy: 0.03, sz: 0.5, x: 0, y: 0.64, z: -0.15, rx: -0.5 }); // 顶上积雪
  add(G.box, '#6a5848', { sx: 0.05, sy: 0.5, sz: 0.62, x: -0.62, y: 0.28, z: -0.08, jit: 0.2 }); // 侧面挂的油布
  for (let i = 0; i < 5; i++) add(G.box, i % 2 ? wood : wood2, { sx: 0.08, sy: 0.42, sz: 0.04, x: -0.48 + i * 0.24, y: 0.21, z: -0.44, rz: (i - 2) * 0.03 });
  // 铺盖卷、木箱、锅
  for (let i = 0; i < 3; i++) add(G.cyl8, ['#7a4a3a', '#5a6a7a', '#8a7a5a'][i], { sx: 0.13, sy: 0.38, sz: 0.13, rz: Math.PI / 2, x: -0.35 + i * 0.32, y: 0.08, z: -0.2 });
  add(G.box, '#7a5a3a', { sx: 0.24, sy: 0.2, sz: 0.2, x: 0.72, y: 0.1, z: -0.25, ry: 0.3, jit: 0.15 });
  add(G.box, '#6a4a2e', { sx: 0.18, sy: 0.16, sz: 0.18, x: 0.75, y: 0.28, z: -0.22, ry: 0.6, jit: 0.15 });
  // 火堆：石头一圈 + 柴 + 火苗
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add(G.dode, '#6a6e76', { s: 0.09, x: Math.cos(a) * 0.17, y: 0.04, z: 0.62 + Math.sin(a) * 0.17 }); }
  for (let k = 0; k < 3; k++) add(G.box, wood, { sx: 0.24, sy: 0.04, sz: 0.04, y: 0.06, z: 0.62, ry: k * 1.05 });
  glow.push(P(G.cone5, '#ffa040', { sx: 0.13, sy: 0.22, sz: 0.13, y: 0.17, z: 0.62 }), P(G.cone5, '#ffdd80', { sx: 0.07, sy: 0.14, sz: 0.07, y: 0.15, z: 0.62 }));
  add(G.box, wood2, { sx: 0.04, sy: 0.4, sz: 0.04, x: -0.18, y: 0.2, z: 0.62 }); add(G.box, wood2, { sx: 0.04, sy: 0.4, sz: 0.04, x: 0.18, y: 0.2, z: 0.62 });
  add(G.box, '#2a2622', { sx: 0.4, sy: 0.02, sz: 0.02, y: 0.4, z: 0.62 });
  add(G.cyl8, '#3a3a40', { sx: 0.12, sy: 0.1, sz: 0.12, y: 0.32, z: 0.62 });
  return { geo: merge(parts), glow: merge(glow) };
}
// 一团火：几条歪歪扭扭的火舌，外红内黄
function festFlame() {
  const out = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + 0.3, r = k ? 0.13 : 0, h = k ? 0.42 + (k % 3) * 0.12 : 0.85;
    out.push(P(G.cone5, k % 2 ? '#ff6a1c' : '#ff8a2c', { sx: k ? 0.17 : 0.3, sy: h, sz: k ? 0.17 : 0.3, x: Math.cos(a) * r, y: 0.18 + h / 2, z: Math.sin(a) * r, rx: Math.sin(a) * 0.35, rz: -Math.cos(a) * 0.35, ry: k }));
  }
  out.push(P(G.cone5, '#ffc04a', { sx: 0.2, sy: 0.6, sz: 0.2, y: 0.45, ry: 0.5 }), P(G.cone5, '#fff0b0', { sx: 0.11, sy: 0.36, sz: 0.11, y: 0.36, ry: 1.1 }));
  return merge(out);
}
// 篝火庆典：一堆大篝火（石圈 + 柴堆），外圈四根杆子拉着灯笼绳，旁边一面鼓。R 是整个场子的半径
export function festGeo(R = 2.3) {
  const parts = [], glow = [], add = (g, c, o) => parts.push(P(g, c, o)), wood = '#5a3e26', wood2 = '#4a3220';
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; add(G.dode, k % 2 ? '#6a6e76' : '#7a7e86', { s: 0.15, x: Math.cos(a) * 0.42, y: 0.06, z: Math.sin(a) * 0.42, jit: 0.2 }); }
  add(G.cyl12, '#2a1e18', { sx: 0.72, sy: 0.03, sz: 0.72, y: 0.02 });
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add(G.box, k % 2 ? wood : wood2, { sx: 0.08, sy: 0.7, sz: 0.08, x: Math.cos(a) * 0.17, y: 0.3, z: Math.sin(a) * 0.17, rx: -Math.sin(a) * 0.45, rz: Math.cos(a) * 0.45 }); }
  glow.push(P(G.cyl12, '#ff7a20', { sx: 0.5, sy: 0.04, sz: 0.5, y: 0.05 }));
  // 杆子和灯笼绳：相邻两根杆子之间垂下来一段弧，挂几盏灯笼
  const Rp = R - 0.15, H = 1.3 + (R - 1.6) * 0.1, poles = [0.25, 1.82, 3.39, 4.96].map(a => [Math.cos(a) * Rp, Math.sin(a) * Rp]);
  for (const [x, z] of poles) { add(G.box, wood2, { sx: 0.07, sy: H + 0.1, sz: 0.07, x, y: (H + 0.1) / 2, z }); add(G.dode, '#e8eef4', { s: 0.1, x, y: H + 0.12, z }); add(G.box, '#3a3d42', { sx: 0.2, sy: 0.04, sz: 0.2, x, y: 0.02, z }); }
  const LC = ['#ff6040', '#ffc050', '#ff8a30', '#ffe080'];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = poles[i], [x1, z1] = poles[(i + 1) % 4], N = 6;
    let px = x0, pz = z0, py = H;
    for (let j = 1; j <= N; j++) {
      const f = j / N, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, y = H - 0.22 * Math.sin(Math.PI * f);
      const dx = x - px, dy = y - py, dz = z - pz, L = Math.hypot(dx, dy, dz);
      // 一段绳子：沿 x 放的细长方块，先绕 z 转出坡度，再绕 y 转到方向
      add(G.box, '#3a2a1e', { sx: L, sy: 0.015, sz: 0.015, x: (x + px) / 2, y: (y + py) / 2, z: (z + pz) / 2, ry: -Math.atan2(dz, dx), rz: Math.atan2(dy, Math.hypot(dx, dz)) });
      if (j < N) { add(G.box, '#2a2622', { sx: 0.012, sy: 0.08, sz: 0.012, x, y: y - 0.05, z }); glow.push(P(G.oct, LC[(i + j) % 4], { sx: 0.075, sy: 0.1, sz: 0.075, x, y: y - 0.13, z })); }
      px = x; py = y; pz = z;
    }
  }
  // 鼓和长凳，在两根杆子之间靠外（跳舞的圈在 R×0.5 以内）
  const da = 1.03, dr = R - 0.32;
  add(G.cyl12, '#8a4a2a', { sx: 0.3, sy: 0.26, sz: 0.3, x: Math.cos(da) * dr, y: 0.13, z: Math.sin(da) * dr });
  add(G.cyl12, '#e8d8b8', { sx: 0.29, sy: 0.02, sz: 0.29, x: Math.cos(da) * dr, y: 0.27, z: Math.sin(da) * dr });
  const ba = 4.2, br = R - 0.3;
  add(G.box, wood, { sx: 0.7, sy: 0.06, sz: 0.2, x: Math.cos(ba) * br, y: 0.2, z: Math.sin(ba) * br, ry: -ba + Math.PI / 2 });
  for (const o of [-0.25, 0.25]) add(G.box, wood2, { sx: 0.06, sy: 0.18, sz: 0.16, x: Math.cos(ba) * br + Math.cos(ba + Math.PI / 2) * o, y: 0.09, z: Math.sin(ba) * br + Math.sin(ba + Math.PI / 2) * o, ry: -ba + Math.PI / 2 });
  return { geo: merge(parts), glow: merge(glow), flame: festFlame(), poles };
}
// 孩子们堆的雪人：三个雪球 + 树枝手 + 胡萝卜鼻子 + 旧围巾
export function snowmanGeo() {
  const S = '#f4f8fc';
  return merge([
    P(G.sph2, S, { s: 0.36, y: 0.16 }), P(G.sph2, S, { s: 0.26, y: 0.4 }), P(G.sph2, S, { s: 0.19, y: 0.58 }),
    P(G.cone5, '#e07a2a', { sx: 0.035, sy: 0.12, sz: 0.035, y: 0.59, z: 0.12, rx: Math.PI / 2 }),
    P(G.box, '#1a1a1e', { s: 0.025, x: 0.04, y: 0.62, z: 0.085 }), P(G.box, '#1a1a1e', { s: 0.025, x: -0.04, y: 0.62, z: 0.085 }),
    P(G.cyl8, '#b03a2e', { sx: 0.22, sy: 0.045, sz: 0.22, y: 0.5 }), P(G.box, '#b03a2e', { sx: 0.05, sy: 0.14, sz: 0.02, x: 0.06, y: 0.43, z: 0.1, rz: 0.2 }),
    P(G.box, '#4a3220', { sx: 0.24, sy: 0.02, sz: 0.02, x: 0.2, y: 0.45, rz: 0.5 }), P(G.box, '#4a3220', { sx: 0.24, sy: 0.02, sz: 0.02, x: -0.2, y: 0.45, rz: -0.6 }),
    P(G.cyl8, '#2a2622', { sx: 0.14, sy: 0.12, sz: 0.14, y: 0.71 }), P(G.cyl8, '#2a2622', { sx: 0.2, sy: 0.02, sz: 0.2, y: 0.66 }),
    P(G.box, '#1a1a1e', { s: 0.02, y: 0.4, z: 0.13 }), P(G.box, '#1a1a1e', { s: 0.02, y: 0.34, z: 0.13 }),
  ]);
}
export function scaffoldGeo(size, h) {
  const W2 = size / 2 + 0.06, parts = [];
  const pole = (x, z) => parts.push(P(G.box, '#8a6038', { sx: 0.05, sy: h, sz: 0.05, x, y: h / 2, z }));
  const n = size + 1;
  for (let k = 0; k < n; k++) { const t = -W2 + k * (2 * W2) / (n - 1); pole(t, W2); pole(t, -W2); if (k > 0 && k < n - 1) { pole(W2, t); pole(-W2, t); } }
  const levels = Math.max(2, Math.round(h / 0.55));
  for (let l = 1; l <= levels; l++) {
    const y = l * h / (levels + 0.3);
    for (const sg of [-1, 1]) {
      parts.push(P(G.box, '#a87a48', { sx: 2 * W2 + 0.1, sy: 0.04, sz: 0.12, y, z: sg * (W2 + 0.04) }));
      parts.push(P(G.box, '#a87a48', { sx: 0.12, sy: 0.04, sz: 2 * W2 + 0.1, x: sg * (W2 + 0.04), y }));
    }
  }
  // 斜撑
  for (const sg of [-1, 1]) {
    parts.push(P(G.box, '#7a5030', { sx: 0.03, sy: Math.hypot(2 * W2, h) * 0.95, sz: 0.03, z: sg * W2, y: h / 2, rz: Math.atan2(2 * W2, h) * sg }));
    parts.push(P(G.box, '#7a5030', { sx: 0.03, sy: Math.hypot(2 * W2, h) * 0.95, sz: 0.03, x: sg * W2, y: h / 2, rx: Math.atan2(2 * W2, h) * sg }));
  }
  // 地上的材料堆
  parts.push(P(G.box, '#c09060', { sx: 0.45, sy: 0.08, sz: 0.16, x: W2 + 0.3, y: 0.04, z: W2 - 0.2, ry: 0.3 }));
  parts.push(P(G.box, '#b08050', { sx: 0.42, sy: 0.08, sz: 0.16, x: W2 + 0.32, y: 0.12, z: W2 - 0.22, ry: 0.4 }));
  parts.push(P(G.box, '#9aa0a8', { sx: 0.2, sy: 0.16, sz: 0.2, x: -W2 - 0.25, y: 0.08, z: W2 - 0.1, ry: 0.5 }));
  return merge(parts);
}

// ---------- 采空后的痕迹：树桩、矿坑 ----------
export function remnantGeo(kind) {
  if (kind === 'stump') return merge([
    P(G.cyl8, '#5a3a22', { sx: 0.2, sy: 0.14, sz: 0.2, y: 0.07, jit: 0.1 }),
    P(G.cyl8, '#d8b888', { sx: 0.17, sy: 0.01, sz: 0.17, y: 0.145 }),
    P(G.cyl8, '#a07848', { sx: 0.08, sy: 0.012, sz: 0.08, y: 0.148 }),
    ...[0, 2.1, 4.2].map(a => P(G.box, '#4a3020', { sx: 0.05, sy: 0.04, sz: 0.14, x: Math.cos(a) * 0.12, y: 0.02, z: Math.sin(a) * 0.12, ry: -a + Math.PI / 2 })),
    P(G.box, '#c8a070', { sx: 0.06, sy: 0.015, sz: 0.03, x: 0.18, y: 0.01, z: 0.06, ry: 0.5 }),
    P(G.box, '#c8a070', { sx: 0.05, sy: 0.015, sz: 0.03, x: -0.14, y: 0.01, z: 0.15, ry: 1.3 }),
    P(G.hemiLo, SNOW, { sx: 0.16, sy: 0.04, sz: 0.12, x: -0.04, y: 0.145, z: -0.03 }),
  ]);
  // 矿坑：一圈翻出来的碎石土堆，中间是暗色的坑底，旁边扔着一块剩下的矿石
  const out = [P(G.cyl12, '#4a4648', { sx: 0.62, sy: 0.02, sz: 0.55, y: 0.01 })];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; out.push(P(G.dode, k % 3 ? '#8a8f97' : '#6e6a66', { sx: 0.16, sy: 0.08 + (k % 2) * 0.04, sz: 0.12, x: Math.cos(a) * 0.34, y: 0.03, z: Math.sin(a) * 0.3, jit: 0.2 })); }
  out.push(P(G.hemiLo, SNOW, { sx: 0.22, sy: 0.05, sz: 0.14, x: -0.3, y: 0.05, z: -0.12 }));
  out.push(P(G.dode, '#7d8088', { s: 0.1, x: 0.42, y: 0.04, z: 0.2, jit: 0.2 }));
  return merge(out);
}

// ---------- 地面小装饰：雪堆、石子、枯灌木、干草 ----------
export function decorGeo(kind) {
  switch (kind) {
    case 'drift': return merge([P(G.hemiLo, '#f2f6fb', { sx: 0.7, sy: 0.1, sz: 0.36 }), P(G.hemiLo, '#f7fafd', { sx: 0.4, sy: 0.08, sz: 0.24, x: 0.24, z: 0.07, ry: 0.4 })]);
    case 'stone': return merge([P(G.dode, '#868d97', { sx: 0.24, sy: 0.15, sz: 0.2, y: 0.04, jit: 0.25 }), P(G.dode, '#9aa1aa', { s: 0.12, x: 0.16, y: 0.02, z: 0.08, jit: 0.2 }), P(G.dode, SNOW, { sx: 0.16, sy: 0.05, sz: 0.13, y: 0.11 })]);
    case 'shrub': {
      const out = [];
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; out.push(P(G.cone4, k % 2 ? '#4a3626' : '#5a4230', { sx: 0.03, sy: 0.32 + (k % 3) * 0.08, sz: 0.03, x: Math.cos(a) * 0.05, y: 0.14, z: Math.sin(a) * 0.05, rz: Math.cos(a) * 0.5, rx: -Math.sin(a) * 0.5 })); }
      out.push(P(G.hemiLo, SNOW, { sx: 0.3, sy: 0.07, sz: 0.25 }));
      return merge(out);
    }
    // 以下几种只在「极致」画质里出现
    case 'log': return merge([
      P(G.cyl8, '#5e4230', { sx: 0.1, sy: 0.62, sz: 0.1, rz: Math.PI / 2, y: 0.06, jit: 0.08 }),
      P(G.cyl8, '#c9a77c', { sx: 0.085, sy: 0.012, sz: 0.085, rz: Math.PI / 2, x: 0.31, y: 0.06 }),
      P(G.box, '#4e3626', { sx: 0.03, sy: 0.16, sz: 0.03, x: -0.12, y: 0.12, z: 0.03, rz: 0.6, rx: 0.3 }),
      P(G.hemiLo, SNOW, { sx: 0.5, sy: 0.05, sz: 0.11, y: 0.1 }),
      P(G.hemiLo, SNOW2, { sx: 0.22, sy: 0.06, sz: 0.16, x: 0.16, z: 0.07 })]);
    case 'ice': return merge([
      P(G.oct, '#bfe6f6', { sx: 0.08, sy: 0.32, sz: 0.08, y: 0.12, rz: 0.2 }),
      P(G.oct, '#9fd2ec', { sx: 0.06, sy: 0.22, sz: 0.06, x: 0.08, y: 0.08, z: 0.03, rz: -0.45 }),
      P(G.oct, '#d8f2ff', { sx: 0.05, sy: 0.17, sz: 0.05, x: -0.07, y: 0.06, z: -0.04, rx: 0.5 }),
      P(G.hemiLo, SNOW, { sx: 0.26, sy: 0.05, sz: 0.22 })]);
    case 'sapling': return merge([
      P(G.cyl5, '#4a3424', { sx: 0.03, sy: 0.12, sz: 0.03, y: 0.06 }),
      P(G.cone6, '#2f4a3c', { sx: 0.26, sy: 0.24, sz: 0.26, y: 0.2 }),
      P(G.cone6, '#365646', { sx: 0.19, sy: 0.2, sz: 0.19, y: 0.32 }),
      P(G.cone7o, SNOW, { sx: 0.13, sy: 0.1, sz: 0.13, y: 0.4 }),
      P(G.hemiLo, SNOW, { sx: 0.22, sy: 0.04, sz: 0.2 })]);
    case 'pebble': {
      const out = [];
      for (let k = 0; k < 5; k++) { const a = k * 2.1; out.push(P(G.dode, k % 2 ? '#7c838d' : '#959ca6', { s: 0.05 + (k % 3) * 0.02, x: Math.cos(a) * 0.14 * (0.5 + k * 0.15), y: 0.015, z: Math.sin(a) * 0.12, jit: 0.3 })); }
      return merge(out);
    }
    case 'grass': {
      const out = [];
      for (let k = 0; k < 7; k++) { const a = k * 2.4; out.push(P(G.cone4, k % 3 ? '#b49a64' : '#9a8050', { sx: 0.035, sy: 0.22 + (k % 3) * 0.06, sz: 0.02, x: Math.cos(a) * 0.06, y: 0.11, z: Math.sin(a) * 0.06, rz: Math.cos(a) * 0.35, rx: -Math.sin(a) * 0.35, ry: a })); }
      return merge(out);
    }
  }
}

// ---------- 小人 ----------
// 外套部分（白色，由实例颜色染色）
export function figureGeo() {
  return merge([
    P(G.frust8, '#ffffff', { sx: 0.2, sy: 0.2, sz: 0.17, y: 0.17, rx: Math.PI }),
    P(G.cyl8, '#ffffff', { sx: 0.15, sy: 0.14, sz: 0.13, y: 0.32 }),
    P(G.box, '#ffffff', { sx: 0.05, sy: 0.18, sz: 0.06, x: 0.1, y: 0.28, rz: 0.25 }),
    P(G.box, '#ffffff', { sx: 0.05, sy: 0.18, sz: 0.06, x: -0.1, y: 0.28, rz: -0.25 }),
    P(G.box, '#ffffff', { sx: 0.12, sy: 0.04, sz: 0.04, y: 0.14, z: 0.08 }),
  ]);
}
// 不染色的部分：靴子、脸、皮帽、围巾、背包
export function figureDetailGeo() {
  return merge([
    P(G.box, '#2e2620', { sx: 0.06, sy: 0.07, sz: 0.09, x: 0.045, y: 0.035, z: 0.01 }),
    P(G.box, '#2e2620', { sx: 0.06, sy: 0.07, sz: 0.09, x: -0.045, y: 0.035, z: 0.01 }),
    P(G.head, '#f0c8a0', { s: 0.11, y: 0.45, z: 0.01 }),
    P(G.cyl6, '#5a4030', { sx: 0.14, sy: 0.07, sz: 0.14, y: 0.51 }),
    P(G.cyl6o, '#e8e0d4', { sx: 0.135, sy: 0.05, sz: 0.135, y: 0.485 }),
    P(G.cyl6o, '#b03a2e', { sx: 0.13, sy: 0.04, sz: 0.12, y: 0.395 }),
    P(G.box, '#6a4a30', { sx: 0.12, sy: 0.14, sz: 0.06, y: 0.3, z: -0.08 }),
    P(G.box, '#2a2622', { sx: 0.03, sy: 0.03, sz: 0.03, x: 0.11, y: 0.19, z: 0.02 }),
    P(G.box, '#2a2622', { sx: 0.03, sy: 0.03, sz: 0.03, x: -0.11, y: 0.19, z: 0.02 }),
  ]);
}
export function wolfGeo() {
  return merge([
    P(G.box, '#ffffff', { sx: 0.17, sy: 0.17, sz: 0.4, y: 0.25 }),
    P(G.box, '#ffffff', { sx: 0.2, sy: 0.2, sz: 0.16, y: 0.29, z: 0.13 }),
    P(G.box, '#ffffff', { sx: 0.13, sy: 0.13, sz: 0.14, y: 0.33, z: 0.27 }),
    P(G.box, '#ffffff', { sx: 0.08, sy: 0.07, sz: 0.12, y: 0.3, z: 0.38 }),
    P(G.cone4, '#ffffff', { sx: 0.05, sy: 0.1, sz: 0.04, y: 0.43, z: 0.25, x: 0.045 }),
    P(G.cone4, '#ffffff', { sx: 0.05, sy: 0.1, sz: 0.04, y: 0.43, z: 0.25, x: -0.045 }),
    ...[[-0.06, -0.14], [0.06, -0.14], [-0.06, 0.13], [0.06, 0.13]].map(([x, z]) => P(G.box, '#ffffff', { sx: 0.045, sy: 0.18, sz: 0.05, x, y: 0.09, z })),
    P(G.box, '#ffffff', { sx: 0.06, sy: 0.06, sz: 0.24, y: 0.27, z: -0.3, rx: 0.6 }),
  ]);
}
export function sledGeo(rail) {
  if (rail) return merge([
    P(G.box, '#3a3f48', { sx: 0.5, sy: 0.12, sz: 1.1, y: 0.16 }),
    P(G.cyl12, '#2a2e34', { sx: 0.42, sy: 0.65, sz: 0.42, rx: Math.PI / 2, y: 0.45, z: 0.3 }),
    P(G.torus16, '#b87333', { s: 0.43, y: 0.45, z: 0.1 }), P(G.torus16, '#b87333', { s: 0.43, y: 0.45, z: 0.5 }),
    P(G.box, '#4a3a2e', { sx: 0.48, sy: 0.42, sz: 0.36, y: 0.5, z: -0.25 }),
    P(G.box, '#2a2e34', { sx: 0.54, sy: 0.05, sz: 0.42, y: 0.73, z: -0.25 }),
    P(G.cyl8, '#2a2e34', { sx: 0.13, sy: 0.32, sz: 0.13, y: 0.82, z: 0.52 }),
    P(G.cone8, '#b03a2e', { sx: 0.4, sy: 0.15, sz: 0.2, rx: Math.PI / 2, y: 0.2, z: 0.62 }),
    ...[-0.35, 0, 0.35].flatMap(z => [-1, 1].map(sg => P(G.cyl8, '#1a1c20', { sx: 0.2, sy: 0.06, sz: 0.2, rz: Math.PI / 2, x: sg * 0.26, y: 0.1, z }))),
    P(G.box, '#7a4030', { sx: 0.5, sy: 0.3, sz: 0.85, y: 0.28, z: -1.05 }),
    P(G.box, '#eef4fa', { sx: 0.46, sy: 0.04, sz: 0.8, y: 0.45, z: -1.05 }),
  ]);
  return merge([
    P(G.box, '#8a5a34', { sx: 0.4, sy: 0.08, sz: 0.85, y: 0.14 }),
    ...[-1, 1].map(sg => P(G.box, '#c8d0d8', { sx: 0.03, sy: 0.03, sz: 0.95, x: sg * 0.18, y: 0.05, z: 0.02 })),
    ...[-1, 1].map(sg => P(G.box, '#c8d0d8', { sx: 0.03, sy: 0.12, sz: 0.03, x: sg * 0.18, y: 0.1, z: 0.48, rx: 0.5 })),
    P(G.box, '#c0a070', { sx: 0.34, sy: 0.22, sz: 0.45, y: 0.29, z: -0.1 }),
    P(G.box, '#7a5a3a', { sx: 0.36, sy: 0.02, sz: 0.47, y: 0.29, z: -0.1 }),
    P(G.box, '#eef4fa', { sx: 0.3, sy: 0.04, sz: 0.4, y: 0.42, z: -0.1 }),
    // 两条雪橇犬
    ...[[-0.12, 0.75], [0.12, 0.75], [-0.12, 1.05], [0.12, 1.05]].flatMap(([x, z]) => [
      P(G.box, '#d8d4cc', { sx: 0.1, sy: 0.1, sz: 0.22, x, y: 0.16, z }),
      P(G.box, '#3a3a40', { sx: 0.08, sy: 0.08, sz: 0.09, x, y: 0.22, z: z + 0.13 }),
    ]),
  ]);
}
// 商队营地（3×3 格）：毛毡帐篷、两架满载的大雪橇、驯鹿、篝火、旗杆和两个商人
export function caravanGeo() {
  const parts = [], add = (g, c, o) => parts.push(P(g, c, o));
  // 踩实的雪地
  add(G.cyl16, '#dfe6ee', { sx: 2.7, sy: 0.04, sz: 2.5, y: 0.02 });
  // 帐篷：毡布圆锥 + 一圈彩色饰带 + 门帘
  add(G.cyl8, '#6e4c32', { sx: 1.05, sy: 0.32, sz: 1.05, x: -0.7, y: 0.16, z: -0.55 });
  add(G.cone8, '#8f6a48', { sx: 1.15, sy: 0.85, sz: 1.15, x: -0.7, y: 0.74, z: -0.55, jit: 0.15 });
  add(G.cyl8, '#b8402e', { sx: 1.07, sy: 0.07, sz: 1.07, x: -0.7, y: 0.3, z: -0.55 });
  add(G.cyl8, '#e2b24a', { sx: 0.62, sy: 0.05, sz: 0.62, x: -0.7, y: 0.78, z: -0.55 });
  add(G.box, '#3a2618', { sx: 0.3, sy: 0.42, sz: 0.06, x: -0.62, y: 0.21, z: -0.04, ry: 0.2 });
  add(G.cyl5, '#5a4030', { sx: 0.05, sy: 0.4, sz: 0.05, x: -0.7, y: 1.3, z: -0.55 });
  add(G.cone8, '#eef4fa', { sx: 0.5, sy: 0.32, sz: 0.5, x: -0.7, y: 1.04, z: -0.55 }); // 帐篷尖上的积雪
  // 大雪橇：底板 + 钢滑轨 + 货物（木箱、捆好的毛皮、桶）+ 绳网
  const sled = (x, z, ry, load) => {
    const o = (dx, y, dz, extra = {}) => ({ x: x + Math.cos(ry) * dx + Math.sin(ry) * dz, y, z: z - Math.sin(ry) * dx + Math.cos(ry) * dz, ry, ...extra });
    add(G.box, '#7a5030', { sx: 0.6, sy: 0.08, sz: 1.25, ...o(0, 0.17, 0) });
    for (const sg of [-1, 1]) {
      add(G.box, '#c8d0d8', { sx: 0.04, sy: 0.04, sz: 1.35, ...o(sg * 0.27, 0.06, 0.03) });
      add(G.box, '#c8d0d8', { sx: 0.04, sy: 0.16, sz: 0.04, ...o(sg * 0.27, 0.14, 0.68, { rx: 0.6 }) });
      add(G.box, '#5a3a22', { sx: 0.04, sy: 0.2, sz: 0.04, ...o(sg * 0.25, 0.3, -0.58) });
    }
    if (load === 0) {
      add(G.box, '#b08850', { sx: 0.5, sy: 0.32, sz: 0.42, ...o(0, 0.37, -0.32), jit: 0.1 });
      add(G.box, '#9a7444', { sx: 0.4, sy: 0.26, sz: 0.36, ...o(0.02, 0.34, 0.14), jit: 0.1 });
      add(G.box, '#c49a60', { sx: 0.3, sy: 0.2, sz: 0.28, ...o(-0.04, 0.63, -0.3), jit: 0.1 });
      add(G.cyl8, '#5a6a7a', { sx: 0.32, sy: 0.5, sz: 0.32, ...o(0, 0.62, 0.12, { rz: Math.PI / 2 }) });
    } else {
      for (const [dx, dz] of [[-0.14, -0.32], [0.14, -0.32], [-0.14, 0.02], [0.14, 0.02]]) add(G.cyl8, '#6a4026', { sx: 0.24, sy: 0.34, sz: 0.24, ...o(dx, 0.38, dz) });
      for (const [dx, dz] of [[-0.14, -0.32], [0.14, -0.32], [-0.14, 0.02], [0.14, 0.02]]) add(G.cyl8, '#2a2a2e', { sx: 0.25, sy: 0.03, sz: 0.25, ...o(dx, 0.5, dz) });
      add(G.box, '#8a6a9a', { sx: 0.5, sy: 0.18, sz: 0.36, ...o(0, 0.35, 0.38), jit: 0.15 });
    }
    add(G.box, '#eef4fa', { sx: 0.46, sy: 0.04, sz: 0.3, ...o(0, 0.77, -0.3) });
    add(G.box, '#3a2a1e', { sx: 0.58, sy: 0.02, sz: 0.02, ...o(0, 0.55, -0.12) });
  };
  sled(0.75, -0.6, 0.35, 0);
  sled(0.95, 0.75, -0.25, 1);
  // 两头驯鹿（卸了套在旁边歇着）
  const deer = (x, z, ry, sit) => {
    const o = (dx, y, dz, extra = {}) => ({ x: x + Math.cos(ry) * dx + Math.sin(ry) * dz, y, z: z - Math.sin(ry) * dx + Math.cos(ry) * dz, ry, ...extra });
    const by = sit ? 0.16 : 0.34;
    add(G.box, '#7a5a40', { sx: 0.2, sy: 0.2, sz: 0.48, ...o(0, by, 0) });
    add(G.box, '#e8e0d0', { sx: 0.18, sy: 0.1, sz: 0.2, ...o(0, by - 0.06, 0.14) });
    add(G.box, '#7a5a40', { sx: 0.12, sy: 0.24, sz: 0.12, ...o(0, by + 0.16, 0.24, { rx: -0.4 }) });
    add(G.box, '#6a4a34', { sx: 0.11, sy: 0.11, sz: 0.2, ...o(0, by + 0.28, 0.32) });
    add(G.box, '#2a2020', { sx: 0.05, sy: 0.04, sz: 0.04, ...o(0, by + 0.27, 0.43) });
    for (const sg of [-1, 1]) {
      add(G.box, '#d8c8a8', { sx: 0.025, sy: 0.22, sz: 0.025, ...o(sg * 0.05, by + 0.44, 0.28, { rz: sg * 0.4 }) });
      add(G.box, '#d8c8a8', { sx: 0.025, sy: 0.12, sz: 0.025, ...o(sg * 0.12, by + 0.5, 0.33, { rz: sg * 1.1 }) });
      add(G.box, '#d8c8a8', { sx: 0.025, sy: 0.1, sz: 0.025, ...o(sg * 0.1, by + 0.56, 0.24, { rx: -0.7 }) });
      if (!sit) for (const dz of [-0.17, 0.17]) add(G.box, '#5a4030', { sx: 0.05, sy: 0.26, sz: 0.05, ...o(sg * 0.06, 0.13, dz) });
    }
  };
  deer(-0.35, 0.95, -0.4, false);
  deer(-1.0, 0.55, 0.9, true);
  // 篝火：一圈石头、交叉的柴、火苗
  const fx = 0.05, fz = 0.12;
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(G.dode, '#7a7a82', { s: 0.1, x: fx + Math.cos(a) * 0.17, y: 0.04, z: fz + Math.sin(a) * 0.17 }); }
  add(G.box, '#4a3020', { sx: 0.3, sy: 0.05, sz: 0.05, x: fx, y: 0.06, z: fz, ry: 0.6 });
  add(G.box, '#4a3020', { sx: 0.3, sy: 0.05, sz: 0.05, x: fx, y: 0.07, z: fz, ry: -0.7 });
  add(G.cone5, '#ff8a2b', { sx: 0.16, sy: 0.26, sz: 0.16, x: fx, y: 0.2, z: fz });
  add(G.cone5, '#ffd27a', { sx: 0.08, sy: 0.16, sz: 0.08, x: fx, y: 0.17, z: fz });
  // 旗杆：商队的红黄旗
  add(G.cyl6, '#5a4030', { sx: 0.06, sy: 1.9, sz: 0.06, x: -1.15, y: 0.95, z: 0.95 });
  add(G.box, '#c03a2e', { sx: 0.03, sy: 0.36, sz: 0.62, x: -1.15, y: 1.68, z: 0.64 });
  add(G.box, '#e2b24a', { sx: 0.034, sy: 0.09, sz: 0.62, x: -1.15, y: 1.68, z: 0.64 });
  add(G.sph, '#e2b24a', { s: 0.09, x: -1.15, y: 1.93, z: 0.95 });
  // 两个商人：皮袄、毛帽，一个坐在火边，一个站着
  const man = (x, z, coat, sit) => {
    const y0 = sit ? -0.12 : 0;
    add(G.frust8, coat, { sx: 0.2, sy: 0.32, sz: 0.2, x, y: y0 + 0.28, z });
    add(G.cyl8, '#e8e0d0', { sx: 0.21, sy: 0.05, sz: 0.21, x, y: y0 + 0.14, z });
    add(G.head, '#e8c8a8', { s: 0.13, x, y: y0 + 0.5, z });
    add(G.cyl8, '#5a3a28', { sx: 0.15, sy: 0.08, sz: 0.15, x, y: y0 + 0.58, z });
    if (!sit) for (const sg of [-1, 1]) add(G.box, '#3a2a20', { sx: 0.06, sy: 0.14, sz: 0.06, x: x + sg * 0.05, y: 0.07, z });
  };
  man(0.3, 0.35, '#4a5a7a', true);
  man(-0.15, -0.1, '#7a3a2e', false);
  add(G.box, '#6a4a30', { sx: 0.24, sy: 0.12, sz: 0.14, x: 0.34, y: 0.06, z: 0.36 });
  return merge(parts);
}
// 火墙的火把桩：木桩 + 铁笼 + 底座石头（火苗另外画，好让它们各自跳动）
export function torchPostGeo() {
  return merge([
    P(G.dode, '#7a7a82', { sx: 0.22, sy: 0.12, sz: 0.22, y: 0.04 }),
    P(G.cyl5, '#5a3a22', { sx: 0.08, sy: 0.8, sz: 0.08, y: 0.42 }),
    P(G.cyl6o, '#3a3a40', { sx: 0.2, sy: 0.14, sz: 0.2, y: 0.84 }),
    P(G.cyl6, '#2a1a10', { sx: 0.16, sy: 0.05, sz: 0.16, y: 0.79 }),
  ]);
}
export function torchFlameGeo() { return merge([P(G.cone5, '#ff7a22', { sx: 0.3, sy: 0.6, sz: 0.3, y: 0.28 }), P(G.cone5, '#ffb04a', { sx: 0.2, sy: 0.42, sz: 0.2, y: 0.22, ry: 0.6 }), P(G.cone5, '#fff0b0', { sx: 0.1, sy: 0.26, sz: 0.1, y: 0.15 })]); }
export function crateGeo() { return merge([P(G.box, '#ffffff', { s: 0.16 }), P(G.box, '#a8a8a8', { sx: 0.17, sy: 0.02, sz: 0.17 })]); }

// ---------- 地标遗迹 ----------
export function landmarkGeo(i) {
  const parts = [], glow = [];
  const pillar = (x, z, h, c = '#7c7a86') => { parts.push(P(G.box, c, { sx: 0.5, sy: h, sz: 0.5, x, y: h / 2, z, jit: 0.15, ry: x })); parts.push(P(G.box, '#5c5a66', { sx: 0.62, sy: 0.12, sz: 0.62, x, y: 0.06, z, ry: x })); parts.push(P(G.box, SNOW, { sx: 0.54, sy: 0.12, sz: 0.54, x, y: h + 0.04, z, ry: x })); };
  switch (i) {
    case 1: for (let k = 0; k < 7; k++) parts.push(P(G.dode, '#2c2a30', { sx: 1.4, sy: 1.6 + k % 3, sz: 1.2, x: Math.cos(k) * 1.6, y: 0.6, z: Math.sin(k) * 1.6, jit: 0.2 })); for (let k = 0; k < 4; k++) parts.push(P(G.dode, SNOW, { sx: 1.0, sy: 0.4, sz: 0.9, x: Math.cos(k * 1.7) * 1.6, y: 1.6 + (k % 2) * 0.5, z: Math.sin(k * 1.7) * 1.6 })); parts.push(P(G.box, '#5a3a22', { sx: 1.2, sy: 1.0, sz: 0.3, y: 0.5, z: 1.5 })); parts.push(P(G.wheel, '#4a4a50', { s: 1.0, x: 1.2, y: 2.4, z: 0.2 })); break;
    case 2: for (let k = 0; k < 5; k++) parts.push(P(G.cyl8, '#8a6040', { sx: 0.4, sy: 3.5, sz: 0.4, rz: Math.PI / 2, x: 0, y: 0.4 + k * 0.2, z: -1.6 + k * 0.8 })); parts.push(P(G.cyl12, '#6b4a3a', { sx: 1.4, sy: 2.4, sz: 1.4, y: 1.2, jit: 0.1 })); parts.push(P(G.torus16, '#4a4a50', { s: 1.45, rx: Math.PI / 2, y: 0.8 })); parts.push(P(G.torus16, '#4a4a50', { s: 1.45, rx: Math.PI / 2, y: 1.8 })); parts.push(P(G.hemi, SNOW, { sx: 1.3, sy: 0.3, sz: 1.3, y: 2.4 })); glow.push(P(G.box, '#ff9040', { sx: 0.4, sy: 0.4, sz: 0.04, y: 0.9, z: 0.71 })); break;
    case 3: for (let k = -2; k <= 2; k++) { parts.push(P(G.box, '#5a4030', { sx: 2.6, sy: 0.08, sz: 0.2, y: 0.05, z: k * 0.6 })); } for (const x of [-0.5, 0.5]) parts.push(P(G.box, '#8a5a40', { sx: 0.08, sy: 0.1, sz: 3.2, x, y: 0.12 })); parts.push(P(G.box, '#4a3a3a', { sx: 1.0, sy: 0.9, sz: 1.8, x: 1.6, y: 0.45, rz: 0.2 })); parts.push(P(G.cyl12, '#3a3a40', { sx: 0.8, sy: 1.4, sz: 0.8, rx: Math.PI / 2, x: 1.6, y: 0.95, z: 0.2, rz: 0.2 })); parts.push(P(G.box, SNOW, { sx: 0.9, sy: 0.1, sz: 1.6, x: 1.62, y: 0.98, rz: 0.2 })); break;
    case 4: pillar(-1.4, -1, 2.2); pillar(1.3, -1.2, 1.4); pillar(-1.2, 1.3, 1.0); for (let k = 0; k < 5; k++) glow.push(P(G.oct, '#7fe8ff', { sx: 0.4, sy: 1.6 + k * 0.4, sz: 0.4, x: Math.cos(k * 1.3) * 0.8, y: 0.8, z: Math.sin(k * 1.3) * 0.8, rz: (k - 2) * 0.2 })); break;
    case 5: parts.push(P(G.tet, '#4e3f66', { sx: 4.5, sy: 2.5, sz: 2.2, y: 0.9, ry: 0.4, rz: 0.15 })); parts.push(P(G.box, '#6c5a86', { sx: 3.5, sy: 0.25, sz: 0.9, x: 1.0, y: 1.6, z: 0.6, rz: 0.3 })); for (let k = 0; k < 4; k++) parts.push(P(G.box, '#5a4a76', { sx: 0.2, sy: 1.5 - k * 0.2, sz: 0.2, x: -1.8 + k * 0.5, y: 0.6, z: -1.2, rz: (k - 1.5) * 0.25 })); glow.push(P(G.sph, '#c080ff', { s: 0.6, x: -1.0, y: 1.0, z: 0.8 })); break;
    case 6: {
      parts.push(P(G.cyl12, '#4a3e34', { sx: 5, sy: 0.6, sz: 5, y: 0.3, jit: 0.1 }));
      parts.push(P(G.frust12, '#5a4a3a', { sx: 3.6, sy: 3.2, sz: 3.6, y: 2.2, jit: 0.1 }));
      parts.push(P(G.cyl12, '#3a2e26', { sx: 2.6, sy: 2.2, sz: 2.6, y: 4.9 }));
      for (let k = 0; k < 3; k++) parts.push(P(G.torus16, '#d4a050', { s: 3.8 - k * 0.6, rx: Math.PI / 2, y: 1.0 + k * 1.8 }));
      for (let k = 0; k < 6; k++) pillar(Math.cos(k * 1.047) * 3.2, Math.sin(k * 1.047) * 3.2, 2.5 + (k % 2), '#6a5a48');
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; parts.push(P(G.box, '#3a2e26', { sx: 0.3, sy: 0.5, sz: 0.3, x: Math.cos(a) * 1.25, y: 6.2, z: Math.sin(a) * 1.25 })); }
      parts.push(P(G.hemi, SNOW, { sx: 2.5, sy: 0.4, sz: 2.5, y: 0.6 }));
      break;
    }
  }
  return { geo: parts.length ? merge(parts) : null, glow: glow.length ? merge(glow) : null };
}
// 永恒之炉以北的远方地标
export function farGeo(i) {
  const parts = [], glow = [], add = (g, c, o) => parts.push(P(g, c, o)), lit = (g, c, o) => glow.push(P(g, c, o));
  const ice = (x, z, h, r = 0) => add(G.oct, '#bfe4f6', { sx: 0.35 + h * 0.08, sy: h, sz: 0.35 + h * 0.08, x, y: h * 0.35, z, rz: r, rx: r * 0.6, jit: 0.15 });
  const rock = (x, z, s, c = '#4a4650') => add(G.dode, c, { sx: s, sy: s * 0.6, sz: s * 0.9, x, y: s * 0.18, z, ry: x * 3, jit: 0.2 });
  switch (i) {
    case 0: { // 冰封灯塔
      for (let k = 0; k < 6; k++) rock(Math.cos(k) * 1.5, Math.sin(k) * 1.5, 1.2 + (k % 3) * 0.3);
      add(G.cyl12, '#5a5660', { sx: 2.2, sy: 0.6, sz: 2.2, y: 0.3 });
      for (let k = 0; k < 6; k++) add(G.frust12, k % 2 ? '#e8e4dc' : '#b8402e', { sx: 1.5 - k * 0.1, sy: 0.75, sz: 1.5 - k * 0.1, y: 0.95 + k * 0.75 });
      add(G.cyl12, '#3a3a40', { sx: 1.5, sy: 0.12, sz: 1.5, y: 5.45 });
      add(G.torus16, '#2a2a30', { s: 1.45, rx: Math.PI / 2, y: 5.75 });
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(G.box, '#2a2a30', { sx: 0.05, sy: 0.6, sz: 0.05, x: Math.cos(a) * 0.48, y: 5.95, z: Math.sin(a) * 0.48 }); }
      lit(G.cyl8, '#bfefff', { sx: 0.8, sy: 0.6, sz: 0.8, y: 5.95 });
      add(G.cone8, '#3a3a40', { sx: 1.2, sy: 0.7, sz: 1.2, y: 6.6 });
      add(G.cone8, '#eef4fa', { sx: 0.9, sy: 0.45, sz: 0.9, y: 6.72 });
      add(G.sph, '#3a3a40', { s: 0.18, y: 7.05 });
      // 冰层从一侧裹上来
      ice(0.9, 0.6, 3.2, 0.25); ice(1.2, -0.3, 2.4, 0.4); ice(0.5, 1.1, 2.0, -0.2); ice(-1.1, 0.8, 1.6, -0.4); ice(-0.8, -1.0, 2.6, -0.3); ice(0.2, -1.3, 1.5, 0.2);
      add(G.hemi, '#eef4fa', { sx: 2.6, sy: 0.35, sz: 2.4, y: 0.05 });
      break;
    }
    case 1: { // 沉睡的破冰船：船身半埋在冰里，船头翘起
      const ry = 0.5, o = (dx, y, dz, extra = {}) => ({ x: Math.cos(ry) * dx + Math.sin(ry) * dz, y, z: -Math.sin(ry) * dx + Math.cos(ry) * dz, ry, ...extra });
      add(G.box, '#3a4a5a', { sx: 4.6, sy: 1.3, sz: 1.9, ...o(-0.3, 0.55, 0), jit: 0.1 });
      add(G.box, '#3a4a5a', { sx: 1.34, sy: 1.3, sz: 1.34, ...o(1.98, 0.62, 0, { ry: ry + Math.PI / 4 }), jit: 0.1 }); // 尖船头
      add(G.box, '#b8402e', { sx: 4.62, sy: 0.3, sz: 1.92, ...o(-0.3, 0.05, 0) });
      add(G.box, '#b8402e', { sx: 1.36, sy: 0.3, sz: 1.36, ...o(1.98, 0.12, 0, { ry: ry + Math.PI / 4 }) });
      add(G.box, '#eef4fa', { sx: 4.3, sy: 0.1, sz: 1.6, ...o(-0.3, 1.24, 0) });
      add(G.box, '#c8c4bc', { sx: 1.5, sy: 0.95, sz: 1.3, ...o(-1.2, 1.7, 0) }); // 驾驶舱
      add(G.box, '#3a3a40', { sx: 1.62, sy: 0.1, sz: 1.42, ...o(-1.2, 2.22, 0) });
      add(G.box, '#eef4fa', { sx: 1.5, sy: 0.08, sz: 1.3, ...o(-1.2, 2.3, 0) });
      for (let k = 0; k < 4; k++) lit(G.box, '#ffcf7a', { sx: 0.2, sy: 0.18, sz: 0.03, ...o(-1.2 + (k - 1.5) * 0.32, 1.85, 0.66) });
      add(G.cyl12, '#2a2a30', { sx: 0.55, sy: 1.4, sz: 0.55, ...o(-0.1, 2.0, 0) });
      add(G.cyl12, '#b8402e', { sx: 0.57, sy: 0.28, sz: 0.57, ...o(-0.1, 2.55, 0) });
      add(G.cyl6, '#4a3a2e', { sx: 0.09, sy: 2.6, sz: 0.09, ...o(1.0, 2.5, 0) });
      add(G.box, '#4a3a2e', { sx: 0.07, sy: 0.07, sz: 1.3, ...o(1.0, 3.3, 0) });
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rx = 3.0, rz = 1.6; add(G.dode, k % 2 ? '#dfeaf2' : '#bfe0f0', { sx: 0.9, sy: 0.4, sz: 0.7, ...o(Math.cos(a) * rx - 0.1, 0.1, Math.sin(a) * rz), jit: 0.15 }); }
      add(G.dode, '#cfe6f4', { sx: 1.1, sy: 0.7, sz: 0.9, ...o(2.6, 0.2, 0.6) }); add(G.dode, '#cfe6f4', { sx: 1.0, sy: 0.6, sz: 0.8, ...o(-2.7, 0.2, -0.5) });
      break;
    }
    case 2: { // 极光观测站
      for (let k = 0; k < 5; k++) rock(Math.cos(k * 1.3) * 1.9, Math.sin(k * 1.3) * 1.9, 0.9 + (k % 2) * 0.4);
      add(G.cyl12, '#6a6a74', { sx: 2.6, sy: 1.6, sz: 2.6, y: 0.8, jit: 0.06 });
      add(G.torus16, '#3a3a40', { s: 2.62, rx: Math.PI / 2, y: 1.55 });
      add(G.hemi, '#c8ccd4', { sx: 2.5, sy: 2.2, sz: 2.5, y: 1.6 });
      add(G.box, '#2a2a30', { sx: 0.45, sy: 1.4, sz: 1.4, x: 0.2, y: 2.45, z: 0.6, rx: -0.5 });
      add(G.cyl12, '#4a4a54', { sx: 0.32, sy: 1.8, sz: 0.32, x: 0.2, y: 2.9, z: 0.9, rx: -0.75 });
      add(G.cyl12, '#2a2a30', { sx: 0.36, sy: 0.12, sz: 0.36, x: 0.2, y: 3.55, z: 1.55, rx: -0.75 });
      add(G.hemi, '#eef4fa', { sx: 2.2, sy: 0.4, sz: 2.2, y: 3.0 });
      add(G.cyl6, '#4a4a54', { sx: 0.08, sy: 2.8, sz: 0.08, x: -1.7, y: 1.4, z: -0.8 });
      add(G.hemi, '#c8ccd4', { sx: 0.9, sy: 0.3, sz: 0.9, x: -1.7, y: 2.85, z: -0.8, rx: 0.9, rz: 0.4 });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3; lit(G.box, '#6ef0be', { sx: 0.18, sy: 0.18, sz: 0.04, x: Math.cos(a) * 1.31, y: 1.0, z: Math.sin(a) * 1.31, ry: -a + Math.PI / 2 }); }
      lit(G.oct, '#6ef0be', { sx: 0.25, sy: 0.6, sz: 0.25, x: -1.7, y: 3.2, z: -0.8 });
      break;
    }
    case 3: { // 冻结的巨像（半跪，双手撑地）
      for (let k = 0; k < 7; k++) rock(Math.cos(k * 0.9) * 2.1, Math.sin(k * 0.9) * 1.9, 0.8 + (k % 3) * 0.3, '#5a5660');
      const st = '#8a8478';
      add(G.box, st, { sx: 1.2, sy: 0.7, sz: 1.6, x: 0.6, y: 0.4, z: 0.5, jit: 0.12 }); // 跪着的腿
      add(G.box, st, { sx: 0.9, sy: 1.4, sz: 0.8, x: -0.6, y: 0.75, z: 0.8, jit: 0.12 });
      add(G.box, st, { sx: 1.8, sy: 2.2, sz: 1.2, y: 2.2, z: -0.2, rx: 0.35, jit: 0.1 }); // 身子前倾
      add(G.dode, st, { sx: 0.95, sy: 1.05, sz: 0.95, y: 3.65, z: 0.35, jit: 0.1 });
      lit(G.box, '#7fe8ff', { sx: 0.16, sy: 0.08, sz: 0.04, x: -0.2, y: 3.7, z: 0.82 }); lit(G.box, '#7fe8ff', { sx: 0.16, sy: 0.08, sz: 0.04, x: 0.2, y: 3.7, z: 0.82 });
      for (const sg of [-1, 1]) {
        add(G.box, st, { sx: 0.55, sy: 2.2, sz: 0.55, x: sg * 1.15, y: 1.75, z: 0.6, rx: -0.45, rz: sg * 0.12, jit: 0.12 }); // 手臂撑地
        add(G.box, st, { sx: 0.75, sy: 0.35, sz: 0.85, x: sg * 1.25, y: 0.2, z: 1.25, jit: 0.1 });
        add(G.box, '#eef4fa', { sx: 0.7, sy: 0.15, sz: 0.7, x: sg * 0.9, y: 3.3, z: -0.15 }); // 肩上的雪
        for (let k = 0; k < 3; k++) add(G.cone4, '#cfeaf8', { sx: 0.12, sy: 0.5 + k * 0.15, sz: 0.12, x: sg * (0.7 + k * 0.2), y: 2.95 - k * 0.1, z: 0.25, rx: Math.PI });
      }
      add(G.cone6, '#eef4fa', { sx: 0.9, sy: 0.3, sz: 0.9, y: 4.2, z: 0.3 });
      add(G.hemi, '#eef4fa', { sx: 3.0, sy: 0.3, sz: 2.8, y: 0.02 });
      break;
    }
    case 4: { // 星落之坑
      add(G.cyl16, '#2a2630', { sx: 5.6, sy: 0.1, sz: 5.6, y: 0.02 });
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; add(G.dode, k % 3 ? '#4a4450' : '#5a5260', { sx: 1.1, sy: 0.6 + (k % 4) * 0.12, sz: 0.8, x: Math.cos(a) * 3.0, y: 0.2, z: Math.sin(a) * 3.0, ry: a, jit: 0.2 }); }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2; add(G.dode, '#eef4fa', { sx: 0.8, sy: 0.25, sz: 0.6, x: Math.cos(a) * 3.1, y: 0.55, z: Math.sin(a) * 3.1, ry: a }); }
      add(G.dode, '#3a2a4a', { sx: 1.8, sy: 1.5, sz: 1.6, y: 0.6, ry: 0.4, jit: 0.15 });
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; lit(G.oct, k % 2 ? '#c080ff' : '#e0b0ff', { sx: 0.3, sy: 1.0 + (k % 3) * 0.4, sz: 0.3, x: Math.cos(a) * 0.8, y: 1.0, z: Math.sin(a) * 0.7, rz: Math.cos(a) * 0.5, rx: Math.sin(a) * 0.5 }); }
      lit(G.oct, '#f0d0ff', { sx: 0.5, sy: 1.8, sz: 0.5, y: 1.6 });
      for (let k = 0; k < 6; k++) { const a = k * 1.9; lit(G.oct, '#a070e0', { sx: 0.14, sy: 0.4, sz: 0.14, x: Math.cos(a) * 2.0, y: 0.15, z: Math.sin(a) * 1.8 }); }
      break;
    }
    case 5: { // 世界之脊：远古巨兽的肋骨架，一根根拱起来
      const bone = '#d8d0c0', arch = new THREE.TorusGeometry(0.5, 0.075, 5, 16, Math.PI);
      for (let k = 0; k < 6; k++) {
        const z = -2.7 + k * 1.05, s = 3.4 + Math.sin(k / 5 * Math.PI) * 2.4, lean = (k - 2.5) * 0.05;
        add(arch, bone, { sx: s, sy: s * 0.95, sz: 1, z, rx: lean, jit: 0.08 });
        add(G.box, '#eef4fa', { sx: 0.5, sy: 0.08, sz: 0.3, y: s * 0.475 + 0.05, z });
        add(G.box, bone, { sx: 0.55, sy: 0.45, sz: 0.55, y: s * 0.475 + 0.1, z, jit: 0.1 }); // 脊椎骨
        add(G.cone4, bone, { sx: 0.2, sy: 0.6, sz: 0.2, y: s * 0.475 + 0.55, z });
        for (const sg of [-1, 1]) add(G.dode, '#eef4fa', { sx: 0.5, sy: 0.25, sz: 0.5, x: sg * s * 0.5, y: 0.08, z });
      }
      add(G.dode, bone, { sx: 1.5, sy: 1.1, sz: 1.7, y: 0.7, z: 3.5, jit: 0.12 }); // 头骨
      add(G.box, '#2a2622', { sx: 0.3, sy: 0.22, sz: 0.1, x: -0.35, y: 0.9, z: 4.3 }); add(G.box, '#2a2622', { sx: 0.3, sy: 0.22, sz: 0.1, x: 0.35, y: 0.9, z: 4.3 });
      lit(G.box, '#7fe8ff', { sx: 0.16, sy: 0.1, sz: 0.04, x: -0.35, y: 0.9, z: 4.36 }); lit(G.box, '#7fe8ff', { sx: 0.16, sy: 0.1, sz: 0.04, x: 0.35, y: 0.9, z: 4.36 });
      for (const sg of [-1, 1]) add(G.cone4, bone, { sx: 0.25, sy: 1.2, sz: 0.25, x: sg * 0.7, y: 1.5, z: 3.2, rz: -sg * 0.5, rx: -0.3 });
      for (let k = 0; k < 8; k++) rock(Math.cos(k * 0.8) * 3.0, Math.sin(k * 0.8) * 3.6, 0.7 + (k % 3) * 0.3, '#5a5660');
      add(G.hemi, '#eef4fa', { sx: 3.4, sy: 0.3, sz: 4.4, y: 0.02 });
      break;
    }
  }
  return { geo: merge(parts), glow: glow.length ? merge(glow) : null };
}
export function eternalFlameGeo() { return merge([P(G.cone6, '#ffd060', { sx: 2.0, sy: 3.0, sz: 2.0, y: 7.5 }), P(G.cone6, '#ffffff', { sx: 1.0, sy: 2.0, sz: 1.0, y: 7.2 })]); }

// ---------- 雾里的地点（探险目标），约 2.4 格见方，周围一圈留空 ----------
export function siteGeo(kind) {
  const p = [], g = [];
  const crate = (x, z, s, ry = 0, c = '#8a6038') => { p.push(P(G.box, c, { s, x, y: s / 2, z, ry, jit: 0.12 })); p.push(P(G.box, '#5e3e24', { sx: s * 1.02, sy: s * 0.12, sz: s * 1.02, x, y: s * 0.55, z, ry })); p.push(P(G.box, SNOW, { sx: s * 0.9, sy: 0.04, sz: s * 0.9, x, y: s + 0.02, z, ry })); };
  const barrel = (x, z, c = '#6a4a3a') => { p.push(P(G.cyl8, c, { sx: 0.2, sy: 0.3, sz: 0.2, x, y: 0.15, z, jit: 0.1 })); p.push(P(G.torus, '#3e3a38', { s: 0.21, rx: Math.PI / 2, x, y: 0.08, z })); p.push(P(G.torus, '#3e3a38', { s: 0.21, rx: Math.PI / 2, x, y: 0.24, z })); p.push(P(G.cyl8, SNOW, { sx: 0.19, sy: 0.03, sz: 0.19, x, y: 0.31, z })); };
  const drift = (x, z, sx, sz, h = 0.12) => p.push(P(G.hemiLo, SNOW, { sx, sy: h, sz, x, z, ry: x * 2 }));
  switch (kind) {
    case 'depot': {
      // 半埋的铁皮仓库：一半屋顶塌了，门口散着箱子
      p.push(P(G.box, '#6e6258', { sx: 1.7, sy: 0.08, sz: 1.2, y: 0.04 }));
      for (const [x, h] of [[-0.8, 0.8], [0.8, 0.8]]) p.push(P(G.box, '#8a7e72', { sx: 0.08, sy: h, sz: 1.1, x, y: h / 2, jit: 0.15 }));
      p.push(P(G.box, '#7c7268', { sx: 1.66, sy: 0.8, sz: 0.08, y: 0.4, z: -0.55, jit: 0.15 }));
      for (let k = 0; k < 7; k++) p.push(P(G.box, k % 2 ? '#9a8e80' : '#857a6e', { sx: 0.03, sy: 0.78, sz: 0.04, x: -0.75 + k * 0.25, y: 0.4, z: -0.6 }));
      p.push(P(G.box, '#a85a3a', { sx: 0.9, sy: 0.05, sz: 1.3, x: -0.42, y: 0.98, rz: 0.32, jit: 0.2 }));
      p.push(P(G.box, '#94503a', { sx: 0.9, sy: 0.05, sz: 1.0, x: 0.45, y: 0.42, z: 0.12, rz: -0.7, rx: 0.15, jit: 0.25 }));
      p.push(P(G.box, SNOW, { sx: 0.86, sy: 0.05, sz: 1.24, x: -0.42, y: 1.02, rz: 0.32 }));
      p.push(P(G.box, '#3e3630', { sx: 0.5, sy: 0.6, sz: 0.02, x: -0.3, y: 0.3, z: 0.56 }));
      p.push(P(G.box, '#7c7268', { sx: 0.5, sy: 0.62, sz: 0.04, x: 0.2, y: 0.31, z: 0.62, ry: -0.6 }));
      crate(0.95, 0.55, 0.3, 0.3); crate(1.05, 0.15, 0.24, -0.2); crate(-0.95, 0.65, 0.26, 0.6, '#7a5a36'); barrel(0.6, 0.85); barrel(-1.1, 0.1, '#5a5a62');
      drift(-0.85, -0.2, 0.7, 0.9, 0.35); drift(0.3, -0.75, 1.1, 0.35, 0.25); drift(0.9, -0.3, 0.4, 0.5, 0.18);
      break;
    }
    case 'camp': {
      // 几顶破帐篷围着一小堆火
      const tent = (x, z, ry, c) => { p.push(P(G.cone4, c, { sx: 0.75, sy: 0.6, sz: 0.6, x, y: 0.3, z, ry: ry + Math.PI / 4, jit: 0.15 })); p.push(P(G.box, '#2a2420', { sx: 0.16, sy: 0.3, sz: 0.02, x: x + Math.sin(ry) * 0.28, y: 0.15, z: z + Math.cos(ry) * 0.28, ry })); p.push(P(G.cone4, SNOW, { sx: 0.5, sy: 0.14, sz: 0.4, x, y: 0.55, z, ry: ry + Math.PI / 4 })); p.push(P(G.box, '#6a4a2a', { sx: 0.03, sy: 0.75, sz: 0.03, x, y: 0.38, z })); };
      tent(-0.75, -0.35, 0.7, '#8a7a5e'); tent(0.7, -0.45, -0.6, '#6e7660'); tent(-0.3, 0.8, 2.6, '#7e6a58');
      p.push(P(G.cyl8, '#3a3634', { sx: 0.5, sy: 0.04, sz: 0.5, y: 0.02, z: 0.1 }));
      for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; p.push(P(G.dode, '#6e6a68', { s: 0.1, x: Math.cos(a) * 0.24, y: 0.04, z: 0.1 + Math.sin(a) * 0.24 })); }
      for (const a of [0.3, 1.9, 3.6]) p.push(P(G.cyl6, '#5a3a22', { sx: 0.06, sy: 0.32, sz: 0.06, x: Math.cos(a) * 0.08, y: 0.08, z: 0.1 + Math.sin(a) * 0.08, rz: Math.cos(a) * 1.1, rx: -Math.sin(a) * 1.1 }));
      g.push(P(G.cone5, '#ff9a3a', { sx: 0.2, sy: 0.32, sz: 0.2, y: 0.2, z: 0.1 })); g.push(P(G.cone5, '#ffe080', { sx: 0.1, sy: 0.2, sz: 0.1, y: 0.16, z: 0.1 }));
      for (const [x, z, ry] of [[0.6, 0.45, 0.4], [-0.55, 0.3, -0.9]]) { p.push(P(G.cyl8, '#5e4230', { sx: 0.12, sy: 0.5, sz: 0.12, rz: Math.PI / 2, x, y: 0.07, z, ry, jit: 0.1 })); p.push(P(G.box, SNOW, { sx: 0.4, sy: 0.02, sz: 0.06, x, y: 0.14, z, ry })); }
      p.push(P(G.cyl8, '#2e2c2c', { sx: 0.14, sy: 0.12, sz: 0.14, x: 0.18, y: 0.38, z: 0.1 })); p.push(P(G.box, '#4a4440', { sx: 0.5, sy: 0.02, sz: 0.02, y: 0.48, z: 0.1 }));
      for (const x of [-0.25, 0.25]) p.push(P(G.box, '#4a3424', { sx: 0.025, sy: 0.5, sz: 0.025, x, y: 0.25, z: 0.1 }));
      crate(1.0, 0.4, 0.22, 0.4); barrel(-1.05, 0.55, '#5c4c3c');
      p.push(P(G.cyl5, '#4a3424', { sx: 0.03, sy: 1.3, sz: 0.03, x: 0.95, y: 0.65, z: -0.9 })); p.push(P(G.box, '#a84a3a', { sx: 0.34, sy: 0.2, sz: 0.01, x: 1.12, y: 1.18, z: -0.9, rz: -0.08, jit: 0.2 }));
      drift(-1.1, -0.9, 0.5, 0.4); drift(1.15, 0.9, 0.4, 0.3);
      break;
    }
    case 'train': {
      // 冰封的车头 + 一节货车厢，压在一小段铁轨上
      for (let k = -5; k <= 5; k++) p.push(P(G.box, '#4a3a2c', { sx: 0.12, sy: 0.05, sz: 0.62, x: k * 0.23, y: 0.025 }));
      for (const z of [-0.2, 0.2]) p.push(P(G.box, '#5a5a62', { sx: 2.6, sy: 0.05, sz: 0.05, y: 0.07, z }));
      const ry = 0.06;
      // 车头
      p.push(P(G.box, '#2e3236', { sx: 1.1, sy: 0.16, sz: 0.56, x: -0.6, y: 0.2, ry }));
      p.push(P(G.cyl12, '#3a4048', { sx: 0.48, sy: 0.75, sz: 0.48, rz: Math.PI / 2, x: -0.78, y: 0.5, z: -0.04, ry, jit: 0.08 }));
      for (const x of [-1.0, -0.78, -0.56]) p.push(P(G.torus16, '#9a7a40', { s: 0.49, ry: Math.PI / 2 + ry, x, y: 0.5, z: -0.04 + x * -ry }));
      p.push(P(G.box, '#4a2a26', { sx: 0.42, sy: 0.6, sz: 0.56, x: -0.22, y: 0.58, ry, jit: 0.1 }));
      p.push(P(G.box, '#26282c', { sx: 0.5, sy: 0.06, sz: 0.64, x: -0.22, y: 0.9, ry }));
      p.push(P(G.box, '#1c1e22', { sx: 0.02, sy: 0.18, sz: 0.3, x: -0.43, y: 0.66, ry }));
      p.push(P(G.cyl8, '#222428', { sx: 0.13, sy: 0.32, sz: 0.13, x: -1.0, y: 0.9, z: 0.03 }));
      p.push(P(G.cone4, '#2e3236', { sx: 0.45, sy: 0.25, sz: 0.5, x: -1.24, y: 0.15, rz: Math.PI / 2, ry }));
      g.push(P(G.cyl8, '#ffd890', { sx: 0.1, sy: 0.03, sz: 0.1, x: -1.17, y: 0.6, rz: Math.PI / 2 }));
      for (const x of [-0.95, -0.55, -0.15]) for (const z of [-0.29, 0.29]) p.push(P(G.cyl12, '#a43a2a', { sx: 0.24, sy: 0.04, sz: 0.24, rx: Math.PI / 2, x, y: 0.14, z }));
      // 货车厢
      p.push(P(G.box, '#6a3a2a', { sx: 0.95, sy: 0.62, sz: 0.58, x: 0.72, y: 0.48, ry: -0.04, jit: 0.15 }));
      for (let k = 0; k < 5; k++) p.push(P(G.box, '#5a2e22', { sx: 0.03, sy: 0.6, sz: 0.6, x: 0.32 + k * 0.2, y: 0.48, ry: -0.04 }));
      p.push(P(G.box, '#3e3634', { sx: 0.32, sy: 0.5, sz: 0.02, x: 0.72, y: 0.46, z: 0.3 }));
      p.push(P(G.box, SNOW, { sx: 0.98, sy: 0.08, sz: 0.62, x: 0.72, y: 0.83, ry: -0.04 }));
      p.push(P(G.box, SNOW, { sx: 0.5, sy: 0.06, sz: 0.62, x: -0.85, y: 0.78, ry }));
      for (const x of [0.45, 0.98]) for (const z of [-0.29, 0.29]) p.push(P(G.cyl8, '#30302e', { sx: 0.2, sy: 0.04, sz: 0.2, rx: Math.PI / 2, x, y: 0.13, z }));
      // 冰
      for (let k = 0; k < 6; k++) p.push(P(G.oct, ICE, { sx: 0.06, sy: 0.22 + (k % 3) * 0.06, sz: 0.06, x: -1.0 + k * 0.38, y: 0.08, z: 0.3, rz: (k % 2 - 0.5) * 0.4 }));
      drift(-0.3, -0.5, 1.3, 0.35, 0.22); drift(1.1, 0.4, 0.4, 0.4, 0.2); drift(-1.2, 0.35, 0.35, 0.3);
      break;
    }
    case 'shrine': {
      // 一大块冰里冻着的石碑，前面摆着蜡烛和石阶
      p.push(P(G.cyl8, '#7a7e88', { sx: 1.5, sy: 0.12, sz: 1.3, y: 0.06, jit: 0.1 }));
      p.push(P(G.cyl8, '#868a94', { sx: 1.1, sy: 0.1, sz: 0.95, y: 0.16, jit: 0.1 }));
      p.push(P(G.box, '#5e5a66', { sx: 0.5, sy: 1.1, sz: 0.18, y: 0.75, z: -0.1, jit: 0.1 }));
      p.push(P(G.cone4, '#4e4a56', { sx: 0.42, sy: 0.24, sz: 0.2, y: 1.42, z: -0.1, ry: Math.PI / 4 }));
      for (let k = 0; k < 5; k++) p.push(P(G.box, '#9a96a8', { sx: 0.3 - (k % 2) * 0.08, sy: 0.025, sz: 0.01, y: 0.5 + k * 0.14, z: 0.0 }));
      g.push(P(G.oct, '#9ff0ff', { sx: 0.12, sy: 0.2, sz: 0.06, y: 1.05, z: 0.01 }));
      // 冰壳（浅蓝，做成几块斜插的冰棱）
      for (let k = 0; k < 9; k++) { const a = -2.6 + k * 0.65; p.push(P(G.oct, k % 2 ? '#bfe2f4' : '#a8d6ee', { sx: 0.22, sy: 0.9 + (k % 3) * 0.35, sz: 0.2, x: Math.cos(a) * 0.62, y: 0.5, z: -0.15 + Math.sin(a) * 0.45, rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.2 })); }
      for (const x of [-0.42, -0.24, 0.24, 0.42]) { p.push(P(G.cyl6, '#e8e0cc', { sx: 0.05, sy: 0.12 + Math.abs(x) * 0.1, sz: 0.05, x, y: 0.26, z: 0.42 })); g.push(P(G.cone5, '#ffcf70', { sx: 0.04, sy: 0.08, sz: 0.04, x, y: 0.36 + Math.abs(x) * 0.05, z: 0.42 })); }
      for (const [x, z] of [[-0.95, 0.55], [0.95, 0.5], [0.9, -0.7], [-0.85, -0.75]]) { p.push(P(G.box, '#6a6672', { sx: 0.16, sy: 0.6, sz: 0.16, x, y: 0.3, z, ry: x, jit: 0.15 })); p.push(P(G.box, SNOW, { sx: 0.18, sy: 0.06, sz: 0.18, x, y: 0.62, z, ry: x })); }
      drift(-0.6, 0.9, 0.5, 0.25); drift(0.7, 0.95, 0.45, 0.22);
      break;
    }
    case 'lab': {
      // 山脊上的圆顶观测站：石砌底座、开缝的圆顶、伸出的望远镜和天线
      p.push(P(G.cyl12, '#6e6a66', { sx: 1.6, sy: 0.2, sz: 1.6, y: 0.1, jit: 0.1 }));
      p.push(P(G.cyl12, '#b4aea4', { sx: 1.1, sy: 0.7, sz: 1.1, y: 0.55, jit: 0.06 }));
      p.push(P(G.torus16, '#7a746c', { s: 1.1, rx: Math.PI / 2, y: 0.9 }));
      p.push(P(G.hemi, '#c8ccd2', { s: 1.08, y: 0.9, jit: 0.05 }));
      p.push(P(G.box, '#2a2c30', { sx: 0.16, sy: 0.5, sz: 0.5, x: 0, y: 1.2, z: 0.18, rx: -0.6 }));
      p.push(P(G.cyl8, '#3a3e46', { sx: 0.12, sy: 0.7, sz: 0.12, y: 1.32, z: 0.3, rx: 0.9 }));
      p.push(P(G.cyl8, '#9a7a40', { sx: 0.15, sy: 0.06, sz: 0.15, y: 1.55, z: 0.58, rx: 0.9 }));
      p.push(P(G.hemi, SNOW, { sx: 0.9, sy: 0.2, sz: 0.9, x: -0.12, y: 1.32, z: -0.15 }));
      p.push(P(G.box, '#4a3a2e', { sx: 0.32, sy: 0.46, sz: 0.04, y: 0.43, z: 0.55 }));
      g.push(P(G.box, '#ffd38a', { sx: 0.18, sy: 0.14, sz: 0.02, x: 0.38, y: 0.66, z: 0.45, ry: 0.6 }));
      p.push(P(G.cyl5, '#4a4a50', { sx: 0.04, sy: 1.6, sz: 0.04, x: 0.85, y: 0.8, z: -0.6 }));
      for (const y of [1.1, 1.35, 1.55]) p.push(P(G.box, '#5a5a62', { sx: 0.34 - (y - 1.1) * 0.3, sy: 0.02, sz: 0.02, x: 0.85, y, z: -0.6 }));
      p.push(P(G.cone5, '#a84a3a', { sx: 0.08, sy: 0.1, sz: 0.08, x: 0.85, y: 1.65, z: -0.6 }));
      for (const [x, z, ry] of [[-0.95, 0.55, 0.3], [0.95, 0.65, -0.4]]) crate(x, z, 0.26, ry, '#5e6670');
      for (let k = 0; k < 6; k++) p.push(P(G.box, '#7a7670', { sx: 0.3, sy: 0.06, sz: 0.2, x: 0.18 - k * 0.02, y: 0.03 + k * 0.035, z: 0.68 + k * 0.08 }));
      drift(-0.7, -0.75, 0.6, 0.4, 0.2); drift(0.3, -0.95, 0.5, 0.3);
      break;
    }
    case 'wreck': {
      // 斜插在雪里的飞艇：破了的气囊露出骨架，吊舱翻在一旁
      const ry = 0.5;
      const ax = (t) => [Math.cos(ry) * t, -Math.sin(ry) * t];
      p.push(P(G.sph2, '#9a8e7a', { sx: 2.6, sy: 0.9, sz: 0.9, x: -0.15, y: 0.45, z: 0.08, ry, rz: 0.22, jit: 0.08 }));
      for (let k = 0; k < 6; k++) { const t = 0.15 + k * 0.2; const [x, z] = ax(t); p.push(P(G.torus16, '#6e665c', { sx: 0.92 - k * 0.06, sy: 0.92 - k * 0.06, sz: 0.9, x, y: 0.42 + t * 0.2, z, ry: ry + Math.PI / 2 })); }
      { const [x, z] = ax(0.7); p.push(P(G.box, '#5e564c', { sx: 1.1, sy: 0.04, sz: 0.04, x, y: 0.82, z, ry, rz: 0.2 })); p.push(P(G.box, '#5e564c', { sx: 1.1, sy: 0.04, sz: 0.04, x, y: 0.4, z, ry, rz: 0.2 })); }
      { const [x, z] = ax(-1.2); p.push(P(G.box, '#7e7464', { sx: 0.06, sy: 0.6, sz: 0.4, x, y: 0.45, z, ry, rz: 0.5 })); p.push(P(G.box, '#7e7464', { sx: 0.06, sy: 0.4, sz: 0.6, x, y: 0.3, z, ry: ry + 0.2, rx: 0.4 })); }
      p.push(P(G.box, '#5a4030', { sx: 0.6, sy: 0.3, sz: 0.34, x: 0.1, y: 0.15, z: 0.62, ry: -0.3, rz: 0.4, jit: 0.15 }));
      p.push(P(G.box, '#2a2c30', { sx: 0.4, sy: 0.08, sz: 0.02, x: 0.1, y: 0.22, z: 0.8, ry: -0.3, rz: 0.4 }));
      p.push(P(G.cyl8, '#4a4a50', { sx: 0.08, sy: 0.5, sz: 0.08, x: 0.55, y: 0.25, z: 0.45, rz: 1.2 }));
      for (const [x, z, s] of [[-1.0, 0.3, 0.6], [0.6, -0.5, 0.5], [-0.3, -0.45, 0.8]]) drift(x, z, s, s * 0.6, 0.2);
      p.push(P(G.box, SNOW, { sx: 1.5, sy: 0.05, sz: 0.4, x: -0.3, y: 0.86, z: 0.08, ry, rz: 0.22 }));
      for (let k = 0; k < 4; k++) p.push(P(G.box, '#c8b898', { sx: 0.3, sy: 0.01, sz: 0.2, x: -1.0 + k * 0.6, y: 0.01, z: 0.85 - k * 0.2, ry: k }));
      break;
    }
  }
  return { geo: merge(p), glow: g.length ? merge(g) : null };
}
// 探索过的地点插一面小旗
// 掠夺者营地：一圈削尖的木桩栅栏（南面留门），三顶黑皮帐篷围着火堆，后面一座瞭望台，营地上插着黑旗；
// 门口两根挂着兽骨的桩子，墙角堆着抢来的箱子和桶。返回 { geo, glow, flag }，散伙后藏起火和旗
export function gangGeo() {
  const p = [], g = [], f = [];
  const drift = (x, z, sx, sz, h = 0.12) => p.push(P(G.hemiLo, SNOW, { sx, sy: h, sz, x, z, ry: x * 2 }));
  // 栅栏
  const R = 1.55, N = 34;
  for (let k = 0; k < N; k++) {
    const a = k / N * Math.PI * 2, gate = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.36;
    if (gate) continue;
    const h = 0.62 + ((k * 7) % 5) * 0.05, x = Math.cos(a) * R, z = Math.sin(a) * R;
    p.push(P(G.cyl5, k % 3 ? '#5a3c24' : '#4a3020', { sx: 0.13, sy: h, sz: 0.13, x, y: h / 2, z, rz: (((k * 13) % 7) - 3) * 0.02 }));
    p.push(P(G.cone5, '#6e4c30', { sx: 0.13, sy: 0.16, sz: 0.13, x, y: h + 0.08, z }));
    if (k % 2) p.push(P(G.box, SNOW, { sx: 0.12, sy: 0.03, sz: 0.12, x, y: h * 0.55, z }));
  }
  for (const hgt of [0.22, 0.48]) for (let k = 0; k < N; k += 2) {
    const a = (k + 1) / N * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.5) continue;
    p.push(P(G.box, '#3e2a1a', { sx: 0.06, sy: 0.04, sz: R * 2 * Math.PI / N * 2.05, x: Math.cos(a) * (R - 0.08), y: hgt, z: Math.sin(a) * (R - 0.08), ry: -a }));
  }
  // 门口：两根挂兽骨的桩子
  for (const sg of [-1, 1]) {
    const x = Math.cos(Math.PI / 2 + sg * 0.42) * R, z = Math.sin(Math.PI / 2 + sg * 0.42) * R;
    p.push(P(G.cyl6, '#3e2a1a', { sx: 0.16, sy: 1.05, sz: 0.16, x, y: 0.52, z }));
    p.push(P(G.sph, '#e8e0cc', { sx: 0.16, sy: 0.13, sz: 0.18, x, y: 1.1, z }));
    for (const dx of [-0.07, 0.07]) p.push(P(G.cone4, '#d8d0bc', { sx: 0.05, sy: 0.16, sz: 0.05, x: x + dx, y: 1.2, z, rz: dx * 4 }));
  }
  // 黑皮帐篷
  const tent = (x, z, ry, c, s = 1) => {
    p.push(P(G.cone6, c, { sx: 0.85 * s, sy: 0.72 * s, sz: 0.85 * s, x, y: 0.36 * s, z, ry, jit: 0.12 }));
    p.push(P(G.cone6, SNOW, { sx: 0.42 * s, sy: 0.2 * s, sz: 0.42 * s, x, y: 0.66 * s, z, ry }));
    for (const d of [-0.06, 0.06]) p.push(P(G.cyl5, '#4a3020', { sx: 0.03, sy: 0.3, sz: 0.03, x: x + d, y: 0.8 * s, z, rz: d * 5 }));
    p.push(P(G.box, '#120e0c', { sx: 0.2 * s, sy: 0.28 * s, sz: 0.02, x: x + Math.sin(ry) * 0.33 * s, y: 0.14 * s, z: z + Math.cos(ry) * 0.33 * s, ry }));
  };
  tent(-0.75, -0.25, 0.9, '#2e2824'); tent(0.72, -0.4, -0.8, '#3a2e26', 1.1); tent(-0.15, -0.88, 0, '#26221e', 0.9);
  // 火堆
  p.push(P(G.cyl8, '#2e2a28', { sx: 0.5, sy: 0.04, sz: 0.5, y: 0.02, z: 0.25 }));
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; p.push(P(G.dode, '#5e5a58', { s: 0.11, x: Math.cos(a) * 0.25, y: 0.04, z: 0.25 + Math.sin(a) * 0.25 })); }
  for (const a of [0.3, 1.9, 3.6]) p.push(P(G.cyl6, '#4a2a18', { sx: 0.06, sy: 0.34, sz: 0.06, x: Math.cos(a) * 0.08, y: 0.09, z: 0.25 + Math.sin(a) * 0.08, rz: Math.cos(a) * 1.1, rx: -Math.sin(a) * 1.1 }));
  g.push(P(G.cone5, '#ff8a2a', { sx: 0.24, sy: 0.38, sz: 0.24, y: 0.22, z: 0.25 })); g.push(P(G.cone5, '#ffd070', { sx: 0.12, sy: 0.24, sz: 0.12, y: 0.17, z: 0.25 }));
  // 瞭望台（栅栏里东北角）
  const tx = 0.85, tz = -1.0, th = 1.25;
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) p.push(P(G.cyl5, '#4a3020', { sx: 0.06, sy: th, sz: 0.06, x: tx + dx, y: th / 2, z: tz + dz }));
  p.push(P(G.box, '#5a3c24', { sx: 0.5, sy: 0.05, sz: 0.5, x: tx, y: th, z: tz }));
  for (const [dx, dz, sx, sz] of [[0, -0.24, 0.5, 0.03], [0, 0.24, 0.5, 0.03], [-0.24, 0, 0.03, 0.5], [0.24, 0, 0.03, 0.5]]) p.push(P(G.box, '#4a3020', { sx, sy: 0.18, sz, x: tx + dx, y: th + 0.12, z: tz + dz }));
  p.push(P(G.cone4, '#2e2824', { sx: 0.5, sy: 0.3, sz: 0.5, x: tx, y: th + 0.5, z: tz, ry: Math.PI / 4 }));
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, 0.18]]) p.push(P(G.cyl5, '#4a3020', { sx: 0.03, sy: 0.32, sz: 0.03, x: tx + dx, y: th + 0.2, z: tz + dz }));
  p.push(P(G.box, SNOW, { sx: 0.3, sy: 0.04, sz: 0.3, x: tx, y: th + 0.58, z: tz, ry: Math.PI / 4 }));
  // 抢来的东西：箱子、桶、一辆翻倒的雪橇，矛架
  for (const [x, z, sz, c] of [[-1.05, 0.45, 0.24, '#8a6038'], [-0.9, 0.7, 0.2, '#6a4a2c'], [1.05, 0.3, 0.22, '#7a5a3a']]) { p.push(P(G.box, c, { s: sz, x, y: sz / 2, z, ry: x, jit: 0.12 })); p.push(P(G.box, SNOW, { sx: sz * 0.9, sy: 0.03, sz: sz * 0.9, x, y: sz + 0.015, z, ry: x })); }
  p.push(P(G.cyl8, '#5a4a3a', { sx: 0.18, sy: 0.26, sz: 0.18, x: 1.0, y: 0.13, z: 0.62 }));
  p.push(P(G.box, '#6a4a2c', { sx: 0.55, sy: 0.05, sz: 0.24, x: 0.45, y: 0.14, z: 0.85, rz: 0.5, ry: 0.4 }));
  for (let k = 0; k < 4; k++) { p.push(P(G.cyl5, '#5a4030', { sx: 0.025, sy: 0.75, sz: 0.025, x: -0.55 + k * 0.08, y: 0.4, z: 0.62, rx: -0.15 })); p.push(P(G.cone4, '#9aa0a8', { sx: 0.04, sy: 0.1, sz: 0.04, x: -0.55 + k * 0.08, y: 0.8, z: 0.57, rx: -0.15 })); }
  p.push(P(G.box, '#3e2a1a', { sx: 0.4, sy: 0.04, sz: 0.04, x: -0.43, y: 0.55, z: 0.6 }));
  drift(-1.2, -0.9, 0.6, 0.4); drift(1.25, 0.95, 0.45, 0.35); drift(-0.2, 1.2, 0.5, 0.25, 0.1);
  // 黑旗：高杆子，旗面三段折出飘的样子，上面一道白条
  f.push(P(G.cyl5, '#3a2a1c', { sx: 0.06, sy: 2.3, sz: 0.06, x: -0.2, y: 1.15, z: -0.3 }));
  for (let k = 0; k < 3; k++) f.push(P(G.box, k === 1 ? '#1e1a18' : '#141210', { sx: 0.26, sy: 0.46, sz: 0.02, x: -0.2 + 0.15 + k * 0.25, y: 2.0 - k * 0.03, z: -0.3 + Math.sin(k * 1.7) * 0.05, ry: k % 2 ? 0.25 : -0.25 }));
  f.push(P(G.box, '#d8d0c0', { sx: 0.7, sy: 0.05, sz: 0.024, x: -0.2 + 0.4, y: 2.02, z: -0.29, ry: 0.05 }));
  return { geo: merge(p), glow: merge(g), flag: merge(f) };
}
export function siteFlagGeo() {
  return merge([
    P(G.cyl5, '#3a3430', { sx: 0.04, sy: 1.1, sz: 0.04, y: 0.55 }),
    P(G.box, '#d86a2a', { sx: 0.38, sy: 0.24, sz: 0.012, x: 0.2, y: 0.95, rz: -0.06, jit: 0.15 }),
    P(G.cyl6, '#4a4440', { sx: 0.14, sy: 0.06, sz: 0.14, y: 0.03 }),
  ]);
}
