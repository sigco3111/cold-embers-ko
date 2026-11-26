// 北行大地图：打开、标记、点一处后镜头飞过去并关闭
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '#bigmap,#bigmap *{animation:none!important;transition:none!important}' });
  const b = await page.evaluate(() => { const r = document.getElementById('mapBtn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (TAG === 'phone') await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({ open: window.game.bigmap.open, mk: document.querySelectorAll('#bigmap .bmk').length, kinds: [...document.querySelectorAll('#bigmap .bmk')].map(e => e.className.replace('bmk', '').trim()).join(','), cam: [window.game.view.cam.ttx, window.game.view.cam.tty].map(v => +(v || 0).toFixed(1)) }));
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/bigmap_${TAG}.png`, timeout: 120000 });
  // 滚到北边一点，点一处空地
  const p = await page.evaluate(() => { const sc = document.querySelector('#bigmap .bmscroll'); if (sc) sc.scrollTop = Math.max(0, sc.scrollTop - 120); const r = (sc || document.querySelector('#bigmap .bmin')).getBoundingClientRect(); return { x: r.x + r.width * 0.3, y: r.y + r.height * 0.4 }; });
  await page.waitForTimeout(600);
  if (TAG === 'phone') await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(1500);
  console.log('after', JSON.stringify(await page.evaluate(() => ({ open: window.game.bigmap.open, cam: [window.game.view.cam.ttx, window.game.view.cam.tty].map(v => +(v || 0).toFixed(1)) }))));
}
