// 手机：选建筑 → 点地面（预览挪过去）→ 再点同一处 → 建成
export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => { const c = window.game.S.camps[0]; Object.assign(c.stock, { wood: 3000, stone: 2000 }); });
  await page.click('#toolbar button[data-arg=build]');
  await page.click('.card[data-arg=tent]');
  const pt = await page.evaluate(() => {
    const g = window.game, v = g.view, c = g.S.camps[0], P = g.place, ox = P.x, oy = P.y;
    for (let r = 2; r < 8; r++) for (let a = 0; a < 16; a++) {
      const x = Math.floor(c.x + Math.cos(a / 16 * 6.28) * r), y = Math.floor(c.y + Math.sin(a / 16 * 6.28) * r);
      if (x === ox && y === oy) continue;
      const ck = window.__sim.checkPlace(g.S, 'tent', x, y);
      if (ck.ok) { const p = v.project(x + 1, y + 1, 0); return { x: p.x, y: p.y }; }
    }
  });
  const tap = async () => page.evaluate(async ({ x, y }) => {
    const cv = document.getElementById('c');
    const ev = (type) => cv.dispatchEvent(new PointerEvent(type, { pointerId: 3, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, button: 0 }));
    ev('pointerdown'); await new Promise(r => setTimeout(r, 60)); ev('pointerup');
  }, pt);
  const n0 = await page.evaluate(() => window.game.S.buildings.length);
  await tap(); await page.waitForTimeout(300);
  const n1 = await page.evaluate(() => window.game.S.buildings.length);
  await page.screenshot({ path: '/tmp/tplace1.png' });
  await tap(); await page.waitForTimeout(300);
  const n2 = await page.evaluate(() => window.game.S.buildings.length);
  console.log('touch: first tap', n0, '->', n1, 'second tap ->', n2);
}
