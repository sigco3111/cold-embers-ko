// 商队订单：到达、模型、面板、交货、临走自动交货、离开
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const a = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim;
    S.car = null; const n = Sim.nextCaravan(S); S.t += n.in + 5; window.__simstep(3); g.ui.hud();
    const C = S.car; if (!C) return { fail: true, n };
    g.view.focus(C.x + 1.5, C.y + 1.5, true); g.view.cam.tdist = g.view.cam.dist = 14;
    const ck = Sim.checkPlace(S, 'tent', C.x, C.y);
    return { car: { camp: C.camp, x: C.x, y: C.y, left: Math.round(C.until - S.t) }, orders: C.orders, pill: document.querySelector('#stats .pill.car')?.textContent, log: S.log.slice(-1)[0].msg, ck: ck.reason };
  });
  console.log('arrive', JSON.stringify(a));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/car_world_${TAG}.png`, timeout: 120000 });
  console.log('tag', await page.evaluate(() => document.querySelector('.cartag')?.textContent));
  await page.evaluate(() => document.querySelector('.cartag')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(900);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet .pbody')?.innerText.replace(/\s+/g, ' ').slice(0, 500)));
  await page.screenshot({ path: `${OUT}/car_panel_${TAG}.png`, timeout: 120000 });
  // 手动交第一张
  const b = await page.evaluate(() => { const S = window.game.S, C = S.car, c = window.__sim.getCamp(S, C.camp), o = C.orders[0]; c.stock[o.ask] = Math.max(c.stock[o.ask] || 0, o.n + 5); const before = c.stock[o.give] || 0; window.game.ui.renderPanel(true); document.querySelector('#sheet [data-act=deliver][data-arg="0"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); return { done: o.done, gave: Math.round((c.stock[o.give] || 0) - before), log: S.log.slice(-1)[0].msg }; });
  console.log('deliver', JSON.stringify(b));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/car_panel2_${TAG}.png`, timeout: 120000 });
  // 临走前自动交货（第二张：余烬）
  const d = await page.evaluate(() => { const S = window.game.S, C = S.car, c = window.__sim.getCamp(S, C.camp), o = C.orders[1]; c.stock[o.ask] = Math.max(c.stock[o.ask] || 0, o.n * 2 + 5); const e0 = S.meta.embers; S.t = C.until - 300; window.__simstep(3); return { done: o.done, embers: S.meta.embers - e0, log: S.log.slice(-1)[0].msg }; });
  console.log('auto', JSON.stringify(d));
  const e = await page.evaluate(() => { const S = window.game.S; S.t = S.car.until + 1; window.__simstep(3); return { car: S.car, log: S.log.slice(-1)[0].msg, next: window.__sim.nextCaravan(S) }; });
  console.log('leave', JSON.stringify(e));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/car_gone_${TAG}.png`, timeout: 120000 });
}
