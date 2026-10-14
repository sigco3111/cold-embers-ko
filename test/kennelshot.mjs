// 雪橇犬舍：犬舍模型、院子里的狗、营地里跑的狗、带狗的侦察队
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true;
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.3 * DL;
    for (const k of ['wood', 'plank', 'stone']) c.stock[k] = Math.max(c.stock[k] || 0, 999);
    c.stock.game = 999;
    let at = null, best = 1e9;
    for (let y = Math.floor(c.y - 12); y <= c.y + 12; y++) for (let x = Math.floor(c.x - 12); x <= c.x + 12; x++) { const ck = Sim.checkPlace(S, 'kennel', x, y); if (ck.ok) { const d = Math.hypot(x + 1 - c.x, y + 1 - c.y); if (d < best) { best = d; at = [x, y]; } } }
    if (!at) return 'no spot';
    const res = Sim.place(S, 'kennel', at[0], at[1]); const b = Sim.getB(S, res.id); b.workers = 2; b.lvl = 3;
    for (let i = 0; i < 4; i++) Sim.step(S, 1);
    g.view.focus(b.x + 1, b.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 7;
    window.__kb = b.id;
    return { at, dogs: Sim.dogsOf(S, c.id), scout: Sim.dogScout(S, c.id) };
  });
  console.log('kennel', JSON.stringify(r));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const e = window.game.view.buildings.get(window.__kb); if (e) e.cons = 0.0001; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/kennel_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.open('bld', window.__kb));
  await page.waitForTimeout(800);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 400)));
  await page.screenshot({ path: `${OUT}/kennel_panel_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.ui.close(); const c = g.ui.camp(); g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 18; });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/kennel_camp_${TAG}.png`, timeout: 120000 });
}
