// 产出飘字：拉近镜头，手动推进飘字计时（无头浏览器帧率很低），建筑上方应冒出「+N 图标」
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const g = window.game, c = g.ui.camp(); for (const k in c.stock) c.stock[k] = Math.min(c.stock[k], 300); g.view.focus(c.x + 2, c.y - 3, true); g.view.cam.tdist = g.view.cam.dist = 20; window.__simstep(3); });
  await page.waitForTimeout(1500);
  const n = await page.evaluate(() => { const t = performance.now(); window.__floatHold = t; for (let i = 0; i < 100; i++) window.game.ui.floats(0.25); window.__floatHold = t + 800; return document.querySelectorAll('#floats .pfl').length; });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/floats_${TAG}.png`, timeout: 120000 });
  console.log('floats', n, await page.evaluate(() => [...document.querySelectorAll('#floats .pfl')].map(e => e.innerText).join(' | ')));
}
