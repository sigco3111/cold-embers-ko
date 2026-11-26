const OUT = process.env.OUTDIR || '/tmp/v12';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.closeModal && g.ui.closeModal(); window.__noEvents = 1;
    const J = Sim.journeyOf(S);
    g.ui.open('migrate');
    return JSON.stringify({ stage: J.stage, trip: !!J.trip, gate: Sim.departGate(S) && Sim.departGate(S).items.map(i => i.ok) });
  });
  console.log(info);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${TAG}_mig1.png`, timeout: 120000 });
  // 往下滚
  await page.evaluate(() => { document.getElementById('sheet').scrollTop = 560; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${TAG}_mig2.png`, timeout: 120000 });
  await page.evaluate(() => { document.getElementById('sheet').scrollTop = 1400; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${TAG}_mig3.png`, timeout: 120000 });
  // 余烬标签
  await page.evaluate(() => window.game.ui.actDo('ptab', 'ember'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${TAG}_mig4.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.actDo('ptab', 'go'));
}
