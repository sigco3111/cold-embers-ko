const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.evaluate(() => { const g = window.game, S = g.S; g.setQuality('ultra'); S.t = Math.ceil(S.t / 720) * 720 + 0.76 * 720; const b = S.buildings.filter(b => b.type === 'hunter' || b.type === 'quarry')[1]; g.view.focus(b.x + 3, b.y - 2, true); g.view.cam.tdist = g.view.cam.dist = 15; });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/night_ultra.png`, timeout: 120000 });
}
