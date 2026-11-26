// 传送带：在营地里找能连的上下游，接两条（一条升级成蒸汽轨道），看模型和建筑面板
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim;
    const out = [];
    for (const c of S.camps) {
      for (const k in c.stock) c.stock[k] = Math.max(c.stock[k], 900); c.stock.engine = 50;
      const opts = [];
      for (const b of S.buildings.filter(x => x.camp === c.id)) for (const o of Sim.beltOptions(S, b.id)) if (o.ck.ok && o.dir === 'out' && o.len >= 0.8) opts.push(o);
      opts.sort((a, b) => b.len - a.len);
      const used = new Set();
      for (const o of opts) { if (out.length >= 3 || used.has(o.a) || used.has(o.b)) continue; const rr = Sim.addBelt(S, o.a, o.b, o.k); if (rr.ok) { used.add(o.a); used.add(o.b); out.push({ a: o.a, b: o.b, k: o.k, len: +o.len.toFixed(1), ta: Sim.getB(S, o.a).type, tb: Sim.getB(S, o.b).type, camp: c.id }); } }
      if (out.length) break;
    }
    if (out[1]) { const e = S.belts.find(x => x.a === out[1].a && x.b === out[1].b); Sim.upBelt(S, e.id); }
    window.__simstep(2);
    window.__belts = out;
    return out;
  });
  console.log('belts', JSON.stringify(r));
  for (let i = 0; i < Math.min(2, r.length); i++) {
    await page.evaluate(i => { const g = window.game, S = g.S, Sim = window.__sim, o = window.__belts[i], a = Sim.getB(S, o.a), b = Sim.getB(S, o.b); S.active = o.camp; const s1 = window.__BLD[a.type].size, s2 = window.__BLD[b.type].size; g.view.focus((a.x + s1 / 2 + b.x + s2 / 2) / 2, (a.y + s1 / 2 + b.y + s2 / 2) / 2, true); g.view.cam.tdist = g.view.cam.dist = 8.5; g.view.cam.tyaw = (g.view.cam.tyaw || 0) + 0.6; }, i);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/belt_${i}_${TAG}.png`, timeout: 120000 });
  }
  await page.evaluate(() => { const g = window.game, o = window.__belts[0]; g.view.select(o.b); g.ui.open('bld', o.b); });
  await page.waitForTimeout(1200);
  const sec = await page.evaluate(() => { const rows = [...document.querySelectorAll('#sheet .row.belt')]; if (rows[0]) rows[0].scrollIntoView({ block: 'center' }); return rows.map(r => r.innerText.replace(/\s+/g, ' ')); });
  console.log('rows', JSON.stringify(sec));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/belt_panel_${TAG}.png`, timeout: 120000 });
}
