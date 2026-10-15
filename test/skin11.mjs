// 1.1 霜铁暖灯换皮：几个代表性的面板、弹窗和提示条
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const tap = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('no ' + s); e.click(); }, sel);
const shot = (page, n) => page.screenshot({ path: `${OUT}/skin_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.evaluate(() => { window.__noEvents = true; const S = window.game.S; S.meta.tut = true; S.meta.hintOff = true; window.game.ui.tutorial(); });
  await page.waitForTimeout(800);
  const open = async (kind, arg, n) => { await page.evaluate(([k, a]) => window.game.ui.open(k, a), [kind, arg]); await page.waitForTimeout(700); await shot(page, n); };
  await open('stock', null, 'stock');
  await open('plines', null, 'plines');
  await open('build', null, 'build');
  await open('research', null, 'research');
  await open('camp', null, 'camp');
  await open('menu', null, 'menu');
  await page.evaluate(() => { const g = window.game, S = g.S; const f = S.buildings.find(b => b.type === 'furnace'); g.ui.open('bld', f.id); });
  await page.waitForTimeout(700); await shot(page, 'furnace');
  await page.evaluate(() => { const g = window.game; g.ui.close(); g.ui.toast('🪵木材快满了（上限 400），满了相关建筑会停工。', 'warn', { act: 'tb', arg: 'stock', label: '去处理' }); g.ui.toast('🎁 第一章完成！', 'good'); });
  await page.waitForTimeout(600); await shot(page, 'toast');
  await page.evaluate(() => window.game.ui.diffModal && window.game.ui.diffModal());
  await page.waitForTimeout(600); await shot(page, 'modal');
}
