export default async function (page) {
  await page.click('text=点起篝火');
  await page.click('#menuBtn');
  await page.click('#sheet .ptabs button[data-arg=msave]'); // 1.1：存档码在「菜单 › 存档」页签
  await page.click('text=导出存档码');
  await page.waitForTimeout(500);
  const code = await page.$eval('#exportBox', e => e.value);
  console.log('code len', code.length, code.slice(0, 12));
  await page.click('text=关闭');
  // 改动状态后导入
  await page.evaluate(() => { window.game.S.camps[0].stock.wood = 1; });
  await page.click('#sheet >> text=导入存档码');
  await page.fill('#importBox', code);
  await page.click('.mbtns >> text=导入');
  await page.waitForTimeout(800);
  console.log('wood after import', await page.evaluate(() => window.game.S.camps[0].stock.wood));
  await page.evaluate(() => { const g = window.game, S = g.S, c = S.camps[0]; Object.assign(c.stock, { wood: 900, stone: 500 });
    for (const t of ['lumber','tent','hunter','kitchen']) { g.startPlace(t); let done=false;
      for (let r = 2; r < 10 && !done; r++) for (let dy = -r; dy <= r && !done; dy++) for (let dx = -r; dx <= r && !done; dx++) { g.place.x = Math.floor(c.x)+dx; g.place.y=Math.floor(c.y)+dy; g.updateGhost(); if (g.place.check.ok && (!['hunter','lumber'].includes(t) || g.place.check.spots>0)) { g.confirmPlace(); done=true; } }
      g.cancelModes(); }
    g.offline(5 * 3600); });
  await page.waitForTimeout(800);
}
