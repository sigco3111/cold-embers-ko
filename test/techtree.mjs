// 研究树：节点、连线、点节点展开详情、从详情里开始研究
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    const f = Sim.getB(S, c.furnace); let spot = null;
    for (let rr = 3; rr < 16 && !spot; rr++) for (let a = 0; a < 24 && !spot; a++) { const x = Math.round(f.x + 1 + Math.cos(a / 24 * 6.283) * rr), y = Math.round(f.y + 1 + Math.sin(a / 24 * 6.283) * rr); if (Sim.checkPlace(S, 'workshop', x, y).ok) spot = [x, y]; }
    Sim.place(S, 'workshop', spot[0], spot[1]);
    const T = Sim.techState ? Sim.techState(S) : S.tech;
    S.tech.done = { axe: 1, felt: 1, grate: 1, sled: 1 };
    Sim.startTech(S, 'drill'); S.tech.prog = 15;
    g.ui.open('research');
  });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({ nodes: document.querySelectorAll('.tnode').length, cls: [...document.querySelectorAll('.tnode')].map(n => n.dataset.arg + ':' + n.className.replace('tnode', '').trim()).join(' '), det: document.querySelector('.tdet b')?.textContent }));
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `${OUT}/tree_${TAG}.png`, timeout: 120000 });
  // 点「医务所」节点
  const b = await page.evaluate(() => { const e = document.querySelector('.tnode[data-arg=clinic]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 20 }; });
  await page.waitForTimeout(400);
  if (TAG === 'phone') await page.touchscreen.tap(b.x, b.y); else await page.mouse.click(b.x, b.y);
  await page.waitForTimeout(1000);
  console.log('sel', await page.evaluate(() => document.querySelector('.tdet b')?.textContent + ' | ' + document.querySelector('.tdet .tda')?.textContent));
  await page.screenshot({ path: `${OUT}/tree_sel_${TAG}.png`, timeout: 120000 });
}
