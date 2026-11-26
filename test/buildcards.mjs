// 建造面板：手机横排卡片、缺料变红、新解锁挂「新」
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const pre = await page.evaluate(() => {
    const g = window.game, S = g.S;
    // 假装最新一层刚解锁：那层的建筑都还没看过
    g.ui.seenB(); for (const k in S.meta.seenB) if (window.__BLD[k].t === S.known) delete S.meta.seenB[k];
    g.ui.hud();
    return { known: S.known, dot: document.getElementById('tbBuild').classList.contains('dot'), nw: g.ui.newBld().join(',') };
  });
  console.log('pre', JSON.stringify(pre));
  const b = await page.evaluate(() => { const r = document.getElementById('tbBuild').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.screenshot({ path: `${OUT}/bc_tb_${TAG}.png`, timeout: 120000 });
  if (TAG === 'phone') await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1500);
  console.log('open', JSON.stringify(await page.evaluate(() => ({ tier: window.game.ui.buildTier, cards: document.querySelectorAll('.card').length, nw: document.querySelectorAll('.cnew').length, short: document.querySelectorAll('.card.short').length, sheetH: document.getElementById('sheet').offsetHeight }))));
  await page.screenshot({ path: `${OUT}/bc_open_${TAG}.png`, timeout: 120000 });
  // 切到第 2 层：刚才那层的「新」应当消失
  await page.evaluate(() => { document.querySelector('.tab[data-arg="2"]').dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await page.waitForTimeout(800);
  if (TAG === 'phone') await page.evaluate(() => { document.querySelector('.cards').scrollLeft = 200; });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.game.ui.renderPanel(true));
  console.log('after', JSON.stringify(await page.evaluate(() => ({ tier: window.game.ui.buildTier, nwLeft: window.game.ui.newBld().length, dot: (window.game.ui.hud(), document.getElementById('tbBuild').classList.contains('dot')), sl: document.querySelector('.cards').scrollLeft }))));
  await page.screenshot({ path: `${OUT}/bc_t2_${TAG}.png`, timeout: 120000 });
}
