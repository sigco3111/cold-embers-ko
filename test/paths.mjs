const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const g = window.game, v = g.view; g.ui.closeModal(); const t0 = performance.now(); v.buildPaths(); const a = performance.now() - t0; v.routeFails = 0; v.buildPaths(); let fails = 0, tot = 0; for (const [, r] of v.routes) { tot++; if (r.pts.length === 2) fails++; } return `paths ${a.toFixed(0)}ms routes ${tot} straight ${fails} astarFail ${v.routeFails}`; });
  console.log(r);
  await page.evaluate(() => { const g = window.game; const c = g.S.camps[0]; g.view.focus(c.x + 3, c.y - 2, true); g.view.cam.tdist = 20; g.view.cam.dist = 20; });
  await page.waitForTimeout(2500);
}
