const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const go = async (p, name) => {
    await page.evaluate(p => { const g = window.game, S = g.S; S.t = Math.ceil(S.t / 720) * 720 + p * 720; const c = S.camps[0]; g.view.focus(c.x, c.y - 2, true); g.view.cam.tdist = g.view.cam.dist = 26; }, p);
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/dn_${name}.png`, timeout: 120000 });
  };
  await go(0.3, 'day'); await go(0.555, 'dusk'); await go(0.76, 'night'); await go(0.95, 'dawn');
}
