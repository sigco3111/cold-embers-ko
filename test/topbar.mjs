// 手机顶部：默认一行，点 ▾ 展开人心、昼夜和物资栏
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
export default async function (page) {
  await page.waitForTimeout(2500);
  const h1 = await page.evaluate(() => { const r = document.getElementById('top').getBoundingClientRect(); const s = document.getElementById('stats').getBoundingClientRect(); return { top: r.height, statsW: s.width, vw: innerWidth, rows: [...document.querySelectorAll('#stats .pill')].filter(e => e.offsetParent).length }; });
  console.log('collapsed', JSON.stringify(h1));
  await page.screenshot({ path: `${OUT}/top_${TAG}.png`, timeout: 120000 });
  const b = await page.evaluate(() => { const e = document.querySelector('#stats .pill.more'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: !!e.offsetParent }; });
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(800);
  const h2 = await page.evaluate(() => ({ open: document.getElementById('top').classList.contains('open'), top: document.getElementById('top').getBoundingClientRect().height }));
  console.log('open', JSON.stringify(h2));
  await page.screenshot({ path: `${OUT}/top_open_${TAG}.png`, timeout: 120000 });
}
