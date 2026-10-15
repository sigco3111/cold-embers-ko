// 摆放时的矿点提示：拿着铁矿场 → 矿点画圈、能放的格子浅绿；帐篷放在会挡矿的位置 → 黄色警告
export default async function (page) {
  const mode = process.env.ORESHOT || 'hint';
  await page.evaluate(m => {
    const g = window.game, S = g.S;
    if (m === 'hint') { g.startPlace('ironmine'); const c = window.__sim.mainCamp(S); g.view.focus(c.x, c.y); g.view.cam.tdist = g.view.cam.dist = 30; }
    else { g.startPlace('tent'); g.place.x = 25; g.place.y = 191; g.updateGhost(); g.view.focus(25, 192); g.view.cam.tdist = g.view.cam.dist = 16; }
  }, mode);
  await page.waitForTimeout(2500);
  console.log('placeCost', await page.evaluate(() => document.getElementById('placeCost').textContent));
}
