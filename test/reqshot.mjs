// 人物委托：营地里站着提委托的人，头上有「！」；点开委托面板
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    window.__noEvents = true;
    S.reqNext = 0; S.reqs = [];
    const a = Sim.rollRequest(S);
    S.reqNext = 0; const b = Sim.rollRequest(S);
    // 再塞一个已经能完成的
    S.reqs.push({ kind: 'stock', k: 'wood', n: 100, rw: { embers: 2, hope: 6 }, id: S.nextId++, camp: c.id, t0: S.t, until: S.t + 3000 });
    S.reqs = S.reqs.slice(-2);
    g.view.focus(c.x, c.y - 1.5, true); g.view.cam.tdist = g.view.cam.dist = 11;
    return S.reqs.map(r => Sim.reqTitle(S, r));
  });
  console.log('reqs', JSON.stringify(r));
  await page.waitForTimeout(3000);
  const tags = await page.evaluate(() => [...document.querySelectorAll('.reqtag')].map(e => e.innerText.replace(/\s+/g, ' ')));
  console.log('tags', JSON.stringify(tags));
  await page.screenshot({ path: `${OUT}/req_scene_${TAG}.png`, timeout: 120000 });
  const box = await page.evaluate(() => { const e = document.querySelector('.reqtag'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  if (box) await page.mouse.click(box.x, box.y); else await page.evaluate(() => window.game.ui.open('req'));
  await page.waitForTimeout(1000);
  console.log('panel', await page.evaluate(() => (window.game.ui.panel || {}).kind + ' | ' + document.querySelector('#sheet').innerText.slice(0, 300).replace(/\s+/g, ' ')));
  await page.screenshot({ path: `${OUT}/req_panel_${TAG}.png`, timeout: 120000 });
  const done = await page.evaluate(() => { const b = document.querySelector('[data-act="reqok"]'); if (!b) return null; b.click(); return window.game.S.reqs.length; });
  console.log('claimed, left', done);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/req_after_${TAG}.png`, timeout: 120000 });
}
