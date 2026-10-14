export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game, S = g.S, c = S.camps[0];
    Object.assign(c.stock, { wood: 3000, stone: 2000, plank: 800 });
    for (const t of ['tower','tower','tent','tent']) { g.startPlace(t); let done=false;
      for (let r = 3; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x)+dx; g.place.y=Math.floor(c.y)+dy; g.updateGhost(); if (g.place.check.ok) { g.confirmPlace(); done=true; } }
      g.cancelModes(); }
    c.people = 12;
    g.view.onFx({ kind: 'raid', camp: c.id, won: true, str: 40, def: 50 });
    // 暴风雪：把时间推到下一场暴风雪
    const w = window.__sim.weatherAt(S, S.t);
    S.t = w.slot.start + 30;
  });
  await page.waitForTimeout(5000);
}
