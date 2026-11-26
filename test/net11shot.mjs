// 1.1 物流网：面板三页、营地面板的物流行、队列里的「正从哪运来」、地图上的路和雪橇、大地图
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/net_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  await page.evaluate(() => { window.__noEvents = true; const S = window.game.S; S.meta.tut = true; S.meta.hintOff = true; window.game.ui.tutorial(); });
  // 跑一会儿让货上路；主营地排一座缺料的房子
  const info = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, m = Sim.mainCamp(S);
    for (let i = 0; i < 40; i++) Sim.step(S, 1);
    S.active = m.id;
    let q = null; const t = 'tent';
    for (let y = Math.floor(m.y) - 9; y <= m.y + 9 && !q; y++) for (let x = Math.floor(m.x) - 9; x <= m.x + 9 && !q; x++) { const ck = Sim.checkPlace(S, t, x, y); if (ck.ok || ck.soft) { const save = { ...m.stock }; for (const k in Sim.queueCost(S, { type: t, camp: m.id, y })) m.stock[k] = 0; const r = Sim.queueBuild(S, t, x, y); if (r.queued) q = r; else Object.assign(m.stock, save); } }
    for (let i = 0; i < 12; i++) Sim.step(S, 1);
    return JSON.stringify({ roads: Sim.roads(S).map(r => [r.a, r.b, r.kind, r.lvl]), ships: Sim.ships(S).length, q: !!q, err: (window.__errs || []).slice(0, 3) });
  });
  console.log('NETINFO', info);
  const open = async (kind, arg, n, pre) => { await page.evaluate(([k, a, p]) => { const u = window.game.ui; if (p) u.netPg = p; u.open(k, a); }, [kind, arg, pre]); await page.waitForTimeout(800); await shot(page, n); };
  await open('lines', null, 'all', 'all');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 99999; }); await page.waitForTimeout(500); await shot(page, 'all2');
  await open('lines', null, 'road', 'road');
  await open('lines', null, 'send', 'send');
  await open('camp', null, 'camp');
  await open('bqueue', null, 'queue');
  // 地图：看一段有货在跑的路
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim; g.ui.close();
    const sh = Sim.ships(S)[0]; let x = Sim.mainCamp(S).x, y = Sim.mainCamp(S).y;
    if (sh) { const p = Sim.shipPos(S, sh), P = Sim.roadPath(S, p.r); const a = P[0], b = P[P.length - 1]; x = (a[0] + b[0]) / 2; y = Math.min(a[1], b[1]) + 6; }
    g.view.focus(x, y, true); g.view.cam.tdist = g.view.cam.dist = 26; for (let i = 0; i < 30; i++) g.view.frame(0.05);
  });
  await page.waitForTimeout(1500); await shot(page, 'map');
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, sh = Sim.ships(S).find(s => { const p = Sim.shipPos(S, s); return p && p.r.kind !== 'rail'; }) || Sim.ships(S)[0];
    if (sh) { const p = Sim.shipPos(S, sh), P = Sim.roadPath(S, p.r), d = (p.from === p.r.a ? p.f : 1 - p.f); const q = Sim.tripPos({ path: P, d: d * Sim.roadLen(S, p.r) }); g.view.focus(q.x, q.y, true); g.view.cam.tdist = g.view.cam.dist = 9; for (let i = 0; i < 30; i++) g.view.frame(0.05); }
  });
  await page.waitForTimeout(1500); await shot(page, 'sled');
  await page.evaluate(() => window.game.bigmap.toggle()); await page.waitForTimeout(1400); await shot(page, 'bigmap');
  await page.evaluate(() => window.game.bigmap.toggle());
}
