// 菜单页：旅程卡、开关、画质、存档
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(1200);
  const tag = (process.env.TAG || 'pc');
  await page.screenshot({ path: `${OUT}/menu_${tag}.png`, timeout: 120000 });
  // 点开关：音效关掉再看
  await page.click('.tgl[data-arg="sfx"]');
  await page.waitForTimeout(800);
  console.log('sfx', await page.evaluate(() => [window.game.audio.sfxOn, document.querySelector('.tgl[data-arg="sfx"]').className]));
  await page.click('.tgl[data-arg="sfx"]');
  await page.evaluate(() => { const b = document.getElementById('sheet'); b.scrollTop = b.scrollHeight; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/menu_${tag}_b.png`, timeout: 120000 });
}
