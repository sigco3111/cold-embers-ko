// 营地专精：营地面板的四张卡、确认弹窗、熔炉上的旗、营地牌子上的小旗
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__noEvents = true; const g = window.game; g.ui.open('camp'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const el = document.querySelector('#sheet .focus'); if (el) el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/focus_panel_${TAG}.png`, timeout: 120000 });
  await page.click('#sheet [data-act=focus][data-arg$=":mine"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/focus_modal_${TAG}.png`, timeout: 120000 });
  await page.click('#modal [data-act=focus-yes]');
  await page.waitForTimeout(500);
  console.log('focus', await page.evaluate(() => { const c = window.game.ui.camp(); return c.focus + ' ' + document.querySelector('#sheet .focus').innerText.replace(/\s+/g, ' ').slice(0, 120); }));
  await page.evaluate(() => { const g = window.game; g.ui.close(); const S = g.S; for (const c of S.camps) if (!c.focus) c.focus = 'fort'; const c = g.ui.camp(), b = window.__sim.getB(S, c.furnace); g.view.focus(b.x + 1.5, b.y + 1.5, true); g.view.cam.tdist = g.view.cam.dist = 11; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/focus_flag_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.view.cam.tyaw += 2.2; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/focus_flag2_${TAG}.png`, timeout: 120000 });
}
