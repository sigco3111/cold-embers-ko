// 树苗：伐木场附近砍光的树林以小树苗的样子长回来；建筑面板和资源点面板写清楚补种速度
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const info = await page.evaluate(async () => {
    const g = window.game, S = g.S, Sim = window.__sim, R = Sim.rt(S);
    const lum = S.buildings.filter(b => b.type === 'lumber' && (R.gatherSpots.get(b.id) || []).length >= 2)[0];
    if (!lum) return 'no lumber';
    const sp = R.gatherSpots.get(lum.id);
    S.sap = S.sap || {};
    sp.forEach((s, k) => { const mx = Sim.spotMax(S, s.i); if (k % 3 === 0) { S.spots[s.i] = 0; S.sap[s.i] = 1; } else if (k % 3 === 1) { S.spots[s.i] = mx * 0.15; S.sap[s.i] = 1; } else S.spots[s.i] = mx * 0.6; });
    R.spotsDirty = true;
    g.view.focus(lum.x + 1, lum.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 13;
    g.view.select(lum.id); g.ui.open('bld', lum.id);
    await new Promise(r => setTimeout(r, 1500));
    const rows = [...document.querySelectorAll('#sheet .row.sub')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(t => /资源点|补种/.test(t));
    const st = (R.b[lum.id] || {}).status;
    const sapI = sp.find((s, k) => k % 3 === 1).i;
    return { rows, st, sapI, n: sp.length };
  });
  console.log('lumber', JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/sapling_${TAG}.png`, timeout: 120000 });
  const spot = await page.evaluate(async i => {
    const g = window.game; g.ui.open('spot', i);
    await new Promise(r => setTimeout(r, 800));
    return [...document.querySelectorAll('#sheet .row')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  }, info.sapI);
  console.log('spot', JSON.stringify(spot));
  await page.screenshot({ path: `${OUT}/sapling_spot_${TAG}.png`, timeout: 120000 });
}
