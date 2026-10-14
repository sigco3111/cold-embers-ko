// 人心面板、律令
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const c = window.game.ui.camp(); c.disc = 64; c.hope = 41; });
  await page.waitForTimeout(1500);
  { const r = await page.evaluate(() => { const b = document.querySelector('.pill.mood').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }); await page.mouse.click(r[0], r[1]); }
  await page.waitForTimeout(1200);
  await page.click('[data-act=law][data-arg=fires]');
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => { const S = window.game.S, c = window.game.ui.camp(); return { laws: S.laws, hope: c.hope, disc: c.disc, mood: window.__sim.rt(S).c[c.id].mood }; });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/mood_${process.env.TAG || 'pc'}.png`, timeout: 120000 });
  await page.evaluate(() => { const b = document.getElementById('sheet'); b.scrollTop = 0; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/mood_${process.env.TAG || 'pc'}_b.png`, timeout: 120000 });
  await page.click('[data-act=law][data-arg=fires]').catch(() => console.log('cd button disabled ok'));
}
