// 装饰建筑：四种摆在营地里，白天和夜里各看一眼；面板和建造卡
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  if (!process.env.SAVEFILE) { await page.click('text=点起篝火'); await page.waitForTimeout(800); }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true; S.known = Math.max(S.known, 3);
    const DL = 720; S.t = Math.floor(S.t / DL + 1) * DL + 0.3 * DL;
    const out = {}, ids = [];
    for (const ty of ['flowerhouse', 'statue', 'flagpole', 'lamp', 'lamp', 'lamp']) {
      for (const k of ['wood', 'plank', 'stone', 'iron', 'steel']) c.stock[k] = 99999;
      let at = null, best = 1e9;
      for (let y = Math.floor(c.y - 10); y <= c.y + 10; y++) for (let x = Math.floor(c.x - 10); x <= c.x + 10; x++) { const ck = Sim.checkPlace(S, ty, x, y); if (ck.ok) { const d = Math.hypot(x - c.x - 1, y - c.y + 3); if (d < best) { best = d; at = [x, y]; } } }
      if (!at) { out[ty] = 'no spot'; continue; }
      const res = Sim.place(S, ty, at[0], at[1]); const b = Sim.getB(S, res.id); b.workers = Sim.maxWorkers(ty, 1); if (ty === 'lamp' && ids.filter(i => Sim.getB(S, i).type === 'lamp').length === 1) b.lvl = 5;
      ids.push(b.id); out[ty] = at;
    }
    for (let i = 0; i < 4; i++) Sim.step(S, 1);
    for (const id of ids) { const e = g.view.buildings.get(id); }
    window.__ids = ids;
    const bs = ids.map(i => Sim.getB(S, i)), mx = bs.reduce((a, b) => a + b.x + 0.5, 0) / bs.length, my = bs.reduce((a, b) => a + b.y + 0.5, 0) / bs.length;
    g.view.focus(mx, my, true); g.view.cam.tdist = g.view.cam.dist = 10;
    out.hope = Sim.decoHope(S, c);
    return out;
  });
  console.log('deco', JSON.stringify(r));
  await page.waitForTimeout(1500);
  await page.evaluate(() => { for (const id of window.__ids) { const e = window.game.view.buildings.get(id); if (e) e.cons = 0.0001; } });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/deco_day_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const S = window.game.S, DL = 720; S.t = Math.floor(S.t / DL) * DL + 0.8 * DL; });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/deco_night_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => window.game.ui.open('bld', window.__ids[1]));
  await page.waitForTimeout(800);
  console.log('panel', await page.evaluate(() => document.querySelector('#sheet').innerText.replace(/\s+/g, ' ').slice(0, 500)));
  await page.screenshot({ path: `${OUT}/deco_panel_${TAG}.png`, timeout: 120000 });
  await page.evaluate(() => { const g = window.game; g.ui.close(); g.ui.open('build'); g.ui.buildTier = 1; g.ui.refresh && g.ui.refresh(); });
  await page.evaluate(() => { const b = document.querySelector('[data-act=btier][data-arg="1"]'); if (b) b.click(); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const el = document.querySelector('.cards'); const card = [...document.querySelectorAll('.card')].find(c => c.innerText.includes('路灯')); if (card) card.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/deco_cards_${TAG}.png`, timeout: 120000 });
}
