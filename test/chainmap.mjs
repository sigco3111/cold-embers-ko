// 生产链总览：物资面板里的按钮打开，一张上下游图；点节点跳到那栋建筑
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.game.ui.open('stock'));
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => { const e = document.querySelector('#sheet [data-act="chainmap"]'); if (!e) return null; e.click(); return e.innerText; });
  console.log('button', JSON.stringify(b));
  await page.waitForTimeout(1600);
  const info = await page.evaluate(() => {
    const el = document.getElementById('chainmap');
    return { show: el.classList.contains('show'), nodes: el.querySelectorAll('.cmn').length, edges: el.querySelectorAll('.cme').length, short: el.querySelectorAll('.cme.short').length, ghosts: el.querySelectorAll('.cmn.ghost').length, sum: (el.querySelector('.cmsum') || {}).innerText, sheetOpen: !!window.game.ui.panel,
      over: [...el.querySelectorAll('.cmn')].some(a => [...el.querySelectorAll('.cmn')].some(b => a !== b && (() => { const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(); return r1.left < r2.right - 1 && r2.left < r1.right - 1 && r1.top < r2.bottom - 1 && r2.top < r1.bottom - 1; })())) };
  });
  console.log('map', JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/chain_${TAG}.png`, timeout: 120000 });
  // 换到大营地
  const sw = await page.evaluate(() => { const c = document.querySelector('[data-chcamp]:not(.go)'); if (!c) return null; c.click(); return c.innerText; });
  console.log('switch', sw);
  await page.waitForTimeout(1500);
  console.log('big', await page.evaluate(() => { const el = document.getElementById('chainmap'); return { nodes: el.querySelectorAll('.cmn').length, edges: el.querySelectorAll('.cme').length, w: el.querySelector('.cmin').style.width, h: el.querySelector('.cmin').style.height }; }));
  await page.screenshot({ path: `${OUT}/chain_big_${TAG}.png`, timeout: 120000 });
  // 点一个缺料的节点（没有就点第一个）
  const nd = await page.evaluate(() => { const el = document.getElementById('chainmap'); const n = el.querySelector('.cmn.short[data-bid]') || el.querySelector('.cmn[data-bid]'); if (!n) return null; n.click(); return n.innerText.replace(/\s+/g, ' '); });
  console.log('click', JSON.stringify(nd));
  await page.waitForTimeout(1500);
  console.log('after', JSON.stringify(await page.evaluate(() => ({ open: document.getElementById('chainmap').classList.contains('show'), panel: window.game.ui.panel }))));
  await page.screenshot({ path: `${OUT}/chain_after_${TAG}.png`, timeout: 120000 });
}
