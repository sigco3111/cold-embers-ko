const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await page.evaluate(i => { const S = window.game.S; S.ev = null; S.evNext = S.t; S.t += 37 * i; }, i);
    await page.waitForTimeout(6000);
    const v = await page.evaluate(() => document.querySelector('#modal.show .mbox.ev h2')?.textContent);
    if (i === 1) await page.screenshot({ path: `${OUT}/ev_a.png`, timeout: 120000 });
    const pick = await page.evaluate(() => { const b = document.querySelector('.evopt[data-act=ev]'); const t = b?.querySelector('b').textContent; b?.click(); return t; });
    await page.waitForTimeout(400);
    seen.push(v + ' -> ' + pick);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ev_b.png`, timeout: 120000 });
  console.log(seen.join('\n'));
  console.log(await page.evaluate(() => JSON.stringify(window.game.ui.camp().buffs || [])));
}
