// 1.0.0 存档自动备份：定时备份、菜单里的备份列表、恢复（恢复前先备份现在的进度）、重开前备份、存档坏了时从备份恢复
// SAVEFILE=/tmp/save_full.json
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
let bad = 0;
const check = (n, ok, extra = '') => { console.log('CHECK', n, ok ? 'ok' : 'FAIL', extra); if (!ok) bad++; };
export default async function (page) {
  const W = ms => page.waitForTimeout(ms);
  const name = () => page.evaluate(() => { const S = window.game.S; return (S.camps.find(c => c.id === S.active) || S.camps[0]).name; });
  const list = () => page.evaluate(async () => (await window.game.bk.list(window.game.slot)).map(r => r.why + ':' + (r.info && r.info.name)));
  const name0 = await name();
  check('no backups yet', (await list()).length === 0);
  // 定时备份：把计时拨到 10 分钟，主循环自己会存一份
  await page.evaluate(() => { window.game.bkT = 599.5; });
  await page.waitForFunction(() => window.game.bkT < 100, null, { timeout: 60000 }).catch(() => {}); // 无头浏览器帧很慢，等主循环走到
  await W(1500);
  let L = await list();
  check('auto backup after 10 min', L.length === 1 && L[0].startsWith('auto:'), L.join(' '));
  check('timer reset', await page.evaluate(() => window.game.bkT < 5));
  // 改个营地名，再存一份北迁出发前的（模拟）
  await page.evaluate(() => { const S = window.game.S; (S.camps.find(c => c.id === S.active) || S.camps[0]).name = '改过的名字'; });
  await page.evaluate(() => window.game.backup('depart'));
  L = await list();
  check('depart backup', L.length === 2 && L[0] === 'depart:改过的名字', L.join(' '));
  // 菜单里的一行
  await page.evaluate(() => document.getElementById('menuBtn').click());
  await W(1200);
  const row = await page.evaluate(() => { const b = document.querySelector('[data-act="backups"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); return b.closest('.row').innerText.replace(/\s+/g, ' '); });
  check('menu row', row && /自动备份 2 份/.test(row), row);
  await W(300);
  await page.screenshot({ path: `${OUT}/bk_menu_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector('[data-act="backups"]').click());
  await W(800);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#modal .bkrow')].map(r => r.innerText.replace(/\s+/g, ' ')));
  console.log('rows', rows);
  check('modal rows', rows.length === 2 && /北迁出发前/.test(rows[0]) && /定时备份/.test(rows[1]) && rows[1].includes(name0));
  await page.screenshot({ path: `${OUT}/bk_list_${TAG}.png`, timeout: 120000 });
  // 恢复定时备份那份（名字是原来的）
  await page.evaluate(() => document.querySelectorAll('#modal .bkrow button')[1].click());
  await W(600);
  const conf = await page.evaluate(() => document.querySelector('#modal .mbox').innerText.replace(/\s+/g, ' '));
  check('confirm', /退回到这份备份/.test(conf), conf.slice(0, 160));
  await page.screenshot({ path: `${OUT}/bk_confirm_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => sessionStorage.setItem('shot-nosave', '1')); // 刷新后别再把测试存档写回去
  await Promise.all([page.waitForEvent('load', { timeout: 120000 }), page.evaluate(() => document.querySelector('#modal [data-act="bkload-yes"]').click())]);
  await W(4000);
  check('restored state', (await name()) === name0, await name());
  const modalUp = await page.evaluate(() => document.getElementById('modal').classList.contains('show') ? document.getElementById('modal').innerText.slice(0, 80) : '');
  check('no offline report after restore', !/离开了/.test(modalUp), modalUp);
  L = await list();
  check('restore made a backup of the old state', L.length === 3 && L[0] === 'restore:改过的名字', L.join(' '));
  // 存档坏了：写一段坏的存档进去，刷新
  await page.evaluate(() => { window.game.noSave = true; localStorage.setItem('hanjin-beixing-v1', '{"v":'); });
  await page.reload({ timeout: 120000 });
  await W(4000);
  const bm = await page.evaluate(() => document.getElementById('modal').classList.contains('show') ? document.getElementById('modal').innerText.replace(/\s+/g, ' ') : '');
  check('broken save offers backups', /存档读不出来了/.test(bm), bm.slice(0, 200));
  await page.screenshot({ path: `${OUT}/bk_broken_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => document.querySelector('#modal [data-act="backups"]').click());
  await W(800);
  await Promise.all([page.waitForEvent('load', { timeout: 120000 }), page.evaluate(async () => { document.querySelectorAll('#modal .bkrow button')[0].click(); await new Promise(r => setTimeout(r, 400)); document.querySelector('#modal [data-act="bkload-yes"]').click(); })]);
  await W(4000);
  check('back from broken', (await name()) === '改过的名字', await name());
  L = await list();
  check('broken restore adds no backup of the throwaway run', L.length === 3, L.join(' '));
  // 重开前备份
  await Promise.all([page.waitForEvent('load', { timeout: 120000 }), page.evaluate(() => window.game.wipe())]);
  await W(4000);
  L = await list();
  check('wipe backup', L[0] === 'wipe:改过的名字', L.join(' '));
  check('fresh run', (await page.evaluate(() => window.game.S.buildings.length)) < 5);
  console.log('RESULT', bad ? `${bad} FAIL` : 'all ok');
}
