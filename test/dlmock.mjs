// 模拟 claude.ai 的下载权限：照片和存档码都走 downloads.save
export default async function (page) {
  await page.evaluate(() => window.game.photo.open()); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('#photobar [data-ph="shot"]').click());
  await page.waitForSelector('#photoview.show', { timeout: 60000 });
  await page.click('#photoview [data-pv="save"]'); await page.waitForTimeout(800);
  console.log('photo btn', await page.evaluate(() => document.querySelector('#photoview [data-pv="save"]').textContent));
  await page.click('#photoview [data-pv="done"]'); await page.waitForTimeout(500);
  await page.evaluate(() => window.game.exportCode()); await page.waitForTimeout(800);
  await page.click('#modal [data-act="savecode"]'); await page.waitForTimeout(800);
  console.log('saved', JSON.stringify(await page.evaluate(() => window.__saved)));
}
