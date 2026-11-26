// 1.1 熟练工 + 寒潮季：建筑名字旁的小星和熟练行、顶栏温度格的寒潮倒计时、提醒、天气面板的寒潮卡
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/season_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  const info = await page.evaluate(() => {
    window.__noEvents = true; const g = window.game, S = g.S, Sim = window.__sim; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial();
    const m = Sim.mainCamp(S); S.active = m.id;
    const b = S.buildings.find(x => x.camp === m.id && x.type === 'smelter') || S.buildings.find(x => x.camp === m.id && Sim.skillable(x) && x.workers);
    b.xp = 75; window.__skB = b.id;
    S.cold = { t0: S.t - 1440 + 400 }; // 寒潮约 400 秒后到：已经报了
    return { b: b.type, cold: Sim.coldAt(S) };
  });
  console.log('SEASON', JSON.stringify(info));
  await page.waitForTimeout(1200); await shot(page, 'top');
  await page.evaluate(() => window.game.ui.open('bld', window.__skB)); await page.waitForTimeout(900); await shot(page, 'bld');
  await page.evaluate(() => window.game.ui.open('weather')); await page.waitForTimeout(900); await shot(page, 'wx');
  await page.evaluate(() => window.game.ui.open('alerts')); await page.waitForTimeout(900); await shot(page, 'alerts');
  await page.evaluate(() => { const S = window.game.S; S.cold.t0 -= 500; window.game.ui.close(); }); await page.waitForTimeout(1500); await shot(page, 'on');
  await page.evaluate(() => window.game.ui.open('weather')); await page.waitForTimeout(900); await shot(page, 'wxon');
}
