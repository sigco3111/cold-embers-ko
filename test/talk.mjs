const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.evaluate(() => { const g = window.game, c = g.S.camps[0]; g.view.focus(c.x + 2, c.y - 3, true); g.view.cam.tdist = g.view.cam.dist = 14; });
  let got = null;
  for (let i = 0; i < 20 && !got; i++) { await page.waitForTimeout(700); got = await page.evaluate(() => document.querySelector('#labels .talk')?.textContent || null); }
  console.log('talk:', got);
  await page.screenshot({ path: `${OUT}/pp_talk.png`, timeout: 120000 });
}
