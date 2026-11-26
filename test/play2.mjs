export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game; const S = g.S;
    const c = S.camps[0];
    Object.assign(c.stock, { wood: 2000, stone: 2000, plank: 500, food: 500 });
    for (const t of ['tent','tent','lumber','hunter','kitchen','quarry','sawmill','warehouse','tower','scout','tent','lumber']) { g.startPlace(t); let done=false;
      for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x)+dx; g.place.y=Math.floor(c.y)+dy; g.updateGhost(); if (g.place.check.ok && (!['hunter','quarry','lumber'].includes(t) || g.place.check.spots>0)) { g.confirmPlace(); done=true; } }
      g.cancelModes(); }
    c.people = 30;
    for (const b of S.buildings) b.workers = Math.min(2, b.workers + 2);
    const sc = S.buildings.find(b=>b.type==='scout');
    g.ui.open('bld', sc.id); g.view.select(sc.id);
  });
  await page.waitForTimeout(3000);
}
