// 提示：同一句合并 ×N、最多 3 条（手机 2 条）、带按钮的警告；1.1 铃铛里的提醒和消息记录
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const g = window.game, Sim = window.__sim, S = g.S;
    g.ui.hud();
    Sim.logMsg(S, '探险队抵达「冻住的列车」，等你决定怎么做。', 'info');
    Sim.logMsg(S, '🐺 狼群袭击了「星铁残骸」，被瞭望塔打退了。', 'good');
    Sim.logMsg(S, '暴风雪来了！气温骤降，室外的人会冻伤。', 'bad');
    g.drainFx();
    g.ui.toast('🪵木材快满了（上限 2050），满了相关建筑会停工。可以升级仓库，或开启「满仓自动兑换」。', 'warn', { act: 'tb', arg: 'stock', label: '去处理' });
    g.ui.toast('不能建在这里：太靠近别的建筑', 'warn');
    g.ui.toast('不能建在这里：太靠近别的建筑', 'warn');
    g.ui.toast('不能建在这里：太靠近别的建筑', 'warn');
  });
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast:not(.out)')].map(t => t.className + ' | ' + t.textContent), badge: document.getElementById('bellBtn').className + ' ' + (document.querySelector('#bellBtn b')?.textContent || '') }));
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/toasts_${TAG}.png`, timeout: 120000 });
  const b = await page.evaluate(() => { const r = document.getElementById('bellBtn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (TAG === 'phone') await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1200);
  console.log('panel', await page.evaluate(() => window.game.ui.panel && window.game.ui.panel.kind), await page.evaluate(() => document.querySelectorAll('.lrow').length));
  await page.screenshot({ path: `${OUT}/log_${TAG}.png`, timeout: 120000 });
}
