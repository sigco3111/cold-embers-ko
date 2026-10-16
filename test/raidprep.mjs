// 袭击前的应对：提前 15 分钟预警，火墙/民兵/收拢物资，没人下令时自动备战
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim;
    let nr = Sim.nextRaid(S); S.t = nr.t - 800; window.__simstep(2); g.ui.hud();
    nr = Sim.nextRaid(S); const c = Sim.getCamp(S, nr.camp); S.active = c.id;
    g.view.focus(c.x, c.y, true); g.view.cam.tdist = g.view.cam.dist = 46;
    return { in: Math.round(nr.in), camp: c.name, str: Sim.raidStrength(S, c, nr), def: Sim.raidDefense(S, c, nr), bell: document.querySelector('#bellBtn')?.textContent, log: S.log.slice(-1)[0].msg };
  });
  console.log('warn', JSON.stringify(a));
  await page.evaluate(() => window.game.ui.actDo('raidp')); // 1.1：袭击提醒在铃铛里，点开就是备战面板
  await page.waitForTimeout(900);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet .pbody')?.innerText.replace(/\s+/g, ' ').slice(0, 500)));
  await page.screenshot({ path: `${OUT}/raid_panel_${TAG}.png`, timeout: 120000 });
  const b = await page.evaluate(() => {
    const click = k => document.querySelector(`#sheet [data-act=prep][data-arg=${k}]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const S = window.game.S, Sim = window.__sim, nr = Sim.nextRaid(S), c = Sim.getCamp(S, nr.camp), f0 = Sim.fuelUnitsOf(c.stock);
    click('fire'); const d1 = Sim.raidDefense(S, c, nr);
    click('mil'); const d2 = Sim.raidDefense(S, c, nr);
    click('hide');
    return { d0: Sim.campDefense(S, c), d1, d2, fuelUsed: Math.round(f0 - Sim.fuelUnitsOf(c.stock)), prep: S.rprep, buffs: Sim.activeBuffs(S, c).map(b => b.n) };
  });
  console.log('prep', JSON.stringify(b));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/raid_panel2_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.close());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/raid_fire_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.view.cam.tdist = g.view.cam.dist = 16; const S = g.S, c = window.__sim.getCamp(S, S.rprep.camp), R = window.__sim.heatRadius(S, c) + 0.7; g.view.focus(c.x, c.y - R, true); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/raid_fire2_${TAG}.png`, timeout: 120000 });
  const r = await page.evaluate(() => { const S = window.game.S, nr = window.__sim.nextRaid(S); S.t = nr.t - 1.5; window.__simstep(3); return S.log.slice(-1)[0].msg; });
  console.log('result', r);
  // 自动备战：把箭塔的人撤掉，让它守不住
  const d = await page.evaluate(() => {
    const S = window.game.S, Sim = window.__sim; let nr = Sim.nextRaid(S); const c = Sim.getCamp(S, nr.camp);
    for (const b of S.buildings) if (b.camp === c.id && b.type === 'tower') { b.workers = 0; b.hold = true; }
    S.t = nr.t - 290; window.__simstep(2); nr = Sim.nextRaid(S);
    return { str: Sim.raidStrength(S, c, nr), d0: Sim.campDefense(S, c), def: Sim.raidDefense(S, c, nr), prep: S.rprep, log: S.log.slice(-2).map(l => l.msg) };
  });
  console.log('auto', JSON.stringify(d));
}
