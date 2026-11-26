// 建造面板缩略图 + 建筑面板
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.game.ui.closeModal());
  await page.click('#toolbar button[data-arg=build]');
  await page.waitForTimeout(600);
  await page.click('.tab[data-arg="3"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/th_a.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; const b = g.S.buildings.find(b => b.type === 'steelworks') || g.S.buildings[3]; g.ui.open('bld', b.id); });
  await page.waitForTimeout(600);
}
