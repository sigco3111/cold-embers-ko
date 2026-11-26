// 医务所：模型（白天、夜里）、面板（有病人、有医生）
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true; S.known = Math.max(S.known, 2);
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.3 * DL;
    for (const k of ['wood', 'plank', 'stone', 'iron']) c.stock[k] = 9999;
    let at = null, best = 1e9;
    for (let y = Math.floor(c.y - 10); y <= c.y + 10; y++) for (let x = Math.floor(c.x - 10); x <= c.x + 10; x++) { const ck = Sim.checkPlace(S, 'infirmary', x, y); if (ck.ok) { const d = Math.hypot(x + 1 - c.x - 3, y + 1 - c.y + 2); if (d < best) { best = d; at = [x, y]; } } }
    if (!at) return 'no spot';
    const b = Sim.getB(S, Sim.place(S, 'infirmary', at[0], at[1]).id);
    c.people = Math.max(c.people, 12); c.auto = false; b.workers = 2; c.sick = 3;
    S.meta.specs.he = { lvl: 1 }; Sim.assignSpec(S, 'he', b.id);
    for (let i = 0; i < 4; i++) Sim.step(S, 1);
    g.view.focus(b.x + 1, b.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 7;
    window.__wb = b.id;
    return { at, ward: Sim.wardOf(S, c), sick: c.sick };
  });
  console.log('ward', JSON.stringify(r));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const e = window.game.view.buildings.get(window.__wb); if (e) e.cons = 0.0001; });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/ward_day_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const S = window.game.S, DL = 720; S.t = Math.floor(S.t / DL) * DL + 0.8 * DL; });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/ward_night_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.open('bld', window.__wb));
  await page.waitForTimeout(800);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 600)));
  await page.screenshot({ path: `${OUT}/ward_panel_${TAG}.png`, timeout: 120000 });
}
