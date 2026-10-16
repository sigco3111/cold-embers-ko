// 声音：全部用 WebAudio 现场合成（风、炉火、伐木、敲打、配乐、提示音），不需要任何音频文件
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PREF = 'hanjin-beixing-v1-snd';

export class Sound {
  constructor() {
    this.ctx = null;
    this.sfxOn = true; this.musicOn = true;
    try { const p = JSON.parse(localStorage.getItem(PREF) || '{}'); if (p.sfx === false) this.sfxOn = false; if (p.music === false) this.musicOn = false; } catch (e) {}
    this.gust = 0.6; this.gustT = 0.6; this.acc = { crackle: 0, chop: 0, pick: 0, clank: 0 };
    this.nextChord = 0; this.chordI = 0; this.nextNote = 0;
  }
  save() { try { localStorage.setItem(PREF, JSON.stringify({ sfx: this.sfxOn, music: this.musicOn })); } catch (e) {} }
  toggle(kind) {
    if (kind === 'music') this.musicOn = !this.musicOn; else this.sfxOn = !this.sfxOn;
    this.save();
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.8 : 0, t, 0.4);
      this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 1 : 0, t, 0.2);
      if (this.musicOn) this.nextChord = 0;
      this.wake();
    }
  }
  // 浏览器要求先有一次点击才能出声
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this.setup();
    }
    this.wake();
  }
  wake() {
    if (!this.ctx) return;
    const want = (this.sfxOn || this.musicOn) && !document.hidden;
    if (want && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!want && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  setup() {
    const c = this.ctx, t = c.currentTime;
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.sfxOn ? 1 : 0; this.sfxBus.connect(this.master);
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicOn ? 0.8 : 0; this.musicBus.connect(this.master);
    // 混响：用衰减的噪声生成一个简易空间
    const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    const vg = c.createGain(); vg.gain.value = 0.5; this.verb.connect(vg); vg.connect(this.master);
    // 噪声素材
    const n = c.sampleRate * 4;
    this.white = c.createBuffer(1, n, c.sampleRate); const w = this.white.getChannelData(0); for (let i = 0; i < n; i++) w[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, n, c.sampleRate); const b = this.brown.getChannelData(0); let l = 0;
    for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
    const loop = (buf, rate = 1) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(t, Math.random() * 3); return s; };
    // 风：低沉的呼啸 + 偶尔的尖啸
    this.windG = c.createGain(); this.windG.gain.value = 0;
    const wl = c.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 520;
    loop(this.brown).connect(wl); wl.connect(this.windG);
    this.whistleF = c.createBiquadFilter(); this.whistleF.type = 'bandpass'; this.whistleF.frequency.value = 800; this.whistleF.Q.value = 9;
    this.whistleG = c.createGain(); this.whistleG.gain.value = 0;
    loop(this.white).connect(this.whistleF); this.whistleF.connect(this.whistleG);
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { this.windPan = pan; this.windG.connect(pan); this.whistleG.connect(pan); pan.connect(this.sfxBus); } else { this.windG.connect(this.sfxBus); this.whistleG.connect(this.sfxBus); }
    // 熔炉：低频的轰鸣
    this.rumbleG = c.createGain(); this.rumbleG.gain.value = 0;
    const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 170;
    loop(this.brown, 0.7).connect(rl); rl.connect(this.rumbleG); this.rumbleG.connect(this.sfxBus);
    // 配乐：带回声的延迟线
    this.delay = c.createDelay(2); this.delay.delayTime.value = 0.46;
    const fb = c.createGain(); fb.gain.value = 0.38; const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.musicBus);
    this.mVerb = c.createGain(); this.mVerb.gain.value = 0.7; this.mVerb.connect(this.verb);
  }

  env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  noiseHit(t, dur, type, freq, q, peak, dest = this.sfxBus, rate = 1) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.white; s.playbackRate.value = rate;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, 0.003, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 3, dur + 0.05);
  }
  tone(t, freq, type, a, d, peak, dest = this.sfxBus, f1) {
    const c = this.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    const g = c.createGain(); this.env(g, t, a, peak, d);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + 0.05);
    return g;
  }

  // ---------- 环境声：每帧根据镜头附近的情况调 ----------
  update(dt, info) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime;
    if (this.sfxOn) {
      // 阵风：缓慢随机游走
      if (Math.random() < dt * 0.4) this.gustT = 0.35 + Math.random() * 0.75;
      this.gust += (this.gustT - this.gust) * Math.min(1, dt * 0.6);
      const high = Math.min(1, info.dist / 60);
      this.windG.gain.setTargetAtTime((0.05 + 0.08 * high + 0.22 * info.blizz) * this.gust, t, 0.3);
      this.whistleG.gain.setTargetAtTime((0.004 + 0.03 * info.blizz) * this.gust * this.gust, t, 0.3);
      this.whistleF.frequency.setTargetAtTime(600 + this.gust * 700, t, 0.5);
      if (this.windPan) this.windPan.pan.setTargetAtTime(Math.sin(t * 0.13) * 0.4, t, 0.5);
      this.rumbleG.gain.setTargetAtTime(info.near * 0.16, t, 0.3);
      // 一次性的声音按频率随机触发
      const fire = (k, rate, fn) => { this.acc[k] += dt * rate; while (this.acc[k] > 1) { this.acc[k] -= 1 + Math.random() * 0.6; fn(t + Math.random() * 0.12); } };
      fire('crackle', info.near * 16, tt => this.noiseHit(tt, 0.012 + Math.random() * 0.03, 'highpass', 1400 + Math.random() * 2500, 0.7, 0.02 + Math.random() * 0.07 * info.near, this.sfxBus, 0.6 + Math.random()));
      fire('chop', Math.min(2.2, info.chop * 1.1), tt => this.chop(tt, 0.4 + Math.random() * 0.6));
      fire('pick', Math.min(2.2, info.mine * 1.1), tt => this.pick(tt, 0.4 + Math.random() * 0.6));
      fire('clank', Math.min(1.8, info.ind * 0.8), tt => this.clank(tt, 0.4 + Math.random() * 0.6));
      if (info.fest > 0.02) this.festMusic(t, info.fest);
    }
    if (this.musicOn) this.music(t, info);
  }
  // 篝火庆典：鼓点 + 一段欢快的小调（离得越近越响）
  festMusic(t, v) {
    const B = 0.36;
    if (!this.festNext || this.festNext < t - 1) this.festNext = t + 0.05;
    while (this.festNext < t + 0.15) {
      const T = this.festNext, i = this.festI = (this.festI || 0) + 1;
      this.tone(T, i % 4 === 1 ? 92 : 128, 'sine', 0.002, 0.16, (i % 4 === 1 ? 0.22 : 0.12) * v, this.sfxBus, 50);
      if (i % 2 === 0) this.noiseHit(T, 0.05, 'bandpass', 1400, 1.1, 0.05 * v);
      const JIG = [74, 77, 79, 81, 79, 77, 74, 72, 74, 77, 81, 84, 81, 79, 77, 79, 74, 72, 69, 72, 74, 77, 74, 0];
      const m = JIG[i % JIG.length];
      if (m) { this.tone(T, mtof(m), 'triangle', 0.006, 0.26, 0.05 * v, this.sfxBus); this.tone(T, mtof(m) * 2.005, 'sine', 0.004, 0.12, 0.012 * v, this.sfxBus); }
      if (i % 8 === 7) this.noiseHit(T + B / 2, 0.03, 'highpass', 3000, 0.7, 0.04 * v); // 拍手
      this.festNext = T + B;
    }
  }
  chop(t, v) { // 斧头砍进木头：闷响 + 木屑
    this.tone(t, 190, 'triangle', 0.002, 0.11, 0.22 * v, this.sfxBus, 85);
    this.noiseHit(t, 0.05, 'bandpass', 1800, 1.2, 0.12 * v);
  }
  pick(t, v) { // 镐敲石头：清脆的叮
    this.tone(t, 1900 + Math.random() * 500, 'sine', 0.001, 0.09, 0.06 * v);
    this.noiseHit(t, 0.03, 'highpass', 3000, 0.8, 0.1 * v);
  }
  clank(t, v) { // 锤子敲铁：几个不成整数倍的泛音
    for (const [f, a] of [[520, 0.05], [1238, 0.035], [1810, 0.025], [2690, 0.015]]) this.tone(t, f * (0.97 + Math.random() * 0.06), 'sine', 0.001, 0.35, a * v);
    this.noiseHit(t, 0.02, 'highpass', 2500, 0.7, 0.05 * v);
  }

  // ---------- 配乐：D 小调的慢速铺底 + 稀疏的音盒旋律 ----------
  music(t, info) {
    const CH = [[38, 57, 60, 65], [34, 57, 62, 65], [41, 57, 60, 64], [36, 55, 62, 64]];
    if (t >= this.nextChord - 0.05) {
      const ch = CH[this.chordI++ % CH.length], T = Math.max(t, this.nextChord), D = 10;
      this.pad(T, ch, D);
      this.nextChord = T + D;
      this.cur = ch;
    }
    if (t >= this.nextNote) {
      const PENT = [62, 65, 67, 69, 72, 74, 77, 79];
      // 夜里旋律更稀疏、更低
      const night = info.nf || 0, pk = info.peak || 0, td = Math.min(1, info.tide || 0);
      // 炉火鼎盛：旋律更密、更亮，常常带一个往上走的回音；永冬潮：更稀、更低
      if (Math.random() < 0.62 - night * 0.2 + pk * 0.25 - td * 0.2) {
        const m = PENT[Math.min(PENT.length - 1, Math.floor(Math.random() * (PENT.length - night * 3 - td * 3)) + (pk && Math.random() < 0.4 ? 2 : 0))];
        this.bell(t + 0.02, m, 0.05 + Math.random() * 0.03);
        if (Math.random() < 0.25 + pk * 0.3) this.bell(t + 0.3, PENT[pk ? Math.min(PENT.length - 1, PENT.indexOf(m) + 1) : Math.max(0, PENT.indexOf(m) - 1)], 0.035);
      }
      this.nextNote = t + (1.3 + Math.random() * 2.6) * (1 - pk * 0.4) + night * 1.2 + td * 1.5;
    }
  }
  pad(t, notes, D) {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 0.5;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 180; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t); lfo.stop(t + D + 5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 3); g.gain.setValueAtTime(0.06, t + D - 1); g.gain.exponentialRampToValueAtTime(0.0001, t + D + 4);
    f.connect(g); g.connect(this.musicBus); g.connect(this.mVerb);
    notes.forEach((m, i) => {
      for (const det of i === 0 ? [0] : [-6, 6]) {
        const o = c.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
        const vg = c.createGain(); vg.gain.value = i === 0 ? 0.9 : 0.32;
        o.connect(vg); vg.connect(f); o.start(t); o.stop(t + D + 5);
      }
    });
  }
  bell(t, m, peak) {
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    g.connect(this.musicBus); g.connect(this.delay); g.connect(this.mVerb);
    for (const [k, a] of [[1, 1], [2, 0.25], [3.01, 0.08]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m) * k;
      const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 3);
    }
  }

  // ---------- 提示音 ----------
  // 一口钟：几个不成整数倍的泛音，长长地响，带混响
  sbell(t, m, peak, d = 2.6) {
    const c = this.ctx, g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    g.connect(this.sfxBus); g.connect(this.verb);
    for (const [k, a] of [[0.5, 0.35], [1, 1], [2, 0.32], [2.76, 0.16], [5.4, 0.05]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m) * k;
      const og = c.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.1);
    }
  }
  // 呼的一声：噪声慢慢涌起来，滤波往上扫（火焰腾起来）
  whoosh(t, a, d, f0, f1, peak) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.white;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + a); f.frequency.exponentialRampToValueAtTime(f0, t + a + d);
    const g = c.createGain(); this.env(g, t, a, peak, d);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); g.connect(this.verb);
    s.start(t, Math.random() * 3, a + d + 0.1);
  }
  // 低沉的长音（锯齿波过低通），天火过场垫底
  drone(t, ms, a, hold, d, peak) {
    const c = this.ctx, lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
    lp.connect(g); g.connect(this.sfxBus); g.connect(this.verb);
    for (const m of ms) for (const det of [-5, 5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + a + hold + d + 0.1); }
  }
  play(name, arg) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.01, out = this.sfxBus;
    const chime = (ms, gap, peak) => ms.forEach((m, i) => { const g = this.tone(t + i * gap, mtof(m), 'triangle', 0.005, 0.9, peak, out); g.connect(this.verb); });
    switch (name) {
      case 'build': this.tone(t, 120, 'sine', 0.002, 0.18, 0.3, out, 60); this.noiseHit(t, 0.12, 'lowpass', 900, 0.7, 0.25); chime([74, 81], 0.09, 0.05); break;
      case 'up': chime([62, 66, 69, 74, 78], 0.07, 0.06); this.noiseHit(t, 0.4, 'highpass', 4000, 0.5, 0.03); break;
      case 'horn': for (const [f, a] of [[110, 0.12], [165, 0.06], [220, 0.04]]) { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.3); g.gain.setValueAtTime(a, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9); o.connect(lp); lp.connect(g); g.connect(out); g.connect(this.verb); o.start(t); o.stop(t + 2); } break;
      case 'win': chime([69, 74, 78, 81], 0.12, 0.06); break;
      case 'lose': chime([62, 61, 57], 0.22, 0.05); break;
      case 'event': chime([69, 76], 0.18, 0.045); break;
      case 'tap': this.tone(t, 1300, 'sine', 0.001, 0.05, 0.03, out); break;
      // 银币落袋：两三声清脆的叮
      case 'coin': [88, 93, 96].forEach((m, i) => this.tone(t + i * 0.06, mtof(m), 'triangle', 0.001, 0.22, 0.035, out)); break;
      case 'warn': this.tone(t, 330, 'triangle', 0.005, 0.18, 0.06, out); this.tone(t + 0.12, 294, 'triangle', 0.005, 0.22, 0.06, out); break;
      // 烽火塔点亮：轰的一声火起来，再敲一组钟
      case 'tower': this.tone(t, 72, 'sine', 0.01, 0.9, 0.3, out, 42); this.whoosh(t, 0.35, 1.5, 260, 2600, 0.16); [62, 69, 74].forEach((m, i) => this.sbell(t + 0.32 + i * 0.16, m, 0.05)); break;
      // 天火过场：沿路一座座塔亮起来，钟声一座比一座高（arg 是第几座）
      case 'pillar': { const P = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]; this.sbell(t, P[Math.max(0, Math.min(P.length - 1, arg | 0))], 0.045, 2.2); this.whoosh(t, 0.08, 0.6, 400, 1800, 0.05); break; }
      // 天火塔点亮（过场开头）：低音铺开，火冲上去，钟一路往上
      case 'sky': this.drone(t, [38, 45], 1.4, 1.6, 3, 0.05); this.whoosh(t, 1.1, 2.4, 200, 2400, 0.13); this.tone(t, 60, 'sine', 0.02, 1.6, 0.18, out, 36); [62, 69, 74, 78, 81].forEach((m, i) => this.sbell(t + 0.9 + i * 0.22, m, 0.05, 3)); break;
      // 光连回永恒之炉：大和弦 + 钟
      case 'skyend': this.drone(t, [38, 45, 50, 54], 1.2, 2.4, 3.5, 0.04); this.whoosh(t, 0.6, 2.8, 220, 2000, 0.1); [74, 78, 81, 86].forEach((m, i) => this.sbell(t + 0.15 + i * 0.3, m, 0.045, 3.2)); break;
      // 拍照：快门咔嚓两下
      case 'shutter': this.noiseHit(t, 0.014, 'highpass', 2600, 0.7, 0.22); this.tone(t, 190, 'square', 0.001, 0.03, 0.03, out, 90); this.noiseHit(t + 0.075, 0.012, 'highpass', 3600, 0.7, 0.16); this.tone(t + 0.075, 140, 'square', 0.001, 0.025, 0.02, out, 70); break;
      // 挪建筑：拖着蹭过雪地，再咚地放下
      case 'move': { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.white; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1300, t + 0.22); const g = c.createGain(); this.env(g, t, 0.06, 0.07, 0.18); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 3, 0.3);
        this.tone(t + 0.24, 120, 'sine', 0.002, 0.2, 0.13, out, 55); this.noiseHit(t + 0.24, 0.1, 'lowpass', 700, 0.7, 0.08); break; }
    }
  }
}
