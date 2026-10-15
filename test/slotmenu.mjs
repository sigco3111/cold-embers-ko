// 菜单里的存档位窗口：关闭能关，删除按钮都在
export default async function (page) {
  const st = () => page.evaluate(() => document.getElementById('modal').className);
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(500);
  await page.click('#sheet [data-act="slots"]'); await page.waitForTimeout(400);
  console.log('opened', await st(), await page.evaluate(() => [...document.querySelectorAll('#modal .slotrow')].map(r => r.textContent).join(' | ')));
  await page.click('#modal .mbtns [data-act="close-modal"]'); await page.waitForTimeout(400);
  console.log('closed', JSON.stringify(await st()));
  await page.click('#sheet [data-act="slots"]'); await page.waitForTimeout(400);
}
