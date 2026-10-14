export default async function (page) {
  await page.waitForTimeout(3000);
  await page.evaluate(() => { const S = window.game.S; for (let i = 0; i < 240; i++) window.__sim.step(S, 1); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/v12/hud.png' });
  console.log('advisor', await page.evaluate(() => document.getElementById('advisor').textContent), '| goal', await page.evaluate(() => document.getElementById('goal').textContent));
  await page.evaluate(() => window.game.chainmap.plan());
  await page.waitForTimeout(1500);
}
