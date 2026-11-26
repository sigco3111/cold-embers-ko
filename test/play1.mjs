export default async function (page) {
  await page.click('text=点起篝火');
  await page.click('#toolbar button[data-arg=build]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/p_build.png' });
  // 用游戏对象直接摆放（找一个可用位置）
  await page.evaluate(() => {
    const g = window.game; const S = g.S;
    g.ui.close(); g.startPlace('lumber');
    const c = S.camps[0];
    outer: for (let r = 2; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      g.place.x = Math.floor(c.x) + dx; g.place.y = Math.floor(c.y) + dy; g.updateGhost();
      if (g.place.check.ok && g.place.check.spots > 0) break outer;
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/p_ghost.png' });
  await page.evaluate(() => { const g = window.game; g.confirmPlace(); g.cancelModes();
    const S = g.S, G = g;
    for (const t of ['tent','tent','hunter','kitchen','quarry','sawmill','warehouse','tower','scout']) { G.startPlace(t); const c=S.camps[0]; let done=false;
      for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { G.place.x = Math.floor(c.x)+dx; G.place.y=Math.floor(c.y)+dy; G.updateGhost(); if (G.place.check.ok && (!['hunter','quarry'].includes(t) || G.place.check.spots>0)) { G.confirmPlace(); done=true; } }
      G.cancelModes(); }
    S.camps[0].people = 30;
    for (const b of S.buildings) window.game.S && (b.workers = 2);
  });
  await page.waitForTimeout(4000);
}
