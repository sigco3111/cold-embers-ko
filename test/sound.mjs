const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.click('text=点起篝火');
  await page.waitForTimeout(1500);
  const r1 = await page.evaluate(() => { const a = window.game.audio; return { st: a.ctx && a.ctx.state, info: window.game.sndInfo }; });
  console.log('after start', JSON.stringify(r1));
  for (const n of ['build', 'up', 'horn', 'win', 'lose', 'warn', 'tap']) await page.evaluate(n => window.game.sfx(n), n);
  await page.evaluate(() => { const a = window.game.audio, t = a.ctx.currentTime; a.chop(t, 1); a.pick(t, 1); a.clank(t, 1); });
  await page.waitForTimeout(4000);
  // 打开菜单切换开关
  await page.evaluate(() => window.game.ui.open('menu'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/snd_menu.png`, timeout: 120000 });
  await page.click('text=音乐：开'); await page.waitForTimeout(300);
  await page.click('text=音效：开'); await page.waitForTimeout(800);
  const r2 = await page.evaluate(() => { const a = window.game.audio; return { st: a.ctx.state, sfx: a.sfxOn, music: a.musicOn, pref: localStorage.getItem('hanjin-beixing-v1-snd') }; });
  console.log('after toggle', JSON.stringify(r2));
  await page.click('text=音乐：关'); await page.waitForTimeout(500);
  const r3 = await page.evaluate(() => { const a = window.game.audio; return { st: a.ctx.state, music: a.musicOn }; });
  console.log('music back', JSON.stringify(r3));
}
