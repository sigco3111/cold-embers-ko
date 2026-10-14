const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  for (const [d, n] of [[32, 'far'], [18, 'near']]) {
    await page.evaluate(d => { const g = window.game, c = g.S.camps[0]; g.view.focus(c.x, c.y - 2, true); g.view.cam.tdist = g.view.cam.dist = d; }, d);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/bd_${n}.png`, timeout: 120000 });
  }
  const r = await page.evaluate(() => document.querySelectorAll('#labels .badge').length);
  console.log('badges', r);
}
