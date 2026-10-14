// 最远镜头：看大背景与地图边界
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const start = await page.$('text=点起篝火'); if (start) await start.click();
  await page.evaluate(() => { const g = window.game; g.ui.closeModal && g.ui.closeModal(); const c = g.S.camps[g.S.camps.length - 1]; g.view.focus(c.x, c.y, true); g.view.cam.tdist = 90; g.view.cam.dist = 90; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/zo_a.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.view.focus(-2, g.view.cam.ty, true); g.view.cam.tdist = 45; g.view.cam.dist = 45; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/zo_b.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.view.focus(24, -6, true); g.view.cam.tdist = 70; g.view.cam.dist = 70; });
  await page.waitForTimeout(1500);
}
