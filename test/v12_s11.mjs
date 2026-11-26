const OUT = process.env.OUTDIR || '/tmp/v12';
export default async function (page) {
  for (let i = 0; i < 20; i++) { const on = await page.evaluate(() => document.getElementById('modal').classList.contains('show')); if (on) break; await page.waitForTimeout(1000); }
  console.log(await page.evaluate(() => 'whatsNew ' + window.game.whatsNew + ' ver ' + window.game.S.meta.ver));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/s11_new.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1; g.togglePause(true); g.bigmap.show(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/s11_map.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.bigmap.hide(); g.ui.open('migrate'); document.getElementById('sheet').scrollTop = 1400; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/s11_mig3.png`, timeout: 120000 });
  // 出发、跟车，看「车队上路了」的提示和第一次路上的事
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S), m = Sim.mainCamp(S);
    g.ui.close();
    S.reveal.fill(1); Sim.rt(S).revealDirty = true; Sim.rt(S).revealN = 99;
    for (let k = 0; k < 3; k++) Sim.chapState(S).ok[J.stage + ':' + k] = 1;
    Sim.getB(S, m.furnace).lvl = Math.max(Sim.getB(S, m.furnace).lvl, 30);
    J.fleet.sled = (J.fleet.sled || 0) + 20; J.fleet.tractor = (J.fleet.tractor || 0) + 4;
    for (const k of ['wood', 'food', 'coal', 'plank', 'steel', 'iron', 'battery']) m.stock[k] = Math.max(m.stock[k] || 0, 5000);
    S.meta.tut = true; S.meta.hints = S.meta.hints || {}; delete S.meta.hints.depart; delete S.meta.hints.trip; delete S.meta.hints.road;
    const d = Sim.depart(S); if (!d.ok) return 'fail ' + d.reason;
    for (let i = 0; i < 20; i++) Sim.step(S, 1);
    g.togglePause(true); g.view.followTrip = true; g.hints.since = 999; g.hints.t = 5;
    return 'ok ' + J.trip.ev.map(e => e.id + '@' + e.at.toFixed(2)).join(',');
  });
  console.log(r);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/s11_trip.png`, timeout: 120000 });
  const r2 = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S), T = J.trip;
    document.querySelector('#hint button.ghost') && document.querySelector('#hint button.ghost').click();
    let n = 0; while (T && !T.road && n < 3000) { Sim.step(S, 1); n++; }
    return 'road ' + (T.road && T.road.id) + ' after ' + n;
  });
  console.log(r2);
  await page.evaluate(() => { const g = window.game; g.hints.hide(); g.togglePause(false); });
  await page.waitForTimeout(6000);
  console.log(await page.evaluate(() => 'modal ' + document.getElementById('modal').classList.contains('show') + ' ' + (document.querySelector('#modal h2') || {}).textContent));
  await page.screenshot({ path: `${OUT}/s11_road.png`, timeout: 120000 });
}
