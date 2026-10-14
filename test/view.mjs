// 读档后的常规视角
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.game; g.ui.closeModal(); const c = g.S.camps[0]; g.view.focus(c.x, c.y + 2, true); g.view.cam.tdist = 26; g.view.cam.dist = 26; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/v_a.png`, timeout: 120000 });
  const perf = await page.evaluate(() => { const v = window.game.view; const t0 = performance.now(); for (let i = 0; i < 10; i++) v.frame(0.016); return (performance.now() - t0) / 10; });
  console.log('frame ms', perf.toFixed(1));
  await page.evaluate(() => { const g = window.game; const c = g.S.camps[g.S.camps.length - 1]; g.view.focus(c.x, c.y, true); g.view.cam.tdist = 60; g.view.cam.dist = 60; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/v_b.png`, timeout: 120000 });
  await page.click('#toolbar button[data-arg=build]');
  await page.waitForTimeout(800);
}
