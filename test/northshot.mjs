// 北境画面：NSHOT=camp（营地和地标）| mark（第 NK 站地标特写）| far（拉远看地形和群山）| seam（地图接缝那一段）| bigmap | panel
export default async function (page) {
  const m = process.env.NSHOT || 'camp', nk = +(process.env.NK || 1);
  await page.evaluate(([m, nk]) => {
    const g = window.game, S = g.S, Sim = window.__sim, v = g.view;
    if (m === 'camp') { const c = Sim.mainCamp(S), st = Sim.stopOf(S, Sim.journeyOf(S).stage); v.focus(c.x, (c.y + st.y) / 2, true); v.cam.tdist = v.cam.dist = 26; }
    if (m === 'mark') { const st = Sim.stopOf(S, Sim.SPINE + nk); Sim.revealCircle(S, st.x, st.y, 9); v.focus(st.x, st.y - 1, true); v.cam.tdist = v.cam.dist = 15; }
    if (m === 'far') { const c = Sim.mainCamp(S); v.focus(c.x, c.y + 20, true); v.cam.tdist = v.cam.dist = 80; }
    if (m === 'seam') { Sim.revealCircle(S, 24, 1000, 30); v.focus(24, 1000, true); v.cam.tdist = v.cam.dist = 40; }
    if (m === 'bigmap') g.bigmap.show();
    if (m === 'panel') g.ui.open('migrate');
  }, [m, nk]);
  await page.waitForTimeout(3000);
  if (m === 'bigmap' && process.env.ROW) await page.evaluate(row => { const b = window.game.bigmap, sc = document.querySelector('.bmscroll'); sc.scrollTop = Math.max(0, (b.maxRow - row) * b.k - sc.clientHeight / 2); }, +process.env.ROW);
  await page.waitForTimeout(800);
}
