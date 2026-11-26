const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  // 先看路线预览
  const pre = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1;
    const J = Sim.journeyOf(S), m = Sim.mainCamp(S);
    S.reveal.fill(1); Sim.rt(S).revealDirty = true; Sim.rt(S).revealN = 99;
    const ch = Sim.chapters(S).find(c => c.i === J.stage);
    for (let k = 0; k < 3; k++) Sim.chapState(S).ok[J.stage + ':' + k] = 1;
    Sim.getB(S, m.furnace).lvl = Math.max(Sim.getB(S, m.furnace).lvl, 30);
    J.fleet.sled = (J.fleet.sled || 0) + 20; J.fleet.tractor = (J.fleet.tractor || 0) + 4;
    for (const k of ['wood', 'food', 'coal', 'plank', 'steel', 'iron', 'battery']) m.stock[k] = Math.max(m.stock[k] || 0, 5000);
    const gt = Sim.departGate(S);
    g.ui.open('migrate');
    return JSON.stringify({ stage: J.stage, gate: gt.items.map(i => i.ok + ' ' + i.sub) });
  });
  console.log(pre);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${TAG}_arr0.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.actDo('routeprev'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${TAG}_arr1.png`, timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${TAG}_arr2.png`, timeout: 120000 });
  // 出发，然后一路走到
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S);
    const d = Sim.depart(S);
    if (!d.ok) return 'depart fail ' + d.reason;
    J.trip.ev = [];
    let n = 0; while (J.trip && J.trip.phase !== 'arrive' && n < 5000) { Sim.step(S, 1); n++; }
    g.togglePause(true);
    return 'steps ' + n + ' phase ' + (J.trip && J.trip.phase);
  });
  console.log(r);
  await page.waitForTimeout(800);
  await page.evaluate(() => { const g = window.game; g.ui.closeModal && g.ui.closeModal(); if (!g.place) g.startArrive(); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_arr3.png`, timeout: 120000 });
  const r2 = await page.evaluate(() => { const g = window.game; return JSON.stringify({ place: g.place && { type: g.place.type, arrive: g.place.arrive }, name: document.querySelector('#placebar, .placebar') && document.querySelector('#placebar, .placebar').innerText }); });
  console.log(r2);
}
