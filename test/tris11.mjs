// 哪些东西三角形最多（按 view 上挂的对象分组，可见的才算；含实例数）
export default async function (page) {
  await page.waitForTimeout(1500);
  for (const dist of [26, 60]) {
    const r = await page.evaluate(dist => {
      const g = window.game, v = g.view; const c = g.S.camps[0]; v.focus(c.x, c.y, true); v.cam.tdist = v.cam.dist = dist; v.frame(0.016);
      const owner = new Map();
      const tag = (o, name) => { o.traverse(x => { if (!owner.has(x)) owner.set(x, name); }); };
      for (const k of Object.keys(v).sort((a, b) => (a === 'root' || a === 'bldGroup') - (b === 'root' || b === 'bldGroup'))) { const o = v[k]; if (o && o.isObject3D && o !== v.scene) tag(o, k); else if (o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Map)) for (const k2 in o) { const x = o[k2]; if (x && x.isObject3D) tag(x, k + '.' + k2); } }
      if (v.buildings) for (const [id, o] of v.buildings) if (o && o.isObject3D) tag(o, 'bld'); else if (o && o.g && o.g.isObject3D) tag(o.g, 'bld');
      const agg = {};
      const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
      v.scene.traverse(o => {
        if (!o.isMesh && !o.isPoints && !o.isLine) return; if (!visible(o)) return;
        const geo = o.geometry; if (!geo) return;
        const n = geo.index ? geo.index.count / 3 : (geo.attributes.position ? geo.attributes.position.count / 3 : 0);
        const inst = o.isInstancedMesh ? o.count : 1; let k = owner.get(o) || ('?' + (o.parent && owner.get(o.parent) || o.name || o.type)); if (k === 'root') k = 'root:' + (o.name || (o.material && o.material.color ? '#' + o.material.color.getHexString() : o.type)) + (o.isInstancedMesh ? '[i]' : '');
        const a = agg[k] || (agg[k] = { tri: 0, calls: 0, sh: 0 }); a.tri += n * inst; a.calls++; if (o.castShadow) a.sh += n * inst;
      });
      return Object.entries(agg).sort((a, b) => b[1].tri - a[1].tri).slice(0, 18).map(([k, a]) => `${k}: ${(a.tri / 1000).toFixed(0)}k tris, ${a.calls} meshes, shadow ${(a.sh / 1000).toFixed(0)}k`).join('\n');
    }, dist);
    console.log('--- dist', dist, '\n' + r);
  }
}
