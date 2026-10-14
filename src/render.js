// 2.5D 画面：斜俯视镜头、低多边形地形、建筑、小人、迷雾、雪、烟
import * as THREE from 'three';
import { W, H, getWorld, idx, T_SNOW, T_ROCK, T_ICE, hash3 } from './worldgen.js';
import { SPOT_KEYS, SPOTS, BLD, LANDMARKS, LM_R, FAR_MARKS, RES, furnaceRadius, RAIDERS, tierOfRow, ETERNAL_STAGES, dayCycle, FOCUS } from './data.js';
import * as M from './models.js';
import * as Sim from './sim.js';
import { RICON } from './ui.js';

const toW = (x, y) => new THREE.Vector3(x, 0, -y);
const RESCOL = Object.fromEntries(Object.entries(RES).map(([k, v]) => [k, new THREE.Color(v.c)]));
// 平滑的值噪声（地形底色、山脉起伏用）
const vn = (x, y, sc, sd) => { const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; const a = hash3(x0, y0, sd), b = hash3(x0 + 1, y0, sd), c = hash3(x0, y0 + 1, sd), d = hash3(x0 + 1, y0 + 1, sd); const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
// 雪地底色：大片的明暗斑块 + 顺风的条纹，避免棋盘感（地图内外共用，接缝看不出来）
const snowColor = (x, y, c) => {
  const north = Math.max(0, Math.min(1, y / H));
  const patch = vn(x, y, 7, 21) - 0.5, fine = vn(x, y, 2.3, 22) - 0.5, streak = vn(x * 0.35, y * 2.2, 3, 23) - 0.5;
  const cold = vn(x, y, 13, 24);
  return c.setHSL(0.58 + north * 0.03 + cold * 0.02, 0.26 + north * 0.15 + cold * 0.1, 0.86 - north * 0.08 + patch * 0.05 + fine * 0.018 + streak * 0.022);
};
// 资源点模型的占地半径（缩放为 1 时）与每格最多几个
const SPOT_R = { tree: 0.39, herd: 0.3, rock: 0.42, coal: 0.42, ore: 0.4, lime: 0.4, shale: 0.42, crystal: 0.3, star: 0.45, shard: 0.35 };
const SPOT_PER = { tree: 3, herd: 2, rock: 1, coal: 2, ore: 2, lime: 2, shale: 1, crystal: 2, star: 1, shard: 2 };
const COATS = ['#b8483a', '#3a6ab8', '#c89a3a', '#4a8a5a', '#8a4aa8', '#c86a2a', '#3a8a9a', '#6a6a7a'].map(c => new THREE.Color(c));
const WSLOT = [-0.15, 0.15, -0.45, 0.45]; // 建筑门前的固定工位

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    const lowEnd = Math.min(screen.width, screen.height) < 700;
    this.lowEnd = lowEnd;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowEnd, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(lowEnd ? 1.5 : 2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.bg = new THREE.Color('#8a9db4');
    this.scene.background = this.bg;
    this.scene.fog = new THREE.Fog(this.bg, 40, 120);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
    this.cam = { tx: 24, ty: 10, dist: 30, yaw: 0, ttx: 24, tty: 10, tdist: 30, tyaw: 0 };

    this.hemi = new THREE.HemisphereLight('#d2e2ff', '#5a6676', 1.1);
    this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#ffd9ae', 1.55);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
    const sc = sun.shadow.camera; sc.left = -28; sc.right = 28; sc.top = 28; sc.bottom = -28; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun, sun.target);

    this.matStd = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.matFig = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.matWin = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); // 窗户：白天暗、夜里亮
    // 地面：在顶点色上叠一层按世界坐标算的细纹（风吹出的雪纹、深浅斑驳），强度随画质
    this.groundU = { value: 0.45 };
    this.matGround = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.matGround.onBeforeCompile = sh => {
      sh.uniforms.uDetail = this.groundU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; uniform float uDetail;
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }`).replace('#include <color_fragment>', `#include <color_fragment>
if (uDetail > 0.0) {
  vec2 p = vWP.xz;
  float n1 = gn(p * 0.9), n2 = gn(p * 4.3 + 17.0), n3 = gn(p * 13.0 + 5.0);
  float rip = sin(p.x * 2.6 + p.y * 0.7 + n1 * 5.0) * 0.5 + 0.5;
  float snowy = smoothstep(0.42, 0.78, dot(diffuseColor.rgb, vec3(0.3333)));
  float d = (n1 - 0.5) * 0.08 + (n2 - 0.5) * 0.05 + (n3 - 0.5) * 0.03 + (rip - 0.5) * 0.045;
  diffuseColor.rgb *= 1.0 + d * uDetail * snowy;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.95, 1.05), (1.0 - n1) * 0.4 * uDetail * snowy);
}`);
    };

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.bldGroup = new THREE.Group(); this.scene.add(this.bldGroup);
    this.buildings = new Map();
    this.lights = [0, 1, 2, 3].map(() => { const l = new THREE.PointLight('#ff8a30', 0, 18, 1.5); this.scene.add(l); return l; });

    // 小人、货物、狼、雪橇
    this.figs = new THREE.InstancedMesh(M.figureGeo(), this.matFig, 1400);
    this.figs.castShadow = true; this.figs.frustumCulled = false; this.figs.count = 0;
    this.figs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1400 * 3), 3);
    this.figsD = new THREE.InstancedMesh(M.figureDetailGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 1400);
    this.figsD.frustumCulled = false; this.figsD.count = 0;
    this.crates = new THREE.InstancedMesh(M.crateGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }), 1000);
    this.crates.frustumCulled = false; this.crates.count = 0;
    this.crates.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1000 * 3), 3);
    this.wolves = new THREE.InstancedMesh(M.wolfGeo(), this.matFig, 120);
    this.wolves.frustumCulled = false; this.wolves.count = 0; this.wolves.castShadow = true;
    this.wolves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);
    this.sleds = new THREE.InstancedMesh(M.sledGeo(false), this.matStd, 40); this.sleds.count = 0; this.sleds.frustumCulled = false; this.sleds.castShadow = true;
    this.trains = new THREE.InstancedMesh(M.sledGeo(true), this.matStd, 40); this.trains.count = 0; this.trains.frustumCulled = false; this.trains.castShadow = true;
    this.bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe080', toneMapped: false }), 80); this.bolts.count = 0; this.bolts.frustumCulled = false;
    this.torches = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffb040', toneMapped: false }), 60); this.torches.count = 0; this.torches.frustumCulled = false;
    this.dogs = new THREE.InstancedMesh(M.dogGeo(), this.matStd, 200); this.dogs.count = 0; this.dogs.frustumCulled = false; this.dogs.castShadow = true;
    this.dogs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(200 * 3).fill(1), 3);
    this.scene.add(this.figs, this.figsD, this.crates, this.wolves, this.sleds, this.trains, this.bolts, this.torches, this.dogs);
    this.initAnim();

    this.initParticles();
    this.initFx();
    this.initNight();
    this.initSky();
    this.ghost = null;
    this.sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffd060', toneMapped: false }));
    this.sel.visible = false; this.scene.add(this.sel);
    this.raids = []; this.shots = [];
    this.time = 0;
    this.blizz = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler();
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.vw = w; this.vh = h; // 画布铺满屏幕：记下尺寸，投影时不用每次量（每帧量会逼浏览器重新排版）
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 46 : 36; // 竖屏视野更宽一点
    this.camera.updateProjectionMatrix();
  }

  // ---------- 绑定新的一轮 ----------
  bind(S) {
    this.S = S;
    for (const o of [...this.root.children]) { this.root.remove(o); o.geometry && o.geometry.dispose(); }
    for (const [, b] of this.buildings) this.bldGroup.remove(b.g);
    this.buildings.clear();
    Sim.applyVeins(S); // 勘探找到的矿脉先补进地图
    this.world = getWorld(S.runSeed);
    this.buildTerrain();
    this.buildSpots();
    this.buildLandmarks();
    this.buildFar();
    this.buildSites();
    this.buildFog();
    this.refreshLandmarks();
    this.ringSig = ''; this.lineSig = '';
    this.rings = new THREE.Group(); this.root.add(this.rings);
    this.lineGroup = new THREE.Group(); this.root.add(this.lineGroup);
    this.pathGroup = new THREE.Group(); this.root.add(this.pathGroup);
    this.buildDecor();
    this.syncBuildings(true);
    const c = S.camps.find(c => c.id === S.active) || S.camps[0];
    this.focus(c.x, c.y, true);
  }

  buildTerrain() {
    const w = this.world;
    const CH = 23;
    const snowCol = snowColor;
    for (let y0 = 0; y0 < H; y0 += CH) {
      const y1 = Math.min(H, y0 + CH);
      const n = W * (y1 - y0);
      const pos = new Float32Array(n * 18), col = new Float32Array(n * 18);
      let o = 0;
      const c = new THREE.Color(), cv = new THREE.Color();
      const hAt = (x, y) => (x <= 0 || y <= 0 || x >= W || y >= H ? 0.02 : hash3(x, y, 99) * 0.07); // 边缘与山体严丝合缝
      const wAt = (vx, vy, T) => { let n = 0, m = 0; for (const [ax, ay] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]]) { if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue; m++; if (w.terrain[idx(ax, ay)] === T) n++; } return m ? n / m : 0; };
      for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const tileJ = (hash3(x, y, 3) - 0.5) * 0.012 + (w.height[i] - 0.5) * 0.04;
        const v = [[x, y, hAt(x, y)], [x + 1, y, hAt(x + 1, y)], [x + 1, y + 1, hAt(x + 1, y + 1)], [x, y + 1, hAt(x, y + 1)]];
        for (const k of [0, 1, 2, 0, 2, 3]) {
          const [vx, vy, vh] = v[k];
          // 冰面和岩地按顶点周围四格的比例混色，湖岸不再是一格一格的方块
          const ice = wAt(vx, vy, T_ICE), rock = wAt(vx, vy, T_ROCK);
          pos[o] = vx; pos[o + 1] = vh - 0.03 * ice; pos[o + 2] = -vy;
          snowCol(vx, vy, cv); cv.offsetHSL(0, 0, tileJ * (1 - ice));
          if (rock) cv.lerp(c.set('#9ea7b2'), 0.55 * rock);
          if (ice) cv.lerp(c.set('#a9cfe6').offsetHSL(0, 0, (vn(vx, vy, 1.7, 25) - 0.5) * 0.06), Math.min(1, ice * 1.25));
          col[o] = cv.r; col[o + 1] = cv.g; col[o + 2] = cv.b;
          o += 3;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.matGround);
      m.receiveShadow = true;
      this.root.add(m);
    }
    // 远处的雪原（被群山挡住，只在最远处露一点）
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(900, H + 600), new THREE.MeshLambertMaterial({ color: '#b4c2d2' }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(W / 2, -0.4, -H / 2); outer.receiveShadow = false;
    this.root.add(outer);
    this.buildSkirt();
    // 岩石
    const rocks = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (w.terrain[idx(x, y)] === T_ROCK) rocks.push([x, y]);
    const rg = M.merge([M.P(new THREE.DodecahedronGeometry(0.5, 0), '#8c939d', { sx: 1.25, sy: 1.1, sz: 1.2, y: 0.3, jit: 0.25 }), M.P(new THREE.DodecahedronGeometry(0.5, 0), '#f0f5fa', { sx: 1.0, sy: 0.4, sz: 0.95, y: 0.72 })]);
    const im = new THREE.InstancedMesh(rg, this.matStd, rocks.length);
    im.castShadow = true; im.receiveShadow = true;
    this.rocks = { im, list: rocks };
    this.root.add(im);
  }

  // 地图外的群山：山脚线弯弯曲曲，离地图越远越高；陡的地方露出岩石，缓坡上长着冷杉
  buildSkirt() {
    const XR = 45, YS = 39, YN = 36, ST = 1.5;
    const mtn = (x, y) => {
      const dx = x < 0 ? -x : x > W ? x - W : 0, dy = y < 0 ? -y : y > H ? y - H : 0;
      const d = Math.hypot(dx, dy);
      if (d <= 0.01) return { h: 0.02, d: 0, foot: 1 };
      const foot = 0.8 + 3.6 * vn(x, y, 11, 31) + 1.6 * vn(x, y, 4.5, 32);
      const t = Math.max(0, d - foot);
      const amp = 9 + 26 * Math.pow(vn(x, y, 41, 33), 1.2);
      const rise = 1 - Math.exp(-t / (6 + 6 * vn(x, y, 23, 34)));
      const ridge = 1 - Math.abs(vn(x, y, 14, 35) * 2 - 1);
      let h = amp * rise * (0.72 + 0.28 * ridge) + rise * 1.6 * vn(x, y, 5, 36);
      h += 0.22 * vn(x, y, 2.6, 37) * Math.min(1, d / (foot + 1.5)) + 0.02;
      return { h, d, foot };
    };
    // 一棵简化的冷杉：顶点与颜色直接写进山体的数组里
    const firG = M.merge([
      M.P(new THREE.CylinderGeometry(0.5, 0.5, 1, 5), '#4a3020', { sx: 0.12, sy: 0.35, sz: 0.12, y: 0.17 }),
      M.P(new THREE.ConeGeometry(0.5, 1, 6), '#2a5040', { sx: 0.85, sy: 0.65, sz: 0.85, y: 0.6, jit: 0.15 }),
      M.P(new THREE.ConeGeometry(0.5, 1, 6), '#e8eef5', { sx: 0.5, sy: 0.3, sz: 0.5, y: 0.75, ry: 0.4 }),
      M.P(new THREE.ConeGeometry(0.5, 1, 6), '#2f5a46', { sx: 0.62, sy: 0.6, sz: 0.62, y: 1.0, ry: 0.5, jit: 0.15 }),
      M.P(new THREE.ConeGeometry(0.5, 1, 6), '#e8eef5', { sx: 0.34, sy: 0.32, sz: 0.34, y: 1.2, ry: 0.9 }),
    ]);
    const boulderG = M.merge([M.P(new THREE.DodecahedronGeometry(0.5, 0), '#7f8792', { sx: 1.2, sy: 0.8, sz: 1.0, y: 0.2, jit: 0.2 }), M.P(new THREE.DodecahedronGeometry(0.5, 0), '#eef3f8', { sx: 0.9, sy: 0.3, sz: 0.8, y: 0.5 })]);
    const tmpl = g => ({ p: g.attributes.position.array, c: g.attributes.color.array });
    const FIR = tmpl(firG), BOU = tmpl(boulderG);
    const regions = [[-XR, 0, -YS, H + YN], [W, W + XR, -YS, H + YN], [0, W, -YS, 0], [0, W, H, H + YN]];
    const c = new THREE.Color(), rockC = new THREE.Color(), snowC = new THREE.Color();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), e = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (const [x0, x1, y0, y1] of regions) {
      const nx = Math.round((x1 - x0) / ST);
      const sx = (x1 - x0) / nx;
      const CHY = 40;
      for (let cy0 = y0; cy0 < y1; cy0 += CHY * ST) {
        const cy1 = Math.min(y1, cy0 + CHY * ST);
        const ny = Math.max(1, Math.round((cy1 - cy0) / ST)), sy = (cy1 - cy0) / ny;
        // 顶点高度网格
        const hs = new Float32Array((nx + 1) * (ny + 1));
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) hs[j * (nx + 1) + i] = mtn(x0 + i * sx, cy0 + j * sy).h;
        const pos = [], col = [];
        const tri = (p0, p1, p2) => {
          a.set(p0[0], p0[2], -p0[1]); b.set(p1[0], p1[2], -p1[1]); e.set(p2[0], p2[2], -p2[1]);
          nrm.subVectors(b, a).cross(e.clone().sub(a)).normalize();
          const cx = (p0[0] + p1[0] + p2[0]) / 3, cyy = (p0[1] + p1[1] + p2[1]) / 3, hh = (p0[2] + p1[2] + p2[2]) / 3;
          snowColor(cx, cyy, snowC).offsetHSL(0, -0.04, Math.min(0.07, hh * 0.004));
          const ny2 = Math.abs(nrm.y), strata = vn(cx, cyy * 0.6 + hh * 2, 3.5, 43);
          if (hh > 1.2 && (ny2 < 0.6 || (ny2 < 0.74 && strata > 0.62))) { rockC.setHSL(0.6, 0.12, 0.3 + ny2 * 0.16 + (strata - 0.5) * 0.08); c.copy(rockC); }
          else if (hh > 1.2 && ny2 < 0.8) c.copy(snowC).lerp(rockC.setHSL(0.6, 0.1, 0.5), 0.35);
          else c.copy(snowC);
          for (const q of [p0, p1, p2]) { pos.push(q[0], q[2], -q[1]); col.push(c.r, c.g, c.b); }
        };
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const xa = x0 + i * sx, xb = xa + sx, ya = cy0 + j * sy, yb = ya + sy;
          const h00 = hs[j * (nx + 1) + i], h10 = hs[j * (nx + 1) + i + 1], h01 = hs[(j + 1) * (nx + 1) + i], h11 = hs[(j + 1) * (nx + 1) + i + 1];
          const p00 = [xa, ya, h00], p10 = [xb, ya, h10], p01 = [xa, yb, h01], p11 = [xb, yb, h11];
          if ((i + j) % 2) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
          // 山脚附近的冷杉林与散石
          const mx = xa + sx * (0.2 + hash3(i, Math.floor(ya), 51) * 0.6), my = ya + sy * (0.2 + hash3(i, Math.floor(ya), 52) * 0.6);
          const info = mtn(mx, my);
          const rel = info.d - info.foot;
          const slope = Math.abs(h10 - h00) + Math.abs(h01 - h00);
          const dens = rel < -0.3 ? 0.07 : rel < 10 ? 1.1 * (1 - rel / 12) * (0.2 + vn(mx, my, 9, 53)) : 0.04;
          const r = hash3(Math.floor(mx * 7), Math.floor(my * 7), 54);
          if (info.d > 0.6 && slope < 1.6 && r < dens) {
            const T = r < dens * 0.82 ? FIR : BOU;
            const scl = T === FIR ? 0.9 + hash3(i, j, 55) * 1.0 : 0.5 + hash3(i, j, 56) * 0.9;
            const ang = hash3(i, j, 57) * 6.28, ca = Math.cos(ang), sa = Math.sin(ang);
            const by = info.h - 0.08;
            for (let k = 0; k < T.p.length; k += 3) {
              const px = T.p[k] * scl, py = T.p[k + 1] * scl, pz = T.p[k + 2] * scl;
              pos.push(mx + px * ca - pz * sa, by + py, -my + px * sa + pz * ca);
              col.push(T.c[k], T.c[k + 1], T.c[k + 2]);
            }
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.computeVertexNormals(); g.computeBoundingSphere();
        const m = new THREE.Mesh(g, this.matGround);
        m.receiveShadow = true;
        this.root.add(m);
      }
    }
  }

  // 只摆镜头附近、已揭开的岩石（整张图一千行，全摆出来太费）
  refreshRocks() {
    const { im } = this.rocks, S = this.S, cy = this.cam.ty;
    let n = 0;
    for (const [bx, by, , , s] of this.boulders) {
      const x = Math.floor(bx), y = Math.floor(by);
      if (y < cy - 62 || y > cy + 62 || S.reveal[idx(x, y)] !== 1) continue;
      this._e.set(0, hash3(x, y, 8) * 6.28, 0);
      this._m.compose(this._v.set(bx, 0, -by), this._q.setFromEuler(this._e), this._s.set(s, s * (0.7 + hash3(x, y, 9) * 0.6), s));
      im.setMatrixAt(n++, this._m);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }
  // 资源点：先给整张图排好每个模型的位置和大小（互不穿插、不压岩石），之后只按库存缩放
  layoutSpots() {
    const w = this.world;
    const R = SPOT_R, per = SPOT_PER;
    const buckets = this.spotBuckets = new Map();
    const put = (i, it) => { let L = buckets.get(i); if (!L) buckets.set(i, L = []); L.push(it); };
    // 岩石格上的大石头先占位
    this.boulders = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (w.terrain[idx(x, y)] === T_ROCK) {
      const sc = 0.75 + hash3(x, y, 7) * 0.35, r = 0.62 * sc * 0.85;
      const b = [x + 0.5, y + 0.5, r, 'boulder', sc];
      this.boulders.push(b); put(idx(x, y), b);
    }
    const fits = (px, py, r, kind, tx, ty) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = tx + dx, yy = ty + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const L = buckets.get(yy * W + xx); if (!L) continue;
        for (const it of L) { const k = kind === 'tree' && it[3] === 'tree' ? 0.8 : 1; if (Math.hypot(px - it[0], py - it[1]) < (r + it[2]) * k) return false; }
      }
      return true;
    };
    const tiles = [];
    for (let i = 0; i < W * H; i++) if (w.spot[i] >= 0) tiles.push(i);
    // 第一轮每格放一个主模型，后两轮在空隙里补小一点的
    for (let pass = 0; pass < 3; pass++) for (const i of tiles) {
      const kind = SPOT_KEYS[w.spot[i]];
      if (pass >= per[kind]) continue;
      const x0 = i % W, y0 = Math.floor(i / W);
      const base = 0.8 + hash3(x0, y0, 60 + pass) * 0.4;
      const scales = pass === 0 ? [base, base * 0.85, base * 0.7, 0.55] : [base * 0.8, base * 0.62, 0.5];
      let done = false;
      for (const sc of scales) {
        for (let t = 0; t < 8 && !done; t++) {
          const px = x0 + (pass === 0 && t === 0 ? 0.4 + hash3(x0, y0, 20) * 0.2 : 0.15 + hash3(x0, y0, 100 + pass * 16 + t) * 0.7);
          const py = y0 + (pass === 0 && t === 0 ? 0.4 + hash3(x0, y0, 40) * 0.2 : 0.15 + hash3(x0, y0, 140 + pass * 16 + t) * 0.7);
          if (fits(px, py, R[kind] * sc, kind, x0, y0)) { put(i, [px, py, R[kind] * sc, kind, sc, hash3(x0, y0, 80 + pass) * 6.28, pass]); done = true; }
        }
        if (done) break;
      }
      if (!done && pass === 0) put(i, [x0 + 0.5, y0 + 0.5, R[kind] * 0.5, kind, 0.5, hash3(x0, y0, 80) * 6.28, 0]);
    }
  }
  // 勘探找到新矿脉后：资源点模型整套重摆一遍
  rebuildSpots() {
    for (const k in this.spotMeshes || {}) { const im = this.spotMeshes[k]; this.root.remove(im); if (im.material !== this.matStd) im.material.dispose(); im.dispose && im.dispose(); }
    if (this.deerHead) { this.root.remove(this.deerHead); this.deerHead.dispose && this.deerHead.dispose(); }
    for (const k in this.remnants || {}) { this.root.remove(this.remnants[k]); this.remnants[k].dispose && this.remnants[k].dispose(); }
    this.buildSpots();
    this.decorKey = '';
  }
  buildSpots() {
    const w = this.world;
    this.spotMeshes = {};
    this.layoutSpots();
    this.refreshRocks();
    const lists = {};
    for (let i = 0; i < W * H; i++) if (w.spot[i] >= 0) (lists[SPOT_KEYS[w.spot[i]]] ||= []).push(i);
    for (const k of SPOT_KEYS) {
      const L = lists[k] || [];
      const n = L.length * SPOT_PER[k];
      const mat = M.SPOT_GLOW.has(k) ? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(SPOTS[k].res === 'crystal' ? '#2a6a80' : k === 'shard' ? '#803a00' : '#40206a') }) : k === 'herd' ? this.matAnim : this.matStd;
      const im = new THREE.InstancedMesh(M.spotGeo(k), mat, Math.max(1, n));
      im.castShadow = k !== 'shale'; im.receiveShadow = false;
      im.userData = { tiles: L, kind: k };
      this.spotMeshes[k] = im;
      this.root.add(im);
      if (k === 'herd') {
        im.frustumCulled = false; M.animInst(im); im.customDepthMaterial = this.matAnimD;
        this.deerHead = new THREE.InstancedMesh(M.deerGeo().head, this.matStd, Math.max(1, n));
        this.deerHead.frustumCulled = false; this.deerHead.castShadow = true; this.deerHead.count = 0;
        this.root.add(this.deerHead);
      }
    }
    this.deer = []; this.deerMap = new Map();
    // 采空的痕迹
    this.remnants = {};
    for (const k of ['stump', 'pit']) {
      const im = new THREE.InstancedMesh(M.remnantGeo(k), this.matStd, 3000);
      im.count = 0; im.receiveShadow = true; im.castShadow = k === 'stump';
      this.remnants[k] = im; this.root.add(im);
    }
    this.refreshSpots();
  }
  // 建筑占地（含门前一小块站人的地方），资源点模型不能伸进来
  bldRects() {
    const out = [];
    for (const b of this.S.buildings) { const s = BLD[b.type].size; out.push([b.x - 0.02, b.y - (b.type === 'furnace' ? 0.3 : 0.65), b.x + s + 0.02, b.y + s + 0.02]); }
    return out;
  }
  refreshSpots() {
    const S = this.S, cy = this.cam.ty;
    this.spotWin = Math.round(cy / 10); this.spotGen = (this.spotGen || 0) + 1;
    this.spotBld = this.bldSig;
    const rects = this.bldRects().filter(r => r[3] > cy - 64 && r[1] < cy + 64);
    const hit = (x, y, r) => { for (const q of rects) { const nx = Math.max(q[0], Math.min(x, q[2])), ny = Math.max(q[1], Math.min(y, q[3])); if (Math.hypot(x - nx, y - ny) < r) return true; } return false; };
    this.liveSpots = new Map(); // 本次实际摆出来的模型，给装饰和小人避让用
    this.bRects = rects;
    const newDeer = [];
    const rem = { stump: 0, pit: 0 };
    for (const k in this.spotMeshes) {
      const im = this.spotMeshes[k];
      const { tiles } = im.userData;
      let n = 0;
      for (const i of tiles) {
        const x = i % W, y = Math.floor(i / W);
        if (y < cy - 62 || y > cy + 62 || S.reveal[i] !== 1) continue;
        const left = Sim.spotLeft(S, i), mx = Sim.spotMax(S, i);
        if (left <= 0) {
          // 采空：树留下树桩，矿和石头留下坑；猎场什么也不留
          if (k === 'herd' || k === 'shale') continue;
          const rk = k === 'tree' ? 'stump' : 'pit', im2 = this.remnants[rk];
          for (const it of this.spotBuckets.get(i) || []) {
            if (it[3] !== k || (rk === 'pit' && it[6] > 0) || rem[rk] >= 3000) continue;
            const sc = rk === 'stump' ? 0.8 + it[4] * 0.4 : it[4];
            if (hit(it[0], it[1], SPOT_R[k] * sc * 0.6)) continue;
            this._e.set(0, it[5], 0);
            this._m.compose(this._v.set(it[0], 0.005, -it[1]), this._q.setFromEuler(this._e), this._s.set(sc, sc, sc));
            im2.setMatrixAt(rem[rk]++, this._m);
            (this.liveSpots.get(i) || this.liveSpots.set(i, []).get(i)).push([it[0], it[1], rk === 'stump' ? 0.18 : SPOT_R[k] * sc * 0.8]);
          }
          continue;
        }
        // 树苗：从很小长起，长成（三成储量）时正好接上成树的大小
        const f = Sim.isSapling(S, i) ? 0.3 + 0.3 * Math.min(1, left / (mx * Sim.SAP_RIPE)) : 0.45 + 0.55 * Math.min(1, left / mx);
        const L = this.spotBuckets.get(i) || [];
        for (const it of L) {
          if (it[3] !== k) continue;
          let px = it[0], py = it[1], sc = it[4] * (k === 'herd' ? 1 : f);
          if (k === 'herd' && it[6] > 0 && left / mx < 0.5) continue; // 猎物少了，鹿也少几头
          if (hit(px, py, SPOT_R[k] * sc)) {
            if (it[6] > 0) continue; // 补位的小模型直接不摆
            px = x + 0.5; py = y + 0.5;
            for (let t = 0; t < 4 && hit(px, py, SPOT_R[k] * sc); t++) { sc *= 0.75; py = y + 0.5 - t * 0.08; }
          }
          if (k === 'herd') {
            // 鹿是活的：记下“家”的位置，每帧在附近游走
            const key = i * 4 + it[6];
            let d = this.deerMap.get(key);
            if (!d) d = { x: px, y: py, ang: it[5], hp: 0.8, st: 'graze', t: Math.random() * 5, ph: 0 };
            d.hx = px; d.hy = py; d.s = sc; d.key = key;
            newDeer.push(d);
            continue;
          }
          (this.liveSpots.get(i) || this.liveSpots.set(i, []).get(i)).push([px, py, SPOT_R[k] * sc]);
          this._e.set(0, it[5], 0);
          this._m.compose(this._v.set(px, 0, -py), this._q.setFromEuler(this._e), this._s.set(sc, sc, sc));
          im.setMatrixAt(n++, this._m);
        }
      }
      if (k === 'herd') continue;
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }
    this.deer = newDeer;
    this.deerMap = new Map(newDeer.map(d => [d.key, d]));
    for (const k in rem) { const im = this.remnants[k]; im.count = rem[k]; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    this.decorKey = '';
  }
  // 某点附近是否有资源点模型或大石头（半径 r）
  blocked(x, y, r) {
    const tx = Math.floor(x), ty = Math.floor(y);
    const bo = Sim.rt(this.S).beltOcc; if (bo && bo.has(ty * W + tx)) return true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = tx + dx, yy = ty + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const i = yy * W + xx;
      const L = this.liveSpots && this.liveSpots.get(i);
      if (L) for (const it of L) if (Math.hypot(x - it[0], y - it[1]) < r + it[2]) return true;
      const B = this.spotBuckets.get(i);
      if (B) for (const it of B) if (it[3] === 'boulder' && this.S.reveal[i] === 1 && Math.hypot(x - it[0], y - it[1]) < r + it[2]) return true;
    }
    return false;
  }

  // 老存档里可能有建筑压着地标模型：按最近一栋建筑的距离把模型缩一点，不穿模
  fitLandmarks() {
    for (const g of this.lmGroups || []) {
      const i = g.userData.lm, l = LANDMARKS[i], cx = l.x + 0.5, cy = l.row + 0.5;
      let d = 99;
      for (const b of this.S.buildings) {
        if (Math.abs(b.y - cy) > 12) continue;
        const s = BLD[b.type].size, nx = Math.max(b.x, Math.min(cx, b.x + s)), ny = Math.max(b.y, Math.min(cy, b.y + s));
        d = Math.min(d, Math.hypot(nx - cx, ny - cy));
      }
      g.scale.setScalar(Math.max(0.4, Math.min(1, (d - 0.1) / LM_R[i])));
    }
  }
  refreshLandmarks() {
    for (const g of this.lmGroups) { const l = LANDMARKS[g.userData.lm]; g.visible = this.S.reveal[idx(l.x, l.row)] === 1; }
    for (const g of this.farGroups || []) { const p = g.userData.far; g.visible = this.S.reveal[idx(p.x, p.y)] === 1; }
  }
  // 永恒之炉以北的远方地标：揭开迷雾才显示
  buildFar() {
    this.farGroups = [];
    (this.world.far || []).forEach((p, i) => {
      const { geo, glow } = M.farGeo(i), g = new THREE.Group();
      g.position.set(p.x + 0.5, 0, -(p.y + 0.5));
      g.rotation.y = (hash3(i, 17, 3) - 0.5) * 0.8;
      const m = new THREE.Mesh(geo, this.matStd); m.castShadow = true; m.receiveShadow = true; g.add(m);
      if (glow) g.add(new THREE.Mesh(glow, this.matGlow));
      g.userData.far = p; g.userData.fi = i; g.visible = false;
      this.farGroups.push(g); this.root.add(g);
    });
  }
  buildLandmarks() {
    this.eternalFlame = null;
    this.lmGroups = [];
    LANDMARKS.forEach((l, i) => {
      if (i === 0) return;
      const { geo, glow } = M.landmarkGeo(i);
      const g = new THREE.Group();
      g.position.set(l.x + 0.5, 0, -(l.row + 0.5));
      if (geo) { const m = new THREE.Mesh(geo, this.matStd); m.castShadow = true; m.receiveShadow = true; g.add(m); }
      if (glow) g.add(new THREE.Mesh(glow, this.matGlow));
      if (i === 6) { const f = new THREE.Mesh(M.eternalFlameGeo(), this.matGlow); f.visible = false; g.add(f); this.eternalFlame = f; }
      g.userData.lm = i;
      this.lmGroups.push(g);
      this.root.add(g);
    });
  }

  // 雾里的地点：揭开迷雾后才显示，探索过的插一面旗
  buildSites() {
    if (!this.siteGeos) { this.siteGeos = {}; this.flagGeo = M.siteFlagGeo(); }
    this.siteGroups = [];
    for (const p of this.world.sites || []) {
      const G0 = this.siteGeos[p.kind] || (this.siteGeos[p.kind] = M.siteGeo(p.kind));
      const g = new THREE.Group();
      g.position.set(p.x + 0.5, 0, -(p.y + 0.5));
      g.rotation.y = (hash3(p.id, 5, 9) - 0.5) * 0.7;
      const m = new THREE.Mesh(G0.geo, this.matStd); m.castShadow = true; m.receiveShadow = true; g.add(m);
      if (G0.glow) g.add(new THREE.Mesh(G0.glow, this.matGlow));
      const f = new THREE.Mesh(this.flagGeo, this.matStd); f.position.set(-1.1, 0, -1.0); f.castShadow = true; f.visible = false; g.add(f);
      g.userData.site = p; g.userData.flag = f;
      g.visible = false;
      this.siteGroups.push(g); this.root.add(g);
    }
    this.refreshSites();
  }
  refreshSites() {
    const S = this.S;
    for (const g of this.siteGroups || []) {
      const p = g.userData.site;
      g.visible = S.reveal[idx(p.x, p.y)] === 1;
      g.userData.flag.visible = !!(S.siteDone && S.siteDone[p.id]);
    }
    // 掠夺者营地：揭开迷雾才显示；散伙后火灭了、黑旗也拔了
    if (!this.gangGroups) {
      this.gangGroups = [];
      const G0 = M.gangGeo();
      for (const gg of this.world.gangs || []) {
        const g = new THREE.Group();
        g.position.set(gg.x + 0.5, 0, -(gg.y + 0.5));
        g.rotation.y = (hash3(gg.id, 7, 9) - 0.5) * 0.5;
        const m = new THREE.Mesh(G0.geo, this.matStd); m.castShadow = true; m.receiveShadow = true; g.add(m);
        const fire = new THREE.Mesh(G0.glow, this.matGlow), flag = new THREE.Mesh(G0.flag, this.matStd); flag.castShadow = true;
        g.add(fire); g.add(flag);
        g.userData.gang = gg; g.userData.fire = fire; g.userData.flagM = flag;
        g.visible = false;
        this.gangGroups.push(g); this.root.add(g);
      }
    }
    for (const g of this.gangGroups) {
      const gg = g.userData.gang, st = (S.gangs || {})[gg.id];
      g.visible = S.reveal[idx(gg.x, gg.y)] === 1;
      g.userData.fire.visible = g.userData.flagM.visible = !(st && st.gone);
    }
  }

  buildFog() {
    this.fogBig = document.createElement('canvas'); this.fogBig.width = W * 4; this.fogBig.height = H * 4;
    this.fogTex = new THREE.CanvasTexture(this.fogBig);
    this.fogTex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, H + 8), new THREE.MeshBasicMaterial({ map: this.fogTex, transparent: true, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(W / 2, 1.35, -H / 2);
    m.renderOrder = 5;
    this.fogMesh = m;
    this.root.add(m);
    this.refreshFog();
  }
  refreshFog() {
    const S = this.S;
    const big = this.fogBig.getContext('2d');
    big.clearRect(0, 0, this.fogBig.width, this.fogBig.height);
    if (!this.cloud) {
      // 一次性画好云雾的明暗纹理
      const cw = this.fogBig.width, ch = this.fogBig.height;
      this.cloud = document.createElement('canvas'); this.cloud.width = cw; this.cloud.height = ch;
      const cc = this.cloud.getContext('2d'); const id = cc.createImageData(cw, ch);
      const nz = (x, y, s, sd) => { const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; const a = hash3(x0, y0, sd), b = hash3(x0 + 1, y0, sd), c = hash3(x0, y0 + 1, sd), d = hash3(x0 + 1, y0 + 1, sd); const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const n = nz(x, y, 22, 1) * 0.6 + nz(x, y, 9, 2) * 0.3 + nz(x, y, 4, 3) * 0.1;
        const o = (y * cw + x) * 4, v = 112 + n * 46; // 冷灰蓝的冻雾，和揭开的雪地拉开明暗
        id.data[o] = v; id.data[o + 1] = v + 12; id.data[o + 2] = Math.min(255, v + 30); id.data[o + 3] = 255;
      }
      cc.putImageData(id, 0, 0);
    }
    big.drawImage(this.cloud, 0, 0);
    big.globalCompositeOperation = 'destination-out';
    // 把揭开的区域“挖”掉，再用模糊做出柔和的雾边
    const mask = this.fogMask || (this.fogMask = document.createElement('canvas')); mask.width = W; mask.height = H;
    const mctx = mask.getContext('2d'); const mi = mctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = ((H - 1 - y) * W + x) * 4; mi.data[o + 3] = S.reveal[idx(x, y)] ? 255 : 0; }
    mctx.putImageData(mi, 0, 0);
    big.filter = 'blur(5px)';
    big.imageSmoothingEnabled = true;
    // 平面比地图大 8 格：四周各留 4 格
    const sx = this.fogBig.width / (W + 8), sy = this.fogBig.height / (H + 8);
    big.drawImage(mask, 4 * sx, 4 * sy, W * sx, H * sy);
    // 地图边缘的揭示状态向外延伸到雾面的边框
    big.drawImage(mask, 0, 0, 1, H, 0, 4 * sy, 4 * sx, H * sy);
    big.drawImage(mask, W - 1, 0, 1, H, (W + 4) * sx, 4 * sy, 4 * sx, H * sy);
    big.drawImage(mask, 0, 0, W, 1, 4 * sx, 0, W * sx, 4 * sy);
    big.drawImage(mask, 0, H - 1, W, 1, 4 * sx, (H + 4) * sy, W * sx, 4 * sy);
    big.filter = 'none';
    // 雾面四周渐隐，融进两侧的山里，不留直边
    const fw = 4 * sx, fh = 4 * sy, cw = this.fogBig.width, chh = this.fogBig.height;
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, fw, 0, 0, 0, fw, chh], [cw, 0, cw - fw, 0, cw - fw, 0, fw, chh], [0, 0, 0, fh, 0, 0, cw, fh], [0, chh, 0, chh - fh, 0, chh - fh, cw, fh]]) {
      const gr = big.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      big.fillStyle = gr; big.fillRect(rx, ry, rw, rh);
    }
    big.globalCompositeOperation = 'source-over';
    this.fogTex.needsUpdate = true;
  }

  // ---------- 建筑 ----------
  // 同类型同外观的建筑共用一份几何体
  gkey(type, lvl) { return type === 'furnace' ? `f:${lvl}` : `${type}:${M.visTier(type, lvl)}:${type === 'tent' && lvl >= 3 ? 1 : 0}:${Math.min(20, lvl)}`; }
  bgeo(type, lvl, deep = false) {
    this.geoCache ||= new Map();
    const key = this.gkey(type, lvl) + (deep ? ':deep' : '');
    let g = this.geoCache.get(key);
    if (!g) { g = M.buildingGeo(type, lvl, deep); this.geoCache.set(key, g); }
    return g;
  }
  // 建造队列：等材料的建筑画成半透明的蓝图
  // 袭击前点的火墙：营地供热圈外一圈火把，袭击过后再烧一会儿
  // 营地专精：熔炉台子的东南角立一根高旗杆，旗上写着「矿 / 垦 / 工 / 塞」，迎风飘
  flagTex(k) {
    this.flagTexs ||= {};
    if (this.flagTexs[k]) return this.flagTexs[k];
    const F = FOCUS[k], c = document.createElement('canvas'); c.width = 128; c.height = 80;
    const x = c.getContext('2d');
    x.fillStyle = F.col; x.fillRect(0, 0, 128, 80);
    x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, 0, 128, 7); x.fillRect(0, 73, 128, 7);
    x.strokeStyle = 'rgba(255,236,200,.55)'; x.lineWidth = 3; x.strokeRect(10, 12, 108, 56);
    x.fillStyle = '#fff6e6'; x.font = 'bold 46px "Songti SC","Noto Serif SC","STSong",serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(F.ch, 64, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (this.flagTexs[k] = t);
  }
  syncFocus() {
    const S = this.S;
    let sig = ''; for (const c of S.camps) if (c.focus) sig += c.id + c.focus + ':' + Sim.getB(S, c.furnace).lvl + ';';
    if (sig !== this.focusSig) {
      this.focusSig = sig;
      for (const f of this.flags || []) { this.scene.remove(f.g); f.geo.dispose(); f.mat.dispose(); }
      this.flags = [];
      this.flagPoleGeo ||= new THREE.CylinderGeometry(0.04, 0.055, 1, 6);
      this.flagKnobGeo ||= new THREE.SphereGeometry(0.07, 8, 6);
      this.flagPoleMat ||= new THREE.MeshLambertMaterial({ color: '#4a3a2c' });
      this.flagKnobMat ||= new THREE.MeshLambertMaterial({ color: '#d8b060' });
      for (const c of S.camps) {
        if (!c.focus) continue;
        const b = Sim.getB(S, c.furnace), lvl = b.lvl;
        const top = 0.32 + 1.15 + 0.075 * Math.min(lvl, 25), ph = top + 1.1; // 旗杆比炉口高一截
        const g = new THREE.Group();
        const pole = new THREE.Mesh(this.flagPoleGeo, this.flagPoleMat); pole.scale.y = ph; pole.position.y = ph / 2; pole.castShadow = true; g.add(pole);
        const knob = new THREE.Mesh(this.flagKnobGeo, this.flagKnobMat); knob.position.y = ph + 0.04; g.add(knob);
        const geo = new THREE.PlaneGeometry(0.95, 0.6, 10, 2); geo.translate(0.475, 0, 0);
        const tex = this.flagTex(c.focus);
        const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.3, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(geo, mat); flag.position.y = ph - 0.36; flag.castShadow = true; g.add(flag);
        // 立在熔炉占地的东南角（门在正南，不挡门也不挡炉火），旗面往外飘
        g.position.set(b.x + 1.5 + 1.3, 0, -(b.y + 1.5) + 1.3);
        g.rotation.y = -0.5;
        this.scene.add(g);
        this.flags.push({ g, geo, mat, base: Float32Array.from(geo.attributes.position.array), ph: hash3(c.id, 9, 9) * 6 });
      }
    }
    // 飘动：离旗杆越远摆得越大
    const t = this.time;
    for (const f of this.flags || []) {
      const P = f.geo.attributes.position, a = P.array, B = f.base;
      for (let i = 0; i < a.length; i += 3) { const x = B[i], k = x / 0.95; a[i + 2] = Math.sin(t * 3.2 + f.ph - x * 5.5) * 0.09 * k; a[i + 1] = B[i + 1] - k * k * 0.05; }
      P.needsUpdate = true; f.geo.computeVertexNormals();
    }
  }
  syncFireWall(dt) {
    const S = this.S, p = S.rprep, camp = p && Sim.getCamp(S, p.camp);
    const show = !!(camp && p.fire && ((S.raidDone ?? -1) < p.k || S.t - p.t < 120));
    const R = show ? Sim.heatRadius(S, camp) + 0.7 : 0, sig = show ? `${p.k}:${camp.id}:${R}:${S.car ? S.car.k : ''}` : '';
    if (sig !== this.fwSig) {
      this.fwSig = sig;
      if (this.fwG) { this.scene.remove(this.fwG); this.fwG = null; this.fwF = null; }
      if (show) {
        const w = getWorld(S.runSeed), pts = [], n = Math.max(12, Math.round(Math.PI * 2 * R / 1.3));
        for (let i = 0; i < n; i++) {
          const a = i / n * Math.PI * 2, x = camp.x + Math.cos(a) * R, y = camp.y + Math.sin(a) * R, tx = Math.floor(x), ty = Math.floor(y);
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          const ti = idx(tx, ty);
          // 不插在岩石、资源点、建筑、商队和遗迹上
          if (w.terrain[ti] === T_ROCK || (w.spot[ti] >= 0 && Sim.spotLeft(S, ti) > 0) || Sim.occAt(S, tx, ty) || Sim.landmarkBlock(tx, ty, S)) continue;
          if (S.car && x > S.car.x - 0.4 && x < S.car.x + 3.4 && y > S.car.y - 0.4 && y < S.car.y + 3.4) continue;
          pts.push([x, y]);
        }
        const g = new THREE.Group(), post = this.torchPost ||= M.torchPostGeo(), fl = this.torchFlame ||= M.torchFlameGeo();
        const posts = new THREE.InstancedMesh(post, this.matStd, pts.length), flames = new THREE.InstancedMesh(fl, this.matGlow, pts.length);
        posts.castShadow = true;
        const m = new THREE.Matrix4();
        pts.forEach(([x, y], i) => { m.makeTranslation(x, 0, -y); posts.setMatrixAt(i, m); flames.setMatrixAt(i, m); });
        // 火光：每支火把一团光晕，地上再铺一圈暖光，拉远了也看得出是一道火墙
        this.fwHaloMat ||= new THREE.PointsMaterial({ size: 2.6, map: this.softTex, color: '#ff6a10', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
        const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, y]) => [x, 1.05, -y]), 3));
        const halo = new THREE.Points(hg, this.fwHaloMat);
        this.fwRingMat ||= new THREE.MeshBasicMaterial({ color: '#ff7a22', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
        const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.55, R + 0.55, 128), this.fwRingMat); ring.rotation.x = -Math.PI / 2; ring.position.set(camp.x, 0.08, -camp.y);
        g.add(posts, flames, halo, ring); this.scene.add(g);
        this.fwG = g; this.fwF = flames; this.fwPts = pts; this.fwK = 0;
        for (let i = 0; i < pts.length; i += 4) this.burst('spark', pts[i][0], pts[i][1], 3, 0.2, 0.9);
      }
    }
    if (this.fwF) {
      // 火苗各自跳动；袭击过后慢慢烧尽
      const left = (S.raidDone ?? -1) >= p.k ? Math.max(0, 1 - (S.t - p.t) / 120) : 1;
      this.fwK += (left - this.fwK) * Math.min(1, dt * 3);
      const m = this._fwM ||= new THREE.Matrix4(), q = this._fwQ ||= new THREE.Quaternion(), sc = this._fwS ||= new THREE.Vector3(), ps = this._fwP ||= new THREE.Vector3();
      this.fwPts.forEach(([x, y], i) => {
        const t = this.time * 7 + i * 1.7, k = this.fwK * (0.85 + Math.sin(t) * 0.12 + Math.sin(t * 2.3) * 0.06);
        ps.set(x, 0.86, -y); sc.set(k, k * (1 + Math.sin(t * 1.3) * 0.15), k); m.compose(ps, q, sc); this.fwF.setMatrixAt(i, m);
      });
      this.fwF.instanceMatrix.needsUpdate = true;
      this.fwHaloMat.opacity = (0.75 + Math.sin(this.time * 5) * 0.12) * this.fwK; this.fwRingMat.opacity = (0.2 + Math.sin(this.time * 3.3) * 0.04) * this.fwK;
      if (this.fwK > 0.3 && Math.random() < dt * 4) { const pt = this.fwPts[Math.floor(Math.random() * this.fwPts.length)]; if (pt) this.burst('spark', pt[0], pt[1], 1, 0.1, 1); }
    }
  }
  syncCaravan(dt) {
    const c = this.S.car, sig = c ? `${c.k}:${c.x}:${c.y}` : '';
    if (sig !== this.carSig) {
      this.carSig = sig;
      if (this.carG) { this.scene.remove(this.carG); this.burst('dust', this.carG.position.x, -this.carG.position.z, 18, 1.2); this.carG = null; }
      if (c) {
        const m = new THREE.Mesh(this.carGeo ||= M.caravanGeo(), this.matStd); m.castShadow = true; m.receiveShadow = true;
        m.position.set(c.x + 1.5, 0, -(c.y + 1.5));
        this.scene.add(m); this.carG = m;
        this.burst('dust', c.x + 1.5, c.y + 1.5, 24, 1.4);
      }
    }
    // 篝火冒点火星
    if (this.carG && Math.random() < dt * 3) this.burst('spark', this.carG.position.x + 0.05, -this.carG.position.z - 0.12, 1, 0.05, 0.3);
  }
  // 在线小惊喜：走失的驯鹿在营地边上慢慢转悠；流星坑冒着烟、裂缝发光；流星落下来时有一道光
  syncSurprise(dt) {
    const S = this.S, sur = S.sur;
    const key = sur ? sur.id + ':' + sur.kind : '';
    if (key !== this.surKey) {
      this.surKey = key;
      if (this.surObj) { this.scene.remove(this.surObj); this.surObj = null; }
      if (sur) {
        const g = new THREE.Group();
        if (sur.kind === 'deer') {
          const dg = this.deerGeoC || (this.deerGeoC = M.deerGeo());
          const body = new THREE.Mesh(dg.body, this.matStd), head = new THREE.Mesh(dg.head, this.matStd), bell = new THREE.Mesh(this.bellGeo || (this.bellGeo = M.deerBellGeo()), this.matStd);
          head.position.set(...M.DEER_NECK); body.castShadow = head.castShadow = true;
          g.add(body, head, bell); g.userData.head = head;
          g.scale.setScalar(1.3);
        } else {
          const mg = this.meteorGeoC || (this.meteorGeoC = M.meteorGeo(S.known >= 6 ? '#c080ff' : '#ff8a30'));
          const m = new THREE.Mesh(mg.geo, this.matStd); m.receiveShadow = true; m.castShadow = true;
          g.add(m, new THREE.Mesh(mg.glow, this.matGlow));
          g.rotation.y = hash3(sur.id, 3, 3) * 6.28;
        }
        g.position.set(sur.x + 0.5, 0, -(sur.y + 0.5));
        this.scene.add(g); this.surObj = g; this.surT = 0;
      }
    }
    if (this.surObj && sur) {
      this.surT += dt;
      if (sur.kind === 'deer') {
        // 绕着落脚点慢慢走，时不时低头
        const a = this.surT * 0.35, r = 0.45, x = sur.x + 0.5 + Math.cos(a) * r, y = sur.y + 0.5 + Math.sin(a) * r;
        this.surObj.position.set(x, 0, -y);
        this.surObj.rotation.y = -a;
        this.surObj.userData.head.rotation.x = Math.max(0, Math.sin(this.surT * 0.8)) * 0.9;
      } else {
        this.surObj.visible = !this.meteorFx;
        if (!this.meteorFx && Math.random() < dt * 2.5) this.burst('dust', sur.x + 0.5, sur.y + 0.5, 1, 0.25, 0.6);
      }
    }
    // 流星划过
    const mf = this.meteorFx;
    if (mf) {
      mf.t += dt;
      const k = Math.min(1, mf.t / 1.1);
      if (!mf.obj) { mf.obj = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd8a0', toneMapped: false })); mf.obj.scale.set(1, 1, 5); this.scene.add(mf.obj); }
      const x = mf.x + 0.5 + (1 - k) * 10, y = mf.y + 0.5 - (1 - k) * 6, h = (1 - k) * 16;
      mf.obj.position.set(x, h, -y); mf.obj.lookAt(mf.x + 0.5, 0, -(mf.y + 0.5));
      if (Math.random() < 0.8) this.burst('spark', x, y, 2, 0.15, h);
      if (k >= 1) { this.scene.remove(mf.obj); mf.obj.geometry.dispose(); this.burst('dust', mf.x + 0.5, mf.y + 0.5, 40, 1.0, 1.4); this.burst('spark', mf.x + 0.5, mf.y + 0.5, 30, 0.6, 0.5); this.ringFx && this.ringFx(mf.x + 0.5, mf.y + 0.5, 1.8); this.meteorFx = null; }
    }
  }
  // 营地生活：等床位的窝棚、孩子们的雪人、夜里巡逻的路线。位置按营地缓存，建筑变了再找
  lifeSpots(c) {
    // 砍树挖矿会不停地刷新资源点：那种小变化 30 秒才重找一次（重找要寻路，手机上会顿一下，东西也不该跳来跳去）
    const C = this._life || (this._life = new Map()), key = this.bldSig + ':' + (this.beltSig || '').length + ':' + Sim.heatRadius(this.S, c) + ':' + (this.spotBig || 0);
    const hit = C.get(c.id), now = performance.now();
    if (hit && hit.key === key && (hit.gen === this.spotGen || now - hit.at < 30000)) return hit;
    const S = this.S, w = getWorld(S.runSeed), rects = this.bldRects(), Q = S.queue || [];
    for (const q of Q) { const s = BLD[q.type].size; rects.push([q.x - 0.02, q.y - 0.65, q.x + s + 0.02, q.y + s + 0.02]); }
    const free = (x, y, r) => {
      if (x < r + 0.3 || y < r + 0.3 || x > W - r - 0.3) return false;
      for (const q of rects) { const nx = Math.max(q[0], Math.min(x, q[2])), ny = Math.max(q[1], Math.min(y, q[3])); if (Math.hypot(x - nx, y - ny) < r) return false; }
      for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) { const tx = Math.floor(x + dx), ty = Math.floor(y + dy), i = idx(tx, ty); if (w.terrain[i] !== T_SNOW || S.reveal[i] !== 1 || Sim.landmarkBlock(tx, ty, S) || Sim.siteAt(S, tx, ty, 0)) return false; }
      if (this.blocked(x, y, r * 0.8)) return false;
      if (Sim.caravanAt(S, Math.floor(x), Math.floor(y))) return false;
      return true;
    };
    // 窝棚、雪人、庆典场子之间也互相让开
    const taken = [];
    const ring = (r0, r1, rad, salt, strict) => {
      for (let k = 0; k < 160; k++) {
        const a = k * 2.39996 + c.id * 1.3 + salt, r = r0 + (r1 - r0) * ((k * 0.618) % 1);
        const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
        if (taken.some(t => Math.hypot(t[0] - x, t[1] - y) < t[2] + rad + 0.3)) continue;
        if (strict && this.blocked(x, y, rad + 0.15)) continue;
        if (free(x, y, rad)) { taken.push([x, y, rad]); return [x, y, a]; }
      }
      return null;
    };
    const R0 = Sim.heatRadius(S, c);
    const shanty = ring(4, Math.max(4.6, Math.min(9, R0 - 0.9)), 1.05, 0.4) || ring(4, R0 - 0.5, 1.0, 0.4) || ring(R0 - 1, R0 + 2.5, 1.0, 0.4);
    const play = ring(3.4, Math.max(4.2, Math.min(7, R0 - 1)), 0.85, 2.1) || ring(3.4, Math.min(12, R0 + 1.2), 0.72, 2.1) || ring(R0, R0 + 3, 0.72, 2.6);
    // 篝火庆典的场子：一块空着的圆地，先找大的，找不到就小一点
    let fest = null;
    for (const [rad, r0, r1] of [[2.3, 3.5, Math.max(5, R0 - 1)], [2.3, 3.5, R0 + 2.5], [1.9, 3.2, R0 + 3], [1.6, 3, R0 + 4]]) { const f = ring(r0, r1, rad, 4.2, true); if (f) { fest = [f[0], f[1], f[2], rad]; break; } }
    // 巡逻路线：在供热圈边上取十来个空地当路标，路标之间按寻路走（绕开建筑和传送带），连成一圈
    const Rp = Math.min(R0, 10), wps = [];
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2 + c.id * 0.37;
      for (let r = Rp; r >= 3.2; r -= 0.4) { const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (free(x, y, 0.25)) { wps.push([x, y]); break; } }
    }
    let patrol = null;
    if (wps.length >= 4) {
      const occ = new Set(), bo = Sim.rt(S).beltOcc;
      for (const b of S.buildings) { const s = BLD[b.type].size; for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) occ.add(y * W + x); }
      const blockedTile = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 12; const i = y * W + x; if (occ.has(i) || (bo && bo.has(i))) return 12; if (w.terrain[i] !== T_SNOW || S.reveal[i] !== 1) return 6; return 0; };
      const pts = [];
      for (let k = 0; k < wps.length; k++) {
        const p0 = wps[k], p1 = wps[(k + 1) % wps.length];
        const seg = this.route(p0[0], p0[1], p1[0], p1[1], blockedTile) || [p0, p1];
        for (let j = pts.length ? 1 : 0; j < seg.length; j++) pts.push(seg[j]);
      }
      const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
      patrol = { pts, cum, len: cum[cum.length - 1] };
    }
    const v = { key, gen: this.spotGen, at: now, shanty, play, patrol, fest };
    C.set(c.id, v);
    return v;
  }
  syncLife() {
    const S = this.S;
    const fsig = S.camps.filter(c => c.fest).map(c => c.id).join(',');
    if (fsig !== this.festSig) { this.festSig = fsig; this.refreshPools(); this.decorKey = ''; }
    if (!this.lifeGroup) {
      this.lifeGroup = new THREE.Group(); this.scene.add(this.lifeGroup);
      const sh = M.shantyGeo();
      this.lifeGeo = { shanty: sh.geo, shantyGlow: sh.glow, snowman: M.snowmanGeo() };
      this.lifeObj = new Map();
    }
    const cx = this.cam.tx, cy = this.cam.ty, near = 40 + this.cam.dist, seen = new Set();
    for (const c of S.camps) {
      if (Math.abs(c.x - cx) > near || Math.abs(c.y - cy) > near) continue;
      const L = this.lifeSpots(c);
      const want = [['shanty', (c.wait || 0) > 0 && L.shanty], ['snowman', c.people >= 30 && L.play], ['fest', c.fest && L.fest]];
      for (const [k, at] of want) {
        if (!at) continue;
        const id = k + c.id; seen.add(id);
        let o = this.lifeObj.get(id);
        if (k === 'fest' && o && o.userData.R !== at[3]) { this.lifeGroup.remove(o); this.lifeObj.delete(id); o = null; }
        if (!o) {
          o = new THREE.Group();
          if (k === 'fest') {
            const G2 = (this.festGeoC ||= new Map()), fg = G2.get(at[3]) || (G2.set(at[3], M.festGeo(at[3])), G2.get(at[3]));
            const m = new THREE.Mesh(fg.geo, this.matStd); m.castShadow = true; m.receiveShadow = true;
            const fl = new THREE.Mesh(fg.flame, this.matGlow);
            o.add(m, new THREE.Mesh(fg.glow, this.matGlow), fl); o.userData = { R: at[3], flame: fl };
            this.burst('spark', at[0], at[1], 40, 0.5, 0.6);
          } else {
            const m = new THREE.Mesh(this.lifeGeo[k], this.matStd); m.castShadow = true; m.receiveShadow = true; o.add(m);
            if (k === 'shanty') o.add(new THREE.Mesh(this.lifeGeo.shantyGlow, this.matWin));
          }
          this.lifeGroup.add(o); this.lifeObj.set(id, o);
          if (k === 'shanty') this.burst('dust', at[0], at[1], 14, 0.6);
        }
        if (k === 'fest') {
          o.position.set(at[0], 0.02, -at[1]); o.rotation.y = 0;
          const t = this.time, fl = o.userData.flame;
          fl.scale.set(1 + 0.08 * Math.sin(t * 11), 1 + 0.18 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 17), 1 + 0.08 * Math.cos(t * 9));
          if (Math.random() < 0.35) this.burst('spark', at[0], at[1], 1, 0.15, 0.9);
          continue;
        }
        // 窝棚背对营地中心，火堆朝里
        const [x, y, a] = at, off = k === 'snowman' ? 0.45 : 0;
        o.position.set(x + Math.cos(a) * off, 0.02, -(y + Math.sin(a) * off));
        o.rotation.y = Math.atan2(-Math.cos(a), Math.sin(a));
      }
    }
    for (const [id, o] of this.lifeObj) if (!seen.has(id)) { this.lifeGroup.remove(o); this.lifeObj.delete(id); }
  }
  // 传送带 / 蒸汽轨道：架在两栋建筑之间，小箱子顺着走；轨道上是一辆来回跑的小蒸汽车
  syncBelts(dt) {
    const S = this.S, E = S.belts || [];
    const sig = E.map(e => e.id + ':' + e.lvl + ':' + e.a + ':' + e.b).join(',') + '|' + this.bldSig;
    if (sig !== this.beltSig) {
      this.beltSig = sig;
      if (!this.beltGroup) { this.beltGroup = new THREE.Group(); this.scene.add(this.beltGroup); this.beltGeoC = new Map(); }
      for (const g of [...this.beltGroup.children]) this.beltGroup.remove(g);
      this.beltList = [];
      for (const e of E) {
        const a = Sim.getB(S, e.a), b = Sim.getB(S, e.b);
        if (!a || !b) continue;
        const en = Sim.beltEnds(a, b), L = Math.max(0.35, en.len);
        const gk = Math.round(L * 20) + ':' + e.lvl;
        let geo = this.beltGeoC.get(gk);
        if (!geo) { geo = M.beltGeo(L, e.lvl); this.beltGeoC.set(gk, geo); }
        const g = new THREE.Group();
        const m = new THREE.Mesh(geo, this.matStd); m.castShadow = true; m.receiveShadow = true; g.add(m);
        const ck = 'c' + e.lvl + e.k;
        let cg = this.beltGeoC.get(ck);
        if (!cg) { cg = e.lvl >= 2 ? M.cartGeo(RES[e.k].c) : M.beltCrateGeo(RES[e.k].c); this.beltGeoC.set(ck, cg); }
        const items = [], n = e.lvl >= 2 ? 1 : Math.max(1, Math.round(L / 0.45));
        for (let i = 0; i < n; i++) { const c = new THREE.Mesh(cg, this.matStd); c.castShadow = true; c.position.y = M.BELT_H + (e.lvl >= 2 ? 0.09 : 0.05); g.add(c); items.push(c); }
        // 世界坐标：x = 格子 x，z = -格子 y
        const x0 = en.p0[0], z0 = -en.p0[1], dx = en.p1[0] - en.p0[0], dz = -(en.p1[1] - en.p0[1]);
        g.position.set(x0 - (L - en.len) / 2 * (dx / (Math.hypot(dx, dz) || 1)), 0, z0 - (L - en.len) / 2 * (dz / (Math.hypot(dx, dz) || 1)));
        g.rotation.y = -Math.atan2(dz, dx);
        this.beltGroup.add(g);
        this.beltList.push({ e, L, items, ph: hash3(e.id, 5, 5) * 10 });
      }
      this.decorKey = '';
    }
    if (!this.beltList) return;
    const R = Sim.rt(S);
    for (const it of this.beltList) {
      const br = R.b[it.e.a] || {}, run = (br.act || 0) > 0.05 ? 1 : 0;
      it.ph += dt * run * (it.e.lvl >= 2 ? 0.9 : 0.5);
      if (it.e.lvl >= 2) { const c = it.items[0]; c.position.x = (it.L - 0.3) * (0.5 - 0.5 * Math.cos(it.ph)) + 0.15; c.rotation.y = Math.sin(it.ph) >= 0 ? 0 : Math.PI; }
      else it.items.forEach((c, i) => { const u = ((it.ph * 0.9 / it.L) + i / it.items.length) % 1; c.position.x = u * it.L; c.visible = run > 0 || i % 2 === 0; });
    }
  }
  syncQueue() {
    const Q = this.S.queue || [];
    const sig = Q.map(q => q.id).join(',');
    if (sig === this.qSig) { if (this.qMat) { const k = Math.sin(this.time * 2.4); this.qMat.opacity = 0.42 + k * 0.1; this.qLineMat.opacity = 0.75 + k * 0.2; } return; }
    this.qSig = sig;
    if (!this.qGroup) {
      this.qGroup = new THREE.Group(); this.scene.add(this.qGroup);
      this.qMat = new THREE.MeshLambertMaterial({ color: '#5d9fe0', emissive: '#1d4f86', transparent: true, opacity: 0.45, depthWrite: false, flatShading: true });
      this.qLineMat = new THREE.LineBasicMaterial({ color: '#e4f2ff', transparent: true, opacity: 0.85, depthWrite: false });
      this.qPadMat = new THREE.MeshBasicMaterial({ color: '#4f8fd6', transparent: true, opacity: 0.3, depthWrite: false });
      this.qEdgeMat = new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.85, depthWrite: false });
      this.qEdges = {};
    }
    for (const g of [...this.qGroup.children]) this.qGroup.remove(g);
    for (const q of Q) {
      const s = BLD[q.type].size, g = new THREE.Group();
      const geo = this.bgeo(q.type, 1).geo;
      g.add(new THREE.Mesh(geo, this.qMat));
      // 蓝图线框：雪地上光靠半透明看不清，描一圈亮边
      if (!this.qEdges[q.type]) this.qEdges[q.type] = new THREE.EdgesGeometry(geo, 35);
      g.add(new THREE.LineSegments(this.qEdges[q.type], this.qLineMat));
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(s - 0.1, s - 0.1), this.qPadMat); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.1; g.add(pad);
      // 地块四边的虚线框
      const n = Math.max(3, Math.round(s * 2.5)), seg = (s - 0.1) / n;
      for (let i = 0; i < n; i++) for (let e = 0; e < 4; e++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(seg * 0.6, 0.07), this.qEdgeMat); d.rotation.x = -Math.PI / 2;
        const t = -s / 2 + 0.05 + seg * (i + 0.5), o = s / 2 - 0.08;
        if (e < 2) d.position.set(t, 0.11, e ? o : -o); else { d.rotation.z = Math.PI / 2; d.position.set(e === 2 ? o : -o, 0.11, t); }
        g.add(d);
      }
      g.position.set(q.x + s / 2, 0, -(q.y + s / 2));
      this.qGroup.add(g);
    }
  }
  syncBuildings(force) {
    const S = this.S;
    // 每帧都要比一次：用数字摘要，不拼长字符串（手机上少些垃圾回收）
    let sig = S.buildings.length, s2 = 7;
    for (const b of S.buildings) { sig = (sig * 31 + b.id * 131 + b.lvl * 7 + (b.deep ? 3 : 0)) | 0; s2 = (s2 * 17 + b.id + b.lvl * 1009) | 0; }
    sig = S.buildings.length + ':' + sig + ':' + s2;
    if (!force && sig === this.bldSig) return;
    this.bldSig = sig;
    this.fitLandmarks();
    const seen = new Set();
    for (const b of S.buildings) {
      seen.add(b.id);
      const vt = M.visTier(b.type, b.lvl);
      const key = b.type === 'furnace' ? `${b.lvl}` : `${vt}:${b.type === 'tent' && b.lvl >= 3 ? 1 : 0}:${Math.min(20, b.lvl)}${b.deep ? ':d' : ''}`;
      let e = this.buildings.get(b.id);
      if (e && e.key === key) continue;
      if (e) { this.bldGroup.remove(e.g); if (e.scaf) this.bldGroup.remove(e.scaf); }
      const { geo, glow, h, flame, flameY } = this.bgeo(b.type, b.lvl, !!b.deep);
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, this.matStd); m.castShadow = true; m.receiveShadow = true; g.add(m);
      if (glow) g.add(new THREE.Mesh(glow, this.matWin));
      let fl = null;
      if (flame) { fl = new THREE.Mesh(flame, this.matGlow); fl.position.y = flameY; g.add(fl); }
      const s = BLD[b.type].size;
      g.position.set(b.x + s / 2, 0, -(b.y + s / 2));
      g.userData.bid = b.id;
      this.bldGroup.add(g);
      const s0 = BLD[b.type].size, cx0 = b.x + s0 / 2, cy0 = b.y + s0 / 2;
      const ent = { g, key, h, fl, camp: b.camp, ph: hash3(b.id, 3, 3) * 6, lvl: b.lvl, deep: !!b.deep, cons: 0, up: 0 };
      if (!e && !force) {
        // 新建：先搭脚手架，房子从地里一层层长出来
        ent.cons = 1;
        this.scafGeo ||= {};
        const sk = s0 + ':' + (b.type === 'furnace' ? 3.2 : 1.7);
        const sg = this.scafGeo[sk] ||= M.scaffoldGeo(s0, b.type === 'furnace' ? 3.2 : 1.7);
        ent.scaf = new THREE.Mesh(sg, this.matStd); ent.scaf.castShadow = true; ent.scaf.position.copy(g.position);
        this.bldGroup.add(ent.scaf);
        g.scale.set(1, 0.02, 1);
        this.burst('dust', cx0, cy0, 26, s0 * 0.6);
      } else if (e && b.lvl > e.lvl) {
        // 升级：火星四溅 + 一圈光
        ent.up = 1;
        this.burst('spark', cx0, cy0, 40, s0 * 0.4, h * 0.6);
        this.ringFx(cx0, cy0, s0);
      } else if (e && b.deep && !e.deep) {
        // 挖成深井：尘土 + 一圈光
        ent.up = 1;
        this.burst('dust', cx0, cy0, 30, s0 * 0.5);
        this.ringFx(cx0, cy0, s0);
      }
      this.buildings.set(b.id, ent);
    }
    for (const [id, e] of this.buildings) if (!seen.has(id)) { this.bldGroup.remove(e.g); if (e.scaf) this.bldGroup.remove(e.scaf); this.buildings.delete(id); }
    this.buildPaths();
    this.refreshPools();
  }

  // 寻路：在格子上绕开建筑、岩石和还没采完的资源点，返回平滑后的折线
  route(ax, ay, bx, by, blockedTile) {
    const sx = Math.floor(ax), sy = Math.floor(ay), ex = Math.floor(bx), ey = Math.floor(by);
    const x0 = Math.max(0, Math.min(sx, ex) - 7), y0 = Math.max(0, Math.min(sy, ey) - 7), x1 = Math.min(W - 1, Math.max(sx, ex) + 7), y1 = Math.min(H - 1, Math.max(sy, ey) + 7);
    const gw = x1 - x0 + 1, gh = y1 - y0 + 1, N = gw * gh;
    // 每格的额外代价：空地 0，资源点/岩石 3，建筑 12（密集营地里实在没缝也能挤过去）
    const blk = new Uint8Array(N);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) blk[(y - y0) * gw + (x - x0)] = blockedTile(x, y);
    const si = (sy - y0) * gw + (sx - x0), ei = (ey - y0) * gw + (ex - x0);
    blk[si] = 0; blk[ei] = 0;
    const g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [], push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const hh = i => { const dx = Math.abs(i % gw - (ex - x0)), dy = Math.abs(Math.floor(i / gw) - (ey - y0)); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    g[si] = 0; push(hh(si), si);
    let found = false;
    while (heap.length) {
      const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
      if (i === ei) { found = true; break; }
      const cx = i % gw, cy = Math.floor(i / gw);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx; if (closed[j]) continue;
        if (dx && dy && (blk[cy * gw + nx] || blk[ny * gw + cx]) && !blk[j] && !blk[i]) continue; // 不从墙角斜穿
        const ng = g[i] + (dx && dy ? 1.414 : 1) * (1 + blk[j]);
        if (ng < g[j]) { g[j] = ng; from[j] = i; push(ng + hh(j), j); }
      }
    }
    if (!found) return null;
    const cells = []; for (let i = ei; i >= 0; i = from[i]) { cells.push([x0 + i % gw + 0.5, y0 + Math.floor(i / gw) + 0.5]); if (i === si) break; }
    cells.reverse();
    const pts = [[ax, ay], ...cells.slice(1, -1), [bx, by]];
    // 拉直：能直接看到的点就跳过中间的格子
    const clear = (p, q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(d / 0.2); for (let k = 1; k < n; k++) { const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n; for (const [ox, oy] of [[0, 0], [0.16, 0], [-0.16, 0], [0, 0.16], [0, -0.16]]) { const tx = Math.floor(x + ox), ty = Math.floor(y + oy); if ((tx !== sx || ty !== sy) && (tx !== ex || ty !== ey) && blockedTile(tx, ty)) return false; } } return true; };
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
    return out;
  }
  // 每个建筑到最近仓储点的路线；小路就沿着这些路线踩出来
  buildPaths() {
    const S = this.S;
    if (!this.pathGroup) return;
    for (const o of [...this.pathGroup.children]) { this.pathGroup.remove(o); o.geometry.dispose(); o.material.map && o.material.map.dispose(); o.material.dispose(); }
    this.routes = new Map();
    const w = this.world, occ = new Set();
    for (const b of S.buildings) { const s = BLD[b.type].size; for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) occ.add(y * W + x); }
    const blockedTile = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return 12; const i = y * W + x; if (occ.has(i)) return 12; if (w.terrain[i] === T_ROCK) return 3; if (w.spot[i] >= 0 && SPOT_KEYS[w.spot[i]] !== 'herd' && Sim.spotLeft(S, i) > 0) return 3; return 0; };
    for (const c of S.camps) {
      const st = [];
      for (const b of S.buildings) if (b.camp === c.id && (b.type === 'furnace' || b.type === 'warehouse')) { const s = BLD[b.type].size; st.push({ x: b.x + s / 2, y: b.y - 0.3, id: b.id }); }
      const lines = [];
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const b of S.buildings) {
        if (b.camp !== c.id || b.type === 'furnace') continue;
        const s = BLD[b.type].size, dx = b.x + s / 2, dy = b.y - 0.3;
        let best = null, bd = 1e9;
        for (const p of st) { if (p.id === b.id) continue; const d = Math.hypot(p.x - dx, p.y - dy); if (d < bd) { bd = d; best = p; } }
        if (!best || bd > 22) continue;
        const rr = this.route(best.x, best.y, dx, dy, blockedTile); if (!rr) this.routeFails = (this.routeFails || 0) + 1;
        const pts = rr || [[best.x, best.y], [dx, dy]];
        const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        this.routes.set(b.id, { pts, cum, len: cum[cum.length - 1], sid: best.id });
        lines.push(pts);
        for (const p of pts) { bx0 = Math.min(bx0, p[0]); by0 = Math.min(by0, p[1]); bx1 = Math.max(bx1, p[0]); by1 = Math.max(by1, p[1]); }
      }
      if (!lines.length) continue;
      // 画到一张贴图上：多条路线叠在一起的地方踩得更实
      bx0 -= 1.5; by0 -= 1.5; bx1 += 1.5; by1 += 1.5;
      const K = 16, cw = Math.ceil((bx1 - bx0) * K), ch = Math.ceil((by1 - by0) * K);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const g = cv.getContext('2d');
      const P = (x, y) => [(x - bx0) * K, (by1 - y) * K];
      g.lineCap = 'round'; g.lineJoin = 'round';
      const road = c.road || 0;
      const stroke = (wdt, col, blur = 0, dash = null) => {
        g.lineWidth = wdt * K; g.strokeStyle = col; g.filter = blur ? `blur(${blur}px)` : 'none'; g.setLineDash(dash || []);
        for (const pts of lines) { g.beginPath(); pts.forEach((p, k) => { const [x, y] = P(p[0], p[1]); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
        g.setLineDash([]);
      };
      // 路面：雪路 → 碎石路 → 石板路 → 暖石路（化开的雪水边）
      if (road === 0) { stroke(0.62, 'rgba(118,132,150,0.16)', 6); stroke(0.34, 'rgba(118,132,150,0.22)', 3); }
      else if (road === 1) { stroke(0.7, 'rgba(110,118,128,0.22)', 5); stroke(0.48, 'rgba(128,120,108,0.75)', 1.5); }
      else {
        if (road >= 3) stroke(0.95, 'rgba(120,128,136,0.2)', 7);
        stroke(0.66, 'rgba(70,66,64,0.42)', 2);
        stroke(0.54, road >= 3 ? 'rgba(196,184,166,0.95)' : 'rgba(170,172,176,0.92)', 0.6);
        stroke(0.54, road >= 3 ? 'rgba(130,116,100,0.55)' : 'rgba(104,106,112,0.5)', 0, [K * 0.03, K * 0.3]); // 石板缝
        stroke(0.05, road >= 3 ? 'rgba(140,124,106,0.45)' : 'rgba(118,120,126,0.4)', 0);
      }
      g.filter = 'none';
      // 碎石：撒一些小点
      if (road === 1) {
        for (const pts of lines) for (let k = 1; k < pts.length; k++) {
          const [x0, y0] = P(pts[k - 1][0], pts[k - 1][1]), [x1, y1] = P(pts[k][0], pts[k][1]);
          const d = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(d / (K * 0.08));
          for (let j = 0; j < n; j++) { const t = (j + 0.5) / n, h1 = hash3(k, j, 3), h2 = hash3(j, k, 5); g.fillStyle = h1 > 0.5 ? 'rgba(84,80,76,0.55)' : 'rgba(176,170,160,0.6)'; g.beginPath(); g.arc(x0 + (x1 - x0) * t + (h1 - 0.5) * K * 0.4, y0 + (y1 - y0) * t + (h2 - 0.5) * K * 0.4, K * (0.02 + h2 * 0.025), 0, 6.29); g.fill(); }
        }
      }
      // 零星的脚印
      g.fillStyle = road >= 2 ? 'rgba(0,0,0,0)' : 'rgba(96,108,124,0.28)';
      for (const pts of lines) for (let k = 1; k < pts.length && road < 2; k++) {
        const [x0, y0] = P(pts[k - 1][0], pts[k - 1][1]), [x1, y1] = P(pts[k][0], pts[k][1]);
        const d = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(d / (K * 0.3)), ux = (x1 - x0) / d, uy = (y1 - y0) / d;
        for (let j = 0; j < n; j++) { const side = j % 2 ? 1 : -1, t = (j + 0.5) / n; g.beginPath(); g.ellipse(x0 + (x1 - x0) * t - uy * side * K * 0.07, y0 + (y1 - y0) * t + ux * side * K * 0.07, K * 0.035, K * 0.055, Math.atan2(uy, ux) + Math.PI / 2, 0, 6.29); g.fill(); }
      }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      this.matPathBase ||= { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, by1 - by0), new THREE.MeshLambertMaterial({ map: tex, ...this.matPathBase }));
      m.rotation.x = -Math.PI / 2; m.position.set((bx0 + bx1) / 2, 0.075, -(by0 + by1) / 2); m.receiveShadow = true; m.renderOrder = 1;
      this.pathGroup.add(m);
      if (c.pipe) this.buildPipes(c, lines, occ);
    }
  }
  // 蒸汽管道：把小路经过的格子连成一张网（每条边只铺一次），管子贴着路边架在矮支柱上
  buildPipes(c, lines, occ) {
    const w = this.world, OX = 0.3, OY = 0.3;
    const free = (x, y) => { const tx = Math.floor(x), ty = Math.floor(y); return tx >= 0 && ty >= 0 && tx < W && ty < H && !occ.has(ty * W + tx) && w.terrain[ty * W + tx] !== T_ROCK && !(w.spot[ty * W + tx] >= 0 && SPOT_KEYS[w.spot[ty * W + tx]] !== 'herd' && Sim.spotLeft(this.S, ty * W + tx) > 0); };
    const edges = new Map(), nodes = new Map();
    for (const pts of lines) {
      let prev = -1;
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k], d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(d / 0.25));
        for (let j = 0; j <= n; j++) {
          const x = Math.floor(ax + (bx - ax) * j / n), y = Math.floor(ay + (by - ay) * j / n), t = y * W + x;
          if (t === prev) continue;
          if (prev >= 0) {
            const px = prev % W, py = Math.floor(prev / W);
            if (Math.abs(px - x) <= 1 && Math.abs(py - y) <= 1) {
              const a = Math.min(prev, t), b = Math.max(prev, t);
              const x0 = px + 0.5 + OX, y0 = py + 0.5 + OY, x1 = x + 0.5 + OX, y1 = y + 0.5 + OY;
              if (free(x0, y0) && free(x1, y1) && free((x0 + x1) / 2, (y0 + y1) / 2)) { edges.set(a + ',' + b, [x0, y0, x1, y1]); nodes.set(prev, [x0, y0]); nodes.set(t, [x1, y1]); }
            }
          }
          prev = t;
        }
      }
    }
    if (!edges.size || edges.size > 3000) return;
    const segs = [...edges.values()], posts = [...nodes.values()];
    const R0 = 0.032 + 0.006 * c.pipe, Y = 0.17;
    const col = ['#6c625a', '#b4a88c', '#b88a42'][Math.min(2, c.pipe - 1)];
    const pg = new THREE.CylinderGeometry(R0, R0, 1, 6); pg.rotateZ(Math.PI / 2);
    const pm = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: c.pipe >= 3 ? 0.6 : 0.3 }), segs.length);
    const m = this._m, q = this._q, v = this._v, sc = this._s, e = this._e;
    segs.forEach(([x0, y0, x1, y1], i) => { e.set(0, Math.atan2(y1 - y0, x1 - x0), 0); q.setFromEuler(e); m.compose(v.set((x0 + x1) / 2, Y, -(y0 + y1) / 2), q, sc.set(Math.hypot(x1 - x0, y1 - y0) + R0 * 2, 1, 1)); pm.setMatrixAt(i, m); });
    pm.castShadow = true; pm.receiveShadow = true; pm.instanceMatrix.needsUpdate = true; pm.computeBoundingSphere();
    this.pathGroup.add(pm);
    // 每个转角/接头：一根支柱 + 一个接头箍
    const og = new THREE.CylinderGeometry(0.022, 0.03, Y, 5); og.translate(0, Y / 2, 0);
    const om = new THREE.InstancedMesh(og, new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.8 }), posts.length);
    const jg = new THREE.SphereGeometry(R0 * 1.55, 6, 4);
    const jm = new THREE.InstancedMesh(jg, new THREE.MeshStandardMaterial({ color: c.pipe >= 3 ? '#7a4a22' : c.pipe >= 2 ? '#7e6e58' : '#4e4842', roughness: 0.6, metalness: 0.3 }), posts.length);
    q.identity();
    posts.forEach(([x, y], i) => { om.setMatrixAt(i, m.compose(v.set(x, 0, -y), q, sc.set(1, 1, 1))); jm.setMatrixAt(i, m.compose(v.set(x, Y, -y), q, sc.set(1, 1, 1))); });
    for (const im of [om, jm]) { im.castShadow = true; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); this.pathGroup.add(im); }
  }

  // 镜头附近的地面小装饰（只摆在空地上，镜头移动后重新摆）
  buildDecor() {
    this.decor = {};
    for (const k of ['drift', 'stone', 'shrub', 'grass', 'log', 'ice', 'sapling', 'pebble', 'ripple', 'steps', 'icecrack']) {
      const im = new THREE.InstancedMesh(M.decorGeo(k), this.matStd, 1600);
      im.count = 0; im.receiveShadow = true; im.castShadow = M.DECOR_NEAR.has(k) ? false : this.q === 'ultra' ? k !== 'drift' && k !== 'grass' && k !== 'pebble' : k === 'shrub';
      this.decor[k] = im; this.root.add(im);
    }
    this.decorKey = ''; this._lodSig = null;
  }
  refreshDecor() {
    const S = this.S, w = this.world, cam = this.cam;
    const key = Math.round(cam.tx / 6) + ',' + Math.round(cam.ty / 6) + ',' + this.bldSig + ',' + (S.car ? S.car.k : '') + ',' + (S.sur ? S.sur.id : '');
    if (key === this.decorKey) return;
    this.decorKey = key;
    const occ = new Set();
    for (const b of S.buildings) { const s = BLD[b.type].size, pad = b.type === 'furnace' ? 1 : 0; for (let y = b.y - 1 - pad; y < b.y + s + pad; y++) for (let x = b.x - pad; x < b.x + s + pad; x++) occ.add(y * W + x); }
    for (const p of w.sites || []) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) occ.add((p.y + dy) * W + p.x + dx);
    // 远方地标和商队营地上不撒杂物
    (w.far || []).forEach((p, i) => { const r = FAR_MARKS[i].r + 0.6; for (let y = Math.floor(p.y - r); y <= p.y + r; y++) for (let x = Math.floor(p.x - r); x <= p.x + r; x++) if (Math.hypot(x - p.x, y - p.y) <= r) occ.add(y * W + x); });
    if (S.car) for (let y = S.car.y - 1; y <= S.car.y + 3; y++) for (let x = S.car.x - 1; x <= S.car.x + 3; x++) occ.add(y * W + x);
    if (S.sur) for (let y = S.sur.y - 1; y <= S.sur.y + 1; y++) for (let x = S.sur.x - 1; x <= S.sur.x + 1; x++) occ.add(y * W + x);
    for (const c of S.camps) if (c.fest) { const f = this.lifeSpots(c).fest; if (f) for (let y = Math.floor(f[1] - f[3] - 0.5); y <= f[1] + f[3] + 0.5; y++) for (let x = Math.floor(f[0] - f[3] - 0.5); x <= f[0] + f[3] + 0.5; x++) if (Math.hypot(x + 0.5 - f[0], y + 0.5 - f[1]) < f[3] + 0.6) occ.add(y * W + x); }
    const cy = Math.round(cam.ty), R = 40, Q = this.q || 'high';
    const n = { drift: 0, stone: 0, shrub: 0, grass: 0, log: 0, ice: 0, sapling: 0, pebble: 0, ripple: 0, steps: 0, icecrack: 0 };
    const m = this._m, q = this._q, v = this._v, sc = this._s, e = this._e;
    // 流畅档只留雪堆和石头；极致档每格再撒第二层（倒木、冰凌、小树苗、碎石子）
    const pickA = r => Q === 'low' ? (r < 0.06 ? 'drift' : r < 0.09 ? 'stone' : null) : r < 0.09 ? 'drift' : r < 0.14 ? 'stone' : r < 0.19 ? 'shrub' : r < 0.27 ? 'grass' : null;
    const pickB = r => r < 0.035 ? 'log' : r < 0.075 ? 'ice' : r < 0.12 ? 'sapling' : r < 0.2 ? 'pebble' : r < 0.27 ? 'grass' : r < 0.31 ? 'shrub' : null;
    const RAD = { drift: 0.36, log: 0.34, sapling: 0.16, ice: 0.14 };
    const put = (x, y, k, sd) => {
      if (!k || n[k] >= 1600) return;
      const s = k === 'drift' ? 0.6 + hash3(x, y, sd + 1) * 0.5 : 0.7 + hash3(x, y, sd + 1) * 0.6;
      const px = x + 0.15 + hash3(x, y, sd + 3) * 0.7, py = y + 0.15 + hash3(x, y, sd + 4) * 0.7;
      if (this.blocked(px, py, (RAD[k] || 0.14) * s)) return;
      e.set(0, k === 'ripple' ? M.WIND_A + (hash3(x, y, sd + 2) - 0.5) * 0.3 : hash3(x, y, sd + 2) * 6.28, 0); q.setFromEuler(e);
      m.compose(v.set(px, 0.02, -py), q, sc.set(s, s, s));
      this.decor[k].setMatrixAt(n[k]++, m);
    };
    // 拉近才看得见的一层（画质不是流畅时）：风纹、建筑周围的脚印、冰面上冻住的旧裂纹
    const fine = Q !== 'low', near = new Set();
    if (fine) for (const b of S.buildings) { const s = BLD[b.type].size; for (let y = b.y - 3; y < b.y + s + 2; y++) for (let x = b.x - 2; x < b.x + s + 2; x++) near.add(y * W + x); }
    for (let y = Math.max(0, cy - R); y < Math.min(H, cy + R); y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (fine && w.terrain[i] === T_ICE && !occ.has(i) && hash3(x, y, 111) < 0.3 && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H && w.terrain[idx(x + dx, y + dy)] === T_ICE)) { put(x, y, 'icecrack', 111); continue; }
      if (w.terrain[i] !== T_SNOW || occ.has(i) || (w.spot[i] >= 0 && Sim.spotLeft(S, i) > 0)) continue;
      if (fine) { const r = hash3(x, y, 131); if (near.has(i) ? r < 0.22 : false) put(x, y, 'steps', 131); else if (r > 0.86) put(x, y, 'ripple', 131); }
      put(x, y, pickA(hash3(x, y, 71)), 71);
      if (Q === 'ultra') put(x, y, pickB(hash3(x, y, 91)), 91);
    }
    for (const k in n) { const im = this.decor[k]; im.count = n[k]; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  }

  // 用建筑模型渲染出界面里用的缩略图
  makeThumbs(list, size = 128) {
    const r = this.renderer;
    if (!this._th || this._th.size !== size) {
      const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
      rt.texture.colorSpace = THREE.SRGBColorSpace;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight('#e4eeff', '#6a7280', 1.35));
      const dl = new THREE.DirectionalLight('#ffe2c0', 1.7); dl.position.set(4, 6, 3); sc.add(dl);
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      this._th = { size, rt, sc, cam: new THREE.PerspectiveCamera(26, 1, 0.1, 100), buf: new Uint8Array(size * size * 4), cv };
    }
    const { rt, sc, cam, buf, cv } = this._th;
    const cx = cv.getContext('2d'), id = cx.createImageData(size, size);
    const prevC = r.getClearColor(new THREE.Color()), prevA = r.getClearAlpha();
    const out = {};
    r.setClearColor(0x000000, 0);
    for (const [type, lvl] of list) {
      const { geo, glow, flame, flameY } = this.bgeo(type, lvl);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, this.matStd));
      if (glow) g.add(new THREE.Mesh(glow, this.matGlow));
      if (flame) { const f = new THREE.Mesh(flame, this.matGlow); f.position.y = flameY; g.add(f); }
      sc.add(g);
      // 只框住建筑本体（脚下的雪地圆盘不算），让模型填满画面
      const bx = new THREE.Box3().setFromObject(g), hs = BLD[type].size * 0.5 + 0.05;
      bx.min.x = Math.max(bx.min.x, -hs); bx.max.x = Math.min(bx.max.x, hs); bx.min.z = Math.max(bx.min.z, -hs); bx.max.z = Math.min(bx.max.z, hs); bx.min.y = 0;
      const sph = bx.getBoundingSphere(new THREE.Sphere());
      const d = sph.radius / Math.tan(THREE.MathUtils.degToRad(13)) * 0.92;
      cam.position.set(sph.center.x + d * 0.52, sph.center.y + d * 0.5, sph.center.z + d * 0.69); cam.lookAt(sph.center);
      r.setRenderTarget(rt); r.clear(); r.render(sc, cam);
      r.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      for (let y = 0; y < size; y++) id.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      for (let k = 0; k < id.data.length; k += 4) { const a = id.data[k + 3]; if (a > 0 && a < 255) { id.data[k] = Math.min(255, id.data[k] * 255 / a); id.data[k + 1] = Math.min(255, id.data[k + 1] * 255 / a); id.data[k + 2] = Math.min(255, id.data[k + 2] * 255 / a); } }
      cx.putImageData(id, 0, 0);
      out[type] = cv.toDataURL('image/png');
      sc.remove(g);
    }
    r.setRenderTarget(null); r.setClearColor(prevC, prevA);
    return out;
  }

  syncRings() {
    const S = this.S;
    let sig = '';
    for (const c of S.camps) sig += c.id + ':' + Sim.getB(S, c.furnace).lvl + ':' + (c.pipe || 0) + ';';
    for (const b of S.buildings) if (b.type === 'heater') sig += 'h' + b.id;
    if (sig === this.ringSig) return;
    this.ringSig = sig;
    for (const o of [...this.rings.children]) { this.rings.remove(o); o.geometry.dispose(); }
    this.ringMat ||= new THREE.MeshBasicMaterial({ color: '#ffaa50', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    this.diskMat ||= new THREE.MeshBasicMaterial({ color: '#ffb070', transparent: true, opacity: 0.06, depthWrite: false });
    const add = (x, y, r) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.07, r + 0.07, 96), this.ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.09, -y);
      const disk = new THREE.Mesh(new THREE.CircleGeometry(r, 64), this.diskMat);
      disk.rotation.x = -Math.PI / 2; disk.position.set(x, 0.08, -y);
      this.rings.add(ring, disk);
    };
    for (const c of S.camps) add(c.x, c.y, Sim.heatRadius(S, c));
    for (const b of S.buildings) if (b.type === 'heater') add(b.x + 0.5, b.y + 0.5, BLD.heater.hreach);
  }

  syncLines() {
    const S = this.S;
    const sig = S.lines.map(l => `${l.id}:${l.rail}`).join(',') + '|' + S.camps.length;
    if (sig === this.lineSig) return;
    this.lineSig = sig;
    for (const o of [...this.lineGroup.children]) { this.lineGroup.remove(o); o.geometry && o.geometry.dispose(); }
    for (const l of S.lines) {
      const a = Sim.getCamp(S, l.a), b = Sim.getCamp(S, l.b);
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      const ang = Math.atan2(-dy, dx);
      const parts = [];
      const step = l.rail ? 0.6 : 1.4;
      for (let t = 2; t < d - 2; t += step) {
        const x = a.x + dx * t / d, y = a.y + dy * t / d;
        if (l.rail) parts.push(M.P(new THREE.BoxGeometry(0.2, 0.06, 0.9), '#5a4030', { x, y: 0.05, z: -y, ry: ang + Math.PI / 2 }));
        else parts.push(M.P(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 5), '#6b4526', { x: x + Math.sin(ang) * 0.6, y: 0.3, z: -y + Math.cos(ang) * 0.6 }));
      }
      if (l.rail) for (const off of [-0.25, 0.25]) parts.push(M.P(new THREE.BoxGeometry(d - 4, 0.05, 0.06), '#8a96a3', { x: (a.x + b.x) / 2 + Math.sin(ang) * off, y: 0.1, z: -(a.y + b.y) / 2 + Math.cos(ang) * off, ry: ang }));
      else parts.push(M.P(new THREE.BoxGeometry(d - 4, 0.02, 0.5), '#d6dfe8', { x: (a.x + b.x) / 2, y: 0.03, z: -(a.y + b.y) / 2, ry: ang }));
      const m = new THREE.Mesh(M.merge(parts), this.matStd); m.receiveShadow = true;
      this.lineGroup.add(m);
    }
  }

  // ---------- 粒子 ----------
  initParticles() {
    const soft = document.createElement('canvas'); soft.width = soft.height = 32;
    const c = soft.getContext('2d'); const gr = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    const tex = this.softTex = new THREE.CanvasTexture(soft);
    const NS = 500;
    this.smoke = { n: NS, pos: new Float32Array(NS * 3), age: new Float32Array(NS).map(() => Math.random() * 4), life: 4, src: new Int32Array(NS).fill(-1) };
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(this.smoke.pos, 3));
    this.smokePts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.9, map: tex, transparent: true, opacity: 0.35, depthWrite: false, color: '#8a8f99' }));
    this.smokePts.frustumCulled = false;
    this.scene.add(this.smokePts);
    const NN = 5200; // 实际画多少由画质决定（snowN）
    this.snow = { n: NN, pos: new Float32Array(NN * 3) }; this.snowN = this.lowEnd ? 1800 : 3200;
    for (let i = 0; i < NN; i++) { this.snow.pos[i * 3] = Math.random() * 60 - 30; this.snow.pos[i * 3 + 1] = Math.random() * 18; this.snow.pos[i * 3 + 2] = Math.random() * 60 - 30; }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(this.snow.pos, 3));
    this.snowPts = new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.13, map: tex, transparent: true, opacity: 0.9, depthWrite: false, color: '#ffffff' }));
    this.snowPts.frustumCulled = false;
    this.scene.add(this.snowPts);
  }

  // ---------- 画质：流畅 / 标准 / 极致 ----------
  setQuality(q) {
    this.q = q;
    const dpr = window.devicePixelRatio || 1, r = this.renderer;
    r.setPixelRatio(q === 'low' ? Math.min(1, dpr) : q === 'ultra' ? Math.min(2.5, Math.max(1.5, dpr)) : Math.min(this.lowEnd ? 1.5 : 2, dpr));
    r.shadowMap.enabled = q !== 'low'; this.sun.castShadow = q !== 'low';
    const sh = this.sun.shadow, ms = q === 'ultra' ? 4096 : this.lowEnd ? 1024 : 2048;
    if (sh.mapSize.x !== ms) { sh.mapSize.set(ms, ms); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    const ext = q === 'ultra' ? 36 : 28, sc = sh.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    sh.radius = q === 'ultra' ? 3 : 1;
    this.groundU.value = q === 'low' ? 0 : q === 'ultra' ? 1 : 0.45;
    this.snowN = q === 'low' ? 1200 : q === 'ultra' ? this.snow.n : this.lowEnd ? 1800 : 3200;
    if (this.decor) for (const k in this.decor) this.decor[k].castShadow = q === 'ultra' ? k !== 'drift' && k !== 'grass' && k !== 'pebble' : k === 'shrub';
    this.decorKey = '';
    if (q === 'ultra' && !this.ultra) this.initUltra();
    if (this.ultra) this.ultra.g.visible = q === 'ultra';
    this.resize();
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }
  // 极致档的额外细节：雪地上一闪一闪的冰晶反光、贴着地面被风卷起的雪
  initUltra() {
    const g = new THREE.Group(); this.scene.add(g);
    const NG = 1800, gp = new Float32Array(NG * 3), gc = new Float32Array(NG * 3), ph = new Float32Array(NG * 2);
    for (let i = 0; i < NG; i++) { gp[i * 3] = Math.random() * 56 - 28; gp[i * 3 + 1] = 0.085; gp[i * 3 + 2] = Math.random() * 56 - 28; ph[i * 2] = Math.random() * 6.28; ph[i * 2 + 1] = 0.6 + Math.random() * 2.2; }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    const glint = new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.12, map: this.softTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glint.frustumCulled = false; g.add(glint);
    const NB = 900, bp = new Float32Array(NB * 3), bv = new Float32Array(NB);
    for (let i = 0; i < NB; i++) { bp[i * 3] = Math.random() * 60 - 30; bp[i * 3 + 1] = 0.04 + Math.pow(Math.random(), 2) * 0.7; bp[i * 3 + 2] = Math.random() * 60 - 30; bv[i] = 0.6 + Math.random(); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    const blow = new THREE.Points(bg, new THREE.PointsMaterial({ size: 0.32, map: this.softTex, color: '#f4f8ff', transparent: true, opacity: 0.32, depthWrite: false }));
    blow.frustumCulled = false; g.add(blow);
    this.ultra = { g, glint, gp, gc, ph, NG, blow, bp, bv, NB };
  }
  animUltra(dt) {
    const U = this.ultra; if (!U) return;
    const ox = this.cam.tx, oz = -this.cam.ty, t = this.time;
    // 冰晶：跟着镜头循环铺开，太阳越亮闪得越多
    const sunK = (0.3 + this.nf * 0.7) * (1 - this.blizz * 0.7); // 白天雪地太亮看不出，夜里月光下最明显
    for (let i = 0; i < U.NG; i++) {
      let x = U.gp[i * 3], z = U.gp[i * 3 + 2];
      if (x - ox > 28) x -= 56; else if (x - ox < -28) x += 56;
      if (z - oz > 28) z -= 56; else if (z - oz < -28) z += 56;
      U.gp[i * 3] = x; U.gp[i * 3 + 2] = z;
      const k = Math.pow(Math.max(0, Math.sin(t * U.ph[i * 2 + 1] + U.ph[i * 2])), 14) * sunK;
      U.gc[i * 3] = k; U.gc[i * 3 + 1] = k; U.gc[i * 3 + 2] = k * (1.05 - this.nf * 0.2);
    }
    U.glint.geometry.attributes.position.needsUpdate = true; U.glint.geometry.attributes.color.needsUpdate = true;
    // 地吹雪：阵风时更明显，暴风雪里更密更快
    const wind = 1.6 + this.blizz * 6 + Math.sin(t * 0.35) * 0.8;
    for (let i = 0; i < U.NB; i++) {
      let x = U.bp[i * 3] + wind * U.bv[i] * dt, y = U.bp[i * 3 + 1] + Math.sin(t * 2 + i) * 0.08 * dt, z = U.bp[i * 3 + 2] + Math.sin(t * 0.7 + i * 0.3) * 0.25 * dt;
      if (x - ox > 30) x -= 60; else if (x - ox < -30) x += 60;
      if (z - oz > 30) z -= 60; else if (z - oz < -30) z += 60;
      U.bp[i * 3] = x; U.bp[i * 3 + 1] = y; U.bp[i * 3 + 2] = z;
    }
    U.blow.geometry.attributes.position.needsUpdate = true;
    U.blow.material.opacity = (0.18 + 0.12 * Math.max(0, Math.sin(t * 0.35)) + this.blizz * 0.3) * (1 - this.nf * 0.5);
  }

  // ---------- 夜晚：地上的暖光、搬运工的提灯 ----------
  initNight() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.poolMat = new THREE.MeshBasicMaterial({ map: tex, color: '#ff9a48', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.poolMat, 900);
    this.pools.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(900 * 3), 3);
    this.pools.count = 0; this.pools.frustumCulled = false; this.pools.renderOrder = 2;
    this.scene.add(this.pools);
    this.lampPos = new Float32Array(500 * 3);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(this.lampPos, 3)); lg.setDrawRange(0, 0);
    this.lamps = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.75, map: this.softTex, color: '#ffb35a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.lamps.frustumCulled = false; this.scene.add(this.lamps);
    this.nf = 0; this.dw = 0; this.nightCss = -1;
    this.C = { day: new THREE.Color(0.54, 0.62, 0.71), dusk: new THREE.Color(0.66, 0.55, 0.55), night: new THREE.Color(0.1, 0.135, 0.22), skyD: new THREE.Color('#d2e2ff'), skyN: new THREE.Color('#4a68b0'), gndD: new THREE.Color('#5a6676'), gndN: new THREE.Color('#1c2434'), sunD: new THREE.Color('#ffd9ae'), sunK: new THREE.Color('#ff7a3a'), moon: new THREE.Color('#a8c0ff'), smokeD: new THREE.Color('#8a8f99'), smokeN: new THREE.Color('#3a404e'), snowN: new THREE.Color('#9eabc8'), fogN: new THREE.Color(0.3, 0.34, 0.46), t: new THREE.Color() };
  }
  // 每栋房子门前一片暖光，熔炉周围一大片；只在夜里显出来
  refreshPools() {
    const S = this.S, m = this._m, q = this._q.identity(), v = this._v, sc = this._s, col = new THREE.Color();
    let n = 0;
    for (const b of S.buildings) {
      if (n >= 900) break;
      const s = BLD[b.type].size, cx = b.x + s / 2, cy = b.y + s / 2;
      if (b.type === 'furnace') {
        const d = Math.min(15, furnaceRadius(b.lvl) * 1.15);
        m.compose(v.set(cx, 0.09, -cy), q, sc.set(d, 1, d)); col.setRGB(1, 0.9, 0.8);
      } else if (b.type === 'lamp') {
        // 路灯：灯下一圈更亮更暖的光
        const d = 3.4;
        m.compose(v.set(cx + 0.15, 0.09, -cy), q, sc.set(d, 1, d)); col.setRGB(1, 0.84, 0.58);
      } else {
        const d = s * 2.3;
        m.compose(v.set(cx, 0.09, -(cy - s * 0.35)), q, sc.set(d, 1, d)); col.setRGB(0.6, 0.48, 0.36);
      }
      this.pools.setMatrixAt(n, m); this.pools.setColorAt(n, col); n++;
    }
    // 路灯灯头、雕像火把：夜里的光点（每帧塞进 lamps）
    const LPd = this.decoLP = [];
    for (const b of S.buildings) {
      if (b.type === 'lamp') { const h = 1.2 + 0.04 * Math.min(b.lvl, 10), cx = b.x + 0.5, cy = b.y + 0.5; for (const sg of b.lvl >= 5 ? [1, -1] : [1]) LPd.push(cx + sg * 0.24, 0.2 + h - 0.21, -cy); }
      else if (b.type === 'statue') LPd.push(b.x + 0.5 + 0.17, 0.62 + 1.24, -(b.y + 0.5 - 0.02));
    }
    // 篝火庆典的场子：一大片暖光
    for (const c of S.camps) if (c.fest && n < 900) {
      const L = this.lifeSpots(c); if (!L.fest) continue;
      const d = L.fest[3] * 3.4; m.compose(v.set(L.fest[0], 0.1, -L.fest[1]), q, sc.set(d, 1, d)); col.setRGB(1, 0.72, 0.45);
      this.pools.setMatrixAt(n, m); this.pools.setColorAt(n, col); n++;
    }
    this.pools.count = n; this.pools.instanceMatrix.needsUpdate = true; if (n) this.pools.instanceColor.needsUpdate = true;
  }
  // ---------- 特殊天气：极光夜、冰雾早晨（只改画面）----------
  initSky() {
    this.aur = 0; this.ice = 0; this.skyCss = '';
    const noise = `
