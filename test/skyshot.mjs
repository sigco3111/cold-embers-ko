// 终章镜头的画面：SAVEFILE=/tmp/v13/tw10x.json，SKY=build（天火塔塔身）| lit（刚点亮）| start（镜头开头）| mid（往南飞到一半，SEG=第几段）| end（落到永恒之炉）| modal（「这一路」）
export default async function (page) {
  if (process.env.LOOK) await page.evaluate(v => { window.__lookT = v; }, +process.env.LOOK);
  const mode = process.env.SKY || 'start', seg = +(process.env.SEG || 4);
  const r = await page.evaluate(([mode, seg]) => {
    const g = window.game, S = g.S, Sim = window.__sim, v = g.view, c = Sim.mainCamp(S);
    for (const k of ['steel', 'alloy', 'part', 'core', 'battery', 'starcore', 'heart']) c.stock[k] = Math.max(c.stock[k] || 0, 5000);
    let best = null;
    for (let y = Math.floor(c.y - 9); y <= c.y + 9; y++) for (let x = Math.floor(c.x - 9); x <= c.x + 9; x++) { if (!Sim.checkPlace(S, 'skyfire', x, y).ok) continue; const d = Math.hypot(x + 2 - c.x - 3, y + 2 - c.y - 2); if (!best || d < best.d) best = { x, y, d }; }
    const q = best && Sim.place(S, 'skyfire', best.x, best.y), b = q && q.ok && Sim.getB(S, q.id);
    if (!b) return { err: 'no spot', best, q };
    const sp = Sim.towerSpec(S, 10);
    b.tw.p = mode === 'build' ? sp.dur * 0.6 : sp.dur;
    v.syncBuildings(true);
    if (mode === 'build') { v.focus(b.x + 2, b.y + 2, true); v.cam.tdist = v.cam.dist = 22; return { b: b.id }; }
    const ig = Sim.igniteTower(S, b.id);
    return { b: b.id, ig };
  }, [mode, seg]);
  console.log('skyshot', JSON.stringify(r));
  if (mode === 'build') { await page.waitForTimeout(3000); return; }
  await page.waitForFunction(() => !!window.game.cine, null, { timeout: 60000 }).catch(() => {}); // 主循环收到 fx，开始放镜头
  const info = await page.evaluate(([mode, seg]) => {
    const g = window.game, v = g.view, C = g.cine, c = v.cam;
    if (!C) return { err: 'no cine', skyLater: g.skyLater };
    const snap = () => { c.tx = c.ttx; c.ty = c.tty; c.dist = c.tdist; c.yaw = c.tyaw; };
    if (mode === 'lit') { C.t = 0.1; C.end = 1e9; g.cineStep(0); snap(); c.dist = c.tdist = 30; C.hold = 1; }
    if (mode === 'start') { C.t = 2.0; C.end = 1e9; g.cineStep(0); snap(); }
    if (mode === 'mid') { const s = C.segs[Math.min(seg, C.segs.length - 1)]; C.t = (s.t0 + s.t1) / 2; C.end = 1e9; g.cineStep(0); snap(); }
    if (mode === 'end') { C.t = C.segs.at(-1).t1 + (+(window.__lookT ?? 3.6)); C.end = 1e9; g.cineStep(0); snap(); }
    if (mode === 'modal') { C.t = C.segs.at(-1).t1 + 0.01; g.cineStep(0); snap(); }
    return { t: C.t, i: C.i, segs: C.segs.length, cap: document.querySelector('#cinebar .cap')?.textContent, cine: document.body.classList.contains('cine') };
  }, [mode, seg]);
  console.log('cine', JSON.stringify(info));
  if (mode === 'lit') await page.evaluate(() => { const g = window.game; g.cineStep = function () {}; }); // 停在塔跟前
  if (mode === 'start' || mode === 'mid' || mode === 'end') await page.evaluate(() => { const g = window.game, C = g.cine, f = g.cineStep.bind(g); g.cineStep = dt => { const t = C.t; f(0); C.t = t; }; });
  await page.waitForTimeout(mode === 'end' ? 6000 : 3500);
  if (mode === 'modal') { await page.evaluate(() => { const g = window.game; if (g.cine) g.cineEnd(); }); await page.waitForTimeout(3500); }
  if (process.env.DBG) console.log('dbg', JSON.stringify(await page.evaluate(() => { const v = window.game.view, c = v.cam; return { cam: [c.tx, c.ty, c.dist, c.yaw], camPos: v.camera.position.toArray().map(Math.round), pl: v.pillars.list.map(e => [e.n, Math.round(e.g.position.x), Math.round(e.g.position.z), e.g.visible, +e.grow.toFixed(2), e.g.children.length, e.g.parent === v.pillars.group, !!v.pillars.group.parent]) }; })));
  const after = await page.evaluate(() => ({ cine: !!window.game.cine, modal: document.getElementById('modal').classList.contains('show'), sum: document.querySelector('.skysum')?.children.length }));
  console.log('after', JSON.stringify(after));
}
