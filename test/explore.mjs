// 探索：雾里的地点、探险队出发、到达后弹出选择、带东西回来
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    const w = g.view.world;
    const p = w.sites.slice().sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    Sim.revealCircle(S, p.x, p.y, 4); Sim.rt(S).revealDirty = true;
    // 保证有侦察营
    if (!Sim.scoutSlots(S, c.id).n) {
      const f = Sim.getB(S, c.furnace); let spot = null;
      for (let rr = 3; rr < 18 && !spot; rr++) for (let a = 0; a < 24 && !spot; a++) { const x = Math.round(f.x + 1 + Math.cos(a / 24 * 6.283) * rr), y = Math.round(f.y + 1 + Math.sin(a / 24 * 6.283) * rr); if (Sim.checkPlace(S, 'scout', x, y).ok) spot = [x, y]; }
      Sim.place(S, 'scout', spot[0], spot[1]);
    }
    for (const k of ['food', 'wood', 'coal']) c.stock[k] = Math.max(c.stock[k] || 0, 600);
    c.people = Math.max(c.people, 30);
    g.view.focus(p.x + 0.5, p.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 10;
    window.__site = p.id;
    return { site: p, camp: [c.x, c.y], d: Math.hypot(p.x - c.x, p.y - c.y) };
  });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/explore_site_${TAG}.png`, timeout: 120000 });
  // 点地点的标签打开面板
  const box = await page.evaluate(() => { const e = document.querySelector('.sitetag'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, t: e.textContent }; });
  console.log('tag', JSON.stringify(box));
  if (box) await page.mouse.click(box.x, box.y); else await page.evaluate(() => window.game.ui.open('site', window.__site));
  await page.waitForTimeout(1200);
  console.log('panel', await page.evaluate(() => window.game.ui.panel && window.game.ui.panel.kind));
  await page.screenshot({ path: `${OUT}/explore_panel_${TAG}.png`, timeout: 120000 });
  // 带足补给出发
  const go = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="exp-go"]')].find(e => e.dataset.arg.endsWith(':full')); if (!b) return 'no button'; b.click(); return window.game.S.scouts.map(s => s.kind + ':' + s.phase); });
  console.log('go', JSON.stringify(go));
  for (let i = 0; i < 40; i++) { const pend = await page.evaluate(() => { window.__simstep(10); return !!window.__sim.expPending(window.game.S); }); if (pend) break; }
  await page.waitForTimeout(3000);
  await page.evaluate(() => { if (!document.getElementById('modal').classList.contains('show')) { window.game.ui.open('site', window.__site); window.game.ui.siteModal(); } });
  await page.waitForTimeout(500);
  const modal = await page.evaluate(() => { const m = document.getElementById('modal'); return { show: m.classList.contains('show'), txt: m.innerText.slice(0, 300) }; });
  console.log('modal', JSON.stringify(modal), 'panelOpen', await page.evaluate(() => !!window.game.ui.panel));
  await page.screenshot({ path: `${OUT}/explore_modal_${TAG}.png`, timeout: 120000 });
  const pick = await page.evaluate(() => { const b = document.querySelector('.evopt[data-act="siteopt"]'); if (!b) return null; b.click(); return b.innerText; });
  console.log('pick', JSON.stringify(pick));
  await page.waitForTimeout(800);
  for (let i = 0; i < 40; i++) { const n = await page.evaluate(() => { window.__simstep(10); return window.game.S.scouts.length; }); if (!n) break; }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => { const S = window.game.S; return { done: S.siteDone, log: S.log.slice(-5).map(l => l.msg), bank: S.tech && S.tech.bank }; });
  console.log('after', JSON.stringify(after));
  await page.evaluate(() => { const p = window.game.view.world.sites.find(q => q.id === window.__site); window.game.ui.close(); window.game.view.focus(p.x + 0.5, p.y + 0.5, true); });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/explore_done_${TAG}.png`, timeout: 120000 });
  // 六种地点的模型
  if (process.env.KINDS) {
    for (const kind of ['depot', 'camp', 'train', 'shrine', 'lab', 'wreck']) {
      const ok = await page.evaluate(k => { const g = window.game, S = g.S, p = g.view.world.sites.find(q => q.kind === k); if (!p) return false; window.__sim.revealCircle(S, p.x, p.y, 5); window.__sim.rt(S).revealDirty = true; g.view.focus(p.x + 0.5, p.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 7; return true; }, kind);
      if (!ok) continue;
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${OUT}/explore_k_${kind}.png`, timeout: 120000 });
    }
  }
}
