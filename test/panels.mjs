export default async function (page) {
  await page.click('text=点起篝火');
  const shots = [];
  await page.evaluate(() => {
    const g = window.game; const S = g.S; const c = S.camps[0];
    Object.assign(c.stock, { wood: 3000, stone: 2000, plank: 800, food: 800, iron: 100 });
    for (const t of ['tent','tent','scout','warehouse','tower']) { g.startPlace(t); let done=false;
      for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x)+dx; g.place.y=Math.floor(c.y)+dy; g.updateGhost(); if (g.place.check.ok) { g.confirmPlace(); done=true; } }
      g.cancelModes(); }
    c.people = 20;
  });
  for (const k of ['build','camp','scout','lines','specs','migrate','menu']) {
    if (k === 'menu') await page.click('#menuBtn'); else await page.evaluate(k => window.game.ui.open(k), k); // 1.1：底栏换成五个分区，这些面板在分区的页签里
    await page.waitForTimeout(400);
    await page.screenshot({ path: `/tmp/panel_${k}.png`, timeout: 120000 });
    await page.click('#sheet .x');
  }
  // 侦察：选目标并出发
  await page.evaluate(() => { const g = window.game; g.startScoutPick(); g.scoutTarget = { x: 24, y: 38 }; g.ui.open('scout'); });
  await page.waitForTimeout(300);
  await page.click('text=出发');
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 120; i++) window.game.S && null; });
  // 快进 2 分钟模拟
  await page.evaluate(() => { const g = window.game; for (let i = 0; i < 90; i++) { (window.__step || (()=>{}))(); } });
  await page.waitForTimeout(500);
}
