export default async function (page) {
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim;
    g.startCopy('steel');
    const P = g.place; if (!P) return 'no place';
    const c = Sim.mainCamp(S);
    // 在主营地供热圈里找一处能放下最多的位置
    let best = null, bs = -1;
    for (let y = Math.floor(c.y - 16); y < c.y + 16; y++) for (let x = 0; x < 44; x++) { const pl = Sim.blueprintPlan(S, P.bp, x, y); const sc = pl.ok * 2 + pl.q; if (sc > bs) { bs = sc; best = [x, y, pl.ok, pl.q, pl.bad]; } }
    P.x = best[0]; P.y = best[1]; g.updateGhost(); g.view.focus(best[0] + P.bp.w / 2, best[1] + P.bp.h / 2);
    return JSON.stringify({ items: P.bp.items.length, best });
  });
  console.log(r);
  await page.waitForTimeout(2500);
}
