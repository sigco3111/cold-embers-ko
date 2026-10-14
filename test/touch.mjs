export default async function (page) {
  await page.click('text=点起篝火');
  await page.click('#toolbar button[data-arg=build]');
  await page.click('.card[data-arg=tent]');
  const before = await page.evaluate(() => ({ ...window.game.place, check: null }));
  // 模拟手指拖动
  await page.evaluate(async () => {
    const cv = document.getElementById('c');
    const ev = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0 }));
    ev('pointerdown', 200, 600);
    for (let i = 1; i <= 10; i++) { ev('pointermove', 200 + i * 6, 600 - i * 4); await new Promise(r => setTimeout(r, 16)); }
    ev('pointerup', 260, 560);
  });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({ x: window.game.place.x, y: window.game.place.y, ok: window.game.place.check.ok, reason: window.game.place.check.reason }));
  console.log('ghost', before.x, before.y, '->', after);
  await page.screenshot({ path: '/tmp/touch_ghost.png' });
  // 两指捏合
  await page.evaluate(async () => {
    const cv = document.getElementById('c');
    const ev = (type, id, x, y) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    ev('pointerdown', 1, 150, 400); ev('pointerdown', 2, 250, 400);
    for (let i = 1; i <= 10; i++) { ev('pointermove', 1, 150 - i * 5, 400); ev('pointermove', 2, 250 + i * 5, 400 + i); await new Promise(r => setTimeout(r, 16)); }
    ev('pointerup', 1, 100, 400); ev('pointerup', 2, 300, 410);
  });
  console.log('dist', await page.evaluate(() => window.game.view.cam.tdist.toFixed(1)));
  const ok = await page.evaluate(() => window.game.place.check.ok);
  if (ok) await page.click('#placeOk');
  await page.waitForTimeout(500);
  console.log('tents', await page.evaluate(() => window.game.S.buildings.filter(b => b.type === 'tent').length));
}
