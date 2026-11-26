export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => { const g = window.game; g.noAuto = false; g.setQuality('ultra'); });
  const log = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(3000);
    log.push(await page.evaluate(() => window.game.quality));
  }
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
  console.log(log.join(','), '\n', toast);
}
