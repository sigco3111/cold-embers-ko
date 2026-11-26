const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.evaluate(() => { const g = window.game, c = g.S.camps[0]; g.view.focus(c.x + 2, c.y - 3, true); g.view.cam.tdist = g.view.cam.dist = 14; });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/pp_talk.png`, timeout: 120000 });
  const pt = await page.evaluate(() => { const v = window.game.view; for (let i = 0; i < v.figInfo.length; i++) { const f = v.figInfo[i]; if (f && f.k === 'w') { const p = v.project(v.figPts[i * 2], v.figPts[i * 2 + 1], 0.25); if (p.on && p.x > 200 && p.x < 800 && p.y > 200 && p.y < 650) return p; } } return null; });
  console.log('pt', JSON.stringify(pt));
  if (pt) await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/pp_panel.png`, timeout: 120000 });
  console.log(await page.evaluate(() => JSON.stringify(window.game.ui.panel && window.game.ui.panel.kind)));
  await page.evaluate(() => window.game.ui.open('camp'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/pp_camp.png`, timeout: 120000 });
}
