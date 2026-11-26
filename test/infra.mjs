// 营地基建：道路 0→3、蒸汽管道 0→3，看画面和面板
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, c = g.ui.camp(), Sim = window.__sim;
    for (const k of ['stone', 'wood', 'plank', 'iron', 'steel', 'coal', 'gear', 'seal']) c.stock[k] = Math.max(c.stock[k] || 0, 2000);
    g.view.focus(c.x + 3, c.y - 4, true); g.view.cam.tdist = g.view.cam.dist = 13;
    const cr = Sim.rt(S).c[c.id];
    return { road: c.road, pipe: c.pipe, r: Sim.heatRadius(S, c), haul: cr.hf, temp: cr.temp };
  });
  console.log('before', JSON.stringify(info));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/infra_0_${TAG}.png`, timeout: 120000 });
  for (let L = 1; L <= 3; L++) {
    const r = await page.evaluate(() => { const g = window.game, S = g.S, c = g.ui.camp(), Sim = window.__sim; const a = Sim.upgradeInfra(S, c.id, 'road'), b = Sim.upgradeInfra(S, c.id, 'pipe'); window.__simstep(2); const cr = Sim.rt(S).c[c.id]; return { a, b, road: c.road, pipe: c.pipe, r: Sim.heatRadius(S, c), temp: Math.round(cr.temp), hf: cr.hf }; });
    console.log('L' + L, JSON.stringify(r));
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/infra_${L}_${TAG}.png`, timeout: 120000 });
  }
  await page.evaluate(() => window.game.ui.open('camp'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { const e = document.querySelector('.infra'); if (e) e.scrollIntoView(); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/infra_panel_${TAG}.png`, timeout: 120000 });
}