float sh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(sh(i), sh(i + vec2(1, 0)), f.x), mix(sh(i + vec2(0, 1)), sh(i + vec2(1, 1)), f.x), f.y); }`;
    const vert = 'varying vec3 vWP; varying vec2 vUv; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
    const plane = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // 极光：雪地映出天上缓缓摆动的绿、蓝、紫光带
    this.aurU = { uT: { value: 0 }, uA: { value: 0 } };
    this.aurMesh = new THREE.Mesh(plane(), new THREE.ShaderMaterial({
      uniforms: this.aurU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: vert,
      fragmentShader: `varying vec3 vWP; varying vec2 vUv; uniform float uT, uA;${noise}
void main() {
  vec2 p = vWP.xz * 0.06;
  float w1 = sn(p * 0.7 + vec2(uT * 0.025, -uT * 0.015)), w2 = sn(p * 1.9 - vec2(uT * 0.04, 0.0));
  float y = p.y + w1 * 2.2 + w2 * 0.5;
  float b1 = pow(0.5 + 0.5 * sin(y * 4.2 + uT * 0.22), 3.0);
  float b2 = pow(0.5 + 0.5 * sin(y * 2.3 - uT * 0.15 + 1.7), 6.0);
  float ray = 0.5 + 0.5 * sn(vec2(vWP.x * 0.45 + uT * 0.3, y * 3.0));
  float edge = 1.0 - smoothstep(0.24, 0.5, length(vUv - 0.5));
  vec3 col = mix(vec3(0.1, 0.95, 0.5), vec3(0.15, 0.7, 1.0), w2) * b1 + vec3(0.55, 0.25, 1.0) * b2 * 0.55;
  gl_FragColor = vec4(col * ray * uA * edge, 1.0);
}`,
    }));
    this.aurMesh.frustumCulled = false; this.aurMesh.renderOrder = 3; this.aurMesh.visible = false;
    this.scene.add(this.aurMesh);
    // 冰雾：几层贴地的薄雾慢慢飘，房子从雾里露出屋顶
    this.iceU = { uT: { value: 0 }, uA: { value: 0 }, uC: { value: new THREE.Vector3(0.86, 0.9, 0.95) } };
    const fogMat = new THREE.ShaderMaterial({
      uniforms: this.iceU, transparent: true, depthWrite: false, vertexShader: vert,
      fragmentShader: `varying vec3 vWP; varying vec2 vUv; uniform float uT, uA; uniform vec3 uC;${noise}
