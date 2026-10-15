// 1.1 界面骨架：顶栏四格 + 目标 + 提醒铃、便签、底部五个分区和它们的页签、菜单四页、北行四页
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
// 忙的存档里面板每 0.3 秒重画，Playwright 的 click 会碰上「元素被换掉」；直接在页面里点
const tap = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('no ' + s); e.click(); }, sel);
const shot = (page, n) => page.screenshot({ path: `${OUT}/hub_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.evaluate(() => { window.__noEvents = true; const S = window.game.S; S.meta.tut = true; S.meta.hintOff = true; window.game.ui.tutorial(); });
  await page.waitForTimeout(1600);
  await shot(page, 'main');
  const tabsOf = () => page.evaluate(() => [...document.querySelectorAll('#sheet .ptabs button')].map(b => b.dataset.arg));
  for (const h of ['camp', 'prod', 'build', 'research', 'north']) {
    await tap(page, `#toolbar button[data-arg=${h}]`); await page.waitForTimeout(500);
    const tabs = await tabsOf();
    console.log('hub', h, 'tabs', tabs.join(','), 'title', await page.evaluate(() => document.querySelector('#sheet .phead b').innerText.replace(/\s+/g, ' ')));
    for (const t of tabs.length ? tabs : [null]) {
      if (t) { await tap(page, `#sheet .ptabs button[data-arg=${t}]`); await page.waitForTimeout(350); }
      const len = await page.evaluate(() => document.querySelector('#sheet .pbody').innerText.length);
      console.log('  tab', t, 'body chars', len);
      await shot(page, `${h}_${t || 'one'}`);
    }
    await tap(page, `#toolbar button[data-arg=${h}]`).catch(async () => { await tap(page, '#sheet .x'); });
    await page.waitForTimeout(300);
    if (await page.evaluate(() => !!window.game.ui.panel)) { await tap(page, '#sheet .x'); await page.waitForTimeout(300); }
  }
  // 菜单四页
  await tap(page, '#menuBtn'); await page.waitForTimeout(500);
  for (const t of await tabsOf()) { await tap(page, `#sheet .ptabs button[data-arg=${t}]`); await page.waitForTimeout(350); await shot(page, `menu_${t}`); }
  await tap(page, '#sheet .x'); await page.waitForTimeout(300);
  // 提醒铃：暴风雪 + 掠夺者 + 心情差
  console.log('alerts', await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    const z = Sim.blizzardSlot(S, 0); S.t = z.start - 200;
    c.hope = 20; c.disc = 60;
    Sim.step(S, 1); g.ui.noteT = 0; g.ui.hud();
    return g.ui.alertsNow.map(a => a.lvl + ':' + a.t).join(' | ');
  }));
  await page.waitForTimeout(1500);
  await shot(page, 'alerts_main');
  await tap(page, '#bellBtn'); await page.waitForTimeout(500);
  await shot(page, 'bell');
  await tap(page, '#sheet .ptabs button[data-arg=log]'); await page.waitForTimeout(400);
  await shot(page, 'bell_log');
  await tap(page, '#sheet .x'); await page.waitForTimeout(300);
  // 便签：稍后 → 收成小角；点小角 → 再贴出来
  console.log('note', await page.evaluate(() => document.getElementById('note').innerText.replace(/\s+/g, ' ')));
  const nb = await page.$('#note.show [data-n=later]');
  if (nb) { await nb.dispatchEvent('pointerdown'); await page.waitForTimeout(400); console.log('mini', await page.evaluate(() => document.getElementById('noteMini').classList.contains('show'))); await shot(page, 'note_later'); await page.click('#noteMini'); await page.waitForTimeout(400); console.log('back', await page.evaluate(() => document.getElementById('note').classList.contains('show'))); }
  // 速度键：点一下换倍速；按住暂停
  await page.click('#speedBtn'); await page.waitForTimeout(200);
  console.log('speed', await page.evaluate(() => window.game.speed));
  const sb = await page.$('#speedBtn'), bx = await sb.boundingBox();
  await page.mouse.move(bx.x + 20, bx.y + 20); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up(); await page.waitForTimeout(200);
  console.log('paused', await page.evaluate(() => window.game.paused), 'speed', await page.evaluate(() => window.game.speed));
  await shot(page, 'paused');
  await page.click('#speedBtn'); await page.waitForTimeout(200);
  console.log('resumed', await page.evaluate(() => !window.game.paused));
  // 返回：从营地 › 人手点进一栋建筑，再点 ‹
  await tap(page, '#toolbar button[data-arg=camp]'); await page.waitForTimeout(400);
  await tap(page, '#sheet .ptabs button[data-arg=folk]'); await page.waitForTimeout(400);
  const bw = await page.$('#sheet [data-act=bulkw]');
  console.log('folk rows', await page.evaluate(() => document.querySelectorAll('#sheet .wrow').length));
  await tap(page, '#sheet .ptabs button[data-arg=law]'); await page.waitForTimeout(300);
  await tap(page, '#sheet .x'); await page.waitForTimeout(300);
  // 顶栏四格点开
  for (const k of ['tmp', 'ppl', 'food']) { await page.click(`#vitals .vt.${k}`); await page.waitForTimeout(400); console.log('vt', k, '->', await page.evaluate(() => window.game.ui.panel && window.game.ui.panel.kind)); await tap(page, '#sheet .x').catch(() => {}); await page.waitForTimeout(300); }
}
