// 侧面板改版：营地面板页签、建筑面板底部固定的升级栏、面板打开时画面中心避开面板
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    const b = S.buildings.filter(x => x.camp === c.id && x.type === 'sawmill')[0] || S.buildings.find(x => x.camp === c.id && x.type !== 'furnace');
    // 先把镜头移到建筑右边一点，让它会被 PC 的右侧面板挡住
    g.view.focus(b.x - 6, b.y, true);
    window.__b = b.id;
    return { b: b.type };
  });
  await page.waitForTimeout(800);
  const before = await page.evaluate(() => { const g = window.game, b = window.__sim.getB(g.S, window.__b); return g.view.project(b.x + 1, b.y + 1, 0.6); });
  await page.evaluate(() => { const g = window.game; g.view.select(window.__b); g.ui.open('bld', window.__b); });
  for (let i = 0; i < 6; i++) await page.waitForTimeout(500);
  const after = await page.evaluate(() => { const g = window.game, b = window.__sim.getB(g.S, window.__b); const p = g.view.project(b.x + 1, b.y + 1, 0.6); return { p, inset: g.view.inset, sheetW: document.getElementById('sheet').offsetWidth, foot: !!document.querySelector('#sheet .pfoot') }; });
  console.log('bld', JSON.stringify({ before, after }));
  await page.screenshot({ path: `${OUT}/p2_bld_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { document.getElementById('sheet').scrollTop = 99999; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/p2_bld_scrolled_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.open('camp'));
  await page.waitForTimeout(800);
  console.log('tabs', await page.evaluate(() => [...document.querySelectorAll('.ptabs button')].map(b => b.className + ':' + b.textContent).join(',')));
  await page.screenshot({ path: `${OUT}/p2_camp_${TAG}.png`, timeout: 120000 });
  // 1.1：基建卡直接在营地概况里，滚到那里看
  console.log('infra', await page.evaluate(() => { const e = document.querySelector('#sheet .ifc'); if (e) e.scrollIntoView({ block: 'center' }); return document.querySelector('.ptabs button.on').textContent + ' ' + document.querySelectorAll('#sheet .ifc').length; }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/p2_infra_${TAG}.png`, timeout: 120000 });
}
