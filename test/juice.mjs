// 手感：一大笔物资到账时图标飞进顶栏、数字滚动；建成 / 升级时的光圈
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.game, c = g.ui.camp(); c.stock.wood = 400; c.stock.food = 300; g.ui.hud(); });
  await page.waitForTimeout(400);
  // 模拟点了「领取」：从屏幕中间点一下，然后一笔木材和熟食到账
  const r = await page.evaluate(() => {
    const g = window.game, c = g.ui.camp();
    g.ui.lastTap = { x: innerWidth / 2, y: innerHeight * 0.6, t: performance.now() };
    c.stock.wood += 600; c.stock.food += 250; g.ui.hud();
    return { roll: Object.keys(g.ui.roll || {}), fly: document.querySelectorAll('#fxl .flyi').length };
  });
  console.log('lump', JSON.stringify(r));
  await page.waitForTimeout(150);
  console.log('mid', JSON.stringify(await page.evaluate(() => ({ fly: document.querySelectorAll('#fxl .flyi').length, wood: document.querySelector('[data-rk=wood]')?.textContent, food: document.querySelector('[data-rk=food]')?.textContent }))));
  await page.evaluate(() => document.getAnimations().forEach(a => { if (a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#fxl')) { a.pause(); a.currentTime = 520; } }));
  await page.screenshot({ path: `${OUT}/juice_fly_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { /* 1.1 有循环动画（铃铛、提醒），跳过 */ } }));
  // 升级熔炉：光圈 + 「升到 N 级」
  const up = await page.evaluate(() => { const g = window.game, S = g.S, c = g.ui.camp(), f = window.__sim.getB(S, c.furnace); g.view.focus(f.x + 1.5, f.y + 1.5, true); f.lvl++; g.ui.hud(); return { lvl: f.lvl, fx: document.querySelectorAll('#floats .upfx').length, txt: document.querySelector('#floats .upfx b')?.textContent }; });
  console.log('up', JSON.stringify(up));
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.game.ui.juice(); document.getAnimations().forEach(a => { const t = a.effect && a.effect.target; if (t && t.closest && t.closest('.upfx')) { a.pause(); a.currentTime = 380; } }); });
  await page.screenshot({ path: `${OUT}/juice_up_${TAG}.png`, timeout: 120000 });
  // 面板滑入 / 滑出
  await page.evaluate(() => window.game.ui.open('camp'));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.game.ui.close());
  await page.waitForTimeout(600);
  console.log('sheet', await page.evaluate(() => document.getElementById('sheet').className));
}
