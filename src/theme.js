// 1.2 界面配色：冷（极寒末日）、暖（温馨安全）、跟着天气
// 选择记在这台设备上（和音效开关一样），不进存档。
// 跟着天气：暴风雪预警到暴风雪结束、寒潮季那一整天、永冬潮、冰风暴时是冷的，其余时候是暖的；
// 天气过去以后再等 30 秒才回暖，免得来回闪。换的时候界面先淡下去，换好再亮回来。
import * as Sim from './sim.js';

const PREF = 'hanjin-beixing-v1-theme';
export const THEMES = [['auto', '跟着天气', '风雪来时冷，平时暖'], ['cold', '冷', '极寒末日'], ['warm', '暖', '温馨安全']];
const HOLD = 30, DIP = 550; // 回暖前等几秒；淡下去用多久（毫秒）

export class Theme {
  constructor(g) {
    this.g = g; this.t = 0; this.calm = 0; this.cur = null;
    this.pref = 'auto';
    try { const p = localStorage.getItem(PREF); if (p === 'cold' || p === 'warm' || p === 'auto') this.pref = p; } catch (e) {}
    this.apply(this.want(), false);
  }
  get saved() { try { return !!localStorage.getItem(PREF); } catch (e) { return false; } }
  set(p) {
    this.pref = p; try { localStorage.setItem(PREF, p); } catch (e) {}
    this.calm = HOLD; this.apply(this.want(), true);
  }
  // 眼下的天气算不算「风雪」
  stormy() {
    const S = this.g.S; if (!S || this.g.titleOn) return false;
    try {
      const w = Sim.weatherAt(S, S.t);
      if (w.blizzard || w.warn) return true;
      if (Sim.coldNow(S)) return true;
      if (Sim.tideNow(S)) return true;
      const e = Sim.wxeAt(S, S.t); if (e.on && e.ev && e.ev.kind === 'ice') return true;
    } catch (e) { /* 存档还没加载好 */ }
    return false;
  }
  want() {
    if (this.pref !== 'auto') return this.pref;
    if (this.stormy()) { this.calm = 0; return 'cold'; }
    return (this.tgt || this.cur) === 'cold' && this.calm < HOLD ? 'cold' : 'warm';
  }
  // 每帧调；内部每秒查一次
  tick(dt) {
    this.t += dt; if (this.t < 1) return;
    this.calm += this.t; this.t = 0;
    const w = this.want(); if (w !== this.cur && w !== this.tgt) this.apply(w, true); // 正在换的不重来
  }
  apply(th, fade) {
    if (th === this.cur && !this.tgt) return;
    this.tgt = th;
    const root = document.documentElement, body = document.body;
    const go = () => {
      this.cur = th; this.tgt = null; root.dataset.theme = th;
      const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = th === 'warm' ? '#4a2e19' : '#1b2430';
      if (this.g.ui && this.g.ui.onTheme) this.g.ui.onTheme(th);
    };
    clearTimeout(this.dipT); clearTimeout(this.upT);
    if (!fade || !body || matchMedia('(prefers-reduced-motion:reduce)').matches) { body && body.classList.remove('th-dip', 'th-up'); go(); return; }
    body.classList.remove('th-up'); body.classList.add('th-dip');
    this.dipT = setTimeout(() => {
      go(); body.classList.remove('th-dip'); body.classList.add('th-up');
      this.upT = setTimeout(() => body.classList.remove('th-up'), 800);
    }, DIP);
  }
}
