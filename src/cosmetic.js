// 装扮的画法：旗子图案（营地旗杆、车队领头车、装扮页的小样都用这一份）和照片相框
// 只用 2D 画布，不依赖 three

// 旗面：w×h 的画布，左边挨着旗杆
export function drawFlag(x, id, w, h) {
  const bg = { star: ['#1d2f5a', '#2c4680'], flame: ['#7e1a16', '#a82a1e'], wolf: ['#353f4b', '#4c5866'], compass: ['#1f4f48', '#2e6c61'] }[id] || ['#a8322a', '#c0402e'];
  let gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, bg[1]); gr.addColorStop(1, bg[0]);
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,.24)'; x.fillRect(0, 0, w, h * 0.08); x.fillRect(0, h * 0.92, w, h * 0.08);
  x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, w * 0.06, h);
  x.strokeStyle = 'rgba(255,236,200,.45)'; x.lineWidth = Math.max(1.5, h * 0.035); x.strokeRect(w * 0.1, h * 0.15, w * 0.82, h * 0.7);
  const cx = w * 0.52, cy = h * 0.5, R = h * 0.3;
  x.save(); x.translate(cx, cy);
  if (id === 'star') {
    // 北极星：四长四短的星芒，周围几颗小星
    const star = (r1, r2, n, rot) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); };
    x.fillStyle = 'rgba(255,233,168,.55)'; star(R * 0.78, R * 0.16, 4, Math.PI / 4); x.fill();
    x.fillStyle = '#ffe9a8'; star(R * 1.15, R * 0.2, 4, -Math.PI / 2); x.fill();
    x.fillStyle = '#fffbe8'; x.beginPath(); x.arc(0, 0, R * 0.14, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,240,200,.85)';
    for (const [dx, dy, r] of [[-1.55, -0.7, 0.07], [1.5, -0.85, 0.06], [1.3, 0.8, 0.08], [-1.4, 0.75, 0.05], [0.7, -1.15, 0.05]]) { x.beginPath(); x.arc(dx * R, dy * R, r * R, 0, 7); x.fill(); }
  } else if (id === 'flame') {
    // 火焰：外焰橙、内焰黄，底下一道炉口
    const fl = (s, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, R * 1.0 * s); x.bezierCurveTo(-R * 0.95 * s, R * 0.85 * s, -R * 0.75 * s, -R * 0.1 * s, -R * 0.15 * s, -R * 1.15 * s); x.bezierCurveTo(-R * 0.05 * s, -R * 0.55 * s, R * 0.3 * s, -R * 0.55 * s, R * 0.2 * s, -R * 0.95 * s); x.bezierCurveTo(R * 0.85 * s, -R * 0.35 * s, R * 0.95 * s, R * 0.8 * s, 0, R * 1.0 * s); x.fill(); };
    x.translate(0, -R * 0.05);
    fl(1, '#ff8a2a'); x.translate(0, R * 0.22); fl(0.62, '#ffd34a'); x.translate(0, R * 0.14); fl(0.3, '#fff3c0');
    x.translate(0, -R * 0.36); x.fillStyle = 'rgba(40,10,6,.55)'; x.fillRect(-R * 0.9, R * 1.02, R * 1.8, R * 0.16);
  } else if (id === 'wolf') {
    // 狼头：正面的剪影，两只尖耳朵、长鼻梁、金色眼睛
    const L = '#e6eaee', D = '#2a3038';
    x.fillStyle = L; x.beginPath();
    x.moveTo(-R * 0.95, -R * 1.05); x.lineTo(-R * 0.45, -R * 0.45); x.lineTo(R * 0.45, -R * 0.45); x.lineTo(R * 0.95, -R * 1.05);
    x.lineTo(R * 0.92, -R * 0.15); x.lineTo(R * 1.12, R * 0.2); x.lineTo(R * 0.55, R * 0.45); x.lineTo(R * 0.22, R * 1.05); x.lineTo(-R * 0.22, R * 1.05); x.lineTo(-R * 0.55, R * 0.45); x.lineTo(-R * 1.12, R * 0.2); x.lineTo(-R * 0.92, -R * 0.15);
    x.closePath(); x.fill();
    x.fillStyle = '#b7bec6'; x.beginPath(); x.moveTo(-R * 0.75, -R * 0.85); x.lineTo(-R * 0.48, -R * 0.5); x.lineTo(-R * 0.72, -R * 0.4); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(R * 0.75, -R * 0.85); x.lineTo(R * 0.48, -R * 0.5); x.lineTo(R * 0.72, -R * 0.4); x.closePath(); x.fill();
    x.fillStyle = '#c8ced5'; x.beginPath(); x.moveTo(-R * 0.3, R * 0.15); x.lineTo(R * 0.3, R * 0.15); x.lineTo(R * 0.2, R * 1.05); x.lineTo(-R * 0.2, R * 1.05); x.closePath(); x.fill();
    x.fillStyle = '#ffcf5a'; for (const sg of [-1, 1]) { x.beginPath(); x.moveTo(sg * R * 0.2, -R * 0.05); x.lineTo(sg * R * 0.58, -R * 0.2); x.lineTo(sg * R * 0.5, R * 0.04); x.closePath(); x.fill(); }
    x.fillStyle = D; x.beginPath(); x.moveTo(-R * 0.17, R * 0.86); x.lineTo(R * 0.17, R * 0.86); x.lineTo(0, R * 1.04); x.closePath(); x.fill();
  } else if (id === 'compass') {
    // 罗盘：一圈刻度，四角星，指北的那一角是红的
    x.strokeStyle = '#f2e2b0'; x.lineWidth = Math.max(1.5, R * 0.1); x.beginPath(); x.arc(0, 0, R * 1.02, 0, 7); x.stroke();
    x.lineWidth = Math.max(1, R * 0.05);
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r0 = i % 4 ? R * 0.86 : R * 0.76; x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * R * 1.02, Math.sin(a) * R * 1.02); x.stroke(); }
    const pt = (a, r, c) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a - 0.5) * r * 0.22, Math.sin(a - 0.5) * r * 0.22); x.lineTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a + 0.5) * r * 0.22, Math.sin(a + 0.5) * r * 0.22); x.closePath(); x.fill(); };
    for (let i = 0; i < 4; i++) pt(Math.PI / 4 + i * Math.PI / 2, R * 0.6, 'rgba(242,226,176,.6)');
    pt(-Math.PI / 2, R * 1.1, '#e0483a'); pt(Math.PI / 2, R * 0.95, '#f2e2b0'); pt(0, R * 0.95, '#f2e2b0'); pt(Math.PI, R * 0.95, '#f2e2b0');
    x.fillStyle = '#1f4f48'; x.beginPath(); x.arc(0, 0, R * 0.09, 0, 7); x.fill();
  }
  x.restore();
  // 布纹
  x.fillStyle = 'rgba(255,255,255,.05)'; for (let yy = 0; yy < h; yy += 3) x.fillRect(0, yy, w, 1);
}

