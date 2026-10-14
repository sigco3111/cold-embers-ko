// 多存档位 + 难度：菜单里的存档区、存档位弹窗、在 2 号位开一局严酷、再读回 1 号位
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const info = () => page.evaluate(() => ({ slot: window.game.slot, diff: window.game.S.meta.diff || 'std', camp: window.game.ui.camp().name, ppl: window.game.S.camps.reduce((a, c) => a + c.people, 0), keys: Object.keys(localStorage).filter(k => k.startsWith('hanjin')).sort() }));
  console.log('start', JSON.stringify(await info()));
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(600);
  await page.evaluate(() => { const el = document.querySelector('#sheet [data-act=slots]'); el.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/slot_menu_${TAG}.png`, timeout: 120000 });
  await page.click('#sheet [data-act=slots]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/slot_modal_${TAG}.png`, timeout: 120000 });
  await page.click('#modal [data-act=newrun][data-arg="2"]');
  await page.waitForTimeout(400);
  await page.click('#modal [data-act=nrdiff][data-arg=hard]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/slot_new_${TAG}.png`, timeout: 120000 });
  await Promise.all([page.waitForNavigation({ timeout: 120000 }), page.click('#modal [data-act=newrun-go]')]);
  await page.waitForFunction(() => window.game && window.game.S, null, { timeout: 120000 });
  await page.waitForTimeout(2500);
  console.log('after new', JSON.stringify(await info()));
  await page.screenshot({ path: `${OUT}/slot_after_${TAG}.png`, timeout: 120000 });
  // 难度弹窗：改成轻松
  await page.evaluate(() => { document.getElementById('modal').classList.remove('show'); window.game.ui.diffModal(); });
  await page.waitForTimeout(300);
  await page.click('#modal [data-act=diffset][data-arg=easy]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/slot_diff_${TAG}.png`, timeout: 120000 });
  console.log('diff now', await page.evaluate(() => window.game.S.meta.diff));
  // 读回 1 号位
  await page.evaluate(() => window.game.ui.slotsModal());
  await page.waitForTimeout(300);
  await Promise.all([page.waitForNavigation({ timeout: 120000 }), page.click('#modal [data-act=slotuse][data-arg="1"]')]);
  await page.waitForFunction(() => window.game && window.game.S, null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  console.log('back to 1', JSON.stringify(await info()));
  const s2 = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('hanjin-beixing-v1-s2')); return o && { diff: o.meta.diff, ppl: o.camps[0].people }; });
  console.log('slot2 saved', JSON.stringify(s2));
}
