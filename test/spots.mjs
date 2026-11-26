// 资源点特写：找一片鹿群和树林
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const st = await page.$('text=点起篝火'); if (st) await st.click();
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, c = S.camps[0];
    const W = 48;
    for (let k = 0; k < S.reveal.length && k < W * 80; k++) S.reveal[k] = 1;
    g.view.refreshFog(); g.view.refreshSpots(); g.view.refreshRocks();
    // 找最近的 herd 和 rock 格
    const w = g.view.world; const keys = ['tree','herd','rock'];
    const found = {};
    const best = {}; for (let i = 0; i < W * 80; i++) { const sp = w.spot[i]; if (sp < 0) continue; const dx = i % W - c.x, dy = Math.floor(i / W) - c.y; const d = Math.hypot(dx, dy); if (d < 4 || d > 16) continue; const k = ['tree','herd','rock','coal','ore','lime','shale','crystal','star','shard'][sp]; if (!found[k]) found[k] = [i % W, Math.floor(i / W)]; }
    found.camp = [c.x, c.y];
    return found;
  });
  console.log(JSON.stringify(info));
  let n = 0;
  for (const k of ['herd', 'tree', 'rock', 'camp']) {
    const p = info[k]; if (!p) continue;
    await page.evaluate(([x, y]) => { const g = window.game; g.view.focus(x + 0.5, y + 0.5, true); g.view.cam.tdist = 12; g.view.cam.dist = 12; }, p);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/sp_${k}.png`, timeout: 120000 });
  }
}
