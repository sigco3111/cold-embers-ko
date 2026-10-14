const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const g = window.game; g.S.active = g.S.camps[0].id; const c = g.S.camps[0]; g.view.focus(c.x, c.y, true); });
  await page.evaluate(() => window.game.ui.open('stock'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/stock_a.png`, timeout: 120000 });
  // 库存面板每 0.3 秒按新数字重画，Playwright 的 click 等不到「稳定」；真人按下时面板会停住不重画
  await page.evaluate(() => document.querySelector('button[data-act=trade]').click());
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const sh = document.querySelector('.sheet, #sheet'); if (sh) sh.scrollTop = 99999; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/stock_b.png`, timeout: 120000 });
  console.log(await page.evaluate(() => { const g = window.game; return JSON.stringify({ trade: g.ui.camp().trade, rows: document.querySelectorAll('.srow').length, issues: [...document.querySelectorAll('.issue b')].map(b => b.textContent) }); }));
}
