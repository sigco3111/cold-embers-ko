// 1.1 研究：五列研究树、底部详情、未开放的分支、无尽研究
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/res_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const g = window.game, S = g.S; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial(); g.ui.close(); });
  const open = async (n, fn) => { await page.evaluate(fn || (() => {})); await page.evaluate(() => { window.game.ui.open('research'); window.game.ui.renderPanel(true); }); await page.waitForTimeout(900); await shot(page, n); };
  const info = await page.evaluate(() => { const S = window.game.S; return { known: S.known, done: Object.keys((S.tech || {}).done || {}), cur: S.tech && S.tech.cur }; });
  console.log('RES', JSON.stringify(info));
  await open('top');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 420; }); await page.waitForTimeout(400); await shot(page, 'mid');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 99999; }); await page.waitForTimeout(400); await shot(page, 'bottom');
  await open('sel', () => { window.game.ui.techSel = 'alt1'; });
  await open('gate', () => { window.game.ui.techSel = 'fork3'; });
  // 全部完成：无尽研究
  await open('all', () => { const S = window.game.S, Sim = window.__sim; S.tech = S.tech || { done: {}, cur: null, prog: 0 }; for (const t of window.__TECHS || []) S.tech.done[t.id] = true; S.tech.endless = 3; window.game.ui.techSel = 'endless'; });
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 0; }); await page.waitForTimeout(400); await shot(page, 'all_top');
}
