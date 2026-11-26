const OUT = process.env.OUTDIR || '/tmp/v12';
export default async function (page) {
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1;
    S.reveal.fill(1); Sim.rt(S).revealDirty = true; Sim.rt(S).revealN = 99;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/rp0.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.actDo('routeprev'));
  for (let i = 1; i <= 3; i++) { await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/rp${i}.png`, timeout: 120000 }); }
}
