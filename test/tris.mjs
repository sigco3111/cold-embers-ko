export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, v = g.view; g.ui.closeModal();
    const c = g.S.camps[0]; v.focus(c.x, c.y, true); v.cam.tdist = 30; v.cam.dist = 30; v.frame(0.016);
    const fr = new (v.camera.constructor.prototype.constructor === undefined ? Object : Object)();
    const rows = [];
    v.scene.traverseVisible(o => {
      if (!o.isMesh && !o.isPoints) return;
      const geo = o.geometry; if (!geo || !geo.attributes.position) return;
      const t = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      const n = o.isInstancedMesh ? o.count : 1;
      rows.push([o.isInstancedMesh ? 'inst' : 'mesh', o.parent === v.root ? 'root' : o.parent === v.scene ? 'scene' : 'grp', Math.round(t), n, Math.round(t * n), o.castShadow]);
    });
    rows.sort((a, b) => b[4] - a[4]);
    return rows.slice(0, 25).map(r => r.join(' ')).join('\n') + '\nTOTAL ' + rows.reduce((s, r) => s + r[4], 0) + ' bld ' + v.bldGroup.children.length;
  });
  console.log(r);
}