// 相框：画在照片的边上，返回边框的宽度（落款往里让一让）
export function drawFrame(x, id, w, h, k = 1) {
  if (!id || id === 'none') return 0;
  const b = Math.round(Math.min(w, h) * (id === 'film' ? 0.07 : 0.045) * k);
  const ring = (fill) => { x.fillStyle = fill; x.beginPath(); x.rect(0, 0, w, h); x.rect(b, h - b, w - 2 * b, -(h - 2 * b)); x.fill('evenodd'); };
  if (id === 'copper') {
    let gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e3a868'); gr.addColorStop(0.35, '#a8642c'); gr.addColorStop(0.65, '#d89458'); gr.addColorStop(1, '#7a4420');
    ring(gr);
    x.strokeStyle = 'rgba(255,226,170,.55)'; x.lineWidth = Math.max(1, b * 0.08); x.strokeRect(b * 0.25, b * 0.25, w - b * 0.5, h - b * 0.5);
    x.strokeStyle = 'rgba(40,18,6,.7)'; x.lineWidth = Math.max(1, b * 0.14); x.strokeRect(b - b * 0.07, b - b * 0.07, w - 2 * b + b * 0.14, h - 2 * b + b * 0.14);
    // 铜锈和铆钉
    x.fillStyle = 'rgba(90,170,140,.25)'; for (let i = 0; i < 26; i++) { const t = (i * 0.618) % 1, side = i % 4, px = side < 2 ? t * w : side === 2 ? b * 0.5 : w - b * 0.5, py = side < 2 ? (side ? h - b * 0.5 : b * 0.5) : t * h; x.beginPath(); x.arc(px, py, b * (0.12 + (i % 3) * 0.06), 0, 7); x.fill(); }
    for (const [px, py] of [[b / 2, b / 2], [w - b / 2, b / 2], [b / 2, h - b / 2], [w - b / 2, h - b / 2]]) { const r = b * 0.2; gr = x.createRadialGradient(px - r * 0.3, py - r * 0.3, 0, px, py, r); gr.addColorStop(0, '#ffe2b0'); gr.addColorStop(1, '#6a3a18'); x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  } else if (id === 'film') {
    // 胶片：上下一条黑边打齿孔，边上印着片号
    x.fillStyle = '#121212'; x.fillRect(0, 0, w, b); x.fillRect(0, h - b, w, b); x.fillRect(0, 0, b * 0.25, h); x.fillRect(w - b * 0.25, 0, b * 0.25, h);
    const hw = b * 0.42, hh = b * 0.36, gap = b * 0.95;
    x.fillStyle = '#e8e0cc';
    for (let px = b * 0.4; px < w - hw; px += gap) for (const py of [b * 0.18, h - b * 0.18 - hh]) { x.beginPath(); x.roundRect ? x.roundRect(px, py, hw, hh, hh * 0.25) : x.rect(px, py, hw, hh); x.fill(); }
    x.fillStyle = '#ff9a3a'; x.font = `600 ${Math.round(b * 0.26)}px monospace`; x.textBaseline = 'middle'; x.textAlign = 'left';
    for (let i = 0; i * w * 0.3 + b < w - b * 2; i++) x.fillText(`HANJIN 400  ${12 + i}A`, b + i * w * 0.3, b * 0.79);
  } else if (id === 'map') {
    // 旧地图：泛黄的纸边，内缘撕得不齐，一角画着罗盘，边上一串虚线路
    let gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e2cfa0'); gr.addColorStop(1, '#c9b07a');
    x.fillStyle = gr; x.beginPath(); x.rect(0, 0, w, h);
    const pts = [], jag = (a, b2, n) => { for (let i = 0; i <= n; i++) pts.push([a[0] + (b2[0] - a[0]) * i / n + (i && i < n ? (((i * 7919) % 13) / 13 - 0.5) * b * 0.5 : 0), a[1] + (b2[1] - a[1]) * i / n + (i && i < n ? (((i * 104729) % 11) / 11 - 0.5) * b * 0.5 : 0)]); };
    const n = 18; jag([b, b], [b, h - b], n); jag([b, h - b], [w - b, h - b], n); jag([w - b, h - b], [w - b, b], n); jag([w - b, b], [b, b], n);
    x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.closePath(); x.fill('evenodd');
    x.strokeStyle = 'rgba(110,80,40,.6)'; x.lineWidth = Math.max(1, b * 0.06); x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]); x.closePath(); x.stroke();
    x.fillStyle = 'rgba(120,80,30,.12)'; for (let i = 0; i < 40; i++) { const t = (i * 0.618) % 1, s = i % 4; x.beginPath(); x.arc(s < 2 ? t * w : s === 2 ? b * 0.4 : w - b * 0.4, s < 2 ? (s ? h - b * 0.4 : b * 0.4) : t * h, b * 0.3, 0, 7); x.fill(); }
    x.setLineDash([b * 0.25, b * 0.2]); x.strokeStyle = 'rgba(150,40,30,.7)'; x.lineWidth = Math.max(1, b * 0.07);
    x.beginPath(); x.moveTo(b * 0.5, h * 0.75); x.bezierCurveTo(b * 0.2, h * 0.5, b * 0.8, h * 0.35, b * 0.45, b * 0.5); x.lineTo(w * 0.4, b * 0.55); x.stroke(); x.setLineDash([]);
    const cx = w - b * 1.6, cy = b * 1.75, R = b * 1.1; // 罗盘放右上角，右下角留给落款
    x.fillStyle = 'rgba(226,207,160,.92)'; x.beginPath(); x.arc(cx, cy, R * 1.15, 0, 7); x.fill();
    x.strokeStyle = 'rgba(90,60,30,.8)'; x.lineWidth = Math.max(1, b * 0.06); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; x.fillStyle = i ? 'rgba(90,60,30,.85)' : '#a83228'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a - 0.4) * R * 0.25, cy + Math.sin(a - 0.4) * R * 0.25); x.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95); x.lineTo(cx + Math.cos(a + 0.4) * R * 0.25, cy + Math.sin(a + 0.4) * R * 0.25); x.closePath(); x.fill(); }
    x.fillStyle = 'rgba(90,60,30,.9)'; x.font = `700 ${Math.round(R * 0.45)}px serif`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.fillText('北', cx, cy - R * 1.0);
  } else if (id === 'ruin') {
    // 古城石框：一块块石砖，砖缝深色，顶上压着雪，四角刻一个菱形
    ring('#555b62'); // 砖缝
    const bh = b / 2, gap = Math.max(1, b * 0.05);
    x.save(); x.beginPath(); x.rect(0, 0, w, h); x.rect(b, h - b, w - 2 * b, -(h - 2 * b)); x.clip('evenodd');
    for (let row = 0; row * bh < h; row++) {
      const off = row % 2 ? b * 0.6 : 0;
      for (let px = -off; px < w; px += b * 1.2) { const k = ((row * 31 + Math.round(px)) * 2654435761 >>> 0) % 7; x.fillStyle = ['#8a9096', '#949aa0', '#7f858c', '#9aa0a5', '#868c92', '#90969c', '#7a8087'][k]; x.fillRect(px + gap, row * bh + gap, b * 1.2 - 2 * gap, bh - 2 * gap); }
    }
    x.restore();
    x.strokeStyle = 'rgba(30,34,40,.55)'; x.lineWidth = Math.max(1, b * 0.08); x.strokeRect(b, b, w - 2 * b, h - 2 * b);
    x.fillStyle = 'rgba(245,250,255,.92)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, b * 0.35);
    for (let px = w; px > 0; px -= b * 0.7) x.quadraticCurveTo(px - b * 0.35, b * (0.55 + ((px * 13) % 7) / 20), px - b * 0.7, b * 0.38);
    x.closePath(); x.fill();
    for (const [px, py] of [[b / 2, b / 2 + b * 0.15], [w - b / 2, b / 2 + b * 0.15], [b / 2, h - b / 2], [w - b / 2, h - b / 2]]) { x.strokeStyle = 'rgba(40,46,54,.6)'; x.lineWidth = Math.max(1, b * 0.07); x.beginPath(); x.moveTo(px, py - b * 0.28); x.lineTo(px + b * 0.22, py); x.lineTo(px, py + b * 0.28); x.lineTo(px - b * 0.22, py); x.closePath(); x.stroke(); }
  }
  return b;
}
