// 电脑端：选建筑 → 鼠标移到地面 → 点击即建
export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => { const c = window.game.S.camps[0]; Object.assign(c.stock, { wood: 3000, stone: 2000 }); });
  const before = await page.evaluate(() => window.game.S.buildings.length);
  await page.click('#toolbar button[data-arg=build]');
  await page.click('.card[data-arg=tent]');
  // 找一个可以建的屏幕位置
  const pt = await page.evaluate(() => {
    const g = window.game, v = g.view, c = g.S.camps[0];
    for (let r = 2; r < 8; r++) for (let a = 0; a < 16; a++) {
      const x = Math.floor(c.x + Math.cos(a / 16 * 6.28) * r), y = Math.floor(c.y + Math.sin(a / 16 * 6.28) * r);
      g.place.x = x; g.place.y = y; g.updateGhost();
      if (g.place.check.ok) { const p = v.project(x + 1, y + 1, 0); return { x: p.x, y: p.y, tx: x, ty: y }; }
    }
  });
  await page.mouse.move(pt.x + 30, pt.y + 30);
  await page.mouse.move(pt.x, pt.y, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.game.S.buildings.length);
  console.log('pc click place: buildings', before, '->', after, 'placing still', await page.evaluate(() => !!window.game.place));
  await page.screenshot({ path: '/tmp/pcplace.png' });
}
