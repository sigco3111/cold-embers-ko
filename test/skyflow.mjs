// 终章的整套流程（真点按钮、真放完）：天火塔信息卡里点「点火」→ 镜头放完 → 「这一路」→「继续往北」回到主营地；SKIP=1 中途点「跳过」
export default async function (page) {
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = Sim.mainCamp(S);
    for (const k of ['steel', 'alloy', 'part', 'core', 'battery', 'starcore', 'heart']) c.stock[k] = Math.max(c.stock[k] || 0, 5000);
    let best = null; for (let y = Math.floor(c.y - 9); y <= c.y + 9; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9; x++) if (!best && Sim.checkPlace(S, 'skyfire', x, y).ok) best = { x, y };
    const q = Sim.place(S, 'skyfire', best.x, best.y), b = Sim.getB(S, q.id); b.tw.p = Sim.towerSpec(S, 10).dur;
    g.view.syncBuildings(true); g.ui.open('bld', b.id); g.ui.renderPanel(true);
    window.__cam0 = { x: c.x, y: c.y };
    return { b: b.id, btn: !!document.querySelector('[data-act="ignite"]') };
  });
  console.log('flow', JSON.stringify(r));
  await page.click('[data-act="ignite"]');
  await page.waitForFunction(() => !!window.game.cine, null, { timeout: 60000 });
  const t0 = Date.now();
  if (process.env.SKIP) { await page.waitForTimeout(4000); await page.click('#cinebar [data-skip]'); }
  await page.waitForFunction(() => document.getElementById('modal').classList.contains('show') && !!document.querySelector('.skysum'), null, { timeout: 400000 });
  console.log('cine took', ((Date.now() - t0) / 1000).toFixed(0), 's real; S.t frozen?', await page.evaluate(() => window.game.S.t));
  const mid = await page.evaluate(() => ({ seen: window.game.S.tower.end.seen || 0, cineCls: document.body.classList.contains('cine'), far: window.game.view.camera.far }));
  console.log('at modal', JSON.stringify(mid));
  await page.click('[data-act="skyend"]');
  await page.waitForTimeout(1500);
  const end = await page.evaluate(() => { const g = window.game, v = g.view, c = v.cam; return { seen: g.S.tower.end.seen, modal: document.getElementById('modal').classList.contains('show'), cam: [Math.round(c.tx), Math.round(c.ty), Math.round(c.tdist)], camp: window.__cam0, pitch: v.photoPitch, far: v.camera.far, menu: null }; });
  console.log('after', JSON.stringify(end));
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(800);
  console.log('menu replay button', await page.evaluate(() => !!document.querySelector('[data-act="skyreplay"]')));
}
