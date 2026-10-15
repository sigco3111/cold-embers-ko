// 八种北境装饰：发全部成就、摆在主营地旁边，白天近看一眼；建造卡的锁定文字
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(([only, dist]) => {
    const g = window.game, S = g.S, Sim = window.__sim, c = Sim.mainCamp(S);
    window.__noEvents = true;
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.35 * DL;
    const lock0 = Sim.stageLock(S, 'skymem');
    const bk = Sim.bookOf(S); for (const a of Sim.ACH) if (a.cat) bk.a[a.id] = bk.a[a.id] || S.t;
    const out = { lock0, ok: Sim.unlocked(S, 'skymem') }, ids = [];
    const list = (only || 'icesculpt,windchime,snowman,lanterns,deerstatue,bonearch,pyremem,skymem').split(',');
    for (const ty of list) {
      for (const k of ['wood', 'plank', 'stone', 'iron', 'steel', 'alloy']) c.stock[k] = 99999;
      let at = null, best = 1e9;
      for (let y = Math.floor(c.y - 12); y <= c.y + 12; y++) for (let x = Math.floor(c.x - 12); x <= c.x + 12; x++) { const ck = Sim.checkPlace(S, ty, x, y); if (ck.ok && !ids.some(i => { const o = Sim.getB(S, i); return Math.hypot(o.x - x, o.y - y) < 3.2; })) { const d = Math.hypot(x - c.x - 2, y - c.y + 5); if (d < best) { best = d; at = [x, y]; } } }
      if (!at) { out[ty] = 'no spot'; continue; }
      const res = Sim.place(S, ty, at[0], at[1]); if (!res.ok) { out[ty] = res.reason; continue; }
      const b = Sim.getB(S, res.id); b.cons = 0; b.prog = 1;
      ids.push(b.id); out[ty] = at;
    }
    for (let i = 0; i < 4; i++) Sim.step(S, 1);
    window.__ids = ids;
    const bs = ids.map(i => Sim.getB(S, i)), mx = bs.reduce((a, b) => a + b.x + 0.5, 0) / bs.length, my = bs.reduce((a, b) => a + b.y + 0.5, 0) / bs.length;
    g.view.focus(mx, my, true); g.view.cam.tdist = g.view.cam.dist = dist;
    out.hope = Sim.decoHope(S, c);
    out.cons = bs.map(b => [b.type, b.cons, b.done]);
    return out;
  }, [process.env.ONLY || '', +(process.env.DIST || 13)]);
  console.log('ndeco', JSON.stringify(r));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const id of window.__ids) { const e = window.game.view.buildings.get(id); if (e) e.cons = 0.0001; } });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/ndeco_${TAG}.png`, timeout: 120000 });
}
