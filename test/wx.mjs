// 暴风雪预报 + 超载熔炉
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp(), f = Sim.getB(S, c.furnace);
    const w = Sim.weatherAt(S, S.t);
    S.t = (w.blizzard || w.warn ? Sim.weatherAt(S, w.slot.end + 10).slot.start : w.slot.start) - 1800;
    for (const k of ['wood', 'coal']) c.stock[k] = Math.max(c.stock[k] || 0, 3000);
    window.__simstep(2); g.ui.hud();
    g.view.focus(f.x + 1.5, f.y + 1.5, true); g.view.cam.tdist = g.view.cam.dist = 20;
    return { pill: document.querySelector('#stats .pill.wx')?.textContent, log: S.log.slice(-2).map(l => l.msg) };
  });
  console.log('forecast', JSON.stringify(a));
  await page.evaluate(() => document.querySelector('#stats .pill.wx')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(900);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet .pbody')?.innerText.replace(/\s+/g, ' ').slice(0, 400)));
  await page.screenshot({ path: `${OUT}/wx_panel_${TAG}.png`, timeout: 120000 });
  // 手动超载
  await page.evaluate(() => document.querySelector('#sheet [data-act=od][data-arg="1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const b = await page.evaluate(() => { const g = window.game, S = g.S, c = g.ui.camp(), cr0 = { ...window.__sim.rt(S).c[c.id] }; window.__simstep(60); const cr = window.__sim.rt(S).c[c.id]; return { od: c.od, ovh: +c.ovh.toFixed(1), burn0: +cr0.burnPerMin.toFixed(2), burn: +cr.burnPerMin.toFixed(2), heat0: Math.round(cr0.heat), heat: Math.round(cr.heat), odHeat: Math.round(cr.odHeat) }; });
  console.log('manual', JSON.stringify(b));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/wx_od_${TAG}.png`, timeout: 120000 });
  // 烧过头 → 停炉
  const c = await page.evaluate(() => { const g = window.game, S = g.S, c = g.ui.camp(); c.ovh = 99.5; window.__simstep(12); const cr = window.__sim.rt(S).c[c.id]; return { od: c.od, cool: c.odCool, ovh: Math.round(c.ovh), stall: cr.stall, heat: Math.round(cr.heat), log: S.log.slice(-1)[0].msg }; });
  console.log('stall', JSON.stringify(c));
  await page.evaluate(() => window.game.ui.renderPanel(true));
  await page.waitForTimeout(300);
  console.log('panel2', await page.evaluate(() => document.querySelector('#sheet .odbox')?.innerText.replace(/\s+/g, ' ')));
  // 暴风雪里自动超载 + 85% 歇一歇
  const d = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    c.odCool = 0; c.ovh = 0; c.od = 0; c.odAuto = true;
    const w = Sim.weatherAt(S, S.t); S.t = w.slot.start + 5; window.__simstep(3);
    const r1 = { bliz: Sim.weatherAt(S, S.t).blizzard, od: Sim.rt(S).c[c.id].od };
    c.ovh = 84.99; window.__simstep(3);
    const r2 = { od: Sim.rt(S).c[c.id].od, ovh: Math.round(c.ovh) };
    c.ovh = 39; window.__simstep(3);
    const r3 = { od: Sim.rt(S).c[c.id].od };
    return { r1, r2, r3, log: S.log.slice(-3).map(l => l.msg) };
  });
  console.log('auto', JSON.stringify(d));
  await page.evaluate(() => { const g = window.game; g.ui.hud(); g.ui.open('bld', g.ui.camp().furnace); });
  await page.waitForTimeout(900);
  console.log('pill', await page.evaluate(() => document.querySelector('#stats .pill.wx')?.textContent));
  await page.screenshot({ path: `${OUT}/wx_furnace_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { document.getElementById('sheet').scrollTop = 9999; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/wx_furnace2_${TAG}.png`, timeout: 120000 });
}
