// 模型画廊：把一组模型摆成一排排，单独渲染（不画游戏场景和界面）
// ITEMS='bld:lumber:1,bld:quarry:6,fig,new:sledShedGeo:1' COLS=6 SP=3 DIST=10 PITCH=0.8 NIGHT=1 LO=1
export default async function (page) {
  await page.addStyleTag({ content: 'body > *:not(canvas){display:none!important}' });
  const env = { ITEMS: process.env.ITEMS || '', COLS: +(process.env.COLS || 6), SP: +(process.env.SP || 3), DIST: +(process.env.DIST || 12), PITCH: +(process.env.PITCH || 0.8), NIGHT: !!process.env.NIGHT, LO: !!process.env.LO, YAW: +(process.env.YAW || 0), TX: +(process.env.TX || 0), TZ: +(process.env.TZ || 0) };
  const r = await page.evaluate(async (env) => {
    const T = window.__THREE, M = window.__M, v = window.game.view;
    const sc = new T.Scene(); sc.background = new T.Color(env.NIGHT ? '#1a2238' : '#8a9db4');
    sc.add(new T.HemisphereLight(env.NIGHT ? '#4a68b0' : '#d2e2ff', env.NIGHT ? '#1c2434' : '#5a6676', env.NIGHT ? 0.48 : 1.1));
    const sun = new T.DirectionalLight(env.NIGHT ? '#a8c0ff' : '#ffd9ae', env.NIGHT ? 0.35 : 1.55); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const S = sun.shadow.camera; S.left = -30; S.right = 30; S.top = 30; S.bottom = -30; S.near = 1; S.far = 120; sun.shadow.bias = -0.0008;
    sc.add(sun, sun.target);
    v.matWin.color.setRGB(env.NIGHT ? 1 : 0.42, env.NIGHT ? 1 : 0.42, env.NIGHT ? 1 : 0.42);
    const gnd = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshLambertMaterial({ color: '#dfe7f0' })); gnd.rotation.x = -Math.PI / 2; gnd.receiveShadow = true; sc.add(gnd);
    const items = env.ITEMS.split(',').filter(Boolean);
    const n = items.length, cols = Math.min(env.COLS, n), rows = Math.ceil(n / cols);
    const out = [];
    items.forEach((it, i) => {
      const [kind, a, b, c] = it.split(':');
      const g = new T.Group();
      const add = (geo, mat, cast = true) => { if (!geo) return; const m = new T.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
      let tris = 0;
      if (kind === 'bld') {
        const G0 = v.bgeo(a, +(b || 1), c === 'deep');
        const geo = env.LO ? G0.geo : (G0.geo.userData.hi || G0.geo), glow = G0.glow ? (env.LO ? G0.glow : (G0.glow.userData.hi || G0.glow)) : null;
        add(geo, v.matStd); if (glow) add(glow, v.matWin, false);
        if (G0.flame) { const f = add(G0.flame, v.matGlow, false); f.position.y = G0.flameY; }
        if (!env.LO) for (const mv of G0.movers || []) { const o = add(mv.geo, v.matStd); o.position.set(...mv.pos); if (mv.kind === 'spin') o.rotation[mv.axis] = 0.4; tris += mv.geo.attributes.position.count / 3; }
        tris = geo.attributes.position.count / 3;
      } else if (kind === 'new') {
        const R = M[a](b === undefined ? undefined : (b === 'true' ? true : b === 'false' ? false : +b));
        const geo = R.geo || R; add(geo, v.matStd); if (R.glow) add(R.glow, v.matWin, false);
        tris = geo.attributes.position.count / 3;
      } else if (kind === 'spot') {
        const geo0 = M.spotGeo(a); const geo = env.LO ? geo0 : (geo0.userData.hi || geo0); add(geo, M.SPOT_GLOW.has(a) ? v.spotMeshes[a].material : v.matStd); tris = geo.attributes.position.count / 3;
      } else if (kind === 'decor') { const g0 = M.decorGeo(a), geo = env.LO ? g0 : (g0.userData.hi || g0); const o = add(geo, v.matStd); if (a === 'ripple') o.rotation.y = M.WIND_A; tris = geo.attributes.position.count / 3; }
      else if (kind === 'rem') { const g0 = M.remnantGeo(a), geo = env.LO ? g0 : (g0.userData.hi || g0); add(geo, v.matStd); tris = geo.attributes.position.count / 3; }
      else if (kind === 'fn') { const R = M[a](); const geo = R.geo || R.body || R; add(geo, v.matStd); if (R.head) { const h = add(R.head, v.matStd); h.position.set(...M.DEER_NECK); } tris = geo.attributes.position.count / 3; }
      const col = i % cols, row = Math.floor(i / cols);
      g.position.set((col - (cols - 1) / 2) * env.SP, 0, (row - (rows - 1) / 2) * env.SP);
      if (+(c) && kind !== 'bld') g.scale.setScalar(+c);
      sc.add(g); out.push(it + ' ' + Math.round(tris));
    });
    const cam = new T.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 400);
    const p = env.PITCH, d = env.DIST;
    cam.position.set(env.TX + Math.sin(env.YAW) * Math.cos(p) * d, Math.sin(p) * d, env.TZ + Math.cos(env.YAW) * Math.cos(p) * d); cam.lookAt(env.TX, 0, env.TZ);
    sun.position.set(26, 30, 12); sun.target.position.set(0, 0, 0);
    v.frame = () => { v.renderer.render(sc, cam); };
    return out.join('\n');
  }, env);
  console.log(r);
  await page.waitForTimeout(1500);
}
