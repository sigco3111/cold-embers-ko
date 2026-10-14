// 面板里有每秒在变的倒计时：按住按钮的这一下，面板不能刷新把按钮换掉（不然这一下就点空了）
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const g = window.game; window.__noEvents = true; g.ui.closeModal && g.ui.closeModal(); g.ui.open('bld', g.ui.camp().furnace); });
  await page.waitForTimeout(800);
  const sel = '[data-act="odauto"]';
  await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), sel);
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.game.ui.camp().odAuto);
  await page.evaluate(sel => { window.__btn = document.querySelector(sel); }, sel);
  const box = await page.locator(sel).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 按住时面板内容变了（库存在涨），照常每 0.3 秒刷新一次
  const still = await page.evaluate(async () => { const ui = window.game.ui, c = ui.camp(); for (let i = 0; i < 4; i++) { c.stock.wood = (c.stock.wood || 0) + 37; ui.renderPanel(); await new Promise(r => setTimeout(r, 250)); } return window.__btn.isConnected; });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.game.ui.camp().odAuto);
  console.log(JSON.stringify({ still, before, after }));
  console.log(still && before !== after ? 'PRESS OK' : 'FAIL press lost');
  // 松手以后照常刷新
  const fresh = await page.evaluate(() => { const ui = window.game.ui, c = ui.camp(); c.stock.wood += 37; ui.renderPanel(); return !window.__btn.isConnected; });
  console.log(fresh ? 'REFRESH OK' : 'FAIL no refresh after release');
  // 手机上拖着滚动：只有 pointercancel，没有 pointerup
  const cancel = await page.evaluate(async () => { const ui = window.game.ui, sh = document.getElementById('sheet'); sh.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); const down = ui.sheetDown; window.dispatchEvent(new PointerEvent('pointercancel')); await new Promise(r => setTimeout(r, 80)); return { down, after: ui.sheetDown }; });
  console.log(cancel.down && !cancel.after ? 'CANCEL OK' : 'FAIL stuck after pointercancel ' + JSON.stringify(cancel));
}
