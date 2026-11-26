// 第 5 步回归：老存档的默认视角、拉远视角，看地形/山/雾有没有变
const OUT = process.env.OUTDIR || '/tmp';
const TAG = process.env.TAG || 'a';
export default async function (page) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/r5_${TAG}_near.png`, timeout: 120000 });
  await page.evaluate(() => { const v = window.game.view; v.cam.tdist = v.cam.dist = 60; });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/r5_${TAG}_far.png`, timeout: 180000 });
  const r = await page.evaluate(() => { const v = window.game.view; return { terr: v.terr.size, skirt: v.skirt.size, fog: v.fogF0, rows: window.game.S.rows }; });
  console.log(JSON.stringify(r));
}
