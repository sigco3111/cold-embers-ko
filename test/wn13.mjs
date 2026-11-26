// 老存档打开第十三版：「第十三版 · 极北篇」弹窗；停在世界之脊的存档点「去北境」打开北迁面板，下一站是北境第 1 站
// SAVEFILE=/tmp/v13/v12spine.json KEEPVER=1（v12 代码做的世界之脊存档）
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForFunction(() => document.getElementById('modal').classList.contains('show') && /极北篇/.test(document.getElementById('modal').innerText), null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(800);
  console.log('modal', await page.evaluate(() => document.getElementById('modal').innerText.replace(/\s+/g, ' ').slice(0, 1200)));
  await page.screenshot({ path: `${OUT}/wn13_${TAG}.png`, timeout: 120000 });
  const has = await page.evaluate(() => { const b = document.querySelector('#modal [data-act="wn-north"]'); if (b) b.click(); return !!b; });
  console.log('go north button', has);
  await page.waitForTimeout(1500);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').classList.contains('show') + ' ' + document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 300)));
  await page.screenshot({ path: `${OUT}/wn13_migrate_${TAG}.png`, timeout: 120000 });
  console.log('ver', await page.evaluate(() => window.game.S.meta.ver));
}
