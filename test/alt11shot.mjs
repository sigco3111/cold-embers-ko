// 1.1 替代配方 + 营地特产：建筑面板的「配方」、换配方时、营地面板的特产、建造卡片上的「特产」标签、规划器
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'phone';
const shot = (page, n) => page.screenshot({ path: `${OUT}/alt_${n}_${TAG}.png`, timeout: 120000 });
export default async function (page) {
  const info = await page.evaluate(() => {
    window.__noEvents = true; const g = window.game, S = g.S, Sim = window.__sim; S.meta.tut = true; S.meta.hintOff = true; g.ui.tutorial();
    S.tech = S.tech || { done: {}, cur: null, prog: 0 }; S.tech.done.alt1 = true; S.tech.done.alt2 = true;
    const m = Sim.mainCamp(S); S.active = m.id;
    const b = S.buildings.find(x => x.camp === m.id && Sim.altDef(x.type)) || S.buildings.find(x => Sim.altDef(x.type));
    window.__altB = b && b.id;
    return { b: b && b.type, specs: S.camps.map(c => c.name + ':' + c.spec) };
  });
  console.log('ALTINFO', JSON.stringify(info));
  const open = async (k, a, n) => { await page.evaluate(([k, a]) => window.game.ui.open(k, a), [k, a]); await page.waitForTimeout(900); await shot(page, n); };
  await open('bld', await page.evaluate(() => window.__altB), 'bld');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 99999; }); await page.waitForTimeout(400); await shot(page, 'bld2');
  await page.evaluate(() => { const Sim = window.__sim, S = window.game.S; Sim.setAlt(S, window.__altB, true); Sim.step(S, 1); window.game.ui.renderPanel(true); });
  await page.waitForTimeout(600); await shot(page, 'switch');
  await page.evaluate(() => { const Sim = window.__sim, S = window.game.S; for (let i = 0; i < 25; i++) Sim.step(S, 1); window.game.ui.renderPanel(true); window.game.ui.sheet.scrollTop = 0; });
  await page.waitForTimeout(600); await shot(page, 'after');
  await open('camp', null, 'camp');
  await page.evaluate(() => { const e = [...document.querySelectorAll('.sec')].find(x => x.textContent.includes('营地特产')); if (e) e.scrollIntoView(); }); await page.waitForTimeout(400); await shot(page, 'campspec');
  await page.evaluate(() => { window.game.ui.sheet.scrollTop = 99999; }); await page.waitForTimeout(400); await shot(page, 'camp2');
  await page.evaluate(() => { const S = window.game.S; window.game.ui.bTier = 3; }); await open('build', null, 'build');
  await page.evaluate(() => { const S = window.game.S, Sim = window.__sim, b = Sim.getB(S, window.__altB); window.game.ui.close(); window.game.chainmap.plan(Object.keys(window.__BLD[b.type].out)[0]); });
  await page.waitForTimeout(900); await shot(page, 'plan');
}
