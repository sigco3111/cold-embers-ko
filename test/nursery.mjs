// 育林场：建造面板里有卡片，模型摆在营地里看着对
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const g = window.game, S = g.S, Sim = window.__sim, c = S.camps.find(x => x.id === S.active) || S.camps[0];
    let at = null;
    for (let d = 3; d < 14 && !at; d++) for (let k = 0; k < 24 && !at; k++) { const a = k / 24 * 6.283; const x = Math.round(c.x + Math.cos(a) * d - 1), y = Math.round(c.y + Math.sin(a) * d - 1); const ck = Sim.checkPlace(S, 'nursery', x, y); if (ck.ok || ck.soft) at = [x, y]; }
    if (!at) return 'no spot';
    c.stock.wood = Math.max(c.stock.wood || 0, 100); c.stock.stone = Math.max(c.stock.stone || 0, 100);
    const p = Sim.place(S, 'nursery', at[0], at[1]);
    if (!p.ok) return p.reason;
    const b = Sim.getB(S, p.id); b.workers = 2;
    g.view.focus(at[0] + 1, at[1] + 1, true); g.view.cam.tdist = g.view.cam.dist = 11;
    await new Promise(r => setTimeout(r, 1200));
    const e = g.view.buildings.get(b.id); if (e) e.cons = 0.0001; // 跳过脚手架动画
    await new Promise(r => setTimeout(r, 2500));
    const R = Sim.rt(S);
    return { at, status: (R.b[b.id] || {}).status, rate: (R.b[b.id] || {}).rate };
  });
  console.log('nursery', JSON.stringify(r));
  await page.screenshot({ path: `${OUT}/nursery_${TAG}.png`, timeout: 120000 });
  const card = await page.evaluate(async () => {
    const g = window.game; g.ui.openBuild ? g.ui.openBuild() : document.getElementById('tbBuild').click();
    await new Promise(r => setTimeout(r, 900));
    const el = [...document.querySelectorAll('#sheet [data-arg="nursery"], #sheet .bcard')].find(e => (e.textContent || '').includes('育林场') || e.dataset.arg === 'nursery');
    if (el) el.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise(r => setTimeout(r, 300));
    return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : null;
  });
  console.log('card', JSON.stringify(card));
  await page.screenshot({ path: `${OUT}/nursery_card_${TAG}.png`, timeout: 120000 });
}
