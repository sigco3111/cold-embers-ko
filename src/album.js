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
  const name = `차가운 잔불의 북행-앨범-${stamp(new Date(rec.t))}.jpg`;
  return saveFile(name, rec.blob, name.replace('차가운 잔불의 북행', 'hanjin'));
}

// 大图：照片、说明、日期，保存 / 删除（点两下才删）/ 关闭
export class AlbumView {
  constructor(onDel) {
    this.onDel = onDel;
    const el = this.el = document.createElement('div'); el.id = 'albumview';
    el.innerHTML = '<div class="pvin"><img alt="앨범의 사진"><div class="avcap"></div><div class="pvbar"><button class="btn go" data-av="save">사진 저장</button><button class="btn" data-av="del">삭제</button><button class="btn ghost" data-av="x">닫기</button></div><small>저장할 수 없는 경우: 컴퓨터에서 이미지를 마우스 오른쪽 버튼으로 클릭하고 "다른 이름으로 저장"한 다음 휴대폰에서 이미지를 길게 눌러 저장하세요. </small></div>';
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-av]');
      if (!b) { if (e.target === el) this.hide(); return; }
      const k = b.dataset.av;
      if (k === 'x') this.hide();
      else if (k === 'save') { const r = await albumSave(this.rec); b.textContent = r === 'saved' ? '✓ 저장됨' : r === 'busy' ? '아직도 저장하겠냐고 물어보는데...' : '이미지 저장'; }
      else if (k === 'del') {
        if (!this.armed) { this.armed = true; b.textContent = '삭제하려면 다시 클릭하세요.'; b.classList.add('warn'); return; }
        await albumDel(this.rec.id); this.hide(); this.onDel && this.onDel(this.rec.id);
      }
    });
    document.body.appendChild(el);
  }
  show(rec, url) {
    this.rec = rec; this.armed = false;
    this.el.querySelector('img').src = url;
    const d = new Date(rec.t), p = n => String(n).padStart(2, '0');
    this.el.querySelector('.avcap').textContent = `${rec.cap || ''} · ${d.getMonth() + 1}월${d.getDate()}일 ${p(d.getHours())}:${p(d.getMinutes())}${rec.auto ? '· 자동으로 촬영' : ''}`;
    const del = this.el.querySelector('[data-av="del"]'); del.textContent = '삭제'; del.classList.remove('warn');
    this.el.querySelector('[data-av="save"]').textContent = '이미지 저장';
    this.el.classList.add('show');
  }
  hide() { this.el.classList.remove('show'); }
}
