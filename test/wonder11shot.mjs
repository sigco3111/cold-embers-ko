// 1.1 奇观 + 城镇：建造›奇观页、选址预览、地图上三期工地和落成、奇观面板、营地里的城镇卡片、升镇/升城、夜里的路灯和行人
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/won_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); });
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); S.active = m.id; S.qy = null;
    S.tech.done.wonder1 = true; S.tech.done.townplan = true; S.wbp = { waurora: 1 };
    for (const k in m.stock) m.stock[k] = Math.max(m.stock[k], 3000);
    for (const k of ['steel', 'gear', 'stone', 'engine', 'alloy', 'seal', 'part', 'core', 'heart']) m.stock[k] = 4000;
    return { camp: m.name, x: m.x, y: m.y };
  });
  console.log('WON', JSON.stringify(info));
  // 建造 › 奇观
  await page.evaluate(() => { const u = window.game.ui; u.open('wonder'); u.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'list');
  await page.evaluate(() => { const s = window.game.ui.sheet; s.scrollTop = 99999; });
  await page.waitForTimeout(400); await shot(page, 'list2');
  // 选址预览
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); let sp = null;
    for (let r = 3; r < 16 && !sp; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r && !sp; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r && !sp; x++) { const ck = Sim.checkPlace(S, 'wcolossus', x, y); if (ck.ok && ck.camp === m.id) sp = [x, y]; }
    g.ui.actDo('place', 'wcolossus'); g.place.x = sp[0]; g.place.y = sp[1]; g.updateGhost();
    const v = g.view; v.focus(sp[0] + 2, sp[1] + 2, true); v.cam.tdist = v.cam.dist = 20; for (let i = 0; i < 30; i++) v.frame(0.05);
  });
  await page.waitForTimeout(1200); await shot(page, 'ghost');
  // 真放下：找一块 4×4 的地
  const placed = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); g.cancelModes();
    let id = null;
    for (let r = 3; r < 16 && id == null; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r && id == null; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r && id == null; x++) {
      const ck = Sim.checkPlace(S, 'wcolossus', x, y); if (ck.ok && ck.camp === m.id) { const res = Sim.place(S, 'wcolossus', x, y); if (res.ok) id = res.id; }
    }
    const b = Sim.getB(S, id); if (b) { b.done = true; delete b.prog; }
    for (let i = 0; i < 20; i++) Sim.step(S, 1);
    g.view.focus(b.x + 2, b.y + 2, true); g.view.cam.tdist = g.view.cam.dist = 20; for (let i = 0; i < 40; i++) g.view.frame(0.05);
    window.__wid = id;
    return b && { id, x: b.x, y: b.y, wd: b.wd, st: Sim.bldStatus ? Sim.bldStatus(S, b) : null };
  });
  console.log('PLACED', JSON.stringify(placed));
  await page.waitForTimeout(1500); await shot(page, 'site0');
  await page.evaluate(() => { const g = window.game; g.ui.actDo('openbld', window.__wid); g.ui.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'panel0');
  for (const ph of [1, 2]) {
    await page.evaluate(ph => { const g = window.game, S = g.S, Sim = window.__sim, b = Sim.getB(S, window.__wid); g.ui.close(); b.wd.ph = ph; b.wd.p = 200; Sim.step(S, 1); for (let i = 0; i < 30; i++) g.view.frame(0.05); }, ph);
    await page.waitForTimeout(1500); await shot(page, 'site' + ph);
  }
  await page.evaluate(() => { const g = window.game; g.ui.actDo('openbld', window.__wid); g.ui.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'panel2');
  await page.evaluate(() => { const s = window.game.ui.sheet; s.scrollTop = 99999; });
  await page.waitForTimeout(400); await shot(page, 'panel2b');
  // 封顶最后一点：真的走完，看落成的烟花和相册
  const done = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, b = Sim.getB(S, window.__wid), m = Sim.mainCamp(S); g.ui.close();
    const sp = Sim.wonderSpec(b.type, 2); b.wd.p = sp.dur - 3;
    for (const k of sp.kinds) m.stock[k] = 4000;
    for (let i = 0; i < 8 && !Sim.wonderDone(b); i++) Sim.step(S, 1);
    return { done: Sim.wonderDone(b), list: Sim.wonderList(S).map(w => w.w), fx: (S.fx || []).map(f => f.k).slice(-5) };
  });
  console.log('DONE', JSON.stringify(done));
  await page.waitForTimeout(1600); await shot(page, 'done');
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, b = Sim.getB(S, window.__wid); g.ui.closeModal && g.ui.closeModal(); g.view.focus(b.x + 2, b.y + 2, true); g.view.cam.tdist = g.view.cam.dist = 15; for (let i = 0; i < 40; i++) g.view.frame(0.05); });
  await page.waitForTimeout(3000); await shot(page, 'done2');
  await page.evaluate(() => { const g = window.game; g.ui.actDo('openbld', window.__wid); g.ui.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'panel3');
  await page.evaluate(() => { const u = window.game.ui; u.close(); u.open('wonder'); u.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'list3');
  // 城镇：人够了，铃铛里的提醒，营地卡片
  const town = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); g.ui.close();
    m.people = Math.max(m.people, 130); m.hope = 70;
    return { t: Sim.townOf(m), nx: Sim.townNext(m), why: Sim.townBlock(S, m) };
  });
  console.log('TOWN', JSON.stringify(town));
  await page.evaluate(() => { const u = window.game.ui; u.hud && u.hud(); u.actDo('bell'); });
  await page.waitForTimeout(800); await shot(page, 'bell');
  await page.evaluate(() => { const u = window.game.ui; u.closeModal && u.closeModal(); u.close(); u.actDo('towngo', window.__sim.mainCamp(window.game.S).id); u.renderPanel(true); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = window.game.ui.sheet, el = [...s.querySelectorAll('.sec')].find(e => /城镇/.test(e.textContent)); if (el) s.scrollTop = el.offsetTop - 40; });
  await page.waitForTimeout(400); await shot(page, 'card');
  await page.evaluate(() => { const g = window.game, m = window.__sim.mainCamp(g.S); g.ui.actDo('townup', m.id); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const s = window.game.ui.sheet, el = [...s.querySelectorAll('.sec')].find(e => /城镇/.test(e.textContent)); if (el) s.scrollTop = el.offsetTop - 40; });
  await page.waitForTimeout(400); await shot(page, 'card1');
  await page.evaluate(() => { const g = window.game, m = window.__sim.mainCamp(g.S); g.ui.close(); const T = g.S.buildings.filter(b => b.camp === m.id && b.type === 'tent'); const cx = T.reduce((a, b) => a + b.x, 0) / T.length, cy = T.reduce((a, b) => a + b.y, 0) / T.length; window.__tc = [cx, cy]; g.view.focus(cx + 1, cy + 1, true); g.view.cam.tdist = g.view.cam.dist = 14; for (let i = 0; i < 40; i++) g.view.frame(0.05); });
  await page.waitForTimeout(2500); await shot(page, 'town1');
  await page.evaluate(() => { const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); for (let i = 0; i < 32; i++) Sim.step(S, 1); const r = Sim.townUp(S, m.id); g.drainFx && g.drainFx(); console.log('city', JSON.stringify(r)); });
  await page.waitForTimeout(2500); await shot(page, 'town2');
  await page.evaluate(() => { const v = window.game.view, T = window.game.S.buildings.find(b => b.type === 'tent' && b.camp === window.__sim.mainCamp(window.game.S).id); v.focus(T.x + 1, T.y + 1, true); v.cam.tdist = v.cam.dist = 8; for (let i = 0; i < 40; i++) v.frame(0.05); });
  await page.waitForTimeout(2000); await shot(page, 'town2c');
  // 夜里：路灯和提灯的行人
  await page.evaluate(() => { const g = window.game, S = g.S, DL = 720; S.t = Math.floor(S.t / DL) * DL + 0.82 * DL; const v = g.view; v.focus(window.__tc[0] + 1, window.__tc[1] + 1, true); v.cam.tdist = v.cam.dist = 11; });
  await page.waitForTimeout(3000); await shot(page, 'night');
  console.log('ERRS', await page.evaluate(() => JSON.stringify((window.__errs || []).slice(0, 5))));
}
