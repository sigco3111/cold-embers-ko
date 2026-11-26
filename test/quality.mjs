const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  for (const q of ['low', 'high', 'ultra']) {
    await page.evaluate(q => { const g = window.game, c = g.S.camps[0]; g.setQuality(q); const b = g.S.buildings.filter(b => b.type === 'hunter' || b.type === 'quarry')[1]; g.view.focus(b.x + 3, b.y - 2, true); g.view.cam.tdist = g.view.cam.dist = 15; }, q);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => { const v = window.game.view; const n = {}; for (const k in v.decor) n[k] = v.decor[k].count; return { pr: v.renderer.getPixelRatio(), sm: v.sun.shadow.mapSize.x, snow: v.snowN, n, calls: v.renderer.info.render.calls, tris: v.renderer.info.render.triangles }; });
    console.log(q, JSON.stringify(info));
    await page.screenshot({ path: `${OUT}/q_${q}.png`, timeout: 120000 });
  }
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/q_menu.png`, timeout: 120000 });
}
