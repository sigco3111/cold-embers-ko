const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1; for (let i = 0; i < 400; i++) Sim.step(S, 1); g.togglePause(true); g.chainmap.plan('alloy'); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_adv_plan.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game, S = g.S; g.chainmap.hide(); const d = S.camps.find(c => c.depot); S.active = d.id; g.view.focus(d.x, d.y); g.ui.open('stock'); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_adv_depot.png`, timeout: 120000 });
}
