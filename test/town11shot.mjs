// 1.1 城镇：镇（木屋）、城（石屋）、大城（蒸汽公寓）的房子，白天和夜里（路灯、提灯的行人）
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/town_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); g.ui.adv = null; });
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); S.active = m.id; S.qy = null;
    S.tech.done.townplan = true; m.people = Math.max(m.people, 190); m.hope = 80;
    const T = S.buildings.filter(b => b.camp === m.id && b.type === 'tent');
    T.sort((a, b) => Math.hypot(b.x - m.x, b.y - m.y) - Math.hypot(a.x - m.x, a.y - m.y));
    window.__t = T[0];
    return { tents: T.length, far: T[0] && [T[0].x, T[0].y, T[0].lvl], m: [m.x, m.y] };
  });
  console.log('TOWN', JSON.stringify(info));
  const view = async (n, dist, yaw) => {
    await page.evaluate(([d, y]) => { const g = window.game, v = g.view, t = window.__t; g.ui.close(); v.focus(t.x + 1, t.y + 0.6, true); v.cam.tdist = v.cam.dist = d; if (y != null) { v.cam.tyaw = v.cam.yaw = y; } for (let i = 0; i < 40; i++) v.frame(0.05); }, [dist, yaw]);
    await page.waitForTimeout(2200); await shot(page, n);
  };
  const up = async () => { await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); for (let i = 0; i < 32; i++) Sim.step(S, 1); m.people = Math.max(m.people, 190); m.hope = 80; const r = Sim.townUp(S, m.id); g.drainFx && g.drainFx(); console.log('up', JSON.stringify(r)); }); };
  await view('camp', 9);
  await up(); await view('town', 9);
  await up(); await view('city', 9);
  await up(); await view('big', 9); await view('big2', 6);
  await page.evaluate(() => { const S = window.game.S, DL = 720; S.t = Math.floor(S.t / DL) * DL + 0.8 * DL; });
  await view('night', 9); await view('night2', 14);
  console.log('ERRS', await page.evaluate(() => JSON.stringify((window.__errs || []).slice(0, 5))));
}
