// 从北边地标重开：现成的营地 + 安全期
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'pc';
export default async function (page) {
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const g = window.game; for (const i of [1, 2, 3, 4]) if (!g.S.meta.sites.includes(i)) g.S.meta.sites.push(i); g.migrate(4); const S = g.S, c = S.camps[0]; return { site: S.site, b: S.buildings.map(b => b.type).join(','), people: c.people, raid: window.__sim.nextRaid(S)?.in }; });
  console.log(JSON.stringify(r));
  await page.waitForTimeout(2500);
  await page.evaluate(() => { document.getElementById('modal').classList.remove('show'); window.game.ui.hud(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/kit_${TAG}.png`, timeout: 120000 });
}
