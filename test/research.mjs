// 研究：建工程站、开始研究、看进度和面板
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    // 在熔炉附近找一块能建工程站的地
    const f = Sim.getB(S, c.furnace); let spot = null;
    for (let rr = 3; rr < 16 && !spot; rr++) for (let a = 0; a < 24 && !spot; a++) { const x = Math.round(f.x + 1 + Math.cos(a / 24 * 6.283) * rr), y = Math.round(f.y + 1 + Math.sin(a / 24 * 6.283) * rr); if (Sim.checkPlace(S, 'workshop', x, y).ok) spot = [x, y]; }
    const pl = Sim.place(S, 'workshop', spot[0], spot[1]);
    const b = S.buildings[S.buildings.length - 1];
    const st = Sim.startTech(S, 'axe');
    b.workers = 3;
    g.view.focus(b.x + 1, b.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 9;
    window.__shop = b.id;
    return { spot, pl: pl.ok, st, b: b.type };
  });
  console.log(JSON.stringify(r));
  await page.evaluate(() => window.__simstep(240));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const e = window.game.view.buildings.get(window.__shop); if (e) e.cons = 0.001; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/research_bld_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.open('research'));
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => { const S = window.game.S; return { tech: S.tech, rate: window.__sim.rt(S).rpRate, shop: window.__sim.rt(S).b[window.__shop] }; });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/research_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.__simstep(600));
  await page.waitForTimeout(1500);
  console.log('after', JSON.stringify(await page.evaluate(() => window.game.S.tech)));
}
