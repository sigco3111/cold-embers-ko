export default async function (page) {
  await page.click('text=点起篝火');
  const r = await page.evaluate(() => {
    const g = window.game; const S = g.S; const c = S.camps[0];
    Object.assign(c.stock, { wood: 3000, stone: 2000, plank: 800, food: 800 });
    const out = [];
    for (const t of ['tent','tent','scout','warehouse','tower']) { g.startPlace(t); let done=false, last='';
      for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x)+dx; g.place.y=Math.floor(c.y)+dy; g.updateGhost(); last = g.place.check.reason; if (g.place.check.ok) { g.confirmPlace(); done=true; } }
      out.push(t + ':' + done + ':' + last); g.cancelModes(); }
    c.people = 20;
    g.scoutTarget = { x: 24, y: 36 };
    out.push(JSON.stringify(window.game.S.buildings.map(b => b.type)));
    return out;
  });
  console.log(r);
  await page.evaluate(() => { const g = window.game; g.ui.open('scout'); });
  await page.click('text=出发');
  await page.evaluate(() => { const g = window.game; g.view.focus(24, 26); g.view.zoom(1.4); });
  await page.waitForTimeout(400);
  // 让模拟快进：直接调用 step
  await page.evaluate(async () => { const g = window.game; for (let k = 0; k < 40; k++) { for (let i = 0; i < 2; i++) window.__simstep(3); await new Promise(r => setTimeout(r, 50)); } });
  await page.waitForTimeout(2000);
}
