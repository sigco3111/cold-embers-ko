// 挪建筑：点建筑 →「挪位置」→ 预览 → 放下
export default async function (page) {
  const step = process.env.MOVESHOT || 'ghost';
  await page.evaluate(() => { const g = window.game, b = g.S.buildings.find(x => x.x === 27 && x.y === 197); g.view.focus(b.x + 1, b.y + 1); g.view.cam.tdist = g.view.cam.dist = 18; g.ui.open('bld', b.id); g.view.select(b.id); window.__mb = b.id; });
  await page.waitForTimeout(800);
  await page.click('#sheet [data-act="movebld"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => { const g = window.game; g.place.x = 26; g.place.y = 193; g.updateGhost(); });
  await page.waitForTimeout(1500);
  console.log('bar', await page.evaluate(() => document.getElementById('placeName').textContent + ' | ' + document.getElementById('placeCost').textContent));
  if (step === 'done') {
    await page.click('#placeOk'); await page.waitForTimeout(2500);
    console.log('after', await page.evaluate(() => { const b = window.__sim.getB(window.game.S, window.__mb); return `${b.x},${b.y} lvl ${b.lvl} workers ${b.workers}`; }));
  }
}
