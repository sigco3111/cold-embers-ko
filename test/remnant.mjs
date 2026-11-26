const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const st = await page.$('text=点起篝火'); if (st) await st.click();
  const r = await page.evaluate(() => {
    const g = window.game, v = g.view, S = g.S, w = v.world, c = S.camps[0];
    let n = 0, at = null;
    for (let i = 0; i < 48 * 40; i++) { const sp = w.spot[i]; if (sp < 0) continue; const x = i % 48, y = Math.floor(i / 48); if (Math.hypot(x - c.x, y - c.y) < 11 && (x + y) % 2 === 0) { S.spots[i] = 0; n++; if (!at) at = [x, y]; } }
    v.refreshSpots(); v.decorKey = '';
    v.focus(c.x + 3, c.y + 4, true); v.cam.tdist = 13; v.cam.dist = 13;
    return { n, stumps: v.remnants.stump.count, pits: v.remnants.pit.count };
  });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(1800);
}
