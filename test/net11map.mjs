// 1.1 物流网：地图上的路（雪橇道、主干道、铁路）和路上装着货的雪橇；队列卡片上「正从哪运来」
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
const shot = (page, n) => page.screenshot({ path: `${OUT}/nmap_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const S = window.game.S; S.meta.tut = true; S.meta.hintOff = true; window.game.ui.tutorial(); window.game.ui.close(); });
  const look = async (n, fn, arg) => { const r = await page.evaluate(fn, arg); console.log('LOOK', n, JSON.stringify(r)); await page.waitForTimeout(1400); await shot(page, n); };
  // 让货跑起来
  await page.evaluate(() => { const S = window.game.S, Sim = window.__sim; for (let i = 0; i < 40; i++) Sim.step(S, 1); });
  // 每条路拍一张：路中段
  const roads = await page.evaluate(() => window.__sim.roads(window.game.S).map(r => r.id));
  for (const rid of roads) {
    await look('road' + rid, id => {
      const g = window.game, S = g.S, Sim = window.__sim, r = Sim.roadOf(S, id), P = Sim.roadPath(S, r), L = Sim.roadLen(S, r), p = Sim.tripPos({ path: P, d: L * 0.4 });
      g.view.focus(p.x, p.y, true); g.view.cam.tdist = g.view.cam.dist = 18; for (let i = 0; i < 20; i++) g.view.frame(0.05);
      return { id, kind: r.kind, lvl: r.lvl, via: !!r.via, pts: P.length, len: Math.round(L), ships: Sim.ships(S).filter(s => (Sim.shipPos(S, s) || {}).r === r).length };
    }, rid);
  }
  // 一架雪橇的近景（和 render.js 里一样的算法找到它）
  await look('sled', () => {
    const g = window.game, S = g.S, Sim = window.__sim;
    const sh = Sim.ships(S).find(s => { const p = Sim.shipPos(S, s); return p && p.r.kind !== 'rail'; });
    if (!sh) return { none: true };
    const ps = Sim.shipPos(S, sh), r = ps.r, P = Sim.roadPath(S, r); let tot = 0; for (let i = 1; i < P.length; i++) tot += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const f = 0.06 + ps.f * 0.88, fwd = ps.from === r.a, q = Sim.tripPos({ path: P, d: (fwd ? f : 1 - f) * tot });
    g.togglePause(true); g.view.focus(q.x, q.y, true); g.view.cam.tdist = g.view.cam.dist = 9; for (let i = 0; i < 20; i++) g.view.frame(0.02);
    return { k: sh.k, n: Math.round(sh.n), x: q.x.toFixed(1), y: q.y.toFixed(1), cnt: g.view.supSled.count };
  });
  // 队列：主营地缺木板，等补给站运来
  await look('queue', () => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S), d = S.camps.find(c => c.depot);
    g.togglePause(false); S.active = m.id; d.stock.stone = 3000; m.stock.stone = 0;
    let q = null;
    for (let y = Math.floor(m.y) - 12; y <= m.y + 12 && !q; y++) for (let x = Math.floor(m.x) - 12; x <= m.x + 12 && !q; x++) { const ck = Sim.checkPlace(S, 'sawmill', x, y); if (ck.soft || ck.ok) { const r = Sim.queueBuild(S, 'sawmill', x, y); if (r.queued) q = r; } }
    for (let i = 0; i < 25; i++) Sim.step(S, 1);
    g.ui.open('bqueue');
    return { q: !!q, inc: JSON.stringify(Object.keys(Sim.netView(S, m.id).inc)) };
  });
  await look('qcard', () => { const g = window.game, S = g.S; const q = (S.queue || []).find(x => x.camp === S.active); if (q) g.ui.open('queue', q.id); return { q: !!q }; });
}
