const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.click('text=点起篝火');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/tut_1.png`, timeout: 120000 });
  await page.click('#toolbar button[data-arg=build]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/tut_2.png`, timeout: 120000 });
  await page.click('.card[data-arg=lumber]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/tut_3.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; Object.assign(g.ui.camp().stock, { wood: 3000, stone: 2000, plank: 500 }); g.confirmPlace(); g.cancelModes(); });
  await page.waitForTimeout(800);
  const steps = [];
  steps.push(await page.evaluate(() => document.querySelector('#coach .cstep')?.textContent));
  await page.evaluate(() => { const g = window.game, S = g.S, c = g.ui.camp(); for (const t of ['tent', 'hunter', 'kitchen']) { g.startPlace(t); g.confirmPlace(); g.cancelModes(); } });
  await page.waitForTimeout(600);
  steps.push(await page.evaluate(() => document.querySelector('#coach .cstep')?.textContent + ' ' + window.game.S.buildings.map(b => b.type).join(',')));
  await page.screenshot({ path: `${OUT}/tut_4.png`, timeout: 120000 });
  if (await page.evaluate(() => !!document.getElementById('reschips').offsetHeight)) { await page.click('#reschips'); await page.waitForTimeout(500); await page.click('#resdrawer .rdo', { timeout: 20000 }).catch(() => page.evaluate(() => window.game.ui.open('stock'))); }
  else await page.evaluate(() => window.game.ui.open('stock')); // 手机：物资栏收在 ▾ 里
  await page.waitForTimeout(500); await page.click('#sheet button.x');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/tut_5.png`, timeout: 120000 });
  steps.push(await page.evaluate(() => document.querySelector('#coach .cstep')?.textContent));
  await page.evaluate(() => { const g = window.game, c = g.ui.camp(); g.view.select(c.furnace); g.ui.open('bld', c.furnace); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.game.ui.close()); await page.waitForTimeout(1200);
  // 第 7 步：看目标（光圈指着左上角的目标栏）
  steps.push(await page.evaluate(() => { const r = document.getElementById('coachRing').getBoundingClientRect(), gl = document.getElementById('goal').getBoundingClientRect(); return document.querySelector('#coach .cstep')?.textContent + ' ring-on-goal:' + (Math.abs(r.left + 5 - gl.left) < 12 && Math.abs(r.top + 5 - gl.top) < 12); }));
  await page.screenshot({ path: `${OUT}/tut_6.png`, timeout: 120000 });
  await page.click('#goal'); await page.waitForTimeout(1500);
  steps.push(await page.evaluate(() => [window.game.S.meta.tut, getComputedStyle(document.querySelector('#coach')).display]));
  await page.screenshot({ path: `${OUT}/tut_7.png`, timeout: 120000 });
  await page.evaluate(() => { window.game.S.meta.tut = false; window.game.ui.tutSeen = {}; });
  await page.waitForTimeout(800);
  await page.click('[data-act=tutskip]'); await page.waitForTimeout(300);
  steps.push(await page.evaluate(() => [window.game.S.meta.tut, getComputedStyle(document.querySelector('#coach')).display]));
  console.log(JSON.stringify(steps));
}
