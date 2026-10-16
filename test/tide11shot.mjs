// 1.1 炉火鼎盛 + 永冬潮：金色炉火、营地概况里的鼎盛卡片、熄火提醒；永冬潮预报、潮里的天色、天气面板、霜巨兽冲营、冻住的建筑
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/tide_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); g.ui.adv = null; });
  // 炉火鼎盛：营地上的线全稳在三星
  const pk = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); S.active = m.id; S.qy = null; S.cold = { t0: 1e9 };
    for (const k in m.stock) m.stock[k] = Math.max(m.stock[k], 2000);
    for (const t of ['sawmill', 'kitchen']) { let done = false; for (let r = 3; r < 14 && !done; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r && !done; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r && !done; x++) { if (Sim.checkPlace(S, t, x, y).ok) { const res = Sim.place(S, t, x, y); if (res.ok) { const b = Sim.getB(S, res.id); b.done = true; delete b.prog; done = true; } } } }
    for (const r of ['plank', 'food', 'wood', 'stone', 'coal', 'iron', 'steel']) if (Sim.campLines(S, m).length < 3 && !Sim.lineOf(S, r)) { Sim.plinesOf(S).push({ id: S.nextId++, r, n: 0, star: 3, st: 0, t0: S.t }); }
    window.__hold = setInterval(() => { for (const l of Sim.plinesOf(S)) { l.star = 3; if (l.n < 1e8) l.n = 0; } }, 200);
    for (const l of Sim.plinesOf(S)) { l.star = 3; l.n = 0; }
    for (let i = 0; i < 25; i++) { for (const l of Sim.plinesOf(S)) l.star = 3; Sim.step(S, 1); }
    const v = g.view; v.focus(m.x, m.y, true); v.cam.tdist = v.cam.dist = 22; for (let i = 0; i < 30; i++) v.frame(0.05);
    return { on: Sim.peakOn(S, m), lines: Sim.campLines(S, m).map(l => l.r) };
  });
  console.log('PEAK', JSON.stringify(pk));
  await page.waitForTimeout(2500); await shot(page, 'peak');
  await page.evaluate(() => { const S = window.game.S, DL = 720; S.t = Math.floor(S.t / DL) * DL + 0.78 * DL; });
  await page.waitForTimeout(2500); await shot(page, 'peaknight');
  await page.evaluate(() => { const u = window.game.ui; u.open('camp'); u.renderPanel(true); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.game.ui.sheet, el = [...s.querySelectorAll('.sec')].find(e => /炉火鼎盛/.test(e.textContent)); if (el) s.scrollTop = el.offsetTop - 40; });
  await page.waitForTimeout(400); await shot(page, 'peakcard');
  // 一条线掉下去：熄火，提醒点名
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim; g.ui.close(); const l = Sim.campLines(S, Sim.mainCamp(S))[0]; if (l) l.n = 1e9; for (let i = 0; i < 95; i++) { for (const x of Sim.plinesOf(S)) x.star = 3; Sim.step(S, 1); } });
  await page.evaluate(() => { const u = window.game.ui; u.hud && u.hud(); u.actDo('bell'); });
  await page.waitForTimeout(800); await shot(page, 'peakoff');
  await page.evaluate(() => { clearInterval(window.__hold); window.game.ui.closeModal && window.game.ui.closeModal(); window.game.ui.close(); });
  // 永冬潮：报出来了
  const tf = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; S.tide = { t0: S.t };
    let z = Sim.tideAt(S); S.tide.t0 -= z.inSec - 1300; Sim.step(S, 2); z = Sim.tideAt(S);
    return { n: z.n, fc: z.fc, inSec: z.inSec };
  });
  console.log('TIDEFC', JSON.stringify(tf));
  await page.evaluate(() => { const u = window.game.ui; u.hud && u.hud(); u.actDo('wx'); u.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'fc');
  // 潮来了：天色、天气面板
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.close(); let z = Sim.tideAt(S); S.tide.t0 -= z.inSec + 5; Sim.step(S, 2);
    const DL = 720; z = Sim.tideAt(S); const m = Sim.mainCamp(S), v = g.view; v.focus(m.x, m.y, true); v.cam.tdist = v.cam.dist = 26;
  });
  await page.waitForTimeout(3500); await shot(page, 'on');
  await page.evaluate(() => { const u = window.game.ui; u.actDo('wx'); u.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'onpanel');
  // 霜巨兽：守不住（没塔），冲进来，几座建筑冻住
  const bt = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.close();
    for (const b of S.buildings) if (b.type === 'tower') b.workers = 0;
    let z = Sim.tideAt(S); const DL = 720; S.t = (Math.floor(S.t / DL) + 1) * DL + 0.66 * DL - 100; S.tide.t0 += (S.t - 300) - z.start; z = Sim.tideAt(S); S.tide.bt = null; S.tide.bw = null; S.tide.bwarn = null; window.game.paused = true;
    Sim.step(S, 2);
    const u = g.ui; u.hud && u.hud();
    return { in: z.beastT - S.t, v: Sim.beastView(S, z) };
  });
  console.log('BEAST', JSON.stringify(bt));
  await page.evaluate(() => { window.game.ui.actDo('bell'); });
  await page.waitForTimeout(800); await shot(page, 'bwarn');
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); g.ui.close();
    g.paused = false; const z = Sim.tideAt(S); const m = Sim.mainCamp(S), v = g.view; v.focus(m.x, m.y + 4, true); v.cam.tdist = v.cam.dist = 36; for (let i = 0; i < 1500 && S.tide.bt !== z.n; i++) Sim.step(S, 1);
  });
  await page.waitForTimeout(10000); await shot(page, 'beast');
  console.log('RAIDS', await page.evaluate(() => { const g = window.game, v = g.view, c = window.__sim.mainCamp(g.S); return JSON.stringify(v.raids.map(r => ({ beast: r.beast, age: v.time - r.t0, w: r.wolves.map(w => [Math.round(w.x - c.x), Math.round(w.y - c.y), w.s]) }))); }));
  await page.waitForTimeout(8000); await shot(page, 'beast2');
  const fz = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, F = S.buildings.filter(b => b.frz > S.t);
    if (F[0]) { const v = g.view; v.focus(F[0].x + 1, F[0].y + 1, true); v.cam.tdist = v.cam.dist = 10; }
    return F.map(b => b.type);
  });
  console.log('FROZEN', JSON.stringify(fz));
  await page.waitForTimeout(2500); await shot(page, 'frozen');
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, b = S.buildings.find(x => x.frz > S.t); if (b) { g.ui.actDo('openbld', b.id); g.ui.renderPanel(true); } });
  await page.waitForTimeout(800); await shot(page, 'frozenpanel');
  console.log('ERRS', await page.evaluate(() => JSON.stringify((window.__errs || []).slice(0, 5))));
}
