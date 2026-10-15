// 地貌规则画面：RSHOT=geo（盖一口地热井）| fish（盖一座冰钓屋）| ruin（古城废墟和它的卡片）| dead（枯木林）| near（营地近景）| pill（规则标签的说明）
import { SPOT_KEYS } from '../src/data.js';
export default async function (page) {
  const m = process.env.RSHOT || 'near', dist = +(process.env.DIST || 16);
  const fx = (process.env.AT || '0,0').split(',');
  const r = await page.evaluate(([m, dist, KEYS, fx]) => {
    const g = window.game, S = g.S, Sim = window.__sim, v = g.view, c = Sim.mainCamp(S);
    const W = 48;
    const near = (type, ox, oy, R) => { let best = null; for (let y = Math.floor(oy - R); y <= oy + R; y++) for (let x = Math.floor(ox - R); x <= ox + R; x++) { if (!Sim.checkPlace(S, type, x, y).ok) continue; const d = Math.hypot(x - ox, y - oy); if (!best || d < best.d) best = { x, y, d }; } return best; };
    const out = {};
    if (m === 'geo') { const p = near('geowell', c.x + 4, c.y, 9); out.p = p; if (p) { const q = Sim.place(S, 'geowell', p.x, p.y); out.q = q; v.focus(p.x + 1, p.y + 1, true); } }
    if (m === 'fish' || m === 'ruin' || m === 'dead') {
      const kind = m === 'fish' ? 'fish' : m === 'ruin' ? 'ruin' : 'dead', wd = window.__world(); let best = null;
      for (let i = 0; i < wd.spot.length; i++) { if (wd.spot[i] < 0 || KEYS[wd.spot[i]] !== kind) continue; const x = i % W, y = Math.floor(i / W), d = Math.hypot(x - c.x, y - c.y); if (!best || d < best.d) best = { i, x, y, d }; }
      out.best = best;
      if (best && m === 'fish') { const p = near('icefish', best.x, best.y, 5); out.p = p; if (p) { out.q = Sim.place(S, 'icefish', p.x, p.y); v.focus(p.x + 1, p.y + 1, true); } }
      if (best && m === 'ruin') { v.focus(best.x + 0.5, best.y + 0.5, true); g.ui.open('spot', best.i); }
      if (best && m === 'dead') v.focus(best.x + 0.5, best.y + 0.5, true);
    }
    if (m === 'near') v.focus(c.x, c.y + 3, true);
    if (m.startsWith('open:')) { v.focus(c.x, c.y + 3, true); g.ui.open(m.slice(5)); }
    if (m === 'chapm') { v.focus(c.x, c.y + 3, true); out.modal = g.ui.chapterModal(Sim.journeyOf(S).stage); }
    if (m === 'at') v.focus(+fx[0], +fx[1], true);
    if (m === 'hit') { const B = window.__BLD; let b = S.buildings.find(b => b.camp === c.id && B[b.type].out); if (!b) { const p = near('lumber', c.x + 4, c.y + 2, 9); const q = p && Sim.place(S, 'lumber', p.x, p.y); b = q && q.ok && Sim.getB(S, q.id); v.syncBuildings(true); } if (b) { b.hitT = S.t + 600; v.focus(b.x + 1, b.y + 1, true); g.ui.open('bld', b.id); out.b = b.type; } }
    if (m === 'pill') { v.focus(c.x, c.y + 3, true); const p = document.querySelector('.pill.rulep'); out.pill = !!p; if (p) p.click(); }
    v.syncBuildings(true); v.cam.tdist = v.cam.dist = dist;
    return out;
  }, [m, dist, SPOT_KEYS, fx]);
  console.log('rshot', JSON.stringify(r));
  await page.waitForTimeout(3500);
}
