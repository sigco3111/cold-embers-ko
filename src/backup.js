// 存档自动备份：每个存档位留几份旧进度，点一下就能退回去
// 两种备份：
//   定时的（玩着每 10 分钟一份，打开游戏离线结算前一份）：按「多久以前」分档，每档留最老的一份，
//     这样手里总有几分钟前、半小时前、几小时前、一天前的进度，最多 6 份
//   出事之前的（北迁出发前、导入存档码前、重开前、删除前、读取备份前）：留最近 4 份
// 存在这台设备浏览器的 IndexedDB 里（不占存档的地方）；能压缩就压缩。IndexedDB 用不了就退到 localStorage，每个存档位只留 2 份
const DBN = 'hanjin-backup', ST = 'b';
export const BK_EVERY = 600;            // 玩着每 10 分钟备份一次（秒，按真实时间）
const AUTO_EDGES = [15, 60, 240, 1440]; // 定时备份的分档（分钟）：[0,15) [15,60) [60,240) [240,1440) [1440,∞)
const MARK_KEEP = 4;
export const BK_WHY = {
  auto: ['🕒', '定时备份'], open: ['📂', '打开游戏时'], depart: ['🛷', '北迁出发前'], import: ['📥', '导入存档码前'],
  wipe: ['🔄', '重开前'], del: ['🗑', '删除存档前'], restore: ['↩', '读取备份前'], journey: ['🧭', '新的北行前'],
};
const isAuto = r => r.why === 'auto' || r.why === 'open';

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise(res => {
    try {
      const rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = () => { try { rq.result.createObjectStore(ST, { keyPath: 'id', autoIncrement: true }); } catch (e) { /* 已经有了 */ } };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
      setTimeout(() => res(null), 4000);
    } catch (e) { res(null); }
  });
  return dbp;
}
const done = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

// 压缩：deflate 以后存二进制（大存档 270 KB 压到二三十 KB）
async function pack(raw) {
  try {
    const buf = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return { z: new Uint8Array(buf) };
  } catch (e) { return { raw }; }
}
async function unpack(r) {
  if (r.raw != null) return r.raw;
  let u8 = r.z;
  if (typeof u8 === 'string') { const bin = atob(u8); u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); }
  return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}

// 存档摘要：列表里一眼认出是哪份进度
export function bkInfo(o, campName) {
  try {
    const c = o.camps.find(x => x.id === o.active) || o.camps[0];
    return { name: campName ? campName(o) : c.name, people: o.camps.reduce((a, x) => a + x.people, 0), t: o.t || 0, runs: (o.meta && o.meta.runs) || 1 };
  } catch (e) { return { name: '？', people: 0, t: 0, runs: 1 }; }
}

// 留哪些：出事前的留最近 4 份；定时的最新一份必留，其余按年龄分档，每档留一份
export function keepSet(list, now = Date.now()) {
  const keep = new Set();
  const marks = list.filter(r => !isAuto(r)).sort((a, b) => b.at - a.at).slice(0, MARK_KEEP);
  for (const r of marks) keep.add(r.id);
  const autos = list.filter(isAuto).sort((a, b) => b.at - a.at);
  if (autos.length) keep.add(autos[0].id);
  const band = r => { const m = (now - r.at) / 60000; let i = 0; while (i < AUTO_EDGES.length && m >= AUTO_EDGES[i]) i++; return i; };
  const pick = {}, last = AUTO_EDGES.length;
  for (const r of autos) { const b = band(r); if (b < last || !pick[b]) pick[b] = r; } // 从新到旧走：前几档留最老的（好一档档往后传），最后一档（一天以前）留最新的
  for (const k in pick) keep.add(pick[k].id);
  return keep;
}

// ---------- 存取：IndexedDB；用不了退到 localStorage ----------
const lsKey = (key, slot) => `${key}-bk${slot}`;
function lsList(key, slot) { try { return JSON.parse(localStorage.getItem(lsKey(key, slot)) || '[]'); } catch (e) { return []; } }
function lsPut(key, slot, list) {
  // 退路只留 2 份（最新的定时备份 + 最新的出事前备份），省地方；写不下就只留一份，再写不下就算了
  const a = list.filter(isAuto).sort((x, y) => y.at - x.at)[0], m = list.filter(r => !isAuto(r)).sort((x, y) => y.at - x.at)[0];
  const two = [m, a].filter(Boolean);
  for (const L of [two, two.slice(0, 1), []]) { try { localStorage.setItem(lsKey(key, slot), JSON.stringify(L)); return; } catch (e) { /* 下一档 */ } }
}
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };

export class Backups {
  constructor(key) { this.key = key; this.seq = 0; }
  // 这个存档位的备份，新的在前（不带存档正文）
  async list(slot) {
    const d = await db();
    if (d) { try { const all = await done(d.transaction(ST).objectStore(ST).getAll()); return all.filter(r => r.slot === slot).map(strip).sort((a, b) => b.at - a.at); } catch (e) { /* 落到 localStorage */ } }
    return lsList(this.key, slot).map(strip).sort((a, b) => b.at - a.at);
  }
  // raw 是存档的 JSON 字符串（调用的时候就同步拿好，之后存档再变也不影响这份）
  async add(slot, raw, why, info) {
    if (!raw) return null;
    const rec = { slot, at: Date.now() + (this.seq++ % 1000) / 1000, why, info, size: raw.length, ...(await pack(raw)) };
    const d = await db();
    if (d) {
      try {
        rec.id = await done(d.transaction(ST, 'readwrite').objectStore(ST).add(rec));
        await this.trim(d, slot);
        return rec.id;
      } catch (e) { delete rec.id; /* 存不下：落到 localStorage */ }
    }
    const L = lsList(this.key, slot);
    rec.id = 'l' + Math.round(rec.at); if (rec.z) rec.z = b64(rec.z);
    L.push(rec);
    const keep = keepSet(L);
    lsPut(this.key, slot, L.filter(r => keep.has(r.id)));
    return rec.id;
  }
  async trim(d, slot) {
    const all = (await done(d.transaction(ST).objectStore(ST).getAll())).filter(r => r.slot === slot);
    const keep = keepSet(all);
    const drop = all.filter(r => !keep.has(r.id)).map(r => r.id);
    if (!drop.length) return;
    const st = d.transaction(ST, 'readwrite').objectStore(ST);
    await Promise.all(drop.map(id => done(st.delete(id))));
  }
  // 读出一份备份的存档正文
  async raw(slot, id) {
    if (typeof id === 'string' && id[0] === 'l') { const r = lsList(this.key, slot).find(x => x.id === id); return r ? unpack(r) : null; }
    const d = await db(); if (!d) return null;
    const r = await done(d.transaction(ST).objectStore(ST).get(id));
    return r && r.slot === slot ? unpack(r) : null;
  }
}
const strip = r => ({ id: r.id, slot: r.slot, at: r.at, why: r.why, info: r.info || {}, size: r.size || 0 });
