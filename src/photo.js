// 拍照模式：藏起所有界面，换个时辰、滤镜和镜头高度，拍一张营地的照片存下来
import { saveFile, stamp } from './files.js';
import { DAY_LEN } from './data.js';
import * as Sim from './sim.js';
import { FRAMES } from './data.js';
import { drawFrame } from './cosmetic.js';
import { albumAdd, toJpeg } from './album.js';

export const PH_FILTERS = [
  { id: 'none', n: '原色', css: '' },
  { id: 'warm', n: '暖阳', css: 'sepia(.22) saturate(1.25) brightness(1.04)' },
  { id: 'cold', n: '冷冽', css: 'saturate(.72) hue-rotate(12deg) brightness(1.06) contrast(1.05)' },
  { id: 'film', n: '胶片', css: 'contrast(1.12) saturate(.8) sepia(.2)' },
  { id: 'mono', n: '黑白', css: 'grayscale(1) contrast(1.15)' },
  { id: 'aur', n: '极光', css: 'hue-rotate(-18deg) saturate(1.35) contrast(1.06) brightness(1.02)' },
  { id: 'fade', n: '褪色', css: 'contrast(.88) brightness(1.08) saturate(.62) sepia(.08)' },
];
// 一张照片：滤镜、暗角、相框、落款（自动拍的相册照片也走这一套）
export function compose(g, src, o = {}) {
  const v = g.view, w = src.width, h = src.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d');
  if (o.css && 'filter' in x) x.filter = o.css;
  x.drawImage(src, 0, 0);
  x.filter = 'none';
  // 和画面上一样的暗角，夜里更深一点
  const nf = v.nf || 0, r = Math.hypot(w, h) / 2;
  let gr = x.createRadialGradient(w / 2, h * 0.45, r * 0.5, w / 2, h * 0.45, r * 1.05);
  gr.addColorStop(0, 'rgba(8,14,24,0)'); gr.addColorStop(1, `rgba(8,14,24,${(0.5 + nf * 0.3).toFixed(2)})`);
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (const [cx, cy, a] of [[0, 0, 0.3], [w, 0, 0.24], [0, h, 0.24], [w, h, 0.28]]) { gr = x.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.32); gr.addColorStop(0, `rgba(214,236,255,${a})`); gr.addColorStop(1, 'rgba(214,236,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }
  const bw = drawFrame(x, o.frame, w, h);
  // 落款
  const fs = Math.max(12, Math.round(h * 0.022));
  x.font = `600 ${fs}px "Songti SC","Noto Serif SC","STSong",serif`; x.textAlign = 'right'; x.textBaseline = 'bottom';
  x.shadowColor = 'rgba(0,0,0,.65)'; x.shadowBlur = fs * 0.4;
  x.fillStyle = 'rgba(255,240,215,.92)'; x.fillText(o.cap || '', w - bw - fs, h - bw - fs * 0.8);
  x.shadowBlur = 0;
  return cv;
}
export function captionOf(S, extra) {
  const c = Sim.getCamp(S, S.active) || S.camps[0], tt = Sim.titleOf(S);
  return `寒烬北行 · ${extra || (c ? c.name : '')}${tt ? ` · ${tt}` : ''} · 第 ${Math.floor(S.t / DAY_LEN) + 1} 天`;
}
export const PH_TIMES = [[null, '跟随'], [0.22, '白天'], [0.56, '黄昏'], [0.76, '夜晚'], [0.95, '黎明']];
const P_LO = 0.3, P_HI = 1.25;

export class Photo {
  constructor(g) {
    this.g = g; this.on = false; this.f = 'none'; this.tod = 0; this.pitch = 50; this.ring = false; this.fr = null;
    // 相框预览：盖在画面上的一层透明画布，只画边框
    this.frv = document.createElement('canvas'); this.frv.id = 'phframe'; document.body.appendChild(this.frv);
    addEventListener('resize', () => { if (this.on) this.drawFrameView(); });
    const bar = this.bar = document.createElement('div'); bar.id = 'photobar';
    document.body.appendChild(bar);
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-ph]'); if (!b) return;
      const k = b.dataset.ph, v = b.dataset.v;
      if (k === 'tod') this.tod = +v;
      else if (k === 'f') this.f = v;
      else if (k === 'fr') { this.fr = v; Sim.setFrame(this.g.S, v); }
      else if (k === 'freeze') this.g.togglePause();
      else if (k === 'ring') this.ring = !this.ring;
      else if (k === 'hide') { document.body.classList.toggle('photo-clean'); return; }
      else if (k === 'shot') { this.shoot(); return; }
      else if (k === 'x') { this.close(); return; }
      this.apply(); this.draw();
    });
    bar.addEventListener('input', e => { if (e.target.dataset.ph === 'pitch') { this.pitch = +e.target.value; this.apply(); } });
    // 只剩一个小按钮时，点画面任何地方都能把工具条叫回来
    this.peek = document.createElement('button'); this.peek.id = 'photopeek'; this.peek.textContent = '📷'; this.peek.title = '显示拍照工具条';
    this.peek.addEventListener('click', () => document.body.classList.remove('photo-clean'));
    document.body.appendChild(this.peek);
    const view = document.createElement('div'); view.id = 'photoview';
    view.innerHTML = '<div class="pvin"><img alt="刚拍的照片"><div class="pvbar"><button class="btn go" data-pv="save">💾 保存图片</button><button class="btn" data-pv="album">📔 收进相册</button><button class="btn" data-pv="again">再拍一张</button><button class="btn ghost" data-pv="done">退出拍照</button></div><small>保存不了的话：电脑上右键图片「另存为」，手机上长按图片保存。</small></div>';
    view.addEventListener('click', e => {
      const b = e.target.closest('[data-pv]'); if (!b && e.target !== view) return;
      if (b && b.dataset.pv === 'save') { this.save(); return; }
      if (b && b.dataset.pv === 'album') { this.toAlbum(b); return; }
      this.hidePreview();
      if (b && b.dataset.pv === 'done') this.close();
    });
    document.body.appendChild(this.pv = view);
  }
  open() {
    const g = this.g, v = g.view;
    g.cancelModes(); g.ui.close(); v.select(null);
    if (g.bigmap.open) g.bigmap.hide(); if (g.chainmap.open) g.chainmap.hide();
    this.on = true; this.wasPaused = !!g.paused;
    // 镜头高度从眼下的角度开始，进拍照模式画面不跳
    const p0 = 0.78 + (v.cam.dist - 9) / 81 * 0.42;
    this.pitch = Math.round(Math.max(0, Math.min(100, (p0 - P_LO) / (P_HI - P_LO) * 100)));
    document.body.classList.add('photo'); document.body.classList.remove('photo-clean');
    v.photo = true;
    this.apply(); this.draw();
    g.sfx('tap');
  }
  close() {
    const g = this.g, v = g.view;
    this.on = false;
    document.body.classList.remove('photo', 'photo-clean');
    v.photo = false; v.photoT = null; v.photoPitch = null; v.rings.visible = true;
    v.cam.tdist = Math.max(9, Math.min(90, v.cam.tdist));
    g.canvas.style.filter = '';
    this.frv.style.display = 'none';
    if (g.paused !== this.wasPaused) g.togglePause(this.wasPaused);
    this.hidePreview();
    if (g.bookLater) g.flushBook(800);
  }
  filterCss() { return (PH_FILTERS.find(x => x.id === this.f) || PH_FILTERS[0]).css; }
  apply() {
    const g = this.g, v = g.view, S = g.S, p = PH_TIMES[this.tod][0];
    v.photoT = p == null ? null : Math.floor(S.t / DAY_LEN) * DAY_LEN + p * DAY_LEN;
    v.photoPitch = P_LO + (P_HI - P_LO) * this.pitch / 100;
    v.rings.visible = this.ring;
    g.canvas.style.filter = this.filterCss();
    this.drawFrameView();
  }
  frame() { const S = this.g.S, id = this.fr ?? Sim.frameOf(S); return Sim.cosHave(S, 'frame', id) ? id : 'none'; }
  drawFrameView() {
    const c = this.frv, d = Math.min(2, devicePixelRatio || 1), fr = this.on ? this.frame() : 'none';
    c.style.display = fr === 'none' ? 'none' : 'block';
    if (fr === 'none') return;
    c.width = Math.round(innerWidth * d); c.height = Math.round(innerHeight * d);
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); drawFrame(x, fr, c.width, c.height);
  }
  draw() {
    const g = this.g, seg = (k, list, cur) => `<div class="phseg">${list.map(([v, n], i) => `<button class="${cur === (k === 'tod' ? i : v) ? 'on' : ''}" data-ph="${k}" data-v="${k === 'tod' ? i : v}">${n}</button>`).join('')}</div>`;
    this.bar.innerHTML = `
      <div class="phrow"><span class="phl">时辰</span>${seg('tod', PH_TIMES, this.tod)}</div>
      <div class="phrow"><span class="phl">滤镜</span>${seg('f', PH_FILTERS.map(x => [x.id, x.n]), this.f)}</div>
      ${(() => { const S = g.S, L = Object.keys(FRAMES).filter(id => Sim.cosHave(S, 'frame', id)); return L.length > 1 ? `<div class="phrow"><span class="phl">相框</span>${seg('fr', L.map(id => [id, FRAMES[id].n]), this.frame())}</div>` : ''; })()}
      <div class="phrow"><span class="phl">镜头</span><span class="phrng"><small>平视</small><input type="range" min="0" max="100" value="${this.pitch}" data-ph="pitch"><small>俯视</small></span>
        <button class="phtg ${g.paused ? 'on' : ''}" data-ph="freeze" title="暂停时间，人和车都停住">定格</button><button class="phtg ${this.ring ? 'on' : ''}" data-ph="ring" title="显示熔炉供热圈">供热圈</button></div>
      <div class="phrow phact"><button class="phx" data-ph="x">✕ 退出</button><button class="phx" data-ph="hide">藏起工具条</button><button class="phshot" data-ph="shot">📸 拍照</button></div>
      <div class="phtip">拖动画面找角度 · ${matchMedia('(pointer:coarse)').matches ? '双指缩放、旋转' : '滚轮缩放 · 右键拖动旋转'} · 拍照模式里能凑得更近</div>`;
  }
  // 拍照：截下这一帧，套上滤镜、暗角和落款
  shoot() {
    const g = this.g, v = g.view, S = g.S;
    if (this.busy) return;
    this.busy = true; clearTimeout(this.busyT); this.busyT = setTimeout(() => { if (this.busy) { this.busy = false; this.draw(); } }, 60000);
    const btn = this.bar.querySelector('.phshot'); if (btn) { btn.disabled = true; btn.textContent = '冲洗中…'; }
    g.sfx('shutter');
    document.body.classList.add('photo-flash'); setTimeout(() => document.body.classList.remove('photo-flash'), 380);
    v.shotCb = src => {
      const txt = captionOf(S), cv = compose(g, src, { css: this.filterCss(), frame: this.frame(), cap: txt });
      this.lastCv = cv; this.inAlbum = false;
      const done = url => { this.showPreview(url, txt); };
      try { cv.toBlob(b => { this.blob = b || null; if (b) done(URL.createObjectURL(b)); else done(cv.toDataURL('image/png')); }, 'image/png'); }
      catch (e) { done(null); }
    };
  }
  showPreview(url, txt) {
    const S = this.g.S;
    this.busy = false; this.draw();
    S.meta.photos = (S.meta.photos || 0) + 1;
    if (!url) { this.g.ui.toast('这台设备拍不了照片。', 'warn'); return; }
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = url.startsWith('blob:') ? url : null;
    this.pv.querySelector('img').src = url;
    this.dataUrl = this.url ? null : url;
    this.fname = `寒烬北行-${stamp()}.png`;
    this.pv.querySelector('[data-pv="save"]').textContent = '💾 保存图片';
    this.pv.querySelector('[data-pv="album"]').textContent = '📔 收进相册';
    this.pv.classList.add('show');
  }
  // 保存：claude.ai 里走页面的下载权限（会问一句），单独打开时用普通下载
  async save() {
    let data = this.blob;
    if (!data && this.dataUrl) data = await (await fetch(this.dataUrl)).blob();
    const btn = this.pv.querySelector('[data-pv="save"]'); // 拍照模式里提示条是藏起来的，结果写在按钮上
    if (!data) { btn.textContent = '存不了，请右键或长按图片'; return; }
    const r = await saveFile(this.fname, data, this.fname.replace('寒烬北行', 'hanjin'));
    if (r === 'saved') btn.textContent = '✓ 存好了';
    else if (r === 'busy') btn.textContent = '还在问要不要保存…';
  }
  hidePreview() { this.pv.classList.remove('show'); }
  // 手动收进相册：存一份缩小的 JPEG
  async toAlbum(btn) {
    if (!this.lastCv || this.inAlbum) return;
    this.inAlbum = true; btn.textContent = '收着呢…';
    const j = await toJpeg(this.lastCv);
    if (!j) { btn.textContent = '存不进相册'; this.inAlbum = false; return; }
    await albumAdd({ blob: j.blob, w: j.w, h: j.h, cap: captionOf(this.g.S), auto: 0 });
    btn.textContent = '✓ 收进相册了'; this.g.ui.albumDirty && this.g.ui.albumDirty();
  }
}
