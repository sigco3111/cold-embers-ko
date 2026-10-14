// 入口：主循环、输入、存档、离线结算
import * as Sim from './sim.js';
import { View } from './render.js';
import { Sound } from './audio.js';
import { UI, fmt, fmtTime, RICON, ICON } from './ui.js';
import { BLD, RES, STORY, LANDMARKS, FAR_MARKS, dayCycle, SLOTS } from './data.js';
import { getWorld, idx, W, H } from './worldgen.js';
import { iconize, injectIcons } from './icons.js';
import { BigMap } from './bigmap.js';
import { ChainMap } from './chainmap.js';
import { Photo } from './photo.js';
import { Hints, WHATS_NEW, WHATS_NEW_HTML } from './hints.js';

const KEY = 'hanjin-beixing-v1';
// 三个存档位：1 号沿用原来的存档键，老存档直接就在 1 号位
const slotKey = n => n > 1 ? `${KEY}-s${n}` : KEY;
const SAVE_EVERY = 15;

class Game {
  constructor() {
    this.canvas = document.getElementById('c');
    this.view = new View(this.canvas);
    injectIcons();
    this.ui = new UI(this);
    this.bigmap = new BigMap(this);
    this.chainmap = new ChainMap(this);
    this.photo = new Photo(this);
    this.hints = new Hints(this);
    this.paused = false; this.speed = 1; try { const v = +localStorage.getItem(KEY + '-spd'); if (v === 2 || v === 4) this.speed = v; } catch (e) {}
    this.slot = 1; try { this.slot = Math.max(1, Math.min(SLOTS, +localStorage.getItem(KEY + '-slot') || 1)); } catch (e) {}
    this.syncSpeed();
    this.audio = new Sound();
    const un = () => this.audio.unlock();
    window.addEventListener('pointerdown', un, true); window.addEventListener('keydown', un, true);
    let q = null; try { q = localStorage.getItem(KEY + '-q'); } catch (e) {}
    this.quality = ['low', 'high', 'ultra'].includes(q) ? q : (this.view.lowEnd ? 'low' : 'high');
    try { this.noAuto = !!localStorage.getItem(KEY + '-noauto'); } catch (e) {}
    // 开场标题画面（测试脚本会设 -notitle 跳过）
    this.titleOn = true; try { if (localStorage.getItem(KEY + '-notitle')) this.titleOn = false; } catch (e) {}
    this.place = null; this.mode = null; this.scoutTarget = null;
    this.acc = 0; this.saveT = 0; this.uiT = 0; this.badgeT = 0; this.bootT = performance.now();
    this.load();
    this.setQuality(this.quality);
    if (this.titleOn) this.ui.showTitle(this.hadSave);
    this.bindInput();
    window.addEventListener('resize', () => this.view.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); else this.resume(); this.audio.wake(); });
    window.addEventListener('pagehide', () => this.save());
    this.last = performance.now();
    requestAnimationFrame(t => this.loop(t));
  }

  // ---------- 存档 ----------
  load() {
    let S = null;
    try { const raw = localStorage.getItem(slotKey(this.slot)); if (raw) S = Sim.deserialize(raw); } catch (e) { console.warn(e); }
    this.hadSave = !!S;
    if (S) {
      if ((S.meta.ver || 0) < WHATS_NEW) this.whatsNew = true; // 老存档：找个空当说一下这版加了什么（弹出来才记下看过）
      this.S = S;
      this.view.bind(S);
      const away = (Date.now() - S.savedAt) / 1000;
      if (away > 20) this.offline(away);
    } else {
      const meta = Sim.defaultMeta();
      try { const d = localStorage.getItem(KEY + '-newdiff'); if (d) { meta.diff = d; localStorage.removeItem(KEY + '-newdiff'); } } catch (e) {}
      meta.ver = WHATS_NEW;
      this.S = Sim.newRun(meta, 0);
      this.view.bind(this.S);
      this.view.zoom(0.9);
      this.modalOrLater(`<h2>序 · 余烬</h2><p class="story">${STORY.intro}</p><p>你带着几个人来到<b>灰烬营地</b>。先让熔炉烧起来，盖帐篷、伐木、打猎，然后一程一程往北走。</p><p class="hint">提示：点底部的「建造」开始；不知道怎么玩时打开「菜单 → 怎么玩」。难度：${Sim.diffOf(this.S).n}（菜单里随时能改）。</p>`, [{ t: '点起篝火', a: 'start', cls: 'go' }]);
    }
  }
  // 标题画面还开着时，弹窗先存起来，点「继续」后再弹
  modalOrLater(html, btns) { if (this.titleOn) this.pendingModal = [html, btns]; else this.ui.modal(html, btns); }
  leaveTitle() {
    if (!this.titleOn) return;
    this.titleOn = false;
    this.ui.hideTitle();
    const v = this.view, c = Sim.getCamp(this.S, this.S.active) || this.S.camps[0];
    v.cam.tyaw = Math.round(v.cam.yaw / (Math.PI * 2)) * Math.PI * 2;
    v.cam.tdist = this.titleDist || 30; v.focus(c.x, c.y);
    if (this.pendingModal) { const [h, b] = this.pendingModal; this.pendingModal = null; setTimeout(() => this.ui.modal(h, b), 450); }
    if (this.bookLater) this.flushBook(2200);
    this.sfx('tap');
  }
  save() {
    if (this.noSave) return; // 正在换存档位 / 删存档并刷新：别把当前的局又写回去
    try { this.S.savedAt = Date.now(); localStorage.setItem(slotKey(this.slot), Sim.serialize(this.S)); } catch (e) { console.warn('save failed', e); }
  }
  // 存档位一览：读出每个位置的营地名、人口、天数、难度、上次保存时间
  slotInfo(n) {
    if (n === this.slot) { const S = this.S, c = Sim.getCamp(S, S.active) || S.camps[0]; return { n, cur: true, name: c.name, people: S.camps.reduce((a, x) => a + x.people, 0), t: S.t, runs: S.meta.runs || 1, diff: Sim.diffOf(S), savedAt: Date.now(), embers: S.meta.embers }; }
    let raw = null; try { raw = localStorage.getItem(slotKey(n)); } catch (e) {}
    if (!raw) return { n, empty: true };
    try { const o = JSON.parse(raw), c = o.camps.find(x => x.id === o.active) || o.camps[0]; return { n, name: c.name, people: o.camps.reduce((a, x) => a + x.people, 0), t: o.t, runs: (o.meta && o.meta.runs) || 1, diff: Sim.diffOf(o), savedAt: o.savedAt, embers: o.meta && o.meta.embers }; }
    catch (e) { return { n, broken: true }; }
  }
  // 换到另一个存档位（diff 给了就是在那里开新的一局，原来的会被覆盖）
  useSlot(n, diff) {
    this.save();
    try {
      if (diff) { localStorage.removeItem(slotKey(n)); localStorage.setItem(KEY + '-newdiff', diff); }
      localStorage.setItem(KEY + '-slot', String(n));
    } catch (e) { this.ui.toast('存档位切换失败：' + e.message, 'bad'); return; }
    this.noSave = true;
    location.reload();
  }
  deleteSlot(n) { if (n === this.slot) return; try { localStorage.removeItem(slotKey(n)); } catch (e) {} }
  offline(secs) {
    const S = this.S;
    const t0 = performance.now();
    const sum = Sim.catchUp(S, secs);
    this.drainFx(true);
    const gained = Object.keys(sum.res).filter(k => sum.res[k] > 0).sort((a, b) => RES[b].t - RES[a].t || sum.res[b] - sum.res[a]).slice(0, 8);
    const lost = Object.keys(sum.res).filter(k => sum.res[k] < 0).slice(0, 5);
    if (secs < 120) return;
    this.modalOrLater(`<h3>离开了 ${fmtTime(secs)}</h3>
      <p>营地一直在运转。离线时物资只按 <b>${Math.round(sum.rate * 100)}%</b> 入库（人照样要吃饭烧火），在线玩收益最高：</p>
      <div class="sumgrid">${gained.map(k => `<span>${RICON[k]} +${fmt(sum.res[k])}</span>`).join('')}${lost.map(k => `<span class="miss">${RICON[k]} ${fmt(sum.res[k])}</span>`).join('')}</div>
      <p>👥 人口 ${sum.people >= 0 ? '+' : ''}${sum.people}（投奔 ${sum.arrivals}，遇难 ${sum.deaths}）</p>
      ${sum.blizzards ? `<p>❄ 经历了 ${sum.blizzards} 场暴风雪</p>` : ''}
      ${sum.raids ? `<p>🐺 袭营 ${sum.raids} 次，击退 ${sum.raidsWon} 次</p>` : ''}
      <p class="hint">（结算用了 ${Math.round(performance.now() - t0)} 毫秒）</p>`);
  }
  resume() {
    const now = performance.now();
    const away = (now - this.last) / 1000;
    this.last = now;
    if (away > 5) this.offline(away);
  }
  async exportCode() {
    this.save();
    let raw = null; try { raw = localStorage.getItem(slotKey(this.slot)); } catch (e) {}
    if (!raw) raw = Sim.serialize(this.S);
    let code;
    try {
      const cs = new CompressionStream('deflate-raw');
      const buf = await new Response(new Blob([raw]).stream().pipeThrough(cs)).arrayBuffer();
      let bin = ''; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
      code = 'HJZ1:' + btoa(bin);
    } catch (e) { code = 'HJB1:' + btoa(unescape(encodeURIComponent(raw))); }
    this.ui.modal(`<p>存档码（${fmt(code.length)} 字）：在另一台设备上「导入存档码」。</p><textarea id="exportBox" rows="6" readonly>${code}</textarea>`, [{ t: '复制', a: 'copy', cls: 'go' }, { t: '关闭', a: 'close-modal' }]);
  }
  async importCode(code) {
    code = (code || '').trim();
    try {
      let raw;
      if (code.startsWith('HJZ1:')) {
        const bin = atob(code.slice(5)); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        raw = await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
      } else if (code.startsWith('HJB1:')) raw = decodeURIComponent(escape(atob(code.slice(5))));
      else throw new Error('不是存档码');
      const S = Sim.deserialize(raw);
      this.S = S; this.view.bind(S); this.cancelModes();
      this.ui.closeModal(); this.ui.close();
      const away = (Date.now() - S.savedAt) / 1000;
      if (away > 20) this.offline(away);
      this.save();
      this.ui.toast('存档已导入', 'good');
    } catch (e) { this.ui.toast('导入失败：' + e.message, 'bad'); }
  }
  wipe(diff) { try { localStorage.removeItem(slotKey(this.slot)); if (diff) localStorage.setItem(KEY + '-newdiff', diff); } catch (e) {} this.noSave = true; location.reload(); }
  setQuality(q, auto) {
    this.quality = q;
    try { localStorage.setItem(KEY + '-q', q); } catch (e) {}
    this.view.setQuality(q);
    this.perf = { t: 0, sum: 0, n: 0, wait: auto ? 12 : 6 };
  }
  // 连续几秒帧率太低就自动降一档（只降不升）
  watchPerf(realGap) {
    const P = this.perf; if (!P || this.noAuto || this.quality === 'low' || document.hidden) return;
    if (realGap > 2.5) { P.t = 0; P.sum = 0; P.n = 0; return; } // 切后台回来、离线结算这类停顿不算
    if (P.wait > 0) { P.wait -= realGap; return; }
    P.t += realGap; P.sum += realGap; P.n++;
    if (P.t < 6) return;
    const avg = P.sum / P.n;
    P.t = 0; P.sum = 0; P.n = 0;
    if (avg > 1 / 22) {
      const to = this.quality === 'ultra' ? 'high' : 'low';
      this.setQuality(to, true);
      this.ui.toast(`画面有点卡，已自动切到「${to === 'high' ? '标准' : '流畅'}」画质（菜单里可以改回来）。`, 'info');
      if (this.ui.panel && this.ui.panel.kind === 'menu') this.ui.renderPanel(true);
    }
  }
  migrate(site) {
    this.S = Sim.migrate(this.S, site);
    this.view.bind(this.S);
    this.save();
    this.ui.toast(`从「${LANDMARKS[site].n}」重新出发。`, 'story');
  }

  // ---------- 暂停 / 倍速 ----------
  // 1× → 2× → 4× 循环
  nextSpeed() { return this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1; }
  setSpeed(n) { this.speed = n === 2 || n === 4 ? n : 1; try { localStorage.setItem(KEY + '-spd', String(this.speed)); } catch (e) {} if (this.paused) this.paused = false; this.syncSpeed(); }
  togglePause(on) { this.paused = on ?? !this.paused; this.syncSpeed(); }
  syncSpeed() {
    document.body.classList.toggle('paused', !!this.paused);
    const b = document.getElementById('speedBtn'); b.classList.toggle('on', this.speed > 1); b.classList.toggle('x4', this.speed === 4); b.querySelector('i').textContent = this.speed + '×';
    b.title = this.speed === 4 ? '正在 4 倍速（点一下回到 1 倍速，电脑按 F）' : this.speed === 2 ? '正在 2 倍速（点一下换 4 倍速，电脑按 F）' : '加速到 2 倍速（电脑按 F）';
    document.getElementById('pauseBtn').title = this.paused ? '继续（P）' : '暂停（P）';
    this.view.timeScale = this.paused ? 0 : this.speed;
    if (this.photo && this.photo.on) this.photo.draw();
  }
  // 加速时袭击快到了，自动切回 1 倍速，免得来不及反应
  raidSlow() {
    if (this.speed === 1 || this.paused) return;
    const nr = Sim.nextRaid(this.S); if (!nr || nr.in > 60) return;
    const key = Math.round(this.S.t + nr.in);
    if (this.raidSlowKey === key) return;
    this.raidSlowKey = key; this.setSpeed(1);
    this.ui.toast('🐺 袭击快到了，已切回 1 倍速。', 'warn');
  }

  // ---------- 主循环 ----------
  loop(t) {
    // 90/120Hz 高刷屏上限 60 帧左右：看不出差别，手机省电、不烫
    if (this.last && t - this.last < 10) { requestAnimationFrame(tt => this.loop(tt)); return; }
    const dt = Math.min(0.25, (t - this.last) / 1000);
    const realGap = (t - this.last) / 1000;
    this.last = t;
    if (realGap > 5) this.offline(realGap);
    else if (!this.paused) {
      this.acc += dt * this.speed;
      let n = 0;
      while (this.acc >= 1 && n < 5 * this.speed) { Sim.step(this.S, 1); this.acc -= 1; n++; }
    }
    this.drainFx();
    if (this.titleOn) { const cam = this.view.cam; cam.tyaw += dt * 0.045; }
    this.view.frame(dt);
    this.ui.floats(this.paused ? 0 : dt * this.speed); this.ui.juice();
    this.hints.tick(dt);
    this.watchPerf(realGap);
    this.sndT = (this.sndT || 0) + dt;
    if (this.sndT > 0.25 || !this.sndInfo) { this.sndT = 0; this.sndInfo = this.view.audioInfo(); }
    this.audio.update(dt, this.sndInfo);
    this.uiT += dt; this.badgeT += dt; this.saveT += dt;
    if (this.uiT > 0.3) { this.uiT = 0; this.ui.hud(); this.ui.renderPanel(); if (this.place) this.updateGhost(); this.raidSlow(); }
    if (this.badgeT > 0.05) { this.badgeT = 0; this.ui.badges(); }
    // 随机事件：玩家在线、没在摆放、没有弹窗、过了新手期才出
    this.evT = (this.evT || 0) + dt;
    if (this.evT > 2) {
      this.evT = 0;
      const S = this.S;
      const free = !this.titleOn && !this.place && !document.getElementById('modal').classList.contains('show');
      const grown = S.meta.tut || S.buildings.length > 8;
      if (!this.titleOn && !window.__noEvents) { if (grown) Sim.rollRequest(S); Sim.rollSurprise(S, grown); }
      if (free && this.whatsNew) { this.whatsNew = false; S.meta.ver = WHATS_NEW; this.ui.modal(WHATS_NEW_HTML, [{ t: '知道了', a: 'close-modal', cls: 'go' }]); }
      else if (free && Sim.expPending(S)) { if (this.ui.siteModal()) this.sfx('event'); }
      else if (free && this.chapQ && this.chapQ.length) { if (this.ui.chapterModal(this.chapQ.shift())) this.sfx('win'); }
      else if (free && !this.paused && !window.__noEvents && (S.meta.tut || S.buildings.length > 8) && Sim.rollEvent(S)) { if (this.ui.eventModal()) this.sfx('event'); }
    }
    if (this.saveT > SAVE_EVERY) { this.saveT = 0; this.save(); }
    requestAnimationFrame(tt => this.loop(tt));
  }
  drainFx(quiet) {
    const R = Sim.rt(this.S);
    const fx = R.fx; R.fx = [];
    let toasts = 0;
    for (const f of fx) {
      if (f.kind === 'toast') { if (!quiet && toasts++ < 4) this.ui.toast(f.msg, f.type, f.act); }
      else if (f.kind === 'raid') { if (!quiet) { this.view.onFx(f); this.sfx('horn'); setTimeout(() => this.sfx(f.won ? 'win' : 'lose'), 2600); } }
      else if (f.kind === 'chapter') { (this.chapQ = this.chapQ || []).push(f.i); }
      else if (f.kind === 'qbuilt') { if (!quiet) this.sfx('build'); }
      else if (f.kind === 'far') { if (!quiet) { this.sfx(f.lit ? 'win' : 'event'); if (f.lit && !f.had) this.ui.relicModal(f.i); } }
      else if (f.kind === 'vein') { if (!quiet) { this.sfx('event'); const x = f.i % W, y = Math.floor(f.i / W); this.view.burst('dust', x + 0.5, y + 0.5, 30, 0.8, 1.2); this.view.ringFx && this.view.ringFx(x + 0.5, y + 0.5, 1.4); } }
      else if (f.kind === 'req') { if (!quiet) { this.sfx('tap'); const r = (this.S.reqs || []).find(x => x.id === f.id); if (r) this.ui.toast(`📜 ${this.ui.reqWho(r).name}有个心愿：${Sim.reqTitle(this.S, r)}`, 'info', { act: 'req', arg: r.id, label: '看看' }); } }
      else if (f.kind === 'reqdone') { if (!quiet) { this.sfx('win'); const c = Sim.getCamp(this.S, f.camp); if (c) this.view.ringFx && this.view.ringFx(c.x, c.y, 2.5); } }
      else if (f.kind === 'aurora') { if (!quiet) this.sfx('event'); }
      else if (f.kind === 'sur') { if (!quiet) { this.sfx('event'); const u = f.sur; if (u.kind === 'meteor') this.view.meteorFx = { t: 0, x: u.x, y: u.y }; this.ui.toast(u.kind === 'deer' ? '🦌 营地边上来了一头走失的驯鹿，去把它领回来' : '☄ 一颗流星落在营地附近，坑里可能有好东西', 'info', { act: 'surgo', label: '去看看' }); } }
      else if (f.kind === 'surdone') { if (!quiet) { this.sfx('win'); this.view.ringFx && this.view.ringFx(f.sur.x + 0.5, f.sur.y + 0.5, 1.6); this.view.burst(f.sur.kind === 'deer' ? 'dust' : 'spark', f.sur.x + 0.5, f.sur.y + 0.5, 24, 0.8, 1.2); } }
      else if (f.kind === 'book') this.bookFx(f);
      else if (f.kind === 'fest') { if (!quiet) { this.sfx('win'); const c = Sim.getCamp(this.S, f.camp), L = c && this.view.lifeSpots(c); if (L && L.fest) for (let k = 0; k < 4; k++) setTimeout(() => this.view.burst('spark', L.fest[0] + (Math.random() - 0.5) * 2, L.fest[1] + (Math.random() - 0.5) * 2, 30, 0.3, 2.5 + Math.random()), k * 450); } }
      else if (f.kind === 'festdone') { if (!quiet) { this.sfx('up'); const c = Sim.getCamp(this.S, f.camp); if (c) this.view.ringFx && this.view.ringFx(c.x, c.y, 3); } } // 离线补算时达成的也报一下
      else if (f.kind === 'odstall') { if (!quiet) { this.sfx('lose'); const c = Sim.getCamp(this.S, f.camp); if (c) this.view.burst('dust', c.x, c.y, 30, 1.2, 2.5); } }
      else if (f.kind === 'star' || f.kind === 'mile') { if (!quiet) { this.sfx('win'); const c = Sim.mainCamp(this.S); if (c) this.fireworks(c.x, c.y, f.kind === 'star' ? 3 + f.star * 2 : 4); } }
      else if (f.kind === 'depart') { if (!quiet) this.sfx('horn'); }
      else if (f.kind === 'trip-arrived') { if (!quiet) this.sfx('event'); }
      else if (f.kind === 'arrive-stop') { if (!quiet) { this.sfx('win'); const c = Sim.mainCamp(this.S); if (c) { this.view.focus(c.x, c.y); this.fireworks(c.x, c.y, 6); } } }
      else if (f.kind === 'ending') this.ui.modal(`<h2>🌟 永恒之炉重燃</h2><p class="story">${STORY.ending}</p><p>你用了 ${this.S.meta.runs} 次北行完成了旅程。车队可以接着往北走，世界之脊还在更远的地方；也可以在菜单里开始一次新的北行。</p>`, [{ t: '继续', a: 'ending', cls: 'go' }]);
    }
  }
  sfx(name) { this.audio.play(name); }
  // 烟花：营地上空一阵一阵的火花
  fireworks(x, y, n) {
    for (let k = 0; k < n; k++) setTimeout(() => { const a = Math.random() * 6.28, r = 2 + Math.random() * 5; this.view.burst('spark', x + Math.cos(a) * r, y + Math.sin(a) * r, 26, 1.4, 2.2); if (this.view.ringFx && k % 2 === 0) this.view.ringFx(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.2); }, k * 380);
  }
  // 收集册：成就单独报（有余烬），其余新进册的合成一条
  bookFx(f) {
    // 标题画面还开着（或刚读档）时先攒着，进游戏后再报，免得提示在看不见的时候就过期了
    if (this.photo && this.photo.on) { (this.bookLater ||= []).push(f); return; } // 拍照时不弹提示，退出后再报
    if (this.titleOn || performance.now() - this.bootT < 2500) { (this.bookLater ||= []).push(f); if (!this.titleOn) this.flushBook(1500); return; }
    const ach = f.add.filter(a => a[0] === 'a'), ent = f.add.filter(a => a[0] !== 'a');
    if (f.first) { if (f.add.length > 8 || ach.length) this.ui.toast(`🏆 收集册开张了：补记了 ${ent.length} 项收集${ach.length ? `、${ach.length} 个成就（余烬 +${f.em}）` : ''}`, 'good', { act: 'book', arg: ach.length ? 'a' : 'b', label: '翻翻看' }); return; }
    for (const [, id] of ach.slice(0, 3)) { const a = Sim.ACH.find(x => x.id === id); this.ui.toast(`🏆 成就达成「${a.n}」：${a.d}（余烬 +${a.rw}）`, 'good', { act: 'book', arg: 'a', label: '看看' }); }
    if (ach.length) this.sfx('win');
    if (ent.length) this.ui.toast(`📖 收集册新添：${ent.slice(0, 3).map(([c, id]) => Sim.bookName(c, id)).join('、')}${ent.length > 3 ? ` 等 ${ent.length} 项` : ''}`, 'info', { act: 'book', arg: ent[0][0], label: '看看' });
  }
  flushBook(ms) {
    clearTimeout(this.bookT);
    this.bookT = setTimeout(() => {
      const L = this.bookLater || []; this.bookLater = null; if (!L.length) return;
      // 合成一条：开张补记 + 期间达成的
      const add = L.flatMap(f => f.add), em = L.reduce((a, f) => a + (f.em || 0), 0);
      this.bootT = -1e9; this.bookFx({ kind: 'book', add, em, first: L.some(f => f.first) });
    }, ms);
  }


  // ---------- 摆放 ----------
  startPlace(type) {
    const c = Sim.getCamp(this.S, this.S.active) || this.S.camps[0];
    const v = this.view;
    let x = Math.round(v.cam.tx) - 1, y = Math.round(v.cam.ty) - 1;
    if (type === 'furnace') { y = Math.round(c.y + 22); x = Math.round(c.x); v.focus(x, y); }
    // 预览先放到镜头附近一个能建的位置（采集建筑优先找资源点多的地方）
    if (type !== 'furnace') {
      let best = null, bs = -1e9;
      const gather = !!BLD[type].gather;
      for (let r = 0; r <= 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const ck = Sim.checkPlace(this.S, type, x + dx, y + dy);
        if (!ck.ok && !ck.soft) continue;
        const sc = (gather ? ck.spots * 3 : 0) + ck.syn * 2 - r * 0.6 - ck.dist * 0.3;
        if (sc > bs) { bs = sc; best = [x + dx, y + dy]; }
      }
      if (best) { x = best[0]; y = best[1]; }
    }
    this.place = { type, x, y, check: null, end: null, rowMode: !!(this.rowPref && type !== 'furnace') };
    this.mode = 'place';
    { const rb = document.getElementById('placeRow'); rb.style.display = this.isTouch() && type !== 'furnace' ? '' : 'none'; rb.classList.toggle('on', this.place.rowMode); }
    document.body.classList.add('placing');
    document.getElementById('placeName').textContent = type === 'furnace' ? '前哨熔炉' : BLD[type].n;
    const tc = this.ui.thumb(type, type === 'furnace' ? 2 : 1);
    document.getElementById('placePic').innerHTML = tc ? `<i class="th ${tc}"></i>` : iconize(ICON[type]);
    this.updateGhost();
  }
  isTouch() { return this.touchSeen || this.view.lowEnd || matchMedia('(pointer:coarse)').matches; }
  // 拖出来的一排（第一栋就是预览本身）
  rowSlots() {
    const P = this.place; if (!P || !P.end || P.type === 'furnace') return null;
    const sl = Sim.rowSlots(P.type, P.x, P.y, P.end.x, P.end.y);
    return sl.length > 1 ? sl : null;
  }
  updateGhost() {
    const P = this.place; if (!P) return;
    const slots = this.rowSlots();
    if (slots) { this.updateRow(slots); return; }
    P.plan = null;
    P.check = Sim.checkPlace(this.S, P.type, P.x, P.y);
    let storage = null;
    if (P.check.camp >= 0 && P.type !== 'furnace') {
      const s = BLD[P.type].size, cx = P.x + s / 2, cy = P.y + s / 2;
      let bd = 1e9;
      for (const b of this.S.buildings) if (b.camp === P.check.camp && (b.type === 'furnace' || b.type === 'warehouse')) { const ss = BLD[b.type].size; const d = Math.hypot(b.x + ss / 2 - cx, b.y + ss / 2 - cy); if (d < bd) { bd = d; storage = { x: b.x + ss / 2, y: b.y + ss / 2 }; } }
    }
    this.view.setGhost({ type: P.type, x: P.x, y: P.y, ok: P.check.ok, soft: P.check.soft, storage });
    const btn = document.getElementById('placeOk');
    const canQ = !P.check.ok && P.check.soft && P.type !== 'furnace';
    btn.disabled = !P.check.ok && !canQ; btn.classList.toggle('q', canQ); btn.title = canQ ? '加入建造队列' : '确认建造';
    const costHtml = P.check.cost ? Object.keys(P.check.cost).map(k => `<span class="${(this.S.camps.find(c => c.id === P.check.camp) || {stock: {}}).stock[k] >= P.check.cost[k] ? '' : 'miss'}">${RICON[k]}${fmt(P.check.cost[k])}</span>`).join(' ') : '';
    const touch = this.view.lowEnd || matchMedia('(pointer:coarse)').matches;
    const why = P.check.ok ? (P.check.clears ? `<span class="pwarn">会清掉 ${P.check.clears} 处树木/碎石</span>` : `<span class="pok">${touch ? '再点一次或按 ✓ 建造' : '点击地面建造'}</span>`)
      : canQ ? `<span class="pwarn">${P.check.reason} · ${touch ? '再点一次或按 ✓' : '点击地面'}排进建造队列，材料到了自动开工</span>` : `<span class="pbad">${P.check.reason}</span>`;
    const rowTip = P.type !== 'furnace' && (P.check.ok || canQ) ? (touch ? (P.rowMode ? ' · 拖动拉出一排' : '') : ' · 按住拖动连成一排') : '';
    document.getElementById('placeCost').innerHTML = iconize(`${costHtml}<br>${why}${rowTip ? `<span class="pok">${rowTip}</span>` : ''}`);
  }
  // 一排的预览：每栋各自显示能建（绿）/ 排队（黄）/ 不能建（红），底下合计花费
  updateRow(slots) {
    const P = this.place, S = this.S, pl = Sim.rowPlan(S, P.type, slots);
    P.plan = pl; P.check = Sim.checkPlace(S, P.type, P.x, P.y);
    const st = e => ({ ok: e.st === 'ok', soft: e.st === 'q' });
    this.view.setGhost({ type: P.type, x: P.x, y: P.y, ...st(pl.plan[0]), row: pl.plan.slice(1).map(e => ({ x: e.x, y: e.y, ...st(e) })) });
    const btn = document.getElementById('placeOk');
    btn.disabled = !pl.ok && !pl.q; btn.classList.toggle('q', !pl.ok && pl.q > 0); btn.title = '把这一排都建上';
    const camp = Sim.getCamp(S, (pl.plan.find(e => e.camp != null) || {}).camp ?? S.active) || { stock: {} };
    const costHtml = Object.keys(pl.total).map(k => `<span class="${(camp.stock[k] || 0) >= pl.total[k] ? '' : 'miss'}">${RICON[k]}${fmt(pl.total[k])}</span>`).join(' ');
    const parts = [pl.ok && `<span class="pok">马上建 ${pl.ok} 栋</span>`, pl.q && `<span class="pwarn">排队 ${pl.q} 栋</span>`, pl.bad && `<span class="pbad">${pl.bad} 处不能建</span>`].filter(Boolean).join(' · ');
    const touch = this.isTouch();
    document.getElementById('placeCost').innerHTML = iconize(`一排 ${slots.length} 栋 · ${costHtml}<br>${parts}${pl.ok || pl.q ? ` · ${touch ? '按 ✓ 建这一排' : '松开就建'}` : ''}`);
  }
  confirmRow() {
    const P = this.place, slots = this.rowSlots(); if (!slots) return false;
    const r = Sim.placeRow(this.S, P.type, slots), n = BLD[P.type].n;
    P.end = null;
    if (!r.built && !r.queued) { this.ui.toast(r.reason || '这一排都建不了', 'warn'); this.sfx('warn'); this.updateGhost(); return true; }
    this.sfx(r.built ? 'build' : 'tap');
    const msg = [r.built && `建好 ${r.built} 栋${n}`, r.queued && `${r.queued} 栋排进建造队列（材料到齐自动开工）`, r.failed && `${r.failed} 处建不了`].filter(Boolean).join('，');
    this.ui.toast(msg + '。', r.failed ? 'warn' : 'good');
    this.updateGhost();
    return true;
  }
  ghostTile(px, py) {
    const P = this.place, p = this.view.pickTile(px, py); if (!P || !p) return null;
    const s = BLD[P.type].size;
    return { x: Math.floor(p.x - s / 2 + 0.5), y: Math.floor(p.y - s / 2 + 0.5) };
  }
  moveGhostTo(px, py) {
    const P = this.place, t = this.ghostTile(px, py); if (!t) return;
    if (t.x !== P.x || t.y !== P.y) { P.x = t.x; P.y = t.y; this.updateGhost(); }
  }
  // 拖一排：起点是预览所在的位置，终点跟着手指 / 鼠标
  rowTo(px, py) {
    const P = this.place, t = this.ghostTile(px, py); if (!t || P.type === 'furnace') return;
    if (!P.end || t.x !== P.end.x || t.y !== P.end.y) { P.end = t; this.updateGhost(); }
  }
  confirmPlace() {
    const P = this.place; if (!P) return;
    if (this.confirmRow()) return;
    const r = P.type === 'furnace' ? Sim.place(this.S, P.type, P.x, P.y) : Sim.queueBuild(this.S, P.type, P.x, P.y);
    if (!r.ok) { this.ui.toast(r.reason || '不能建在这里', 'warn'); this.sfx('warn'); return; }
    if (r.queued) { this.sfx('tap'); this.ui.toast(`${BLD[P.type].n}已排进建造队列：材料到齐自动开工。点地上的蓝图可以取消。`, 'info'); this.updateGhost(); return; }
    this.sfx('build');
    if (P.type === 'furnace') { this.cancelModes(); const c = Sim.getCamp(this.S, r.camp); this.view.focus(c.x, c.y); return; }
    // 连续建同一种：保持预览，方便再放一个
    this.updateGhost();
    const b = Sim.getB(this.S, r.id);
    if (b && Sim.maxWorkers(b.type, 1) && b.workers === 0) this.ui.toast(`${BLD[b.type].n}建好了，但没有空闲的人手：多建帐篷吸引新人，或在别的建筑减人。`, 'warn');
  }
  // 摆放模式下点地图：鼠标点哪建哪；触屏先把预览挪过去，再点一次同一处（或按 ✓）才建
  placeTap(px, py, mouse) {
    const P = this.place; if (!P) return;
    const ox = P.x, oy = P.y;
    this.moveGhostTo(px, py);
    const same = P.x === ox && P.y === oy;
    if (!same && P.end) { P.end = null; this.updateGhost(); }
    if (!mouse && same && this.rowSlots()) { this.confirmRow(); return; }
    if (mouse || same) {
      if (P.check && (P.check.ok || (P.check.soft && P.type !== 'furnace'))) this.confirmPlace();
      else if (P.check) this.ui.toast(P.check.reason || '不能建在这里', 'warn');
    }
  }
  startScoutPick() {
    this.cancelModes(true);
    this.mode = 'scout';
    this.ui.open('scout');
    this.ui.toast('在地图上点一个目标（迷雾里也可以）。', 'info');
  }
  cancelModes(keepPanel) {
    this.place = null; this.mode = null;
    document.body.classList.remove('placing');
    this.view.setGhost(null);
    if (!keepPanel) this.scoutTarget = null;
  }

  // ---------- 点地图 ----------
  tap(px, py, mouse) {
    const S = this.S, v = this.view;
    if (this.photo && this.photo.on) return; // 拍照模式里点地图不弹面板
    const p = v.pickTile(px, py); if (!p) return;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (this.mode === 'place') { this.placeTap(px, py, mouse); return; }
    if (this.mode === 'scout') {
      this.scoutTarget = { x: Math.max(0, Math.min(W - 1, tx)), y: Math.max(0, Math.min(H - 1, ty)) };
      this.ui.open('scout');
      return;
    }
    const bid = Sim.occAt(S, tx, ty);
    if (Sim.caravanAt(S, tx, ty)) { v.select(null); this.ui.open('caravan'); return; }
    { const far = getWorld(S.runSeed).far || []; const fi = far.findIndex((q, i) => S.reveal[idx(q.x, q.y)] && Math.hypot(p.x - q.x - 0.5, p.y - q.y - 0.5) < FAR_MARKS[i].r + 0.5); if (fi >= 0) { v.select(null); this.ui.open('far', fi); return; } }
    if (bid < 0 && bid !== -1) { v.select(null); this.ui.open('queue', -bid); return; }
    // 点到小人：看这个人是谁、在干什么、过得怎么样（点在建筑上时要点得更准才算）
    const fig = v.pickFig(px, py);
    if (fig && (bid <= 0 || fig.d < 7)) { v.select(null); if (fig.k === 'r') this.ui.open('req', fig.i); else this.ui.open('person', fig); return; }
    if (bid > 0) {
      const b = Sim.getB(S, bid);
      if (b && b.camp !== S.active) S.active = b.camp;
      v.select(bid); this.ui.open('bld', bid); return;
    }
    // 地标
    for (let i = 1; i < LANDMARKS.length; i++) {
      const l = LANDMARKS[i];
      if (S.discovered.includes(i) && Math.hypot(p.x - (l.x + 0.5), p.y - (l.row + 0.5)) < (i === 6 ? 4.5 : 2.6)) { v.select(null); this.ui.open('landmark', i); return; }
    }
    // 幸存者、雾里的地点
    const w = getWorld(S.runSeed);
    for (const q of w.sites || []) if (S.reveal[idx(q.x, q.y)] && Math.hypot(p.x - q.x - 0.5, p.y - q.y - 0.5) < 1.6) { v.select(null); if (Sim.siteState(S, q) === 'wait') this.ui.siteModal(); else this.ui.open('site', q.id); return; }
    for (const id in S.poiFound) { const po = w.pois.find(q => q.id === +id); if (po && Math.hypot(p.x - po.x - 0.5, p.y - po.y - 0.5) < 1.5) { this.ui.open('scout'); return; } }
    if (tx >= 0 && ty >= 0 && tx < W && ty < H && S.reveal[idx(tx, ty)] && w.spot[idx(tx, ty)] >= 0 && Sim.spotLeft(S, idx(tx, ty)) > 0) { v.select(null); this.ui.open('spot', idx(tx, ty)); return; }
    v.select(null);
    if (this.ui.panel && (this.ui.panel.kind === 'bld' || this.ui.panel.kind === 'spot' || this.ui.panel.kind === 'landmark')) this.ui.close();
  }

  // ---------- 输入 ----------
  bindInput() {
    const cv = this.canvas, v = this.view;
    const ptrs = new Map();
    let downAt = null, moved = 0, lastPinch = null, dragGhost = false, ghostAt = null, rowDrag = false;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { }
      if (this.ui.resOpen) this.ui.resDrawer(false);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, type: e.pointerType });
      if (e.pointerType === 'touch') this.touchSeen = true;
      if (ptrs.size === 1) {
        downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0;
        const P = this.mode === 'place' ? this.place : null;
        // 摆放时：鼠标左键按住拖 = 连成一排；触屏单指拖动的是预览建筑（开了「一排」就是往外拉一排）
        rowDrag = !!P && P.type !== 'furnace' && (e.pointerType === 'mouse' ? e.button === 0 && !e.shiftKey : P.rowMode);
        dragGhost = !!P && e.pointerType !== 'mouse' && !rowDrag;
        ghostAt = P ? { x: P.x, y: P.y, end: P.end } : null;
        if (rowDrag && e.pointerType === 'mouse') { const had = P.end; P.end = null; this.moveGhostTo(e.clientX, e.clientY); if (had) this.updateGhost(); }
      } else {
        lastPinch = null;
        // 第二根手指落下：这是在调镜头，预览放回原处
        if ((dragGhost || rowDrag) && ghostAt && this.place) { this.place.x = ghostAt.x; this.place.y = ghostAt.y; this.place.end = ghostAt.end; this.updateGhost(); }
        dragGhost = false; rowDrag = false;
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p) {
        // 鼠标悬停：预览跟着鼠标
        if (this.mode === 'place' && e.pointerType === 'mouse') this.moveGhostTo(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 1) {
        if (dragGhost) { this.moveGhostTo(e.clientX, e.clientY - 50); return; }
        if (rowDrag) { if (moved > 6 && this.place) this.rowTo(e.clientX, e.pointerType === 'mouse' ? e.clientY : e.clientY - 50); return; }
        if (p.b === 2 || (p.b === 0 && e.shiftKey)) { v.rotate(-dx * 0.008); return; }
        if (this.mode === 'place' && e.pointerType === 'mouse' && moved > 6) { /* 鼠标拖动 = 平移 */ }
        if (moved > 6) v.pan(dx, dy);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (lastPinch) {
          v.pan(cx - lastPinch.cx, cy - lastPinch.cy);
          if (d > 10 && lastPinch.d > 10) v.zoom(lastPinch.d / d);
          let da = ang - lastPinch.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          v.rotate(-da);
        }
        lastPinch = { cx, cy, d, ang };
      }
    });
    const up = e => {
      const p = ptrs.get(e.pointerId);
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) lastPinch = null;
      if (!p || ptrs.size) return;
      if (downAt && moved < 8 && p.b === 2 && this.mode === 'place') { this.cancelModes(); dragGhost = false; rowDrag = false; return; }
      // 鼠标拖完一排：松开就建（拖回原处只剩一栋时按单击处理）
      if (rowDrag && moved >= 8 && this.place && p.type === 'mouse') {
        rowDrag = false;
        if (this.rowSlots()) this.confirmRow(); else { this.place.end = null; this.placeTap(e.clientX, e.clientY, true); }
        return;
      }
      if (downAt && moved < 8 && performance.now() - downAt.t < 600 && p.b !== 2) {
        this.tap(e.clientX, e.clientY, e.pointerType === 'mouse');
      }
      dragGhost = false; rowDrag = false;
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); v.zoom(Math.pow(1.0015, e.deltaY)); if (this.mode === 'place') this.moveGhostTo(e.clientX, e.clientY); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      const step = 40;
      // 拍照模式：只留镜头按键，Esc / H 退出，回车拍照
      if (this.photo.on && !['w', 's', 'a', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'p'].includes(k)) {
        if (k === 'escape' || k === 'h') { if (this.photo.pv.classList.contains('show')) this.photo.hidePreview(); else this.photo.close(); }
        else if (k === 'enter') this.photo.shoot();
        return;
      }
      if (k === 'w' || k === 'arrowup') v.pan(0, step);
      else if (k === 's' || k === 'arrowdown') v.pan(0, -step);
      else if (k === 'a' || k === 'arrowleft') v.pan(step, 0);
      else if (k === 'd' || k === 'arrowright') v.pan(-step, 0);
      else if (k === 'q') v.rotate(0.3);
      else if (k === 'e') v.rotate(-0.3);
      else if (k === 'escape') { if (this.bigmap.open) { this.bigmap.hide(); return; } if (this.chainmap.open) { this.chainmap.hide(); return; } this.cancelModes(); this.ui.close(); this.ui.resDrawer(false); }
      else if (k === 'enter' && this.mode === 'place') this.confirmPlace();
      else if (k === 'b') this.ui.open('build');
      else if (k === 'm') { if (this.chainmap.open) this.chainmap.hide(); this.bigmap.toggle(); }
      else if (k === 'c') this.chainmap.toggle();
      else if (k === 'h') this.photo.on ? this.photo.close() : this.photo.open();
      else if (k === 'g') { if (this.ui.panel && this.ui.panel.kind === 'curve') this.ui.close(); else { this.cancelModes(); this.ui.cvState().cid = this.S.active; this.ui.open('curve'); } }
      else if (k === 'k') { if (this.ui.panel && this.ui.panel.kind === 'book') this.ui.close(); else { this.ui.bookShown = {}; this.ui.open('book'); } }
      else if (k === 'p') this.togglePause();
      else if (k === 'f') this.setSpeed(this.nextSpeed());
      else if (k === ' ') { const c = Sim.getCamp(this.S, this.S.active); v.focus(c.x, c.y); }
    });
    document.getElementById('placeOk').addEventListener('click', () => this.confirmPlace());
    document.getElementById('placeNo').addEventListener('click', () => this.cancelModes());
    document.getElementById('placeRow').addEventListener('click', () => {
      const P = this.place; if (!P) return;
      P.rowMode = this.rowPref = !P.rowMode; if (!P.rowMode) P.end = null;
      document.getElementById('placeRow').classList.toggle('on', P.rowMode);
      if (P.rowMode) this.ui.toast('一排模式：按住预览往外拖，拉出一排同样的建筑，再按 ✓ 一起建。', 'info');
      this.updateGhost();
    });
    document.getElementById('homeBtn').addEventListener('click', () => { const c = Sim.getCamp(this.S, this.S.active); v.focus(c.x, c.y); v.cam.tyaw = Math.round(v.cam.tyaw / (Math.PI * 2)) * Math.PI * 2; });
    document.getElementById('zoomIn').addEventListener('click', () => v.zoom(0.8));
    document.getElementById('zoomOut').addEventListener('click', () => v.zoom(1.25));
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); window.__sim = Sim; window.__BLD = BLD; window.__dc = t => dayCycle(t).name; window.__world = () => getWorld(window.game.S.runSeed); window.__simstep = (n = 1) => { for (let i = 0; i < n; i++) Sim.step(window.game.S, 1); }; });
