// 深井模型特写：采石场 / 井架矿 / 石灰石场，各看一眼有没有穿模
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  for (const type of ['quarry', 'crystalmine', 'limequarry']) {
    const r = await page.evaluate(t => {
      const g = window.game, S = g.S, Sim = window.__sim;
      let b = S.buildings.find(x => x.type === t);
      if (!b) { // 在营地边上放一个
        const c = g.ui.camp();
        for (let d = 4; d < 14 && !b; d++) for (let k = 0; k < 24 && !b; k++) { const a = k / 24 * 6.283, x = Math.round(c.x + Math.cos(a) * d - 1), y = Math.round(c.y + Math.sin(a) * d - 1); const ck = Sim.checkPlace(S, t, x, y); if (ck.ok || ck.soft) { for (const kk in ck.cost || {}) c.stock[kk] = Math.max(c.stock[kk] || 0, ck.cost[kk] + 10); if (Sim.place(S, t, x, y).ok) b = S.buildings[S.buildings.length - 1]; } }
        if (!b) { S.buildings.find(x => x.type === 'quarry'); return 'cannot place ' + t; }
      }
      b.deep = 1; window.__simstep(1);
      const e = g.view.buildings.get(b.id); if (e) e.cons = 0.0001;
      g.view.focus(b.x + 1, b.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 5.5;
      return { t, at: [b.x, b.y] };
    }, type);
    console.log(JSON.stringify(r));
    await page.waitForTimeout(2600);
    await page.evaluate(() => { for (const e of window.game.view.buildings.values()) if (e.cons > 0) e.cons = 0.0001; });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/deepz_${type}_${TAG}.png`, timeout: 120000 });
  }
}
