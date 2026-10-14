export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game; const S = g.S; const c = S.camps[0];
    Object.assign(c.stock, { wood: 3000, stone: 2000, plank: 800, food: 800 });
    g.startPlace('lumber'); let done = false;
    for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x)+dx; g.place.y=Math.floor(c.y)+dy; g.updateGhost(); if (g.place.check.ok && g.place.check.spots) { g.confirmPlace(); done=true; } }
    g.cancelModes();
    const b = S.buildings.find(b => b.type === 'lumber'); g.ui.open('bld', b.id);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/bldpanel.png' });
  await page.evaluate(() => { const g = window.game; g.ui.open('bld', g.S.camps[0].furnace); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/bldpanel2.png' });
}
