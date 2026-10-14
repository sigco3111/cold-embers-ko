// 深井 + 勘探：井架加高的模型、建筑面板里的深井按钮、勘探队找到的新矿脉
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const shot = async n => page.screenshot({ path: `${OUT}/deep_${n}_${TAG}.png`, timeout: 120000 });
  const wait = ms => page.waitForTimeout(ms);
  // 1) 采石场：附近石头采到一成，面板里出现挖深井
  const q = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    const b = S.buildings.find(x => x.camp === c.id && x.type === 'quarry');
    if (!b) return 'no quarry';
    const sp = Sim.rebuild ? null : null;
    window.__simstep(1);
    const R = Sim.rt(S);
    for (const s of (R.gatherSpots && R.gatherSpots.get(b.id)) || []) S.spots[s.i] = Sim.spotMax(S, s.i) * 0.1;
    for (const k of ['wood', 'stone', 'plank', 'food', 'steel']) c.stock[k] = Math.max(c.stock[k] || 0, 500);
    window.__simstep(1);
    window.__q = b.id;
    g.view.focus(b.x + 1, b.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 9;
    g.ui.open('bld', b.id);
    return { id: b.id, frac: Sim.gatherLeftFrac(S, b), block: Sim.deepBlock(S, b) };
  });
  console.log('quarry', JSON.stringify(q));
  await wait(1500);
  console.log('deepbox', await page.evaluate(() => { const e = document.querySelector('.deepbox'); return e ? e.innerText.replace(/\s+/g, ' ') : null; }));
  await shot('panel');
  const dug = await page.evaluate(() => { const b = document.querySelector('[data-act="deep"]'); if (!b) return 'no button'; b.click(); return 'clicked'; });
  console.log('dig', dug);
  await wait(400);
  for (let i = 0; i < 4; i++) await page.evaluate(() => window.__simstep(15));
  await wait(1500);
  const st = await page.evaluate(() => { const S = window.game.S, Sim = window.__sim, b = Sim.getB(S, window.__q), R = Sim.rt(S); return { deep: b.deep, status: (R.b[b.id] || {}).status, rate: (R.b[b.id] || {}).rate, row: (document.querySelector('.deeprow') || {}).innerText }; });
  console.log('after', JSON.stringify(st));
  await shot('panel2');
  await page.evaluate(() => window.game.ui.close());
  await wait(1500);
  await shot('quarry');
  // 2) 有井架的矿：把所有深井模型在旁边各看一眼
  const m = await page.evaluate(() => {
    const g = window.game, S = g.S;
    const b = S.buildings.find(x => ['crystalmine', 'coalmine', 'ironmine'].includes(x.type));
    if (!b) return 'no mine';
    b.deep = 1; window.__simstep(1);
    g.view.focus(b.x + 1, b.y + 1, true); g.view.cam.tdist = g.view.cam.dist = 7;
    return { type: b.type, at: [b.x, b.y] };
  });
  console.log('mine', JSON.stringify(m));
  await wait(3000);
  await shot('mine');
  // 3) 勘探：开侦察营面板 → 勘探 → 找到矿脉
  const sv = await page.evaluate(() => {
    const g = window.game, S = g.S, Sim = window.__sim, c = g.ui.camp();
    c.people = Math.max(c.people, 40);
    const sc = S.buildings.find(x => x.camp === c.id && x.type === 'scout');
    g.view.focus(c.x + 0.5, c.y + 0.5, true);
    g.ui.open('scout', sc && sc.id);
    return { block: Sim.surveyBlock(S, c), cost: Sim.surveyCost(S, c) };
  });
  console.log('survey', JSON.stringify(sv));
  await wait(1200);
  const sec = await page.evaluate(() => { const b = document.querySelector('[data-act="survey"]'); if (b) b.scrollIntoView({ block: 'center' }); return b ? b.closest('.sec, section, div').innerText.replace(/\s+/g, ' ').slice(0, 200) : null; });
  console.log('section', JSON.stringify(sec));
  await wait(400);
  await shot('scoutpanel');
  const go = await page.evaluate(() => { const b = document.querySelector('[data-act="survey"]'); if (!b) return 'no button'; b.click(); const s = window.game.S.scouts.find(q => q.kind === 'survey'); return s ? { to: [s.tx, s.ty], k: s.vein.k } : 'no scout'; });
  console.log('go', JSON.stringify(go));
  await page.evaluate(() => window.game.ui.close());
  await wait(800);
  await page.evaluate(() => { const s = window.game.S.scouts.find(q => q.kind === 'survey'); if (s) window.game.view.focus(s.x + 0.5, s.y + 0.5, true); });
  await wait(1500);
  await shot('walking');
  for (let i = 0; i < 30; i++) { const ph = await page.evaluate(() => { window.__simstep(5); const s = window.game.S.scouts.find(q => q.kind === 'survey'); return s ? s.phase : 'gone'; }); if (ph !== 'out') break; }
  await wait(600);
  const v = await page.evaluate(() => { const S = window.game.S; return { veins: S.veins, log: S.log.slice(-2).map(l => l.msg) }; });
  console.log('veins', JSON.stringify(v));
  await page.evaluate(() => { const S = window.game.S, v = (S.veins || [])[0]; if (v) { const x = v.i % 48, y = Math.floor(v.i / 48); window.game.view.focus(x + 0.5, y + 0.5, true); window.game.view.cam.tdist = window.game.view.cam.dist = 7; } });
  await wait(2500);
  await shot('vein');
}
