// 永恒之炉以北的远方地标：发现、模型、面板、点亮带回遗物、大地图
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, far = window.__world().far;
    // 白天
    while (window.__dc(S.t) !== '白天') S.t += 600;
    const e0 = S.meta.embers;
    for (const p of far) Sim.revealCircle(S, p.x, p.y, 9);
    window.__simstep(2);
    return { far, seen: S.far.seen, embers: S.meta.embers - e0, log: S.log.slice(-2).map(l => l.msg), block: Sim.checkPlace(S, 'tent', far[0].x, far[0].y).reason };
  });
  console.log('found', JSON.stringify(a));
  for (let i = 0; i < 6; i++) {
    await page.evaluate(i => { const g = window.game, p = window.__world().far[i]; g.ui.close(); g.view.focus(p.x + 0.5, p.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 15; }, i);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: `${OUT}/far${i}_${TAG}.png`, timeout: 120000 });
  }
  await page.evaluate(() => window.game.ui.open('far', 0));
  await page.waitForTimeout(800);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet .pbody')?.innerText.replace(/\s+/g, ' ').slice(0, 400)));
  await page.screenshot({ path: `${OUT}/far_panel_${TAG}.png`, timeout: 120000 });
  // 点亮：在灯塔旁放一个假营地坐标跑一下
  const b = await page.evaluate(() => {
    const S = window.game.S, Sim = window.__sim, p = window.__world().far[0], c = S.camps[0], ox = c.x, oy = c.y;
    const r0 = Sim.scoutRange(S, c.id); c.x = p.x + 10; c.y = p.y; window.__simstep(1); c.x = ox; c.y = oy;
    return { lit: S.far.lit, relics: S.meta.relics, sight: Sim.relicSum(S, 'sight'), r0, r1: Sim.scoutRange(S, c.id), goal: document.getElementById('goal')?.textContent };
  });
  console.log('lit', JSON.stringify(b));
  await page.evaluate(() => window.game.drainFx && window.game.drainFx());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/far_relic_${TAG}.png`, timeout: 120000 });
  console.log('modal', await page.evaluate(() => document.querySelector('#modal.show')?.innerText.replace(/\s+/g, ' ').slice(0, 200)));
  await page.evaluate(() => { document.getElementById('modal').classList.remove('show'); window.game.ui.close(); window.game.bigmap.toggle(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const sc = document.querySelector('.bmscroll'); if (sc) sc.scrollTop = 0; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/far_map_${TAG}.png`, timeout: 120000 });
}
