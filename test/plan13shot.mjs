// 摆放预演卡片 + 推荐位置星星（PLAN13=ghost），规划表还差几座（PLAN13=plan，PLAN_R 选哪条线）
export default async function (page) {
  const m = process.env.PLAN13 || 'ghost';
  if (m === 'ghost') {
    const r = await page.evaluate(t => {
      const g = window.game; g.startPlace(t); g.updateGhost && g.updateGhost();
      const Sim = window.__sim, S = g.S, c = Sim.getCamp(S, S.active), st = Sim.suggestSpots(S, t, c.id);
      if (st[0]) { g.place.x = st[0].x; g.place.y = st[0].y; g.updateGhost(); g.view.focus(st[0].x + 1, st[0].y + 1, true); }
      g.view.cam.tdist = g.view.cam.dist = 30;
      return JSON.stringify(st);
    }, process.env.PLAN_T || 'steelworks');
    console.log('stars', r);
    await page.waitForTimeout(2500);
  } else {
    await page.evaluate(r => window.game.chainmap.plan(r), process.env.PLAN_R || 'steel');
    await page.waitForTimeout(1500);
  }
}
