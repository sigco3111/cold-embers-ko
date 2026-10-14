const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1;
    const J = Sim.journeyOf(S), deps = S.camps.filter(c => c.depot).sort((a, b) => a.y - b.y);
    const r = Sim.douseDepot(S, deps[0].id);
    for (let i = 0; i < 40; i++) Sim.step(S, 1);
    for (let i = 0; i < 10; i++) g.view.frame(0.05);
    window.__deps = deps.map(c => c.id);
    return JSON.stringify({ r, legs: J.legs.map(l => (l.path || []).length), ruins: J.ruins.map(x => [x.n, x.b.length]), deps: deps.map(c => [c.name, c.people, JSON.stringify(Sim.rt(S).c[c.id] && Sim.rt(S).c[c.id].sent)]) });
  });
  console.log(info);
  // 废墟
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, R = Sim.journeyOf(S).ruins[0]; g.view.focus(R.x, R.y, true); g.view.cam.tdist = g.view.cam.dist = 22; for (let i = 0; i < 30; i++) g.view.frame(0.05); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_ruin.png`, timeout: 120000 });
  // 雪橇道：补给站到主营地中间
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, d = S.camps.find(c => c.depot), m = Sim.mainCamp(S); d.send = ['coal', 'wood']; for (let i = 0; i < 3; i++) Sim.step(S, 1); S.active = d.id; g.view.focus(d.x, d.y + 12, true); g.view.cam.tdist = g.view.cam.dist = 30; for (let i = 0; i < 30; i++) g.view.frame(0.05); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_trail.png`, timeout: 120000 });
  // 补给站面板
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, d = S.camps.find(c => c.depot); S.active = d.id; g.view.focus(d.x, d.y, true); g.view.cam.tdist = g.view.cam.dist = 16; g.ui.open('camp'); for (let i = 0; i < 20; i++) g.view.frame(0.05); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_depot.png`, timeout: 120000 });
}
