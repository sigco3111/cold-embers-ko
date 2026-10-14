import fs from 'fs';
export default async function (page) {
  // 已在 shot.mjs 之前通过 initScript 注入
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => { const S = window.game.S; return { camps: S.camps.length, b: S.buildings.length, t: S.t }; });
  console.log(JSON.stringify(info));
  await page.evaluate(() => { const g = window.game; g.ui.closeModal(); const c = g.S.camps[g.S.camps.length - 1]; g.view.focus(c.x, c.y, true); g.view.cam.tdist = 40; g.view.cam.dist = 40; });
  await page.waitForTimeout(1500);
  const perf = await page.evaluate(() => { const v = window.game.view; const t0 = performance.now(); for (let i = 0; i < 20; i++) v.frame(0.016); return (performance.now() - t0) / 20; });
  console.log('frame ms (swiftshader)', perf.toFixed(1));
}
