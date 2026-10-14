const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.click('text=点起篝火').catch(() => {});
  await page.waitForTimeout(800);
  await page.click('text=跳过引导').catch(() => {});
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; window.__noEvents = 1; g.ui.closeModal && g.ui.closeModal();
    S.reveal.fill(1); Sim.rt(S).revealN = 99; S.known = 7; Sim.dirty(S);
    const J = Sim.journeyOf(S); J.stage = 11;
    const c = Sim.mainCamp(S); c.people = 160;
    for (const k of ['wood', 'stone', 'plank', 'food', 'coal', 'iron', 'steel', 'gear', 'seal', 'alloy', 'part', 'battery', 'core', 'engine', 'heart']) c.stock[k] = 90000;
    Sim.getB(S, c.furnace).lvl = 30; Sim.dirty(S);
    const out = [];
    const put = (t, dx, dy) => { for (let r = 0; r < 8; r++) for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const x = Math.floor(c.x) + dx + xx, y = Math.floor(c.y) + dy + yy; if (Sim.checkPlace(S, t, x, y).ok) { Sim.place(S, t, x, y); out.push([t, x, y]); return; } } out.push([t, 'fail', Sim.checkPlace(S, t, Math.floor(c.x) + dx, Math.floor(c.y) + dy).reason]); };
    put('beacon', -5, -3); put('colossus', 4, -4); put('starpit', 0, 5);
    for (let i = 0; i < 20; i++) Sim.step(S, 1);
    return JSON.stringify(out);
  });
  console.log(info);
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, c = Sim.mainCamp(S); g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 15; for (let i = 0; i < 30; i++) g.view.frame(0.05); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_far_blds.png`, timeout: 120000 });
  // 拉近看每一座
  for (const t of (process.env.ONLY ? [] : ['beacon', 'colossus', 'starpit'])) {
    await page.evaluate((t) => { const g = window.game, S = g.S, b = S.buildings.find(q => q.type === t); if (!b) return; const s = window.__sim.BLD ? 0 : 0; const sz = window.__sim.BLD_SIZE ? 0 : (t === 'colossus' ? 1.5 : 1); g.view.focus(b.x + sz, b.y + sz, true); g.view.cam.tdist = g.view.cam.dist = 9; for (let i = 0; i < 30; i++) g.view.frame(0.05); }, t);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${TAG}_far_${t}.png`, timeout: 120000 });
  }
  // 星落之坑的星核石
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, f = window.__world ? null : null; const w = Sim.worldOf ? Sim.worldOf(S) : null; const p = (w || {}).far ? w.far[4] : null; window.__far4 = p; });
  const far = await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim; const st = Sim.stopOf(S, 11); g.view.focus(st.x, st.y + 3, true); g.view.cam.tdist = g.view.cam.dist = 12; for (let i = 0; i < 10; i++) g.view.frame(0.05); Sim.rt(S).revealDirty = true; for (let i = 0; i < 40; i++) g.view.frame(0.05); return [st.x, st.y]; });
  console.log('far4', far);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_far_starfall.png`, timeout: 120000 });
  // 车队：破冰车打头
  const dep = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S), c = Sim.mainCamp(S);
    J.stage = 8; Sim.getB(S, c.furnace).lvl = 40; for (let s = 0; s <= 8; s++) for (let k = 0; k < 3; k++) Sim.chapState(S).ok[s + ':' + k] = 1;
    J.fleet.icebreaker = 6; J.fleet.tractor = 4; J.fleet.sled = 8; c.people = 100;
    const r = Sim.depart(S); if (!r.ok) return r.reason;
    J.trip.ev = [];
    for (let i = 0; i < 70; i++) Sim.step(S, 1);
    const T = J.trip, p = Sim.tripPos({ path: T.path, d: T.d - 3 });
    g.view.focus(p.x, p.y, true); g.view.cam.tdist = g.view.cam.dist = 10; for (let i = 0; i < 30; i++) g.view.frame(0.05);
    return JSON.stringify({ veh: T.veh, d: T.d });
  });
  console.log('dep', dep);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${TAG}_far_caravan.png`, timeout: 120000 });
}
