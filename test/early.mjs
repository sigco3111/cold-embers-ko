const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.screenshot({ path: `${OUT}/e_intro.png`, timeout: 120000 });
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game, S = g.S, c = S.camps[0];
    Object.assign(c.stock, { wood: 3000, stone: 2000, plank: 800, food: 800 });
    for (const t of ['tent','tent','lumber','hunter','kitchen','quarry']) { g.startPlace(t); let done = false;
      for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x) + dx; g.place.y = Math.floor(c.y) + dy; g.updateGhost(); if (g.place.check.ok) { g.confirmPlace(); done = true; } }
      g.cancelModes(); }
    c.people = 14;
    g.view.focus(c.x, c.y + 1, true); g.view.cam.tdist = 16; g.view.cam.dist = 16;
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/e_camp.png`, timeout: 120000 });
  await page.evaluate(() => window.game.startPlace('sawmill'));
  await page.waitForTimeout(800);
}
