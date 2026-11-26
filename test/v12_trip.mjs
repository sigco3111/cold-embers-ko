const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1;
    const J = Sim.journeyOf(S), R = Sim.routeInfo(S);
    if (!R.ok) return 'no route ' + R.gap;
    J.fleet = { sled: 6, tractor: 3 };
    J.trip = { from: J.stage, to: J.stage + 1, path: R.path.map(p => p.slice()), len: R.len, d: Math.min(R.len - 2, 22), speed: 0.15, people: 50, specs: [], goods: { food: 100 }, veh: { sled: 6, tractor: 3 }, fl: 10, t0: S.t, camps: [], phase: 'go' };
    S.t = Math.ceil(S.t / 720) * 720 + 0.35 * 720;
    g.view.followTrip = true;
    for (let i = 0; i < 20; i++) g.view.frame(0.05);
    g.view.cam.tdist = g.view.cam.dist = 16;
    return 'ok len ' + R.len.toFixed(1);
  });
  console.log(info);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_trip.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.view.cam.tdist = g.view.cam.dist = 40; for (let i = 0; i < 30; i++) g.view.frame(0.05); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${TAG}_trip_far.png`, timeout: 120000 });
  // 雪橇棚面板
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S); J.trip = null; g.view.followTrip = false;
    const c = Sim.mainCamp(S); S.active = c.id;
    let best = null; const r = Sim.heatRadius(S, c);
    for (let y = Math.floor(c.y - r); y <= c.y + r && !best; y++) for (let x = Math.floor(c.x - r); x <= c.x + r && !best; x++) if (Sim.checkPlace(S, 'sledshed', x, y).ok) best = [x, y];
    if (!best) { const v = S.buildings.find(b => b.camp === c.id && b.type === 'tower'); Sim.demolish(S, v.id); best = [v.x, v.y]; for (let y = Math.floor(c.y - r); y <= c.y + r; y++) for (let x = Math.floor(c.x - r); x <= c.x + r; x++) if (Sim.checkPlace(S, 'sledshed', x, y).ok) { best = [x, y]; y = 1e9; break; } }
    const res = Sim.place(S, 'sledshed', best[0], best[1]);
    const b = S.buildings[S.buildings.length - 1]; b.built = true; b.workers = 2; delete b.bt;
    Sim.orderVeh(S, b.id, 'sled', 3); Sim.orderVeh(S, b.id, 'tractor', 1);
    for (let i = 0; i < 20; i++) Sim.step(S, 1);
    g.view.focus(b.x + 1, b.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 12; g.view.select(b.id); g.ui.open('bld', b.id);
    for (let i = 0; i < 30; i++) g.view.frame(0.05);
    window.__shed = b.id; return res;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_shed.png`, timeout: 120000 });
}
