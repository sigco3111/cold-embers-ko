// 建造队列：缺材料也能摆下（蓝图），材料到了自动开工；升级也能排队
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, c = g.ui.camp(), f = window.__sim.getB(S, c.furnace);
    g.view.focus(f.x + 1.5, f.y + 1.5, true); g.view.cam.tdist = g.view.cam.dist = 22;
    c.stock.wood = 0; c.stock.plank = 0;
    g.startPlace('tent');
    const P = g.place; g.updateGhost();
    return { soft: P.check.soft, ok: P.check.ok, okBtn: !document.getElementById('placeOk').disabled, cls: document.getElementById('placeOk').className, why: document.getElementById('placeCost').textContent };
  });
  console.log('ghost', JSON.stringify(r));
  await page.evaluate(() => { window.game.confirmPlace(); window.game.cancelModes(); window.game.ui.badges(); });
  await page.waitForTimeout(1500);
  const q = await page.evaluate(() => ({ queue: window.game.S.queue, tag: document.querySelector('.qtag')?.textContent }));
  console.log('queued', JSON.stringify(q));
  await page.screenshot({ path: `${OUT}/queue_bp_${TAG}.png`, timeout: 120000 });
  await page.evaluate(id => window.game.ui.open('queue', id), q.queue[0].id);
  await page.waitForTimeout(800);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet .pbody')?.innerText.replace(/\s+/g, ' ').slice(0, 160)));
  await page.screenshot({ path: `${OUT}/queue_panel_${TAG}.png`, timeout: 120000 });
  // 升级排队
  const up = await page.evaluate(() => { const g = window.game, S = g.S, b = S.buildings.find(b => b.camp === S.active && b.type === 'tent'); g.ui.open('bld', b.id); return { id: b.id, lvl: b.lvl, btn: document.querySelector('[data-act=qup]')?.textContent }; });
  await page.evaluate(() => document.querySelector('[data-act=qup]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(500);
  console.log('qup', JSON.stringify(up), await page.evaluate(() => document.querySelector('[data-act=qup]')?.textContent));
  // 给材料，跑几秒
  const done = await page.evaluate(id => { const g = window.game, S = g.S, c = g.ui.camp(); for (const k of ['wood', 'plank', 'stone']) c.stock[k] = 1500; const b = window.__sim.getB(S, id); const uc = window.__sim.upgradeCost(S, b); for (const k in uc) c.stock[k] = Math.max(c.stock[k] || 0, uc[k] + 300); window.__simstep(5); return { uc, queue: (S.queue || []).length, lvl: b.lvl, qup: b.qup, log: S.log.slice(-3).map(l => l.msg) }; }, up.id);
  console.log('after', JSON.stringify(done));
}
