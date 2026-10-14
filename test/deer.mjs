const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const st = await page.$('text=点起篝火'); if (st) await st.click();
  const r0 = await page.evaluate(() => {
    const g = window.game, v = g.view, S = g.S;
    for (let k = 0; k < 48 * 60; k++) S.reveal[k] = 1;
    v.refreshFog(); v.refreshSpots(); v.refreshRocks();
    const d = v.deer.slice().sort((a, b) => Math.hypot(a.x - S.camps[0].x, a.y - S.camps[0].y) - Math.hypot(b.x - S.camps[0].x, b.y - S.camps[0].y))[0];
    v.focus(d.x, d.y, true); v.cam.tdist = 9; v.cam.dist = 9;
    window.__d0 = v.deer.map(d => [d.x, d.y]);
    return { n: v.deer.length, at: [d.x.toFixed(1), d.y.toFixed(1)] };
  });
  console.log(JSON.stringify(r0));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/deer_a.png`, timeout: 120000 });
  // 快进动画
  const r1 = await page.evaluate(() => { const v = window.game.view; for (let i = 0; i < 600; i++) v.animDeer(0.05); const moved = v.deer.filter((d, i) => Math.hypot(d.x - window.__d0[i][0], d.y - window.__d0[i][1]) > 0.05).length; const st = {}; for (const d of v.deer) st[d.st] = (st[d.st] || 0) + 1; return { moved, st }; });
  console.log(JSON.stringify(r1));
  // 放一个人在鹿旁边，看它跑开
  const r2 = await page.evaluate(() => { const v = window.game.view; const d = v.deer[0]; const x0 = d.x, y0 = d.y; v.figPts = [d.x + 0.4, d.y]; d.cool = 0; d.st = 'graze'; for (let i = 0; i < 40; i++) v.animDeer(0.05); return { st: d.st, dist: Math.hypot(d.x - x0, d.y - y0).toFixed(2), dx: (d.x - x0).toFixed(2) }; });
  console.log(JSON.stringify(r2));
  await page.waitForTimeout(3000);
}
