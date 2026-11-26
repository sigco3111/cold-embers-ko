const OUT = process.env.OUTDIR || '/tmp';
export default async function (page) {
  const shot = async (type, name) => {
    await page.evaluate(type => {
      const g = window.game, S = g.S, c = S.camps[0];
      const bs = S.buildings.filter(b => b.type === type && b.camp === c.id);
      const b = bs[Math.floor(bs.length / 2)];
      g.ui.open('bld', b.id); g.view.select(b.id);
      const s = 2; g.view.focus(b.x + 6, b.y + 4, true); g.view.cam.tdist = g.view.cam.dist = 40;
    }, type);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/chain_${name}.png`, timeout: 120000 });
  };
  await shot('sawmill', 'saw'); await shot('smelter', 'smelt'); await shot('lumber', 'lumber');
  const r = await page.evaluate(() => { const g = window.game; return { kids: g.view.chainG ? g.view.chainG.children.length : 0 }; });
  console.log(JSON.stringify(r));
}
