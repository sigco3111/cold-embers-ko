// 1.1 自动机 + 熔炉号令：地图上的铁皮小人和搬运雪橇、自动机仓面板、人口面板、号令按钮和弹出说明
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/bots_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); });
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S); S.active = m.id;
    S.tech = S.tech || { done: {}, cur: null, prog: 0 };
    for (const id of ['botcal', 'bothaul', 'botmine', 'botshell', 'botbay', 'corerec', 'cmd1', 'cmd2', 'afterglow', 'wonder1']) S.tech.done[id] = true;
    S.known = Math.max(S.known, 7);
    const put = type => {
      for (let r = 2; r < 14; r++) for (let y = Math.floor(m.y) - r; y <= m.y + r; y++) for (let x = Math.floor(m.x) - r; x <= m.x + r; x++) {
        if (Math.max(Math.abs(x - m.x), Math.abs(y - m.y)) < r - 1) continue;
        const c = Sim.checkPlace(S, type, x, y); if (c.ok) { const res = Sim.place(S, type, x, y); if (res.ok) return Sim.getB(S, res.id); }
      }
      return null;
    };
    for (const k of ['plank', 'iron', 'stone', 'wood', 'steel', 'gear', 'alloy', 'part']) m.stock[k] = Math.max(m.stock[k] || 0, 3000);
    const bays = [put('bay'), put('bay'), put('bay')].filter(Boolean);
    for (const b of bays) { b.done = true; delete b.prog; }
    m.stock.core = 40;
    for (let i = 0; i < 3; i++) Sim.step(S, 1);
    if (bays[1]) Sim.setBayModel(S, bays[1].id, 'haul');
    if (bays[2]) Sim.setBayModel(S, bays[2].id, 'mine');
    for (let i = 0; i < 4; i++) Sim.step(S, 1);
    window.__bay = bays[0] && bays[0].id;
    const cr = Sim.rt(S).c[m.id];
    return { bays: bays.map(b => [b.x, b.y, b.bots, b.model]), bots: m.bots, botH: m.botH, botM: m.botM, botFr: cr.botFr, botG: cr.botG, mineU: cr.mineU };
  });
  console.log('BOTS', JSON.stringify(info));
  // 地图：营地中心拉近
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S), BLD = window.__BLD;
    const gb = S.buildings.filter(b => b.camp === m.id && BLD[b.type].gather && b.workers > 0).sort((a, b) => b.workers - a.workers)[0] || m;
    window.__gb = gb.id; console.log('focus', gb.type, gb.workers);
    g.view.focus(gb.x + 1, gb.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 15; for (let i = 0; i < 40; i++) g.view.frame(0.05);
  });
  await page.waitForTimeout(1500); await shot(page, 'map');
  await page.evaluate(() => { const g = window.game; g.view.cam.tdist = g.view.cam.dist = 9; for (let i = 0; i < 30; i++) g.view.frame(0.05); });
  await page.waitForTimeout(1200); await shot(page, 'mapnear');
  // 自动机仓面板
  await page.evaluate(() => { const g = window.game, id = window.__bay; g.view.select(id); g.ui.open('bld', id); g.ui.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'bay');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 99999; }); await page.waitForTimeout(400); await shot(page, 'bay2');
  // 人口面板
  await page.evaluate(() => { const u = window.game.ui; u.open('folk'); u.renderPanel(true); });
  await page.waitForTimeout(900); await shot(page, 'folk');
  // 号令：按钮一排，点开一个
  await page.evaluate(() => { const g = window.game; g.ui.close(); g.ui.actDo('cmdsel', 'blaze'); });
  await page.waitForTimeout(700); await shot(page, 'cmdpop');
  await page.evaluate(() => { const g = window.game; g.ui.actDo('cmdfire', 'blaze'); for (let i = 0; i < 10; i++) g.view.frame(0.05); });
  await page.waitForTimeout(500); await shot(page, 'cmdfire');
  await page.evaluate(() => { const g = window.game, Sim = window.__sim; Sim.fireCmd(g.S, 'shelter', g.S.active); g.drainFx(); for (let i = 0; i < 3; i++) Sim.step(g.S, 1); g.ui.hud && g.ui.hud(); });
  await page.waitForTimeout(2500); await shot(page, 'cmdcd');
}
