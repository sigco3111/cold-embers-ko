// 1.1 分岔北境 + 站点奇遇：北迁里的选路卡片、铃铛提醒、奇遇弹窗和结果、营地里的狼王皮
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/north_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); });
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, J = Sim.journeyOf(S), m = Sim.mainCamp(S); S.active = m.id;
    Sim.towerList(S).push({ n: Sim.northN(J.stage), x: 0, y: 0, t: S.t, camp: J.main, type: 'pyre' });
    for (let i = 0; i < 3; i++) Sim.step(S, 1);
    const F = Sim.forkOf(S);
    return { stage: J.stage, fork: F && F.opts.map(o => [o.rule, o.qy, o.bonus, o.d]), qy: S.qy && [S.qy.id, S.qy.at - S.t] };
  });
  console.log('NORTH', JSON.stringify(info));
  // 铃铛提醒
  await page.evaluate(() => { const u = window.game.ui; u.hud && u.hud(); u.actDo('bell'); });
  await page.waitForTimeout(800); await shot(page, 'bell');
  // 北迁：选路卡片
  await page.evaluate(() => { const u = window.game.ui; u.closeModal && u.closeModal(); u.close(); u.open('migrate'); u.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'fork');
  await page.evaluate(() => { const s = window.game.ui.sheet, el = s.querySelector('.fkl'); if (el) s.scrollTop = el.offsetTop - 40; });
  await page.waitForTimeout(400); await shot(page, 'fork2');
  await page.evaluate(() => { const s = window.game.ui.sheet, el = s.querySelectorAll('.fko')[1]; if (el) s.scrollTop = el.offsetTop - 40; });
  await page.waitForTimeout(400); await shot(page, 'fork3');
  // 选第二条：地图重新生成
  await page.evaluate(() => { const u = window.game.ui; u.actDo('forkpick', 1); });
  await page.waitForTimeout(1500); await shot(page, 'forkon');
  // 奇遇：时间到了，弹窗
  const qy = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.close();
    S.qy = { k: S.qy.k, id: 'wolfking', st: 0, at: S.t, camp: Sim.mainCamp(S).id };
    for (let i = 0; i < 2; i++) Sim.step(S, 1);
    g.ui.qyModal();
    return Sim.qyView(S);
  });
  console.log('QY', JSON.stringify(qy && { t: qy.text, opts: qy.opts && qy.opts.map(o => [o.t, o.ok]) }));
  await page.waitForTimeout(900); await shot(page, 'qy');
  await page.evaluate(() => { window.game.ui.actDo('qyopt', 0); });
  await page.waitForTimeout(900); await shot(page, 'qyres');
  // 换一个带向导选项的
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal();
    S.tech.done.guide = true;
    S.qy = { k: S.qy.k, id: 'aurora', st: 0, at: S.t, camp: Sim.mainCamp(S).id };
    Sim.step(S, 1); g.ui.qyModal();
  });
  await page.waitForTimeout(900); await shot(page, 'qyguide');
  // 狼王皮摆在营地里
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); g.ui.closeModal(); g.ui.close();
    S.meta.f13 = S.meta.f13 || {}; S.meta.f13.wolfking = 1; const bk = Sim.bookOf(S); bk.a.wolfking = bk.a.wolfking || 1;
    let done = null;
    for (let r = 3; r < 14 && !done; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r && !done; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r && !done; x++) {
      const c = Sim.checkPlace(S, 'wolfrug', x, y); if (c.ok) { const res = Sim.place(S, 'wolfrug', x, y); if (res.ok) done = Sim.getB(S, res.id); }
    }
    if (done) { done.done = true; delete done.prog; Sim.step(S, 1); g.view.focus(done.x + 0.5, done.y + 0.5, true); g.view.cam.tdist = g.view.cam.dist = 8; for (let i = 0; i < 40; i++) g.view.frame(0.05); }
    console.log('wolfrug', done && [done.x, done.y], Sim.checkPlace(S, 'wolfrug', m.x + 3, m.y + 3).reason);
  });
  await page.waitForTimeout(1500); await shot(page, 'rug');
}
