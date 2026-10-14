// 新玩法提示卡：弹出来的样子、「去看看」打开对应面板、菜单里的开关、「怎么玩」
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true;
    S.meta.tut = true; g.ui.tutorial();
    Sim.getB(S, c.furnace).lvl = 5;
    g.hints.since = 999; g.hints.t = 5;
  });
  await page.waitForTimeout(2500);
  console.log('hint', await page.evaluate(() => { const e = document.getElementById('hint'); return e.className + ' | ' + e.innerText.replace(/\s+/g, ' '); }));
  await page.screenshot({ path: `${OUT}/hint_card_${TAG}.png`, timeout: 120000 });
  await page.click('#hint button.go');
  await page.waitForTimeout(900);
  console.log('after', await page.evaluate(() => ({ panel: window.game.ui.panel, hint: document.getElementById('hint').className, seen: window.game.S.meta.hints })));
  console.log('sheet', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 160)));
  await page.screenshot({ path: `${OUT}/hint_go_${TAG}.png`, timeout: 120000 });
  // 菜单开关
  await page.evaluate(() => { const g = window.game; g.ui.close(); g.ui.open('menu'); });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const b = document.querySelector('[data-act=hintsw]'); b.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/hint_menu_${TAG}.png`, timeout: 120000 });
  await page.click('[data-act=hintsw]');
  await page.waitForTimeout(400);
  console.log('off', await page.evaluate(() => [window.game.S.meta.hintOff, document.querySelector('[data-act=hintsw]').className]));
  await page.click('[data-act=hintsw]');
  await page.waitForTimeout(300);
  // 怎么玩
  await page.evaluate(() => { const g = window.game; g.ui.close(); document.querySelector('[data-act=help]') ? null : null; });
  await page.evaluate(() => { const g = window.game; g.ui.open('menu'); });
  await page.waitForTimeout(400);
  await page.click('.mlink[data-act=help]');
  await page.waitForTimeout(800);
  await page.evaluate(() => { const m = document.querySelector('#modal .mbody, #modal .box, #modal'); const p = [...document.querySelectorAll('#modal p')].find(p => p.textContent.includes('天气与掠夺者')); if (p) p.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/hint_help_${TAG}.png`, timeout: 120000 });
}
