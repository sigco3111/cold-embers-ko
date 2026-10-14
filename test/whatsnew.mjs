// 老存档第一次打开第十一版：弹「新内容」；关掉后存档记住，不再弹
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => ({ ver: window.game.S.meta.ver, modal: document.querySelector('#modal.show .mbox')?.innerText.replace(/\s+/g, ' ').slice(0, 120) }));
  console.log('modal', JSON.stringify(r));
  await page.screenshot({ path: `${OUT}/whatsnew_${TAG}.png`, timeout: 120000 });
  // 先弹的可能是离线结算：关掉它，等「新内容」
  for (let i = 0; i < 3; i++) { const txt = await page.evaluate(() => document.querySelector('#modal.show .mbox')?.innerText || ''); if (txt.includes('第十一版')) break; await page.evaluate(() => document.querySelector('#modal.show [data-act=close-modal]')?.click()); await page.waitForTimeout(3500); }
  console.log('wn', await page.evaluate(() => document.querySelector('#modal.show .mbox')?.innerText.replace(/\s+/g, ' ').slice(0, 80)));
  await page.screenshot({ path: `${OUT}/whatsnew2_${TAG}.png`, timeout: 120000 });
  await page.click('#modal.show [data-act=close-modal]');
  await page.evaluate(() => window.game.save());
  console.log('after', await page.evaluate(() => [window.game.whatsNew, JSON.parse(localStorage.getItem('hanjin-beixing-v1')).meta.ver]));
}
