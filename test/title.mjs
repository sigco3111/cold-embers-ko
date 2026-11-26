// 标题画面：有存档时「继续北行」，没存档时「开始北行」；点了以后 HUD 出现、离线结算再弹
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(3500);
  const a = await page.evaluate(() => ({ on: window.game.titleOn, show: document.getElementById('title').classList.contains('show'), txt: document.getElementById('title').innerText.slice(0, 200), modal: document.getElementById('modal').classList.contains('show') }));
  console.log('title', JSON.stringify(a));
  await page.screenshot({ path: `${OUT}/title_${TAG}.png`, timeout: 120000 });
  const b = await page.evaluate(() => { const e = document.querySelector('[data-act="title-go"]').getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
  await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(2500);
  const c = await page.evaluate(() => ({ on: window.game.titleOn, show: document.getElementById('title').classList.contains('show'), modal: document.getElementById('modal').classList.contains('show'), mtxt: document.getElementById('modal').innerText.slice(0, 80), yaw: window.game.view.cam.yaw }));
  console.log('after', JSON.stringify(c));
  await page.screenshot({ path: `${OUT}/title_after_${TAG}.png`, timeout: 120000 });
}
