// 极光夜、冰雾早晨的画面
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const q = process.env.Q || 'high';
  const info = await page.evaluate(q => {
    const g = window.game, S = g.S, Sim = window.__sim;
    g.setQuality(q);
    // 找下一个极光夜的深夜
    let ta = null, ti = null;
    for (let t = Math.ceil(S.t / 60) * 60; t < S.t + 720 * 40 && (ta == null || ti == null); t += 20) {
      const k = Sim.skyAt(S, t);
      if (ta == null && k.aurora >= 0.999) ta = t + 60;
      if (ti == null && k.icefog >= 0.999 && ((t / 720) % 1) < 0.15 && ((t / 720) % 1) > 0.04) ti = t;
    }
    window.__tA = ta; window.__tI = ti;
    const b = S.buildings.find(b => b.type === 'furnace');
    g.view.focus(b.x + 2, b.y - 3, true); g.view.cam.tdist = g.view.cam.dist = 24;
    S.t = ta; g.view.aur = 1; g.view.nf = 1;
    return { ta, ti };
  }, q);
  console.log('sky', JSON.stringify(info));
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${OUT}/sky_aur_${q}.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.S.t = window.__tI; g.view.ice = 1; g.view.aur = 0; });
  await page.waitForTimeout(4500);
  console.log('pill', await page.evaluate(() => document.getElementById('stats').innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: `${OUT}/sky_ice_${q}.png`, timeout: 120000 });
}
