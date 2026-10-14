// 近景检查建筑细节：分批摆放所有建筑，按组拍特写
const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game; const S = g.S;
    S.known = 7;
    const c = S.camps[0];
    for (let i = 0; i < S.spots.length; i++) S.spots[i] = 0;
    const types = ['tent','tent','lumber','quarry','hunter','sawmill','kitchen','warehouse','tower','scout','coalmine','ironmine','smelter','coker','limequarry','steelworks','gearworks','engineworks','greenhouse','heater','shalepit','refinery','sealworks','crystalmine','batteryworks','alloyworks','salvage','partworks','coreworks','bay','excavator','forge'];
    let i = 0;
    for (const t of types) {
      const col = i % 6, row = Math.floor(i / 6);
      const x = Math.floor(c.x) - 9 + col * 3, y = Math.floor(c.y) + 4 + row * 3;
      S.buildings.push({ id: S.nextId++, type: t, x, y, lvl: t === 'tent' && i === 1 ? 4 : 1 + (row % 2) * 6, workers: 2, camp: c.id });
      i++;
    }
    S.buildings.find(b => b.type === 'furnace').lvl = 6;
    for (let k = 0; k < S.reveal.length; k++) S.reveal[k] = 1;
    window.__c = c;
    g.ui.closeModal && g.ui.closeModal();
    Sim_dirty: { const R = g.S && g.view; }
    g.view.syncBuildings(true); g.view.refreshSpots(); g.view.refreshFog();
  });
  const shots = [[0, -1], [0, 5], [0, 11], [0, 17]];
  for (let k = 0; k < shots.length; k++) {
    await page.evaluate(([dx, dy]) => { const g = window.game, c = window.__c; g.view.focus(c.x + dx, c.y + dy, true); g.view.cam.tdist = 13; g.view.cam.dist = 13; }, shots[k]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/close${k}.png`, timeout: 120000 });
  }
}
