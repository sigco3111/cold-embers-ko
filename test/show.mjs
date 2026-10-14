// 展示所有建筑（不同等级）
export default async function (page) {
  await page.click('text=点起篝火');
  await page.evaluate(() => {
    const g = window.game; const S = g.S; const Sim = null;
    S.known = 7;
    const c = S.camps[0];
    const types = ['tent','lumber','quarry','hunter','sawmill','kitchen','warehouse','tower','scout','coalmine','ironmine','smelter','coker','limequarry','steelworks','gearworks','engineworks','greenhouse','heater','shalepit','refinery','sealworks','crystalmine','batteryworks','alloyworks','salvage','partworks','coreworks','bay','excavator','forge'];
    // 清掉附近资源点，强行摆放
    let i = 0;
    for (const t of types) {
      const col = i % 8, row = Math.floor(i / 8);
      const x = Math.floor(c.x) - 10 + col * 3, y = Math.floor(c.y) + 4 + row * 3;
      S.buildings.push({ id: S.nextId++, type: t, x, y, lvl: 1 + (i % 3) * 5, workers: 0, camp: c.id });
      i++;
    }
    S.buildings.find(b => b.type === 'furnace').lvl = 12;
    g.view.syncBuildings(true);
    g.view.focus(c.x, c.y + 8, true);
    g.view.cam.tdist = 30; g.view.cam.dist = 30;
  });
  await page.waitForTimeout(2500);
}