void main() {
  float hk = vWP.y;
  vec2 p = vWP.xz * 0.085 + vec2(uT * 0.045 + hk * 7.0, uT * 0.018 - hk * 3.0);
  float n = sn(p) * 0.58 + sn(p * 2.3 + 3.1) * 0.3 + sn(p * 5.2 - uT * 0.06) * 0.12;
  float a = smoothstep(0.28, 0.78, n) * (0.55 + 0.45 * (1.0 - hk / 2.2));
  float edge = 1.0 - smoothstep(0.3, 0.5, length(vUv - 0.5));
  gl_FragColor = vec4(uC, a * uA * edge);
}`,
    });
    this.iceSheets = [0.35, 0.95, 1.75].map((h, i) => {
      const m = new THREE.Mesh(plane(), fogMat);
      m.position.y = h; m.frustumCulled = false; m.renderOrder = 6 + i; m.visible = false;
      this.scene.add(m); return m;
    });
    // 钻石尘：雾里悬着的细小冰晶，一闪一闪
    const N = this.dustN = 520, pos = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 56 - 28; pos[i * 3 + 1] = 0.2 + Math.pow(Math.random(), 1.6) * 6; pos[i * 3 + 2] = Math.random() * 56 - 28; ph[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    this.dustU = { uT: { value: 0 }, uA: { value: 0 }, uS: { value: 100 } };
    this.dust = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aPh; uniform float uT, uA, uS; varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  float tw = pow(0.5 + 0.5 * sin(uT * (1.2 + fract(aPh * 7.0) * 2.6) + aPh * 6.2832), 14.0);
  vA = (0.12 + tw) * uA; gl_PointSize = uS * (0.5 + tw * 1.6) / -mv.z;
}`,
      fragmentShader: `varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  float core = pow(max(0.0, 1.0 - d * 2.0), 3.0);
  float star = max(0.0, 1.0 - abs(c.x) * 16.0) * max(0.0, 1.0 - abs(c.y) * 2.0) + max(0.0, 1.0 - abs(c.y) * 16.0) * max(0.0, 1.0 - abs(c.x) * 2.0);
  gl_FragColor = vec4(vec3(0.88, 0.95, 1.0), (core + star * 0.55) * vA);
}`,
    }));
    this.dust.frustumCulled = false; this.dust.visible = false; this.dust.renderOrder = 9;
    this.scene.add(this.dust);
  }
  animSky(dt) {
    const S = this.S, sky = Sim.skyAt(S, S.t), k = Math.min(1, dt * 0.35), c = this.cam;
    this.aur += (sky.aurora - this.aur) * k; this.ice += (sky.icefog - this.ice) * k;
    const au = this.aur * (1 - this.blizz), ic = this.ice * (1 - this.blizz), t = this.time;
    const size = c.dist * 4 + 50, cx = c.tx, cz = -c.ty - c.dist * 0.25;
    this.aurMesh.visible = au > 0.01;
    if (this.aurMesh.visible) {
      this.aurMesh.position.set(cx, 0.1, cz); this.aurMesh.scale.set(size, 1, size);
      this.aurU.uT.value = t; this.aurU.uA.value = au * (0.42 + 0.1 * Math.sin(t * 0.21));
    }
    const fogOn = ic > 0.01;
    this.iceSheets.forEach((m, i) => { m.visible = fogOn && (this.q !== 'low' || i === 1); if (m.visible) { m.position.x = cx; m.position.z = cz; m.scale.set(size, 1, size); } });
    if (fogOn) {
      this.iceU.uT.value = t; this.iceU.uA.value = ic * 0.42;
      const nf = this.nf; this.iceU.uC.value.set(0.86 - nf * 0.55, 0.9 - nf * 0.54, 0.95 - nf * 0.45);
    }
    this.dust.visible = fogOn && this.q !== 'low';
    if (this.dust.visible) {
      const P = this.dust.geometry.attributes.position, a = P.array, ox = c.tx, oz = -c.ty;
      for (let i = 0; i < this.dustN; i++) {
        let x = a[i * 3] + 0.12 * dt, z = a[i * 3 + 2] + Math.sin(t * 0.3 + i) * 0.05 * dt;
        if (x - ox > 28) x -= 56; if (x - ox < -28) x += 56;
        if (z - oz > 28) z -= 56; if (z - oz < -28) z += 56;
        a[i * 3] = x; a[i * 3 + 2] = z;
      }
      P.needsUpdate = true;
      const h = this.renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2())).y;
      this.dustU.uT.value = t; this.dustU.uA.value = ic * (1 - this.nf * 0.4); this.dustU.uS.value = 0.13 * h / (2 * Math.tan(this.camera.fov * Math.PI / 360));
    }
    // 屏幕上沿透进来的极光、整体蒙一层白雾（CSS）
    const css = (Math.round(au * 20) / 20) + '|' + (Math.round(ic * 20) / 20);
    if (css !== this.skyCss) {
      this.skyCss = css; const bs = document.body.style;
      bs.setProperty('--aur', (Math.round(au * 20) / 20).toFixed(2)); bs.setProperty('--ice', (Math.round(ic * 20) / 20).toFixed(2));
      document.body.classList.toggle('aur-on', au > 0.02); document.body.classList.toggle('ice-on', ic > 0.02);
    }
  }
  // 昼夜：天色、雾、日光方向和颜色、窗户、暖光
  dayNight(dt) {
    const S = this.S, dc = dayCycle(this.photoT ?? S.t), C = this.C, bz = this.blizz;
    const k = Math.min(1, dt * 2);
    this.nf += (dc.nf - this.nf) * k; this.dw += (dc.dw - this.dw) * k;
    const nf = this.nf, dw = this.dw;
    const bc = this.bg.copy(C.day).lerp(C.night, nf).lerp(C.dusk, dw * 0.55 * (1 - nf * 0.5));
    bc.lerp(C.t.setRGB(0.5, 0.56, 0.63).lerp(C.night, nf * 0.8), bz * 0.35);
    const au = this.aur * (1 - bz), ic = this.ice * (1 - bz);
    if (au > 0.001) bc.lerp(C.t.setRGB(0.07, 0.22, 0.22), au * 0.4);
    if (ic > 0.001) bc.lerp(C.t.setRGB(0.8, 0.85, 0.9).lerp(C.night, nf * 0.7), ic * 0.85);
    // 冰风暴：灰蓝的阴天；极寒夜：夜色更蓝更沉，屏幕四角结霜
    const X = this.wxk || { ice: 0, cold: 0 }, wi = X.ice, wc = X.cold;
    if (wi > 0.001) bc.lerp(C.t.setRGB(0.56, 0.66, 0.76).lerp(C.night, nf * 0.8), wi * 0.45);
    if (wc > 0.001) bc.lerp(C.t.setRGB(0.04, 0.08, 0.2), wc * 0.4 * nf);
    this.scene.fog.color.copy(bc);
    this.hemi.color.copy(C.skyD).lerp(C.skyN, nf); this.hemi.groundColor.copy(C.gndD).lerp(C.gndN, nf);
    if (wc > 0.001) this.hemi.color.lerp(C.t.setRGB(0.5, 0.66, 1), wc * 0.35);
    if (wi > 0.001) this.hemi.color.lerp(C.t.setRGB(0.75, 0.85, 0.95), wi * 0.3);
    if (au > 0.001) this.hemi.color.lerp(C.t.setRGB(0.35, 1, 0.72), au * 0.45);
    this.hemi.intensity = (1.1 - nf * 0.62) * (1 - bz * 0.27) * (1 + au * 0.22 + ic * 0.12);
    this.sun.color.copy(C.sunD).lerp(C.moon, nf).lerp(C.sunK, Math.min(1, dw * 0.85));
    this.sun.intensity = (1.55 - nf * 1.2 - dw * 0.3) * (1 - bz * 0.6) * (1 - ic * 0.45) * (1 - wi * 0.5);
    // 太阳白天从东往西划过，夜里月亮慢慢摆回来，影子跟着转
    const p = dc.p, az = p < 0.56 ? -0.9 + 1.8 * p / 0.56 : 0.9 - 1.8 * (p - 0.56) / 0.44;
    this.sunOff = [Math.cos(az * 0.9) * 26 + 2, 30 - Math.abs(az) * 11, Math.sin(az * 0.9) * 22 + 6];
    const wk = 0.42 + nf * 0.58; this.matWin.color.setRGB(wk, wk, wk);
    if (this.fogMesh) this.fogMesh.material.color.setRGB(1, 1, 1).lerp(C.fogN, nf);
    if (this.smokePts) this.smokePts.material.color.copy(C.smokeD).lerp(C.smokeN, nf);
    if (this.snowPts) { this.snowPts.material.color.setRGB(1, 1, 1).lerp(C.snowN, nf); if (wi > 0.001) this.snowPts.material.color.lerp(C.t.setRGB(0.66, 0.84, 1), wi * 0.6); }
    const cc = Math.round(wc * 50) / 50;
    if (cc !== this.coldCss) { this.coldCss = cc; document.body.style.setProperty('--cold', cc); }
    const sl = Math.round(wi * (1 - bz) * 50) / 50;
    if (sl !== this.sleetCss) {
      this.sleetCss = sl; document.body.style.setProperty('--sleet', sl); document.body.classList.toggle('sleet-on', sl > 0);
      // 冻雨的纹理：第一次用到时画一张 256×256 的斜线短条，沿着 (−1, 4) 的方向落下，首尾无缝
      const el = sl > 0 && !this.sleetTex && document.querySelector('#sky .sleet');
      if (el) {
        const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
        x.lineCap = 'round';
        for (let i = 0; i < 70; i++) {
          const px = hash3(i, 1, 77) * 256, py = hash3(i, 2, 77) * 256, L = 10 + hash3(i, 3, 77) * 16;
          x.strokeStyle = `rgba(225,240,255,${(0.25 + hash3(i, 4, 77) * 0.4).toFixed(2)})`; x.lineWidth = 1 + hash3(i, 5, 77);
          for (const [ox, oy] of [[0, 0], [256, 0], [0, 256], [256, 256], [-256, 0], [0, -256]]) { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox - L * 0.25, py + oy + L); x.stroke(); }
        }
        el.style.backgroundImage = `url(${c.toDataURL()})`; this.sleetTex = true;
      }
    }
    this.poolMat.opacity = nf * 0.75 + dw * 0.06; this.pools.visible = this.poolMat.opacity > 0.01;
    this.lamps.material.opacity = Math.min(1, nf * 1.4);
    const nc = Math.round(nf * 50) / 50;
    if (nc !== this.nightCss) { this.nightCss = nc; document.body.style.setProperty('--night', nc); }
  }

  // 选中建筑时：原料从哪栋来、产品去哪栋，用带流动箭头的弧线连起来
  syncChain() {
    const S = this.S, sig = this.selId + '|' + this.bldSig;
    if (sig === this.chainSig) return;
    this.chainSig = sig;
    if (this.chainG) { this.chainG.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.isSprite && o.material !== this.chainShade) o.material.dispose(); }); this.scene.remove(this.chainG); this.chainG = null; }
    const b = this.selId != null ? Sim.getB(S, this.selId) : null;
    if (!b) return;
    const ch = Sim.chainOf(S, b);
    if (!ch.up.length && !ch.down.length) return;
    if (!this.arrowTex) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 32;
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, 0, 64, 32);
      x.fillStyle = '#fff'; x.beginPath(); x.moveTo(18, 0); x.lineTo(40, 0); x.lineTo(56, 16); x.lineTo(40, 32); x.lineTo(18, 32); x.lineTo(34, 16); x.closePath(); x.fill();
      this.arrowTex = new THREE.CanvasTexture(c); this.arrowTex.wrapS = THREE.RepeatWrapping; this.arrowTex.colorSpace = THREE.SRGBColorSpace;
      this.iconTex = {};
    }
    const icon = r => {
      if (this.iconTex[r]) return this.iconTex[r];
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(20,26,36,.82)'; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill();
      x.strokeStyle = '#' + RESCOL[r].getHexString(); x.lineWidth = 4; x.stroke();
      x.font = '34px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(RICON[r] || '•', 32, 35);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return (this.iconTex[r] = new THREE.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, toneMapped: false }));
    };
    const g = this.chainG = new THREE.Group(); this.scene.add(g);
    this.chainRings = [];
    const cen = bb => { const s = BLD[bb.type].size, e = this.buildings.get(bb.id); return new THREE.Vector3(bb.x + s / 2, Math.min(2.2, (e ? e.h : 1.5) * 0.8), -(bb.y + s / 2)); };
    const me = cen(b), ringed = new Set();
    const ring = (bb, col) => {
      if (ringed.has(bb.id)) return; ringed.add(bb.id);
      const s = BLD[bb.type].size, r = s * 0.62;
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
      m.position.set(bb.x + s / 2, 0.14, -(bb.y + s / 2)); m.userData.s = r; m.scale.setScalar(r); m.renderOrder = 9;
      g.add(m); this.chainRings.push(m);
    };
    const link = (a, c, res, k) => {
      const d = a.distanceTo(c);
      const mid = a.clone().add(c).multiplyScalar(0.5); mid.y = Math.max(a.y, c.y) + 0.6 + Math.min(4.5, d * 0.2) + k * 0.15;
      const cv = new THREE.QuadraticBezierCurve3(a, mid, c), L = cv.getLength();
      const seg = Math.max(14, Math.round(L * 2.5));
      const geo = new THREE.TubeGeometry(cv, seg, 0.1, 6, false);
      const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 0.9);
      // 深色外壳衬底，在雪地上也看得清
      const sh = new THREE.Mesh(new THREE.TubeGeometry(cv, seg, 0.16, 6, false), this.chainShade ||= new THREE.MeshBasicMaterial({ color: '#141a24', transparent: true, opacity: 0.45, depthTest: false, depthWrite: false, side: THREE.BackSide }));
      sh.renderOrder = 9; g.add(sh);
      const col = RESCOL[res].clone(); const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.2 + 0.15), Math.max(0.62, hsl.l));
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.arrowTex, color: col, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
      m.renderOrder = 10; g.add(m);
      const sp = new THREE.Sprite(icon(res)); sp.position.copy(cv.getPoint(0.5)); sp.position.y += 0.35; sp.scale.setScalar(0.75); sp.renderOrder = 11; g.add(sp);
    };
    // 同一对建筑之间只画一条（多种原料时取第一种），弧线略微错开高度
    const seen = new Set();
    ch.up.forEach((l, i) => { if (seen.has('u' + l.b.id)) return; seen.add('u' + l.b.id); link(cen(l.b), me, l.res, i % 3); ring(l.b, '#7fd0ff'); });
    ch.down.forEach((l, i) => { if (seen.has('d' + l.b.id)) return; seen.add('d' + l.b.id); link(me, cen(l.b), l.res, i % 3); ring(l.b, '#ffb060'); });
  }

  // 点小人：屏幕上离点击位置最近、14 像素以内的那个
  pickFig(px, py) {
    const P = this.figPts, I = this.figInfo; if (!P || !I || this.cam.dist > 36) return null;
    const r = this.canvas.getBoundingClientRect();
    let best = null, bd = 16;
    for (let i = 0; i < I.length; i++) {
      if (!I[i]) continue;
      const p = this.project(P[i * 2], P[i * 2 + 1], 0.25);
      const d = Math.hypot(p.x + r.left - px, p.y + r.top - py);
      if (d < bd) { bd = d; best = { ...I[i], x: P[i * 2], y: P[i * 2 + 1], d }; }
    }
    return best;
  }

  // 给声音用：镜头离熔炉多近、附近有多少在干活的伐木/采矿/加工
  audioInfo() {
    const S = this.S, R = Sim.rt(S), c = this.cam;
    const zk = Math.max(0.15, Math.min(1, 1.3 - c.dist / 45));
    let near = 0, chop = 0, mine = 0, ind = 0;
    for (const cp of S.camps) {
      const d = Math.hypot(cp.x - c.tx, cp.y - c.ty), cr = R.c[cp.id];
      const k = (1 - d / (9 + c.dist * 0.25)) * (cr ? 0.3 + 0.7 * cr.fueled : 1);
      if (k > near) near = k;
    }
    const RR = 16;
    for (const b of S.buildings) {
      const s = BLD[b.type].size, d = Math.hypot(b.x + s / 2 - c.tx, b.y + s / 2 - c.ty);
      if (d > RR || !b.workers) continue;
      const br = R.b[b.id]; if (!br || (br.act || 0) < 0.05) continue;
      const w = (1 - d / RR) * Math.min(1, b.workers / 3);
      if (b.type === 'lumber') chop += w;
      else if (BLD[b.type].gather && b.type !== 'hunter') mine += w;
      else if (BLD[b.type].cat === 'make') ind += w * 0.5;
    }
    let fest = 0;
    for (const cp of S.camps) if (cp.fest) { const L = this.lifeSpots(cp), f = L.fest || [cp.x, cp.y]; fest = Math.max(fest, 1 - Math.hypot(f[0] - c.tx, f[1] - c.ty) / (10 + c.dist * 0.4)); }
    return { near: Math.max(0, near) * zk, chop: chop * zk, mine: mine * zk, ind: ind * zk, blizz: this.blizz, nf: this.nf, dist: c.dist, fest: Math.max(0, fest) * zk };
  }

  // ---------- 施工尘土、升级火星、光圈 ----------
  initFx() {
    const soft = this.softTex;
    const mk = (n, color, size, additive) => {
      const pos = new Float32Array(n * 3).fill(-50), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ size, map: soft, color, transparent: true, depthWrite: false, opacity: 0.9, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; this.scene.add(pts);
      return { n, pos, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n).fill(1), pts, next: 0 };
    };
    this.fxs = { dust: mk(300, '#e8eef5', 0.7, false), spark: mk(300, '#ffb050', 0.22, true) };
    this.fxRings = [];
  }
  burst(kind, x, y, n, spread = 1, h = 0.2) {
    const P = this.fxs && this.fxs[kind]; if (!P) return;
    for (let k = 0; k < n; k++) {
      const i = P.next; P.next = (P.next + 1) % P.n;
      const a = Math.random() * 6.28, r = Math.random() * spread;
      P.pos[i * 3] = x + Math.cos(a) * r; P.pos[i * 3 + 1] = h + Math.random() * 0.3; P.pos[i * 3 + 2] = -(y + Math.sin(a) * r);
      const sp = kind === 'spark' ? 1.5 + Math.random() * 2.5 : 0.4 + Math.random() * 0.6;
      P.vel[i * 3] = Math.cos(a) * sp; P.vel[i * 3 + 1] = kind === 'spark' ? 2 + Math.random() * 3 : 0.3 + Math.random() * 0.5; P.vel[i * 3 + 2] = -Math.sin(a) * sp;
      P.life[i] = P.max[i] = kind === 'spark' ? 0.7 + Math.random() * 0.6 : 1.2 + Math.random() * 0.8;
    }
  }
  ringFx(x, y, s) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffc060', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.15, -y); m.userData = { t: 0, s };
    this.scene.add(m); this.fxRings.push(m);
  }
  animFx(dt) {
    for (const k in this.fxs) {
      const P = this.fxs[k];
      let any = false;
      for (let i = 0; i < P.n; i++) {
        if (P.life[i] <= 0) continue;
        any = true;
        P.life[i] -= dt;
        if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -50; continue; }
        if (k === 'spark') P.vel[i * 3 + 1] -= 6 * dt; else { P.vel[i * 3] *= 1 - dt * 1.5; P.vel[i * 3 + 2] *= 1 - dt * 1.5; }
        P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] = Math.max(0.03, P.pos[i * 3 + 1] + P.vel[i * 3 + 1] * dt); P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      }
      if (any || P.was) P.pts.geometry.attributes.position.needsUpdate = true;
      P.was = any;
    }
    this.fxRings = this.fxRings.filter(m => {
      m.userData.t += dt;
      const k = m.userData.t / 1.1;
      if (k >= 1) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); return false; }
      const r = m.userData.s * (0.6 + k * 1.8); m.scale.set(r, r, r); m.material.opacity = 0.9 * (1 - k);
      return true;
    });
  }

  // ---------- 镜头 ----------
  focus(x, y, instant) { this.cam.ttx = x; this.cam.tty = y; if (instant) { this.cam.tx = x; this.cam.ty = y; } }
  // 面板挡住一部分画面时，把画面中心挪到没被挡住的那块（只平移投影，镜头本身不动）
  setInset(px, py) { this.insetT = [px || 0, py || 0]; }
  updateInset(dt) {
    const t = this.insetT || [0, 0], c = this.inset || (this.inset = [0, 0]);
    const k = 1 - Math.pow(0.0008, dt);
    c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k;
    if (Math.abs(t[0] - c[0]) < 0.3) c[0] = t[0]; if (Math.abs(t[1] - c[1]) < 0.3) c[1] = t[1];
    const w = this.vw || innerWidth, h = this.vh || innerHeight;
    if (!c[0] && !c[1]) { if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset(); return; }
    this.camera.setViewOffset(w, h, c[0], c[1], w, h);
  }
  pan(dxPx, dyPx) {
    const k = this.cam.tdist / (this.canvas.clientHeight || 800) * 1.15;
    const c = Math.cos(this.cam.tyaw), s = Math.sin(this.cam.tyaw);
    // 屏幕向右 = 世界 (c, -s)，屏幕向上 = 向北
    this.cam.ttx -= (dxPx * c + dyPx * s) * k;
    this.cam.tty += (dyPx * c - dxPx * s) * k;
    this.clampCam();
  }
  zoom(f) { this.cam.tdist = Math.max(this.photo ? 4 : 9, Math.min(90, this.cam.tdist * f)); }
  rotate(da) { this.cam.tyaw += da; }
  clampCam() { this.cam.ttx = Math.max(-2, Math.min(W + 2, this.cam.ttx)); this.cam.tty = Math.max(-6, Math.min(H + 4, this.cam.tty)); }
  updateCamera(dt) {
    const c = this.cam, k = 1 - Math.pow(0.0005, dt);
    c.tx += (c.ttx - c.tx) * k; c.ty += (c.tty - c.ty) * k; c.dist += (c.tdist - c.dist) * k; c.yaw += (c.tyaw - c.yaw) * k;
    const pitch = this.photoPitch ?? 0.78 + (c.dist - 9) / 81 * 0.42; // 拍照模式可以自己调镜头高度
    const cx = c.tx, cz = -c.ty;
    this.camera.position.set(cx + Math.sin(c.yaw) * Math.cos(pitch) * c.dist, Math.sin(pitch) * c.dist, cz + Math.cos(c.yaw) * Math.cos(pitch) * c.dist);
    this.camera.lookAt(cx, 0, cz);
    const so = this.sunOff || [26, 30, 12];
    this.sun.position.set(cx + so[0], so[1], cz + so[2]); // 低角度的冬日斜阳，影子拉长
    this.sun.target.position.set(cx, 0, cz);
    const far = 70 + c.dist * 2.2;
    const ic = this.ice * (1 - this.blizz);
    this.scene.fog.near = far * 0.55 * (1 - this.blizz * 0.7) * (1 - ic * 0.8); this.scene.fog.far = far * (1 - this.blizz * 0.55) * (1 - ic * 0.45);
  }
  pickTile(px, py) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = v.sub(o).normalize();
    if (Math.abs(d.y) < 1e-6) return null;
    const t = -o.y / d.y;
    return { x: o.x + d.x * t, y: -(o.z + d.z * t) };
  }
  project(x, y, h = 0) {
    const v = (this._pv || (this._pv = new THREE.Vector3())).set(x, h, -y).project(this.camera);
    const w = this.vw || innerWidth, hh = this.vh || innerHeight;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * hh, on: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2 };
  }

  // ---------- 选择框与摆放预览 ----------
  select(bid) {
    this.selId = bid;
    const S = this.S;
    const b = bid != null ? Sim.getB(S, bid) : null;
    if (!b) { this.sel.visible = false; return; }
    const s = BLD[b.type].size, e = this.buildings.get(b.id);
    this.sel.visible = true;
    this.sel.scale.set(s + 0.1, (e ? e.h : 1.5) + 0.3, s + 0.1);
    this.sel.position.set(b.x + s / 2, ((e ? e.h : 1.5) + 0.3) / 2, -(b.y + s / 2));
  }
  setGhost(gh) {
    if (this.ghost && (!gh || gh.type !== this.ghost.type)) { this.scene.remove(this.ghost.g); for (const e of this.ghost.extra) { this.scene.remove(e.g); e.pad.material.dispose(); e.g.children[0].material.dispose(); } this.ghost = null; }
    if (!gh) { if (this.ringMat) { this.ringMat.opacity = 0.55; this.diskMat.opacity = 0.06; } return; }
    if (!this.ghost) {
      const { geo, glow, flame, flameY } = this.bgeo(gh.type, gh.type === 'furnace' ? 2 : 1);
      const g = new THREE.Group();
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.75, flatShading: true });
      g.add(new THREE.Mesh(geo, mat));
      if (glow) g.add(new THREE.Mesh(glow, this.matGlow));
      if (flame) { const f = new THREE.Mesh(flame, this.matGlow); f.position.y = flameY; g.add(f); }
      const s = BLD[gh.type].size;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: '#40e070', transparent: true, opacity: 0.45, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.y = 0.11;
      g.add(pad);
      let reach = null;
      if (BLD[gh.type].reach) {
        const r = BLD[gh.type].reach + s / 2;
        reach = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false }));
        reach.rotation.x = -Math.PI / 2; reach.position.y = 0.12; g.add(reach);
      }
      if (gh.type === 'furnace') {
        const r = furnaceRadius(2);
        reach = new THREE.Mesh(new THREE.RingGeometry(r - 0.07, r + 0.07, 96), new THREE.MeshBasicMaterial({ color: '#ffaa50', transparent: true, opacity: 0.7, depthWrite: false }));
        reach.rotation.x = -Math.PI / 2; reach.position.y = 0.12; g.add(reach);
      }
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.3, gapSize: 0.2, toneMapped: false }));
      line.frustumCulled = false;
      this.scene.add(g, line);
      g.add(line); // 线的坐标会在下面改成局部坐标
      this.ghost = { type: gh.type, g, pad, mat, line, reach, extra: [] };
    }
    const s = BLD[gh.type].size;
    const G0 = this.ghost;
    G0.g.position.set(gh.x + s / 2, 0, -(gh.y + s / 2));
    if (gh.type === 'furnace' && G0.reach) G0.reach.scale.setScalar(furnaceRadius(2 + 2 * (tierOfRow(gh.y + s / 2) - 1)) / furnaceRadius(2)); // 前哨熔炉起始等级随纬度提高
    G0.pad.material.color.set(gh.ok ? '#40e070' : gh.soft ? '#e0c040' : '#e05040');
    // 模型本身也带一点底色：一排里哪栋能建、哪栋排队一眼看得出
    const tint = o => o.ok ? '#c4ffcc' : o.soft ? '#ffe49a' : '#ff9c8c';
    G0.mat.color.set(tint(gh));
    G0.g.children[0].visible = true;
    if (gh.storage) {
      const p = G0.line.geometry.attributes.position;
      p.setXYZ(0, 0, 0.2, 0); p.setXYZ(1, gh.storage.x - (gh.x + s / 2), 0.2, -(gh.storage.y - (gh.y + s / 2)));
      p.needsUpdate = true; G0.line.computeLineDistances(); G0.line.visible = true;
    } else G0.line.visible = false;
    // 拖出来的一排：其余几栋共用同一个模型，各自一块底色（红色的地方不放模型）
    const row = gh.row || [], pool = G0.extra;
    for (let i = 0; i < row.length; i++) {
      let e = pool[i];
      if (!e) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(G0.g.children[0].geometry, G0.mat.clone()));
        const pad = new THREE.Mesh(G0.pad.geometry, new THREE.MeshBasicMaterial({ color: '#40e070', transparent: true, opacity: 0.45, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2; pad.position.y = 0.11; g.add(pad);
        this.scene.add(g); e = pool[i] = { g, pad };
      }
      const r = row[i];
      e.g.visible = true; e.g.position.set(r.x + s / 2, 0, -(r.y + s / 2));
      e.pad.material.color.set(r.ok ? '#40e070' : r.soft ? '#e0c040' : '#e05040');
      e.g.children[0].visible = r.ok || r.soft; e.g.children[0].material.color.set(tint(r));
    }
    for (let i = row.length; i < pool.length; i++) pool[i].g.visible = false;
    if (row.length) G0.line.visible = false;
    if (this.ringMat) { this.ringMat.opacity = 0.95; this.diskMat.opacity = 0.14; }
  }

  // 一键复制产线的蓝图：一组不同种类的建筑，各自一块底色（绿能建、黄排队、红放不下）
  setBlueprint(list) {
    const pool = this.bpPool || (this.bpPool = []);
    list = list || [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      let e = pool[i];
      if (e && e.type !== it.type) { this.scene.remove(e.g); e.mat.dispose(); e.pad.material.dispose(); e.pad.geometry.dispose(); e = pool[i] = null; }
      if (!e) {
        const { geo } = this.bgeo(it.type, 1), s = BLD[it.type].size;
        const g = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.72, flatShading: true });
        g.add(new THREE.Mesh(geo, mat));
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: '#40e070', transparent: true, opacity: 0.45, depthWrite: false }));
        pad.rotation.x = -Math.PI / 2; pad.position.y = 0.11; g.add(pad);
        this.scene.add(g); e = pool[i] = { type: it.type, g, mat, pad };
      }
      const s = BLD[it.type].size;
      e.g.visible = true; e.g.position.set(it.x + s / 2, 0, -(it.y + s / 2));
      e.pad.material.color.set(it.ok ? '#40e070' : it.soft ? '#e0c040' : '#e05040');
      e.mat.color.set(it.ok ? '#c4ffcc' : it.soft ? '#ffe49a' : '#ff9c8c');
      e.g.children[0].visible = it.ok || it.soft;
    }
    for (let i = list.length; i < pool.length; i++) if (pool[i]) pool[i].g.visible = false;
    if (this.ringMat) { this.ringMat.opacity = list.length ? 0.95 : 0.55; this.diskMat.opacity = list.length ? 0.14 : 0.06; }
  }

  // ---------- 特效事件 ----------
  onFx(fx) {
    if (fx.kind === 'raid') {
      const S = this.S, c = Sim.getCamp(S, fx.camp); if (!c) return;
      const n = Math.min(14, 3 + Math.round(fx.str / 12));
      const r = Sim.heatRadius(S, c) + 4;
      const base = Math.PI / 2 + (Math.random() - 0.5);
      const tier = tierOfRow(c.y);
      const col = new THREE.Color(fx.gang != null ? '#5a4030' : tier >= 6 ? '#8a70b0' : tier >= 5 ? '#c0e0f0' : tier >= 3 ? '#6a4a3a' : '#7d828c');
      this.raids.push({ camp: c.id, t0: this.time, won: fx.won, col, wolves: Array.from({ length: n }, (_, i) => ({ a: base + (i / n - 0.5) * 1.4, r0: r + Math.random() * 3, die: fx.won ? 4 + Math.random() * 6 : 99 })), lastShot: 0 });
    }
  }

  // ---------- 每帧 ----------
  frame(rdt, simAlpha) {
    const S = this.S;
    if (!S) return;
    // 暂停时人、车、雪花都停住；2 倍速时一起加快。镜头始终按真实时间走
    const dt = rdt * (this.timeScale ?? 1);
    this.time += dt;
    const R = Sim.rt(S);
    this.syncBuildings();
    this.syncQueue();
    this.syncBelts(dt);
    this.syncLife();
    this.syncSurprise(dt);
    this.syncCaravan(dt);
    this.syncFireWall(dt);
    this.syncFocus();
    this.syncRings();
    this.syncLines();
    if (R.infraDirty) { R.infraDirty = false; this.buildPaths(); }
    if (R.revealDirty) { R.revealDirty = false; this.spotBig = (this.spotBig || 0) + 1; this.refreshFog(); this.refreshSpots(); this.refreshRocks(); this.refreshLandmarks(); this.refreshSites(); }
    if (R.gangDirty) { R.gangDirty = false; this.refreshSites(); }
    this.spotTimer = (this.spotTimer || 0) + rdt;
    if (R.veinsDirty) { R.veinsDirty = false; R.spotsDirty = false; this.spotBig = (this.spotBig || 0) + 1; this.rebuildSpots(); }
    if (R.spotsDirty || (R.spotTouched && this.spotTimer > 4)) { if (R.spotsDirty) { this.decorKey = ''; this.spotBig = (this.spotBig || 0) + 1; } R.spotsDirty = false; R.spotTouched = false; this.spotTimer = 0; this.refreshSpots(); }
    const w = Sim.weatherAt(S, S.t);
    this.blizz += ((w.blizzard ? 1 : 0) - this.blizz) * Math.min(1, rdt * 0.5);
    { const we = Sim.wxeAt(S, S.t), wk = we.on ? we.ev.kind : null, X = this.wxk ||= { ice: 0, cold: 0, crack: 0 };
      for (const k in X) X[k] += ((wk === k ? 1 : 0) - X[k]) * Math.min(1, rdt * (k === 'crack' ? 0.3 : 0.5)); }
    this.syncCracks();
    this.updateCamera(rdt);
    this.updateInset(rdt);
    if (Math.round(this.cam.ty / 10) !== this.spotWin) { this.refreshSpots(); this.refreshRocks(); }
    else if (this.spotBld !== this.bldSig) this.refreshSpots();
    this.refreshDecor();
    this.lodSync();
    this.animBuildings(dt);
    this.animMovers(dt);
    this.animPeople(dt);
    this.animDeer(dt);
    this.animParticles(dt);
    this.animFx(dt);
    this.animRaids(dt);
    if (this.selId != null) this.select(this.selId);
    this.syncChain();
    if (this.chainG) { this.arrowTex.offset.x -= dt * 1.3; const k = 1 + Math.sin(this.time * 4) * 0.06; for (const r of this.chainRings) r.scale.setScalar(r.userData.s * k); }
    if (this.eternalFlame) this.eternalFlame.visible = S.eternal.stage >= ETERNAL_STAGES.length;
    this.animSky(dt);
    this.dayNight(rdt);
    // 手机：阴影图隔一帧画一次（影子慢 1/60 秒看不出来，省掉大约三分之一的绘制）
    { const sm = this.renderer.shadowMap;
      if (this.lowEnd && sm.enabled) { sm.autoUpdate = false; this.shF = (this.shF || 0) + 1; if (this.shF % 2 === 0 || !this.sun.shadow.map) sm.needsUpdate = true; }
      else sm.autoUpdate = true; }
    this.renderer.render(this.scene, this.camera);
    // 拍照：画完这一帧马上取像素（不用一直保留绘图缓冲）
    if (this.shotCb) { const cb = this.shotCb; this.shotCb = null; cb(this.renderer.domElement); }
  }

  // 冰湖开裂：镜头附近的冰面上裂出一道道黑水沟、冒出几块水面（开裂时慢慢显出来，过后慢慢冻上）
  syncCracks() {
    const inMapXY = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    const k = this.wxk ? this.wxk.crack : 0;
    if (k < 0.01) { if (this.cracks) this.cracks.visible = this.crackWater.visible = false; return; }
    const S = this.S, w = getWorld(S.runSeed);
    if (!this.cracks) {
      const mat = (c) => new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); // 受光照：夜里水面不会自己发亮
      this.cracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat('#16303f'), 2400);
      this.crackWater = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), mat('#2a5870'), 500);
      for (const m of [this.cracks, this.crackWater]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 1; this.scene.add(m); }
    }
    const key = Math.round(this.cam.tx / 8) + ',' + Math.round(this.cam.ty / 8);
    if (key !== this.crackKey) {
      this.crackKey = key;
      const m = this._m, q = this._q, v = this._v, sc = this._s, e = this._e, cx = Math.round(this.cam.tx), cy = Math.round(this.cam.ty);
      let n = 0, nw = 0;
      for (let y = Math.max(0, cy - 34); y < Math.min(H, cy + 34); y++) for (let x = Math.max(0, cx - 34); x < Math.min(W, cx + 34); x++) {
        const i = idx(x, y);
        if (w.terrain[i] !== T_ICE || !S.reveal[i]) continue;
        const r = hash3(x, y, 515);
        // 湖岸那一圈不画，免得裂缝伸到雪地上
        const inner = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => inMapXY(x + dx, y + dy) && w.terrain[idx(x + dx, y + dy)] === T_ICE);
        if (inner && r < 0.6 && n < 2390) {
          // 一道折线裂缝：三段，每段拐一点
          let px = x + 0.3 + hash3(x, y, 516) * 0.4, py = y + 0.3 + hash3(x, y, 517) * 0.4, a = hash3(x, y, 518) * Math.PI;
          const L = 0.5 + hash3(x, y, 519) * 0.5, wd = 0.06 + hash3(x, y, 520) * 0.06;
          for (let sgm = 0; sgm < 3; sgm++) {
            const l = L / 3 * (0.8 + hash3(x + sgm, y, 521) * 0.4), mx = px + Math.cos(a) * l / 2, my = py + Math.sin(a) * l / 2;
            m.compose(v.set(mx, 0.075, -my), q.setFromEuler(e.set(0, a, 0)), sc.set(l + wd, 1, wd * (1 - sgm * 0.25)));
            this.cracks.setMatrixAt(n++, m);
            px += Math.cos(a) * l; py += Math.sin(a) * l; a += (hash3(x, y, 522 + sgm) - 0.5) * 1.1;
          }
        }
        if (inner && r > 0.8 && nw < 500) {
          m.compose(v.set(x + 0.5, 0.07, -(y + 0.5)), q.setFromEuler(e.set(0, hash3(x, y, 530) * Math.PI, 0)), sc.set(0.6 + hash3(x, y, 531) * 0.6, 1, 0.3 + hash3(x, y, 532) * 0.3));
          this.crackWater.setMatrixAt(nw++, m);
        }
      }
      this.cracks.count = n; this.crackWater.count = nw;
      this.cracks.instanceMatrix.needsUpdate = true; this.crackWater.instanceMatrix.needsUpdate = true;
    }
    this.cracks.visible = this.crackWater.visible = true;
    this.cracks.material.opacity = k * 0.9; this.crackWater.material.opacity = k * 0.85;
  }

  animBuildings(dt) {
    for (const [, e] of this.buildings) {
      if (e.cons > 0) {
        // 施工 2.4 秒：房子升起，最后脚手架收掉
        e.cons = Math.max(0, e.cons - dt / 2.4);
        const k = 1 - e.cons, rise = Math.min(1, k / 0.8);
        e.g.scale.set(1, Math.max(0.02, 1 - Math.pow(1 - rise, 2.2)), 1);
        if (e.scaf) {
          const out = Math.max(0, (k - 0.8) / 0.2);
          e.scaf.scale.set(1, 1 - out * 0.98, 1);
          if (e.cons === 0) { this.bldGroup.remove(e.scaf); e.scaf = null; this.burst('dust', e.g.position.x, -e.g.position.z, 14, 0.8); }
        }
      }
      if (e.up > 0) { e.up = Math.max(0, e.up - dt * 1.6); const s = 1 + Math.sin((1 - e.up) * Math.PI) * 0.08; e.g.scale.set(s, s, s); }
      if (e.fl) {
        // 火焰随燃料多少变化，并轻轻跳动
        // 超载时火苗蹿高、跳得更急，还往外冒火星；停炉时只剩一点余烬
        const cr = Sim.rt(this.S).c[e.camp], od = cr && cr.od ? 1 : 0, t = this.time + e.ph * (1 + od);
        let f = cr ? 0.35 + 0.65 * cr.fueled : 1;
        if (cr && cr.stall) f = 0.35;
        e.odK = (e.odK || 0) + (od - (e.odK || 0)) * Math.min(1, dt * 2);
        const fy = f * (1 + e.odK * 0.55), fw = f * (1 + e.odK * 0.18), j = 1 + e.odK;
        e.fl.scale.set(fw * (1 + Math.sin(t * 9 * j) * 0.04), fy * (1 + Math.sin(t * 6.3 * j) * 0.09 + Math.sin(t * 15.7) * 0.04), fw * (1 + Math.cos(t * 8.1 * j) * 0.04));
        if (e.odK > 0.5 && Math.random() < dt * 6) this.burst('spark', e.g.position.x, -e.g.position.z, 2, 0.5, e.fl.position.y + 0.6);
        e.fl.rotation.y = Math.sin(t * 0.7) * 0.25;
      }
    }
    // 熔炉的光：离镜头最近的 4 个营地
    const S = this.S, c = this.cam;
    const camps = S.camps.slice().sort((a, b) => Math.hypot(a.x - c.tx, a.y - c.ty) - Math.hypot(b.x - c.tx, b.y - c.ty)).slice(0, 4);
    this.lights.forEach((l, i) => {
      const cp = camps[i];
      if (!cp) { l.intensity = 0; return; }
      const cr = Sim.rt(S).c[cp.id];
      const f = cr ? (cr.stall ? 0 : cr.fueled) : 1, od = cr && cr.od ? 1.45 : 1;
      l.position.set(cp.x, 3.2, -cp.y);
      l.intensity = (9 + Math.sin(this.time * 7 + i) * 0.8 + Math.sin(this.time * 13) * 0.4) * (0.3 + 0.7 * f) * (1 + this.nf * 1.4) * od;
      l.distance = furnaceRadius(Sim.getB(S, cp.furnace).lvl) * (1.3 + this.nf * 0.5);
    });
  }

  // 显示的人数加一点迟滞：算出来的人数在 7.4~7.6 之间来回跳时，画面上不会一会儿 7 个一会儿 8 个
  steady(key, v) {
    const m = this._steady || (this._steady = new Map());
    let cur = m.get(key);
    if (cur == null || Math.abs(v - cur) > 0.75) { cur = Math.round(v); m.set(key, cur); }
    return cur;
  }
  // 熔炉旁烤火的固定座位：按黄金角一圈圈排开，避开建筑、树和石头；建筑变了才重算
  idleSlots(c) {
    const C = this._idleSlots || (this._idleSlots = new Map()), key = this.bldSig + ':' + this.spotGen + ':' + (this.beltSig || '').length;
    const hit = C.get(c.id);
    if (hit && hit.key === key) return hit.slots;
    const rects = this.bRects || [], slots = [];
    const inB = (x, y) => rects.some(q => x > q[0] - 0.15 && x < q[2] + 0.15 && y > q[1] + 0.2 && y < q[3] + 0.15);
    for (let k = 0; k < 140 && slots.length < 16; k++) {
      const a = k * 2.39996 + c.id * 0.7, r = 2.45 + (k % 4) * 0.32 + Math.floor(k / 24) * 0.55;
      const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (inB(x, y) || this.blocked(x, y, 0.14)) continue;
      if (slots.some(p => Math.hypot(p[0] - x, p[1] - y) < 0.36)) continue;
      slots.push([x, y, a]);
    }
    C.set(c.id, { key, slots });
    return slots;
  }
  // ---------- 细节层级与动作 ----------
  // 会动的小人和动物：换上带动作的材质；小人另备一套拉近时用的精细模型
  initAnim() {
    const ma = this.matAnim = M.animMat(), md = this.matAnimD = M.animDepthMat();
    for (const im of [this.figs, this.figsD, this.dogs, this.wolves]) { im.material = ma; im.customDepthMaterial = md; }
    this.figLod = { lo: [this.figs.geometry, this.figsD.geometry], hi: [M.figureGeo(true), M.figureDetailGeo(true)] };
    M.animInst(this.figs, [...this.figLod.lo, ...this.figLod.hi]); this.figsD.userData.anim = this.figs.userData.anim;
    M.animInst(this.dogs); M.animInst(this.wolves);
    this.torches.geometry = M.torchFlameSmallGeo();
  }
  // 镜头拉近（< 35）换上精细模型，拉远换回简单的；建筑、资源点变了也重新挑一遍
  lodSync() {
    const d = this.cam.dist, hi = this.lodHi = this.lodHi ? d < 36.5 : d < 33.5;
    const sig = hi + ':' + this.bldSig + ':' + this.spotGen + ':' + (this.remGen || 0);
    if (sig === this._lodSig) return;
    this._lodSig = sig;
    const pick = g => (g && g.userData && (hi ? g.userData.hi : g.userData.lo)) || g;
    for (const grp of this.bldGroup.children) for (const o of grp.children) {
      if (o.userData.mover) o.visible = hi;
      else if (o.isMesh) o.geometry = pick(o.geometry);
    }
    for (const k in this.spotMeshes || {}) this.spotMeshes[k].geometry = pick(this.spotMeshes[k].geometry);
    for (const k in this.remnants || {}) this.remnants[k].geometry = pick(this.remnants[k].geometry);
    for (const k in this.decor || {}) { const im = this.decor[k]; im.geometry = pick(im.geometry); if (M.DECOR_NEAR.has(k)) im.visible = hi; }
    const F = this.figLod[hi ? 'hi' : 'lo']; this.figs.geometry = F[0]; this.figsD.geometry = F[1];
    this.addMovers();
  }
  // 建筑上会转的部件（锯片、天轮、飞轮、齿轮、矿车）：精细模型里单独拿出来，干活时转起来
  addMovers() {
    for (const grp of this.bldGroup.children) {
      const bid = grp.userData.bid; if (bid == null || grp.userData.mv) continue;
      const b = Sim.getB(this.S, bid); if (!b) continue;
      const G0 = this.bgeo(b.type, b.lvl, !!b.deep), L = G0.movers || [];
      grp.userData.mv = L.map(mv => {
        const o = new THREE.Mesh(mv.geo, this.matStd); o.castShadow = true; o.userData.mover = mv; o.visible = !!this.lodHi;
        o.position.set(...mv.pos); grp.add(o); return o;
      });
    }
  }
  animMovers(dt) {
    if (!this.lodHi) return;
    const R = Sim.rt(this.S), t = this.time;
    for (const grp of this.bldGroup.children) {
      const L = grp.userData.mv; if (!L || !L.length) continue;
      const br = R.b[grp.userData.bid], run = br && (br.act || 0) > 0.05;
      for (const o of L) {
        const mv = o.userData.mover;
        o.userData.k = (o.userData.k || 0) + ((run || mv.always ? 1 : 0) - (o.userData.k || 0)) * Math.min(1, dt * 1.5); // 停下来时慢慢停
        const k = o.userData.k;
        if (mv.kind === 'spin') { o.userData.a = (o.userData.a || 0) + dt * mv.speed * k; o.rotation[mv.axis] = o.userData.a; }
        else if (mv.kind === 'slide') { o.userData.a = (o.userData.a || 0) + dt * mv.speed * k; const f = 0.5 - 0.5 * Math.cos(o.userData.a); o.position.set(mv.pos[0] + mv.d[0] * f, mv.pos[1] + mv.d[1] * f, mv.pos[2] + mv.d[2] * f); }
        else if (mv.kind === 'bob') o.position.y = mv.pos[1] + Math.sin(t * mv.speed) * mv.amp * k;
      }
    }
  }
  // 小人在做什么：返回 [动作, 工具]（见 models.js 里 aAnim 的说明）
  figAct(info, bob) {
    const k = info && info.k;
    if (k === 'w') { if (!bob) return [0, 0]; const b = Sim.getB(this.S, info.b), tl = b ? M.toolOf(b.type) : 0; return tl ? [3, tl] : [0, 0]; }
    if (k === 'h') return [2, 0];
    if (k === 'g') return [5, 5];
    if (k === 's') return info.i === 0 ? [5, 5] : [1, 0];
    if (k === 'fd') return [6, 0];
    if (k === 'kid' || k === 'fm') return [bob ? (k === 'kid' && info.i % 2 === 0 ? 1 : 3) : 0, 0];
    if (k === 'q') return [4, 0];
    if (k === 'f') return [info.i % 3 === 0 ? 4 : 0, 0];
    if (k === 'r') return [Math.sin(this.time * 0.9 + info.i) > 0.55 ? 7 : 0, 0];
    return [bob ? 1 : 0, 0];
  }
  // 举火把的人：火苗在哪（地图 x、高度、地图 y）
  figTip(x, y, ang, bob, k = 1) {
    const [lx, ly, lz] = M.FIG_TORCH, c = Math.cos(ang), s = Math.sin(ang);
    return [x + (c * lx + s * lz) * k, (ly + Math.abs(Math.sin(bob)) * 0.06) * k, y - (-s * lx + c * lz) * k];
  }
  animPeople(dt) {
    const S = this.S, R = Sim.rt(S), t = this.time;
    const figs = this.figs, crates = this.crates;
    let nf = 0, nc = 0;
    const m = this._m, q = this._q, v = this._v, sc = this._s, e = this._e;
    const MAXF = 1400, MAXC = 1000;
    const figPts = this.figPts = [];
    const lampOn = this.nf > 0.03, LP = this.lampPos;
    let nl = 0;
    if (lampOn && this.decoLP) { const D = this.decoLP; for (let i = 0; i < D.length && nl < 500; i += 3, nl++) { LP[nl * 3] = D[i]; LP[nl * 3 + 1] = D[i + 1]; LP[nl * 3 + 2] = D[i + 2]; } }
    const putLamp = (x, y, ang) => { if (!lampOn || nl >= 500) return; LP[nl * 3] = x + Math.cos(ang) * 0.13; LP[nl * 3 + 1] = 0.5; LP[nl * 3 + 2] = -(y - Math.sin(ang) * 0.13); nl++; };
    const figInfo = this.figInfo = [];
    this.reqPts = [];
    const mF = this._mF || (this._mF = new THREE.Matrix4()), fr = this._fr || (this._fr = new THREE.Frustum()), fs = this._fs || (this._fs = new THREE.Sphere(new THREE.Vector3(), 1.4));
    this.camera.updateMatrixWorld(); fr.setFromProjectionMatrix(mF.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    const putFig = (x, y, ang, col, bob = 0, info = null, k = 1, lift = 0) => {
      this._figOn = false;
      if (nf >= MAXF) return;
      figInfo.push(info);
      figPts.push(x, y);
      fs.center.set(x, 0.4, -y); if (!fr.intersectsSphere(fs)) return; // 镜头外的人只记位置（点选、鹿躲人要用），不画
      const [mode, tool] = this.figAct(info, bob);
      e.set(0, ang, 0); q.setFromEuler(e);
      m.compose(v.set(x, Math.abs(Math.sin(bob)) * (mode === 3 ? 0.012 : 0.06) * k + lift, -y), q, sc.set(k, k, k));
      figs.setMatrixAt(nf, m); figs.setColorAt(nf, col); this.figsD.setMatrixAt(nf, m);
      M.setAnim(figs, nf, bob || t * 1.3 + nf * 2.1, mode, tool);
      mF.copy(m); this._figOn = true; nf++;
    };
    // 雪橇犬：毛色按编号挑一种（灰白、棕、黑），跑起来上下颠
    let nd = 0;
    const DOGC = [new THREE.Color(1, 1, 1), new THREE.Color('#d8b088'), new THREE.Color('#8a8a8a'), new THREE.Color('#f0e0c8')];
    const putDog = (x, y, ang, bob, i, lie = false) => {
      if (nd >= 200) return;
      e.set(0, ang, 0); q.setFromEuler(e);
      m.compose(v.set(x, lie ? -0.05 : Math.abs(Math.sin(bob)) * 0.06, -y), q, sc.set(1.25, lie ? 0.7 : 1.25, 1.25));
      this.dogs.setMatrixAt(nd, m); this.dogs.setColorAt(nd, DOGC[i % DOGC.length]); M.setAnim(this.dogs, nd, bob, 10, lie || !bob ? 0 : 0.65); nd++;
    };
    const putCrate = (x, y, col) => {
      if (nc >= MAXC || !this._figOn) return;
      // 抱在胸前，两只手托着：跟着刚摆好的那个搬运工转身、上下颠
      m.compose(v.set(M.FIG_CARRY[0], M.FIG_CARRY[1], M.FIG_CARRY[2]), q.identity(), sc.set(0.82, 0.82, 0.82)).premultiply(mF);
      crates.setMatrixAt(nc, m); crates.setColorAt(nc, col); nc++;
    };
    const cx = this.cam.tx, cy = this.cam.ty, near = 30 + this.cam.dist;
    const storages = new Map();
    for (const b of S.buildings) if (b.type === 'furnace' || b.type === 'warehouse') {
      const s = BLD[b.type].size;
      (storages.get(b.camp) || storages.set(b.camp, []).get(b.camp)).push({ x: b.x + s / 2, y: b.y - 0.3 });
    }
    for (const b of S.buildings) {
      const s = BLD[b.type].size;
      const bx = b.x + s / 2, by = b.y + s / 2;
      if (Math.abs(bx - cx) > near || Math.abs(by - cy) > near) continue;
      const br = R.b[b.id] || {};
      const act = br.act || 0;
      // 生产工：在建筑前面干活
      // 每个岗位有固定站位，人数变了别人不会跟着挪
      const nw = Math.min(b.workers, 4);
      for (let i = 0; i < nw; i++) {
        const a = hash3(b.id, i, 1) * 6.28;
        const wob = act > 0.05 ? Math.sin(t * 0.6 + i * 2) * 0.25 : 0;
        const x = bx + Math.cos(a) * 0.12 + WSLOT[i] + wob, y = b.y - 0.35 - (i % 2) * 0.2;
        putFig(x, y, Math.sin(t + i) * 0.5, COATS[(b.id + i) % COATS.length], act > 0.05 ? t * 9 + i : 0, { k: 'w', b: b.id, i, camp: b.camp });
      }
      // 搬运工：在仓储点和建筑之间来回
      const haul = br.haul || 0;
      if (haul > 0.03) {
        const st = storages.get(b.camp) || [];
        let best = null, bd = 1e9;
        for (const p of st) { const d = Math.hypot(p.x - bx, p.y - (b.y - 0.3)); if (d < bd) { bd = d; best = p; } }
        if (!best || bd < 0.5) continue;
        const d = BLD[b.type];
        const outK = d.out ? Object.keys(d.out)[0] : null, inK = d.in ? Object.keys(d.in)[0] : null;
        const n = this.steady('h' + b.id, Math.max(1, Math.min(6, haul * 1.2)));
        const rt = this.routes && this.routes.get(b.id);
        const pts = rt ? rt.pts : [[best.x, best.y], [bx, b.y - 0.3]], cum = rt ? rt.cum : [0, bd], L = rt ? rt.len : bd, spd = 1.6;
        for (let i = 0; i < n; i++) {
          const ph = ((t * spd / L) * 0.5 + i * 0.618 + hash3(b.id, 0, 3)) % 1; // 黄金比例错开：人数变了，已有的人位置不变
          const go = ph < 0.5; // 去建筑（带原料）还是回仓库（带产出）
          const dist = (go ? ph * 2 : 2 - ph * 2) * L;
          let sg = 1; while (sg < cum.length - 1 && cum[sg] < dist) sg++;
          const p0 = pts[sg - 1], p1 = pts[sg], segL = Math.max(1e-6, cum[sg] - cum[sg - 1]), kk = Math.min(1, Math.max(0, (dist - cum[sg - 1]) / segL));
          const ux = (p1[0] - p0[0]) / segL, uy = (p1[1] - p0[1]) / segL;
          const off = (i % 2 ? 0.14 : -0.14);
          const x = p0[0] + (p1[0] - p0[0]) * kk + uy * off, y = p0[1] + (p1[1] - p0[1]) * kk - ux * off;
          const ang = go ? Math.atan2(-ux, uy) : Math.atan2(ux, -uy); // 朝着走的方向（模型正面是 -z）
          putFig(x, y, ang, COATS[(i * 3 + 1) % COATS.length], t * 10 + i, { k: 'h', b: b.id, i, camp: b.camp, res: go ? inK : outK, go });
          if (i % 2 === 0) putLamp(x, y, ang);
          const rk = go ? inK : outK;
          if (rk) putCrate(x, y, RESCOL[rk]);
        }
      }
    }
    // 空闲的人在熔炉旁烤火、拾柴
    for (const c of S.camps) {
      if (Math.abs(c.x - cx) > near || Math.abs(c.y - cy) > near) continue;
      const cr = R.c[c.id];
      const idle = this.steady('f' + c.id, Math.min(16, cr ? cr.forage || 0 : 0));
      const slots = this.idleSlots(c);
      // 提委托的人占用最外面的几个站位，朝着镜头这边
      const rq = (S.reqs || []).filter(r => r.camp === c.id).slice(0, 2);
      rq.forEach((r, k) => {
        const sl = slots[slots.length - 1 - k]; if (!sl) return;
        putFig(sl[0], sl[1], Math.PI + Math.sin(t * 1.3 + k) * 0.4, COATS[(r.id * 3) % COATS.length], 0, { k: 'r', i: r.id, camp: c.id });
        this.reqPts.push({ id: r.id, x: sl[0], y: sl[1] });
      });
      for (let i = 0; i < Math.min(idle, slots.length - rq.length); i++) {
        const [x, y, a] = slots[i];
        putFig(x, y, Math.atan2(-Math.cos(a), Math.sin(a)) + Math.PI, COATS[(i + c.id) % COATS.length], 0, { k: 'f', i, camp: c.id });
      }
    }
    // 营地生活：窝棚里等床位的人、白天玩雪的孩子、夜里打着火把巡逻的守夜人
    let nt = 0;
    const night = this.nf > 0.45;
    for (const c of S.camps) {
      if (Math.abs(c.x - cx) > near || Math.abs(c.y - cy) > near) continue;
      const L = this.lifeSpots(c);
      if ((c.wait || 0) > 0 && L.shanty) {
        const [sx, sy, sa] = L.shanty, n = Math.min(8, c.wait);
        // 火堆在棚子朝营地的一侧（模型里 z=+0.62），人围着火坐
        const fx = sx - Math.cos(sa) * 0.62, fy = sy - Math.sin(sa) * 0.62;
        for (let i = 0; i < n; i++) {
          const a = sa + Math.PI + (i - (n - 1) / 2) * 0.62 + (i >= 5 ? Math.PI : 0), r = i >= 5 ? 0.62 : 0.5;
          const x = fx + Math.cos(a) * r, y = fy + Math.sin(a) * r;
          putFig(x, y, Math.atan2(fx - x, y - fy) + Math.PI, COATS[(i * 5 + c.id) % COATS.length], 0, { k: 'q', i, camp: c.id }, 0.95);
        }
      }
      if (!night && c.people >= 30 && L.play) {
        const [px, py] = L.play, n = Math.min(6, Math.floor(c.people / 30));
        for (let i = 0; i < n; i++) {
          // 一半绕着雪人追着跑，一半在旁边扔雪球
          let x, y, ang, bob;
          if (i % 2 === 0) { const a = t * 1.1 + i * 2.2 + c.id; x = px + Math.cos(a) * 0.62; y = py + Math.sin(a) * 0.62; ang = a; bob = t * 11 + i; } // 绕着雪人跑，脸朝前
          else { const a = i * 1.7 + c.id; x = px + Math.cos(a) * 1.05; y = py + Math.sin(a) * 1.05; ang = Math.atan2(px - x, y - py) + Math.PI; bob = Math.sin(t * 3 + i) > 0.7 ? t * 8 : 0; }
          putFig(x, y, ang, COATS[(i * 3 + 2) % COATS.length], bob, { k: 'kid', i, camp: c.id }, 0.62);
        }
      }
      if (c.fest && L.fest) {
        // 庆典：一圈人手拉手绕着篝火跳，鼓手、拉琴的和看热闹的站在外圈
        const [fx, fy, , FR] = L.fest, nd = Math.max(8, Math.min(FR > 2 ? 18 : FR > 1.7 ? 12 : 10, Math.floor(c.people / 5))), rd = FR * 0.5;
        for (let i = 0; i < nd; i++) {
          const a = t * 0.55 + i / nd * Math.PI * 2, x = fx + Math.cos(a) * rd, y = fy + Math.sin(a) * rd;
          const ang = Math.atan2(-Math.sin(a), -Math.cos(a)) - Math.PI / 2;
          putFig(x, y, ang, COATS[(i * 7 + c.id) % COATS.length], t * 9 + i * 1.3, { k: 'fd', i, camp: c.id }, 1, Math.max(0, Math.sin(t * 4.5 + i * 0.8)) * 0.07);
        }
        const out = (la, r) => [fx + Math.cos(la) * r, fy - Math.sin(la) * r]; // 模型里的角度换成地图坐标（模型 z 朝南）
        const stand = (la, r, i, bob) => { const [x, y] = out(la, r); putFig(x, y, Math.atan2(fx - x, y - fy) + Math.PI, COATS[(i * 5 + 3 + c.id) % COATS.length], bob, { k: 'fm', i, camp: c.id }); };
        stand(1.03 + 0.2, FR - 0.05, 0, Math.sin(t * 7.5) > 0 ? t * 15 : 0); // 鼓手站在鼓边上
        if (FR > 2) stand(1.6, FR - 0.25, 1, t * 5); // 拉琴的
        for (let i = 0; i < (FR > 2 ? 5 : 3); i++) stand(4.2 + (i - 1) * 0.2 + (i > 2 ? 0.75 : 0), FR - 0.02, 2 + i, Math.sin(t * 2 + i) > 0.6 ? t * 8 : 0); // 长凳后面看热闹的
        if (lampOn && nl < 500) { LP[nl * 3] = fx; LP[nl * 3 + 1] = 0.75; LP[nl * 3 + 2] = -fy; nl++; }
      }
      // 犬舍院子里：喂饱的在院子里追着跑，其余的趴在狗屋门口
      const dogsC = Sim.dogsOf(S, c.id);
      for (const b of S.buildings) {
        if (b.camp !== c.id || b.type !== 'kennel') continue;
        const bx = b.x + 1, by = b.y + 1, br = R.b[b.id] || {}, run = Math.min(3, Math.round(br.dogs || 0)), all = run + Math.min(3, Sim.kennelDogs(b.lvl) - run);
        for (let i = 0; i < all; i++) {
          if (i < run) {
            const a = t * 1.7 + i / Math.max(1, run) * Math.PI * 2 + b.id, lx = -0.1 + Math.cos(a) * 0.48, lz = 0.42 + Math.sin(a) * 0.24;
            // 地图坐标：x 同向，y = 中心 − 模型 z；朝着切线方向跑
            const tx = -Math.sin(a) * 0.48, tz = Math.cos(a) * 0.24;
            putDog(bx + lx, by - lz, Math.atan2(tx, -(-tz)) + Math.PI, t * 14 + i, i + b.id);
          } else putDog(bx - 0.6 + ((i - run) % 3) * 0.6, by + 0.27, Math.PI, 0, i + b.id, true);
        }
      }
      // 营地里跑来跑去的狗：沿着巡逻那一圈撒欢
      if (dogsC >= 4 && L.patrol && L.patrol.len > 4) {
        const { pts: P, cum, len } = L.patrol, nr = Math.min(3, Math.floor(dogsC / 4));
        for (let i = 0; i < nr; i++) {
          const dist = ((t * 1.25 + i * len / nr + c.id * 5.3) % len + len) % len;
          let sg = 1; while (sg < cum.length - 1 && cum[sg] < dist) sg++;
          const p0 = P[sg - 1], p1 = P[sg], f = Math.min(1, Math.max(0, (dist - cum[sg - 1]) / Math.max(1e-6, cum[sg] - cum[sg - 1])));
          putDog(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f, Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1])) + Math.PI, t * 15 + i, i * 3 + c.id);
        }
      }
      if (night && !c.fest && L.patrol && L.patrol.len > 4) {
        const towers = S.buildings.filter(b => b.camp === c.id && b.type === 'tower').length;
        const ng = Math.min(4, 2 + Math.floor(towers / 2)), { pts: P, cum, len } = L.patrol;
        for (let i = 0; i < ng; i++) {
          const dist = ((t * 0.45 + i * len / ng + c.id * 3.1) % len + len) % len;
          let sg = 1; while (sg < cum.length - 1 && cum[sg] < dist) sg++;
          const p0 = P[sg - 1], p1 = P[sg], f = Math.min(1, Math.max(0, (dist - cum[sg - 1]) / Math.max(1e-6, cum[sg] - cum[sg - 1])));
          const x = p0[0] + (p1[0] - p0[0]) * f, y = p0[1] + (p1[1] - p0[1]) * f;
          const ang = Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1])) + Math.PI;
          putFig(x, y, ang, COATS[5], t * 7 + i, { k: 'g', i, camp: c.id });
          if (nt < 60 && this._figOn) { const [tx2, th2, ty2] = this.figTip(x, y, ang, t * 7 + i); m.compose(v.set(tx2, th2, -ty2), q.identity(), sc.set(1, 1, 1)); this.torches.setMatrixAt(nt++, m); if (lampOn && nl < 500) { LP[nl * 3] = tx2; LP[nl * 3 + 1] = th2; LP[nl * 3 + 2] = -ty2; nl++; } }
        }
      }
    }
    // 侦察队
    for (const sc0 of S.scouts) {
      if (Sim.dogsOf(S, sc0.camp) >= 2 && sc0.phase !== 'wait') {
        // 两只狗跑在队伍前头
        const tx = sc0.phase === 'out' ? sc0.tx + 0.5 : Sim.getCamp(S, sc0.camp).x, ty = sc0.phase === 'out' ? sc0.ty + 0.5 : Sim.getCamp(S, sc0.camp).y;
        const dx = tx - sc0.x, dy = ty - sc0.y, dd = Math.hypot(dx, dy) || 1, ux = dx / dd, uy = dy / dd, ang = Math.atan2(dx, -dy) + Math.PI;
        for (let j = 0; j < 2; j++) putDog(sc0.x + ux * 0.55 + (j ? 1 : -1) * uy * 0.12, sc0.y + uy * 0.55 - (j ? 1 : -1) * ux * 0.12, ang, t * 15 + j, j + 1);
      }
      for (let i = 0; i < sc0.n; i++) {
        const x = sc0.x + (i - 1) * 0.3, y = sc0.y - (i % 2) * 0.3;
        const tx = sc0.phase === 'out' ? sc0.tx : Sim.getCamp(S, sc0.camp).x, ty = sc0.phase === 'out' ? sc0.ty : Sim.getCamp(S, sc0.camp).y;
        const sa = Math.atan2(tx - sc0.x, sc0.y - ty) + Math.PI;
        putFig(x, y, sa, COATS[sc0.kind === 'rescue' ? 0 : sc0.kind === 'survey' ? 2 : 5], t * 10 + i, { k: 's', i, camp: sc0.camp, sid: sc0.id ?? S.scouts.indexOf(sc0), rescue: sc0.kind === 'rescue' });
        if (i === 0 && nt < 60 && this._figOn) { const [tx2, th2, ty2] = this.figTip(x, y, sa, t * 10 + i); m.compose(v.set(tx2, th2, -ty2), q.identity(), sc.set(1, 1, 1)); this.torches.setMatrixAt(nt++, m); if (lampOn && nl < 500) { LP[nl * 3] = tx2; LP[nl * 3 + 1] = th2; LP[nl * 3 + 2] = -ty2; nl++; } }
      }
    }
    this.torches.count = nt; this.torches.instanceMatrix.needsUpdate = true;
    this.lamps.geometry.setDrawRange(0, nl); if (nl) this.lamps.geometry.attributes.position.needsUpdate = true;
    // 运输线上的雪橇/火车
    let ns = 0, ntr = 0;
    for (const l of S.lines) {
      const a = Sim.getCamp(S, l.a), b = Sim.getCamp(S, l.b);
      const flow = (R.b['L' + l.id] || {}).flow || 0;
      if (!flow && !l.routes.length) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const nv = l.rail ? 1 : Math.min(3, 1 + l.lvl), dl = Sim.dogLine(S, l);
      for (let i = 0; i < nv; i++) {
        const ph = ((t * (l.rail ? 3 : 1.4) * (1 + dl) / d) * 0.5 + i / nv) % 1;
        const k = ph < 0.5 ? ph * 2 : 2 - ph * 2;
        const x = a.x + (b.x - a.x) * (0.08 + k * 0.84), y = a.y + (b.y - a.y) * (0.08 + k * 0.84);
        const ang = Math.atan2(b.x - a.x, -(b.y - a.y)) + (ph < 0.5 ? Math.PI : 0);
        e.set(0, ang, 0); q.setFromEuler(e);
        m.compose(v.set(x, 0, -y), q, sc.set(1, 1, 1));
        if (l.rail) { if (ntr < 40) this.trains.setMatrixAt(ntr++, m); }
        else if (ns < 40) {
          this.sleds.setMatrixAt(ns++, m);
          if (dl > 0) { // 狗拉雪橇：两对狗跑在雪橇前面
            const dir = ph < 0.5 ? 1 : -1, ux = (b.x - a.x) / d * dir, uy = (b.y - a.y) / d * dir;
            for (let j = 0; j < 4; j++) { const f = 0.6 + Math.floor(j / 2) * 0.3, sd = (j % 2 ? 1 : -1) * 0.1; putDog(x + ux * f + uy * sd, y + uy * f - ux * sd, ang, t * 16 + j, j + i); }
          }
        }
      }
    }
    this.sleds.count = ns; this.sleds.instanceMatrix.needsUpdate = true;
    this.dogs.count = nd; this.dogs.instanceMatrix.needsUpdate = true; if (nd) this.dogs.instanceColor.needsUpdate = true;
    this.trains.count = ntr; this.trains.instanceMatrix.needsUpdate = true;
    this._nf = nf; this._nc = nc;
    figs.count = nf; figs.instanceMatrix.needsUpdate = true; this.figsD.count = nf; this.figsD.instanceMatrix.needsUpdate = true; if (figs.instanceColor) figs.instanceColor.needsUpdate = true;
    crates.count = nc; crates.instanceMatrix.needsUpdate = true; if (crates.instanceColor) crates.instanceColor.needsUpdate = true;
  }

  // 鹿群：吃草、慢慢挪位置，人走近就跑开；不会走进建筑、树和石头
  animDeer(dt) {
    const D = this.deer, body = this.spotMeshes && this.spotMeshes.herd, head = this.deerHead;
    if (!D || !body) return;
    dt = Math.min(dt, 0.1);
    // 小人位置按格子分桶
    const grid = new Map(), P = this.figPts || [];
    for (let k = 0; k < P.length; k += 2) { const key = Math.floor(P[k]) + Math.floor(P[k + 1]) * W; let L = grid.get(key); if (!L) grid.set(key, L = []); L.push(P[k], P[k + 1]); }
    for (const r of this.raids) for (const wf of r.wolves) if (wf.x != null && !wf.dead) { const key = Math.floor(wf.x) + Math.floor(wf.y) * W; let L = grid.get(key); if (!L) grid.set(key, L = []); L.push(wf.x, wf.y); }
    const rects = this.bRects || [];
    const free = (d, x, y) => {
      if (x < 0.2 || y < 0.2 || x > W - 0.2 || y > H - 0.2) return false;
      const r = 0.3 * d.s;
      for (const q of rects) { const nx = Math.max(q[0], Math.min(x, q[2])), ny = Math.max(q[1], Math.min(y, q[3])); if (Math.hypot(x - nx, y - ny) < r) return false; }
      if (this.blocked(x, y, r * 0.9)) return false;
      for (const o of D) if (o !== d && (Math.hypot(o.x - x, o.y - y) < 0.42 || (o.st !== 'graze' && Math.hypot(o.tx - x, o.ty - y) < 0.42))) return false;
      return true;
    };
    const m = this._m, m2 = this._m2 || (this._m2 = new THREE.Matrix4()), q = this._q, v = this._v, sc = this._s, e = this._e;
    const NK = M.DEER_NECK;
    let n = 0;
    for (const d of D) {
      d.t -= dt;
      // 附近有人或狼：往反方向跑
      let ax = 0, ay = 0, threat = false;
      const tx0 = Math.floor(d.x), ty0 = Math.floor(d.y);
      for (let yy = ty0 - 1; yy <= ty0 + 1; yy++) for (let xx = tx0 - 1; xx <= tx0 + 1; xx++) {
        const L = grid.get(xx + yy * W); if (!L) continue;
        for (let k = 0; k < L.length; k += 2) { const dx = d.x - L[k], dy = d.y - L[k + 1], dd = Math.hypot(dx, dy); if (dd < 1.3) { threat = true; ax += dx / (dd + 0.05); ay += dy / (dd + 0.05); } }
      }
      d.cool = (d.cool || 0) - dt;
      if (threat && d.st !== 'flee' && d.cool <= 0) {
        d.cool = 4;
        const base = Math.atan2(ay, ax);
        for (const da of [0, 0.7, -0.7, 1.4, -1.4]) {
          const tx = d.x + Math.cos(base + da) * 1.1, ty = d.y + Math.sin(base + da) * 1.1;
          if (Math.hypot(tx - d.hx, ty - d.hy) < 1.6 && free(d, tx, ty)) { d.tx = tx; d.ty = ty; d.st = 'flee'; d.t = 3; break; }
        }
      }
      if (d.st === 'graze' && d.t <= 0) {
        d.t = 2 + Math.random() * 5;
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * 6.28, r = 0.15 + Math.random() * 0.45;
          const tx = d.hx + Math.cos(a) * r, ty = d.hy + Math.sin(a) * r;
          if (free(d, tx, ty)) { d.tx = tx; d.ty = ty; d.st = 'walk'; break; }
        }
      }
      let moving = false;
      if (d.st !== 'graze') {
        const dx = d.tx - d.x, dy = d.ty - d.y, dd = Math.hypot(dx, dy);
        const spd = d.st === 'flee' ? 1.5 : 0.32;
        if (dd < 0.03 || d.t < -6) { d.st = 'graze'; d.t = 3 + Math.random() * 6; }
        else {
          const want = Math.atan2(dx, -dy);
          let da = want - d.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
          d.ang += da * Math.min(1, dt * (d.st === 'flee' ? 8 : 3));
          if (Math.abs(da) < 1.2) { const st = Math.min(dd, spd * dt); d.x += dx / dd * st; d.y += dy / dd * st; d.ph += st * 14; moving = true; }
        }
      }
      const hpT = d.st === 'graze' ? (Math.sin(d.t * 1.3 + d.key) > -0.3 ? 0.95 : 0.1) : d.st === 'flee' ? -0.2 : 0.15;
      d.hp += (hpT - d.hp) * Math.min(1, dt * 3);
      // 身体
      e.set(0, d.ang, 0); q.setFromEuler(e);
      const bob = moving ? Math.abs(Math.sin(d.ph)) * (d.st === 'flee' ? 0.07 : 0.025) : 0;
      m.compose(v.set(d.x, bob, -d.y), q, sc.set(d.s, d.s, d.s));
      body.setMatrixAt(n, m);
      // 头：绕脖子根低头/抬头
      m2.makeRotationX(d.hp + (d.st === 'graze' && d.hp > 0.5 ? Math.sin(this.time * 4 + d.key) * 0.05 : 0));
      m2.setPosition(NK[0], NK[1], NK[2]);
      head.setMatrixAt(n, m2.premultiply(m));
      M.setAnim(body, n, d.ph, 10, moving ? (d.st === 'flee' ? 0.75 : 0.35) : 0);
      n++;
    }
    body.count = n; head.count = n;
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true;
  }

  animRaids(dt) {
    const S = this.S, t = this.time;
    let nw = 0, nb = 0;
    const m = this._m, q = this._q, v = this._v, sc = this._s, e = this._e;
    this.raids = this.raids.filter(r => t - r.t0 < 18);
    for (const r of this.raids) {
      const c = Sim.getCamp(S, r.camp); if (!c) continue;
      const age = t - r.t0;
      const towers = S.buildings.filter(b => b.camp === c.id && b.type === 'tower');
      for (const wf of r.wolves) {
        const dead = age > wf.die;
        const k = Math.min(1, age / 11);
        const rr = r.won ? Math.max(furnaceRadius(Sim.getB(S, c.furnace).lvl) * 0.7, wf.r0 * (1 - k * 0.5)) : wf.r0 * (1 - k * 0.85);
        const x = c.x + Math.cos(wf.a) * rr, y = c.y + Math.sin(wf.a) * rr;
        if (dead && age - wf.die > 2) continue;
        e.set(dead ? Math.PI / 2 : 0, Math.atan2(c.x - x, -(c.y - y)) + Math.PI, 0); q.setFromEuler(e);
        m.compose(v.set(x, dead ? -0.1 * (age - wf.die) : Math.abs(Math.sin(t * 12 + wf.a * 9)) * 0.08, -y), q, sc.set(1.2, 1.2, 1.2));
        if (nw < 120) { this.wolves.setMatrixAt(nw, m); this.wolves.setColorAt(nw, r.col); M.setAnim(this.wolves, nw, t * 12 + wf.a * 9, 10, dead ? 0 : 0.7); nw++; }
        wf.x = x; wf.y = y; wf.dead = dead;
      }
      // 箭塔射击
      if (towers.length && age < 12 && t - r.lastShot > 0.35) {
        r.lastShot = t;
        for (const tw of towers) {
          const tgt = r.wolves.find(w => !w.dead && w.x != null);
          if (tgt) this.shots.push({ x0: tw.x + 0.5, y0: tw.y + 0.5, x1: tgt.x, y1: tgt.y, t0: t });
        }
      }
    }
    this.shots = this.shots.filter(s => t - s.t0 < 0.5);
    for (const s of this.shots) {
      const k = (t - s.t0) / 0.5;
      m.compose(v.set(s.x0 + (s.x1 - s.x0) * k, 2 - k * 1.7 + Math.sin(k * Math.PI) * 0.6, -(s.y0 + (s.y1 - s.y0) * k)), q.identity(), sc.set(1, 1, 1));
      if (nb < 80) this.bolts.setMatrixAt(nb++, m);
    }
    this.wolves.count = nw; this.wolves.instanceMatrix.needsUpdate = true; if (this.wolves.instanceColor) this.wolves.instanceColor.needsUpdate = true;
    this.bolts.count = nb; this.bolts.instanceMatrix.needsUpdate = true;
  }

  animParticles(dt) {
    const S = this.S, R = Sim.rt(S);
    // 烟：熔炉和正在运转、有烟囱的建筑
    const emit = [];
    const cx = this.cam.tx, cy = this.cam.ty;
    for (const b of S.buildings) {
      const s = BLD[b.type].size, bx = b.x + s / 2, by = b.y + s / 2;
      if (Math.abs(bx - cx) > 40 || Math.abs(by - cy) > 40) continue;
      if (b.type === 'furnace') { const cr = R.c[b.camp]; emit.push([bx, by, 3.2 + 0.08 * Math.min(b.lvl, 25), 3 * (cr ? 0.3 + cr.fueled : 1)]); }
      else if (['kitchen', 'smelter', 'coker', 'steelworks', 'refinery', 'forge', 'heater', 'engineworks', 'alloyworks', 'tent'].includes(b.type) && ((R.b[b.id] || {}).act > 0.1 || b.type === 'tent' || b.type === 'heater')) emit.push([bx + (b.type === 'tent' ? 0.45 : 0.5), by + 0.4, b.type === 'tent' ? 1.4 : 2.2, b.type === 'tent' ? 0.3 : 1]);
    }
    const sm = this.smoke;
    let wsum = 0; for (const em of emit) wsum += em[3];
    for (let i = 0; i < sm.n; i++) {
      sm.age[i] += dt;
      if (sm.age[i] > sm.life || sm.src[i] < 0) {
        if (!emit.length) { sm.pos[i * 3 + 1] = -50; sm.src[i] = -1; continue; }
        let r = Math.random() * wsum, k = 0;
        while (k < emit.length - 1 && r > emit[k][3]) { r -= emit[k][3]; k++; }
        const em = emit[k];
        sm.src[i] = k; sm.age[i] = Math.random() * 0.3;
        sm.pos[i * 3] = em[0] + (Math.random() - 0.5) * 0.3; sm.pos[i * 3 + 1] = em[2]; sm.pos[i * 3 + 2] = -em[1];
      } else {
        sm.pos[i * 3] += (0.35 + this.blizz * 2) * dt; sm.pos[i * 3 + 1] += 0.7 * dt; sm.pos[i * 3 + 2] += 0.1 * dt;
      }
    }
    this.smokePts.geometry.attributes.position.needsUpdate = true;
    // 雪
    const sn = this.snow, ox = this.cam.tx, oz = -this.cam.ty;
    const wi = this.wxk ? this.wxk.ice : 0; // 冰风暴：冻雨，落得快、斜着下
    const calm = 1 - this.ice * (1 - this.blizz) * 0.6, fall = (1.2 + this.blizz * 3 + wi * 6) * calm, wind = (0.3 + this.blizz * 7 + wi * 1.5) * calm;
    for (let i = 0; i < this.snowN; i++) {
      let x = sn.pos[i * 3] + wind * dt, y = sn.pos[i * 3 + 1] - fall * dt * (0.7 + (i % 7) * 0.08), z = sn.pos[i * 3 + 2] + Math.sin(this.time + i) * 0.2 * dt;
      if (y < 0) { y += 18; }
      if (x - ox > 30) x -= 60; if (x - ox < -30) x += 60;
      if (z - oz > 30) z -= 60; if (z - oz < -30) z += 60;
      sn.pos[i * 3] = x; sn.pos[i * 3 + 1] = y; sn.pos[i * 3 + 2] = z;
    }
    this.snowPts.geometry.attributes.position.needsUpdate = true;
    this.snowPts.geometry.setDrawRange(0, this.snowN);
    if (this.q === 'ultra') this.animUltra(dt);
    this.snowPts.material.size = 0.13 + this.blizz * 0.08 - wi * 0.04;
    this.snowPts.material.opacity = (0.8 + this.blizz * 0.2) * (1 - this.ice * (1 - this.blizz) * 0.7);
  }
}
