const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1;
    const J = Sim.journeyOf(S), R = Sim.routeInfo(S);
    if (!R.ok) return 'no route ' + R.gap;
    J.fleet = { sled: 6, tractor: 3 };
    J.trip = { from: J.stage, to: J.stage + 1, path: R.path.map(p => p.slice()), len: R.len, d: Math.min(R.len - 2, 22), speed: 0.15, people: 50, specs: [], goods: { food: 900, wood: 600, coal: 300, plank: 100 }, veh: { sled: 6, tractor: 3 }, fl: 10, t0: S.t, camps: [], phase: 'go' };
    J.trip.ev = [{ id: 'wreck', at: J.trip.d / J.trip.len + 0.001 }];
    Sim.step(S, 1);
    g.view.followTrip = true;
    for (let i = 0; i < 20; i++) g.view.frame(0.05);
    g.view.cam.tdist = g.view.cam.dist = 16;
    g.ui.hud();
    return 'road ' + JSON.stringify(Sim.roadView(S) && Sim.roadView(S).title);
  });
  console.log(info);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${TAG}_road.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.ui.closeModal(); g.ui.hud(); for (let i = 0; i < 10; i++) g.view.frame(0.05); });
  await page.waitForTimeout(800);
}
