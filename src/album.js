// 相册：抵达新一站、点亮烽火塔、第一次三星产线、天火点燃时自动拍一张，拍照模式里也能手动收进来
// 照片存在这台设备浏览器的 IndexedDB 里（不进存档，太大）；用不了就先放在内存里，关掉页面就没了
// 最多 40 张，满了先挤掉最早的一张自动照片
import { saveFile, stamp } from './files.js';

const DBN = 'hanjin-album', ST = 'p';
export const ALBUM_MAX = 40;
let dbp = null, mem = null, memId = 0;

function db() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(ST, { keyPath: 'id', autoIncrement: true }); } catch (e) { /* 已经有了 */ } };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
      setTimeout(() => res(null), 4000); // 有的环境既不成功也不报错
    } catch (e) { res(null); }
  });
  return dbp;
}
const done = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const memList = () => (mem || (mem = []));

// 新的在前
export async function albumList() {
  const d = await db();
  if (d) { try { const all = await done(d.transaction(ST).objectStore(ST).getAll()); return all.sort((a, b) => b.t - a.t); } catch (e) { /* 落到内存 */ } }
  return memList().slice().sort((a, b) => b.t - a.t);
}
export async function albumAdd(rec) {
  rec.t = Date.now();
  const d = await db();
  if (d) {
    try { rec.id = await done(d.transaction(ST, 'readwrite').objectStore(ST).add(rec)); await trim(d); return rec; } catch (e) { delete rec.id; /* 存满了或者不让存：落到内存 */ }
  }
  rec.id = 'm' + (++memId); memList().push(rec);
  const L = memList(); while (L.length > ALBUM_MAX) { const i = L.findIndex(r => r.auto); L.splice(i >= 0 ? i : 0, 1); }
  return rec;
}
async function trim(d) {
  const all = await done(d.transaction(ST).objectStore(ST).getAll());
  if (all.length <= ALBUM_MAX) return;
  all.sort((a, b) => a.t - b.t);
  const n = all.length - ALBUM_MAX, drop = all.filter(r => r.auto).slice(0, n).map(r => r.id);
  for (const r of all) { if (drop.length >= n) break; if (!drop.includes(r.id)) drop.push(r.id); }
  const st = d.transaction(ST, 'readwrite').objectStore(ST);
  await Promise.all(drop.map(id => done(st.delete(id))));
}
export async function albumDel(id) {
  if (typeof id === 'string' && id[0] === 'm') { const L = memList(), i = L.findIndex(r => r.id === id); if (i >= 0) L.splice(i, 1); return; }
  const d = await db(); if (!d) return;
  try { await done(d.transaction(ST, 'readwrite').objectStore(ST).delete(id)); } catch (e) { /* 删不掉就算了 */ }
}
// 存成 JPEG，长边不超过 1280
export function toJpeg(cv, max = 1280) {
  return new Promise(res => {
    const k = Math.min(1, max / Math.max(cv.width, cv.height)), w = Math.round(cv.width * k), h = Math.round(cv.height * k);
    let c = cv;
    if (k < 1) { c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, w, h); }
    try { c.toBlob(b => res(b ? { blob: b, w, h } : null), 'image/jpeg', 0.86); } catch (e) { res(null); }
  });
}
export async function albumSave(rec) {
  const name = `寒烬北行-相册-${stamp(new Date(rec.t))}.jpg`;
  return saveFile(name, rec.blob, name.replace('寒烬北行', 'hanjin'));
}

// 大图：照片、说明、日期，保存 / 删除（点两下才删）/ 关闭
export class AlbumView {
  constructor(onDel) {
    this.onDel = onDel;
    const el = this.el = document.createElement('div'); el.id = 'albumview';
    el.innerHTML = '<div class="pvin"><img alt="相册里的照片"><div class="avcap"></div><div class="pvbar"><button class="btn go" data-av="save">保存图片</button><button class="btn" data-av="del">删除</button><button class="btn ghost" data-av="x">关闭</button></div><small>保存不了的话：电脑上右键图片「另存为」，手机上长按图片保存。</small></div>';
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-av]');
      if (!b) { if (e.target === el) this.hide(); return; }
      const k = b.dataset.av;
      if (k === 'x') this.hide();
      else if (k === 'save') { const r = await albumSave(this.rec); b.textContent = r === 'saved' ? '✓ 存好了' : r === 'busy' ? '还在问要不要保存…' : '保存图片'; }
      else if (k === 'del') {
        if (!this.armed) { this.armed = true; b.textContent = '再点一次删除'; b.classList.add('warn'); return; }
        await albumDel(this.rec.id); this.hide(); this.onDel && this.onDel(this.rec.id);
      }
    });
    document.body.appendChild(el);
  }
  show(rec, url) {
    this.rec = rec; this.armed = false;
    this.el.querySelector('img').src = url;
    const d = new Date(rec.t), p = n => String(n).padStart(2, '0');
    this.el.querySelector('.avcap').textContent = `${rec.cap || ''}  ·  ${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}${rec.auto ? '  ·  自动拍的' : ''}`;
    const del = this.el.querySelector('[data-av="del"]'); del.textContent = '删除'; del.classList.remove('warn');
    this.el.querySelector('[data-av="save"]').textContent = '保存图片';
    this.el.classList.add('show');
  }
  hide() { this.el.classList.remove('show'); }
}
