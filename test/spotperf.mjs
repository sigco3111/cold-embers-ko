export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const v = window.game.view; v.S && window.game.ui.closeModal(); let t0 = performance.now(); v.layoutSpots(); const a = performance.now() - t0; t0 = performance.now(); v.refreshSpots(); const b = performance.now() - t0; t0 = performance.now(); v.decorKey = ''; v.refreshDecor(); const c = performance.now() - t0; return `layout ${a.toFixed(1)}ms refresh ${b.toFixed(1)}ms decor ${c.toFixed(1)}ms`; });
  console.log(r);
  await page.evaluate(() => { const g = window.game; const c = g.S.camps[0]; g.view.focus(c.x - 6, c.y + 4, true); g.view.cam.tdist = 16; g.view.cam.dist = 16; });
  await page.waitForTimeout(1500);
}
