// 章节：左上角目标栏、章节面板、新一章弹窗、领取奖励
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForFunction(() => document.getElementById('goal').innerHTML.length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const g0 = await page.evaluate(() => { const e = document.getElementById('goal'); return { html: e.innerHTML, ch: window.__sim.chapters(window.game.S).map(c => [c.i, c.tasks.map(t => t.ok + ':' + t.cur), c.done, c.got]) }; });
  console.log(JSON.stringify(g0));
  const box = await page.evaluate(() => { const b = document.getElementById('goal').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1000);
  console.log('panel', await page.evaluate(() => window.game.ui.panel && window.game.ui.panel.kind));
  await page.screenshot({ path: `${OUT}/chapter_panel_${TAG}.png`, timeout: 120000 });
  const claim = await page.evaluate(() => { const b = document.querySelector('[data-act="chapclaim"]'); if (!b) return null; b.click(); return b.dataset.arg; });
  console.log('claim', claim);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/chapter_claimed_${TAG}.png`, timeout: 120000 });
  // 新一章弹窗
  await page.evaluate(() => { window.game.ui.close(); window.__sim.rt(window.game.S).fx.push({ kind: 'chapter', i: 3 }); });
  await page.waitForTimeout(3500);
  console.log('modal', await page.evaluate(() => document.getElementById('modal').classList.contains('show')));
  await page.screenshot({ path: `${OUT}/chapter_modal_${TAG}.png`, timeout: 120000 });
}
