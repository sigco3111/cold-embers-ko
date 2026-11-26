const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game, S = g.S, c = S.camps[0];
    Object.assign(c.stock, { wood: 3000, stone: 2000, plank: 800 });
    g.startPlace('sawmill');
    outer: for (let r = 2; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { g.place.x = Math.floor(c.x) + dx; g.place.y = Math.floor(c.y) - 4 + dy; g.updateGhost(); if (g.place.check.ok) break outer; }
    const p = g.place; g.view.focus(p.x + 1, p.y + 1, true); g.view.cam.tdist = 11; g.view.cam.dist = 11;
    g.confirmPlace(); g.cancelModes();
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/cons_a.png`, timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const g = window.game, S = g.S; const b = S.buildings[S.buildings.length - 1]; b.lvl += 1; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/cons_b.png`, timeout: 120000 });
}
