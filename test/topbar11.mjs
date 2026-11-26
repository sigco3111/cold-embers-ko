// 手机顶栏挤满时：暴风雪 + 索贡 + 心情差 + 袭击，▾ 一直在右边
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true; S.meta.tut = true;
    const z = Sim.blizzardSlot(S, 0); S.t = z.start + 30;
    const gg = Sim.gangsOf(S)[0]; S.gangs = { [gg.id]: { seen: 1, next: 9e9, rel: 0, wins: 0, n: 0, dem: { camp: c.id, until: S.t + 800 } } };
    c.hope = 20; c.disc = 60;
    Sim.step(S, 1); g.ui.hud();
    return [...document.querySelectorAll('#stats .pill')].map(p => p.className.replace('pill ', '') + '=' + p.innerText.replace(/\s+/g, ' ')).join(' | ');
  });
  console.log('pills', r);
  await page.waitForTimeout(1500);
  console.log('more', await page.evaluate(() => { const m = document.querySelector('#stats .pill.more').getBoundingClientRect(); return [Math.round(m.left), Math.round(m.right), innerWidth]; }));
  await page.screenshot({ path: `${OUT}/topbar_${TAG}.png`, clip: { x: 0, y: 0, width: 390, height: 160 }, timeout: 120000 });
  await page.click('#stats .pill.more');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/topbar_open_${TAG}.png`, clip: { x: 0, y: 0, width: 390, height: 300 }, timeout: 120000 });
}
