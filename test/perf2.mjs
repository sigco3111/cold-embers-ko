export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, v = g.view; g.ui.closeModal();
    const gl = v.renderer.getContext();
    const out = [];
    for (const [dist, label] of [[26, 'near'], [60, 'mid'], [90, 'far'], [26, 'near2']]) {
      const c = g.S.camps[0]; v.focus(c.x, c.y, true); v.cam.tdist = dist; v.cam.dist = dist;
      const w0 = performance.now(); for (let i = 0; i < 3; i++) v.frame(0.016); gl.finish(); const warm = performance.now() - w0;
      const t0 = performance.now(); for (let i = 0; i < 10; i++) { v.frame(0.016); } gl.finish();
      out.push(`${label}: warm ${warm.toFixed(0)}ms, ${((performance.now() - t0) / 10).toFixed(1)}ms tris ${v.renderer.info.render.triangles} calls ${v.renderer.info.render.calls}`);
    }
    return out.join('\n');
  });
  console.log(r);
}
