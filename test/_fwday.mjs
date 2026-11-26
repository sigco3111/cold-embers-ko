export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim; let nr, tries = 0;
    do { nr = Sim.nextRaid(S); S.t = nr.t - 800; S.raidDone = nr.k - 1; if (window.__dc(S.t) === '白天') break; S.raidDone = nr.k; S.t = nr.t + 10; } while (tries++ < 30);
    window.__simstep(1); nr = Sim.nextRaid(S); const c = Sim.getCamp(S, nr.camp); S.active = c.id; const ok = Sim.doPrep(S, 'fire'); const R = Sim.heatRadius(S, c) + 0.7; g.view.focus(c.x, c.y - R, true); g.view.cam.tdist = g.view.cam.dist = 24; return { ok, dc: window.__dc(S.t) }; });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/dn/fw_day.png', timeout: 120000 });
}
